import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Trash2, Bookmark, CircleHelp, FileText, History, Home, LayoutDashboard, LogOut, MoreHorizontal, Pencil, PanelLeftClose, PanelLeftOpen, PlayCircle, Plus, Search, Settings, Users, Wrench, X } from 'lucide-react'
import { Emblem, Wordmark } from '../common/Logo'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useAsync } from '../../hooks/useAsync'
import { sessionService } from '../../services'
import { useT, type Key } from '../../i18n'

type Item = { to: string; label: string; k: Key; icon: typeof Wrench; end?: boolean; manager?: boolean }
const groups: { title: string; items: Item[] }[] = [
  { title: '', items: [{ to: '/', label: 'Home', k: 'home', icon: Home, end: true }] },
]
// Kept reachable, tucked under "More" so the main sidebar stays clean like a chat app.
const more: Item[] = [
  { to: '/history', label: 'Repair History', k: 'history', icon: History },
  { to: '/reports', label: 'Service Reports', k: 'reports', icon: FileText },
  { to: '/diagnoses', label: 'Saved Diagnoses', k: 'diagnoses', icon: Bookmark },
  { to: '/senior', label: 'Senior Technician Support', k: 'senior', icon: Users },
  { to: '/manager', label: 'Manager Dashboard', k: 'manager', icon: LayoutDashboard, manager: true },
  { to: '/demo', label: 'Demo Scenarios', k: 'demo', icon: PlayCircle },
]
const BUCKETS = ['Today', 'Yesterday', 'Previous 7 days', 'Older'] as const
const BUCKET_KEY: Record<(typeof BUCKETS)[number], Key> = { Today: 'today', Yesterday: 'yesterday', 'Previous 7 days': 'prev7', Older: 'older' }
function bucket(iso?: string): (typeof BUCKETS)[number] {
  if (!iso) return 'Older'
  const d = new Date(iso), n = new Date()
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(n) - day(d)) / 86400000)
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff <= 7 ? 'Previous 7 days' : 'Older'
}

const STATUS_DOT: Record<string, string> = { completed: 'bg-ok', cancelled: 'bg-ink-3', escalated: 'bg-warn', awaiting_confirmation: 'bg-warn' }

