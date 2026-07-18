"use client";

/**
 * 3D wiring overlay — the CAD viewport's orbit view.
 *
 * Geometry (brief §7.7): walls extrude with deterministic door/window
 * cuts (lintels + sill/head bands, no CSG), a floor plane per room,
 * and a translucent flat roof slab; wiring runs at conduit height with
 * drops to each load, color-coded by circuit (violations red).
 *
 * Performance (brief §4.5, after mlightcad/CAD-Viewer's technique):
 *  - InstancedMesh for repeated geometry: one draw call for ALL load
 *    markers and one for the entire lux heatmap, instead of a mesh per
 *    object.
 *  - Material caching: one shared material per surface kind; instance
 *    colors carry per-object state instead of per-object materials.
 *  - Level-of-detail: the heatmap (the most GPU-expensive layer) drops
 *    to half resolution when the camera is far, restoring on zoom-in.
 * Route polylines stay one drei <Line> per circuit run — counts are
 * small (tens) and each needs its own dash state.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import {
  Line,
  OrbitControls,
  Text,
  TransformControls,
} from "@react-three/drei";

import OpeningMeshes from "./OpeningMeshes";

import {
  ElectricalLoad,
  FloorPlan,
  Furniture,
  LuxSample,
  Panel,
  SimulationResult,
} from "@/lib/api-client";
import { Selection, useEditorStore } from "@/lib/editor-store";
import { circuitColor, VIOLATION_COLOR } from "@/lib/circuit-colors";
import {
  CONDUIT_HEIGHT,
  WALL_HEIGHT,
  wallBoxes,
  wallFrame,
} from "@/lib/wall-geometry";

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

/* ---------- shared, cached materials (§4.5: material caching) ---------- */

function useSharedMaterials() {
  const materials = useMemo(
    () => ({
      wall: new THREE.MeshStandardMaterial({
        color: "#9ca3af",
        transparent: true,
        opacity: 0.45,
        roughness: 0.8,
      }),
      floor: new THREE.MeshStandardMaterial({
        color: "#374151",
        roughness: 0.9,
      }),
      roomFloor: new THREE.MeshStandardMaterial({
        color: "#4b5f7a",
        transparent: true,
        opacity: 0.5,
        roughness: 0.9,
      }),
      roof: new THREE.MeshStandardMaterial({
        color: "#9ca3af",
        transparent: true,
        opacity: 0.12,
        roughness: 0.9,
        side: THREE.DoubleSide,
      }),
      panel: new THREE.MeshStandardMaterial({
        color: "#1f2937",
        metalness: 0.4,
        roughness: 0.4,
      }),
      // White base; per-instance colors multiply against it.
      loadInstance: new THREE.MeshStandardMaterial({ color: "#ffffff" }),
      heatmapInstance: new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.45,
      }),
    }),
    [],
  );

  useLayoutEffect(() => {
    return () => {
      for (const material of Object.values(materials)) material.dispose();
    };
  }, [materials]);

  return materials;
}

/* ---------- walls with opening cuts (math shared via lib/wall-geometry) ---------- */

function Walls({
  plan,
  material,
}: {
  plan: FloorPlan;
  material: THREE.Material;
}) {
  const openings = plan.openings ?? [];

  return (
    <>
      {plan.walls.map((wall) => {
        const frame = wallFrame(wall);

        if (!frame) return null;
        const { angle, ux, uy, thickness } = frame;

        return wallBoxes(wall, openings).map((box, index) => {
          const mid = (box.from + box.to) / 2;
          const height = box.top - box.bottom;

          if (height <= 0 || box.to - box.from <= 0) return null;

          return (
            <mesh
              key={`${wall.id}-${index}`}
              material={material}
              position={[
                wall.start.x + ux * mid,
                box.bottom + height / 2,
                wall.start.y + uy * mid,
              ]}
              rotation={[0, -angle, 0]}
            >
              <boxGeometry args={[box.to - box.from, height, thickness]} />
            </mesh>
          );
        });
      })}
    </>
  );
}

