import crypto from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb, HttpError, postHandler, reqString, requireAuth } from './_admin.js'
import { CATEGORIES, LETTERS, ROUND_SECONDS } from './_constants.js'

export default postHandler(async (req, res) => {
  await requireAuth(req)
  const gameId = reqString(req.body, 'gameId', 8).toUpperCase()
  const gameRef = adminDb().doc(`games/${gameId}`)

  const outcome = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(gameRef)
    if (!snap.exists) throw new HttpError(404, 'No existe la partida')
    const game = snap.data()!

    if (game.status === 'playing') {
      throw new HttpError(409, 'Ya hay una ronda en curso')
    }

    const used: string[] = game.usedLetters || []
    const remaining = LETTERS.filter((l) => !used.includes(l))

    // Sin letras restantes → la partida termina.
    if (remaining.length === 0) {
      tx.update(gameRef, { status: 'finished' })
      return { finished: true as const }
    }

    const letter = remaining[crypto.randomInt(remaining.length)]
    const roundIndex = used.length
    const startMs = Date.now()
    const endMs = startMs + ROUND_SECONDS * 1000

    tx.update(gameRef, {
      status: 'playing',
      currentLetter: letter,
      usedLetters: [...used, letter],
      roundIndex,
      roundStartAt: Timestamp.fromMillis(startMs),
      roundEndsAt: Timestamp.fromMillis(endMs),
      scored: false,
      stoppedBy: null,
      stoppedByNick: null,
      closingAt: null,
    })

    return { finished: false as const, letter, roundIndex }
  })

  if (outcome.finished) {
    res.status(200).json({ finished: true })
    return
  }

  // Pre-crea un documento de respuestas vacío por cada jugador.
  const playersSnap = await gameRef.collection('players').get()
  const emptyAnswers: Record<string, { word: string; status: string }> = {}
  for (const cat of CATEGORIES) emptyAnswers[cat] = { word: '', status: 'empty' }

  const batch = adminDb().batch()
  playersSnap.forEach((p) => {
    const player = p.data()
    const ref = gameRef
      .collection('rounds')
      .doc(String(outcome.roundIndex))
      .collection('answers')
      .doc(p.id)
    batch.set(ref, {
      uid: p.id,
      nickname: player.nickname,
      letter: outcome.letter,
      answers: { ...emptyAnswers },
      allValid: false,
    })
  })
  await batch.commit()

  res.status(200).json({ finished: false, letter: outcome.letter })
})
