import { adminDb, HttpError, optString, postHandler, reqString, requireAuth } from './_admin.js'
import { closeRoundAndScore } from './_round.js'

export default postHandler(async (req, res) => {
  const uid = await requireAuth(req)
  const gameId = reqString(req.body, 'gameId', 8).toUpperCase()
  const reason = optString(req.body, 'reason', 12) || 'timeout' // 'stop' | 'timeout'

  const gameRef = adminDb().doc(`games/${gameId}`)
  const gameSnap = await gameRef.get()
  if (!gameSnap.exists) throw new HttpError(404, 'No existe la partida')
  const game = gameSnap.data()!

  let byUid: string | null = null
  let byNick: string | null = null

  if (reason === 'stop') {
    // Solo puede presionar STOP quien tenga TODAS sus palabras válidas.
    const answerRef = gameRef
      .collection('rounds')
      .doc(String(game.roundIndex))
      .collection('answers')
      .doc(uid)
    const answerSnap = await answerRef.get()
    if (!answerSnap.exists || answerSnap.data()!.allValid !== true) {
      throw new HttpError(403, 'Necesitas todas las palabras válidas para presionar STOP')
    }
    const playerSnap = await gameRef.collection('players').doc(uid).get()
    byUid = uid
    byNick = playerSnap.exists ? playerSnap.data()!.nickname : 'Alguien'
  }

  const closed = await closeRoundAndScore(gameId, { byUid, byNick })
  res.status(200).json({ ok: true, closed })
})
