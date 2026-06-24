import { useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { Avatar } from '../components/Avatar'
import { useAllAnswers } from '../hooks/useAnswers'
import { LETTERS } from '../lib/constants'
import { api } from '../lib/api'
import type { AnswerDoc, GameDoc, Player } from '../lib/types'

interface Props {
  gameId: string
  game: GameDoc
  players: Player[]
  uid: string | null
}

export function Review({ gameId, game, players, uid }: Props) {
  const answers = useAllAnswers(gameId, game.roundIndex, true)
  const [loading, setLoading] = useState<'next' | 'finish' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const byUid = useMemo(() => {
    const m: Record<string, AnswerDoc> = {}
    for (const a of answers) m[a.uid] = a
    return m
  }, [answers])

  const standings = [...players].sort((a, b) => b.totalScore - a.totalScore)
  const lettersLeft = LETTERS.length - game.usedLetters.length

  async function nextLetter() {
    setLoading('next')
    setError(null)
    try {
      await api.startRound(gameId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      setLoading(null)
    }
  }

  async function finish() {
    setLoading('finish')
    setError(null)
    try {
      await api.finishGame(gameId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      setLoading(null)
    }
  }

  return (
    <div className="screen gap-4">
      <div className="card text-center">
        <p className="font-bold text-white/70">Resultados de la letra</p>
        <div className="font-display text-5xl font-extrabold">{game.currentLetter}</div>
        <p className="mt-1 text-sm font-semibold text-brand-amber">
          {game.stoppedByNick ? `🛑 ${game.stoppedByNick} presionó STOP` : '⏱ Se acabó el tiempo'}
        </p>
      </div>

      {/* Respuestas por categoría */}
      <div className="space-y-3">
        {game.categories.map((cat) => (
          <div key={cat} className="card">
            <h3 className="font-display mb-2 text-lg font-extrabold">{cat}</h3>
            <div className="space-y-1.5">
              {players.map((p) => {
                const a = byUid[p.id]?.answers?.[cat]
                const pts = byUid[p.id]?.scoreByCategory?.[cat] ?? 0
                const valid = a?.status === 'valid'
                return (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <Avatar nickname={p.nickname} color={p.color} size={26} />
                    <span className="w-16 shrink-0 truncate font-semibold text-white/70">
                      {p.nickname}
                    </span>
                    <span
                      className={`flex-1 truncate font-bold ${
                        valid ? 'text-white' : 'text-white/40 line-through'
                      }`}
                    >
                      {a?.word?.trim() || '—'}
                    </span>
                    <span
                      className={`font-display w-10 shrink-0 text-right font-extrabold ${
                        pts > 0 ? 'text-brand-green' : 'text-white/30'
                      }`}
                    >
                      +{pts}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Marcador acumulado */}
      <div className="card">
        <h3 className="font-display mb-2 text-lg font-extrabold">Marcador</h3>
        <div className="space-y-1.5">
          {standings.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="w-5 font-bold text-white/50">{i + 1}</span>
              <Avatar nickname={p.nickname} color={p.color} size={26} ring={p.id === uid} />
              <span className="flex-1 truncate font-bold">{p.nickname}</span>
              <span className="font-display font-extrabold text-brand-amber">
                {p.totalScore}
              </span>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-center font-semibold text-brand-amber">{error}</p>}

      <div className="mt-auto space-y-3 pt-2">
        <Button variant="success" onClick={nextLetter} disabled={loading !== null || lettersLeft <= 0}>
          {loading === 'next'
            ? 'Cargando…'
            : lettersLeft > 0
              ? `▶️ Siguiente letra (${lettersLeft} restantes)`
              : 'No quedan letras'}
        </Button>
        <Button variant="danger" onClick={finish} disabled={loading !== null}>
          {loading === 'finish' ? 'Finalizando…' : '🏁 Finalizar partida'}
        </Button>
      </div>
    </div>
  )
}
