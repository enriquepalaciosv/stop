# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**STOP** (a.k.a. "Basta") — a mobile-first, real-time multiplayer word game (Kahoot-style UX) in Spanish. Players join a room by code, each round reveals a random Spanish letter, everyone fills one word per category in a wizard, and **Google Gemini** validates each word (exists + belongs to its category). Whoever has filled in all categories can press STOP to end the round for everyone (validity is decided at close, not before); rounds also auto-close on the timer.

## Commands

```bash
# Local dev — two interchangeable ways to serve the SPA + /api functions:
vercel dev          # closest to prod: serves UI + /api on http://localhost:3000
npm run dev         # alternative: Vite (5173) + Express API (dev/server.ts, 3001), proxied via vite.config.ts

npm run typecheck   # tsc for app (tsconfig.json) AND functions (api/tsconfig.json) — run this to validate
npm run build       # typecheck + production build
npm run lint        # alias for tsc --noEmit (no ESLint configured)
```

There is **no test runner** configured. `api/_scoring.ts` is written as a pure, dependency-free module specifically so its scoring logic is unit-testable, but no tests exist yet.

Requires a `.env` (copy `.env.example`): `VITE_FIREBASE_*` (public web config), `GEMINI_API_KEY` + optional `GEMINI_MODEL` (server-only), and `FIREBASE_SERVICE_ACCOUNT` (the service-account JSON on a single line). See README.md for the full Firebase/Gemini/Vercel setup.

## Architecture

Two halves share one Firestore database:
- **`src/`** — Vite + React + TS SPA (Tailwind, framer-motion). **Reads only**, via `onSnapshot`.
- **`api/`** — Vercel serverless functions (Firebase Admin SDK). **All writes** go here.

### Anti-cheat is the central design constraint

Every sensitive mutation (create/join game, pick letter, save words, validate, score, finish) is a POST to `/api/*` that verifies the caller's Firebase ID token (`requireAuth` in `api/_admin.ts`) and writes with the Admin SDK. The browser never writes game/answer/validation docs directly — `firestore.rules` enforces `write: false` on those collections, and **hides other players' answers** until the game reaches `review`/`finished`. The only client-side writes allowed are a player updating their own presence/nickname (never `totalScore`).

When adding a feature that changes game state, it almost always means a **new `api/*.ts` handler** (wrapped in `postHandler`), not a client-side Firestore write.

### Game state machine

The whole game is driven by `games/{CODE}.status`: `lobby → playing → review → finished`. `src/App.tsx` is a `switch` on that status — clients navigate in lockstep purely by reading the game doc. There is no per-screen routing beyond pre-game (`home`/`create`/`join`). The game code is the Firestore doc id (uppercase, 4 chars from a non-ambiguous alphabet — see `CODE_ALPHABET`).

Firestore layout:
```
games/{CODE}                                  # the game doc (status, currentLetter, timers, scoring locks…)
games/{CODE}/players/{uid}                     # presence, color, totalScore
games/{CODE}/rounds/{roundIndex}/answers/{uid} # one doc per player per round
validations/{letter_category_normword}         # cached Gemini verdicts (shared across all games)
```

### Real-time delivery (and its safety net)

Firestore streaming (gRPC-Web) silently dies for some clients on certain networks/proxies, causing the classic "the round doesn't start for me until I refresh" bug. Two defenses, **keep both**:
1. `src/firebase.ts` forces `experimentalForceLongPolling: true` (not auto-detect, which guessed wrong and stuck on a broken stream).
2. `useGameState.ts` and `useAnswers.ts` run a `setInterval` poll (`getDoc`/`getDocs`, `POLL_MS = 2500`, only while the tab is visible) on top of `onSnapshot`, so state reconciles within seconds regardless of transport. The same `resync` also fires on `focus`/`online`/`visibilitychange`.

### Round close & scoring flow (`api/_round.ts` — the trickiest code)

`closeRoundAndScore` deliberately validates with Gemini **before** marking the round closed, so a transient Gemini failure never strands a round in `review` with no scores:
1. **Atomic lock** (`scoring`/`scoringStartedAt`, TTL `SCORING_LOCK_TTL_MS`): exactly one caller proceeds; others no-op. Round is still `playing` at this point.
2. **Authoritative re-validation**: words are saved as plain text during the round (`saveAnswers`, status `validating`); here every word gets one batched Gemini call per player via `validateAnswers`.
3. **Final atomic batch**: only now set `status: 'review'`, `scored: true`, write validated answers + per-category scores + increment each player's `totalScore`.
- On error: release the lock and set `closeFailedAt` (round stays `playing`, recoverable). Clients then show a "Reintentar calificación" button → `closeRound(reason='retry')`.

`closeRound.ts` distinguishes `reason`: `'stop'` requires the caller to have all words filled and opens a brief `CLOSING_GRACE_MS` window (so everyone flushes last words) before scoring; `'timeout'`/`'retry'` close immediately. Any client can trigger close (timer expiry, STOP, or retry) — the lock makes it idempotent. `startRound.ts` picks an unused letter (game ends when none remain), and `finishGame.ts` scores any in-flight round before setting `finished`.

### Validation pipeline (`api/_validate.ts` + `api/_gemini.ts`)

Per word: reject empty / wrong-first-letter locally → check the `validations/` cache → batch the rest into **one Gemini call per player** (`validateWords`, deterministic `temperature: 0`, `thinkingBudget: 0`, JSON schema output, retries on 429/500/503/timeout). Verdicts are cached so repeated words across games are free. Scoring itself (`api/_scoring.ts`) is pure: 20 sole-valid / 10 valid-unique / 5 valid-repeated / 0 empty-or-invalid, comparing words via `normalize()` (lowercase, strip accents).

## Gotchas

- **Duplicated constants must stay in sync**: `src/lib/constants.ts` and `api/_constants.ts` independently define `CATEGORIES`, `LETTERS`, `ROUND_SECONDS`. Edit both. (`Ñ/K/W/X` are intentionally excluded from `LETTERS`.)
- `ROUND_SECONDS` is currently **60** in the code (README/older notes may say 120/2 min — trust the code).
- The default Gemini model in `api/_gemini.ts` is `gemini-2.5-flash-lite` (README may list a different default; `GEMINI_MODEL` env overrides it).
- API handlers are POST-only and authenticated; the client calls them through the typed wrapper in `src/lib/api.ts`, which attaches the ID token. Add new endpoints there too.
- `dev/server.ts` (Express) is **dev-only** and not deployed; it just mounts the same handlers so `npm run dev` works without `vercel dev`. New `api/*` handlers used in dev must be registered in its `routes` map.
- Secret-protected rooms exist in the backend but the UI field is hidden (`SHOW_SECRET_FIELD = false`).
