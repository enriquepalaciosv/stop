import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

// experimentalForceLongPolling: forzamos long-polling en lugar de auto-detectarlo.
// La auto-detección a veces elige el streaming gRPC-Web, este se cae en silencio
// para algún cliente y deja de entregar los pushes del servidor hasta recargar
// (síntoma: "a unos no les inicia la ronda hasta refrescar"). Long-polling es
// robusto frente a proxies/redes/navegadores; cuesta algo de latencia, irrelevante
// para este juego.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
})
