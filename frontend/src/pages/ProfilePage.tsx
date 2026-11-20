import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { PageHeader } from '../components/common/ui'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const { newSession } = useApp()
  const nav = useNavigate()
  if (!user) return null
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8">
      <PageHeader eyebrow="Account" title="Profile" />
      <div className="card card-pad flex items-center gap-5">
        <span className="fs-grad-bg flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl text-3xl font-bold text-[#041416] shadow-[0_18px_40px_-18px_rgba(45,212,191,.9)]" aria-hidden>{user.full_name[0]}</span>
        <div><p className="text-xl font-semibold">{user.full_name}</p><p className="text-sm capitalize text-ink-2">{user.role}{user.organisation_name ? ` · ${user.organisation_name}` : ''}</p><p className="text-sm text-ink-2">{user.email}</p><p className="mt-1 text-sm text-ink-2">Preferred language: {user.preferred_language}</p></div>
      </div>
      <button onClick={async () => { await logout(); newSession(); nav('/login') }} className="btn mt-5"><LogOut size={16} />Sign out</button>
    </div>
  )
}
