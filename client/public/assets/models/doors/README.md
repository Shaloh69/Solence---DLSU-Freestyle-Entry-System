# models/doors/

**Doors are PARAMETRIC/GENERATED, not static meshes** (Phase 2 brief
§4.1). A door must fit its opening's exact dimensions, which come from
the floor plan — so in-product doors are generated at those dimensions
by `client/lib/opening-geometry.ts` (families/presets in
`client/lib/opening-presets.ts`), never imported per-size models.

This folder holds **reference meshes/profiles only** — geometry studied
for proportions (frame depth, panel layout, handle placement) when
authoring a new door family. Nothing in here is loaded at runtime.

CC0 only; verify per-asset. See `../../README.md` for the policy.

## License log

| file | source (URL) | license | attribution required |
|---|---|---|---|
| _none yet_ | | | |
