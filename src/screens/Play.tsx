import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '../components/Button'
import { LetterBadge } from '../components/LetterBadge'
import { Timer } from '../components/Timer'
import { StopButton } from '../components/StopButton'
import { useMyAnswer } from '../hooks/useAnswers'
import { useCountdown } from '../hooks/useCountdown'
import { useViewportHeight } from '../hooks/useViewportHeight'
import { ROUND_SECONDS } from '../lib/constants'
import { api } from '../lib/api'
import type { GameDoc } from '../lib/types'

const EMOJI: Record<string, string> = {
  Nombre: '🧑',
  Apellido: '👪',
  'País o Ciudad': '🌎',
  Animal: '🐾',
  'Fruta o Verdura': '🍎',
  Color: '🎨',
  'Objeto o Cosa': '📦',
}

// Badge neutro durante el juego: solo indica "escrita" (no validada todavía).
function WrittenBadge() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-sm font-black text-white/80">
      ✓
    </span>
  )
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
  const [reveal, setReveal] = useState(true)
  const [stopping, setStopping] = useState(false)
  const [closingRound, setClosingRound] = useState(false) // cierre disparado por mí (STOP/tiempo)
  const [retrying, setRetrying] = useState(false) // reintento manual de calificación
  const [error, setError] = useState<string | null>(null)

  const loadedRound = useRef<number | null>(null)
  const closing = useRef(false)
  const touched = useRef(false) // ¿el jugador editó algo? (evita autoguardar al cargar)
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts

  // Reinicia el wizard al cambiar de letra/ronda y muestra el reveal.
  useEffect(() => {
    setIndex(0)
    setDrafts({})
    loadedRound.current = null
    closing.current = false
    touched.current = false
    setStopping(false)
    setClosingRound(false)
    setRetrying(false)
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

  // Guarda el texto actual en el servidor (sin validar). Usa la ref para tener
  // siempre los borradores más recientes (cierre por STOP/tiempo).
  async function flush() {
    try {
      await api.saveAnswers(gameId, draftsRef.current)
    } catch {
      // se reintenta en el próximo cambio o al cerrar; no bloquea al jugador.
    }
  }

  // Autoguardado con debounce mientras escribes (solo tras la primera edición).
  // No valida nada: la validación con Gemini ocurre al cerrar la ronda.
  useEffect(() => {
    if (reveal || !touched.current) return
    const t = setTimeout(() => void flush(), 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, reveal])

  // Corte por tiempo agotado (cualquiera dispara; el servidor evita doble cómputo).
  // Vuelca las palabras escritas antes de cerrar; el servidor valida al puntuar.
  useEffect(() => {
    if (secondsLeft === 0 && game.status === 'playing' && !reveal && !closing.current) {
      closing.current = true
      setClosingRound(true)
      void (async () => {
        await flush()
        api.closeRound(gameId, 'timeout').catch(() => {})
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, game.status, reveal, gameId])

  // Alguien presionó STOP: hay una ventana breve antes de puntuar. Vuelca de
  // inmediato lo escrito para que cuente aunque estuvieras a media palabra.
  useEffect(() => {
    if (!game.closingAt || reveal) return
    void flush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.closingAt, reveal])

  async function onStop() {
    setStopping(true)
    setClosingRound(true)
    setError(null)
    try {
      await flush() // asegura que el servidor ya tenga todas mis palabras
      await api.closeRound(gameId, 'stop')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo detener')
      setStopping(false)
      setClosingRound(false)
    }
  }

  // Reintento manual cuando un cierre falló (p. ej. Gemini caído). No exige tener
  // todo completo y preserva quién presionó STOP. Cualquier jugador puede dispararlo.
  async function onRetry() {
    setRetrying(true)
    setError(null)
    try {
      await flush()
      await api.closeRound(gameId, 'retry')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo calificar')
    } finally {
      setRetrying(false)
    }
  }

  function setDraft(cat: string, value: string) {
    touched.current = true
    setDrafts((d) => ({ ...d, [cat]: value }))
  }

  function isFilled(cat: string): boolean {
    return (drafts[cat] || '').trim().length > 0
  }

  function goTo(i: number) {
    setIndex(Math.max(0, Math.min(categories.length, i)))
  }

  const allFilled = categories.every((c) => isFilled(c))
  const onSummary = index >= categories.length
  const cat = categories[index]
  // Un cierre falló y la ronda sigue jugable: ofrecer reintento de calificación.
  const closeFailed = !!game.closeFailedAt && game.status === 'playing'
  // Cierre en curso (spinner): yo lo disparé o alguien presionó STOP, salvo que
  // haya fallado (ahí mostramos el panel de reintento) o estemos reintentando.
  const showClosing = (closingRound || retrying || !!game.closingAt) && !reveal && !closeFailed

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

      {/* Cierre de ronda: ventana mientras el servidor valida con Gemini y
          puntúa las palabras de todos. */}
      <AnimatePresence>
        {showClosing && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-brand-deep px-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-6xl"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            >
              🛑
            </motion.div>
            <p className="font-display text-2xl font-extrabold text-white">
              {game.stoppedByNick ? `¡${game.stoppedByNick} presionó STOP!` : '¡Se acabó el tiempo!'}
            </p>
            <p className="text-sm font-semibold text-white/70">Validando palabras…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Falló la calificación (p. ej. Gemini caído): reintento manual para todos. */}
      <AnimatePresence>
        {closeFailed && !reveal && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-brand-deep px-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-6xl">⚡</div>
            <p className="font-display text-2xl font-extrabold text-white">
              ¡Un segundo más!
            </p>
            <p className="max-w-xs text-sm font-semibold text-white/70">
              Estamos por revelar los puntajes. Toca para terminar de calificar.
            </p>
            <Button variant="primary" onClick={onRetry} disabled={retrying}>
              {retrying ? 'Calificando…' : '🔁 ¡Calificar!'}
            </Button>
            {error && <p className="text-sm font-semibold text-brand-amber">{error}</p>}
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
          const color = isFilled(c) ? 'bg-white/70' : 'bg-white/25'
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
              onChange={(e) => setDraft(cat, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') goTo(index + 1)
              }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isFilled(cat) && <WrittenBadge />}
            </div>
          </div>

          <div className="mt-auto space-y-3 pt-6">
            {allFilled && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-1"
              >
                <p className="font-display text-sm font-bold text-brand-green">
                  ¡Completaste todo! Ya puedes detener 🛑
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
                Siguiente
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
            {categories.map((c, i) => (
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
                {isFilled(c) && <WrittenBadge />}
              </button>
            ))}
          </div>

          <div className="mt-auto flex flex-col items-center gap-3 pt-4">
            {!allFilled && (
              <p className="text-center text-sm font-semibold text-white/60">
                Completa todas las categorías para poder detener.
              </p>
            )}
            <StopButton enabled={allFilled && !stopping} loading={stopping} onClick={onStop} />
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
