import { adminDb } from './_admin.js'
import { normalize } from './_scoring.js'
import { validateWord } from './_gemini.js'

export interface CatAnswer {
  word: string
  status: 'empty' | 'validating' | 'valid' | 'invalid'
  reason?: string
}

// Valida una palabra para una categoría/letra y devuelve su status final.
// Lógica compartida por el endpoint /api/validate y la revalidación al cerrar
// la ronda: chequeo de vacío, chequeo de letra inicial, cache en validations/
// y, si hace falta, consulta a Gemini.
export async function validateCategory(
  letter: string,
  category: string,
  rawWord: string,
): Promise<CatAnswer> {
  const word = String(rawWord || '').trim().slice(0, 40)

  if (!word) {
    return { word: '', status: 'empty' }
  }
  if (normalize(word).charAt(0) !== normalize(letter).charAt(0)) {
    return { word, status: 'invalid', reason: `No empieza con la letra ${letter}` }
  }

  const norm = normalize(word)
  const cacheKey = `${letter}_${category}_${norm}`.replace(/[/]/g, '-')
  const cacheRef = adminDb().doc(`validations/${cacheKey}`)
  const cached = await cacheRef.get()

  let valid: boolean
  let reason: string
  if (cached.exists) {
    const c = cached.data()!
    valid = !!c.valid
    reason = c.reason || ''
  } else {
    const v = await validateWord(letter, category, word)
    valid = v.valid
    reason = v.reason
    await cacheRef.set({ letter, category, norm, valid, reason })
  }

  return valid
    ? { word, status: 'valid' }
    : { word, status: 'invalid', reason: reason || 'No es válida para la categoría' }
}
