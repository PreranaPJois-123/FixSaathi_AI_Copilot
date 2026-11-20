import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, ArrowLeft, Camera, CameraOff, Loader2, Mic, MicOff, PhoneOff, Send, ShieldAlert, Volume2 } from 'lucide-react'
import { Waveform } from '../components/voice/Waveform'
import { Emblem } from '../components/common/Logo'
import { AuthImage } from '../components/common/AuthImage'
import { useLiveVoice } from '../hooks/useLiveVoice'
import { useBrowserVoice } from '../hooks/useBrowserVoice'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { sessionService } from '../services'
import { speakable } from '../utils/text'
import type { VoiceState } from '../types'

const copy: Record<VoiceState, string> = {
  idle: 'Start speaking with FixSaathi',
  connecting: 'Connecting...',
  listening: "I'm listening...",
  processing: 'Analysing your request...',
  responding: 'FixSaathi is responding...',
  error: 'Voice could not start',
}

export default function VoicePage() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const { openSession } = useApp()
  const [sid, setSid] = useState<string | null>(params.get('session'))
  const lv = useLiveVoice(sid)
  const bv = useBrowserVoice()
  const [mode, setMode] = useState<'live' | 'browser'>('live')
  const tried = useRef(false)
  const v = mode === 'browser' ? bv : lv
  const video = useRef<HTMLVideoElement>(null)
  const [text, setText] = useState('')
  const live = v.state === 'listening' || v.state === 'responding'
  const running = v.state !== 'idle' && v.state !== 'error'

  const begin = async () => {
    let id = sid
    if (!id) { const s = await sessionService.create('Live voice session'); id = s.id; setSid(id); setParams({ session: id }, { replace: true }) }
    tried.current = false
    await v.start(id, user?.preferred_language)
  }
  // The Live model is not available to every API key. Fall back to browser speech so voice still works.
  // Only for model/provider problems: a closed session, bad login or denied microphone must still show its own error.
  const NO_FALLBACK = ['SESSION_CLOSED', 'AUTH_REQUIRED', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'INVALID_JSON', 'TIMEOUT', 'CONFLICT', 'RATE_LIMITED', 'VALIDATION_ERROR']
  const liveUnavailable = lv.state === 'error' && !!lv.errorCode && !NO_FALLBACK.includes(lv.errorCode)
  useEffect(() => {
    if (mode === 'live' && liveUnavailable && bv.supported && sid && !tried.current) {
      tried.current = true; setMode('browser'); void bv.start(sid, user?.preferred_language)
    }
  }, [mode, liveUnavailable, bv, sid, user?.preferred_language])
  const submit = (e: FormEvent) => { e.preventDefault(); v.sendText(text); setText('') }
  const waveState = v.state === 'connecting' ? 'processing' : v.state

  return (
    <div className="relative flex min-h-full flex-col items-center px-6 py-6" style={{ background: 'radial-gradient(55% 48% at 50% 30%, rgba(47,196,176,.16), rgba(56,182,232,.06) 55%, transparent 78%)' }}>
      <div className="flex w-full max-w-4xl items-center justify-between">
        <button onClick={() => { if (sid) { void openSession(sid); nav(`/assistant?session=${sid}`) } else nav('/assistant') }} className="btn btn-ghost"><ArrowLeft size={16} />Return to text chat</button>
        {sid && <Link to={`/session/${sid}`} className="btn btn-sm">Open repair workspace</Link>}
      </div>

      <div className="grid w-full max-w-4xl flex-1 items-start gap-8 py-6 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col items-center gap-6">
          <div className="relative flex h-52 w-52 items-center justify-center">
            {live && [0, 1].map(i => <motion.span key={i} className="fs-grad-bg absolute inset-0 rounded-full opacity-20" initial={{ scale: 0.8, opacity: 0.3 }} animate={{ scale: 1.35, opacity: 0 }} transition={{ duration: 2.2, repeat: Infinity, delay: i * 1.1, ease: 'easeOut' }} />)}
            {(v.state === 'processing' || v.state === 'connecting') && <span className="absolute inset-3 rounded-full border-2 border-transparent border-t-teal" style={{ animation: 'fs-spin 1.1s linear infinite' }} />}
            <div className={`relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border ${v.state === 'error' ? 'border-crit/50' : 'border-teal/30'} bg-surface/80 shadow-[0_0_60px_-10px_rgba(47,196,176,0.45)]`}>
              <video ref={video} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${v.cameraOn ? '' : 'hidden'}`} />
              {!v.cameraOn && (v.state === 'error' ? <AlertCircle size={52} className="text-crit" /> : v.state === 'processing' || v.state === 'connecting' ? <Loader2 size={46} className="animate-spin text-teal" /> : v.state === 'responding' ? <Volume2 size={50} className="text-teal" /> : <Emblem height={84} />)}
            </div>
          </div>
          <Waveform state={waveState} />
          <AnimatePresence mode="wait">
            <motion.p key={v.state + (v.tool ?? '')} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center text-xl font-medium" role="status" aria-live="polite">
              {v.tool ? `Working: ${v.tool.replace(/_/g, ' ')}...` : copy[v.state]}
            </motion.p>
          </AnimatePresence>
          {mode === 'live' && liveUnavailable && !bv.supported && <p role="alert" className="max-w-sm text-center text-sm text-warn">Gemini Live is unavailable for this server key and this browser has no speech recognition. Use Chrome or Edge for voice, or type below in the chat.</p>}
          {mode === 'browser' && lv.error && !bv.error && <p className="max-w-sm text-center text-xs text-ink-3">Gemini Live is unavailable for this server key, so browser voice mode is on.</p>}
          {v.error && <p role="alert" className="max-w-sm text-center text-sm text-crit">{v.error}</p>}
          <div className="flex items-center gap-4">
            <button onClick={v.toggleMute} disabled={!running} aria-pressed={v.muted} aria-label={v.muted ? 'Unmute microphone' : 'Mute microphone'} className={`flex h-14 w-14 items-center justify-center rounded-full border ${v.muted ? 'border-warn/50 text-warn' : 'border-line text-ink-2'} hover:bg-surface disabled:opacity-40`}>{v.muted ? <MicOff /> : <Mic />}</button>
            <button onClick={running ? v.stop : () => void begin()} aria-label={running ? 'Stop' : 'Start conversation'} className="fs-amber-bg flex h-20 w-20 items-center justify-center rounded-full text-bg shadow-[0_10px_40px_-10px_rgba(255,157,61,0.8)]">
              {running ? <span className="h-6 w-6 rounded-md bg-bg" /> : <Mic size={30} />}
            </button>
            <button onClick={() => void v.toggleCamera(video.current)} disabled={!running} aria-label={v.cameraOn ? 'Stop camera' : 'Show the appliance'} className="flex h-14 w-14 items-center justify-center rounded-full border border-line text-ink-2 hover:bg-surface disabled:opacity-40">{v.cameraOn ? <CameraOff /> : <Camera />}</button>
            <button onClick={() => { v.stop(); if (sid) nav(`/session/${sid}`) }} aria-label="End conversation" className="flex h-14 w-14 items-center justify-center rounded-full border border-crit/40 text-crit hover:bg-crit/10"><PhoneOff /></button>
          </div>
          {running && <form onSubmit={submit} className="flex w-full max-w-sm gap-2"><label className="sr-only" htmlFor="lt">Type instead</label><input id="lt" value={text} onChange={e => setText(e.target.value)} placeholder="Too noisy? Type here" className="field flex-1 !py-2 text-sm" /><button aria-label="Send" className="btn px-3"><Send size={16} /></button></form>}
          <p className="max-w-sm text-center text-xs text-ink-3">{mode === 'browser' ? 'Browser voice mode: your browser turns speech into text, Gemini answers through the FixSaathi server, and your browser reads the answer aloud. Live camera is only available in Gemini Live mode.' : (v.state === 'listening' || v.state === 'responding') ? 'Gemini Live mode: audio streams to Gemini through the FixSaathi server. Raw audio and video are not stored; transcripts are saved to this session.' : 'Uses Gemini Live when the server\'s API key supports it; otherwise your browser\'s speech recognition, with Gemini answering through the server. Transcripts are saved to this session.'}</p>
        </div>

        <div className="space-y-4">
          {v.blocked && (
            <div role="alert" className="rounded-2xl border border-crit/40 bg-crit/10 p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold text-crit"><ShieldAlert size={16} />Locked by the server: {v.blocked}</p>
              <p className="mt-1 text-ink-2">Switch off at the MCB, check with your own tester, then record both statements.</p>
              {sid && <Link to={`/session/${sid}`} className="mt-2 inline-block font-medium text-teal">Open the safety panel</Link>}
            </div>
          )}
          {mode === 'browser' && !bv.analysing && bv.lines.some(l => l.role === 'assistant') && (
            <button onClick={bv.analyse} className="w-full rounded-2xl border border-teal/40 bg-teal/10 px-4 py-3 text-sm font-medium text-teal transition hover:bg-teal/20">
              {bv.diag ? 'Update diagnosis and steps' : 'Diagnose now and get safe repair steps'}
            </button>
          )}
          {mode === 'browser' && bv.analysing && <p className="flex items-center gap-2 text-sm text-ink-3"><Loader2 size={14} className="animate-spin text-teal" />Analysing the problem and preparing safe repair steps...</p>}
          {mode === 'browser' && bv.diag && (
            <div className="card p-4 text-sm">
              <p className="text-xs uppercase tracking-wider text-ink-3">Possible causes (AI estimate, check before acting)</p>
              <ul className="mt-2 space-y-1">{bv.diag.faults.slice(0, 4).map((f, i) => <li key={i}><span className="font-medium">{f.fault}</span> <span className="text-ink-3">{Math.round(f.confidence * 100)}%</span><br /><span className="text-ink-2">{f.explanation}</span></li>)}</ul>
              {bv.diag.recommended_checks.length > 0 && <><p className="mt-3 text-xs uppercase tracking-wider text-ink-3">Recommended checks</p><ul className="mt-1 list-disc pl-5 text-ink-2">{bv.diag.recommended_checks.slice(0, 5).map((c, i) => <li key={i}>{c}</li>)}</ul></>}
              {bv.diag.sources.length > 0 && <p className="mt-3 text-xs text-ink-3">Sources: {bv.diag.sources.slice(0, 3).map(x => x.source_name).join(', ')}</p>}
              {bv.diag.requires_escalation && <p className="mt-3 font-medium text-crit">A senior technician is recommended for this job.</p>}
            </div>
          )}
          {v.diagnosis && mode !== 'browser' && <div className="card p-4 text-sm"><p className="text-xs uppercase tracking-wider text-ink-3">Diagnosis (AI estimate)</p><p className="mt-1">{v.diagnosis}</p></div>}
          {v.part && <div className="card p-4 text-sm"><AuthImage src={v.part.url} alt="Latest camera frame" className="h-48 w-full rounded-xl" box={v.part.box} label={v.part.component_name} /><p className="mt-2">{v.part.found ? v.part.component_name : 'Not identified'}: <span className="text-ink-2">{v.part.explanation}</span></p></div>}
          {v.steps.length > 0 && <ol className="space-y-2">{v.steps.map(s => <li key={s.id} className="card p-3.5 text-sm"><p className="font-medium">{s.step_number}. {s.title}{s.requires_power_off && <span className="ml-2 rounded-full border border-crit/40 px-2 py-px text-[11px] text-crit">power off</span>}</p><p className="text-ink-2">{s.instruction}</p></li>)}</ol>}
          <div className="card max-h-80 space-y-2.5 overflow-y-auto p-4" aria-live="polite" aria-label="Live transcript">
            {v.lines.length === 0 ? <p className="text-sm text-ink-3">The live transcript will appear here.</p> :
              v.lines.map(l => <p key={l.id} className={`text-sm ${l.role === 'user' ? 'text-ink' : 'text-teal'}`}><span className="text-ink-3">{l.role === 'user' ? 'You: ' : 'FixSaathi: '}</span>{l.role === 'user' ? l.text : speakable(l.text)}</p>)}
          </div>
        </div>
      </div>
    </div>
  )
}
