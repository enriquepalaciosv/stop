import { motion } from 'framer-motion'
import { Button } from '../components/Button'

interface Props {
  onCreate: () => void
  onJoin: () => void
}

export function Home({ onCreate, onJoin }: Props) {
  return (
    <div className="screen items-center justify-center gap-10 text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14 }}
      >
        <div className="text-7xl">🛑</div>
        <h1 className="font-display text-7xl font-extrabold tracking-tight drop-shadow-lg">
          STOP
        </h1>
        <p className="mt-1 font-semibold text-white/70">
          El clásico juego de Basta / Tutti Frutti
        </p>
      </motion.div>

      <div className="w-full space-y-4">
        <Button onClick={onCreate}>🎮 Crear juego</Button>
        <Button variant="secondary" onClick={onJoin}>
          🔑 Unirse a un juego
        </Button>
      </div>
    </div>
  )
}
