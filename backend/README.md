# void-chat Backend

Real-time chat backend built with **Kotlin** on the [Colleen](https://github.com/cymoo/colleen) web framework. Features room-based group chat, direct messaging, file uploads, and admin moderation — all communicated over REST + WebSocket.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | Kotlin 2.3 / JVM 21 |
| Web Framework | Colleen 0.4.6 (REST + WebSocket) |
| Database | PostgreSQL + jOOQ 3.20 (type-safe SQL) |
| Migrations | Flyway 12 |
| Connection Pool | HikariCP 7 |
| Session Store | Redis (Jedis 5) |
| Local Cache | Caffeine (user lookups, 2-min TTL) |
| Logging | SLF4J + Logback |
| Build | Maven + Maven Shade (fat JAR) |

## Architecture

```
Controller  ──▶  Service  ──▶  Repository  ──▶  PostgreSQL
    │                │
    │ (WebSocket)    ├──▶  Redis (sessions + pub/sub)
    │                └──▶  Caffeine (user cache)
    │
    └── BearerToken param extractor (auto-injects auth)
```

**Layered design:**
- **Controllers** handle HTTP/WS routing, request parsing, and response formatting.
- **Services** contain business logic, authorization checks, and cross-cutting concerns.
- **Repositories** encapsulate jOOQ queries — no business logic.

**Real-time broadcasting** uses Redis pub/sub (`room:{roomId}` / `user:{userId}` channels), so multiple backend instances can fan out messages to their local WebSocket connections.

## Project Structure

```
backend/
├── .env.example             # All env vars with documentation
├── .env.dev                 # Dev defaults (checked in)
├── Makefile                 # Build / run / test shortcuts
├── pom.xml
└── src/
    ├── main/
    │   ├── kotlin/
    │   │   ├── Main.kt                          # Entry point, wires everything
    │   │   ├── config/
    │   │   │   ├── Env.kt                       # EnvLoader (.env file reader)
    │   │   │   ├── DatabaseConfig.kt            # HikariCP + Flyway
    │   │   │   └── RedisConfig.kt               # JedisPool factory
    │   │   ├── controller/
    │   │   │   ├── ApiController.kt             # REST: rooms, users, DMs, admin
    │   │   │   ├── AuthController.kt            # REST: register, login, logout
    │   │   │   ├── ChatController.kt            # WebSocket: /chat/{roomId}, /chat/dm
    │   │   │   ├── FileController.kt            # Static file serving
    │   │   │   └── WsPayload.kt                 # Incoming WS message schema
    │   │   ├── model/
    │   │   │   └── Models.kt                    # Domain models, sealed classes
    │   │   ├── repository/                      # jOOQ query layer (7 repos)
    │   │   ├── service/                         # Business logic (7 services)
    │   │   └── util/
    │   │       ├── BearerToken.kt               # Auth param extractor
    │   │       ├── PasswordUtils.kt             # PBKDF2-HMAC-SHA256
    │   │       └── TimeUtils.kt                 # OffsetDateTime → epoch millis
    │   └── resources/
    │       ├── db/migration/V1__Initial_schema.sql
    │       └── logback.xml
    └── test/kotlin/                             # JUnit 5 + MockK tests
```

## Getting Started

### Prerequisites

- **JDK 21+**
- **PostgreSQL 15+**
- **Redis 7+**
- **Maven 3.9+**

### Database Setup

```bash
# Create databases
psql -U postgres -c "CREATE DATABASE void_chat;"
psql -U postgres -c "CREATE DATABASE void_chat_test;"
```

Flyway runs automatically on application startup (and during `mvn compile` for jOOQ codegen).

### Configuration

Copy and customize the environment file:

```bash
cp .env.example .env
# Edit .env with your database credentials, Redis URL, etc.
```

**Load order:** `.env` → `.env.{COLLEEN_ENV}` → `.env.local`
**Priority:** System env vars > JVM system properties > `.env` files

See [`.env.example`](.env.example) for all available variables.

### Run

```bash
# Via Maven (development)
make run
# equivalent to: mvn compile exec:java

# Via fat JAR (production)
make build        # creates target/void-chat-*.jar
make run-jar      # java -jar target/void-chat-*.jar
```

The server starts on `http://localhost:8000` (or `$SERVER_PORT`).

### Initial Admin

Two ways to bootstrap the first admin:

1. **Auto-promotion**: The first user to register is automatically promoted to `super_admin`.
2. **Environment variable**: Set `INIT_ADMIN_USERNAME` and `INIT_ADMIN_PASSWORD` — the account is created/promoted to `super_admin` on startup.

## Database Schema

All messages (room + DM) store polymorphic content in a **JSONB** column keyed by `message_type`:

| message_type | content shape |
|-------------|--------------|
| `text` | `{"text": "hello world"}` |
| `image` | `{"url": "/uploads/img.png", "thumbnail": "...", "width": 800, "height": 600}` |
| `file` | `{"url": "/uploads/doc.pdf", "name": "doc.pdf", "size": 1024, "mime": "application/pdf"}` |
| `system` | `{"text": "user joined the room"}` |

An expression index on `content->>'text'` accelerates text search for `text` and `system` messages.

### Tables

| Table | Description |
|-------|------------|
| `users` | Accounts with roles (`super_admin`, `platform_admin`, `user`), moderation flags |
| `rooms` | Chat rooms with optional password protection and member limits |
| `messages` | Room messages (JSONB content, soft-delete, reply threading) |
| `room_members` | Room membership with per-room roles (`owner`, `admin`, `moderator`, `member`) |
| `private_messages` | Direct messages (JSONB content, read tracking) |
| `invite_links` | Registration invite codes (hashed, with usage limits and expiry) |
| `system_settings` | Key-value store for platform settings (e.g., registration mode) |

### Schema Changes

After modifying migration files:

```bash
make codegen   # runs Flyway migrate + jOOQ code generation
```

jOOQ generates type-safe table/field references into `target/generated-sources/`.

## REST API

All endpoints are prefixed with `/api` unless noted. Auth-protected routes require `Authorization: Bearer <token>`.

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | — | Register (accepts optional `inviteCode`) |
| `POST` | `/api/auth/login` | — | Login → returns `{token, user}` |
| `POST` | `/api/auth/logout` | ✓ | Invalidate session |
| `GET` | `/api/auth/me` | ✓ | Current user profile |
| `GET` | `/api/auth/registration-mode` | — | Platform registration mode (`open` / `invite`) |

### Rooms

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/rooms` | — | List rooms with online counts |
| `POST` | `/api/rooms` | ✓ | Create room |
| `PATCH` | `/api/rooms/{roomId}` | ✓ | Update room (owner / admin) |
| `DELETE` | `/api/rooms/{roomId}` | ✓ | Delete room (owner / admin) |

### Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/users/{userId}` | — | User profile by ID |
| `GET` | `/api/users/by-name/{username}` | — | User profile by username |
| `PATCH` | `/api/users/me` | ✓ | Update own profile |

### Direct Messages

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/dms/inbox` | ✓ | DM inbox (latest msg per conversation) |
| `GET` | `/api/dms/unread-senders` | ✓ | Unread counts grouped by sender |

### File Upload

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/upload/image` | ✓ | Upload image (≤ `MAX_IMAGE_SIZE`) |
| `POST` | `/api/upload/file` | ✓ | Upload file (≤ `MAX_FILE_SIZE`) |
| `GET` | `/uploads/{filename}` | — | Download file (static serving) |

### Admin

All admin endpoints require `platform_admin` or `super_admin` role.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/dashboard` | Users, rooms, invites, registration mode |
| `PATCH` | `/api/admin/users/{userId}/role` | Change platform role |
| `PATCH` | `/api/admin/users/{userId}/disable` | Disable/enable account |
| `PATCH` | `/api/admin/users/{userId}/mute` | Mute (room messages only) |
| `POST` | `/api/admin/invites` | Create invite link |
| `PATCH` | `/api/admin/invites/{inviteId}/revoke` | Revoke invite link |
| `PATCH` | `/api/admin/registration-mode` | Set `open` or `invite` mode |

## WebSocket Protocol

### Room Chat — `ws://host/chat/{roomId}?token=xxx`

Optional: `&roomPassword=xxx` for private rooms.

**Client → Server** (JSON with `type` discriminator):

| type | Fields | Description |
|------|--------|-------------|
| `text` | `content`, `replyToId?` | Send text message |
| `image` | `imageUrl`, `thumbnailUrl?`, `replyToId?` | Send image message |
| `file` | `fileName`, `fileUrl`, `fileSize`, `mimeType`, `replyToId?` | Send file message |
| `edit` | `messageId`, `content` | Edit own text message |
| `delete` | `messageId` | Soft-delete own message |
| `load_history` | `beforeId` | Load older messages (cursor pagination) |
| `search` | `query` | Search messages in room |
| `typing` | `isTyping` | Typing indicator |
| `private_message` | `targetUserId`, `content` | Send DM |
| `private_history` | `targetUserId`, `beforeId?` | Load DM history |
| `mark_read` | `targetUserId` | Mark DMs as read |
| `set_role` | `targetUserId`, `role` | Set user's room role |
| `kick` | `targetUserId` | Kick user from room |
| `leave` | — | Leave room |
| `update_profile` | `username?`, `avatarUrl?`, `bio?`, `status?` | Update own profile |

**Server → Client** (JSON with `type` discriminator):

| type | Description |
|------|-------------|
| `history` | Message batch + `hasMore` flag |
| `message` | New room message |
| `users` | Current online users list |
| `user_joined` | User entered room |
| `user_left` | User left room |
| `message_edited` | Message content updated |
| `message_deleted` | Message soft-deleted |
| `private_message` | Incoming DM |
| `private_history` | DM history batch |
| `unread_counts` | Updated DM unread counts |
| `typing` | Typing indicator from another user |
| `mention` | You were mentioned |
| `search_results` | Search results |
| `user_updated` | A user's profile changed |
| `role_changed` | Room role change |
| `kicked` | You were kicked |
| `error` | Error message |

### Direct Messages — `ws://host/chat/dm?token=xxx`

Standalone DM endpoint. Supports `private_message`, `private_history`, `mark_read`, and `update_profile` payloads.

## Testing

```bash
# All tests
make test

# Single test class
mvn test -Dtest=ChatServiceTest

# Single test method (glob pattern)
mvn test -Dtest="ChatServiceTest#sendTextMessage*"
```

### Test Setup

Tests require **PostgreSQL** (`void_chat_test` database) and **Redis** running locally. Connection details are read from env vars with fallback defaults:

| Variable | Default |
|----------|---------|
| `TEST_DATABASE_URL` | `jdbc:postgresql://localhost:5432/void_chat_test` |
| `TEST_DATABASE_USER` | `postgres` |
| `TEST_DATABASE_PASSWORD` | `postgres` |
| `REDIS_URL` | `redis://localhost:6379` |

Each test class gets a fresh Flyway-migrated schema with all tables truncated between runs. WebSocket tests use MockK to mock connection objects.

### Test Coverage

| Area | Test Class | Cases |
|------|-----------|-------|
| Room messages | `MessageRepositoryTest` | 12 |
| Direct messages | `PrivateMessageRepositoryTest` | 8 |
| Chat service | `ChatServiceTest` | 19 |
| Chat authorization | `ChatServiceAuthzTest` | 6 |
| Users & auth | `UserServiceTest` | 22 |
| Room CRUD | `RoomServiceTest` | 19 |
| Room authorization | `RoomServiceAuthzTest` | 2 |
| Invitations | `InvitationServiceTest` | 3 |
| Authorization rules | `AuthorizationServiceTest` | 5 |
| File service | `FileServiceTest` | 8 |
| Env loader | `EnvLoaderTest` | 10 |
| **Total** | | **114** |

## Deployment

### Build the Fat JAR

```bash
make build
# Produces target/void-chat-1.0-SNAPSHOT.jar
```

### Run in Production

```bash
# Set environment variables (or use .env file)
export COLLEEN_ENV=prod
export DATABASE_URL=jdbc:postgresql://db-host:5432/void_chat
export DATABASE_USER=app_user
export DATABASE_PASSWORD=secret
export REDIS_URL=redis://redis-host:6379
export UPLOAD_DIR=/var/data/void-chat/uploads

java -jar target/void-chat-1.0-SNAPSHOT.jar
```

### Key Production Considerations

- **Flyway** runs automatically on startup — migrations are applied before the server accepts connections.
- **Redis pub/sub** enables horizontal scaling — run multiple instances behind a load balancer (use sticky sessions or token-based WS routing).
- **Upload directory** must be writable and shared across instances (or use an object store with a reverse proxy).
- **Session TTL** defaults to 7 days — adjust `SESSION_TTL_DAYS` as needed.
- **File size limits** are enforced both at the framework level (`MAX_REQUEST_SIZE`) and per-upload type (`MAX_IMAGE_SIZE`, `MAX_FILE_SIZE`).
