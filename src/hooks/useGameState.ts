import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import type { GameDoc, Player, PlayerDoc } from '../lib/types'

// Suscribe al documento de juego y a la lista de jugadores en tiempo real.
export function useGameState(gameId: string | null) {
  const [game, setGame] = useState<GameDoc | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [exists, setExists] = useState<boolean | null>(null)

  useEffect(() => {
    if (!gameId) return
    const unsub = onSnapshot(doc(db, 'games', gameId), (snap) => {
      setExists(snap.exists())
      setGame(snap.exists() ? (snap.data() as GameDoc) : null)
    })
    return unsub
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
