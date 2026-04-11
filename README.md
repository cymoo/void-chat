# TERMINAL.CHAT — Real-time Chat Room Application

A feature-rich, real-time chat room application with a Kotlin backend and React frontend, featuring WebSocket communication, file uploads, and a distinctive terminal aesthetic.

## Project Structure

```
void-chat/
├── backend/                # Kotlin API + WebSocket server
│   ├── pom.xml
│   └── src/main/kotlin/
│       ├── Main.kt
│       ├── config/         # Database configuration
│       ├── controller/     # REST & WebSocket controllers
│       ├── model/          # Data models
│       ├── repository/     # jOOQ database repositories
│       ├── service/        # Business logic
│       └── util/           # Utilities
├── frontend/               # React SPA
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── api/            # HTTP client & TypeScript types
│   │   ├── stores/         # Zustand state management
│   │   ├── hooks/          # WebSocket hook
│   │   ├── components/     # React components
│   │   ├── pages/          # Page-level components
│   │   └── lib/            # Utilities
│   └── tests/
│       ├── unit/           # Vitest unit tests
│       └── e2e/            # Playwright E2E tests
├── uploads/                # Uploaded files
└── chat.db                 # SQLite database (auto-created)
```

## Features

- **Real-time chat** via WebSocket with reconnection
- **Multiple rooms** with private (password-protected) room support
- **Authentication** (register/login with token-based sessions)
- **Invitation links** with registration mode support (`open` / `invite_only`)
- **Message features**: edit, delete, reply-to, @mentions, search
- **File sharing**: images (5MB) and files (20MB) with upload
- **Private messages** (DMs) between users
- **User profiles** with avatar, bio, and status
- **Role management**:
  - Platform roles: `super_admin`, `platform_admin`, `user`
  - Room roles: `owner`, `admin`, `moderator`, `member`
  - Centralized authorization checks for room moderation actions
- **Admin dashboard** for user-role management and room overview
- **User moderation**: disable account, mute room messaging (with confirmations)
- **Admin access control**: invite management + registration mode switching
- **Terminal aesthetic**: IBM Plex Mono, green-on-black, ASCII decorations

## Technology Stack

| Layer | Tech |
|-------|------|
| Backend | Kotlin, Colleen framework, jOOQ, SQLite, Flyway |
| Frontend | React, TypeScript, Vite, Zustand, Tailwind CSS |
| Testing | Vitest (unit), Playwright (E2E) |

## Getting Started

### Prerequisites

- Java 21+, Maven 3.6+
- Node.js 20+, npm 10+

### Backend

```bash
cd backend
mvn clean compile
mvn exec:java
# Server runs on http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
# Dev server runs on http://localhost:5173 (proxies API to :8000)
```

### Testing

```bash
cd frontend
npm test          # Vitest unit tests
npm run test:e2e  # Playwright E2E tests (requires backend running)
```

### Production Build

```bash
cd frontend
npm run build     # Output in frontend/dist/
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user (optional `inviteCode`) |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| GET | `/api/auth/registration-mode` | Public registration mode |
| GET | `/api/rooms` | List rooms |
| POST | `/api/rooms` | Create room |
| PATCH | `/api/rooms/{roomId}` | Update room (owner or platform admin) |
| DELETE | `/api/rooms/{roomId}` | Delete room (owner or platform admin) |
| GET | `/api/admin/dashboard` | Admin dashboard data (users + rooms + invites + mode) |
| PATCH | `/api/admin/users/{userId}/role` | Update platform role |
| PATCH | `/api/admin/users/{userId}/disable` | Disable / enable user |
| PATCH | `/api/admin/users/{userId}/mute` | Mute / unmute user room messaging |
| POST | `/api/admin/invites` | Create invite link |
| PATCH | `/api/admin/invites/{inviteId}/revoke` | Revoke invite link |
| PATCH | `/api/admin/registration-mode` | Update registration mode |
| POST | `/api/upload/image` | Upload image |
| POST | `/api/upload/file` | Upload file |
| PATCH | `/api/users/me` | Update profile |
| WS | `/chat/{roomId}?token=...` | WebSocket chat |

## Design Philosophy

Terminal aesthetic: IBM Plex Mono font, Bebas Neue headers, green (#00ff41) on dark backgrounds, sharp borders, scanline effects, ASCII decorations.

## License

This project follows the same license as the Colleen framework.
