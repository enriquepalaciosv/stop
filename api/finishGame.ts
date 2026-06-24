import { adminDb, HttpError, postHandler, reqString, requireAuth } from './_admin.js'
import { closeRoundAndScore } from './_round.js'

export default postHandler(async (req, res) => {
  await requireAuth(req)
  const gameId = reqString(req.body, 'gameId', 8).toUpperCase()

  const gameRef = adminDb().doc(`games/${gameId}`)
  const snap = await gameRef.get()
  if (!snap.exists) throw new HttpError(404, 'No existe la partida')
  const game = snap.data()!

  // Si hay una ronda en curso sin puntuar, ciérrala y puntúala antes de finalizar.
  if (game.status === 'playing' && !game.scored) {
    await closeRoundAndScore(gameId, { byUid: null, byNick: null })
  }

  await gameRef.update({ status: 'finished' })
  res.status(200).json({ ok: true })
})
