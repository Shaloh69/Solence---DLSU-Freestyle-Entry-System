# components/lighting/

Photometric results UI for the lighting layer: per-room average lux vs
target with status chips, driven by `SimulationResult.roomLighting`.
The lux heatmap itself renders as a layer inside the 2D canvas and the
3D overlay; fixture auto-generation is triggered from the toolbar and
room inspector. All lighting math lives in
`server/src/engine/lighting/`.
