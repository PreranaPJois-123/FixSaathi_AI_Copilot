import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppProvider } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppLayout } from './components/sidebar/AppLayout'
import WelcomePage from './pages/WelcomePage'
import LoginPage from './pages/LoginPage'
import AssistantPage from './pages/AssistantPage'

// Heavy pages load on demand, so the first screen is fast. They are prefetched in the background once the app is idle.
const load = {
  voice: () => import('./pages/VoicePage'), session: () => import('./pages/RepairSessionPage'), history: () => import('./pages/RepairHistoryPage'),
  reports: () => import('./pages/ReportsPage'), settings: () => import('./pages/SettingsPage'), profile: () => import('./pages/ProfilePage'),
  info: () => import('./pages/InfoPages'), demo: () => import('./pages/DemoPage'),
}
const VoicePage = lazy(load.voice)
const RepairSessionPage = lazy(load.session)
const RepairHistoryPage = lazy(load.history)
const ReportsList = lazy(() => load.reports().then(m => ({ default: m.ReportsList })))
const ReportDetailPage = lazy(() => load.reports().then(m => ({ default: m.ReportDetailPage })))
const SettingsPage = lazy(load.settings)
const DemoPage = lazy(load.demo)
const ProfilePage = lazy(load.profile)
const SavedDiagnoses = lazy(() => load.info().then(m => ({ default: m.SavedDiagnoses })))
const SeniorSupport = lazy(() => load.info().then(m => ({ default: m.SeniorSupport })))
const HelpPage = lazy(() => load.info().then(m => ({ default: m.HelpPage })))
const NotFound = lazy(() => load.info().then(m => ({ default: m.NotFound })))
if (typeof window !== 'undefined') {
  const pre = () => Object.values(load).forEach(f => void f().catch(() => undefined))
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => void }
  if (w.requestIdleCallback) w.requestIdleCallback(pre); else setTimeout(pre, 1500)
}
const PageFallback = () => <div className="flex h-full items-center justify-center p-10 text-ink-3"><Loader2 className="animate-spin text-teal" /></div>
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'))

function Protected({ children }: { children: ReactNode }) {
  const { user, loading, waking } = useAuth()
  const loc = useLocation()
  if (loading) return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center text-ink-2" role="status" aria-live="polite">
      <Loader2 className="animate-spin text-teal" />
      {waking && <><p className="font-medium text-ink">Waking up the server...</p><p className="max-w-xs text-sm">The free server sleeps when idle and takes up to a minute to start. You stay signed in.</p></>}
    </div>
  )
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route element={<Protected><AppLayout /></Protected>}>
              <Route index element={<WelcomePage />} />
              <Route path="assistant" element={<AssistantPage />} />
              <Route path="voice" element={<VoicePage />} />
              <Route path="session/:id" element={<RepairSessionPage />} />
              <Route path="history" element={<RepairHistoryPage />} />
              <Route path="repairs" element={<RepairHistoryPage mine />} />
              <Route path="reports" element={<ReportsList />} />
              <Route path="reports/:id" element={<ReportDetailPage />} />
              <Route path="diagnoses" element={<SavedDiagnoses />} />
              <Route path="senior" element={<SeniorSupport />} />
              <Route path="demo" element={<DemoPage />} />
              <Route path="manager" element={<ManagerDashboard />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="help" element={<HelpPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  )
}
