import { useEffect, useState } from 'react'
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import type { GameDoc, Player, PlayerDoc } from '../lib/types'

// Suscribe al documento de juego y a la lista de jugadores en tiempo real.
export function useGameState(gameId: string | null) {
  const [game, setGame] = useState<GameDoc | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [exists, setExists] = useState<boolean | null>(null)

  useEffect(() => {
    if (!gameId) return
    const ref = doc(db, 'games', gameId)
    const unsub = onSnapshot(ref, (snap) => {
      setExists(snap.exists())
      setGame(snap.exists() ? (snap.data() as GameDoc) : null)
    })

    // Al volver del segundo plano o recuperar la conexión, hace una lectura
    // puntual para ponerse al día al instante (p. ej. la ronda ya inició)
    // sin esperar a que el socket en tiempo real reconecte.
    const resync = () => {
      if (document.visibilityState === 'hidden') return
      getDoc(ref)
        .then((snap) => {
          setExists(snap.exists())
          setGame(snap.exists() ? (snap.data() as GameDoc) : null)
        })
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)
    window.addEventListener('focus', resync)

    return () => {
      unsub()
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
      window.removeEventListener('focus', resync)
    }
  }, [gameId])

  useEffect(() => {
    if (!gameId) return
    const q = query(collection(db, 'games', gameId, 'players'), orderBy('joinedAt', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as PlayerDoc) })))
    })
    return unsub
  }, [gameId])

  return { game, players, exists }
}
