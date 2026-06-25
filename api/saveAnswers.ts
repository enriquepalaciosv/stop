import { adminDb, HttpError, postHandler, reqString, requireAuth } from './_admin.js'
import type { CatAnswer } from './_validate.js'

// Guarda el TEXTO de las respuestas del jugador SIN validar con Gemini.
// La validación con Gemini ocurre únicamente al cerrar la ronda (STOP o tiempo
// agotado), dentro de closeRoundAndScore. Persistir el texto en vivo permite la
// reconexión, el corte por tiempo y que el servidor revalide todo de forma
// autoritativa al puntuar.
export default postHandler(async (req, res) => {
  const uid = await requireAuth(req)
  const gameId = reqString(req.body, 'gameId', 8).toUpperCase()
  const raw = (req.body as Record<string, unknown>)?.answers
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'Faltan respuestas')

  const gameRef = adminDb().doc(`games/${gameId}`)
  const gameSnap = await gameRef.get()
  if (!gameSnap.exists) throw new HttpError(404, 'No existe la partida')
  const game = gameSnap.data()!
  if (game.status !== 'playing') throw new HttpError(409, 'La ronda no está activa')

  const categories: string[] = game.categories
  const letter: string = game.currentLetter
  const roundIndex: number = game.roundIndex

  // Mapa de respuestas con solo texto: 'validating' si hay palabra (se validará
  // al cerrar), 'empty' si está vacía. Aquí NO se consulta a Gemini.
  const words = raw as Record<string, unknown>
  const answers: Record<string, CatAnswer> = {}
  for (const c of categories) {
    const word = String(words[c] ?? '').trim().slice(0, 40)
    answers[c] = word ? { word, status: 'validating' } : { word: '', status: 'empty' }
  }
  const completed = categories.every((c) => answers[c].status === 'validating')

  const answerRef = gameRef
    .collection('rounds')
    .doc(String(roundIndex))
    .collection('answers')
    .doc(uid)
  await answerRef.set({ uid, letter, answers, completed }, { merge: true })

  res.status(200).json({ completed })
})
