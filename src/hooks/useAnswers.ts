import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import type { AnswerDoc } from '../lib/types'

// Suscribe a MI documento de respuestas de la ronda actual (statuses de validación).
export function useMyAnswer(
  gameId: string | null,
  roundIndex: number | null | undefined,
  uid: string | null,
) {
  const [answer, setAnswer] = useState<AnswerDoc | null>(null)

  useEffect(() => {
    if (!gameId || roundIndex == null || !uid) {
      setAnswer(null)
      return
    }
    const ref = doc(db, 'games', gameId, 'rounds', String(roundIndex), 'answers', uid)
    const unsub = onSnapshot(ref, (snap) => {
      setAnswer(snap.exists() ? (snap.data() as AnswerDoc) : null)
    })
    return unsub
  }, [gameId, roundIndex, uid])

  return answer
}

// Suscribe a TODAS las respuestas de la ronda (solo permitido en review/finished).
export function useAllAnswers(
  gameId: string | null,
  roundIndex: number | null | undefined,
  enabled: boolean,
) {
  const [answers, setAnswers] = useState<AnswerDoc[]>([])

  useEffect(() => {
    if (!gameId || roundIndex == null || !enabled) {
      setAnswers([])
      return
    }
    const col = collection(db, 'games', gameId, 'rounds', String(roundIndex), 'answers')
    const unsub = onSnapshot(col, (snap) => {
      setAnswers(snap.docs.map((d) => d.data() as AnswerDoc))
    })
    return unsub
  }, [gameId, roundIndex, enabled])

  return answers
}
