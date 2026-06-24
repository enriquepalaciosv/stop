import { useEffect, useState } from 'react'

// Cuenta regresiva en segundos hasta endMs (timestamp en milisegundos).
// Devuelve los segundos restantes (>= 0).
export function useCountdown(endMs: number | null): number {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    endMs ? Math.max(0, Math.ceil((endMs - Date.now()) / 1000)) : 0,
  )

  useEffect(() => {
    if (!endMs) {
      setSecondsLeft(0)
      return
    }
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((endMs - Date.now()) / 1000)))
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [endMs])

  return secondsLeft
}
