import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '../components/Button'
import { LetterBadge } from '../components/LetterBadge'
import { Timer } from '../components/Timer'
import { ValidationBadge } from '../components/ValidationBadge'
import { StopButton } from '../components/StopButton'
import { useMyAnswer } from '../hooks/useAnswers'
import { useCountdown } from '../hooks/useCountdown'
import { useViewportHeight } from '../hooks/useViewportHeight'
import { ROUND_SECONDS } from '../lib/constants'
import { api } from '../lib/api'
import type { AnswerStatus, GameDoc } from '../lib/types'

const EMOJI: Record<string, string> = {
  Nombre: '🧑',
  Apellido: '👪',
  'País o Ciudad': '🌎',
  Animal: '🐾',
  'Fruta o Verdura': '🍎',
  Color: '🎨',
  'Objeto o Cosa': '📦',
}

interface Props {
  gameId: string
  game: GameDoc
  uid: string | null
}

export function Play({ gameId, game, uid }: Props) {
  const categories = game.categories
  const roundIndex = game.roundIndex
  const letter = game.currentLetter || '?'
  const myAnswer = useMyAnswer(gameId, roundIndex, uid)
  const secondsLeft = useCountdown(game.roundEndsAt ? game.roundEndsAt.toMillis() : null)
  const viewportHeight = useViewportHeight()

  const [index, setIndex] = useState(0) // 0..categories.length (último = resumen)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [validating, setValidating] = useState<Record<string, boolean>>({})
  const [reveal, setReveal] = useState(true)
  const [stopping, setStopping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadedRound = useRef<number | null>(null)
  const closing = useRef(false)
  const inFlight = useRef<Set<string>>(new Set()) // categorías validándose ahora mismo

  // Reinicia el wizard al cambiar de letra/ronda y muestra el reveal.
  useEffect(() => {
    setIndex(0)
    setDrafts({})
    setValidating({})
    loadedRound.current = null
    closing.current = false
    setReveal(true)
    const t = setTimeout(() => setReveal(false), 2600)
    return () => clearTimeout(t)
  }, [roundIndex])

  // Carga los borradores guardados (reconexión) una vez por ronda.
  useEffect(() => {
    if (myAnswer && loadedRound.current !== roundIndex) {
      const initial: Record<string, string> = {}
      for (const c of categories) initial[c] = myAnswer.answers?.[c]?.word || ''
      setDrafts(initial)
      loadedRound.current = roundIndex
    }
  }, [myAnswer, roundIndex, categories])

  // Corte por tiempo agotado (cualquiera dispara; el servidor evita doble cómputo).
  useEffect(() => {
    if (secondsLeft === 0 && game.status === 'playing' && !reveal && !closing.current) {
      closing.current = true
      api.closeRound(gameId, 'timeout').catch(() => {})
    }
  }, [secondsLeft, game.status, reveal, gameId])

  // Valida una categoría con el servidor (Gemini). El status llega por la suscripción.
  async function commit(cat: string) {
    const word = (drafts[cat] || '').trim()
    const stored = myAnswer?.answers?.[cat]
    if (stored && stored.word === word && stored.status !== 'empty') return // sin cambios
    if (inFlight.current.has(cat)) return // ya se está validando esta categoría
    inFlight.current.add(cat)
    setValidating((v) => ({ ...v, [cat]: true }))
    setError(null)
    try {
      // 2 intentos: si falla (timeout/error), reintenta una vez tras una pausa breve.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await api.validate(gameId, cat, word)
          return
        } catch (e) {
          if (attempt === 1) {
            setError(e instanceof Error ? e.message : 'Error al validar')
          } else {
            await new Promise((r) => setTimeout(r, 600))
          }
        }
      }
    } finally {
      inFlight.current.delete(cat)
      setValidating((v) => ({ ...v, [cat]: false }))
    }
  }

  function statusFor(cat: string): AnswerStatus {
    if (validating[cat]) return 'validating'
    const stored = myAnswer?.answers?.[cat]
    const draft = (drafts[cat] || '').trim()
    if (!stored || stored.word !== draft) return 'empty' // editado pero aún sin validar
    return stored.status
  }

  function goTo(i: number) {
    if (index < categories.length) commit(categories[index]) // valida la actual al salir
    setIndex(Math.max(0, Math.min(categories.length, i)))
  }

  async function onStop() {
    setStopping(true)
    setError(null)
    try {
      await api.closeRound(gameId, 'stop')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo detener')
      setStopping(false)
    }
  }

  const allValid = !!myAnswer?.allValid
  const onSummary = index >= categories.length
  const cat = categories[index]

  // Valida en SEGUNDO PLANO mientras escribes (debounce): así, al terminar,
  // casi todo ya está validado y STOP queda disponible casi al instante.
  useEffect(() => {
    if (onSummary || reveal || !cat) return
    const word = (drafts[cat] || '').trim()
    if (!word) return
    const stored = myAnswer?.answers?.[cat]
    if (stored && stored.word === word && stored.status !== 'empty') return
    const t = setTimeout(() => commit(cat), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, cat, onSummary, reveal, myAnswer])

  return (
    <div
      className="mx-auto flex w-full max-w-md flex-col gap-4 overflow-y-auto px-5"
      style={{
        height: viewportHeight,
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Reveal de la letra */}
      <AnimatePresence>
        {reveal && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand-deep"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.p
              className="font-display mb-4 text-2xl font-bold text-white/80"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              La letra es…
            </motion.p>
            <motion.div
              initial={{ scale: 0.2, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            >
              <LetterBadge letter={letter} size={180} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header: letra + timer */}
      <div className="flex items-center gap-3">
        <LetterBadge letter={letter} size={52} />
        <div className="flex-1">
          <Timer secondsLeft={secondsLeft} total={ROUND_SECONDS} />
        </div>
      </div>

      {/* Puntos de progreso por categoría */}
      <div className="flex justify-center gap-1.5">
        {categories.map((c, i) => {
          const s = statusFor(c)
          const color =
            s === 'valid'
              ? 'bg-brand-green'
              : s === 'invalid'
                ? 'bg-brand-red'
                : 'bg-white/25'
          return (
            <button
              key={c}
              onClick={() => goTo(i)}
              className={`h-2.5 rounded-full transition-all ${color} ${
                i === index ? 'w-6 ring-2 ring-white/60' : 'w-2.5'
              }`}
              aria-label={c}
            />
          )
        })}
      </div>

      {/* Contenido */}
      {!onSummary ? (
        <motion.div
          key={cat}
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="card flex flex-1 flex-col"
        >
          <div className="mb-1 text-sm font-bold uppercase tracking-wide text-white/60">
            Categoría {index + 1} de {categories.length}
          </div>
          <div className="font-display mb-4 flex items-center gap-2 text-3xl font-extrabold">
            <span>{EMOJI[cat] || '✏️'}</span>
            <span>{cat}</span>
          </div>

          <div className="relative">
            <input
              key={`${roundIndex}-${index}`}
              className="input pr-12"
              value={drafts[cat] || ''}
              maxLength={40}
              autoFocus
              enterKeyHint="next"
              autoComplete="off"
              placeholder={`Algo con "${letter}"…`}
              onChange={(e) => setDrafts((d) => ({ ...d, [cat]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') goTo(index + 1)
              }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <ValidationBadge status={statusFor(cat)} />
            </div>
          </div>

          {statusFor(cat) === 'invalid' && myAnswer?.answers?.[cat]?.reason && (
            <p className="mt-2 text-sm font-semibold text-brand-amber">
              {myAnswer.answers[cat].reason}
            </p>
          )}

          <div className="mt-auto space-y-3 pt-6">
            {allValid && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-1"
              >
                <p className="font-display text-sm font-bold text-brand-green">
                  ¡Todas válidas! Ya puedes detener 🛑
                </p>
                <StopButton enabled={!stopping} loading={stopping} onClick={onStop} />
              </motion.div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="ghost"
                size="sm"
                full
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
              >
                ← Atrás
              </Button>
              <Button variant="ghost" size="sm" full onClick={() => goTo(index + 1)}>
                Saltar
              </Button>
              <Button variant="primary" size="sm" full onClick={() => goTo(index + 1)}>
                {validating[cat] ? '…' : 'Siguiente'}
              </Button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card flex flex-1 flex-col gap-3"
        >
          <h2 className="font-display text-2xl font-extrabold">Tus respuestas</h2>
          <div className="space-y-2">
            {categories.map((c, i) => {
              const s = statusFor(c)
              return (
                <button
                  key={c}
                  onClick={() => setIndex(i)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white/5 px-3 py-2 text-left"
                >
                  <span className="text-xl">{EMOJI[c] || '✏️'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white/50">{c}</div>
                    <div className="truncate font-bold">
                      {drafts[c]?.trim() || <span className="text-white/40">—</span>}
                    </div>
                  </div>
                  <ValidationBadge status={s} />
                </button>
              )
            })}
          </div>

          <div className="mt-auto flex flex-col items-center gap-3 pt-4">
            <StopButton enabled={allValid} loading={stopping} onClick={onStop} />
            <Button variant="ghost" full onClick={() => setIndex(0)}>
              ← Seguir editando
            </Button>
          </div>
        </motion.div>
      )}

      {error && <p className="text-center font-semibold text-brand-amber">{error}</p>}
    </div>
  )
}
