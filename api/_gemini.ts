import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { HttpError } from './_admin.js'

// Modelo más rápido/barato. flash-lite no usa "thinking" por defecto → respuesta casi inmediata.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'

// Errores transitorios de Gemini que conviene reintentar (sobrecarga / rate-limit pasajero).
const RETRY_STATUS = new Set([429, 500, 503])
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Schema de salida: un array con un veredicto {valid, reason} por palabra.
const responseSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      valid: { type: SchemaType.BOOLEAN },
      reason: { type: SchemaType.STRING },
    },
    required: ['valid', 'reason'],
  },
}

let client: GoogleGenerativeAI | null = null
let cachedModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null
function getModel() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new HttpError(500, 'GEMINI_API_KEY no está configurada')
  if (!client) client = new GoogleGenerativeAI(key)
  if (!cachedModel) {
    // timeout por petición: si una llamada se cuelga, falla rápido y se reintenta.
    cachedModel = client.getGenerativeModel({ model: MODEL }, { timeout: 8000 })
  }
  return cachedModel
}

export interface ValidationResult {
  valid: boolean
  reason: string
}

export interface WordItem {
  category: string
  word: string
}

// Valida en UNA sola llamada todas las palabras de un jugador (batch). Devuelve
// un veredicto por palabra, EN EL MISMO ORDEN que `items`. Una request por
// jugador (en vez de una por palabra) reduce la ráfaga contra Gemini y la latencia.
export async function validateWords(
  letter: string,
  items: WordItem[],
): Promise<ValidationResult[]> {
  if (items.length === 0) return []
  const model = getModel()

  const list = items
    .map((it, i) => `${i + 1}. Categoría: ${it.category} | Palabra: ${it.word}`)
    .join('\n')
  const prompt = `Juego "Stop" en español. Valida cada palabra para SU categoría con la letra "${letter}".
Devuelve un JSON array con un objeto {valid, reason} por palabra, EN EL MISMO ORDEN y la misma cantidad (${items.length}).
Una palabra es válida (valid=true) solo si: empieza con "${letter}" (ignora acentos/mayúsculas), existe en español o es nombre propio conocido, y pertenece a su categoría.
Si no, valid=false con reason de máximo 8 palabras.
Palabras:
${list}`

  // Config por petición: determinista, sin "thinking", salida acotada al nº de palabras.
  const generationConfig = {
    temperature: 0,
    maxOutputTokens: Math.min(1200, 120 + 70 * items.length),
    responseMimeType: 'application/json',
    responseSchema,
    thinkingConfig: { thinkingBudget: 0 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any

  // Reintentos con backoff ante errores transitorios (timeout / sobrecarga / rate-limit).
  const delays = [300, 800]
  let text = ''
  let lastErr: unknown
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      })
      text = result.response.text()
      lastErr = null
      break
    } catch (err) {
      lastErr = err
      const status = (err as { status?: number })?.status
      // Reintenta en errores transitorios y también en timeouts/red (sin status).
      const retriable = !status || RETRY_STATUS.has(status)
      if (attempt < delays.length && retriable) {
        await sleep(delays[attempt])
        continue
      }
      break
    }
  }
  if (lastErr) {
    console.error('Gemini error:', lastErr)
    throw new HttpError(502, 'No se pudo validar con Gemini, intenta de nuevo')
  }

  try {
    const parsed = JSON.parse(text) as ValidationResult[]
    if (!Array.isArray(parsed) || parsed.length !== items.length) {
      throw new Error('cantidad de veredictos inesperada')
    }
    return parsed.map((p) => ({ valid: !!p.valid, reason: String(p.reason || '') }))
  } catch {
    throw new HttpError(502, 'Respuesta inesperada del validador')
  }
}
