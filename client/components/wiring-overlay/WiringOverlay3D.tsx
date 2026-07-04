"use client";

/**
 * 3D wiring overlay: extruded walls with door/window cuts (deterministic
 * segment splitting per section 7.7 — no CSG dependency), panel, loads,
 * routed wiring at conduit height, plus the lighting layer (fixtures +
 * lux heatmap). CAD layers from the editor store apply here too.
 *
 * Plan coordinates (x right, y down, meters) map to Three.js as
 * x -> x, y -> z, with +y up.
 */
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls, Text } from "@react-three/drei";

import {
  ElectricalLoad,
  FloorPlan,
  Opening,
  Panel,
  SimulationResult,
  Wall,
} from "@/lib/api-client";
import { useEditorStore } from "@/lib/editor-store";
import { circuitColor, VIOLATION_COLOR } from "@/lib/circuit-colors";

const WALL_HEIGHT = 2.7;
const CONDUIT_HEIGHT = 2.5;
const DOOR_HEIGHT = 2.1;
const WINDOW_SILL = 0.9;
const WINDOW_HEAD = 2.1;

function loadHeight(type: ElectricalLoad["type"]): number {
  switch (type) {
    case "lighting":
      return WALL_HEIGHT - 0.1;
    case "outlet":
      return 0.3;
    default:
      return 1.0;
  }
}

interface WallBox {
  /** Distance range along the wall, meters. */
  from: number;
  to: number;
  /** Vertical range, meters. */
  bottom: number;
  top: number;
}

/**
 * Split one wall into boxes around its openings: solid full-height
 * segments, lintels above doors, and sill/head bands around windows.
 */
function wallBoxes(wall: Wall, openings: Opening[]): WallBox[] {
  const length = Math.hypot(
    wall.end.x - wall.start.x,
    wall.end.y - wall.start.y
  );

  if (length === 0) return [];
  const sorted = openings
    .filter((opening) => opening.wallId === wall.id)
    .sort((a, b) => a.offset - b.offset);

  const boxes: WallBox[] = [];
  let cursor = 0;

  for (const opening of sorted) {
    const from = Math.max(0, Math.min(opening.offset, length));
    const to = Math.max(0, Math.min(opening.offset + opening.width, length));

    if (from > cursor) {
      boxes.push({ from: cursor, to: from, bottom: 0, top: WALL_HEIGHT });
    }
    if (opening.kind === "door") {
      boxes.push({ from, to, bottom: DOOR_HEIGHT, top: WALL_HEIGHT });
    } else {
      boxes.push({ from, to, bottom: 0, top: WINDOW_SILL });
      boxes.push({ from, to, bottom: WINDOW_HEAD, top: WALL_HEIGHT });
    }
    cursor = Math.max(cursor, to);
  }
  if (cursor < length) {
    boxes.push({ from: cursor, to: length, bottom: 0, top: WALL_HEIGHT });
  }

  return boxes;
}

function Walls({ plan }: { plan: FloorPlan }) {
  const openings = plan.openings ?? [];

  return (
    <>
      {plan.walls.map((wall) => {
        const length = Math.hypot(
          wall.end.x - wall.start.x,
          wall.end.y - wall.start.y
        );

        if (length === 0) return null;
        const angle = Math.atan2(
          wall.end.y - wall.start.y,
          wall.end.x - wall.start.x
        );
        const ux = (wall.end.x - wall.start.x) / length;
        const uy = (wall.end.y - wall.start.y) / length;
        const thickness = wall.thickness ?? 0.15;

        return wallBoxes(wall, openings).map((box, index) => {
          const mid = (box.from + box.to) / 2;
          const midX = wall.start.x + ux * mid;
          const midY = wall.start.y + uy * mid;
          const height = box.top - box.bottom;

          if (height <= 0 || box.to - box.from <= 0) return null;

          return (
            <mesh
              key={`${wall.id}-${index}`}
              position={[midX, box.bottom + height / 2, midY]}
              rotation={[0, -angle, 0]}
            >
              <boxGeometry args={[box.to - box.from, height, thickness]} />
              <meshStandardMaterial
                color="#9ca3af"
                transparent
                opacity={0.45}
                roughness={0.8}
              />
            </mesh>
          );
        });
      })}
    </>
  );
}

function Floor({ plan, showRooms }: { plan: FloorPlan; showRooms: boolean }) {
  return (
    <>
      <mesh
        position={[plan.width / 2, -0.01, plan.height / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[plan.width, plan.height]} />
        <meshStandardMaterial color="#374151" roughness={0.9} />
      </mesh>
      {showRooms &&
        plan.rooms.map((room) => {
          const cx =
            room.boundary.reduce((sum, p) => sum + p.x, 0) /
            room.boundary.length;
          const cy =
            room.boundary.reduce((sum, p) => sum + p.y, 0) /
            room.boundary.length;

          return (
            <Text
              key={room.id}
              position={[cx, 0.02, cy]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.35}
              color="#d1d5db"
              anchorX="center"
              anchorY="middle"
            >
              {room.name}
            </Text>
          );
        })}
    </>
  );
}

function LuxHeatmap({ result }: { result: SimulationResult }) {
  return (
    <>
      {result.luxHeatmap.map((sample, index) => {
        const hue = Math.max(0, 220 - Math.min(sample.lux, 500) * 0.44);

        return (
          <mesh
            key={index}
            position={[sample.x, 0.03, sample.y]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.48, 0.48]} />
            <meshBasicMaterial
              color={`hsl(${hue}, 80%, 50%)`}
              transparent
              opacity={0.45}
            />
          </mesh>
        );
      })}
    </>
  );
}

