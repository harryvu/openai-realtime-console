# PRD — OpenAI Realtime Console (Citizenship Test Assistant)

## Summary
A web app that demonstrates low-latency, voice-capable AI via OpenAI Realtime API over WebRTC, tailored to a USCIS citizenship test assistant. The server issues ephemeral session tokens, enforces official-answer rules, and provides RAG with a Postgres + pgvector knowledge base. The React client offers a console UI, logging pane, and practice workflows.

## Goals
- Deliver a working reference for Realtime (WebRTC) integration with function calling.
- Provide accurate, up-to-date USCIS practice with enforced “OFFICIAL ANSWER” responses.
- Offer semantic search and RAG to ground answers from curated content.
- Include authentication options (Google/Facebook/Microsoft) and basic telemetry.

## Non‑Goals
- Full LMS features, analytics dashboards, or multi-tenant admin tooling.
- Content authoring studio or advanced grading beyond simple checks.

## Users & Key Use Cases
- Learner: practices questions, receives correct answers and feedback, interacts by voice.
- Developer: studies integration patterns (WebRTC, ephemeral tokens, RAG, function calling).

Primary flows:
1) Start session → obtain `/token` → client negotiates WebRTC with Realtime API → interactive conversation with logging.
2) Practice → app asks a question → model MUST call `request_practice_question` → UI tracks question → user submits answer → `/check-answer` returns feedback.
3) Research → `/enhance-message` adds grounded context using vector search → assistant replies with official answers where applicable.

## Functional Requirements
- Realtime Session
  - Endpoint `/token` returns ephemeral session for `gpt-4o-realtime-preview-2024-10-01` (voice `verse`).
  - Inject tool definitions; model must call `request_practice_question` after posing any practice question.
- WebRTC Client
  - Client initializes with `/token`, sets up media streams, and renders a JSON event log.
- RAG & Search
  - `/search` performs semantic search via `PostgresVectorDatabase` (pgvector).
  - `/enhance-message` detects citizenship relevance and current-officials queries; enriches prompt with context.
- Practice & Assessment
  - `/random-question` returns random USCIS Q/A; `/check-answer` validates user response (normalized string match, server-side).
- Authentication & Sessions
  - OAuth (Google, Facebook, Microsoft) via Passport; sessions stored in Postgres (`connect-pg-simple`).
  - `/auth/dev` for local development.
- Delivery & SSR
  - Express serves SSR React via Vite middleware; `entry-server.jsx` renders, `entry-client.jsx` hydrates.
- Health & Telemetry
  - `/health` exposes liveness and DB checks; Application Insights optional; custom `Citizenship_*` events.

## API Surface (high level)
- `GET /token` → JSON session object for Realtime API.
- `POST /search { query, limit? }` → `{ results[], count }`.
- `GET /search/info` → vector DB summary.
- `GET /random-question` → `{ id, question, answer, category }`.
- `POST /check-answer { questionId, userAnswer }` → `{ correct, canonical_answer, feedback }`.
- `POST /enhance-message { message }` → `{ enhancedMessage, hasContext, searchResults }`.
- Auth routes: `/auth/{google|facebook|microsoft}`, callbacks, `/auth/dev`, `/auth/logout`.
- `GET /api/user` → authenticated user profile.

## Data
- Postgres via Drizzle ORM; pgvector for embeddings.
- Core entities: `userProfiles`, `questions` (USCIS items), `embeddings/documents` for search.

## Non‑Functional Requirements
- Performance: first assistant audio/text within ~2s on local dev; search ≤300ms p95 with warm DB.
- Reliability: graceful handling of missing env vars and DB connectivity; `/health` returns degraded state when partial failure.
- Security: secrets in `.env`; sessions `httpOnly`; OAuth enabled only when configured.
- Observability: key events tracked; minimal PII in logs.

## Success Metrics
- Functional: practice flow works end‑to‑end; official answers enforced for current officials.
- Quality: Jest coverage ≥80% (global thresholds); Playwright e2e green for core flows.
- DevX: `npm run dev` starts app; `npm run build && npm start` serves SSR build.

## Release Criteria (MVP)
- All endpoints operational and documented; .env template complete.
- Tests passing locally (`npm test`, `npm run test:e2e`).
- Lint clean (`npm run lint`).
- README updated with setup; PRD and AGENTS included.

## Risks & Mitigations
- Realtime API changes → keep model/version configurable via env when needed.
- Outdated official answers → centralized in RAG/enhancement; instructions in `/token` override model defaults.
- Vector DB unavailability → endpoints return clear errors; health endpoint signals degraded state.

## Dependencies
- OpenAI Realtime API, Node.js, Express, Vite, React.
- Postgres + pgvector, Drizzle ORM.
- Passport OAuth providers.
- Optional: Application Insights.
