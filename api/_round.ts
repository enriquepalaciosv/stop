import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from './_admin.js'
import { computeScores, type AnswerInput } from './_scoring.js'

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
      stoppedBy: opts.byUid ?? null,
      stoppedByNick: opts.byNick ?? null,
      roundEndsAt: Timestamp.fromMillis(Date.now()),
    })
    return { roundIndex: g.roundIndex as number, categories: g.categories as string[] }
  })

  if (!ctx) return false

  const answersCol = gameRef
    .collection('rounds')
    .doc(String(ctx.roundIndex))
    .collection('answers')
  const answersSnap = await answersCol.get()

  const inputs: AnswerInput[] = []
  answersSnap.forEach((d) => {
    const a = d.data()
    inputs.push({ uid: d.id, answers: a.answers || {} })
  })

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