/* ---------- floors per room + roof (§7.7) ---------- */

function RoomFloorsAndRoof({
  plan,
  materials,
  showRooms,
  showRoof,
}: {
  plan: FloorPlan;
  materials: ReturnType<typeof useSharedMaterials>;
  showRooms: boolean;
  showRoof: boolean;
}) {
  const roomGeometries = useMemo(
    () =>
      plan.rooms.map((room) => {
        const shape = new THREE.Shape(
          room.boundary.map((point) => new THREE.Vector2(point.x, point.y)),
        );

        return { id: room.id, geometry: new THREE.ShapeGeometry(shape) };
      }),
    [plan.rooms],
  );

  useLayoutEffect(() => {
    return () => roomGeometries.forEach((room) => room.geometry.dispose());
  }, [roomGeometries]);

  return (
    <>
      {/* base ground plane */}
      <mesh
        material={materials.floor}
        position={[plan.width / 2, -0.02, plan.height / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[plan.width, plan.height]} />
      </mesh>

      {/* floor plane per room */}
      {roomGeometries.map((room) => (
        <mesh
          key={room.id}
          geometry={room.geometry}
          material={materials.roomFloor}
          position={[0, 0.005, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1, -1, 1]}
        />
      ))}

      {/* room labels */}
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
              anchorX="center"
              anchorY="middle"
              color="#d1d5db"
              fontSize={0.35}
              position={[cx, 0.03, cy]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              {room.name}
            </Text>
          );
        })}

      {/* flat roof slab — translucent so the wiring stays visible */}
      {showRoof && (
        <mesh
          material={materials.roof}
          position={[plan.width / 2, WALL_HEIGHT + 0.02, plan.height / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[plan.width, plan.height]} />
        </mesh>
      )}
    </>
  );
}

/* ---------- instanced loads (§4.5: instancing) ---------- */

function InstancedLoads({
  loads,
  colors,
  material,
  onSelect,
}: {
  loads: ElectricalLoad[];
  colors: string[];
  material: THREE.Material;
  onSelect: (id: string) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;

    if (!mesh) return;
    loads.forEach((load, index) => {
      matrix.setPosition(
        load.position.x,
        loadHeight(load.type),
        load.position.y,
      );
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, color.set(colors[index]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [loads, colors, matrix, color]);

  if (loads.length === 0) return null;

  return (
    <instancedMesh
      key={loads.length}
      ref={meshRef}
      args={[undefined, undefined, loads.length]}
      material={material}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        const index = event.instanceId;

        if (index != null && loads[index]) onSelect(loads[index].id);
      }}
    >
      <sphereGeometry args={[0.12, 16, 12]} />
    </instancedMesh>
  );
}

/* ---------- furniture (§11.1) — individual meshes, low counts ---------- */

function furnitureGeometryArgs(piece: Furniture): [number, number, number] {
  return [piece.width, piece.height, piece.depth];
}

function FurniturePieces({
  pieces,
  selectedId,
  onSelect,
}: {
  pieces: Furniture[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#d97706", roughness: 0.7 }),
    [],
  );

  useLayoutEffect(() => () => material.dispose(), [material]);

  return (
    <>
      {pieces.map((piece) => (
        <mesh
          key={piece.id}
          material={material}
          position={[piece.position.x, piece.height / 2, piece.position.y]}
          rotation={[0, -piece.rotation, 0]}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(piece.id);
          }}
        >
          <boxGeometry args={furnitureGeometryArgs(piece)} />
          {piece.id === selectedId && (
            <lineSegments>
              <edgesGeometry
                args={[new THREE.BoxGeometry(...furnitureGeometryArgs(piece))]}
              />
              <lineBasicMaterial color="#14B8A6" />
            </lineSegments>
          )}
        </mesh>
      ))}
    </>
  );
}

