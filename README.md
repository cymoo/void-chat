# VOID.CHAT

[简体中文说明 / README-zh](./README-zh.md)

VOID.CHAT is a real-time chat platform with a terminal-inspired interface, room/DM workflows, and practical moderation controls. It is built for teams and communities that want fast interaction, clear permissions, and a deployment model they can fully own.

![VOID.CHAT Hero Screenshot Placeholder](./docs/images/placeholder-hero.png)

> Replace image placeholders with your own screenshots later.

## Why VOID.CHAT

- **Real-time by default**: room chat and direct messages over WebSocket.
- **Built-in moderation**: platform roles, room roles, mute/disable, invite links.
- **Message workflow support**: replies, mentions, search, edit/delete, unread indicators.
- **Media-friendly**: image and file uploads with size limits.
- **Invite virtual celebrities**: bring configurable AI personas into a room for themed interaction.
- **Distinctive UI**: terminal/brutalist style that still stays usable on mobile.

## Product Highlights

![Room View Placeholder](./docs/images/placeholder-room.png)
![Admin Dashboard Placeholder](./docs/images/placeholder-admin.png)
![Mobile View Placeholder](./docs/images/placeholder-mobile.png)

### Designed for actual community operations

- Create public or protected rooms, adjust member limits, and manage roles per room.
- Use invite-based registration when you want controlled onboarding.
- Keep admin actions centralized through a dashboard (roles, mute/disable, invite links).
- Support both quick synchronous chat and longer conversation threads with search.

### Persona-enabled chat

VOID.CHAT supports inviting AI personas into specific rooms. This makes it easy to run role-play sessions, themed communities, or interactive Q&A-style spaces with "virtual celebrity" participants while still keeping moderation in your control.

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
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` and proxies `/api`, `/chat`, `/uploads` to backend.

### 4) Open the app

Visit `http://localhost:5173`, register an account, and start a room.

## Deployment Guide (Production)

### Option A — Docker Compose (recommended)

The easiest way to run everything in one command:

```bash
# 1. Clone the repo and enter it
git clone <repo-url> && cd void-chat

# 2. Create your environment file
cp .env.example .env
# Edit .env — at minimum set DB_PASSWORD and INIT_ADMIN_PASSWORD

# 3. Build images and start all services
docker compose up -d --build
```

This starts four services: **PostgreSQL**, **Redis**, **backend** (Kotlin), and **frontend** (nginx).  
The app is available at `http://localhost` (or whatever `HTTP_PORT` you set).

**Useful commands:**
```bash
docker compose logs -f backend    # stream backend logs
docker compose restart backend    # restart after config change
docker compose down -v            # stop and remove volumes (⚠ deletes data)
```

> **Schema updates** — Flyway runs automatically on backend startup; no manual migration step needed.

> **Persona engine** — set `PERSONA_LLM_API_KEY` in `.env` to enable the LLM bot feature.

### Option B — Manual

1. Prepare PostgreSQL and Redis instances.
2. Build backend JAR:
   ```bash
   cd backend
   make build
   ```
3. Build frontend static assets:
   ```bash
   cd frontend
   npm install
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
