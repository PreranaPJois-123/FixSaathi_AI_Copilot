import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../components/common/ui'
import { dashboardService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'

const tip = { background: '#162133', border: '1px solid #2a3a55', borderRadius: 12, color: '#eef2f8', fontSize: 12, boxShadow: '0 12px 30px -12px rgba(0,0,0,.6)' }
const axis = { stroke: '#75839b', fontSize: 12 }
const pct = (v: number | null) => v === null ? null : `${Math.round(v * 100)}%`

export default function ManagerDashboard() {
  const { user } = useAuth()
  const allowed = user?.role === 'manager' || user?.role === 'admin'
  const { data, loading, error, retry } = useAsync(() => allowed ? dashboardService.load() : Promise.resolve(null), [allowed])
  if (!allowed) return <div className="mx-auto max-w-3xl px-4 py-10"><EmptyState title="Managers only" hint="Ask an admin to give your account the manager role to see team metrics." /></div>
  const o = data?.overview
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader eyebrow="Team" title="Manager workspace" subtitle={`Live data for ${user?.organisation_name ?? 'your organisation'}. Metrics show "not enough data" until records exist.`} />
      {loading && <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>}
      {error && <ErrorState message={error} onRetry={retry} />}
      {data && o && (<>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {([
            ['Total sessions', String(o.total_sessions), null], ['First-time fix', pct(o.first_time_fix_rate), o.first_time_fix_rate !== null ? `${o.first_time_fix_sample} completed with a recorded answer` : null],
            ['Active now', String(o.active), null], ['Escalated', String(o.escalated), `${o.open_escalations} open requests`],
            ['Avg AI reply', o.avg_ai_latency_ms === null ? null : `${(o.avg_ai_latency_ms / 1000).toFixed(1)}s`, null],
            ['Avg rating', o.avg_rating === null ? null : `${o.avg_rating} / 5`, o.ratings_count ? `${o.ratings_count} ratings` : null],
          ] as [string, string | null, string | null][]).map(([k, v, sub]) => (
            <div key={k} className="card px-4 py-4"><dt className="text-xs font-medium text-ink-2">{k}</dt><dd className="mt-2 text-[28px] font-semibold leading-none tabular-nums">{v === null ? <span className="text-base font-normal text-ink-3">Not enough data</span> : <span className="fs-grad-text">{v}</span>}</dd>{sub && <p className="mt-1.5 text-[11px] text-ink-3">{sub}</p>}</div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-3">AI cost per repair: {o.ai_cost_per_repair ?? o.ai_cost_note}</p>
        <section className="card card-pad mt-6" aria-labelledby="trend-h">
          <h2 id="trend-h" className="mb-3 font-semibold">Repair sessions, last 7 days</h2>
          <div className="h-72 w-full" role="img" aria-label="Area chart of sessions and completed sessions per day">
            <ResponsiveContainer>
              <AreaChart data={data.trend} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} /><stop offset="100%" stopColor="#38bdf8" stopOpacity={0} /></linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.35} /><stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="#1d2a3f" vertical={false} /><XAxis dataKey="day" {...axis} tickLine={false} axisLine={false} /><YAxis {...axis} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tip} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#a5b1c5' }} />
                <Area type="monotone" dataKey="sessions" name="Sessions" stroke="#38bdf8" strokeWidth={2} fill="url(#g1)" /><Area type="monotone" dataKey="completed" name="Completed" stroke="#2dd4bf" strokeWidth={2} fill="url(#g2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="card card-pad" aria-labelledby="tech-h">
            <h2 id="tech-h" className="mb-3 font-semibold">Technician activity</h2>
            {data.technicians.length === 0 ? <EmptyState title="No technician activity yet" hint="Sessions from your team appear here." /> :
              <div className="h-64" role="img" aria-label="Bar chart of sessions per technician"><ResponsiveContainer><BarChart data={data.technicians} margin={{ left: -16 }}><CartesianGrid stroke="#1d2a3f" vertical={false} /><XAxis dataKey="name" {...axis} tickLine={false} axisLine={false} /><YAxis {...axis} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip contentStyle={tip} cursor={{ fill: '#162133' }} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#a5b1c5' }} /><Bar dataKey="sessions" name="Sessions" fill="#5b8cff" radius={[6, 6, 0, 0]} /><Bar dataKey="escalated" name="Escalated" fill="#fbbf24" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>}
          </section>
          <section className="card card-pad" aria-labelledby="rate-h">
            <h2 id="rate-h" className="mb-3 font-semibold">Feedback ratings</h2>
            {data.ratings.every(r => r.count === 0) ? <EmptyState title="No ratings yet" hint="Technicians rate the guidance when they finish a session." /> :
              <div className="h-64" role="img" aria-label="Bar chart of rating counts"><ResponsiveContainer><BarChart data={data.ratings} layout="vertical"><XAxis type="number" {...axis} tickLine={false} axisLine={false} allowDecimals={false} /><YAxis type="category" dataKey="stars" {...axis} tickLine={false} axisLine={false} width={28} /><Tooltip contentStyle={tip} cursor={{ fill: '#162133' }} /><Bar dataKey="count" name="Ratings" radius={[0, 6, 6, 0]}>{data.ratings.map((_, i) => <Cell key={i} fill={['#2dd4bf', '#38bdf8', '#5b8cff', '#ff9f43', '#75839b'][i]} />)}</Bar></BarChart></ResponsiveContainer></div>}
          </section>
        </div>
      </>)}
    </div>
  )
}
