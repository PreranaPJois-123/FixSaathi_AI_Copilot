import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError } from '../services/api'
import { chatService, fileService, sessionService } from '../services'
import type { Attachment, ChatMessage, MessageFile, ServerMessage, SourceRef } from '../types'

interface Ctx {
  collapsed: boolean
  toggleCollapsed: () => void
  sessionId: string | null
  messages: ChatMessage[]
  thinking: boolean
  /** Shown while files upload before the message is sent, e.g. "Uploading 2 of 3: manual.pdf". */
  progress: string | null
  /** A message that could not be sent, handed back to whichever composer is on screen. */
  draft: { text: string; attachments: Attachment[] } | null
  clearDraft: () => void
  error: string | null
  sessionsVersion: number
  /** Resolves false when nothing was sent (e.g. an upload failed), so the composer can restore the draft. */
  send: (text: string, attachments?: Attachment[], appliance?: string) => Promise<boolean>
  openSession: (id: string) => Promise<void>
  newSession: () => void
}
const AppCtx = createContext<Ctx | null>(null)
const uid = () => Math.random().toString(36).slice(2, 10)

export const toChat = (m: ServerMessage): ChatMessage => ({
  id: m.id, role: m.role, text: m.message, at: new Date(m.created_at).getTime(), aiGenerated: m.meta?.ai_generated === true, demo: m.meta?.demo === true && m.role === 'assistant',
  sources: (m.meta?.sources as SourceRef[] | undefined) ?? [],
  // Files saved with the message: loaded through the authenticated media endpoint when a session is reopened.
  attachments: serverFiles(m),
})

function serverFiles(m: ServerMessage): MessageFile[] {
  const rich = m.meta?.attachments as { id: string; kind?: 'image' | 'document'; name?: string; size?: number; mime?: string; pages?: number }[] | undefined
  if (rich?.length) return rich.map(f => ({ ...f, url: `/api/v1/media/${f.id}`, server: true, name: f.name ?? undefined }))
  return ((m.meta?.media_ids as string[] | undefined) ?? []).map(id => ({ id, url: `/api/v1/media/${id}`, server: true, kind: 'image' as const }))
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Tablets get the slim sidebar by default so the chat has room; the user can still expand it.
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1180)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [thinking, setThinking] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ text: string; attachments: Attachment[] } | null>(null)
  const clearDraft = useCallback(() => setDraft(null), [])
  const [error, setError] = useState<string | null>(null)
  const [sessionsVersion, setSessionsVersion] = useState(0)
  const busy = useRef(false)
  const sid = useRef<string | null>(null)

  const openSession = useCallback(async (id: string) => {
    sid.current = id; setSessionId(id); setError(null)
    try { setMessages((await chatService.history(id)).items.map(toChat)) } catch (e) { setError((e as ApiError).message) }
  }, [])

  const send = useCallback(async (text: string, attachments: Attachment[] = [], appliance?: string): Promise<boolean> => {
    if (busy.current || (!text.trim() && attachments.length === 0)) return false
    busy.current = true; setError(null)
    const localId = uid()
    setMessages(m => [...m, { id: localId, role: 'user', text: text.trim(), at: Date.now(),
      attachments: attachments.map(a => ({ id: a.id, url: a.url, kind: a.kind, name: a.name, size: a.size })) }])
    setThinking(true)
    let stage = 'session'
    try {
      if (!sid.current) {
        const first = text.trim() || (attachments.some(a => a.kind === 'document') ? 'Shared a document' : 'Photo shared')
        const s = await sessionService.create(first, appliance)
        sid.current = s.id; setSessionId(s.id); setSessionsVersion(v => v + 1)
      }
      stage = 'upload'
      const ids: string[] = []
      for (const [i, a] of attachments.entries()) {
        setProgress(attachments.length > 1 ? `Uploading ${i + 1} of ${attachments.length}: ${a.name}` : `Uploading ${a.name}`)
        try { ids.push((await fileService.upload(sid.current, a.file, a.source === 'camera' ? 'capture' : 'upload', a.name)).id) }
        catch (e) { throw new Error(`Could not upload “${a.name}”: ${(e as ApiError).message}`) }
      }
      setProgress(null); stage = 'send'
      const r = await chatService.send(sid.current, text.trim(), ids)
      setMessages(m => {
        const next = m.map(x => x.id === localId ? { ...toChat(r.user_message), attachments: x.attachments } : x)
        if (r.assistant_message) next.push(toChat(r.assistant_message))
        else next.push({ id: uid(), role: 'system', at: Date.now(), notice: r.ai_status === 'unavailable' ? 'ai_unavailable' : 'ai_error',
          text: r.ai_error?.message || 'The AI could not reply.', hint: r.ai_error?.hint, errorCode: r.ai_error?.code })
        return next
      })
      return true
    } catch (e) {
      // Nothing reached the AI: take the unsent message back out so the composer can restore it.
      setMessages(m => m.filter(x => x.id !== localId))
      setDraft({ text, attachments })
      const msg = (e as ApiError).message || 'Something went wrong.'
      setError(stage === 'upload' ? `${msg} Your message was not sent; it is back in the box.` : stage === 'session' ? `Could not start the session: ${msg}` : `${msg} Your message is back in the box: try again.`)
      return false
    } finally { setThinking(false); setProgress(null); busy.current = false }
  }, [])

  const newSession = useCallback(() => { sid.current = null; setSessionId(null); setMessages([]); setThinking(false); setProgress(null); setError(null) }, [])

  const value = useMemo<Ctx>(() => ({ collapsed, toggleCollapsed: () => setCollapsed(c => !c), sessionId, messages, thinking, progress, draft, clearDraft, error, sessionsVersion, send, openSession, newSession }),
    [collapsed, sessionId, messages, thinking, progress, draft, clearDraft, error, sessionsVersion, send, openSession, newSession])
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp() {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp must be used inside AppProvider')
  return c
}
