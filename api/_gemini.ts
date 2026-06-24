import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { HttpError } from './_admin.js'

// Modelo más rápido/barato. flash-lite no usa "thinking" por defecto → respuesta casi inmediata.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'

// Errores transitorios de Gemini que conviene reintentar (sobrecarga / rate-limit pasajero).
const RETRY_STATUS = new Set([429, 500, 503])
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Config optimizada para latencia mínima: sin "thinking", salida corta, determinista.
const generationConfig = {
  temperature: 0,
  maxOutputTokens: 150,
  responseMimeType: 'application/json',
  responseSchema: {
    type: SchemaType.OBJECT,
    properties: {
      valid: { type: SchemaType.BOOLEAN },
      reason: { type: SchemaType.STRING },
    },
    required: ['valid', 'reason'],
  },
  // Desactiva el razonamiento extendido (modelos 2.5) para que sea casi instantáneo.
  thinkingConfig: { thinkingBudget: 0 },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

let client: GoogleGenerativeAI | null = null
let cachedModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null
function getModel() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new HttpError(500, 'GEMINI_API_KEY no está configurada')
  if (!client) client = new GoogleGenerativeAI(key)
  if (!cachedModel) cachedModel = client.getGenerativeModel({ model: MODEL, generationConfig })
  return cachedModel
}

export interface ValidationResult {
  valid: boolean
  reason: string
}

// Pregunta a Gemini si una palabra es válida para la categoría y empieza con la letra.
export async function validateWord(
  letter: string,
  category: string,
  word: string,
): Promise<ValidationResult> {
  const model = getModel()

  // Prompt compacto (menos tokens de entrada = menor latencia).
  const prompt = `Juego "Stop" en español. ¿La palabra es válida?
Letra: ${letter} | Categoría: ${category} | Palabra: ${word}
Es válida (valid=true) solo si: empieza con "${letter}" (ignora acentos/mayúsculas), existe en español o es nombre propio conocido, y pertenece a la categoría.
Si no, valid=false con reason de máximo 8 palabras.`

  // Hasta 3 intentos con backoff ante errores transitorios (503 sobrecarga, 429 pasajero).
  const delays = [350, 900, 1800]
  let text = ''
  let lastErr: unknown
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const result = await model.generateContent(prompt)
      text = result.response.text()
      lastErr = null
      break
    } catch (err) {
      lastErr = err
      const status = (err as { status?: number })?.status
      if (attempt < delays.length && status && RETRY_STATUS.has(status)) {
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
    const parsed = JSON.parse(text) as ValidationResult
    return { valid: !!parsed.valid, reason: String(parsed.reason || '') }
  } catch {
    throw new HttpError(502, 'Respuesta inesperada del validador')
  }
}
