import {
  adminDb,
  HttpError,
  postHandler,
  reqString,
  requireAuth,
} from './_admin.js'
import { validateCategory, type CatAnswer } from './_validate.js'

export default postHandler(async (req, res) => {
  const uid = await requireAuth(req)
  const gameId = reqString(req.body, 'gameId', 8).toUpperCase()
  const category = reqString(req.body, 'category', 40)
  const rawWord = ((req.body as Record<string, unknown>)?.word as string) ?? ''
  const word = String(rawWord).trim().slice(0, 40)

  const gameRef = adminDb().doc(`games/${gameId}`)
  const gameSnap = await gameRef.get()
  if (!gameSnap.exists) throw new HttpError(404, 'No existe la partida')
  const game = gameSnap.data()!

  if (game.status !== 'playing') throw new HttpError(409, 'La ronda no está activa')
  if (!Array.isArray(game.categories) || !game.categories.includes(category)) {
    throw new HttpError(400, 'Categoría inválida')
  }

  const letter: string = game.currentLetter
  const roundIndex: number = game.roundIndex
  const answerRef = gameRef
    .collection('rounds')
    .doc(String(roundIndex))
    .collection('answers')
    .doc(uid)

  // 1) Persiste el TEXTO de inmediato con status 'validating' (si hay palabra),
  // antes de consultar a Gemini. Así, si la ronda se cierra mientras validamos,
  // el servidor ya tiene el texto y puede revalidarlo al puntuar (no se pierde).
  if (word) {
    await answerRef.set(
      {
        uid,
        letter,
        answers: { [category]: { word, status: 'validating' } },
      },
      { merge: true },
    )
  }

  // 2) Resuelve el status real de esta categoría (cache + Gemini).
  const result: CatAnswer = await validateCategory(letter, category, word)

  // 3) Actualiza el documento de respuestas y recalcula allValid.
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(answerRef)
    const data = snap.exists ? snap.data()! : { answers: {} }
    const answers: Record<string, CatAnswer> = { ...(data.answers || {}) }
    answers[category] = result

    const allValid = (game.categories as string[]).every(
      (c) => answers[c]?.status === 'valid',
    )

    tx.set(
      answerRef,
      {
        uid,
        letter,
        answers,
        allValid,
      },
      { merge: true },
    )
  })

  res.status(200).json(result)
})
