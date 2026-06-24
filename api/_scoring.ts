// Lógica de puntaje pura (sin dependencias de Firebase), fácil de testear.

export const POINTS = {
  SOLE_VALID: 20,
  UNIQUE: 10,
  REPEATED: 5,
  NONE: 0,
}

export interface AnswerInput {
  uid: string
  answers: Record<string, { word: string; status: string }>
}

export interface ScoreResult {
  scoreByCategory: Record<string, number>
  roundScore: number
}

// Normaliza una palabra para comparar unicidad (minúsculas, sin acentos, sin espacios extra).
export function normalize(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Calcula el puntaje de cada jugador para una ronda.
// Reglas por categoría (solo cuentan respuestas con status === 'valid'):
//   - único jugador que respondió válido      → 20
//   - válida y palabra única (otros también)  → 10
//   - válida pero repetida con otro jugador   → 5
//   - vacía / inválida                         → 0
export function computeScores(
  inputs: AnswerInput[],
  categories: string[],
): Record<string, ScoreResult> {
  const results: Record<string, ScoreResult> = {}
  for (const inp of inputs) {
    results[inp.uid] = { scoreByCategory: {}, roundScore: 0 }
  }

  for (const cat of categories) {
    // Recolecta palabras válidas normalizadas por jugador para esta categoría.
    const valid: { uid: string; norm: string }[] = []
    for (const inp of inputs) {
      const a = inp.answers?.[cat]
      if (a && a.status === 'valid' && a.word.trim()) {
        valid.push({ uid: inp.uid, norm: normalize(a.word) })
      }
    }

    // Conteo de cuántos jugadores válidos comparten cada palabra normalizada.
    const wordCount = new Map<string, number>()
    for (const v of valid) {
      wordCount.set(v.norm, (wordCount.get(v.norm) ?? 0) + 1)
    }

    for (const inp of inputs) {
      let points = POINTS.NONE
      const mine = valid.find((v) => v.uid === inp.uid)
      if (mine) {
        if (valid.length === 1) {
          points = POINTS.SOLE_VALID
        } else if ((wordCount.get(mine.norm) ?? 0) > 1) {
          points = POINTS.REPEATED
        } else {
          points = POINTS.UNIQUE
        }
      }
      results[inp.uid].scoreByCategory[cat] = points
      results[inp.uid].roundScore += points
    }
  }

  return results
}
