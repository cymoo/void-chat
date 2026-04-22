# void-chat Frontend

React + TypeScript frontend for VOID.CHAT. It provides the chat UI, admin pages, profile flows, and WebSocket-driven real-time interactions.

## Stack

| Area | Tech |
|---|---|
| Framework | React 19 + TypeScript |
| Build Tool | Vite 8 |
| State | Zustand |
| Routing | React Router |
| Styling | Tailwind CSS + custom terminal-style CSS |
| Testing | Vitest + Testing Library + Playwright |

## Quick Start

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

App runs at `http://localhost:5173`.

In development, Vite proxy forwards:

- `/api` -> `http://localhost:8000`
- `/chat` (WebSocket) -> `ws://localhost:8000`
- `/uploads` -> `http://localhost:8000`

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Type-check and build production assets |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run Playwright end-to-end tests |

## Project Structure

```text
frontend/
├── src/
│   ├── api/          # API client, response types
│   ├── components/   # Reusable UI components
│   ├── hooks/        # WebSocket and behavior hooks
│   ├── lib/          # Utilities (markdown, helpers, cross-component events)
│   ├── pages/        # Route-level pages
│   ├── stores/       # Zustand stores (auth/chat/room/ui)
│   ├── styles/       # Style layers
│   ├── App.tsx
│   └── main.tsx
└── tests/
    ├── unit/
    └── e2e/
```

## Key Frontend Behaviors

- **Token auth flow**: `authToken` is read from `localStorage` and added to API requests automatically.
- **Realtime chat**: client maintains room and DM channels via WebSocket with reconnection strategy.
- **Message rendering**: supports text/image/file/system message types.
- **Markdown safety**: markdown rendering uses `marked` + `DOMPurify`.
- **State isolation**: auth/chat/room/ui are split into focused Zustand stores.

## Build & Deploy

```bash
cd frontend
npm install --legacy-peer-deps
npm run build
```

The output is generated to `frontend/dist/`.

Deploy `dist/` to any static host (Nginx, CDN, object storage + CDN), and ensure reverse proxy routes `/api`, `/chat`, `/uploads` to the backend service.

## Related Docs

- Project overview: [`../README.md`](../README.md)
- Backend details: [`../backend/README.md`](../backend/README.md)
