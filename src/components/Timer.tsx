interface Props {
  secondsLeft: number
  total: number
}

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// Barra de cuenta regresiva con tiempo restante.
export function Timer({ secondsLeft, total }: Props) {
  const pct = total > 0 ? Math.max(0, (secondsLeft / total) * 100) : 0
  const low = secondsLeft <= 15
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-bold text-white/70">⏱ Tiempo</span>
        <span
          className={`font-display text-lg font-extrabold tabular-nums ${
            low ? 'animate-pulse text-brand-red' : 'text-white'
          }`}
        >
          {fmt(secondsLeft)}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-linear ${
            low ? 'bg-brand-red' : 'bg-brand-amber'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
