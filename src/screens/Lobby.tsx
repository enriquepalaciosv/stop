import { useState } from 'react'
import { Button } from '../components/Button'
import { PlayerList } from '../components/PlayerList'
import { api } from '../lib/api'
import type { GameDoc, Player } from '../lib/types'

interface Props {
  gameId: string
  game: GameDoc
  players: Player[]
  meUid: string | null
  onLeave: () => void
}

export function Lobby({ gameId, game, players, meUid, onLeave }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function start() {
    setLoading(true)
    setError(null)
    try {
      await api.startRound(gameId)
      // El cambio de status lo refleja la suscripción en tiempo real.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar')
      setLoading(false)
    }
  }

  async function share() {
    const url = `${location.origin}/?game=${gameId}`
    const text = `¡Únete a mi juego de STOP! 🛑\nEntra aquí: ${url}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'STOP', text, url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    } catch {
      /* el usuario canceló o falló el portapapeles */
    }
  }

  return (
    <div className="screen gap-6">
      <div className="flex items-center justify-between">
        <button onClick={onLeave} className="font-bold text-white/70">
          ← Salir
        </button>
        {game.hasSecret && <span className="text-sm font-semibold text-white/60">🔒 Privado</span>}
      </div>

      <div className="card text-center">
        <p className="font-bold text-white/70">Código del juego</p>
        <button
          onClick={share}
          className="font-display mt-1 text-6xl font-extrabold tracking-[0.2em] text-white"
        >
          {gameId}
        </button>
        <p className="mt-2 text-sm font-semibold text-brand-amber">
          {copied ? '¡Enlace copiado!' : 'Toca el código para compartir el enlace'}
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-2xl font-extrabold">Jugadores</h2>
          <span className="font-bold text-white/60">{players.length}</span>
        </div>
        <PlayerList players={players} meUid={meUid} />
      </div>

      {error && <p className="font-semibold text-brand-amber">{error}</p>}

      <div className="mt-auto pt-4">
        <Button variant="success" onClick={start} disabled={loading}>
          {loading ? 'Iniciando…' : '🚀 Iniciar juego'}
        </Button>
        <p className="mt-2 text-center text-sm text-white/50">
          Cualquier jugador puede iniciar la partida.
        </p>
      </div>
    </div>
  )
}