function PanelBox({ panel }: { panel: Panel }) {
  return (
    <group position={[panel.position.x, 0, panel.position.y]}>
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[0.45, 0.65, 0.18]} />
        <meshStandardMaterial color="#1f2937" metalness={0.4} roughness={0.4} />
      </mesh>
      <Text
        position={[0, 1.85, 0]}
        fontSize={0.22}
        color="#f9fafb"
        anchorX="center"
      >
        {panel.name}
      </Text>
    </group>
  );
}

function Loads({
  loads,
  result,
  circuitIds,
  violating,
}: {
  loads: ElectricalLoad[];
  result: SimulationResult | null;
  circuitIds: string[];
  violating: Set<string | undefined>;
}) {
  const circuitByLoad = new Map<string, string>();

  for (const circuit of result?.circuits ?? []) {
    for (const loadId of circuit.loadIds) circuitByLoad.set(loadId, circuit.id);
  }

  return (
    <>
      {loads.map((load) => {
        const circuitId = circuitByLoad.get(load.id);
        const color = violating.has(circuitId)
          ? VIOLATION_COLOR
          : circuitId
            ? circuitColor(circuitId, circuitIds)
            : "#9ca3af";
        const height = loadHeight(load.type);

        return (
          <group key={load.id} position={[load.position.x, 0, load.position.y]}>
            <mesh position={[0, height, 0]}>
              <sphereGeometry args={[0.12, 16, 12]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={load.type === "lighting" ? 0.8 : 0.4}
              />
            </mesh>
            <Text
              position={[0, height + 0.28, 0]}
              fontSize={0.16}
              color="#e5e7eb"
              anchorX="center"
            >
              {load.name}
            </Text>
          </group>
        );
      })}
    </>
  );
}

function Routes({
  result,
  loads,
  panel,
  circuitIds,
  violating,
}: {
  result: SimulationResult;
  loads: ElectricalLoad[];
  panel: Panel | null;
  circuitIds: string[];
  violating: Set<string | undefined>;
}) {
  const loadById = new Map(loads.map((load) => [load.id, load]));

  return (
    <>
      {result.routes.map((route) => {
        if (route.points.length < 2) return null;
        const load = loadById.get(route.loadId);
        const color = violating.has(route.circuitId)
          ? VIOLATION_COLOR
          : circuitColor(route.circuitId, circuitIds);

        const first = route.points[0];
        const last = route.points[route.points.length - 1];
        const points: [number, number, number][] = [
          [first.x, panel ? 1.4 : 0.3, first.y],
          ...route.points.map(
            (p) => [p.x, CONDUIT_HEIGHT, p.y] as [number, number, number]
          ),
          [last.x, load ? loadHeight(load.type) : 0.3, last.y],
        ];

        return (
          <Line
            key={route.loadId}
            points={points}
            color={color}
            lineWidth={violating.has(route.circuitId) ? 3.5 : 2}
            dashed={route.fallback}
            dashSize={0.25}
            gapSize={0.15}
          />
        );
      })}
    </>
  );
}

export default function WiringOverlay3D() {
  const floorPlan = useEditorStore((state) => state.floorPlan);
  const panel = useEditorStore((state) => state.panel);
  const loads = useEditorStore((state) => state.loads);
  const result = useEditorStore((state) => state.result);
  const layers = useEditorStore((state) => state.layers);

  const circuitIds = result?.circuits.map((circuit) => circuit.id) ?? [];
  const violating = new Set(
    layers.violations
      ? (result?.violations.map((violation) => violation.circuitId) ?? [])
      : []
  );
  const visibleLoads = loads.filter((load) =>
    load.type === "lighting" ? layers.lighting : layers.loads
  );

  const centerX = floorPlan.width / 2;
  const centerZ = floorPlan.height / 2;
  const radius = Math.max(floorPlan.width, floorPlan.height);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden bg-content1/40">
      <Canvas
        camera={{
          position: [
            centerX + radius * 0.7,
            radius * 0.9,
            centerZ + radius * 0.9,
          ],
          fov: 50,
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[centerX, 12, centerZ + 6]}
          intensity={0.8}
        />

        <Floor plan={floorPlan} showRooms={layers.rooms} />
        {layers.walls && <Walls plan={floorPlan} />}
        {layers.heatmap && result && <LuxHeatmap result={result} />}
        {panel && <PanelBox panel={panel} />}
        <Loads
          loads={visibleLoads}
          result={result}
          circuitIds={circuitIds}
          violating={violating}
        />
        {layers.wiring && result && (
          <Routes
            result={result}
            loads={loads}
            panel={panel}
            circuitIds={circuitIds}
            violating={violating}
          />
        )}

        <OrbitControls target={[centerX, 1, centerZ]} enableDamping />
      </Canvas>
    </div>
  );
}
