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

-- Component library (Phase 2 brief §2.5): one row per placeable asset,
-- mirroring each item's meta.json. The placement UI queries THIS table
-- (with the style-pack filter), never a filesystem scan. Populated by
-- server/scripts/ingest-assets.ts from /assets/**/meta.json.
create table if not exists component_library (
  id text primary key,                 -- meta.json "id", e.g. chair-dining-01
  category text not null,              -- chair | table | sofa | ...
  subtype text not null,               -- dining | office | lounge | ...
  style_pack text not null,
  dimensions jsonb not null,           -- { width, depth, height } meters
  storage_path text not null,          -- Supabase Storage path to model.glb
  thumbnail_path text,
  license text not null,
  variant_of text references component_library(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists component_library_style_pack_idx
  on component_library (style_pack, category);

alter table component_library enable row level security;
