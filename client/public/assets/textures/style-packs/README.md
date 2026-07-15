# textures/style-packs/

Grouped material/color sets per interior style preset (Phase 2 brief
§4.2). A style pack is one curated, visually-consistent decision applied
across furniture, doors, and windows in a project — not four independent
style choices that happen to coexist.

- One subfolder per pack, named after its `stylePack` id in
  `client/lib/furniture-library.ts` (`STYLE_PACKS` registry) — the code
  registry is the source of truth; a folder with no registry entry is
  dead weight.
- The MVP default pack (`solence-default`) is fully procedural (colors
  defined in code, no textures), so this folder starts empty.
- Doors/windows consume the pack via the shared style token in
  `client/lib/opening-presets.ts` — same token, same pack, one look.

## License log

| file | source (URL) | license | attribution required |
|---|---|---|---|
| _none yet_ | | | |
