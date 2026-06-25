import crypto from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import {
  adminDb,
  HttpError,
  optString,
  postHandler,
  reqString,
  requireAuth,
} from './_admin.js'
import { CATEGORIES, CODE_ALPHABET, CODE_LENGTH } from './_constants.js'
import { colorFor } from './_color.js'

function randomCode(): string {
  let code = ''
  const bytes = crypto.randomBytes(CODE_LENGTH)
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return code
}

export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex')
}

// Genera un código único intentando varias veces.
async function uniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode()
    const snap = await adminDb().doc(`games/${code}`).get()
    if (!snap.exists) return code
  }
  throw new HttpError(503, 'No se pudo generar un código, intenta de nuevo')
}

export default postHandler(async (req, res) => {
  const uid = await requireAuth(req)
  const nickname = reqString(req.body, 'nickname', 24)
  const secret = optString(req.body, 'secret', 40)

  const code = await uniqueCode()
  const gameRef = adminDb().doc(`games/${code}`)
  const now = FieldValue.serverTimestamp()

  await gameRef.set({
    code,
    hasSecret: !!secret,
    secretHash: secret ? hashSecret(secret) : null,
    status: 'lobby',
    categories: CATEGORIES,
    usedLetters: [],
    currentLetter: null,
    roundIndex: 0,
    roundStartAt: null,
    roundEndsAt: null,
    stoppedBy: null,
    stoppedByNick: null,
    closingAt: null,
    scored: false,
    createdBy: uid,
    createdAt: now,
  })

  // El creador entra como primer jugador.
  await gameRef.collection('players').doc(uid).set({
    uid,
    nickname,
    color: colorFor(uid),
    totalScore: 0,
    connected: true,
    joinedAt: now,
    lastSeen: now,
  })

  res.status(200).json({ gameId: code })
})
