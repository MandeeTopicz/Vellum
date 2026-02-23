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
VITE_OCR_API_URL=http://127.0.0.1:5001/vellum-6f172/us-central1/api
```

Optional (handwriting OCR): `VITE_OCR_API_URL` overrides the OCR API base. Defaults to Cloud Functions URL. For emulators, set to `http://127.0.0.1:5001/vellum-6f172/us-central1/api`.

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

**If auth works locally but not on the deployed URL:**

1. **OAuth redirect URI** – [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your OAuth 2.0 Client ID (Web client). In **Authorized redirect URIs**, add `https://vellum-6f172.firebaseapp.com/__/auth/handler`. In **Authorized JavaScript origins**, add `https://vellum-6f172.web.app` and `https://vellum-6f172.firebaseapp.com`.

2. **Firebase Authorized Domains** – [Firebase Console](https://console.firebase.google.com/) → Authentication → Settings → Authorized domains. Ensure: `vellum-6f172.web.app`, `vellum-6f172.firebaseapp.com`, `localhost`.

3. **Env vars at build time** – Firebase Hosting serves prebuilt `dist`. Vite inlines `VITE_*` at build time; `.env.local` must exist when running `npm run build`.

4. **COOP/COEP headers** – `firebase.json` hosting headers are empty. If you add custom headers, avoid `Cross-Origin-Opener-Policy` or `Cross-Origin-Embedder-Policy` values that block auth popups/redirects.

5. **Check the browser console** on the deployed URL after attempting sign-in. Errors like `redirect_uri_mismatch` or `unauthorized_domain` will be more descriptive. The Login page also surfaces redirect errors when `getRedirectResult` fails after returning from Google.

**AI Agent (Cloud Functions):** Set the OpenAI API key before deploying functions:

```bash
firebase functions:secrets:set OPENAI_API_KEY
# Enter your OpenAI API key when prompted
firebase deploy --only functions
```

**API function (handwriting, auth-test):** To deploy only the HTTP API:

```bash
firebase deploy --only functions:api
```

**Google Sign-In (production):** If you see `redirect_uri_mismatch`:

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your OAuth 2.0 Client ID (Web client).
2. **Authorized redirect URIs:** Add `https://vellum-6f172.firebaseapp.com/__/auth/handler`.
3. **Authorized JavaScript origins:** Add `https://vellum-6f172.web.app` and `https://vellum-6f172.firebaseapp.com`.

**Firebase Storage CORS (file upload from localhost):** If uploads fail with "blocked by CORS policy", apply CORS to the Storage bucket:

1. Install [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (includes `gsutil`).
2. Authenticate: `gcloud auth login`.
3. Set the project: `gcloud config set project vellum-6f172`.
4. Find your bucket name (check `.env.local` for `VITE_FIREBASE_STORAGE_BUCKET`, or run `gcloud storage buckets list --project=vellum-6f172`).
5. Apply CORS (use the bucket from step 4; newer projects use `firebasestorage.app`):
   ```bash
   gsutil cors set storage.cors.json gs://vellum-6f172.firebasestorage.app
   ```
   If that fails with 404, try the legacy bucket: `gs://vellum-6f172.appspot.com`

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
