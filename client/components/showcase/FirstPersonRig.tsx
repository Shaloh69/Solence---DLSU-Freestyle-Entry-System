"use client";

/**
 * First-person walkthrough (Phase 4 §1.2) — Showcase Mode's second
 * camera mode. PointerLockControls (the standard Three.js technique)
 * for mouse-look, WASD for movement at a realistic 1.65 m eye height,
 * cheap capsule-vs-wall collision against the same wallBoxes data the
 * shell renders from (never the detailed meshes, §1.4), scroll-to-
 * narrow-FOV "look closer" zoom (§1.1's first-person interpretation),
 * and E-to-open doors/windows animated through the parametric
 * generator's own hinge/pane data (§1.3). Open/closed state lives in
 * this component — per-session presentation state, never project data.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import gsap from "gsap";

import { FloorPlan } from "@/lib/api-client";
import { buildingBounds, wallBoxes, wallFrame } from "@/lib/wall-geometry";

export const EYE_HEIGHT = 1.65;
const BODY_RADIUS = 0.28;
const WALK_SPEED = 3.2; // m/s
const INTERACT_RANGE = 2.4;

interface WallCollider {
  // Segment in plan space (XZ), with half-thickness.
  ax: number;
  az: number;
  bx: number;
  bz: number;
  halfT: number;
}

/**
 * Collision proxies from the same wall-cut data the shell renders:
 * boxes whose vertical span overlaps the body torso block walking —
 * door gaps (lintel starts at 2.1 m) pass, window sill bands block.
 */
function buildColliders(plan: FloorPlan): WallCollider[] {
  const colliders: WallCollider[] = [];
  const openings = plan.openings ?? [];

  for (const wall of plan.walls) {
    const frame = wallFrame(wall);

    if (!frame) continue;
    for (const box of wallBoxes(wall, openings)) {
      // Torso occupies ~0.3–1.5 m; anything overlapping blocks.
      if (box.bottom >= 1.5 || box.top <= 0.3) continue;
      colliders.push({
        ax: wall.start.x + frame.ux * box.from,
        az: wall.start.y + frame.uy * box.from,
        bx: wall.start.x + frame.ux * box.to,
        bz: wall.start.y + frame.uy * box.to,
        halfT: frame.thickness / 2,
      });
    }
  }

  return colliders;
}

/** Push a point out of every collider it penetrates (2 passes). */
function resolveCollision(
  x: number,
  z: number,
  colliders: WallCollider[],
): { x: number; z: number } {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      const dx = c.bx - c.ax;
      const dz = c.bz - c.az;
      const lengthSq = dx * dx + dz * dz;

      if (lengthSq === 0) continue;
      const t = Math.max(
        0,
        Math.min(1, ((x - c.ax) * dx + (z - c.az) * dz) / lengthSq),
      );
      const px = c.ax + t * dx;
      const pz = c.az + t * dz;
      let nx = x - px;
      let nz = z - pz;
      const dist = Math.hypot(nx, nz);
      const minDist = c.halfT + BODY_RADIUS;

      if (dist < minDist) {
        if (dist < 1e-6) {
          // Dead center on the wall line: push along the wall normal.
          const len = Math.sqrt(lengthSq);

          nx = -dz / len;
          nz = dx / len;
        } else {
          nx /= dist;
          nz /= dist;
        }
        x = px + nx * minDist;
        z = pz + nz * minDist;
      }
    }
  }

  return { x, z };
}

