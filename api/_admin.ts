import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─── Inicialización del Admin SDK ────────────────────────────────────────────
function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new HttpError(500, 'FIREBASE_SERVICE_ACCOUNT no está configurada')
  try {
    return JSON.parse(raw)
  } catch {
    throw new HttpError(500, 'FIREBASE_SERVICE_ACCOUNT no es un JSON válido')
  }
}

function app(): App {
  const existing = getApps()
  if (existing.length) return existing[0]!
  return initializeApp({ credential: cert(serviceAccount()) })
}

export const adminDb = () => getFirestore(app())
export const adminAuth = () => getAuth(app())

// ─── Utilidades de HTTP ───────────────────────────────────────────────────────
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

// Verifica el ID token de Firebase enviado en el header Authorization.
// Devuelve el uid del usuario autenticado.
export async function requireAuth(req: VercelRequest): Promise<string> {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) throw new HttpError(401, 'Falta el token de autenticación')
  try {
    const decoded = await adminAuth().verifyIdToken(token)
    return decoded.uid
  } catch {
    throw new HttpError(401, 'Token inválido')
  }
}

// Envuelve un handler POST con manejo de errores y validación de método.
export function postHandler(
  fn: (req: VercelRequest, res: VercelResponse) => Promise<void>,
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método no permitido' })
      return
    }
    try {
      await fn(req, res)
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500
      const message = err instanceof Error ? err.message : 'Error del servidor'
      if (status >= 500) console.error(err)
      res.status(status).json({ error: message })
    }
  }
}

// Lee y valida que un campo string exista en el body.
export function reqString(body: unknown, key: string, max = 60): string {
  const v = (body as Record<string, unknown>)?.[key]
  if (typeof v !== 'string' || !v.trim()) {
    throw new HttpError(400, `Falta el campo "${key}"`)
  }
  return v.trim().slice(0, max)
}

export function optString(body: unknown, key: string, max = 60): string | undefined {
  const v = (body as Record<string, unknown>)?.[key]
  if (typeof v !== 'string' || !v.trim()) return undefined
  return v.trim().slice(0, max)
}
