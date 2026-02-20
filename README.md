# Vellum

A collaborative infinite whiteboard built with React, Konva, and Firebase.

**Deployed URL:** https://vellum-6f172.web.app

---

## Local Development (Docker)

Prerequisite: Docker Desktop installed and running.

Start the app:

```bash
docker compose up --build
```

Open: http://localhost:5173

Stop the app:

```bash
docker compose down
```

---

## Setup

### Prerequisites

- Node.js 18+
- npm

### 1. Clone and install

```bash
git clone <repo-url>
cd Vellum
npm install
```

### 2. Configure environment

Create a `.env.local` file in the project root with your Firebase config:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
```

Optional (for local emulators):

```env
VITE_USE_FIREBASE_EMULATORS=true
```

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:5173

### 4. Build and deploy

```bash
npm install
cd functions && npm install && cd ..
npm run build
firebase deploy
```

**AI Agent (Cloud Functions):** Set the OpenAI API key before deploying functions:

```bash
firebase functions:secrets:set OPENAI_API_KEY
# Enter your OpenAI API key when prompted
firebase deploy --only functions
```

---

## Architecture

### Stack

- **React 19** + **TypeScript** + **Vite** – UI and build
- **Konva** / **react-konva** – Canvas rendering (infinite pan/zoom, shapes)
- **Firebase** – Auth, Firestore (boards, objects, comments), Realtime DB (presence, cursors)

### Key directories

| Path | Purpose |
|------|---------|
| `src/pages/` | Route-level components (Dashboard, BoardPage, Login) |
| `src/components/Canvas/` | Whiteboard: InfiniteCanvas, ObjectLayer, toolbar, overlays |
| `src/services/` | Firebase: boards, objects, comments, presence, invites |
| `src/utils/coordinates.ts` | Coordinate conversion (stage ↔ canvas) |
| `src/types/` | Shared types (BoardObject, Viewport, etc.) |

### Canvas model

- **Infinite canvas** – Pan and zoom with mouse/trackpad. Viewport state (x, y, scale) lives in React.
- **Canvas coordinates** – All objects stored in Firestore use canvas-space (x, y). Conversion happens once at creation. See `docs/COORDINATES.md`.
- **Object types** – Sticky notes, shapes (rectangle, circle, triangle, line), text, emoji, comments.

### Data flow

1. **Boards** – Firestore `boards` collection. Members in `boards/{id}/members`.
2. **Objects** – Firestore `boards/{id}/objects`. Real-time via `subscribeToObjects`.
3. **Comments** – Firestore `boards/{id}/comments`. Position stored in canvas coords.
4. **Presence** – Realtime DB for live cursors and user presence.

---

## 🧪 Testing

Vellum uses a comprehensive testing strategy:

- **Unit Tests**: Vitest for testing individual functions and components
- **E2E Tests**: Playwright for end-to-end user flows across Chrome, Firefox, and Safari
- **Local Testing**: Firebase Emulators for testing without hitting production

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Start Firebase emulators
npm run emulators
```

**First-time E2E:** Install Playwright browsers once with `npm run test:e2e:install` (or `npx playwright install`).

### Test Coverage

- Object data structure validation
- User authentication flows
- Landing page functionality
- Multi-browser compatibility
