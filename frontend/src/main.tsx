import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { applyTheme, getThemePref } from './utils/theme'

applyTheme(getThemePref())
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (getThemePref() === 'system') applyTheme('system') })

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
