---
paths:
  - "server/**/*.ts"
  - "server/supabase/**"
---

# Server / engine rules

- Domain logic stays in `server/src/engine/`; routes only validate (zod),
  authorize, call the engine, and respond.
- Any new compliance number goes in a flagged data file (`PEC-VERIFY` /
  `LIGHTING-VERIFY`) with a comment naming the PEC section it stands for.
- Every route: zod schema, owner check, test for 400/401/403/404 paths.
- The WebSocket gateway authenticates on connect and checks ownership on
  every `subscribe`.
- PDF output: embedded fonts only (no PDFKit built-ins — they can't
  render `²` or `⚠`). PDF tests extract text and assert the exact
  strings, e.g. `3.5 mm²`.
- Schema changes are migration files (`server/supabase/migrations/`),
  never edits to an applied migration.
