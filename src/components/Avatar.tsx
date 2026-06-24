import { initials } from '../lib/colors'

interface Props {
  nickname: string
  color: string
  size?: number
  ring?: boolean
}

export function Avatar({ nickname, color, size = 44, ring = false }: Props) {
  return (
    <div
      className={`font-display flex shrink-0 items-center justify-center rounded-full font-extrabold text-white ${
        ring ? 'ring-2 ring-white' : ''
      }`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.4,
      }}
    >
      {initials(nickname)}
    </div>
  )
}
