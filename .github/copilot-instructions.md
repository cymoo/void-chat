# Copilot Instructions — void-chat

## Build & Run

### Backend (Kotlin / Maven)

```bash
cd backend
mvn compile exec:java       # Build and run (port 8000)
mvn test                    # Run all tests
mvn test -Dtest=UserServiceTest                    # Single test class
mvn test -Dtest="UserServiceTest#register creates*" # Single test method (glob)
```

A `Makefile` is available: `make run`, `make test`, `make build`, `make codegen`.

### Frontend (React / Vite)

```bash
cd frontend
npm install --legacy-peer-deps   # Required due to eslint peer dep conflicts
npm run dev                      # Dev server on :5173 (proxies /api, /chat, /uploads to :8000)
npm run build                    # TypeScript check + production build
npm run lint                     # ESLint
npm test                         # Vitest unit tests
npm test -- --run                # Vitest without watch mode
npm test -- MessageItem          # Run tests matching a filename
npm run test:e2e                 # Playwright E2E (requires backend running)
```

## Architecture

**Backend** — Kotlin on the **Colleen** framework (a lightweight custom web framework by `cymoo`, `io.github.cymoo.colleen:0.4.5`). Not a well-known framework; refer to its API when in doubt. Routes use `@Controller`, `@Get`, `@Post`, `@Patch`, `@Delete`, `@Ws` annotations.

**Frontend** — React 19 + TypeScript + Vite. State management via **Zustand** stores. Real-time communication via a custom `useWebSocket` hook with exponential-backoff reconnection. Styling uses **Tailwind CSS** plus a large custom CSS layer in `src/index.css` for the terminal/brutalist aesthetic.

**Database** — PostgreSQL accessed through **jOOQ** (type-safe SQL DSL). Schema managed by **Flyway** migrations in `backend/src/main/resources/db/migration/`. After schema changes, regenerate jOOQ sources with `make codegen`. Connection pooling via HikariCP (pool size 10).

**Auth** — Token-based sessions stored in **Redis** (`SessionService` with Jedis, 7-day TTL). Tokens sent as `Authorization: Bearer <token>` headers (REST) or `?token=` query params (WebSocket). The custom `BearerToken` param extractor auto-injects from the header in controller method signatures.

**WebSocket** — All real-time chat goes through `ChatController` at `/chat/{roomId}`. Messages are JSON with a `type` discriminator field. `ChatService` manages room connections, broadcasting, presence, and permissions using concurrent collections with fine-grained per-(roomId, userId) locking. Broadcasting uses **Redis pub/sub** for multi-instance readiness — each instance publishes to `room:{roomId}` or `user:{userId}` channels and subscribes to deliver to local connections.

**Caching** — `UserRepository` uses a **Caffeine** local cache (1000 entries, 2-minute TTL) for `findById()` lookups. This eliminates redundant DB queries on the per-message `roomMessageBlockReason()` hot path. Cache is invalidated on role, disable, mute, and profile updates.

## Key Conventions

### Backend (Kotlin)

- **Layered architecture**: Controller → Service → Repository. Controllers handle HTTP/WS concerns; services contain business logic; repositories do jOOQ queries.
- **Sealed classes** for type-safe unions: `ChatMessage` (Text/Image/File/System) and `WsEvent` (15+ event types). Use exhaustive `when` expressions.
- **Models** live in a single `model/Models.kt` file as Kotlin data classes.
- **Timestamps** are `Long` (milliseconds since UTC epoch) in all APIs and models. Conversion between `LocalDateTime` and epoch millis happens in repositories.
- **Password hashing**: PBKDF2-HMAC-SHA256 via `PasswordUtils`. Format: `base64(salt):base64(hash)`.
- **Soft deletes** for messages (`is_deleted` flag). Never physically delete messages.
- **Error handling**: Throw `BadRequest`, `Unauthorized`, `NotFound` (Colleen exceptions) in controllers. Services throw `IllegalArgumentException` for business rule violations.
- **Thread safety**: `ConcurrentHashMap`, `CopyOnWriteArraySet`, per-user locks in `ChatService`. Broadcasts run on a dedicated `ExecutorService`.
- **Tests** use JUnit 5 + MockK. Test DB is local PostgreSQL (`void_chat` database, Flyway clean + migrate per test via `TestDatabase.createDsl()`). A shared HikariCP pool is reused across tests with table truncation between runs. WebSocket connections are mocked. Use `awaitBroadcasts()` helper to wait for async broadcast delivery.

