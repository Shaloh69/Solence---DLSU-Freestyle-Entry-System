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
export type { RoomLightingAnalysis, LuxSample } from "./analysis.js";
export {
  ROOM_ILLUMINANCE_TARGETS,
  ILLUMINANCE_MIN_RATIO,
  ILLUMINANCE_MAX_RATIO,
  DEFAULT_LUMENS_PER_WATT,
} from "./lighting-data.js";
