// Servidor de API SOLO para desarrollo local.
// Monta las mismas funciones de /api en Express para no depender de `vercel dev`.
// En producción se usan las funciones serverless de Vercel (este archivo no se despliega).
import express from 'express'
import createGame from '../api/createGame.js'
import joinGame from '../api/joinGame.js'
import startRound from '../api/startRound.js'
import validate from '../api/validate.js'
import closeRound from '../api/closeRound.js'
import finishGame from '../api/finishGame.js'

const routes: Record<string, unknown> = {
  createGame,
  joinGame,
  startRound,
  validate,
  closeRound,
  finishGame,
}

const app = express()
app.use(express.json())

for (const [name, handler] of Object.entries(routes)) {
  app.post(`/api/${name}`, (req, res) => {
    // Los handlers son compatibles con (req, res) de Express en runtime.
    ;(handler as (req: unknown, res: unknown) => unknown)(req, res)
  })
}

const PORT = Number(process.env.DEV_API_PORT) || 3001
app.listen(PORT, () => {
  console.log(`🛑 API de STOP (dev) escuchando en http://localhost:${PORT}`)
})
