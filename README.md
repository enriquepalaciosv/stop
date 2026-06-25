# 🛑 STOP

Juego web multijugador en tiempo real, optimizado para móvil (UX estilo Kahoot).
Crea o únete a partidas, juega rondas por letra aleatoria del alfabeto español sin
repetir, escribe palabras por categoría en un wizard, y **Gemini** valida cada palabra
(que exista y pertenezca a la categoría).

## Stack

- **Frontend:** Vite + React + TypeScript (SPA), Tailwind CSS, framer-motion.
- **Tiempo real:** Firebase Firestore (suscripciones `onSnapshot`).
- **Auth:** Firebase Anonymous Auth (apodo + uid estable).
- **Validación:** Google Gemini, detrás de funciones serverless de Vercel
  (`/api/*`) para no exponer la API key.
- **Despliegue:** Vercel.

## Cómo funciona

- El estado de cada partida vive en `games/{codigo}` (`status`: `lobby` → `playing`
  → `review` → `finished`). Todos los clientes navegan en sincronía según `status`.
- Las **escrituras sensibles** (validar palabras, elegir letra, puntuar, finalizar)
  pasan por funciones serverless con **Firebase Admin** y verificación de token, para
  evitar trampas. El cliente solo lee en tiempo real y actualiza su presencia.
- Las reglas de Firestore (`firestore.rules`) impiden leer las respuestas ajenas
  durante la ronda; se abren al pasar a `review`/`finished`.

### Puntaje por categoría

| Situación                                          | Puntos |
| -------------------------------------------------- | ------ |
| Válida y único jugador que respondió la categoría  | 20     |
| Válida y palabra única (otros también respondieron) | 10     |
| Válida pero repetida con otro jugador              | 5      |
| Vacía o inválida                                   | 0      |

Solo quien tiene **todas** sus palabras válidas puede presionar **STOP**, que corta la
ronda al instante para todos. La ronda también termina a los **2 minutos**.

## Configuración

### 1. Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com).
2. **Authentication** → habilita el proveedor **Anónimo**.
3. **Firestore Database** → crea la base de datos.
4. Despliega las reglas:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add        # selecciona tu proyecto
   firebase deploy --only firestore:rules
   ```
5. **Configuración del proyecto → Apps web**: copia el config web (para las `VITE_*`).
6. **Configuración → Cuentas de servicio → Generar nueva clave privada**: descarga el
   JSON (para `FIREBASE_SERVICE_ACCOUNT`).

### 2. Gemini

Crea una API key en [Google AI Studio](https://aistudio.google.com/apikey).

### 3. Variables de entorno

Copia `.env.example` a `.env` y rellénalo:

```bash
cp .env.example .env
```

- `VITE_FIREBASE_*` — config web (pública).
- `GEMINI_API_KEY` — secreta (solo servidor).
- `GEMINI_MODEL` — opcional (default `gemini-2.0-flash`).
- `FIREBASE_SERVICE_ACCOUNT` — el JSON del service account **en una sola línea**.

## Desarrollo local

Las funciones `/api` necesitan el entorno de Vercel. Usa **un solo comando**:

```bash
npm install
npm i -g vercel        # si no lo tienes
vercel dev             # sirve la app + las funciones /api en http://localhost:3000
```

> `npm run dev` (Vite solo) sirve la UI pero **no** las funciones `/api`; usa `vercel dev`
> para probar el juego completo.

Prueba el flujo en 2 pestañas: crear → unirse → iniciar → jugar → STOP → review →
siguiente letra → finalizar → ganadores.

### Otros scripts

```bash
npm run build       # typecheck (tsc) + build de producción
npm run typecheck   # typecheck de app + funciones /api
```

## Despliegue en Vercel

1. Importa el repo en Vercel (framework detectado: **Vite**).
2. En **Settings → Environment Variables** agrega TODAS las variables del `.env`
   (las `VITE_*` y las secretas `GEMINI_API_KEY`, `GEMINI_MODEL`, `FIREBASE_SERVICE_ACCOUNT`).
3. Deploy. El `vercel.json` ya enruta el SPA y las funciones `/api`.

> La `GEMINI_API_KEY` y el service account **nunca** llegan al bundle del cliente:
> solo se usan dentro de `/api/*`.
