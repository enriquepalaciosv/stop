import { FieldValue } from 'firebase-admin/firestore'
import {
  adminDb,
  HttpError,
  optString,
  postHandler,
  reqString,
  requireAuth,
} from './_admin.js'
import { colorFor } from './_color.js'
import { hashSecret } from './createGame.js'

export default postHandler(async (req, res) => {
  const uid = await requireAuth(req)
  const gameId = reqString(req.body, 'gameId', 8).toUpperCase()
  const nickname = reqString(req.body, 'nickname', 24)
  const secret = optString(req.body, 'secret', 40)

  const gameRef = adminDb().doc(`games/${gameId}`)
  const snap = await gameRef.get()
  if (!snap.exists) throw new HttpError(404, 'No existe una partida con ese código')

  const game = snap.data()!
  const playerRef = gameRef.collection('players').doc(uid)
  const alreadyIn = (await playerRef.get()).exists

  // Solo se puede unir en el lobby (salvo que ya seas jugador, p.ej. al reconectar).
  if (game.status !== 'lobby' && !alreadyIn) {
    throw new HttpError(409, 'La partida ya comenzó')
  }

  // Valida la clave secreta si la partida la tiene.
  if (game.hasSecret && !alreadyIn) {
    if (!secret || hashSecret(secret) !== game.secretHash) {
      throw new HttpError(403, 'Clave incorrecta')
    }
  }

  const now = FieldValue.serverTimestamp()
  if (alreadyIn) {
    await playerRef.set(
      { nickname, connected: true, lastSeen: now },
      { merge: true },
    )
  } else {
    await playerRef.set({
      uid,
      nickname,
      color: colorFor(uid),
      totalScore: 0,
      connected: true,
      joinedAt: now,
      lastSeen: now,
    })
  }

  res.status(200).json({ gameId })
})
