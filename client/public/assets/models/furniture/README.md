# models/furniture/

Curated low-poly furniture meshes, organized by category subfolder
(`chairs/ tables/ sofas/ beds/ cabinets/ desks/ kitchen/` — create a
subfolder when its first asset lands, don't pre-create empties).

Conventions (Phase 2 brief §2.2–§2.4, §4.2):

- **One folder per item, never loose files** —
  `<subtype>/<category>-<subtype>-<NN>/` holding exactly:
  `model.glb` + `thumbnail.png` + `meta.json`. Example:
  `chairs/dining/chair-dining-01/{model.glb,thumbnail.png,meta.json}`.
  The subtype folder is what keeps this browsable.
- **`meta.json` is mandatory** — fields: `id`, `category`, `subtype`,
  `style_pack`, `dimensions_m {width,depth,height}`, `source`,
  `source_url`, `license`, `variant_of` (null, or the id of the item
  this is a size variant of — that's what groups Compact/Standard/
  Oversized under one piece in the UI). The ingestion script
  (`server/scripts/ingest-assets.ts`) upserts these into Supabase's
  `component_library` table; an asset without meta.json never reaches
  the app.
- **GLB only** — convert Kenney/Quaternius FBX/OBJ downloads to `.glb`
  once at download time (textures embedded), not per-use.
- **Low-poly, CC0-sourced** — one source pack per style pack so items
  visually belong together; don't mix Kenney and Quaternius meshes in
  one pack, their styles clash.
- The current MVP style pack (`solence-default`) uses procedural
  three.js primitives defined in code — this folder fills up when a
  sourced pack (e.g. Kenney) is added as a second style pack.

## License log

| file | source (URL) | license | attribution required |
|---|---|---|---|
| _none yet_ | | | |
