import { NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, CircleHelp, FileText, History, Home, LayoutDashboard, MessageSquare, Mic, PanelLeftClose, PanelLeftOpen, PlayCircle, Plus, Settings, Users, Wrench, X } from 'lucide-react'
import { Emblem, Wordmark } from '../common/Logo'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useAsync } from '../../hooks/useAsync'
import { sessionService } from '../../services'

type Item = { to: string; label: string; icon: typeof Wrench; end?: boolean; manager?: boolean }
const groups: { title: string; items: Item[] }[] = [
  { title: 'Workspace', items: [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/assistant', label: 'AI Assistant', icon: MessageSquare },
    { to: '/voice', label: 'Voice mode', icon: Mic },
    { to: '/history', label: 'Repair History', icon: History },
    { to: '/reports', label: 'Service Reports', icon: FileText },
    { to: '/diagnoses', label: 'Saved Diagnoses', icon: Bookmark },
  ] },
  { title: 'Team', items: [
    { to: '/senior', label: 'Senior Technician Support', icon: Users },
    { to: '/manager', label: 'Manager Dashboard', icon: LayoutDashboard, manager: true },
    { to: '/demo', label: 'Demo Scenarios', icon: PlayCircle },
  ] },
]

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
  const { user } = useAuth()
  const recent = useAsync(() => sessionService.list(6), [sessionsVersion])
  const isManager = user?.role === 'manager' || user?.role === 'admin'
  const nav = useNavigate()
  const go = () => { newSession(); nav('/'); onNavigate?.() }
  return (
    <div className="flex h-full flex-col bg-bg-2/95 px-3 py-4">
      <div className={`mb-5 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-1.5`}>
        {collapsed ? <Emblem height={32} /> : <div className="flex items-center gap-2.5"><Emblem height={32} /><div className="leading-tight"><Wordmark height={15} /><p className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-3">AI Repair Copilot</p></div></div>}
        {onClose ? <button aria-label="Close menu" onClick={onClose} className="icon-btn h-9 w-9"><X size={18} /></button> : null}
      </div>
      <button onClick={go} title="New session" aria-label="New session" className={`btn btn-brand mb-5 w-full py-2.5 ${collapsed ? 'px-0' : ''}`}>
        <Plus size={18} strokeWidth={2.4} />{!collapsed && 'New repair session'}
      </button>
      <nav className="-mr-1 flex-1 space-y-5 overflow-y-auto pr-1" aria-label="Primary">
        {groups.map(g => (
          <div key={g.title}>
            {!collapsed && <p className="section-label mb-1.5 px-3">{g.title}</p>}
            <div className="space-y-0.5">{g.items.filter(i => !i.manager || isManager).map(i => <NavItem key={i.to} item={i} collapsed={collapsed} onNavigate={onNavigate} />)}</div>
          </div>
        ))}
        {!collapsed && (
          <div>
            <p className="section-label mb-1.5 px-3">Recent sessions</p>
            {recent.loading && !recent.data && <div className="space-y-1.5 px-3">{[0, 1, 2].map(i => <div key={i} className="skeleton h-7" />)}</div>}
            {recent.data && recent.data.items.length === 0 && <p className="px-3 py-2 text-xs text-ink-3">No sessions yet. Start one above.</p>}
            <div className="space-y-0.5">
              {(recent.data?.items ?? []).map(s => (
                <NavLink key={s.id} to={`/session/${s.id}`} onClick={onNavigate} className={({ isActive }) => `group flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface hover:text-ink'}`}>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[s.status] ?? 'bg-teal'}`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  <span className="shrink-0 text-[10.5px] text-ink-3">{ago(s.completed_at ?? s.started_at)}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>
      <div className={`mt-3 border-t border-line pt-3 ${collapsed ? 'space-y-1' : ''}`}>
        {!collapsed && <NavLink to="/help" onClick={onNavigate} className={({ isActive }) => `mb-2 flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] ${isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface hover:text-ink'}`}><CircleHelp size={17} />Help and Support</NavLink>}
        <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}>
          <NavLink to="/profile" onClick={onNavigate} aria-label="Open profile" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-surface">
            <span className="fs-grad-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-[#041416]">{user?.full_name[0]}</span>
            {!collapsed && <span className="min-w-0 leading-tight"><span className="block truncate text-sm font-medium">{user?.full_name}</span><span className="block truncate text-[11px] capitalize text-ink-3">{user?.role}{user?.organisation_name ? ` · ${user.organisation_name}` : ''}</span></span>}
          </NavLink>
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
