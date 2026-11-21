export type ThemePref = 'dark' | 'light' | 'system'
const KEY = 'fs_theme'
export const getThemePref = (): ThemePref => {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark' } catch { return 'dark' }
}
export function applyTheme(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && !window.matchMedia('(prefers-color-scheme: light)').matches)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}
export function setThemePref(pref: ThemePref) {
  try { localStorage.setItem(KEY, pref) } catch { /* private mode: still applies for this visit */ }
  applyTheme(pref)
}