/* ---------- selection gizmo (§11.2) — bidirectional 2D/3D manipulation ---------- */

function SelectionGizmo({
  mode,
  onDragStateChange,
}: {
  mode: "translate" | "rotate";
  onDragStateChange: (dragging: boolean) => void;
}) {
  const selection = useEditorStore((state) => state.selection);
  const loads = useEditorStore((state) => state.loads);
  const panel = useEditorStore((state) => state.panel);
  const floorPlan = useEditorStore((state) => state.floorPlan);
  const moveItem = useEditorStore((state) => state.moveItem);
  const rotateFurniture = useEditorStore((state) => state.rotateFurniture);
  const proxyRef = useRef<THREE.Mesh>(null);
  // TransformControls fires onChange for EVERY controls update — camera
  // orbits and programmatic proxy moves included, not just user drags.
  // Syncing to the store outside a real drag loops: sync -> store write
  // -> re-render -> controls update -> onChange -> sync… ("Maximum
  // update depth exceeded"). Only sync between mouseDown and mouseUp.
  const draggingRef = useRef(false);

  const target = useMemo(() => {
    if (selection?.kind === "load") {
      const load = loads.find((candidate) => candidate.id === selection.id);

      if (!load) return null;

      return {
        selection,
        position: [load.position.x, loadHeight(load.type), load.position.y] as [
          number,
          number,
          number,
        ],
        rotationY: 0,
        rotatable: false,
      };
    }
    if (selection?.kind === "panel" && panel) {
      return {
        selection,
        position: [panel.position.x, 1.4, panel.position.y] as [
          number,
          number,
          number,
        ],
        rotationY: 0,
        rotatable: false,
      };
    }
    if (selection?.kind === "furniture") {
      const piece = (floorPlan.furniture ?? []).find(
        (candidate) => candidate.id === selection.id,
      );

      if (!piece) return null;

      return {
        selection,
        position: [piece.position.x, piece.height / 2, piece.position.y] as [
          number,
          number,
          number,
        ],
        rotationY: -piece.rotation,
        rotatable: true,
      };
    }

    return null;
  }, [selection, loads, panel, floorPlan.furniture]);

  useLayoutEffect(() => {
    const proxy = proxyRef.current;

    if (!proxy || !target) return;
    proxy.position.set(...target.position);
    proxy.rotation.set(0, target.rotationY, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    target?.selection,
    target?.position[0],
    target?.position[1],
    target?.position[2],
    target?.rotationY,
  ]);

  if (!target) return null;

  function syncFromProxy() {
    const proxy = proxyRef.current;

    if (!proxy || !target || !draggingRef.current) return;
    const point = { x: proxy.position.x, y: proxy.position.z };

    if (target.selection.kind === "furniture") {
      moveItem(target.selection as Selection, point);
      rotateFurniture(
        (target.selection as { id: string }).id,
        -proxy.rotation.y,
      );
    } else {
      moveItem(target.selection as Selection, point);
    }
  }

  const effectiveMode = target.rotatable ? mode : "translate";

  return (
    <TransformControls
      mode={effectiveMode}
      showX={effectiveMode === "translate"}
      showY={effectiveMode === "rotate"}
      showZ={effectiveMode === "translate"}
      onChange={syncFromProxy}
      onMouseDown={() => {
        draggingRef.current = true;
        onDragStateChange(true);
      }}
      onMouseUp={() => {
        syncFromProxy();
        draggingRef.current = false;
        onDragStateChange(false);
      }}
    >
      <mesh ref={proxyRef} visible={false}>
        <boxGeometry args={[0.35, 0.35, 0.35]} />
      </mesh>
    </TransformControls>
  );
}

/* ---------- instanced lux heatmap with LOD (§4.5) ---------- */

function InstancedHeatmap({
  samples,
  material,
  planCenter,
}: {
  samples: LuxSample[];
  material: THREE.Material;
  planCenter: [number, number];
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();
  const [coarse, setCoarse] = useState(false);

  // LOD: drop to half resolution when the camera is far from the plan.
  useFrame(() => {
    const distance = camera.position.distanceTo(
      new THREE.Vector3(planCenter[0], 0, planCenter[1]),
    );
    const shouldBeCoarse = distance > 24;

    if (shouldBeCoarse !== coarse) setCoarse(shouldBeCoarse);
  });

  const visible = useMemo(
    () => (coarse ? samples.filter((_, index) => index % 2 === 0) : samples),
    [samples, coarse],
  );

  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const rotation = useMemo(
    () =>
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
    [],
  );
  const scale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const color = useMemo(() => new THREE.Color(), []);
  const position = useMemo(() => new THREE.Vector3(), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;

    if (!mesh) return;
    const size = coarse ? 1.4 : 1;

    visible.forEach((sample, index) => {
      position.set(sample.x, 0.04, sample.y);
      scale.set(size, size, size);
      matrix.compose(position, rotation, scale);
      mesh.setMatrixAt(index, matrix);
      const hue = Math.max(0, 220 - Math.min(sample.lux, 500) * 0.44) / 360;

      mesh.setColorAt(index, color.setHSL(hue, 0.8, 0.5));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [visible, coarse, matrix, rotation, scale, color, position]);

  if (visible.length === 0) return null;

  return (
    <instancedMesh
      key={visible.length}
      ref={meshRef}
      args={[undefined, undefined, visible.length]}
      material={material}
    >
      <planeGeometry args={[0.48, 0.48]} />
    </instancedMesh>
  );
}

/* ---------- panel + routes ---------- */

function PanelBox({
  panel,
  material,
  onSelect,
}: {
  panel: Panel;
  material: THREE.Material;
  onSelect: () => void;
}) {
  return (
    <group position={[panel.position.x, 0, panel.position.y]}>
      <mesh
        material={material}
        position={[0, 1.4, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <boxGeometry args={[0.45, 0.65, 0.18]} />
      </mesh>
      <Text
        anchorX="center"
        color="#f9fafb"
        fontSize={0.22}
        position={[0, 1.85, 0]}
      >
        {panel.name}
      </Text>
    </group>
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
            (p) => [p.x, CONDUIT_HEIGHT, p.y] as [number, number, number],
          ),
          [last.x, load ? loadHeight(load.type) : 0.3, last.y],
        ];

        return (
          <Line
            key={route.loadId}
            color={color}
            dashSize={0.25}
            dashed={route.fallback}
            gapSize={0.15}
            lineWidth={violating.has(route.circuitId) ? 3.5 : 2}
            points={points}
          />
        );
      })}
    </>
  );
}

/* ---------- scene ---------- */

function Scene({ gizmoMode }: { gizmoMode: "translate" | "rotate" }) {
  const floorPlan = useEditorStore((state) => state.floorPlan);
  const panel = useEditorStore((state) => state.panel);
  const loads = useEditorStore((state) => state.loads);
  const result = useEditorStore((state) => state.result);
  const layers = useEditorStore((state) => state.layers);
  const selection = useEditorStore((state) => state.selection);
  const setSelection = useEditorStore((state) => state.setSelection);
  const materials = useSharedMaterials();
  const [orbitEnabled, setOrbitEnabled] = useState(true);

  const circuitIds = result?.circuits.map((circuit) => circuit.id) ?? [];
  const violating = new Set(
    layers.violations
      ? (result?.violations.map((violation) => violation.circuitId) ?? [])
      : [],
  );
  const circuitByLoad = new Map<string, string>();

  for (const circuit of result?.circuits ?? []) {
    for (const loadId of circuit.loadIds) circuitByLoad.set(loadId, circuit.id);
  }

  const visibleLoads = loads.filter((load) =>
    load.type === "lighting" ? layers.lighting : layers.loads,
  );
  const loadColors = visibleLoads.map((load) => {
    const circuitId = circuitByLoad.get(load.id);

    return violating.has(circuitId)
      ? VIOLATION_COLOR
      : circuitId
        ? circuitColor(circuitId, circuitIds)
        : "#9ca3af";
  });

  const centerX = floorPlan.width / 2;
  const centerZ = floorPlan.height / 2;

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight intensity={0.8} position={[centerX, 12, centerZ + 6]} />

      <RoomFloorsAndRoof
        materials={materials}
        plan={floorPlan}
        showRoof={layers.walls}
        showRooms={layers.rooms}
      />
      {layers.walls && <Walls material={materials.wall} plan={floorPlan} />}
      {layers.walls && <OpeningMeshes plan={floorPlan} variant="working" />}
      {layers.heatmap && result && (
        <InstancedHeatmap
          material={materials.heatmapInstance}
          planCenter={[centerX, centerZ]}
          samples={result.luxHeatmap}
        />
      )}
      {panel && (
        <PanelBox
          material={materials.panel}
          panel={panel}
          onSelect={() => setSelection({ kind: "panel" })}
        />
      )}

      <InstancedLoads
        colors={loadColors}
        loads={visibleLoads}
        material={materials.loadInstance}
        onSelect={(id) => setSelection({ kind: "load", id })}
      />
      {layers.furniture && (
        <FurniturePieces
          pieces={floorPlan.furniture ?? []}
          selectedId={selection?.kind === "furniture" ? selection.id : null}
          onSelect={(id) => setSelection({ kind: "furniture", id })}
        />
      )}
      {visibleLoads.map((load) => (
        <Text
          key={load.id}
          anchorX="center"
          color="#e5e7eb"
          fontSize={0.16}
          position={[
            load.position.x,
            loadHeight(load.type) + 0.28,
            load.position.y,
          ]}
        >
          {load.name}
        </Text>
      ))}

      {layers.wiring && result && (
        <Routes
          circuitIds={circuitIds}
          loads={loads}
          panel={panel}
          result={result}
          violating={violating}
        />
      )}

      {selection && (
        <SelectionGizmo
          mode={gizmoMode}
          onDragStateChange={(dragging) => setOrbitEnabled(!dragging)}
        />
      )}

      <OrbitControls
        enableDamping
        enabled={orbitEnabled}
        maxDistance={Math.max(floorPlan.width, floorPlan.height) * 3}
        minDistance={2}
        target={[centerX, 1, centerZ]}
      />
    </>
  );
}

