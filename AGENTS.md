# Repository Guidelines

## Project Structure & Module Organization
- `client/`: React app (components, assets, `entry-client.jsx`, `entry-server.jsx`, `index.html`).
- `lib/`: Server modules — `auth/` (Passport), `db/` (Drizzle schema/connection), `postgresVectorDatabase.js`, `ragUtils.js`.
- `server.js`: Express + Vite SSR server and API routes (`/token`, `/search`, auth, health).
- `test/`: Jest tests (`*.unit.test.js`, `*.integration.test.js`, UI `*.test.jsx`) and Playwright e2e (`test/e2e`).
- `docs/`, `docker/`, `infrastructure/`, `scripts/`, `data/`.

## Build, Test, and Development Commands
- `npm run dev`: Start Express with Vite middleware at `http://localhost:3000`.
- `npm start`: Start server (production mode; expects built assets).
- `npm run build`: Build client and server bundles via Vite.
- `npm test` / `test:unit` / `test:integration` / `test:ui`: Run Jest suites.
- `npm run test:e2e`: Run Playwright e2e (server auto-starts).
- `npm run lint`: ESLint across client, server, tests (auto-fix enabled).
- Database: `npm run db:generate`, `db:migrate`, `db:push`, `db:studio` (Drizzle).
- Docker (Postgres): `npm run docker:up`, `docker:down`, `docker:reset`.

## Coding Style & Naming Conventions
- Formatting: Prettier (2 spaces, semicolons, double quotes allowed). Run before commit.
- Linting: ESLint + React + Hooks; no unused vars (`_` to ignore).
- Modules: ESM (`type: module`). React components in `.jsx`; server/util in `.js`.
- Tests: name with suffixes `*.unit.test.js`, `*.integration.test.js`, `*.test.jsx`.

## Testing Guidelines
- Frameworks: Jest (jsdom/node) + Testing Library; Playwright for e2e.
- Coverage: global thresholds 80% lines/branches/functions/statements (`npm run test:coverage`).
- Integration: single worker; use `npm run test:setup`/`test:teardown` for Dockerized DB when needed.

## Commit & Pull Request Guidelines
- Commits: imperative, concise first line (e.g., "Fix integration test flakiness"). Optional scope; keep under ~72 chars.
- PRs: clear description, link issues, include screenshots for UI, list key commands run, and add/update tests. Ensure `npm run lint` and all tests pass.

## Security & Configuration Tips
- Copy `.env.example` to `.env`. Required: `OPENAI_API_KEY`, `DATABASE_URL`, `SESSION_SECRET`; optional OAuth (`GOOGLE_*`, `FACEBOOK_*`, `MICROSOFT_*`) and `APPLICATIONINSIGHTS_CONNECTION_STRING`.
- Never commit secrets. Use `.env.test` for tests and `docker-compose.test.yml` when appropriate.
