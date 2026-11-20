import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Check, Copy, PlayCircle, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Emblem } from '../common/Logo'
import { useApp } from '../../context/AppContext'
import type { ChatMessage } from '../../types'
import { SourceList } from '../common/SourceList'
import { AuthImage } from '../common/AuthImage'
import { Markdown } from './Markdown'
import { DocChip } from '../composer/Composer'
import { openFile } from '../../utils/openFile'
import { speakable } from '../../utils/text'

const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function Avatar() {
  return <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-line bg-gradient-to-b from-surface-2 to-surface shadow-[0_8px_20px_-12px_rgba(45,212,191,.6)]"><Emblem height={22} /></div>
}

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  const copy = async () => { try { await navigator.clipboard.writeText(speakable(text)); setOk(true); setTimeout(() => setOk(false), 1500) } catch { /* clipboard blocked */ } }
  return <button onClick={copy} aria-label="Copy answer" title="Copy answer" className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink">{ok ? <Check size={12} className="text-ok" /> : <Copy size={12} />}{ok ? 'Copied' : 'Copy'}</button>
}

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === 'system') {
    return (
      <div role="status" className="mx-auto flex max-w-xl items-start gap-3 rounded-2xl border border-warn/35 bg-warn/[0.07] px-4 py-3.5 text-sm text-warn">
        <AlertTriangle size={17} className="mt-0.5 shrink-0" />
        <span>
          {m.notice === 'ai_unavailable' ? `AI is not available: ${m.text}` : `The AI could not reply: ${m.text}`} Your message was saved.
          {m.hint && <span className="mt-1.5 block text-xs text-ink-2">Fix: {m.hint}{m.errorCode ? ` (${m.errorCode})` : ''}</span>}
          <Link to="/demo" className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal hover:underline"><PlayCircle size={13} />Show the product with a labelled demo scenario instead</Link>
        </span>
      </div>
    )
  }
  const mine = m.role === 'user'
  const photos = m.attachments && m.attachments.length > 0 && (
    <div className={`mb-2 flex flex-wrap gap-2 ${mine ? 'justify-end' : ''}`}>{m.attachments.map(a => a.kind === 'document'
      ? <DocChip key={a.id} name={a.name || 'Document'} size={a.size} onOpen={() => void openFile(a).catch(() => undefined)} />
      : a.server
        ? <AuthImage key={a.id} src={a.url} alt="Attached appliance" className="h-32 w-32 overflow-hidden rounded-2xl border border-line shadow-lg" />
        : <img key={a.id} src={a.url} alt="Attached appliance" className="h-32 w-32 rounded-2xl border border-line object-cover shadow-lg" />)}</div>
  )
  if (mine) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="flex justify-end">
        <div className="flex max-w-[85%] flex-col items-end sm:max-w-[72%]">
          {photos}
          {m.text && <div className="whitespace-pre-wrap rounded-[22px] rounded-br-md border border-line-2 bg-gradient-to-b from-surface-3 to-surface-2 px-4 py-2.5 text-[15px] leading-relaxed text-ink shadow-[0_10px_30px_-18px_rgba(0,0,0,.8)]">{m.text}</div>}
          <span className="mt-1 px-1 text-[11px] text-ink-3">{time(m.at)}</span>
        </div>
      </motion.div>
    )
  }
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex gap-3">
      <Avatar />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-xs"><span className="font-semibold text-ink">FixSaathi</span><span className="text-ink-3">{time(m.at)}</span>
          {m.demo && <span className="rounded-full border border-warn/50 bg-warn/10 px-2 py-px font-medium text-warn">Demo scenario: scripted sample, not live AI</span>}</div>
        {photos}
        {m.text && <Markdown text={m.text} sources={m.sources} />}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
          {m.aiGenerated && <span className="inline-flex items-center gap-1"><Sparkles size={11} className="text-teal" />AI-generated, check before acting</span>}
          {m.text && <CopyButton text={m.text} />}
        </div>
        {m.sources && m.sources.length > 0 && <SourceList sources={m.sources} />}
      </div>
    </motion.div>
  )
}

function ThinkingLabel({ progress }: { progress: string | null }) {
  const [t, setT] = useState(0)
  useEffect(() => { const id = setInterval(() => setT(x => x + 1), 1000); return () => clearInterval(id) }, [])
  if (progress) return <span className="text-sm"><span className="text-shimmer font-medium">{progress}...</span></span>
  const phase = t < 3 ? 'Reading your message' : t < 8 ? 'Checking the repair knowledge base' : t < 20 ? 'Gemini is working on the answer' : 'Still working, Gemini is busy'
  return <span className="text-sm tabular-nums"><span className="text-shimmer font-medium">{phase}...</span> <span className="text-ink-3">{t}s</span></span>
}

export function ChatThread() {
  const { messages, thinking, progress, error } = useApp()
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages.length, thinking])
  return (
    <div className="mx-auto w-full max-w-3xl space-y-7 px-4 py-8 md:px-6" role="log" aria-live="polite" aria-label="Conversation">
      {messages.map(m => <Bubble key={m.id} m={m} />)}
      {thinking && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3" aria-label="FixSaathi is thinking">
          <Avatar />
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/60 px-4 py-2.5">
            <span className="flex items-center gap-1">{[0, 1, 2].map(i => <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-teal" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
            <ThinkingLabel progress={progress} />
          </div>
        </motion.div>
      )}
      {error && <p role="alert" className="rounded-2xl border border-crit/40 bg-crit/10 px-4 py-3 text-sm text-crit">{error}</p>}
      <div ref={end} />
    </div>
  )
}
