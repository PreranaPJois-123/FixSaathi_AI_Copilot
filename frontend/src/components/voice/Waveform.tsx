import type { VoiceState } from '../../types'

const BARS = 28
export function Waveform({ state }: { state: VoiceState }) {
  const active = state === 'listening' || state === 'responding'
  const processing = state === 'processing'
  return (
    <div className="flex h-24 items-center justify-center gap-[5px]" aria-hidden>
      {Array.from({ length: BARS }).map((_, i) => {
        const mid = 1 - Math.abs(i - BARS / 2) / (BARS / 2)
        return <span key={i} className={`w-[5px] rounded-full ${state === 'error' ? 'bg-crit/60' : 'fs-grad-bg'}`}
          style={{ height: `${18 + mid * 62}%`, transformOrigin: 'center', transform: active || processing ? undefined : 'scaleY(.18)', opacity: active ? 1 : processing ? 0.7 : 0.45,
            animation: active ? `fs-wave ${0.7 + (i % 5) * 0.12}s ease-in-out ${i * 0.03}s infinite` : processing ? `fs-wave 1.6s ease-in-out ${i * 0.06}s infinite` : undefined }} />
      })}
    </div>
  )
}
