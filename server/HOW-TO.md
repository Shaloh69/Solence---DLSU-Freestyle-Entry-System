# HOW-TO: solence-api (Express backend)

## Run standalone

```bash
cd server
npm install
cp .env.example .env      # defaults are fine for local dev
npm run dev               # http://localhost:4000, WebSocket on /ws
```

Healthcheck: `curl http://localhost:4000/api/health` →
`{"status":"ok",...,"supabase":"not configured"}` when running on the
in-memory store.

## Tests

```bash
npm test                  # vitest: engine unit tests + API integration tests
npm run typecheck
```

The suite needs no database and no network — the API tests inject the
in-memory repository.

## Supabase setup

1. Create a Supabase project.
2. Run [supabase/schema.sql](supabase/schema.sql) in the SQL editor
   (creates the `projects` table with RLS enabled and no public
   policies — only the service-role key can touch it).
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` and
   restart. The healthcheck flips to `"supabase":"configured"`.

There are no incremental migrations yet; schema changes mean editing
`schema.sql` and applying it manually.

## Common failure modes

- **`EADDRINUSE`**: another instance holds :4000 — kill it or set `PORT`.
- **403 responses**: tier gating (`docs/api.md` → Tiers). Send
  `x-solence-tier: pro` or set `DEFAULT_TIER=pro`.
- **422 on simulate/export**: the project is missing a floor plan,
  panel, loads, or (for export) a stored simulation result.