function NavItem({ item, collapsed, onNavigate }: { item: Item; collapsed: boolean; onNavigate?: () => void }) {
  const t = useT()
  const label = t(item.k)
  const Icon = item.icon
  return (
    <NavLink to={item.to} end={item.end} onClick={onNavigate} title={collapsed ? label : undefined} aria-label={label}
      className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition-all ${isActive ? 'bg-surface-2 text-ink shadow-[inset_0_0_0_1px_var(--color-line-2)]' : 'text-ink-2 hover:bg-surface hover:text-ink'} ${collapsed ? 'justify-center' : ''}`}>
      {({ isActive }) => (<>
        {isActive && !collapsed && <motion.span layoutId="nav-active" className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-teal" />}
        <Icon size={18} className={`shrink-0 ${isActive ? 'text-teal' : ''}`} />
        {!collapsed && <span className="truncate">{label}</span>}
        {collapsed && <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg border border-line-2 bg-surface-2 px-2.5 py-1 text-xs text-ink shadow-xl group-hover:block group-focus-visible:block">{label}</span>}
      </>)}
    </NavLink>
  )
}

function Panel({ collapsed, onNavigate, onClose }: { collapsed: boolean; onNavigate?: () => void; onClose?: () => void }) {
  const { newSession, toggleCollapsed, sessionsVersion } = useApp()
  const { user, logout } = useAuth()
  const t = useT()
  const [confirmDel, setConfirmDel] = useState<{ id: string; title: string } | null>(null)
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
    const title = draft.trim(); setEditing(null)
    if (!title) return
    try { await sessionService.rename(id, title); setErr(null); setBump(v => v + 1) } catch (e) { setErr((e as Error).message || t('renameFailed')) }
  }
  const remove = async () => {
    const d = confirmDel; if (!d) return
    setConfirmDel(null)
    try { await sessionService.remove(d.id); setErr(null); setBump(v => v + 1); if (window.location.pathname.endsWith(d.id)) nav('/') } catch (e) { setErr((e as Error).message || t('deleteFailed')) }
  }
  return (
    <div className="flex h-full flex-col bg-bg-2/95 px-3 py-4">
      <div className={`mb-4 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-1.5`}>
        {collapsed ? <Emblem height={32} /> : <div className="flex items-center gap-2.5"><Emblem height={32} /><div className="leading-tight"><Wordmark height={15} /><p className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-3">AI Repair Copilot</p></div></div>}
        {onClose ? <button aria-label="Close menu" onClick={onClose} className="icon-btn h-9 w-9"><X size={18} /></button> : null}
      </div>
      <button onClick={go} title={t('newChat')} aria-label={t('newChat')} className={`btn btn-brand mb-3 w-full py-2.5 ${collapsed ? 'px-0' : ''}`}>
        <Plus size={18} strokeWidth={2.4} />{!collapsed && t('newChat')}
      </button>
      <div className="space-y-0.5">{groups[0].items.map(i => <NavItem key={i.to} item={i} collapsed={collapsed} onNavigate={onNavigate} />)}</div>
      {!collapsed && (
        <div className="relative mt-3">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchChats')} aria-label={t('searchChats')} className="field !rounded-xl !py-2 !pl-8 !pr-3 !text-[13px]" />
        </div>
      )}
      <nav className="-mr-1 mt-3 flex-1 space-y-4 overflow-y-auto pr-1" aria-label="Chat history">
        {!collapsed && (<>
          {recent.loading && !recent.data && <div className="space-y-1.5 px-3">{[0, 1, 2].map(i => <div key={i} className="skeleton h-7" />)}</div>}
          {recent.data && total === 0 && <p className="px-3 py-2 text-xs text-ink-3">{q ? t('noMatch') : t('noChats')}</p>}
          {err && <p role="alert" className="px-3 text-xs text-crit">{err}</p>}
          {BUCKETS.filter(k => grouped[k]?.length).map(k => (
            <div key={k}>
              <p className="section-label mb-1 px-3">{t(BUCKET_KEY[k])}</p>
              <div className="space-y-0.5">
                {grouped[k].map(s => editing === s.id ? (
                  <input key={s.id} autoFocus value={draft} maxLength={160} aria-label="Rename chat" onChange={e => setDraft(e.target.value)} onBlur={() => void rename(s.id)}
                    onKeyDown={e => { if (e.key === 'Enter') void rename(s.id); if (e.key === 'Escape') setEditing(null) }} className="field !rounded-lg !py-1.5 !text-[13px]" />
                ) : (
                  <div key={s.id} className="group relative">
                    <NavLink to={`/session/${s.id}`} onClick={onNavigate} className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-1.5 pr-16 text-[13px] transition-colors ${isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface hover:text-ink'}`}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[s.status] ?? 'bg-teal'}`} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    </NavLink>
                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                      <button aria-label={`${t('rename')} ${s.title}`} title={t('rename')} onClick={() => { setEditing(s.id); setDraft(s.title) }} className="icon-btn !h-7 !w-7"><Pencil size={13} /></button>
                      <button aria-label={`${t('delete')} ${s.title}`} title={t('delete')} onClick={() => setConfirmDel({ id: s.id, title: s.title })} className="icon-btn !h-7 !w-7 hover:!text-crit"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div>
            <button onClick={() => setShowMore(v => !v)} aria-expanded={showMore} className="section-label mb-1 flex w-full items-center gap-1.5 px-3 text-left hover:text-ink"><MoreHorizontal size={14} />{t('more')}</button>
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
            <NavLink role="menuitem" to="/profile" onClick={() => { setMenu(false); onNavigate?.() }} className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface hover:text-ink"><Wrench size={15} />{t('profile')}</NavLink>
            <NavLink role="menuitem" to="/settings" onClick={() => { setMenu(false); onNavigate?.() }} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface hover:text-ink"><Settings size={15} />{t('settings')}</NavLink>
            <NavLink role="menuitem" to="/help" onClick={() => { setMenu(false); onNavigate?.() }} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface hover:text-ink"><CircleHelp size={15} />{t('help')}</NavLink>
            <button role="menuitem" onClick={() => void signOut()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-crit hover:bg-surface"><LogOut size={15} />{t('signOut')}</button>
          </div>
        )}
        <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}>
          <button onClick={() => setMenu(v => !v)} aria-haspopup="menu" aria-expanded={menu} aria-label={t('openProfileMenu')} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-surface">
            <span className="fs-grad-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-[#041416]">{user?.full_name[0]}</span>
            {!collapsed && <span className="min-w-0 leading-tight"><span className="block truncate text-sm font-medium">{user?.full_name}</span><span className="block truncate text-[11px] capitalize text-ink-3">{user?.role}{user?.organisation_name ? ` · ${user.organisation_name}` : ''}</span></span>}
          </button>
          <NavLink to="/settings" onClick={onNavigate} aria-label={t('settings')} title={t('settings')} className="icon-btn h-9 w-9"><Settings size={17} /></NavLink>
          {!onClose && <button onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="icon-btn h-9 w-9">{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>}
        </div>
      </div>
      {confirmDel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4" role="alertdialog" aria-modal="true" aria-labelledby="del-h" onKeyDown={e => { if (e.key === 'Escape') setConfirmDel(null) }}>
          <div className="card card-pad w-full max-w-sm">
            <h2 id="del-h" className="font-semibold">{t('deleteTitle')}</h2>
            <p className="mt-1 truncate text-sm text-ink-3">{confirmDel.title}</p>
            <p className="mt-2 text-sm text-ink-2">{t('deleteBody')}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button autoFocus onClick={() => setConfirmDel(null)} className="btn">{t('cancel')}</button>
              <button onClick={() => void remove()} className="btn !bg-crit !text-white">{t('deleteChat')}</button>
            </div>
          </div>
        </div>
      )}
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
