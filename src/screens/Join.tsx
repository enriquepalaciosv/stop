import { useState } from 'react'
import { Button } from '../components/Button'
import { api } from '../lib/api'
import { SHOW_SECRET_FIELD } from '../lib/constants'

interface Props {
  initialNick: string
  onBack: () => void
  onJoined: (gameId: string, nickname: string) => void
}

export function Join({ initialNick, onBack, onJoined }: Props) {
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState(initialNick)
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const c = code.trim().toUpperCase()
    const nick = nickname.trim()
    if (!c) return setError('Escribe el código del juego')
    if (!nick) return setError('Escribe tu apodo')
    setLoading(true)
    setError(null)
    try {
      const { gameId } = await api.joinGame(c, nick, secret.trim() || undefined)
      onJoined(gameId, nick)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al unirse')
      setLoading(false)
    }
  }

  return (
    <div className="screen gap-6">
      <button onClick={onBack} className="self-start font-bold text-white/70">
        ← Atrás
      </button>

      <h1 className="font-display text-4xl font-extrabold">Unirse</h1>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block font-bold text-white/80">Código del juego</span>
          <input
            className="input text-center text-3xl uppercase tracking-[0.3em]"
            value={code}
            maxLength={8}
            placeholder="ABCD"
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoFocus
          />
        </label>

        <label className="block">
          <span className="mb-1 block font-bold text-white/80">Tu apodo</span>
          <input
            className="input"
            value={nickname}
            maxLength={24}
            placeholder="Ej. Pelusa"
            onChange={(e) => setNickname(e.target.value)}
          />
        </label>

        {SHOW_SECRET_FIELD && (
          <label className="block">
            <span className="mb-1 block font-bold text-white/80">
              Clave secreta <span className="font-normal text-white/50">(si la tiene)</span>
            </span>
            <input
              className="input"
              value={secret}
              maxLength={40}
              placeholder="Déjala vacía si es público"
              onChange={(e) => setSecret(e.target.value)}
            />
          </label>
        )}

        {error && <p className="font-semibold text-brand-amber">{error}</p>}
      </div>

      <div className="mt-auto pt-4">
        <Button variant="secondary" onClick={submit} disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar al juego'}
        </Button>
      </div>
    </div>
  )
}
