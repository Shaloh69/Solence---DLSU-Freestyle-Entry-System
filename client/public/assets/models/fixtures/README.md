# models/fixtures/

Lighting fixture meshes (downlights/ pendants/ wall-sconces/
exit-egress/ — create subfolders as assets land). Ties to the lighting
design layer: a fixture asset is the *visual* for a lighting load; the
photometrics stay in the engine.

- `exit-egress/` holds commercial emergency/egress fixtures — these
  pair with the `egress` load flag and the egress-dedicated-circuit
  compliance rule (`server/src/engine/compliance/egress-lighting.ts`).
- Most fixture geometry (a downlight is a cylinder, a pendant is a cone
  on a wire) is simple enough to build procedurally in three.js — do
  that rather than forcing in a mismatched pre-made mesh (brief §3).
- CC0 only; verify per-asset. See `../../README.md` for the policy.

## License log

| file | source (URL) | license | attribution required |
|---|---|---|---|
| _none yet_ | | | |
