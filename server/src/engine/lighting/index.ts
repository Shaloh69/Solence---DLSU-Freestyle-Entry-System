export {
  roomCavityRatio,
  coefficientOfUtilization,
  maintenanceFactor,
  requiredLampCount,
  averageIlluminance,
  gridLayout,
  lampPositions,
  illuminanceAtPoint,
} from "./photometric.js";
export type { PhotometricEnv, LampLayout } from "./photometric.js";
export {
  autoPlaceLighting,
  DEFAULT_FIXTURE,
} from "./auto-place.js";
export type {
  AutoPlaceOptions,
  AutoPlaceResult,
  FixtureSpec,
} from "./auto-place.js";
export {
  analyzeRoomLighting,
  luxHeatmap,
  fixtureFlux,
} from "./analysis.js";
export type {
  AnalysisOptions,
  RoomLightingAnalysis,
  LuxSample,
} from "./analysis.js";
export { roomDaylightFactors } from "./daylight.js";
export type { RoomDaylight } from "./daylight.js";
export {
  ROOM_ILLUMINANCE_TARGETS,
  ILLUMINANCE_MIN_RATIO,
  ILLUMINANCE_MAX_RATIO,
  DEFAULT_LUMENS_PER_WATT,
  ROOM_CCT_DEFAULTS,
  DAYLIGHT_FACTOR_GOOD,
} from "./lighting-data.js";
