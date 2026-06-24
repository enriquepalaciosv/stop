import { useState } from 'react'
import { Button } from '../components/Button'
import { api } from '../lib/api'

interface Props {
  initialNick: string
  onBack: () => void
  onCreated: (gameId: string, nickname: string) => void
}

export function Create({ initialNick, onBack, onCreated }: Props) {
  const [nickname, setNickname] = useState(initialNick)
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const nick = nickname.trim()
    if (!nick) {
      setError('Escribe tu apodo')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { gameId } = await api.createGame(nick, secret.trim() || undefined)
      onCreated(gameId, nick)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear el juego')
      setLoading(false)
    }
  }

  return (
    <div className="screen gap-6">
      <button onClick={onBack} className="self-start font-bold text-white/70">
        ← Atrás
      </button>

      <h1 className="font-display text-4xl font-extrabold">Crear juego</h1>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block font-bold text-white/80">Tu apodo</span>
          <input
            className="input"
            value={nickname}
            maxLength={24}
            placeholder="Ej. Pelusa"
            onChange={(e) => setNickname(e.target.value)}
            autoFocus
          />
        </label>

        <label className="block">
          <span className="mb-1 block font-bold text-white/80">
            Clave secreta <span className="font-normal text-white/50">(opcional)</span>
          </span>
          <input
            className="input"
            value={secret}
            maxLength={40}
            placeholder="Para hacerlo privado"
            onChange={(e) => setSecret(e.target.value)}
          />
          <span className="mt-1 block text-sm text-white/50">
            Si la dejas vacía, cualquiera con el código podrá unirse.
          </span>
        </label>

        {error && <p className="font-semibold text-brand-amber">{error}</p>}
      </div>

      <div className="mt-auto pt-4">
        <Button variant="success" onClick={submit} disabled={loading}>
          {loading ? 'Creando…' : 'Crear juego'}
        </Button>
      </div>
    </div>
  )
}
