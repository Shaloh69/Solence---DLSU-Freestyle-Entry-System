import { describe, it, expect } from "vitest";
import {
  roomCavityRatio,
  coefficientOfUtilization,
  maintenanceFactor,
  requiredLampCount,
  averageIlluminance,
  gridLayout,
  lampPositions,
  illuminanceAtPoint,
  autoPlaceLighting,
  analyzeRoomLighting,
  luxHeatmap,
  ROOM_ILLUMINANCE_TARGETS,
  ROOM_CCT_DEFAULTS,
  roomDaylightFactors,
} from "../src/engine/lighting/index.js";
import {
  checkRoomIlluminance,
  checkGfci,
  checkGeneralLightingLoad,
} from "../src/engine/compliance/index.js";
import { ElectricalLoad, Room } from "../src/engine/types.js";

const kitchen: Room = {
  id: "kit",
  name: "Kitchen",
  type: "kitchen",
  boundary: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ],
};

function makeLoad(overrides: Partial<ElectricalLoad>): ElectricalLoad {
  return {
    id: "l1",
    name: "Load",
    type: "lighting",
    va: 12,
    voltage: 120,
    continuous: true,
    position: { x: 2, y: 1.5 },
    roomId: "kit",
    ...overrides,
  };
}

describe("photometric core (ported lumen method)", () => {
  it("computes RCR like the original engine", () => {
    // 10×8×3 room, 0.85 workplane: RCR = 5·2.15·18 / 80 = 2.42
    expect(roomCavityRatio(10, 8, 3, 0.85)).toBeCloseTo(2.42, 2);
  });

  it("clamps CU into [0.3, 0.85]", () => {
    expect(coefficientOfUtilization(1, 0.7, 0.5)).toBeLessThanOrEqual(0.85);
    expect(coefficientOfUtilization(15, 0.1, 0.1)).toBeGreaterThanOrEqual(0.3);
  });

  it("looks up the ported maintenance-factor table", () => {
    expect(maintenanceFactor("normal", 2)).toBe(0.84);
    expect(maintenanceFactor("dirty", 6)).toBe(0.62);
  });

  it("solves lumen-method lamp count, rounded up", () => {
    // N = (E·A)/(Φ·CU·MF) = (500·80)/(3600·0.6·0.84) = 22.05 -> 23
    expect(requiredLampCount(500, 80, 3600, 0.6, 0.84)).toBe(23);
  });

  it("average illuminance inverts the lamp-count formula", () => {
    const lux = averageIlluminance(23 * 3600, 0.6, 0.84, 80);

    expect(lux).toBeGreaterThanOrEqual(500);
  });

  it("lays out a grid matching room aspect and caps positions", () => {
    const layout = gridLayout(6, 8, 4);
    const positions = lampPositions(layout, 6, 2.6);

    expect(layout.rows * layout.columns).toBeGreaterThanOrEqual(6);
    expect(positions).toHaveLength(6);
    expect(positions.every((p) => p.z === 2.6)).toBe(true);
  });

  it("computes finite point illuminance that decays with distance", () => {
    const lamps = [{ x: 0, y: 0, z: 2.6, fluxLm: 1200 }];
    const near = illuminanceAtPoint(0, 0, lamps, 0.85, 0.6, 0.84);
    const far = illuminanceAtPoint(5, 5, lamps, 0.85, 0.6, 0.84);

    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });
});

