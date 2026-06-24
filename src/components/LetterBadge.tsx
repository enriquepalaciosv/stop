interface Props {
  letter: string
  size?: number
}

// Círculo grande con la letra actual.
export function LetterBadge({ letter, size = 96 }: Props) {
  return (
    <div
      className="font-display flex items-center justify-center rounded-full bg-white font-extrabold text-brand-deep shadow-lg"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {letter}
    </div>
  )
}