### Frontend (TypeScript / React)

- **Path alias**: `@/*` maps to `src/*` in imports.
- **Zustand stores** (`src/stores/`): `authStore`, `chatStore`, `roomStore`, `uiStore`. Use fine-grained selectors: `useChatStore(s => s.messages)` — never destructure the whole store.
- **API client** (`src/api/client.ts`): Custom `request<T>()` wrapper around fetch. Adds Bearer token from localStorage automatically. Maps HTTP errors to user-friendly messages via `ApiError`.
- **Type hierarchy**: `ChatMessage = TextMessage | ImageMessage | FileMessage | SystemMessage` — discriminated union on `type` field. Defined in `src/api/types.ts`.
- **Component patterns**: `memo()` with custom comparators on expensive components (e.g., `MessageItem`). `useCallback`/`useMemo` for reference stability. PascalCase filenames matching the exported component.
- **Markdown rendering**: `marked` + `DOMPurify` in `src/lib/markdown.ts`. Mention highlighting via regex post-processing.
- **Cross-component communication**: Custom DOM events for message jumping (`src/lib/messageJump.ts`).
- **WebSocket hook** (`src/hooks/useWebSocket.ts`): Deferred connection via `setTimeout(0)` to avoid React Strict Mode phantom connections. Stable callback refs to prevent infinite reconnects.
- **Utility function**: `cn()` from `src/lib/utils.ts` combines `clsx` + `tailwind-merge` for conditional class names.
- **Toast system**: Counter-based IDs, auto-dismiss at 4s, typed (success/error/info) in `uiStore`.
- **Confirm dialogs**: Promise-based `confirm()` in `uiStore` with tone support ("default"/"danger").
- **Tests**: Unit tests in `tests/unit/` use Vitest + Testing Library + happy-dom. E2E tests in `tests/e2e/` use Playwright (Chromium). Store tests mock the API client with `vi.mock()` and reset state between tests.

### Mobile Experience

Mobile must be a first-class experience. Always verify layouts, interactions, and responsiveness on small screens. Use the Playwright MCP server to test on mobile viewports.

### Test-First for Changes

Before refactoring existing code or implementing a new feature, add or update test cases first. This ensures regressions are caught and the intended behavior is clearly defined before code changes begin.

### Git Commit Messages

After completing a task, commit the changes once the code is working and all relevant tests pass — unless the user explicitly asks not to commit.

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short summary>

[optional body — explain *what* and *why*, not *how*]

[optional footer(s)]
```

**Types**: `feat`, `fix`, `refactor`, `perf`, `style`, `test`, `docs`, `chore`, `ci`, `build`

**Rules**:
- Subject line: imperative mood, no period, ≤ 72 chars
- Scope: the module/layer being changed (optional but encouraged)
- Body: wrap at 72 chars; use bullet points for multiple changes
- Breaking changes: add `BREAKING CHANGE:` footer or append `!` after type

**Examples**:

```
feat(rooms): add room archiving support
```

```
fix(auth): prevent token reuse after logout

Sessions were not invalidated in Redis on explicit logout, allowing
reuse of the old Bearer token until the 7-day TTL expired.
```

```
refactor(personas): improve engagement rules and mention detection

- Restructured prompt rules into character-integrity and participation
  sections for clearer separation of concerns
- Add isNaturalMention() to detect name references beyond @-mentions
```

```
chore(deps): bump Colleen framework to 0.4.6
```

```
feat(api)!: require Authorization header for all /api routes

BREAKING CHANGE: previously some read-only endpoints were unauthenticated.
```

### Design System

Terminal/brutalist aesthetic. Key values: background `#0a0e14`, green text `#00ff41`, cyan accent `#00d9ff`. Fonts: IBM Plex Mono (body), Bebas Neue (headings). Effects include scanlines, glitch animations, noise overlay, and a Matrix rain canvas background. All defined as CSS custom properties in `src/index.css`.
