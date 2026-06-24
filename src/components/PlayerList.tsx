import { motion } from 'framer-motion'
import type { Player } from '../lib/types'
import { Avatar } from './Avatar'

interface Props {
  players: Player[]
  meUid?: string | null
  showScore?: boolean
}

export function PlayerList({ players, meUid, showScore = false }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {players.map((p) => (
        <motion.div
          key={p.id}
          layout
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-3 ring-1 ring-white/10"
        >
          <Avatar nickname={p.nickname} color={p.color} ring={p.id === meUid} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold leading-tight">
              {p.nickname}
              {p.id === meUid && <span className="text-white/60"> (tú)</span>}
            </div>
            {showScore && (
              <div className="font-display text-sm font-extrabold text-brand-amber">
                {p.totalScore} pts
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
