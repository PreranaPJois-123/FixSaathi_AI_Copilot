import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { applyTheme, getThemePref } from './utils/theme'
import { apiBase } from './services/api'

applyTheme(getThemePref())
// Wake the free-tier API as soon as the page opens, so it is warm by the time the person taps anything.
void fetch(`${apiBase}/health`, { mode: 'no-cors', cache: 'no-store' }).catch(() => undefined)
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (getThemePref() === 'system') applyTheme('system') })

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
