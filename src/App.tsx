import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useGameState } from './hooks/useGameState'
import { Loader } from './components/Loader'
import { Home } from './screens/Home'
import { Create } from './screens/Create'
import { Join } from './screens/Join'
import { Lobby } from './screens/Lobby'
import { Play } from './screens/Play'
import { Review } from './screens/Review'
import { Winners } from './screens/Winners'

const LS_GAME = 'stop.gameId'
const LS_NICK = 'stop.nickname'

type Route = 'home' | 'create' | 'join'

export default function App() {
  const { uid, error: authError } = useAuth()

  // Código de invitación en la URL (?game=ABCD): abre directo la pantalla de unirse.
  const joinCode = useMemo(
    () => (new URLSearchParams(window.location.search).get('game') || '').toUpperCase(),
    [],
  )

  const [route, setRoute] = useState<Route>(joinCode ? 'join' : 'home')
  const [gameId, setGameId] = useState<string | null>(() =>
    joinCode ? null : localStorage.getItem(LS_GAME),
  )
  const [nickname, setNickname] = useState(() => localStorage.getItem(LS_NICK) || '')

  // Limpia el parámetro de la URL para que un refresh no fuerce la pantalla de unirse.
  useEffect(() => {
    if (joinCode) window.history.replaceState({}, '', window.location.pathname)
  }, [joinCode])

  const { game, players, exists } = useGameState(gameId)

  function enterGame(id: string, nick: string) {
    localStorage.setItem(LS_GAME, id)
    localStorage.setItem(LS_NICK, nick)
    setNickname(nick)
    setGameId(id)
  }

  function leaveGame() {
    localStorage.removeItem(LS_GAME)
    setGameId(null)
    setRoute('home')
  }

  // Si la partida guardada ya no existe, vuelve al inicio.
  useEffect(() => {
    if (gameId && exists === false) leaveGame()
  }, [gameId, exists])

  if (authError) {
    return (
      <div className="screen items-center justify-center text-center">
        <p className="font-semibold text-brand-amber">
          No se pudo conectar con Firebase. Revisa la configuración.
        </p>
      </div>
    )
  }

  if (!uid) return <Loader label="Conectando…" />

  // ── En partida: el estado del juego decide la pantalla ──
  if (gameId) {
    if (!game) return <Loader label="Cargando partida…" />
    switch (game.status) {
      case 'lobby':
        return <Lobby gameId={gameId} game={game} players={players} meUid={uid} onLeave={leaveGame} />
      case 'playing':
        return <Play gameId={gameId} game={game} uid={uid} />
      case 'review':
        return <Review gameId={gameId} game={game} players={players} uid={uid} />
      case 'finished':
        return <Winners players={players} uid={uid} onExit={leaveGame} />
    }
  }

  // ── Antes de la partida ──
  switch (route) {
    case 'create':
      return <Create initialNick={nickname} onBack={() => setRoute('home')} onCreated={enterGame} />
    case 'join':
      return (
        <Join
          initialNick={nickname}
          initialCode={joinCode}
          onBack={() => setRoute('home')}
          onJoined={enterGame}
        />
      )
    default:
      return <Home onCreate={() => setRoute('create')} onJoin={() => setRoute('join')} />
  }
}
