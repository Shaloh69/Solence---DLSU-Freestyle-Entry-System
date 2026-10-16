---
paths:
  - "client/components/showcase/**"
  - "client/components/wiring-overlay/**"
  - "client/public/assets/**"
  - "test-assets/**"
---

# 3D, textures and animation rules

Every model, texture, HDRI and animation is checked by tools, not by eye.

## Assets (`npm run check:assets`)
- glTF/GLB: Khronos `gltf-validator` reports 0 errors. `gltf-transform
  inspect` must show: triangles ≤ budget in DESIGN.md §8, textures ≤ 2048px,
  power-of-two, KTX2 or WebP for anything over 512px, no unused nodes/
  materials, normals present.
- Real-world scale: bounding box in meters, checked against the asset's
  `meta.json` (door 0.8–1.0 × 2.0–2.2 m, ceiling 2.4–3.2 m, chair seat
  0.40–0.50 m). Wrong scale fails.
- Textures: correct color space (baseColor/emissive sRGB; normal,
  roughness, metalness, AO linear), tileable materials pass the edge-seam
  check, file size within budget.
- Every asset has `source`, `license`, `author`, `sha256` in
  `test-assets/manifest.json` or its `meta.json`. Missing → fails.

## Rendering (`npm run check:render`)
- Fixed camera paths over real corpus scenes, captured headless.
- Fails on: black or blown-out frames (mean luminance out of range),
  missing-texture checker/magenta pixels, NaN geometry, console WebGL
  warnings, draw calls or triangles over budget (`renderer.info`).
- Visual diff vs approved baseline with `pixelmatch`; threshold lives in
  `e2e/render/thresholds.json` and is never raised without the user.

## Animation (`npm run check:motion`)
- Correctness runs headless; **performance runs on the server PC's real
  GPU** (headed Chromium over Tailscale), because SwiftShader numbers are
  meaningless for frame budgets.
- Frame time from `requestAnimationFrame` over the animation: p95 ≤ 20 ms,
  no frame > 50 ms, during Showcase reveal, walk mode, and wire draw-in.
- UI animations: 0 layout shift, only `transform`/`opacity` animated,
  durations and easings from DESIGN.md tokens only.
- Reduced motion: page fully usable and every element visible with
  `prefers-reduced-motion: reduce` (checked by screenshot).
- Animations pause when the tab is hidden.