export default function WiringOverlay3D() {
  const floorPlan = useEditorStore((state) => state.floorPlan);
  const selection = useEditorStore((state) => state.selection);
  const setSelection = useEditorStore((state) => state.setSelection);
  const radius = Math.max(floorPlan.width, floorPlan.height);
  const [gizmoMode, setGizmoMode] = useState<"translate" | "rotate">(
    "translate",
  );

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden bg-content1/40">
      <Canvas
        camera={{
          position: [
            floorPlan.width / 2 + radius * 0.7,
            radius * 0.9,
            floorPlan.height / 2 + radius * 0.9,
          ],
          fov: 50,
        }}
        onPointerMissed={() => setSelection(null)}
      >
        <Scene gizmoMode={gizmoMode} />
      </Canvas>
      {selection?.kind === "furniture" && (
        <div className="absolute top-2 right-2 flex gap-1 rounded-lg bg-content1/90 p-1 border border-default-200">
          <button
            className={`px-2 py-1 rounded text-xs ${gizmoMode === "translate" ? "bg-brand-teal/30 text-brand-teal" : "text-default-500"}`}
            type="button"
            onClick={() => setGizmoMode("translate")}
          >
            Move
          </button>
          <button
            className={`px-2 py-1 rounded text-xs ${gizmoMode === "rotate" ? "bg-brand-teal/30 text-brand-teal" : "text-default-500"}`}
            type="button"
            onClick={() => setGizmoMode("rotate")}
          >
            Rotate
          </button>
        </div>
      )}
    </div>
  );
}
