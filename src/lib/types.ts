import type { Timestamp } from 'firebase/firestore'

export type GameStatus = 'lobby' | 'playing' | 'review' | 'finished'

export type AnswerStatus = 'empty' | 'validating' | 'valid' | 'invalid'

export interface GameDoc {
  code: string
  hasSecret: boolean
  status: GameStatus
  categories: string[]
  usedLetters: string[]
  currentLetter: string | null
  roundIndex: number
  roundStartAt: Timestamp | null
  roundEndsAt: Timestamp | null
  stoppedBy: string | null // uid del que presionó STOP (null = por tiempo)
  stoppedByNick: string | null
  closingAt: Timestamp | null // marca de inicio de la ventana de cierre (STOP); null si no hay
  scored: boolean
  createdBy: string
  createdAt: Timestamp
}

export interface PlayerDoc {
  uid: string
  nickname: string
  color: string
  totalScore: number
  connected: boolean
  joinedAt: Timestamp
  lastSeen: Timestamp
}

export interface CategoryAnswer {
  word: string
  status: AnswerStatus
  reason?: string // motivo de invalidez (de Gemini)
}

export interface AnswerDoc {
  uid: string
  nickname: string
  letter: string
  answers: Record<string, CategoryAnswer>
  allValid: boolean
  scoreByCategory?: Record<string, number>
  roundScore?: number
}

// Jugador + su id (cómodo para listas).
export interface Player extends PlayerDoc {
  id: string
}
