import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { PageHeader } from '../components/common/ui'
import { useAuth } from '../context/AuthContext'
import type { Language } from '../types'
import { getThemePref, setThemePref, type ThemePref } from '../utils/theme'

const langs: Language[] = ['English', 'Hindi', 'Kannada', 'Tamil']

export default function SettingsPage() {
  const { user, setLanguage } = useAuth()
  const [theme, setTheme] = useState<ThemePref>(getThemePref())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const pick = async (l: Language) => { setBusy(true); setErr(null); try { await setLanguage(l) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } }
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8">
      <PageHeader eyebrow="Account" title="Settings" />
      <section aria-labelledby="lang-h" className="card card-pad">
        <h2 id="lang-h" className="mb-1 flex items-center gap-2 font-semibold">Preferred language{busy && <Loader2 size={14} className="animate-spin" />}</h2>
        <p className="mb-3 text-sm text-ink-2">Saved to your account. FixSaathi's AI replies and live voice use this language. The app's menus stay in English for now.</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Preferred language">
          {langs.map(l => <button key={l} role="radio" aria-checked={user?.preferred_language === l} disabled={busy} onClick={() => void pick(l)} className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${user?.preferred_language === l ? 'border-teal/70 bg-teal/12 text-ink' : 'border-line-2 text-ink-2 hover:bg-surface-2 hover:text-ink'}`}>{l}</button>)}
        </div>
        {err && <p role="alert" className="mt-2 text-sm text-crit">{err}</p>}
      </section>
      <section aria-labelledby="theme-h" className="card card-pad mt-4">
        <h2 id="theme-h" className="mb-1 font-semibold">Appearance</h2>
        <p className="mb-3 text-sm text-ink-2">Applies instantly and is remembered on this device.</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Theme">
          {(['dark', 'light', 'system'] as ThemePref[]).map(t => <button key={t} role="radio" aria-checked={theme === t} onClick={() => { setTheme(t); setThemePref(t) }} className={`rounded-xl border px-4 py-2 text-sm font-medium capitalize transition-colors ${theme === t ? 'border-teal/70 bg-teal/12 text-ink' : 'border-line-2 text-ink-2 hover:bg-surface-2 hover:text-ink'}`}>{t === 'system' ? 'System default' : t}</button>)}
        </div>
      </section>
    </div>
  )
}
