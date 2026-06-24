import { motion } from 'framer-motion'
import type { Player } from '../lib/types'
import { Avatar } from './Avatar'

interface Props {
  players: Player[] // ya ordenados de mayor a menor puntaje
  meUid?: string | null
}

const PODIUM = [
  { place: 2, height: 'h-24', color: '#94a3b8', medal: '🥈' },
  { place: 1, height: 'h-32', color: '#f59e0b', medal: '🥇' },
  { place: 3, height: 'h-16', color: '#b45309', medal: '🥉' },
]

export function Podium({ players, meUid }: Props) {
  const top3 = PODIUM.map((slot) => ({ ...slot, player: players[slot.place - 1] }))

  return (
    <div className="flex items-end justify-center gap-2">
      {top3.map(
        ({ place, height, color, medal, player }) =>
          player && (
            <motion.div
              key={place}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: place * 0.15 }}
              className="flex flex-1 flex-col items-center"
            >
              <div className="mb-2 text-3xl">{medal}</div>
              <Avatar
                nickname={player.nickname}
                color={player.color}
                size={48}
                ring={player.id === meUid}
              />
              <div className="mt-1 max-w-full truncate px-1 text-center text-sm font-bold">
                {player.nickname}
              </div>
              <div className="font-display text-brand-amber text-lg font-extrabold">
                {player.totalScore}
              </div>
              <div
                className={`mt-1 flex w-full items-start justify-center rounded-t-xl ${height} font-display pt-2 text-2xl font-black text-white/90`}
                style={{ backgroundColor: color }}
              >
                {place}
              </div>
            </motion.div>
          ),
      )}
    </div>
  )
}
