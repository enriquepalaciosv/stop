import {
  adminDb,
  HttpError,
  postHandler,
  reqString,
  requireAuth,
} from './_admin.js'
import { normalize } from './_scoring.js'
import { validateWord } from './_gemini.js'

interface CatAnswer {
  word: string
  status: string
  reason?: string
}

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

  // Resuelve el status de ESTA categoría.
  let result: CatAnswer
  if (!word) {
    result = { word: '', status: 'empty' }
  } else if (normalize(word).charAt(0) !== normalize(letter).charAt(0)) {
    result = { word, status: 'invalid', reason: `No empieza con la letra ${letter}` }
  } else {
    const norm = normalize(word)
    const cacheKey = `${letter}_${category}_${norm}`.replace(/[/]/g, '-')
    const cacheRef = adminDb().doc(`validations/${cacheKey}`)
    const cached = await cacheRef.get()

    let valid: boolean
    let reason: string
    if (cached.exists) {
      const c = cached.data()!
      valid = !!c.valid
      reason = c.reason || ''
    } else {
      const v = await validateWord(letter, category, word)
      valid = v.valid
      reason = v.reason
      await cacheRef.set({ letter, category, norm, valid, reason })
    }
    result = valid
      ? { word, status: 'valid' }
      : { word, status: 'invalid', reason: reason || 'No es válida para la categoría' }
  }

  // Actualiza el documento de respuestas y recalcula allValid.
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
