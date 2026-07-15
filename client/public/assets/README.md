# assets/

Static 3D/texture assets for the Showcase Mode scene and the component
library (Phase 2 brief §2–§3). Source code never lives here; everything
in this tree is either a third-party asset or a reference profile.

## Licensing policy — read before adding anything

- **CC0 only by default** (public domain, zero restriction). Approved
  sources: [Kenney](https://kenney.nl), [Quaternius](https://quaternius.com),
  [Poly Haven](https://polyhaven.com), [ambientCG](https://ambientcg.com).
- **Verify per-asset, not per-site** — check the license on the specific
  download, not the site's general policy, before it enters the repo.
- Anything non-CC0 (e.g. CC-BY from Sketchfab) must have its attribution
  requirement recorded in the owning subfolder's README license log —
  documented, not just remembered.
- Every subfolder README carries a license log table:
  `| file | source (URL) | license | attribution required |`

## Map

- `models/furniture/` — curated low-poly furniture variants (§4.2:
  style-pack-tagged, footprint-tagged; not a dumping ground).
- `models/fixtures/` — lighting fixture meshes (ties to the lighting
  design layer), incl. `exit-egress/` for commercial emergency fixtures.
- `models/doors/`, `models/windows/` — **reference profiles only**;
  in-product doors/windows are parametrically generated
  (`client/lib/opening-geometry.ts`), never imported static meshes (§4.1).
- `textures/materials/` — CC0 PBR sets (wood/fabric/metal/concrete/glass).
- `textures/style-packs/` — grouped material/color sets per interior
  style preset (§4.2).
