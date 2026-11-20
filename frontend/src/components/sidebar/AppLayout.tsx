import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { History, Home, Menu, MessageSquare, Mic, UserRound } from 'lucide-react'
import { DesktopSidebar, MobileDrawer } from './Sidebar'
import { Emblem, Wordmark } from '../common/Logo'

const tabs = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/assistant', label: 'Chat', icon: MessageSquare },
  { to: '/voice', label: 'Voice', icon: Mic },
  { to: '/history', label: 'History', icon: History },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

export function AppLayout() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  return (
    <div className="flex h-dvh-safe w-full overflow-hidden bg-bg">
      <DesktopSidebar />
      <MobileDrawer open={open} onClose={() => setOpen(false)} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="glass z-10 flex items-center justify-between border-b border-line px-3 py-2.5 md:hidden" style={{ paddingTop: 'max(0.6rem, env(safe-area-inset-top))' }}>
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="icon-btn"><Menu size={21} /></button>
          <div className="flex items-center gap-2"><Emblem height={26} /><Wordmark height={13} /></div>
          <span className="w-10" />
        </header>
        <main className="relative min-h-0 flex-1 overflow-y-auto" style={{ background: 'var(--fs-stage)' }}>
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="min-h-full">
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
        <nav aria-label="Bottom navigation" className="glass grid grid-cols-5 border-t border-line md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {tabs.map(t => { const I = t.icon; return (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${isActive ? 'text-teal' : 'text-ink-3'}`}>
              {({ isActive }) => (<>{isActive && <motion.span layoutId="tab-active" className="absolute top-0 h-0.5 w-8 rounded-full bg-teal" />}<I size={20} />{t.label}</>)}
            </NavLink>) })}
        </nav>
      </div>
    </div>
  )
}
