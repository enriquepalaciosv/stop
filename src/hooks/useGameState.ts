import { useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import type { GameDoc, Player, PlayerDoc } from '../lib/types'

// Cada cuánto reconciliamos el estado por sondeo, como red de seguridad
// independiente del transporte en tiempo real (ver abajo).
const POLL_MS = 2500

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

    // Red de seguridad: aunque el onSnapshot se estanque (un stream que se cae
    // en silencio), una lectura puntual periódica reconcilia el estado en
    // segundos sin que nadie tenga que refrescar. También nos ponemos al día al
    // instante al volver del segundo plano o recuperar la conexión.
    const resync = () => {
      if (document.visibilityState === 'hidden') return
      getDoc(ref)
        .then((snap) => {
          setExists(snap.exists())
          setGame(snap.exists() ? (snap.data() as GameDoc) : null)
        })
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
  }, [gameId])

  useEffect(() => {
    if (!gameId) return
    const q = query(collection(db, 'games', gameId, 'players'), orderBy('joinedAt', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as PlayerDoc) })))
    })

    // Mismo respaldo por sondeo para la lista de jugadores (p. ej. quién se unió
    // o la presencia), por si el stream de la colección deja de entregar cambios.
    const resync = () => {
      if (document.visibilityState === 'hidden') return
      getDocs(q)
        .then((snap) => {
          setPlayers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as PlayerDoc) })))
        })
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
  }, [gameId])

  return { game, players, exists }
}
