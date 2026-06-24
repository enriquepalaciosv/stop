import { auth } from '../firebase'

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) throw new Error('No autenticado todavía')
  const token = await user.getIdToken()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'Error inesperado')
  }
  return data as T
}

export interface ValidateResponse {
  status: 'empty' | 'valid' | 'invalid'
  reason?: string
}

export const api = {
  createGame: (nickname: string, secret?: string) =>
    post<{ gameId: string }>('createGame', { nickname, secret }),

  joinGame: (gameId: string, nickname: string, secret?: string) =>
    post<{ gameId: string }>('joinGame', { gameId, nickname, secret }),

  startRound: (gameId: string) =>
    post<{ finished: boolean; letter?: string }>('startRound', { gameId }),

  validate: (gameId: string, category: string, word: string) =>
    post<ValidateResponse>('validate', { gameId, category, word }),

  closeRound: (gameId: string, reason: 'stop' | 'timeout') =>
    post<{ ok: boolean; closed: boolean }>('closeRound', { gameId, reason }),

  finishGame: (gameId: string) => post<{ ok: boolean }>('finishGame', { gameId }),
}
