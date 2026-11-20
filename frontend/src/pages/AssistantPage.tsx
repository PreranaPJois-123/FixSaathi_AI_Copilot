import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MessageSquare, Mic, Plus, Sparkles, Wrench } from 'lucide-react'
import { ChatThread } from '../components/chat/ChatThread'
import { Composer } from '../components/composer/Composer'
import { useApp } from '../context/AppContext'
import { suggestions } from '../constants/prompts'

export default function AssistantPage() {
  const { messages, send, thinking, newSession, sessionId, openSession } = useApp()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const want = params.get('session')
  useEffect(() => { if (want && want !== sessionId) void openSession(want) }, [want, sessionId, openSession])
  const firstUser = messages.find(m => m.role === 'user' && m.text)?.text
  return (
    <div className="flex h-full min-h-[calc(100dvh-8rem)] flex-col md:min-h-dvh">
      {sessionId && (
        <div className="glass sticky top-0 z-10 border-b border-line">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-2.5 md:px-6">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal/12 text-teal"><MessageSquare size={16} /></span>
            <p className="min-w-0 flex-1 truncate text-sm font-medium" title={firstUser}>{firstUser || 'Repair conversation'}</p>
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={() => nav(`/session/${sessionId}`)} className="btn btn-sm"><Wrench size={13} />Open repair workspace</button>
              <button onClick={() => nav(`/voice?session=${sessionId}`)} className="btn btn-ghost btn-sm hidden sm:inline-flex"><Mic size={13} />Continue by voice</button>
              <button onClick={() => { newSession(); nav('/') }} className="btn btn-ghost btn-sm" aria-label="New session" title="New session"><Plus size={14} /><span className="hidden sm:inline">New session</span></button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col">
        {messages.length === 0 && !thinking ? (
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-5 px-4 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line-2 bg-surface-2 text-teal shadow-[0_18px_40px_-20px_rgba(45,212,191,.8)]"><Sparkles size={24} /></span>
            <div><h1 className="text-2xl font-semibold md:text-3xl">AI Assistant</h1>
              <p className="mt-2 text-ink-2">Start a conversation about an appliance fault. Ask follow-ups, report what you checked, and FixSaathi narrows it down with you.</p></div>
            <div className="flex flex-wrap justify-center gap-2">{suggestions.map(s => <button key={s.label} onClick={() => void send(s.prompt, [], s.appliance)} className="chip">{s.label}</button>)}</div>
          </div>
        ) : <ChatThread />}
      </div>
      <div className="sticky bottom-0 bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pb-4 pt-6" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto w-full max-w-3xl">
          <Composer compact disabled={thinking} onSend={(t, a) => void send(t, a)} />
          <p className="mt-2 text-center text-[11px] text-ink-3">FixSaathi can make mistakes. Verify isolation with your own tester before opening anything.</p>
        </div>
      </div>
    </div>
  )
}
