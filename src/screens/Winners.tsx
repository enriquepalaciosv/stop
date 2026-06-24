import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { Button } from '../components/Button'
import { Avatar } from '../components/Avatar'
import { Podium } from '../components/Podium'
import type { Player } from '../lib/types'

interface Props {
  players: Player[]
  uid: string | null
  onExit: () => void
}

export function Winners({ players, uid, onExit }: Props) {
  const standings = [...players].sort((a, b) => b.totalScore - a.totalScore)
  const rest = standings.slice(3)

  useEffect(() => {
    const end = Date.now() + 1500
    const tick = () => {
      confetti({ particleCount: 4, spread: 70, origin: { y: 0.3 } })
      if (Date.now() < end) requestAnimationFrame(tick)
    }
    tick()
  }, [])

  return (
    <div className="screen gap-6">
      <h1 className="font-display mt-2 text-center text-4xl font-extrabold">🏆 ¡Resultados!</h1>

      <Podium players={standings} meUid={uid} />

      {rest.length > 0 && (
        <div className="card space-y-2">
          {rest.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3">
              <span className="w-6 font-bold text-white/50">{i + 4}</span>
              <Avatar nickname={p.nickname} color={p.color} size={32} ring={p.id === uid} />
              <span className="flex-1 truncate font-bold">{p.nickname}</span>
              <span className="font-display font-extrabold text-brand-amber">{p.totalScore}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto pt-4">
        <Button onClick={onExit}>🏠 Volver al inicio</Button>
      </div>
    </div>
  )
}
