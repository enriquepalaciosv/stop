interface Props {
  enabled: boolean
  loading?: boolean
  onClick: () => void
}

// Botón STOP estilo señal de alto. Solo habilitado si todas las palabras son válidas.
export function StopButton({ enabled, loading, onClick }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        disabled={!enabled || loading}
        className={`font-display flex h-28 w-28 items-center justify-center rounded-2xl text-3xl font-black
          tracking-widest text-white transition-all duration-150
          ${
            enabled && !loading
              ? 'animate-pop bg-brand-red shadow-[0_6px_0_#7f1d1d] active:translate-y-1 active:shadow-[0_2px_0_#7f1d1d]'
              : 'cursor-not-allowed bg-white/15 text-white/40'
          }`}
        style={{
          clipPath:
            'polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)',
        }}
      >
        {loading ? '…' : 'STOP'}
      </button>
      {!enabled && (
        <span className="text-center text-xs font-semibold text-white/60">
          Completa todas las palabras válidas para detener
        </span>
      )}
    </div>
  )
}
