import { Timestamp } from 'firebase-admin/firestore'
import { adminDb, HttpError, optString, postHandler, reqString, requireAuth } from './_admin.js'
import { closeRoundAndScore } from './_round.js'

// Ventana de cierre tras un STOP: da unos instantes para que todos los clientes
// vuelquen sus últimas palabras antes de que el servidor revalide y puntúe.
const CLOSING_GRACE_MS = 1200
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default postHandler(async (req, res) => {
  const uid = await requireAuth(req)
  const gameId = reqString(req.body, 'gameId', 8).toUpperCase()
  const reason = optString(req.body, 'reason', 12) || 'timeout' // 'stop' | 'timeout' | 'retry'

  const gameRef = adminDb().doc(`games/${gameId}`)
  const gameSnap = await gameRef.get()
  if (!gameSnap.exists) throw new HttpError(404, 'No existe la partida')

  if (reason === 'stop') {
    // Solo puede presionar STOP quien tenga TODAS sus palabras completas (con
    // texto); la validez se decide al cerrar. La ventana de cierre se arranca de
    // forma atómica (una sola vez por ronda).
    const opened = await adminDb().runTransaction(async (tx) => {
      const gSnap = await tx.get(gameRef)
      if (!gSnap.exists) throw new HttpError(404, 'No existe la partida')
      const g = gSnap.data()!
      if (g.status !== 'playing' || g.scored || g.closingAt) {
        return null // ya se está cerrando o ya cerró
      }

      const answerRef = gameRef
        .collection('rounds')
        .doc(String(g.roundIndex))
        .collection('answers')
        .doc(uid)
      const answerSnap = await tx.get(answerRef)
      const answers = (answerSnap.exists ? answerSnap.data()!.answers : null) || {}
      const completed = (g.categories as string[]).every((c) => {
        const w = answers[c]?.word
        return typeof w === 'string' && w.trim().length > 0
      })
      if (!completed) {
        throw new HttpError(403, 'Completa todas las palabras para presionar STOP')
      }
      const playerSnap = await tx.get(gameRef.collection('players').doc(uid))
      const byNick = playerSnap.exists ? playerSnap.data()!.nickname : 'Alguien'

      tx.update(gameRef, {
        closingAt: Timestamp.now(),
        stoppedBy: uid,
        stoppedByNick: byNick,
      })
      return { byUid: uid, byNick }
    })

    if (!opened) {
      res.status(200).json({ ok: true, closed: false })
      return
    }

    // Ventana para que los clientes vuelquen sus últimas palabras.
    await sleep(CLOSING_GRACE_MS)
    // Si el cierre falla (p. ej. Gemini caído), closeRoundAndScore marca
    // closeFailedAt y deja la ronda en 'playing' (recuperable): los clientes
    // muestran un botón "Reintentar calificación" (reason 'retry').
    const closed = await closeRoundAndScore(gameId, { byUid: opened.byUid, byNick: opened.byNick })
    res.status(200).json({ ok: true, closed })
    return
  }

  // Corte por tiempo o reintento manual ('retry'): sin ventana extra y sin exigir
  // que el jugador tenga todo completo. Preserva quién presionó STOP (si lo hubo)
  // porque closeRoundAndScore usa el stoppedBy ya guardado cuando opts viene en null.
  const closed = await closeRoundAndScore(gameId, { byUid: null, byNick: null })
  res.status(200).json({ ok: true, closed })
})
