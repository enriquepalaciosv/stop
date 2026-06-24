import type { AnswerStatus } from '../lib/types'

interface Props {
  status: AnswerStatus
}

// Indicador visual del estado de validación de una palabra.
export function ValidationBadge({ status }: Props) {
  if (status === 'validating') {
    return (
      <span
        className="inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-white/30 border-t-white"
        aria-label="Validando"
      />
    )
  }
  if (status === 'valid') {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-green text-sm font-black text-white">
        ✓
      </span>
    )
  }
  if (status === 'invalid') {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-red text-sm font-black text-white">
        ✕
      </span>
    )
  }
  return null
}
