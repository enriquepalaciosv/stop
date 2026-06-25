import { adminDb } from './_admin.js'
import { normalize } from './_scoring.js'
import { validateWords, type WordItem } from './_gemini.js'

export interface CatAnswer {
  word: string
  status: 'empty' | 'validating' | 'valid' | 'invalid'
  reason?: string
}

// Valida en bloque las palabras de un jugador y devuelve un CatAnswer por entrada,
// EN EL MISMO ORDEN que `entries`. Chequea vacío y letra inicial localmente, usa la
// caché de validations/ por palabra y agrupa los faltantes en UNA sola llamada a
// Gemini (validateWords). Compartido por la revalidación al cerrar la ronda.
export async function validateAnswers(
  letter: string,
  entries: WordItem[],
): Promise<CatAnswer[]> {
  const results: CatAnswer[] = new Array(entries.length)
  // Palabras que no resolvimos localmente ni por caché → irán a Gemini en batch.
  const toAsk: { idx: number; norm: string; cacheRef: FirebaseFirestore.DocumentReference; item: WordItem }[] = []

  for (let i = 0; i < entries.length; i++) {
    const category = entries[i].category
    const word = String(entries[i].word || '').trim().slice(0, 40)

    if (!word) {
      results[i] = { word: '', status: 'empty' }
      continue
    }
    if (normalize(word).charAt(0) !== normalize(letter).charAt(0)) {
      results[i] = { word, status: 'invalid', reason: `No empieza con la letra ${letter}` }
      continue
    }

    const norm = normalize(word)
    const cacheKey = `${letter}_${category}_${norm}`.replace(/[/]/g, '-')
    const cacheRef = adminDb().doc(`validations/${cacheKey}`)
    const cached = await cacheRef.get()
    if (cached.exists) {
      const c = cached.data()!
      results[i] = c.valid
        ? { word, status: 'valid' }
        : { word, status: 'invalid', reason: c.reason || 'No es válida para la categoría' }
    } else {
      toAsk.push({ idx: i, norm, cacheRef, item: { category, word } })
    }
  }

  if (toAsk.length) {
    const verdicts = await validateWords(
      letter,
      toAsk.map((t) => t.item),
    )
    await Promise.all(
      toAsk.map(async (t, k) => {
        const v = verdicts[k]
        await t.cacheRef.set({
          letter,
          category: t.item.category,
          norm: t.norm,
          valid: v.valid,
          reason: v.reason,
        })
        results[t.idx] = v.valid
          ? { word: t.item.word, status: 'valid' }
          : { word: t.item.word, status: 'invalid', reason: v.reason || 'No es válida para la categoría' }
      }),
    )
  }

  return results
}
