import { useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import type { AnswerDoc } from '../lib/types'

// Cada cuánto reconciliamos por sondeo, como red de seguridad independiente del
// transporte en tiempo real (un stream que se cae en silencio no entrega pushes).
const POLL_MS = 2500

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

    const resync = () => {
      if (document.visibilityState === 'hidden') return
      getDoc(ref)
        .then((snap) => setAnswer(snap.exists() ? (snap.data() as AnswerDoc) : null))
        .catch(() => {})
    }
    const interval = setInterval(resync, POLL_MS)
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)
    window.addEventListener('focus', resync)

    return () => {
      unsub()
      clearInterval(interval)
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
      window.removeEventListener('focus', resync)
    }
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

    const resync = () => {
      if (document.visibilityState === 'hidden') return
      getDocs(col)
        .then((snap) => setAnswers(snap.docs.map((d) => d.data() as AnswerDoc)))
        .catch(() => {})
    }
    const interval = setInterval(resync, POLL_MS)
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)
    window.addEventListener('focus', resync)

    return () => {
      unsub()
      clearInterval(interval)
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
      window.removeEventListener('focus', resync)
    }
  }, [gameId, roundIndex, enabled])

  return answers
}
