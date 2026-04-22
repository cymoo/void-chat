# VOID.CHAT

[简体中文说明 / README-zh](./README-zh.md)

VOID.CHAT is a real-time chat app with a terminal-inspired look and practical moderation tools. It is designed for communities that want fast messaging, lightweight operations, and clear permission controls without a heavy setup.

![VOID.CHAT Hero Screenshot Placeholder](./docs/images/placeholder-hero.png)

> Replace image placeholders with your own screenshots later.

## Why VOID.CHAT

- **Real-time by default**: room chat and direct messages over WebSocket.
- **Built-in moderation**: platform roles, room roles, mute/disable, invite links.
- **Message workflow support**: replies, mentions, search, edit/delete, unread indicators.
- **Media-friendly**: image and file uploads with size limits.
- **Distinctive UI**: terminal/brutalist style that still stays usable on mobile.

## Product Highlights

![Room View Placeholder](./docs/images/placeholder-room.png)
![Admin Dashboard Placeholder](./docs/images/placeholder-admin.png)
![Mobile View Placeholder](./docs/images/placeholder-mobile.png)

## Quick Start

### 1) Prerequisites

- Java 21+
- Maven 3.9+
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### 2) Start backend

```bash
cd backend
cp .env.example .env
make run
```

Backend runs at `http://localhost:8000`.

### 3) Start frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Frontend runs at `http://localhost:5173` and proxies `/api`, `/chat`, `/uploads` to backend.

### 4) Open the app

Visit `http://localhost:5173`, register an account, and start a room.

## Deployment Guide (Production)

1. Prepare PostgreSQL and Redis instances.
2. Build backend JAR:
   ```bash
   cd backend
   make build
   ```
3. Build frontend static assets:
   ```bash
   cd frontend
   npm install --legacy-peer-deps
   npm run build
   ```
4. Run backend:
   ```bash
   java -jar backend/target/void-chat-*.jar
   ```
5. Serve `frontend/dist` with Nginx/CDN and reverse-proxy `/api`, `/chat`, `/uploads` to the backend service.

For environment variables and deeper production notes, see backend docs below.

## Where to find detailed docs

- **Backend details**: [backend/README.md](./backend/README.md)
- **Frontend details**: [frontend/README.md](./frontend/README.md)

## License

[MIT](./LICENSE)
