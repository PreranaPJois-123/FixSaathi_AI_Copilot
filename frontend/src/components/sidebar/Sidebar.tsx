import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, CircleHelp, FileText, History, Home, LayoutDashboard, LogOut, MoreHorizontal, Pencil, PanelLeftClose, PanelLeftOpen, PlayCircle, Plus, Search, Settings, Users, Wrench, X } from 'lucide-react'
import { Emblem, Wordmark } from '../common/Logo'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useAsync } from '../../hooks/useAsync'
import { sessionService } from '../../services'

type Item = { to: string; label: string; icon: typeof Wrench; end?: boolean; manager?: boolean }
const groups: { title: string; items: Item[] }[] = [
  { title: '', items: [{ to: '/', label: 'Home', icon: Home, end: true }] },
]
// Kept reachable, tucked under "More" so the main sidebar stays clean like a chat app.
const more: Item[] = [
  { to: '/history', label: 'Repair History', icon: History },
  { to: '/reports', label: 'Service Reports', icon: FileText },
  { to: '/diagnoses', label: 'Saved Diagnoses', icon: Bookmark },
  { to: '/senior', label: 'Senior Technician Support', icon: Users },
  { to: '/manager', label: 'Manager Dashboard', icon: LayoutDashboard, manager: true },
  { to: '/demo', label: 'Demo Scenarios', icon: PlayCircle },
]
const BUCKETS = ['Today', 'Yesterday', 'Previous 7 days', 'Older'] as const
function bucket(iso?: string): (typeof BUCKETS)[number] {
  if (!iso) return 'Older'
  const d = new Date(iso), n = new Date()
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(n) - day(d)) / 86400000)
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff <= 7 ? 'Previous 7 days' : 'Older'
}

const STATUS_DOT: Record<string, string> = { completed: 'bg-ok', cancelled: 'bg-ink-3', escalated: 'bg-warn', awaiting_confirmation: 'bg-warn' }
function ago(iso?: string) {
  if (!iso) return ''
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`
}

function NavItem({ item, collapsed, onNavigate }: { item: Item; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink to={item.to} end={item.end} onClick={onNavigate} title={collapsed ? item.label : undefined} aria-label={item.label}
      className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition-all ${isActive ? 'bg-surface-2 text-ink shadow-[inset_0_0_0_1px_var(--color-line-2)]' : 'text-ink-2 hover:bg-surface hover:text-ink'} ${collapsed ? 'justify-center' : ''}`}>
      {({ isActive }) => (<>
        {isActive && !collapsed && <motion.span layoutId="nav-active" className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-teal" />}
        <Icon size={18} className={`shrink-0 ${isActive ? 'text-teal' : ''}`} />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {collapsed && <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg border border-line-2 bg-surface-2 px-2.5 py-1 text-xs text-ink shadow-xl group-hover:block group-focus-visible:block">{item.label}</span>}
      </>)}
    </NavLink>
  )
}

