import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-pink text-white shadow-[0_5px_0_#9d174d] active:shadow-[0_2px_0_#9d174d]',
  secondary: 'bg-brand-blue text-white shadow-[0_5px_0_#1e40af] active:shadow-[0_2px_0_#1e40af]',
  success: 'bg-brand-green text-white shadow-[0_5px_0_#15803d] active:shadow-[0_2px_0_#15803d]',
  danger: 'bg-brand-red text-white shadow-[0_5px_0_#991b1b] active:shadow-[0_2px_0_#991b1b]',
  ghost: 'bg-white/10 text-white ring-1 ring-white/25',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
  full?: boolean
}

export function Button({
  variant = 'primary',
  full = true,
  children,
  className = '',
  disabled,
  ...rest
}: Props) {
  return (
    <button
      className={`font-display select-none rounded-2xl px-6 py-4 text-xl font-extrabold
        tracking-wide transition-all duration-100 active:translate-y-1
        disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none
        ${VARIANTS[variant]} ${full ? 'w-full' : ''} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  )
}
