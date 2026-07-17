import { describe, it, expect } from "vitest";
import { visionResultToFloorPlan, VisionResult } from "../src/engine/vision-import.js";

describe("visionResultToFloorPlan", () => {
  it("scales an already-resolved wall segment from px to meters", () => {
    const result: VisionResult = {
      imageSize: { width: 500, height: 500 },
      walls: [
        // A 200px-long, 10px-thick horizontal wall run.
        { start: [0, 5], end: [200, 5], thickness: 10 },
      ],
      openings: [],
      rooms: [],
    };

    const plan = visionResultToFloorPlan(result, null, 50);

    expect(plan.width).toBeCloseTo(10);
    expect(plan.height).toBeCloseTo(10);
    expect(plan.walls).toHaveLength(1);
    const wall = plan.walls[0];
    const length = Math.hypot(
      wall.end.x - wall.start.x,
      wall.end.y - wall.start.y
    );

    expect(length).toBeCloseTo(4, 1); // 200px / 50px-per-m
    expect(wall.thickness).toBeCloseTo(0.2, 1); // 10px / 50px-per-m
  });

  it("drops a segment too short to be a real wall", () => {
    const result: VisionResult = {
      imageSize: { width: 500, height: 500 },
      walls: [{ start: [0, 0], end: [2, 0], thickness: 4 }],
      openings: [],
      rooms: [],
    };

    const plan = visionResultToFloorPlan(result, null, 50);

    expect(plan.walls).toHaveLength(0);
  });

  it("drops openings not near any wall and keeps ones that are", () => {
    const result: VisionResult = {
      imageSize: { width: 500, height: 500 },
      walls: [{ start: [0, 5], end: [200, 5], thickness: 10 }],
      openings: [
        { kind: "door", confidence: 0.9, box: [90, 0, 110, 10] }, // on the wall
        { kind: "window", confidence: 0.9, box: [400, 400, 420, 420] }, // far away
      ],
      rooms: [],
    };

    const plan = visionResultToFloorPlan(result, null, 50);

    expect(plan.openings).toHaveLength(1);
    expect(plan.openings?.[0].kind).toBe("door");
  });

  it("maps room boxes into meter-scale boundaries with known types", () => {
    const result: VisionResult = {
      imageSize: { width: 500, height: 500 },
      walls: [],
      openings: [],
      rooms: [
        {
          type: "kitchen",
          confidence: 0.8,
          boundary: [
            [0, 0],
            [100, 0],
            [100, 100],
            [0, 100],
          ],
        },
        {
          type: "some_unknown_label",
          confidence: 0.5,
          boundary: [
            [0, 0],
            [50, 0],
            [50, 50],
            [0, 50],
          ],
        },
      ],
    };

    const plan = visionResultToFloorPlan(result, null, 50);

    expect(plan.rooms).toHaveLength(2);
    expect(plan.rooms[0].type).toBe("kitchen");
    expect(plan.rooms[1].type).toBe("other");
    expect(plan.rooms[0].boundary[2]).toEqual({ x: 2, y: 2 }); // 100px / 50
  });

  it("maps new vision room classes onto engine room types", () => {
    const boundary: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    const result: VisionResult = {
      imageSize: { width: 500, height: 500 },
      walls: [],
      openings: [],
      rooms: [
        { type: "utility", confidence: 0.6, boundary },
        { type: "storage", confidence: 0.6, boundary },
        { type: "outdoor", confidence: 0.6, boundary },
        { type: "hallway", confidence: 0.6, boundary },
        { type: "dining", confidence: 0.6, boundary },
      ],
    };

    const plan = visionResultToFloorPlan(result, null, 50);

    // utility -> laundry keeps the GFCI wet-area rule firing (PEC).
    expect(plan.rooms.map((room) => room.type)).toEqual([
      "laundry",
      "other",
      "outdoor",
      "hallway",
      "dining",
    ]);
  });

  it("places confident detected furniture and skips low-confidence ones", () => {
    const result: VisionResult = {
      imageSize: { width: 500, height: 500 },
      walls: [],
      openings: [],
      rooms: [],
      furniture: [
        {
          category: "bed",
          confidence: 0.85,
          center: [250, 250],
          size: [100, 75],
          rotationDeg: 45,
        },
        {
          category: "sofa",
          confidence: 0.3, // below the floor — must be skipped, not guessed
          center: [100, 100],
          size: [80, 40],
          rotationDeg: 0,
        },
        {
          category: "mystery",
          confidence: 0.9, // unknown category — skipped
          center: [50, 50],
          size: [40, 40],
          rotationDeg: 0,
        },
      ],
    };

    const plan = visionResultToFloorPlan(result, null, 50);

    expect(plan.furniture).toHaveLength(1);
    const bed = plan.furniture![0];

    expect(bed.meshKey).toBe("bed");
    expect(bed.position).toEqual({ x: 5, y: 5 });
    expect(bed.width).toBeCloseTo(2, 5);
    expect(bed.depth).toBeCloseTo(1.5, 5);
    expect(bed.rotation).toBeCloseTo(Math.PI / 4, 5);
  });

  it("appends detected furniture after previously placed pieces", () => {
    const previous = {
      width: 10,
      height: 10,
      walls: [],
      rooms: [],
      openings: [],
      furniture: [
        {
          id: "manual-1",
          key: "sofa-2seat",
          label: "2-Seat Sofa",
          meshKey: "sofa",
          position: { x: 2, y: 2 },
          rotation: 0,
          width: 1.5,
          depth: 0.85,
          height: 0.8,
        },
      ],
    };
    const result: VisionResult = {
      imageSize: { width: 500, height: 500 },
      walls: [],
      openings: [],
      rooms: [],
      furniture: [
        {
          category: "table",
          confidence: 0.7,
          center: [100, 100],
          size: [60, 40],
          rotationDeg: 0,
        },
      ],
    };

    const plan = visionResultToFloorPlan(result, previous, 50);

    expect(plan.furniture).toHaveLength(2);
    expect(plan.furniture![0].id).toBe("manual-1");
    expect(plan.furniture![1].label).toContain("detected");
  });

  it("preserves the previous background image", () => {
    const result: VisionResult = {
      imageSize: { width: 100, height: 100 },
      walls: [],
      openings: [],
      rooms: [],
    };

    const plan = visionResultToFloorPlan(
      result,
      { width: 1, height: 1, walls: [], rooms: [], backgroundImage: "data:x" },
      50
    );

    expect(plan.backgroundImage).toBe("data:x");
  });
});
