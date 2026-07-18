"use client";

/**
 * Showcase Mode (Phase 2 §0.1) — the same building as the working
 * views, presented as a finished, inhabited place: opaque shell,
 * parametric doors/windows, furniture, lit fixtures, site grass, wind,
 * optional rain, and the construction-reveal entry (§1). Reads the
 * exact same editor store as the 2D canvas and 3D overlay (single
 * source of truth, §11.2) but is presentation-only: no selection, no
 * gizmos, no compliance chrome.
 *
 * Wall/furniture meshes are wrapped with their pivot at the BASE
 * (group at y=0, mesh offset up by h/2) so the reveal's scale.y grows
 * them out of the ground — the working view's center-pivot meshes are
 * untouched by this convention.
 */
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { CloudRain, Footprints, Moon, Orbit, Sun, Wind } from "lucide-react";

import ConstructionReveal from "./ConstructionReveal";
import FirstPersonRig from "./FirstPersonRig";
import GroundPlane from "./GroundPlane";
import GrassField from "./GrassField";
import RainVolume from "./RainVolume";
import {
  createRevealRegistry,
  RevealContext,
  useRevealRegister,
} from "./reveal-registry";
import { uTime, uWindStrength } from "./environment-uniforms";

import OpeningMeshes from "@/components/wiring-overlay/OpeningMeshes";
import {
  CONDUIT_HEIGHT,
  WALL_HEIGHT,
  wallBoxes,
  wallFrame,
} from "@/lib/wall-geometry";
import { cctToHex } from "@/lib/cct";
import { circuitColor, VIOLATION_COLOR } from "@/lib/circuit-colors";
import { useEditorStore } from "@/lib/editor-store";

const FURNITURE_COLORS: Record<string, string> = {
  table: "#8a5a2b",
  chair: "#9a6a3a",
  sofa: "#4a6741",
  bed: "#6b4a6e",
  wardrobe: "#7a5230",
  desk: "#8a5a2b",
  counter: "#5d6d7e",
  cabinet: "#7a5230",
  "lamp-floor": "#d9c48a",
  "lamp-table": "#d9c48a",
  rug: "#7d5a5a",
  appliance: "#cfd4d8",
  plant: "#3f7a44",
  mirror: "#a9c4cf",
};

