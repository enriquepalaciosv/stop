// Categorías fijas del juego (en orden del wizard).
export const CATEGORIES = [
  'Nombre',
  'Apellido',
  'País o Ciudad',
  'Animal',
  'Fruta o Verdura',
  'Color',
  'Objeto o Cosa',
] as const

export type Category = (typeof CATEGORIES)[number]

// Letras jugables del alfabeto español.
// Se excluyen Ñ, K, W y X por la escasez de palabras (juego más justo).
// Edita esta lista en un solo lugar para cambiar el set de letras.
export const LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U',
  'V', 'Y', 'Z',
] as const

// Duración de cada ronda (segundos).
export const ROUND_SECONDS = 120

// Puntajes por categoría.
export const POINTS = {
  SOLE_VALID: 20, // válida y único jugador que respondió esa categoría
  UNIQUE: 10, // válida y palabra única (pero otros también respondieron)
  REPEATED: 5, // válida pero repetida con otro jugador
  NONE: 0, // vacía o inválida
} as const
