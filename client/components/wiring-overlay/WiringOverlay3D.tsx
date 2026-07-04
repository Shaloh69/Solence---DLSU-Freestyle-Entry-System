"use client";

/**
 * 3D wiring overlay: extruded walls, panel, loads, and routed wiring
 * rendered over the floor plan — color-coded by circuit, violations in
 * red, fallback (non-wall-following) runs dashed.
 *
 * Plan coordinates (x right, y down, meters) map to Three.js as
 * x -> x, y -> z, with +y up.
 */
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls, Text } from "@react-three/drei";

import {
  ElectricalLoad,
  FloorPlan,
  Panel,
  SimulationResult,
} from "@/lib/api-client";
import { useEditorStore } from "@/lib/editor-store";
import { circuitColor, VIOLATION_COLOR } from "@/lib/circuit-colors";

const WALL_HEIGHT = 2.7;
const CONDUIT_HEIGHT = 2.5;

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

function Walls({ plan }: { plan: FloorPlan }) {
  return (
    <>
      {plan.walls.map((wall) => {
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.hypot(dx, dy);

        if (length === 0) return null;
        const angle = Math.atan2(dy, dx);
        const midX = (wall.start.x + wall.end.x) / 2;
        const midY = (wall.start.y + wall.end.y) / 2;

        return (
          <mesh
            key={wall.id}
            position={[midX, WALL_HEIGHT / 2, midY]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry
              args={[length, WALL_HEIGHT, wall.thickness ?? 0.15]}
            />
            <meshStandardMaterial
              color="#9ca3af"
              transparent
              opacity={0.45}
              roughness={0.8}
            />
          </mesh>
        );
      })}
    </>
  );
}

function Floor({ plan }: { plan: FloorPlan }) {
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
      {plan.rooms.map((room) => {
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
                emissiveIntensity={0.4}
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

        // Horizontal run at conduit height with vertical drops at the
        // panel and at the load's mounting height.
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

  const circuitIds = result?.circuits.map((circuit) => circuit.id) ?? [];
  const violating = new Set(
    result?.violations.map((violation) => violation.circuitId) ?? []
  );

  const centerX = floorPlan.width / 2;
  const centerZ = floorPlan.height / 2;
  const radius = Math.max(floorPlan.width, floorPlan.height);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden bg-content1/40">
      <Canvas
        camera={{
          position: [centerX + radius * 0.7, radius * 0.9, centerZ + radius * 0.9],
          fov: 50,
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[centerX, 12, centerZ + 6]} intensity={0.8} />

        <Floor plan={floorPlan} />
        <Walls plan={floorPlan} />
        {panel && <PanelBox panel={panel} />}
        <Loads
          loads={loads}
          result={result}
          circuitIds={circuitIds}
          violating={violating}
        />
        {result && (
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
