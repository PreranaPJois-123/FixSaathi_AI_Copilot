/**
 * Spoken replies.
 *
 * Natural voice: Gemini text-to-speech on the server (GET /sessions/{id}/messages/{id}/speech), with a prebuilt voice chosen in
 * Settings. It speaks the stored, safety-screened reply, so audio never says more than the screen shows.
 * Device voice: the browser's speech synthesis. Used when the natural voice is unavailable (no TTS model configured, the
 * API key's daily TTS limit reached, offline) or for text that is not a stored reply (the Settings sample). Quality there comes
 * from choosing the voice well: neural / "Natural" voices are preferred, the old novelty voices are never picked, and text is
 * spoken sentence by sentence.
 *
 * Nothing here decides *when* to speak. Callers do: a reply is read aloud by itself only when it answers a voice message and
 * the speaker is on (ChatPage); otherwise only when the technician presses Read aloud.
 */
import { speakable } from '../utils/text'
import { api, ApiError } from './api'

export const SPEECH_LANG: Record<string, string> = { English: 'en-IN', Hindi: 'hi-IN', Kannada: 'kn-IN', Tamil: 'ta-IN' }

const synth = (): SpeechSynthesis | null => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null)
export const speechSupported = () => !!synth() || typeof Audio !== 'undefined'

// Old formant and novelty voices (macOS, eSpeak): they are what makes browser speech sound robotic.
const POOR = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley|espeak|compact)\b/i
const NATURAL = /natural|neural|online|premium|enhanced|wavenet|studio/i

function score(v: SpeechSynthesisVoice, tag: string): number {
  const lang = v.lang.replace('_', '-').toLowerCase()
  const want = tag.toLowerCase()
  let s = lang === want ? 40 : lang.split('-')[0] === want.split('-')[0] ? 25 : -1000
  if (POOR.test(v.name)) s -= 200
  if (NATURAL.test(v.name)) s += 30
  if (/google/i.test(v.name)) s += 18  // Chrome's network voices are clear and well paced
  if (/microsoft/i.test(v.name) && !NATURAL.test(v.name)) s -= 5  // older desktop SAPI voices
  if (/\b(rishi|veena|samantha|daniel|karen|moira|tessa|serena|lekha|neerja|prabhat|madhur|swara|kavya)\b/i.test(v.name)) s += 8
  if (v.localService === false) s += 2
  return s
}

export function voicesFor(language: string): SpeechSynthesisVoice[] {
  const tag = SPEECH_LANG[language] || 'en-IN'
  return (synth()?.getVoices() ?? []).filter(v => score(v, tag) > -500).sort((a, b) => score(b, tag) - score(a, tag))
}

export function pickVoice(language: string, preferred?: string | null): SpeechSynthesisVoice | null {
  const list = voicesFor(language)
  return (preferred && list.find(v => v.voiceURI === preferred)) || list[0] || null
}

/** Voices load asynchronously in Chrome; call back when the list changes. */
export function onVoicesChanged(fn: () => void): () => void {
  const s = synth(); if (!s) return () => undefined
  s.addEventListener?.('voiceschanged', fn)
  return () => s.removeEventListener?.('voiceschanged', fn)
}

/** Sentences of at most ~220 characters, so each utterance is short and ends at a natural pause. */
export function chunks(text: string): string[] {
  const plain = speakable(text).replace(/\n+/g, '. ').replace(/\.\s*\./g, '.')
  const parts = plain.match(/[^.!?।]+[.!?।]*/g) ?? [plain]
  const out: string[] = []
  for (const raw of parts) {
    const p = raw.trim(); if (!p) continue
    if (p.length <= 220) { out.push(p); continue }
    let rest = p
    while (rest.length > 220) { const cut = rest.lastIndexOf(',', 220) > 80 ? rest.lastIndexOf(',', 220) + 1 : rest.lastIndexOf(' ', 220); out.push(rest.slice(0, cut).trim()); rest = rest.slice(cut) }
    if (rest.trim()) out.push(rest.trim())
  }
  return out
}

export type SpeechPhase = 'idle' | 'preparing' | 'speaking'
export type Engine = 'natural' | 'device'
/** Gemini prebuilt voices offered in Settings (the server accepts the same list). 'device' always uses the browser voice. */
export const AI_VOICES = ['Charon', 'Leda', 'Achird', 'Sulafat', 'Puck', 'Kore', 'Iapetus', 'Orus', 'Alnilam', 'Sadaltager'] as const

