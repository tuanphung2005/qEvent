# qEvent backend (Elysia + Bun)

## Setup

```bash
bun install
docker compose up -d postgres   # from the repo root
bun run db:push
bun run db:seed
bun run dev
```

`bun run db:push` applies `prisma/schema.prisma` (this repo has no migrations folder).
`bun run db:seed` resets and re-seeds demo data; tests assume a seeded database.

## Environment

Set these in `backend/.env`:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes in production | Dev/test fall back to a hard-coded secret; production refuses to boot without it |
| `GEMINI_API_KEY` | no | Enables AI clustering and quiz generation. Missing key leaves the server running and AI endpoints return `503 AI_NOT_CONFIGURED` |
| `GEMINI_MODEL` | no | Defaults to `gemini-flash-latest` |
| `GEMINI_TIMEOUT_MS` | no | Defaults to `45000` |
| `GEMINI_MAX_OUTPUT_TOKENS` | no | Defaults to `16384` |

## Tests

```bash
bun test
```

The suite runs offline (no Gemini calls) but needs the seeded Postgres database.
