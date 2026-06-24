import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { HttpError } from './_admin.js'

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

let client: GoogleGenerativeAI | null = null
function gemini() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new HttpError(500, 'GEMINI_API_KEY no está configurada')
  if (!client) client = new GoogleGenerativeAI(key)
  return client
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
  const model = gemini().getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          valid: { type: SchemaType.BOOLEAN },
          reason: { type: SchemaType.STRING },
        },
        required: ['valid', 'reason'],
      },
    },
  })

  const prompt = `Eres el árbitro del juego "Stop" (Basta) en español.
Decide si una palabra es VÁLIDA para una categoría dada.

Letra requerida: "${letter}"
Categoría: "${category}"
Palabra del jugador: "${word}"

Criterios para que sea válida (valid = true):
1. La palabra empieza con la letra "${letter}" (ignora mayúsculas y acentos).
2. Existe en español o es un nombre propio reconocido (para Nombre, Apellido, País o Ciudad).
3. Pertenece claramente a la categoría "${category}".

Si NO cumple alguno, valid = false y explica brevemente por qué (máximo 8 palabras).
Ejemplos:
- Categoría "Animal", palabra "verde" → valid=false ("verde es un color, no un animal").
- Categoría "Animal", palabra "asdfg" → valid=false ("no es una palabra real").
- Categoría "Animal", palabra "Avestruz", letra "A" → valid=true ("animal válido con A").

Responde SOLO el JSON con los campos valid y reason.`

  let text: string
  try {
    const result = await model.generateContent(prompt)
    text = result.response.text()
  } catch (err) {
    console.error('Gemini error:', err)
    throw new HttpError(502, 'No se pudo validar con Gemini, intenta de nuevo')
  }

  try {
    const parsed = JSON.parse(text) as ValidationResult
    return { valid: !!parsed.valid, reason: String(parsed.reason || '') }
  } catch {
    throw new HttpError(502, 'Respuesta inesperada del validador')
  }
}
