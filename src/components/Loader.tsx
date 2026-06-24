interface Props {
  label?: string
}

export function Loader({ label = 'Cargando…' }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <span className="h-12 w-12 animate-spin rounded-full border-4 border-white/25 border-t-white" />
      <span className="font-display text-lg font-bold text-white/80">{label}</span>
    </div>
  )
}
