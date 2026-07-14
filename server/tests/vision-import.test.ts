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