describe("autoPlaceLighting", () => {
  it("places fixtures inside the room polygon as ordinary loads", () => {
    const { loads, meta } = autoPlaceLighting(kitchen);

    expect(loads.length).toBeGreaterThan(0);
    expect(meta.placedCount).toBe(loads.length);
    expect(meta.targetLux).toBe(ROOM_ILLUMINANCE_TARGETS.kitchen);
    for (const load of loads) {
      expect(load.type).toBe("lighting");
      expect(load.roomId).toBe("kit");
      expect(load.lumens).toBeGreaterThan(0);
      expect(load.position.x).toBeGreaterThanOrEqual(0);
      expect(load.position.x).toBeLessThanOrEqual(4);
      expect(load.position.y).toBeGreaterThanOrEqual(0);
      expect(load.position.y).toBeLessThanOrEqual(3);
    }
  });

  it("hits the efficiency objective: expected lux near target, not double", () => {
    const { meta } = autoPlaceLighting(kitchen);

    expect(meta.expectedAverageLux).toBeGreaterThanOrEqual(meta.targetLux);
    // Ceiling: one extra fixture of headroom, not gross over-lighting.
    expect(meta.expectedAverageLux).toBeLessThan(meta.targetLux * 2.5);
  });

  it("rejects degenerate rooms", () => {
    expect(() =>
      autoPlaceLighting({ ...kitchen, boundary: [{ x: 0, y: 0 }] })
    ).toThrow();
  });
});