function Panel({ collapsed, onNavigate, onClose }: { collapsed: boolean; onNavigate?: () => void; onClose?: () => void }) {
  const { newSession, toggleCollapsed, sessionsVersion } = useApp()
  const { user, logout } = useAuth()
  const [bump, setBump] = useState(0)
  const recent = useAsync(() => sessionService.list(100), [sessionsVersion, bump])
  const isManager = user?.role === 'manager' || user?.role === 'admin'
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [menu, setMenu] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [menu])
  const go = () => { newSession(); nav('/'); onNavigate?.() }
  const signOut = async () => { setMenu(false); try { await logout() } finally { nav('/login', { replace: true }) } }
  const grouped = useMemo(() => {
    const term = q.trim().toLowerCase()
    const items = (recent.data?.items ?? []).filter(s => !term || s.title.toLowerCase().includes(term))
    const out: Record<string, typeof items> = {}
    for (const s of items) (out[bucket(s.completed_at ?? s.started_at)] ??= []).push(s)
    return out
  }, [recent.data, q])
  const total = Object.values(grouped).reduce((n, a) => n + a.length, 0)
  const rename = async (id: string) => {
    const t = draft.trim(); setEditing(null)
    if (!t) return
    try { await sessionService.rename(id, t); setErr(null); setBump(v => v + 1) } catch (e) { setErr((e as Error).message || 'Could not rename this chat.') }
  }
  return (
    <div className="flex h-full flex-col bg-bg-2/95 px-3 py-4">
      <div className={`mb-4 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-1.5`}>
        {collapsed ? <Emblem height={32} /> : <div className="flex items-center gap-2.5"><Emblem height={32} /><div className="leading-tight"><Wordmark height={15} /><p className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-3">AI Repair Copilot</p></div></div>}
        {onClose ? <button aria-label="Close menu" onClick={onClose} className="icon-btn h-9 w-9"><X size={18} /></button> : null}
      </div>
      <button onClick={go} title="New chat" aria-label="New chat" className={`btn btn-brand mb-3 w-full py-2.5 ${collapsed ? 'px-0' : ''}`}>
        <Plus size={18} strokeWidth={2.4} />{!collapsed && 'New chat'}
      </button>
      <div className="space-y-0.5">{groups[0].items.map(i => <NavItem key={i.to} item={i} collapsed={collapsed} onNavigate={onNavigate} />)}</div>
      {!collapsed && (
        <div className="relative mt-3">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search chats" aria-label="Search chats" className="field !rounded-xl !py-2 !pl-8 !pr-3 !text-[13px]" />
        </div>
      )}
      <nav className="-mr-1 mt-3 flex-1 space-y-4 overflow-y-auto pr-1" aria-label="Chat history">
        {!collapsed && (<>
          {recent.loading && !recent.data && <div className="space-y-1.5 px-3">{[0, 1, 2].map(i => <div key={i} className="skeleton h-7" />)}</div>}
          {recent.data && total === 0 && <p className="px-3 py-2 text-xs text-ink-3">{q ? 'No chats match your search.' : 'No chats yet. Start one above.'}</p>}
          {err && <p role="alert" className="px-3 text-xs text-crit">{err}</p>}
          {BUCKETS.filter(k => grouped[k]?.length).map(k => (
            <div key={k}>
              <p className="section-label mb-1 px-3">{k}</p>
              <div className="space-y-0.5">
                {grouped[k].map(s => editing === s.id ? (
                  <input key={s.id} autoFocus value={draft} maxLength={160} aria-label="Rename chat" onChange={e => setDraft(e.target.value)} onBlur={() => void rename(s.id)}
                    onKeyDown={e => { if (e.key === 'Enter') void rename(s.id); if (e.key === 'Escape') setEditing(null) }} className="field !rounded-lg !py-1.5 !text-[13px]" />
                ) : (
                  <div key={s.id} className="group relative">
                    <NavLink to={`/session/${s.id}`} onClick={onNavigate} className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-1.5 pr-9 text-[13px] transition-colors ${isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface hover:text-ink'}`}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[s.status] ?? 'bg-teal'}`} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    </NavLink>
                    <button aria-label={`Rename ${s.title}`} title="Rename" onClick={() => { setEditing(s.id); setDraft(s.title) }} className="icon-btn absolute right-1 top-1/2 !h-7 !w-7 -translate-y-1/2 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"><Pencil size={13} /></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div>
            <button onClick={() => setShowMore(v => !v)} aria-expanded={showMore} className="section-label mb-1 flex w-full items-center gap-1.5 px-3 text-left hover:text-ink"><MoreHorizontal size={14} />More</button>
            {showMore && <div className="space-y-0.5">{more.filter(i => !i.manager || isManager).map(i => <NavItem key={i.to} item={i} collapsed={false} onNavigate={onNavigate} />)}</div>}
          </div>
        </>)}
      </nav>
      <div className="relative mt-3 border-t border-line pt-3" ref={menuRef}>
        {menu && (
          <div role="menu" aria-label="Profile menu" className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-2xl border border-line-2 bg-surface-2 p-2 shadow-2xl">
            <div className="border-b border-line px-3 pb-2 pt-1">
              <p className="truncate text-sm font-medium">{user?.full_name}</p>
              {user?.email && <p className="truncate text-xs text-ink-3">{user.email}</p>}
              <p className="mt-0.5 text-[11px] capitalize text-ink-3">{user?.role === 'technician' || !user?.role ? 'Technician' : user.role}{user?.organisation_name ? ` · ${user.organisation_name}` : ''}</p>
            </div>
            <NavLink role="menuitem" to="/profile" onClick={() => { setMenu(false); onNavigate?.() }} className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface hover:text-ink"><Wrench size={15} />Profile</NavLink>
            <NavLink role="menuitem" to="/settings" onClick={() => { setMenu(false); onNavigate?.() }} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface hover:text-ink"><Settings size={15} />Settings</NavLink>
            <NavLink role="menuitem" to="/help" onClick={() => { setMenu(false); onNavigate?.() }} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface hover:text-ink"><CircleHelp size={15} />Help and Support</NavLink>
            <button role="menuitem" onClick={() => void signOut()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-crit hover:bg-surface"><LogOut size={15} />Sign out</button>
          </div>
        )}
        <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}>
          <button onClick={() => setMenu(v => !v)} aria-haspopup="menu" aria-expanded={menu} aria-label="Open profile menu" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-surface">
            <span className="fs-grad-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-[#041416]">{user?.full_name[0]}</span>
            {!collapsed && <span className="min-w-0 leading-tight"><span className="block truncate text-sm font-medium">{user?.full_name}</span><span className="block truncate text-[11px] capitalize text-ink-3">{user?.role}{user?.organisation_name ? ` · ${user.organisation_name}` : ''}</span></span>}
          </button>
          <NavLink to="/settings" onClick={onNavigate} aria-label="Settings" title="Settings" className="icon-btn h-9 w-9"><Settings size={17} /></NavLink>
          {!onClose && <button onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="icon-btn h-9 w-9">{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>}
        </div>
      </div>
    </div>
  )
}

export function DesktopSidebar() {
  const { collapsed } = useApp()
  return (
    <motion.aside animate={{ width: collapsed ? 76 : 272 }} transition={{ type: 'tween', duration: 0.22 }} className="hidden h-full shrink-0 border-r border-line md:block" aria-label="Sidebar">
      <Panel collapsed={collapsed} />
    </motion.aside>
  )
}

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <motion.div initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={{ type: 'tween', duration: 0.22 }} className="absolute inset-y-0 left-0 w-[85%] max-w-[320px] border-r border-line">
            <Panel collapsed={false} onNavigate={onClose} onClose={onClose} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
