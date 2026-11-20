import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AirVent, ArrowRight, BookOpenCheck, Droplets, Fan, Mic, Microwave, PlayCircle, Refrigerator, ShieldCheck, Sparkles, Sun, WashingMachine, Zap } from 'lucide-react'
import { Emblem } from '../components/common/Logo'
import { Composer } from '../components/composer/Composer'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { systemService } from '../services'
import { appliances, suggestions } from '../constants/prompts'

const ICON = { split_ac: AirVent, washing_machine: WashingMachine, refrigerator: Refrigerator, ceiling_fan: Fan, microwave_oven: Microwave, water_purifier: Droplets, mcb_electrical: Zap, rooftop_solar: Sun } as const

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function WelcomePage() {
  const { send, newSession } = useApp()
  const { user } = useAuth()
  const first = user?.full_name.split(' ')[0] ?? ''
  const nav = useNavigate()
  const [appliance, setAppliance] = useState<string | null>(null)
  const kb = useAsync(() => systemService.knowledge(), [])
  const ai = useAsync(() => systemService.ai(), [])
  const go = (text: string, a: Parameters<typeof send>[1] = [], forced?: string) => { newSession(); void send(text, a, forced ?? appliance ?? undefined); nav('/assistant') }
  const fade = (d: number) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: d, duration: 0.45, ease: 'easeOut' as const } })

  return (
    <div className="relative flex min-h-full flex-col items-center px-4 py-8 md:px-8 md:py-12" style={{ background: 'var(--fs-glow)' }}>
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[480px]" aria-hidden />
      <div className="relative flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="relative">
          <div className="absolute inset-0 -z-10 rounded-full bg-teal/25 blur-3xl" aria-hidden />
          <div className="float"><Emblem height={84} /></div>
        </motion.div>

        <motion.div {...fade(0.05)} className="space-y-3">
          <p className="text-sm font-medium text-ink-3">{greeting()}</p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-[52px] md:leading-[1.08]"><span className="fs-grad-text">Hello, {first}.</span></h1>
          <p className="text-lg text-ink md:text-xl">Your AI repair companion is ready.</p>
          <p className="mx-auto max-w-md text-[15px] leading-relaxed text-ink-2">Describe the problem, show me the appliance, and let's solve it together.</p>
        </motion.div>

        <motion.div {...fade(0.12)} className="w-full">
          <p className="section-label mb-3">1 · What are you repairing?</p>
          <div role="radiogroup" aria-label="Appliance" className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {appliances.map(a => { const I = ICON[a.id]; const on = appliance === a.id
              return <button key={a.id} role="radio" aria-checked={on} onClick={() => setAppliance(on ? null : a.id)}
                className={`group flex flex-col items-center gap-2 rounded-2xl border px-1.5 py-3 text-[11.5px] font-medium leading-tight transition-all ${on ? 'border-teal/70 bg-teal/[0.12] text-ink shadow-[0_10px_30px_-16px_rgba(45,212,191,.9)]' : 'border-line bg-surface/50 text-ink-2 hover:-translate-y-0.5 hover:border-line-2 hover:text-ink'}`}>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${on ? 'bg-teal/20 text-teal' : 'bg-surface-2 text-ink-2 group-hover:text-teal'}`}><I size={19} aria-hidden /></span>{a.label}</button> })}
          </div>
        </motion.div>

        <motion.div {...fade(0.18)} className="w-full">
          <p className="section-label mb-3">2 · Describe the problem or show a photo</p>
          <Composer onSend={go} autoFocus />
        </motion.div>

        <motion.div {...fade(0.26)} className="flex flex-wrap justify-center gap-2">
          {suggestions.map(s => <button key={s.label} onClick={() => go(s.prompt, [], s.appliance)} className="chip"><Sparkles size={13} className="text-teal" />{s.label}</button>)}
        </motion.div>

        <motion.div {...fade(0.34)} className="grid w-full gap-3 sm:grid-cols-3">
          <div className="card flex items-center gap-3 px-4 py-3 text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal/12 text-teal"><BookOpenCheck size={18} /></span>
            <span className="min-w-0 text-sm"><span className="block font-semibold">{kb.data ? `${kb.data.total} repair records` : kb.loading ? <span className="skeleton inline-block h-4 w-24 align-middle" /> : 'Repair records'}</span><span className="block text-xs text-ink-3">sourced, searched per appliance</span></span>
          </div>
          <div className="card flex items-center gap-3 px-4 py-3 text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ok/12 text-ok"><ShieldCheck size={18} /></span>
            <span className="text-sm"><span className="block font-semibold">Server safety lock</span><span className="block text-xs text-ink-3">power-off + tester, every job</span></span>
          </div>
          <button onClick={() => nav(ai.data && !ai.data.configured ? '/demo' : '/voice')} className="card card-hover flex items-center gap-3 px-4 py-3 text-left">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ai.data && !ai.data.configured ? 'bg-warn/12 text-warn' : 'bg-amber/12 text-amber'}`}>{ai.data && !ai.data.configured ? <PlayCircle size={18} /> : <Mic size={18} />}</span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="flex items-center gap-1.5 font-semibold">{ai.data ? (ai.data.configured ? <><span className="h-1.5 w-1.5 rounded-full bg-ok" />Gemini online</> : <><span className="h-1.5 w-1.5 rounded-full bg-warn" />AI not configured</>) : 'Gemini'}</span>
              <span className="block text-xs text-ink-3">{ai.data && !ai.data.configured ? 'open a labelled demo' : 'talk hands-free in voice mode'}</span>
            </span>
            <ArrowRight size={15} className="text-ink-3" />
          </button>
        </motion.div>

        <div className="flex gap-3 md:hidden">
          <button onClick={() => nav('/voice')} className="btn btn-primary h-13 rounded-full px-6"><Mic size={19} />Talk to FixSaathi</button>
        </div>
        <button onClick={() => nav('/demo')} className="text-xs text-ink-3 underline-offset-4 transition-colors hover:text-teal hover:underline">AI unavailable? Try a labelled demo scenario</button>
      </div>
      <p className="relative mt-8 pb-2 text-center text-xs text-ink-3">Powered by Google Gemini. AI suggestions are estimates: check before acting.</p>
    </div>
  )
}
