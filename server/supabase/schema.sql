-- Solence projects table (run in the Supabase SQL editor).
create table if not exists projects (
  id uuid primary key,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The API uses the service-role key, so RLS stays enabled with no
-- public policies: only the backend can touch the table.
alter table projects enable row level security;
