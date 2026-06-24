// Paleta de avatares para los jugadores (estilo Kahoot).
export const PLAYER_COLORS = [
  '#ef4444', // rojo
  '#3b82f6', // azul
  '#22c55e', // verde
  '#f59e0b', // ámbar
  '#a855f7', // morado
  '#ec4899', // rosa
  '#14b8a6', // teal
  '#f97316', // naranja
]

// Color determinista a partir de un id/uid (estable entre recargas).
export function colorFromId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return PLAYER_COLORS[hash % PLAYER_COLORS.length]
}

// Inicial(es) para el avatar.
export function initials(nickname: string): string {
  const clean = nickname.trim()
  if (!clean) return '?'
  return clean.slice(0, 2).toUpperCase()
}
