import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from './_admin.js'
import { computeScores, type AnswerInput } from './_scoring.js'
import { validateCategory, type CatAnswer } from './_validate.js'

// Cierra la ronda en curso (con guard anti-doble-cómputo) y reparte puntajes.
// Devuelve true si efectivamente cerró/puntuó esta llamada, false si ya estaba cerrada.
export async function closeRoundAndScore(
  gameId: string,
  opts: { byUid?: string | null; byNick?: string | null },
): Promise<boolean> {
  const gameRef = adminDb().doc(`games/${gameId}`)

  const ctx = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(gameRef)
    if (!snap.exists) return null
    const g = snap.data()!
    if (g.status !== 'playing' || g.scored) return null
    tx.update(gameRef, {
      status: 'review',
      scored: true,
      stoppedBy: opts.byUid ?? g.stoppedBy ?? null,
      stoppedByNick: opts.byNick ?? g.stoppedByNick ?? null,
      closingAt: null,
      roundEndsAt: Timestamp.fromMillis(Date.now()),
    })
    return {
      roundIndex: g.roundIndex as number,
      categories: g.categories as string[],
      letter: g.currentLetter as string,
    }
  })

  if (!ctx) return false

  const answersCol = gameRef
    .collection('rounds')
    .doc(String(ctx.roundIndex))
    .collection('answers')
  const answersSnap = await answersCol.get()
  const letter = ctx.letter

  // Revalida de forma AUTORITATIVA toda palabra que llegó al servidor con texto
  // pero sin status final (p. ej. validación en vuelo cuando alguien presionó
  // STOP, o borradores volcados en la ventana de cierre). Así las palabras
  // correctas de todos cuentan, sin depender del timing del cliente.
  const inputs: AnswerInput[] = []
  await Promise.all(
    answersSnap.docs.map(async (d) => {
      const data = d.data()
      const answers: Record<string, CatAnswer> = { ...(data.answers || {}) }
      const pending = ctx.categories.filter((c) => {
        const a = answers[c]
        return a && a.word && a.word.trim() && a.status !== 'valid' && a.status !== 'invalid'
      })
      if (pending.length) {
        const revalidated = await Promise.all(
          pending.map((c) => validateCategory(letter, c, answers[c].word)),
        )
        pending.forEach((c, i) => {
          answers[c] = revalidated[i]
        })
        const allValid = ctx.categories.every((c) => answers[c]?.status === 'valid')
        await answersCol.doc(d.id).set({ answers, allValid }, { merge: true })
      }
      inputs.push({ uid: d.id, answers })
    }),
  )

  const scores = computeScores(inputs, ctx.categories)

  const batch = adminDb().batch()
  for (const uid of Object.keys(scores)) {
    const { scoreByCategory, roundScore } = scores[uid]
    batch.set(answersCol.doc(uid), { scoreByCategory, roundScore }, { merge: true })
    batch.update(gameRef.collection('players').doc(uid), {
      totalScore: FieldValue.increment(roundScore),
    })
  }
  await batch.commit()
  return true
}