export default function FirstPersonRig({
  plan,
  interactiveRoot,
  onPrompt,
  onLockChange,
}: {
  plan: FloorPlan;
  /** Scene subtree containing the parametric openings to interact with. */
  interactiveRoot: React.RefObject<THREE.Group | null>;
  onPrompt: (prompt: string | null) => void;
  onLockChange: (locked: boolean) => void;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<{ isLocked: boolean; lock(): void } | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const [entranceDone, setEntranceDone] = useState(false);
  // Session-only open state (§1.3): openingId -> open?
  const openState = useRef(new Map<string, boolean>());
  const targetRef = useRef<THREE.Object3D | null>(null);

  const colliders = useMemo(() => buildColliders(plan), [plan]);

  // §1.2: transition in, don't cut — tween from the orbit position to a
  // standing position at the plan's south edge, then hand over control.
  useEffect(() => {
    const bounds = buildingBounds(plan.walls, plan.width, plan.height);
    const from = camera.position.clone();
    // Stand 2 m south of the BUILDING (not the plan — plans are often
    // much larger than what's drawn on them).
    const to = new THREE.Vector3(
      (bounds.minX + bounds.maxX) / 2,
      EYE_HEIGHT,
      bounds.maxY + 2,
    );
    const lookAt = new THREE.Vector3(
      (bounds.minX + bounds.maxX) / 2,
      EYE_HEIGHT,
      (bounds.minY + bounds.maxY) / 2,
    );
    const proxy = { t: 0 };
    const tween = gsap.to(proxy, {
      t: 1,
      duration: 1.1,
      ease: "power2.inOut",
      onUpdate: () => {
        camera.position.lerpVectors(from, to, proxy.t);
        camera.lookAt(lookAt);
      },
      onComplete: () => setEntranceDone(true),
    });

    const fov = (camera as THREE.PerspectiveCamera).fov;

    return () => {
      tween.kill();
      (camera as THREE.PerspectiveCamera).fov = fov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WASD + interaction keys.
  useEffect(() => {
    function down(event: KeyboardEvent) {
      keys.current[event.code] = true;
      if (event.code === "KeyE") interact();
    }
    function up(event: KeyboardEvent) {
      keys.current[event.code] = false;
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // §1.1 first-person zoom: scroll narrows FOV ("look closer").
  useEffect(() => {
    function wheel(event: WheelEvent) {
      const cam = camera as THREE.PerspectiveCamera;

      cam.fov = Math.min(
        65,
        Math.max(28, cam.fov + Math.sign(event.deltaY) * 3),
      );
      cam.updateProjectionMatrix();
    }
    window.addEventListener("wheel", wheel);

    return () => window.removeEventListener("wheel", wheel);
  }, [camera]);

  function findInteractive(): {
    root: THREE.Object3D;
    kind: "door" | "window";
    openingId: string;
  } | null {
    if (!interactiveRoot.current) return null;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.far = INTERACT_RANGE;
    const hits = raycaster.intersectObjects(
      interactiveRoot.current.children,
      true,
    );

    for (const hit of hits) {
      let node: THREE.Object3D | null = hit.object;

      while (node) {
        if (node.userData.openingKind) {
          return {
            root: node,
            kind: node.userData.openingKind,
            openingId: node.userData.openingId,
          };
        }
        node = node.parent;
      }
    }

    return null;
  }

  function interact() {
    const target = targetRef.current;

    if (!target?.userData.openingId) return;
    const id = target.userData.openingId as string;
    const kind = target.userData.openingKind as "door" | "window";
    const opening = !openState.current.get(id);

    openState.current.set(id, opening);

    if (kind === "door") {
      // Swing every leaf pivot around its own hinge (§1.3: the swing
      // parameter defines the pivot axis).
      target.traverse((node) => {
        const pivot = node.userData.doorPivot as
          | { hingeSide: number; restY: number }
          | undefined;

        if (pivot) {
          gsap.to(node.rotation, {
            y: opening ? pivot.hingeSide * 1.9 : pivot.restY,
            duration: 0.65,
            ease: "power2.out",
          });
        }
      });
    } else {
      const config = target.userData.windowConfig as
        | { panes: number; paneWidth: number }
        | undefined;

      target.traverse((node) => {
        const pane = node.userData.windowPane as
          | { index: number; restX: number; restRotX: number }
          | undefined;

        if (!pane || !config) return;
        if (config.panes === 1) {
          // Tilt inward.
          gsap.to(node.rotation, {
            x: opening ? -0.28 : pane.restRotX,
            duration: 0.5,
            ease: "power2.out",
          });
        } else if (config.panes === 2) {
          // Slide the first pane behind the second.
          if (pane.index === 0) {
            gsap.to(node.position, {
              x: opening ? pane.restX + config.paneWidth * 0.92 : pane.restX,
              duration: 0.5,
              ease: "power2.out",
            });
          }
        } else {
          // Swing each pane slightly, casement-style.
          gsap.to(node.rotation, {
            y: opening ? 0.6 : 0,
            duration: 0.5,
            ease: "power2.out",
          });
        }
      });
    }
  }

  useFrame((_, delta) => {
    if (!entranceDone || !controlsRef.current?.isLocked) return;

    // Movement in the camera's yaw plane.
    const forward = new THREE.Vector3();

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    const move = new THREE.Vector3();

    if (keys.current.KeyW) move.add(forward);
    if (keys.current.KeyS) move.sub(forward);
    if (keys.current.KeyA) move.add(right);
    if (keys.current.KeyD) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(WALK_SPEED * delta);
      const next = resolveCollision(
        camera.position.x + move.x,
        camera.position.z + move.z,
        colliders,
      );

      // Stay on the site (ground plane + margin).
      camera.position.x = Math.min(plan.width + 6, Math.max(-6, next.x));
      camera.position.z = Math.min(plan.height + 6, Math.max(-6, next.z));
    }
    camera.position.y = EYE_HEIGHT;

    // Interaction targeting + prompt (§1.3).
    const target = findInteractive();

    targetRef.current = target?.root ?? null;
    if (target) {
      const open = openState.current.get(target.openingId);

      onPrompt(`Press E to ${open ? "close" : "open"} the ${target.kind}`);
    } else {
      onPrompt(null);
    }
  });

  return (
    <PointerLockControls
      ref={controlsRef as never}
      onLock={() => onLockChange(true)}
      onUnlock={() => onLockChange(false)}
    />
  );
}
