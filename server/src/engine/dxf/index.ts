/**
 * W12 DXF exchange (WIRING-AUDIT §4 item 8 / F-18): export the plan with
 * walls, rooms, devices, wiring and violations on layers named after the
 * editor's layer keys; import walls from any ASCII DXF.
 */
export { DXF_LAYERS, DXF_OPENINGS_LAYER, DXF_UNITS } from "./layers.js";
export type { DxfLayerKey } from "./layers.js";
export { exportDxf } from "./writer.js";
export type { DxfExportInput } from "./writer.js";
export { DxfImportError, importDxfWalls, parseDxf } from "./reader.js";
export type { DxfEntity, DxfImportOptions, ParsedDxf } from "./reader.js";