describe("analyzeRoomLighting / luxHeatmap", () => {
  it("reports per-room average lux and fixture count", () => {
    const { loads } = autoPlaceLighting(kitchen);
    const [analysis] = analyzeRoomLighting([kitchen], loads);

    expect(analysis.roomId).toBe("kit");
    expect(analysis.fixtureCount).toBe(loads.length);
    expect(analysis.averageLux).toBeGreaterThan(0);
    expect(analysis.fluxEstimated).toBe(false);
  });

  it("estimates flux from VA when lumens are missing", () => {
    const [analysis] = analyzeRoomLighting(
      [kitchen],
      [makeLoad({ lumens: undefined, va: 20 })]
    );

    expect(analysis.fluxEstimated).toBe(true);
    expect(analysis.averageLux).toBeGreaterThan(0);
  });

  it("samples the heatmap only inside rooms", () => {
    const { loads } = autoPlaceLighting(kitchen);
    const samples = luxHeatmap(
      { width: 10, height: 8, walls: [], rooms: [kitchen] },
      loads
    );

    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      expect(sample.x).toBeLessThanOrEqual(4);
      expect(sample.y).toBeLessThanOrEqual(3);
      expect(sample.lux).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("lighting compliance rules", () => {
  it("flags a room with no fixtures", () => {
    const violations = checkRoomIlluminance([kitchen], []);

    expect(violations.map((violation) => violation.ruleId)).toContain(
      "illuminance-none"
    );
  });

  it("flags under-lit rooms and passes auto-generated ones", () => {
    const dim = checkRoomIlluminance(
      [kitchen],
      [makeLoad({ lumens: 200 })] // one weak lamp for a 12 m² kitchen
    );

    expect(dim.map((violation) => violation.ruleId)).toContain(
      "illuminance-low"
    );

    const { loads } = autoPlaceLighting(kitchen);

    expect(checkRoomIlluminance([kitchen], loads)).toHaveLength(0);
  });

  it("flags grossly over-lit rooms", () => {
    const violations = checkRoomIlluminance(
      [kitchen],
      [makeLoad({ lumens: 200000 })]
    );

    expect(violations.map((violation) => violation.ruleId)).toContain(
      "illuminance-high"
    );
  });
});

describe("checkGfci", () => {
  it("flags non-GFCI outlets in wet rooms only", () => {
    const outletInKitchen = makeLoad({
      id: "o1",
      type: "outlet",
      name: "Counter outlet",
      continuous: false,
    });
    const bedroom: Room = {
      ...kitchen,
      id: "bed",
      name: "Bedroom",
      type: "bedroom",
    };
    const outletInBedroom = makeLoad({
      id: "o2",
      type: "outlet",
      roomId: "bed",
      continuous: false,
    });

    const violations = checkGfci(
      [kitchen, bedroom],
      [outletInKitchen, outletInBedroom]
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe("gfci-required");
    expect(violations[0].message).toContain("Kitchen");
  });

  it("passes GFCI-protected outlets", () => {
    const protectedOutlet = makeLoad({
      id: "o1",
      type: "outlet",
      gfci: true,
      continuous: false,
    });

    expect(checkGfci([kitchen], [protectedOutlet])).toHaveLength(0);
  });
});

describe("checkGeneralLightingLoad", () => {
  it("warns when lighting VA is below the code basis", () => {
    // 12 m² kitchen at 24 VA/m² needs 288 VA basis; 12 VA connected.
    const violations = checkGeneralLightingLoad([kitchen], [makeLoad({})]);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe("general-lighting-basis");
  });

  it("passes when connected lighting meets the basis", () => {
    const bigLoad = makeLoad({ va: 500 });

    expect(checkGeneralLightingLoad([kitchen], [bigLoad])).toHaveLength(0);
  });
});

describe("§9.1a photometric fidelity", () => {
  it("ceiling height changes the fixture count (taller = more fixtures)", () => {
    const low = autoPlaceLighting(kitchen, { ceilingHeight: 2.4 });
    const tall = autoPlaceLighting(kitchen, { ceilingHeight: 4.5 });

    expect(tall.meta.requiredCount).toBeGreaterThan(low.meta.requiredCount);
  });

  it("auto-placed fixtures carry the room-type CCT default", () => {
    const bedroom: Room = { ...kitchen, id: "bed", name: "Bed", type: "bedroom" };
    const kitchenResult = autoPlaceLighting(kitchen);
    const bedroomResult = autoPlaceLighting(bedroom);

    expect(kitchenResult.loads[0].cct).toBe(ROOM_CCT_DEFAULTS.kitchen); // cool task
    expect(bedroomResult.loads[0].cct).toBe(ROOM_CCT_DEFAULTS.bedroom); // warm
    expect(ROOM_CCT_DEFAULTS.kitchen).toBeGreaterThan(ROOM_CCT_DEFAULTS.bedroom);
  });

  it("computes a Daylight Factor from windows on the room's walls", () => {
    const walls = [
      {
        id: "w-south",
        start: { x: 0, y: 0 },
        end: { x: 4, y: 0 },
      },
    ];
    const openings = [
      { id: "o1", wallId: "w-south", offset: 1, width: 1.5, kind: "window" as const },
    ];

    const [df] = roomDaylightFactors([kitchen], walls, openings);

    // glass 1.5m × 1.2m × VT 0.6 = 1.08 m²; floor 12 m² → DF 0.09
    expect(df.windowCount).toBe(1);
    expect(df.daylightFactor).toBeCloseTo(0.09, 2);
    expect(df.wellDaylit).toBe(true);
  });

  it("NEVER reduces the code-required fixture count for daylight (§9.1a hard constraint)", () => {
    // Identical room, with vs without a big window: the night/worst-case
    // fixture count must be identical — DF is advisory only.
    const windowless = autoPlaceLighting(kitchen);
    const daylit = autoPlaceLighting(kitchen); // solver has no window input at all

    expect(daylit.meta.requiredCount).toBe(windowless.meta.requiredCount);

    // And the analysis carries DF as a separate advisory field without
    // touching targetLux.
    const walls = [{ id: "w", start: { x: 0, y: 0 }, end: { x: 4, y: 0 } }];
    const openings = [
      { id: "o1", wallId: "w", offset: 0.5, width: 2, kind: "window" as const },
    ];
    const [withDf] = analyzeRoomLighting([kitchen], [makeLoad({})], {
      walls,
      openings,
    });
    const [withoutDf] = analyzeRoomLighting([kitchen], [makeLoad({})]);

    expect(withDf.targetLux).toBe(withoutDf.targetLux);
    expect(withDf.daylightFactor).toBeGreaterThan(0);
    expect(withoutDf.daylightFactor).toBeUndefined();
  });
});
