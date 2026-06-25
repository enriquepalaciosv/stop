import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from './_admin.js'
import { computeScores, type AnswerInput } from './_scoring.js'
import { validateAnswers, type CatAnswer } from './_validate.js'

// Si un cierre anterior tomó el lock y murió (timeout de la función, etc.), otro
// llamador puede retomar pasado este tiempo. Acotado por maxDuration de Vercel.
const SCORING_LOCK_TTL_MS = 30_000

// Cierra la ronda en curso y reparte puntajes. La validación con Gemini ocurre
// ANTES de marcar la ronda como cerrada/puntuada: así un fallo transitorio de
// Gemini nunca deja la ronda en estado "review" sin puntuar e irrecuperable.
// Devuelve true si efectivamente cerró/puntuó esta llamada, false si ya estaba
// cerrada o si otro llamador la está cerrando ahora mismo.
export async function closeRoundAndScore(
  gameId: string,
  opts: { byUid?: string | null; byNick?: string | null },
): Promise<boolean> {
  const gameRef = adminDb().doc(`games/${gameId}`)
  const nowMs = Date.now()

  // 1) Lock atómico: solo un llamador entra a puntuar. Aún NO marcamos
  //    review/scored — eso se hace al final, cuando la validación ya terminó.
  const ctx = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(gameRef)
    if (!snap.exists) return null
    const g = snap.data()!
    if (g.status !== 'playing' || g.scored) return null
    const lockedAtMs = (g.scoringStartedAt as Timestamp | undefined)?.toMillis?.() ?? 0
    if (g.scoring && nowMs - lockedAtMs < SCORING_LOCK_TTL_MS) {
      return null // otro cierre ya está puntuando esta ronda
    }
    tx.update(gameRef, { scoring: true, scoringStartedAt: Timestamp.fromMillis(nowMs) })
    return {
      roundIndex: g.roundIndex as number,
      categories: g.categories as string[],
      letter: g.currentLetter as string,
      stoppedBy: (g.stoppedBy as string | null) ?? null,
      stoppedByNick: (g.stoppedByNick as string | null) ?? null,
    }
  })

  if (!ctx) return false

  try {
    const answersCol = gameRef
      .collection('rounds')
      .doc(String(ctx.roundIndex))
      .collection('answers')
    const answersSnap = await answersCol.get()
    const letter = ctx.letter

    // 2) Revalida de forma AUTORITATIVA toda palabra con texto pero sin status
    //    final (en el modelo actual, todas llegan así). Una llamada a Gemini por
    //    jugador (batch). Esto ocurre ANTES de cerrar la ronda.
    const inputs: AnswerInput[] = []
    const validatedAnswers: { id: string; answers: Record<string, CatAnswer> }[] = []
    await Promise.all(
      answersSnap.docs.map(async (d) => {
        const data = d.data()
        const answers: Record<string, CatAnswer> = { ...(data.answers || {}) }
        const pending = ctx.categories.filter((c) => {
          const a = answers[c]
          return a && a.word && a.word.trim() && a.status !== 'valid' && a.status !== 'invalid'
        })
        if (pending.length) {
          const revalidated = await validateAnswers(
            letter,
            pending.map((c) => ({ category: c, word: answers[c].word })),
          )
          pending.forEach((c, i) => {
            answers[c] = revalidated[i]
          })
          validatedAnswers.push({ id: d.id, answers })
        }
        inputs.push({ uid: d.id, answers })
      }),
    )

    const scores = computeScores(inputs, ctx.categories)

    // 3) Commit final atómico: recién aquí se marca la ronda como cerrada y se
    //    escriben palabras validadas + puntajes + acumulado de cada jugador.
    const batch = adminDb().batch()
    batch.update(gameRef, {
      status: 'review',
      scored: true,
      scoring: false,
      closeFailedAt: null,
      stoppedBy: opts.byUid ?? ctx.stoppedBy,
      stoppedByNick: opts.byNick ?? ctx.stoppedByNick,
      closingAt: null,
      roundEndsAt: Timestamp.fromMillis(Date.now()),
    })
    const validatedById = new Map(validatedAnswers.map((v) => [v.id, v.answers]))
    for (const uid of Object.keys(scores)) {
      const { scoreByCategory, roundScore } = scores[uid]
      const payload: Record<string, unknown> = { scoreByCategory, roundScore }
      const validated = validatedById.get(uid)
      if (validated) payload.answers = validated
      batch.set(answersCol.doc(uid), payload, { merge: true })
      batch.update(gameRef.collection('players').doc(uid), {
        totalScore: FieldValue.increment(roundScore),
      })
    }
    await batch.commit()
    return true
  } catch (err) {
    // Libera el lock y marca el fallo. NO se marcó scored, así que la ronda sigue
    // en 'playing' (recuperable): los clientes verán el botón "Reintentar
    // calificación" gracias a closeFailedAt.
    await gameRef
      .update({ scoring: false, closeFailedAt: Timestamp.fromMillis(Date.now()) })
      .catch(() => {})
    throw err
  }
}
