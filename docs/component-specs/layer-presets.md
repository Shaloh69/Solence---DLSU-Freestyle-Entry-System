# layer-presets — layer state picker + per-layer lock (W4)

Status: **planned** (registry). Not built yet: it waits for the
`/dev/gallery` + reference-capture tooling (items 0.5, 0.6), then goes
through the full design gate (CLAUDE.md §2) before it replaces anything
in the editor. The engine/store side already ships in W4.

## Reference

- AutoCAD Layer States Manager —
  https://help.autodesk.com/view/ACD/2025/ENU/?guid=GUID-3E0F662B-226F-4A27-B5BB-D15252CC994C
  (named layer states, restore, which properties a state restores)
- AutoCAD "Layer States" —
  https://help.autodesk.com/cloudhelp/2021/ENU/AutoCAD-DidYouKnow/files/GUID-5312A8BD-DD94-47D6-B1BA-5E0AF5E0CED8.htm
  (one-click saved views; locked layers stay visible but uneditable)

Captures are added with `npm run refs:capture` once item 0.5 lands.

## Behaviour (already implemented in the store, `client/lib/layers.ts`)

- 8 presets: Architectural, Furniture plan, Electrical (no furniture),
  Lighting plan, Power plan, Wiring only, Compliance review, All.
  Choosing one sets every layer's visibility; locks are untouched.
- Per-layer lock: a locked layer stays visible; its elements can't be
  selected or dragged (2D, 3D and outliner all go through
  `setSelection`). Locking a layer clears a selection on it.
- Saved per project in this browser (`localStorage`,
  `solence.layers.<projectId>`); unavailable storage just forgets.
- Deep link: `/projects/<id>/editor?view=<preset>&lock=<layer,layer>`
  overrides the saved state (`?lock=` with no value unlocks all).

## To specify before building (needs DESIGN.md tokens)

- Picker: segmented list or dropdown in the Layers panel header showing
  the active preset name ("Custom" when the toggles match none).
- Lock: a lock toggle beside each layer row.
- States: default / hover / active (current preset) / focus-visible /
  disabled (no project loaded) / loading (project opening) / empty (n/a)
  / error (n/a — purely local state).
- Motion: none on the canvas (frontend rule: animate results, not the
  act of toggling); picker uses the DESIGN.md §6 control tokens only.
- Mobile: the Layers tab (narrow layout) shows the picker above the
  layer list; lock toggles stay 44 px touch targets.