type Listener = () => void
const listeners = new Set<Listener>()
let run = 0
let phase: SpeechPhase = 'idle'
let engine: Engine | null = null
let audio: HTMLAudioElement | null = null
let fetching: AbortController | null = null
let naturalBlockedUntil = 0  // after "not configured" or a quota error, skip the natural voice for a while instead of failing again
const set = (p: SpeechPhase, e: Engine | null = engine) => { if (phase !== p || engine !== e) { phase = p; engine = e; listeners.forEach(l => l()) } }

export interface SpeakOpts {
  language: string
  voiceURI?: string | null
  rate?: number
  /** Gemini voice name, or 'device' for the browser voice only. */
  aiVoice?: string | null
  /** The stored reply being spoken. Without it (e.g. a sample sentence) the device voice is used. */
  source?: { sessionId: string; messageId: string } | null
}

function speakDevice(id: number, text: string, opts: SpeakOpts) {
  const s = synth()
  const parts = chunks(text)
  if (!s || !parts.length) { set('idle', null); return }
  const voice = pickVoice(opts.language, opts.voiceURI)
  const lang = voice?.lang || SPEECH_LANG[opts.language] || 'en-IN'
  set('speaking', 'device')
  const next = (i: number) => {
    if (id !== run) return
    if (i >= parts.length) { set('idle', null); return }
    const u = new SpeechSynthesisUtterance(parts[i])
    if (voice) u.voice = voice
    u.lang = lang; u.rate = opts.rate ?? 1; u.pitch = 1; u.volume = 1
    u.onend = () => next(i + 1)
    u.onerror = e => { if (id === run && e.error !== 'interrupted' && e.error !== 'canceled') next(i + 1) }
    s.speak(u)
  }
  next(0)
}

async function speakNatural(id: number, text: string, opts: SpeakOpts & { source: { sessionId: string; messageId: string } }) {
  set('preparing', 'natural')
  const ctl = new AbortController(); fetching = ctl
  let blob: Blob
  try {
    const voice = opts.aiVoice ? `?voice=${encodeURIComponent(opts.aiVoice)}` : ''
    const r = await api<Response>(`/api/v1/sessions/${opts.source.sessionId}/messages/${opts.source.messageId}/speech${voice}`, { raw: true, timeoutMs: 60000, signal: ctl.signal })
    blob = await r.blob()
  } catch (e) {
    if (id !== run) return
    const code = (e as ApiError).code
    if (code === 'CANCELLED') return
    if (['MODEL_NOT_CONFIGURED', 'AI_NOT_CONFIGURED', 'QUOTA_EXCEEDED', 'BILLING_REQUIRED', 'MODEL_NOT_FOUND'].includes(code)) naturalBlockedUntil = Date.now() + 10 * 60_000
    speakDevice(id, text, opts)  // the reply is still read, in the device voice
    return
  } finally { if (fetching === ctl) fetching = null }
  if (id !== run) return
  const url = URL.createObjectURL(blob)
  const a = new Audio(url); audio = a
  a.playbackRate = opts.rate ?? 1  // the technician's own speed setting; pitch is preserved by the browser
  const done = () => { URL.revokeObjectURL(url); if (audio === a) audio = null; if (id === run) set('idle', null) }
  a.onended = done
  a.onerror = () => { done(); if (id === run) speakDevice(id, text, opts) }
  set('speaking', 'natural')
  try { await a.play() } catch { done(); if (id === run) speakDevice(id, text, opts) }  // e.g. autoplay blocked
}

export const speech = {
  /** True while a reply is being prepared or spoken (the Stop control is shown). */
  isSpeaking: () => phase !== 'idle',
  phase: () => phase,
  engine: () => engine,
  subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn) } },
  /** Speaks one reply. Anything still playing or being prepared is stopped first, so two answers never overlap. */
  speak(text: string, opts: SpeakOpts) {
    this.stop()
    const id = ++run
    if (!speakable(text).trim()) return
    if (opts.source && opts.aiVoice !== 'device' && Date.now() >= naturalBlockedUntil) void speakNatural(id, text, { ...opts, source: opts.source })
    else speakDevice(id, text, opts)
  },
  stop() {
    run++
    fetching?.abort(); fetching = null
    if (audio) { audio.pause(); audio.src = ''; audio = null }
    synth()?.cancel()
    set('idle', null)
  },
  /** For tests. */
  _reset() { naturalBlockedUntil = 0 },
}
