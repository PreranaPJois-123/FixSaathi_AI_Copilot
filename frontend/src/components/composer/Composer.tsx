import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Camera, FileText, ImagePlus, Loader2, Mic, Paperclip, Plus, X } from 'lucide-react'
import { CameraModal } from '../camera/CameraModal'
import { FILE_RULES, fileService, fmtSize } from '../../services'
import { useApp } from '../../context/AppContext'
import type { Attachment } from '../../types'

interface Props { onSend: (text: string, attachments: Attachment[]) => void; disabled?: boolean; autoFocus?: boolean; initial?: string; compact?: boolean }

const uid = () => Math.random().toString(36).slice(2, 10)

/** A file chip for a document (PDF, Word, text). */
export function DocChip({ name, size, onRemove, onOpen }: { name: string; size?: number; onRemove?: () => void; onOpen?: () => void }) {
  const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase() : 'FILE'
  const body = (
    <>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ext === 'PDF' ? 'bg-crit/15 text-crit' : ext === 'DOCX' ? 'bg-blue/15 text-blue' : 'bg-teal/15 text-teal'}`}><FileText size={16} /></span>
      <span className="min-w-0"><span className="block truncate text-[13px] font-medium text-ink">{name}</span><span className="block text-[11px] text-ink-3">{ext}{size ? ` · ${fmtSize(size)}` : ''}</span></span>
    </>
  )
  const cls = 'relative inline-flex max-w-[240px] items-center gap-2.5 rounded-xl border border-line-2 bg-surface-2 py-2 pl-2.5 pr-3 text-left'
  return (
    <span className="relative inline-flex">
      {onOpen ? <button type="button" onClick={onOpen} title={`Open ${name}`} className={`${cls} transition-colors hover:border-teal/50`}>{body}</button> : <span className={cls}>{body}</span>}
      {onRemove && <button type="button" aria-label={`Remove ${name}`} onClick={onRemove} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface-3 text-ink ring-1 ring-line-2 hover:bg-crit"><X size={11} /></button>}
    </span>
  )
}

export function Composer({ onSend, disabled, autoFocus, compact }: Props) {
  const { draft, clearDraft } = useApp()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<Attachment[]>([])
  const [camera, setCamera] = useState(false)
  const [menu, setMenu] = useState(false)
  const [drag, setDrag] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const imgInput = useRef<HTMLInputElement>(null)
  const docInput = useRef<HTMLInputElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const plusRef = useRef<HTMLButtonElement>(null)
  const nav = useNavigate()
  const canSend = !disabled && (text.trim().length > 0 || files.length > 0)

  // Grow with the text up to a limit, like a modern chat box.
  useEffect(() => {
    const el = area.current; if (!el) return
    el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [text])

  // A message that failed to upload or send comes back here, so nothing typed or attached is lost.
  useEffect(() => {
    if (!draft) return
    setText(draft.text); setFiles(draft.attachments); clearDraft(); area.current?.focus()
  }, [draft, clearDraft])

  // Close the attach menu on outside click or Escape; move focus into it when it opens.
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node) && !plusRef.current?.contains(e.target as Node)) setMenu(false) }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); plusRef.current?.focus() } }
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey)
    const t = setTimeout(() => menuRef.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus(), 0)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menu])

  const add = (list: (File | Attachment)[]) => {
    const errs: string[] = []
    const next = [...files]
    for (const it of list) {
      if (next.length >= FILE_RULES.maxPerMessage) { errs.push(`You can attach up to ${FILE_RULES.maxPerMessage} files per message.`); break }
      if (!(it instanceof File) && 'kind' in it) { next.push(it); continue }
      const f = it as File
      const c = fileService.check(f)
      if ('error' in c) { errs.push(c.error); continue }
      next.push({ id: uid(), name: f.name, url: URL.createObjectURL(f), source: 'upload', kind: c.kind, size: f.size, file: f })
    }
    setFiles(next); setErrors([...new Set(errs)])
  }
  const remove = (id: string) => { const x = files.find(f => f.id === id); if (x) URL.revokeObjectURL(x.url); setFiles(files.filter(f => f.id !== id)) }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSend) return
    onSend(text, files); setText(''); setFiles([]); setErrors([])
  }
  const key = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }
  const paste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = Array.from(e.clipboardData?.files ?? [])
    if (pasted.length) { e.preventDefault(); add(pasted) }
  }
  const drop = (e: DragEvent) => { e.preventDefault(); setDrag(false); const d = Array.from(e.dataTransfer?.files ?? []); if (d.length) add(d) }
  const pick = (input: HTMLInputElement) => { add(Array.from(input.files ?? [])); input.value = '' }
  const choose = (what: 'images' | 'docs' | 'camera') => {
    setMenu(false)
    if (what === 'camera') setCamera(true)
    else (what === 'images' ? imgInput : docInput).current?.click()
  }
  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-surface-3 focus:bg-surface-3 focus:outline-none'

  return (
    <>
      <div onDragOver={e => { e.preventDefault(); if (!drag) setDrag(true) }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false) }} onDrop={drop}
        className={`fs-border-grad relative w-full rounded-[26px] p-px transition-shadow ${compact ? 'shadow-[0_14px_40px_-24px_rgba(45,212,191,.5)]' : 'shadow-[0_24px_70px_-30px_rgba(45,212,191,.55)]'} focus-within:shadow-[0_20px_70px_-22px_rgba(255,159,67,.45)]`}>
        {drag && <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[26px] border-2 border-dashed border-teal bg-bg/85 text-sm font-medium text-teal"><Paperclip size={16} className="mr-2" />Drop photos or documents to attach</div>}
        <form onSubmit={submit} className="w-full rounded-[25px] bg-[#0b1220]/95 p-2.5 backdrop-blur-xl">
          {files.length > 0 && (
            <ul className="mb-1.5 flex flex-wrap gap-2 px-1.5 pt-1" aria-label="Attached files">
              {files.map(f => (
                <li key={f.id} className="relative">
                  {f.kind === 'image'
                    ? <><img src={f.url} alt={`Attachment ${f.name}`} className="h-16 w-16 rounded-xl border border-line object-cover" />
                      <button type="button" aria-label={`Remove ${f.name}`} onClick={() => remove(f.id)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface-3 text-ink ring-1 ring-line-2 hover:bg-crit"><X size={11} /></button></>
                    : <DocChip name={f.name} size={f.size} onRemove={() => remove(f.id)} />}
                </li>
              ))}
            </ul>
          )}
          <label className="sr-only" htmlFor="composer-input">Describe the appliance issue</label>
          <textarea id="composer-input" ref={area} maxLength={4000} value={text} onChange={e => setText(e.target.value)} onKeyDown={key} onPaste={paste} autoFocus={autoFocus} rows={compact ? 1 : 2}
            placeholder={compact ? 'Ask a follow-up, report a check result, or describe a new fault...' : 'Describe the fault, e.g. "LG split AC showing CH38, not cooling"'}
            className="block max-h-[200px] w-full resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-3" />
          <div className="flex items-center justify-between gap-2 px-0.5">
            <div className="relative flex items-center">
              <input ref={imgInput} id="attach-images" data-testid="attach-images" type="file" accept={FILE_RULES.acceptImages} multiple hidden onChange={e => pick(e.currentTarget)} />
              <input ref={docInput} id="attach-docs" data-testid="attach-docs" type="file" accept={FILE_RULES.acceptDocs} multiple hidden onChange={e => pick(e.currentTarget)} />
              <button ref={plusRef} type="button" aria-label="Add photos, documents or camera" aria-haspopup="menu" aria-expanded={menu} title="Attach photos, PDFs or documents, or use the camera"
                onClick={() => setMenu(m => !m)} className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all ${menu ? 'rotate-45 border-teal/60 bg-teal/15 text-teal' : 'border-line-2 bg-surface-2 text-ink hover:border-teal/50 hover:text-teal'}`}>
                <Plus size={20} strokeWidth={2.3} />
              </button>
              <AnimatePresence>
                {menu && (
                  <motion.div ref={menuRef} role="menu" aria-label="Attach" initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.97 }} transition={{ duration: 0.14 }}
                    className="absolute bottom-12 left-0 z-30 w-[min(18rem,calc(100vw-3rem))] rounded-2xl border border-line-2 bg-surface-2 p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,.85)]">
                    <button role="menuitem" type="button" onClick={() => choose('images')} className={item}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal/12 text-teal"><ImagePlus size={18} /></span><span><span className="block font-medium">Photos and images</span><span className="block text-xs text-ink-3">JPG, PNG, WebP · several at once</span></span></button>
                    <button role="menuitem" type="button" onClick={() => choose('docs')} className={item}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-crit/12 text-crit"><FileText size={18} /></span><span><span className="block font-medium">PDF or document</span><span className="block text-xs text-ink-3">PDF, Word (.docx), TXT, CSV · up to 15 MB</span></span></button>
                    <button role="menuitem" type="button" onClick={() => choose('camera')} className={item}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber/12 text-amber"><Camera size={18} /></span><span><span className="block font-medium">Take a photo</span><span className="block text-xs text-ink-3">Use your device camera</span></span></button>
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="ml-3 hidden text-[11px] text-ink-3 lg:inline">Enter to send · Shift+Enter new line · drop files here</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Start voice conversation" title="Start voice conversation" onClick={() => nav('/voice')} className="inline-flex h-10 items-center gap-2 rounded-full border border-teal/35 bg-teal/[0.08] px-3 text-sm font-medium text-ink transition-colors hover:bg-teal/15 sm:px-4"><Mic size={17} className="text-teal" /><span className="hidden sm:inline">Voice</span></button>
              <button type="submit" disabled={!canSend} aria-label="Send" className="fs-amber-bg flex h-10 w-10 items-center justify-center rounded-full text-[#1a0e02] shadow-[0_8px_22px_-8px_rgba(255,138,43,.85)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none">
                {disabled && (text.trim() || files.length) ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={19} strokeWidth={2.4} />}
              </button>
            </div>
          </div>
        </form>
      </div>
      {errors.length > 0 && <div role="alert" className="mt-2 space-y-1 rounded-xl border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{errors.map(e => <p key={e}>{e}</p>)}<button type="button" onClick={() => setErrors([])} className="text-xs text-ink-2 underline">Dismiss</button></div>}
      <CameraModal open={camera} onClose={() => setCamera(false)} onUse={a => add([a])} />
    </>
  )
}