function useShowcaseMaterials() {
  return useMemo(
    () => ({
      wall: new THREE.MeshStandardMaterial({
        color: "#e8e2d5",
        roughness: 0.9,
      }),
      roof: new THREE.MeshStandardMaterial({
        color: "#7d6b5d",
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
      floor: new THREE.MeshStandardMaterial({
        color: "#b9a68a",
        roughness: 0.85,
      }),
      panel: new THREE.MeshStandardMaterial({
        color: "#37474f",
        metalness: 0.4,
        roughness: 0.5,
      }),
    }),
    [],
  );
}

/** Opaque wall shell with base pivots so scale.y grows from the ground. */
function ShowcaseShell({
  materials,
}: {
  materials: ReturnType<typeof useShowcaseMaterials>;
}) {
  const floorPlan = useEditorStore((state) => state.floorPlan);
  const registerWall = useRevealRegister("wall");
  const registerRoof = useRevealRegister("roof");
  const openings = floorPlan.openings ?? [];

  const roomShapes = useMemo(
    () =>
      floorPlan.rooms.map((room) => ({
        id: room.id,
        geometry: new THREE.ShapeGeometry(
          new THREE.Shape(
            room.boundary.map((point) => new THREE.Vector2(point.x, point.y)),
          ),
        ),
      })),
    [floorPlan.rooms],
  );

  return (
    <>
      {floorPlan.walls.map((wall) => {
        const frame = wallFrame(wall);

        if (!frame) return null;
        const { angle, ux, uy, thickness } = frame;

        return wallBoxes(wall, openings).map((box, index) => {
          const mid = (box.from + box.to) / 2;
          const height = box.top - box.bottom;

          if (height <= 0 || box.to - box.from <= 0) return null;

          return (
            <group
              key={`${wall.id}-${index}`}
              ref={registerWall}
              position={[wall.start.x + ux * mid, 0, wall.start.y + uy * mid]}
              rotation={[0, -angle, 0]}
            >
              <mesh
                material={materials.wall}
                position={[0, box.bottom + height / 2, 0]}
              >
                <boxGeometry args={[box.to - box.from, height, thickness]} />
              </mesh>
            </group>
          );
        });
      })}

      {/* room floors */}
      {roomShapes.map((room) => (
        <mesh
          key={room.id}
          geometry={room.geometry}
          material={materials.floor}
          position={[0, 0.006, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1, -1, 1]}
        />
      ))}

      {/* roof slab */}
      <mesh
        ref={registerRoof}
        material={materials.roof}
        position={[
          floorPlan.width / 2,
          WALL_HEIGHT + 0.05,
          floorPlan.height / 2,
        ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[floorPlan.width + 0.3, floorPlan.height + 0.3]} />
      </mesh>
    </>
  );
}

function ShowcaseFurniture() {
  const floorPlan = useEditorStore((state) => state.floorPlan);
  const register = useRevealRegister("furniture");

  const materials = useMemo(() => {
    const cache = new Map<string, THREE.MeshStandardMaterial>();

    for (const [key, color] of Object.entries(FURNITURE_COLORS)) {
      cache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    }

    return cache;
  }, []);

  return (
    <>
      {(floorPlan.furniture ?? []).map((piece) => (
        <group
          key={piece.id}
          ref={register}
          position={[piece.position.x, 0, piece.position.y]}
          rotation={[0, -piece.rotation, 0]}
        >
          <mesh
            material={materials.get(piece.meshKey) ?? materials.get("table")}
            position={[0, piece.height / 2, 0]}
          >
            <boxGeometry args={[piece.width, piece.height, piece.depth]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/**
 * Fixture meshes + real point lights, tinted by each fixture's CCT
 * (§9.1a): a 2700K bedroom visibly reads warmer than a 4000K kitchen.
 * Materials are cached per rounded CCT so a building with two color
 * temperatures uses two materials, not one per fixture.
 */
function ShowcaseFixtures({ dimmed }: { dimmed: boolean }) {
  const loads = useEditorStore((state) => state.loads);
  const register = useRevealRegister("fixture");
  const fixtures = loads.filter((load) => load.type === "lighting");

  const materialFor = useMemo(() => {
    const cache = new Map<number, THREE.MeshStandardMaterial>();

    return (cct: number) => {
      const key = Math.round(cct / 100) * 100;
      let material = cache.get(key);

      if (!material) {
        material = new THREE.MeshStandardMaterial({
          color: "#f5e6c4",
          emissive: cctToHex(key),
          emissiveIntensity: 1,
        });
        cache.set(key, material);
      }

      return material;
    };
  }, []);

  const lightIntensity = dimmed ? 0.15 : 0.6;

  return (
    <>
      {fixtures.map((load) => (
        <mesh
          key={load.id}
          ref={register}
          material={materialFor(load.cct ?? 3000)}
          position={[load.position.x, WALL_HEIGHT - 0.12, load.position.y]}
        >
          <cylinderGeometry args={[0.09, 0.12, 0.08, 12]} />
        </mesh>
      ))}
      {fixtures.map((load) => (
        <pointLight
          key={`pl-${load.id}`}
          color={cctToHex(load.cct ?? 3000)}
          distance={4.5}
          intensity={lightIntensity}
          position={[load.position.x, WALL_HEIGHT - 0.35, load.position.y]}
        />
      ))}
    </>
  );
}

function ShowcaseWiring() {
  const result = useEditorStore((state) => state.result);
  const loads = useEditorStore((state) => state.loads);
  const layers = useEditorStore((state) => state.layers);
  const register = useRevealRegister("wiring");

  if (!layers.wiring || !result) return null;
  const circuitIds = result.circuits.map((circuit) => circuit.id);
  const loadById = new Map(loads.map((load) => [load.id, load]));

  return (
    <group ref={register}>
      {result.routes.map((route) => {
        if (route.points.length < 2) return null;
        const load = loadById.get(route.loadId);
        const color = circuitColor(route.circuitId, circuitIds);
        const points: [number, number, number][] = [
          ...route.points.map(
            (p) => [p.x, CONDUIT_HEIGHT, p.y] as [number, number, number],
          ),
        ];

        if (load) {
          points.push([load.position.x, WALL_HEIGHT - 0.15, load.position.y]);
        }

        return (
          <Line
            key={route.loadId}
            transparent
            color={color === VIOLATION_COLOR ? color : color}
            lineWidth={1.5}
            points={points}
          />
        );
      })}
    </group>
  );
}

/** Single per-frame uniform tick — grass + rain both read these. */
function EnvironmentTick() {
  const weather = useEditorStore((state) => state.weather);
  const windIntensity = useEditorStore((state) => state.windIntensity);

  useFrame((_, delta) => {
    uTime.value += delta;
    // Rain visibly raises wind sway (§8.2/§8.3 coupling).
    const target = weather === "rain" ? windIntensity + 0.35 : windIntensity;

    uWindStrength.value += (target - uWindStrength.value) * 0.05;
  });

  return null;
}

export default function ShowcaseView() {
  const projectId = useEditorStore((state) => state.projectId);
  const floorPlan = useEditorStore((state) => state.floorPlan);
  const panel = useEditorStore((state) => state.panel);
  const weather = useEditorStore((state) => state.weather);
  const setWeather = useEditorStore((state) => state.setWeather);
  const windIntensity = useEditorStore((state) => state.windIntensity);
  const setWindIntensity = useEditorStore((state) => state.setWindIntensity);
  const timeOfDay = useEditorStore((state) => state.timeOfDay);
  const setTimeOfDay = useEditorStore((state) => state.setTimeOfDay);

  const materials = useShowcaseMaterials();
  const registry = useMemo(() => createRevealRegistry(), []);
  const controlsRef = useRef<{ enabled: boolean; update(): void } | null>(null);
  // P4 §1.2: Showcase's second camera mode. Session-only state.
  const [cameraMode, setCameraMode] = useState<"orbit" | "walk">("orbit");
  const [pointerLocked, setPointerLocked] = useState(false);
  const [interactPrompt, setInteractPrompt] = useState<string | null>(null);
  const openingsRootRef = useRef<THREE.Group | null>(null);

  const radius = Math.max(floorPlan.width, floorPlan.height);
  const centerX = floorPlan.width / 2;
  const centerZ = floorPlan.height / 2;

  // §9.1a day/night: a VISUALIZATION state — the sun dims and fixtures
  // carry the scene at night; compliance counts are night-based always,
  // so nothing electrical changes with this toggle.
  const night = timeOfDay === "night";
  const skyColor = night
    ? "#0d1524"
    : weather === "rain"
      ? "#4a5866"
      : "#87b5d8";
  const sunIntensity = night ? 0.05 : weather === "rain" ? 0.5 : 1.1;
  const ambientIntensity = night ? 0.18 : weather === "rain" ? 0.45 : 0.65;

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden bg-content1/40">
      <Canvas
        camera={{
          position: [centerX, radius * 1.6, centerZ + 0.01],
          fov: 50,
        }}
        shadows={false}
      >
        <RevealContext.Provider value={registry}>
          <color args={[skyColor]} attach="background" />
          <fog args={[skyColor, radius * 2, radius * 6]} attach="fog" />
          <ambientLight intensity={ambientIntensity} />
          <directionalLight
            intensity={sunIntensity}
            position={[centerX + 10, 16, centerZ - 6]}
          />

          <GroundPlane
            planHeight={floorPlan.height}
            planWidth={floorPlan.width}
          />
          <GrassField
            planHeight={floorPlan.height}
            planWidth={floorPlan.width}
          />
          {weather === "rain" && <RainVolume />}

          <ShowcaseShell materials={materials} />
          <group ref={openingsRootRef}>
            <OpeningMeshes plan={floorPlan} variant="showcase" />
          </group>
          <ShowcaseFurniture />
          <ShowcaseFixtures dimmed={!night} />
          <ShowcaseWiring />
          {panel && (
            <mesh
              material={materials.panel}
              position={[panel.position.x, 1.4, panel.position.y]}
            >
              <boxGeometry args={[0.45, 0.65, 0.18]} />
            </mesh>
          )}

          <EnvironmentTick />
          {projectId && cameraMode === "orbit" && (
            <ConstructionReveal
              controlsRef={controlsRef}
              planHeight={floorPlan.height}
              planWidth={floorPlan.width}
              projectId={projectId}
            />
          )}

          {cameraMode === "orbit" ? (
            <OrbitControls
              ref={controlsRef as never}
              enableDamping
              maxDistance={radius * 3}
              maxPolarAngle={Math.PI / 2 - 0.05}
              minDistance={2}
              target={[centerX, 1, centerZ]}
            />
          ) : (
            <FirstPersonRig
              interactiveRoot={openingsRootRef}
              plan={floorPlan}
              onLockChange={setPointerLocked}
              onPrompt={setInteractPrompt}
            />
          )}
        </RevealContext.Provider>
      </Canvas>

      {/* P4 §1.2 walkthrough overlays: crosshair + interaction prompt +
          click-to-look hint. Session-only presentation state. */}
      {cameraMode === "walk" && (
        <>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white/80 ring-1 ring-black/40" />
          </div>
          {interactPrompt && pointerLocked && (
            <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 rounded-lg bg-content1/90 border border-default-200 px-3 py-1.5 font-mono text-xs">
              {interactPrompt}
            </div>
          )}
          {!pointerLocked && (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center">
              <span className="rounded-lg bg-content1/90 border border-default-200 px-3 py-1.5 font-mono text-xs">
                Click the scene to look around · WASD to walk · E to open
                doors/windows · scroll to look closer · Esc to release
              </span>
            </div>
          )}
        </>
      )}

      {/* Showcase chrome: day/night + weather + wind — presentation only;
          §9.1a: the toggle never changes compliance results. */}
      <div className="absolute top-2 right-2 flex items-center gap-2 rounded-lg bg-content1/90 px-2 py-1.5 border border-default-200">
        <button
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${cameraMode === "walk" ? "bg-brand-teal/25 text-brand-teal" : "text-default-500"}`}
          title="First-person walkthrough (P4 §1.2) — WASD + mouse-look, E opens doors/windows"
          type="button"
          onClick={() =>
            setCameraMode(cameraMode === "walk" ? "orbit" : "walk")
          }
        >
          {cameraMode === "walk" ? (
            <>
              <Orbit size={13} /> Orbit
            </>
          ) : (
            <>
              <Footprints size={13} /> Walk
            </>
          )}
        </button>
        <span className="border-l border-default-200 h-4" />
        <button
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${night ? "bg-brand-teal/25 text-brand-teal" : "text-default-500"}`}
          title="Night view — fixtures carry the scene at their CCT colors. Compliance is always computed for night regardless."
          type="button"
          onClick={() => setTimeOfDay(night ? "day" : "night")}
        >
          <Moon size={13} /> {night ? "Night" : "Day"}
        </button>
        <span className="border-l border-default-200 h-4" />
        <button
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${weather === "clear" ? "bg-brand-teal/25 text-brand-teal" : "text-default-500"}`}
          type="button"
          onClick={() => setWeather("clear")}
        >
          <Sun size={13} /> Clear
        </button>
        <button
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${weather === "rain" ? "bg-brand-teal/25 text-brand-teal" : "text-default-500"}`}
          type="button"
          onClick={() => setWeather("rain")}
        >
          <CloudRain size={13} /> Rain
        </button>
        <span className="flex items-center gap-1 pl-1 border-l border-default-200 text-default-500">
          <Wind size={13} />
          <input
            aria-label="Wind intensity"
            className="w-16 accent-teal-500"
            max={1}
            min={0}
            step={0.05}
            type="range"
            value={windIntensity}
            onChange={(event) =>
              setWindIntensity(parseFloat(event.target.value))
            }
          />
        </span>
      </div>
    </div>
  );
}
