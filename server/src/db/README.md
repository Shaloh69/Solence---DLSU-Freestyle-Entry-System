# db/

Persistence behind one interface so the API never cares which store is
live.

- `repository.ts` — `ProjectRepository` interface + the in-memory
  implementation (dev and tests; data resets on restart).
- `supabase.ts` — lazy service-role Supabase client.
- `supabase-repository.ts` — Postgres-backed implementation over the
  `projects` table (`../../supabase/schema.sql`); project payload lives
  in a `data` jsonb column.

`createApp()` picks Supabase when `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` are set, in-memory otherwise. New storage
concerns should extend the interface first, then both implementations —
tests inject `InMemoryProjectRepository`, so they'll catch drift.
