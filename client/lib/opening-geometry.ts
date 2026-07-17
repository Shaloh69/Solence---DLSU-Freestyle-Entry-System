/**
 * Parametric door/window mesh generation (Phase 2 brief §4.1). Pure
 * builders: opening dimensions in, THREE.Group out — generated AT the
 * opening's exact width, so there is never a "does this pre-made mesh
 * fit" question. No static imported models (see
 * public/assets/models/doors/README.md).
 *
 * Local space convention: X runs along the wall (group is rotated by
 * the wall angle by the caller), Y is up, Z is across the wall's
 * thickness. Origin sits at the opening's center on the floor line.
 */
import * as THREE from "three";

import {
  DoorParams,
  OpeningStyleToken,
  STYLE_TOKENS,
  WindowParams,
} from "./opening-presets";
import { DOOR_HEIGHT, WINDOW_HEAD, WINDOW_SILL } from "./wall-geometry";

/** One material set per style token, cached across every opening. */
const materialCache = new Map<
  string,
  {
    frame: THREE.MeshStandardMaterial;
    leaf: THREE.MeshStandardMaterial;
    glass: THREE.MeshStandardMaterial;
    handle: THREE.MeshStandardMaterial;
  }
>();

export function openingMaterials(styleToken = "solence-default") {
  const cached = materialCache.get(styleToken);

  if (cached) return cached;
  const token: OpeningStyleToken =
    STYLE_TOKENS[styleToken] ?? STYLE_TOKENS["solence-default"];
  const set = {
    frame: new THREE.MeshStandardMaterial({
      color: token.frame,
      roughness: 0.7,
    }),
    leaf: new THREE.MeshStandardMaterial({ color: token.leaf, roughness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({
      color: token.glass,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      metalness: 0.1,
    }),
    handle: new THREE.MeshStandardMaterial({
      color: token.handle,
      metalness: 0.8,
      roughness: 0.3,
    }),
  };

  materialCache.set(styleToken, set);

  return set;
}

/** Frame = two jambs + a head piece around the opening rectangle. */
function buildFrame(
  width: number,
  bottom: number,
  top: number,
  params: { frameThickness: number; frameDepth: number },
  material: THREE.Material,
  withSill: boolean,
): THREE.Mesh[] {
  const { frameThickness: t, frameDepth: d } = params;
  const height = top - bottom;
  const meshes: THREE.Mesh[] = [];

  const jamb = new THREE.BoxGeometry(t, height, d);

  for (const side of [-1, 1]) {
    const mesh = new THREE.Mesh(jamb, material);

    mesh.position.set(side * (width / 2 - t / 2), bottom + height / 2, 0);
    meshes.push(mesh);
  }

  const head = new THREE.Mesh(new THREE.BoxGeometry(width, t, d), material);

  head.position.set(0, top - t / 2, 0);
  meshes.push(head);

  if (withSill) {
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.08, t, d + 0.06),
      material,
    );

    sill.position.set(0, bottom + t / 2, 0);
    meshes.push(sill);
  }

  return meshes;
}

/**
 * A hinged door: frame + leaf/leaves (slightly ajar so it reads as a
 * door, not a wall patch) + handle(s).
 */
export function buildDoorGroup(
  openingWidth: number,
  params: DoorParams,
  styleToken = "solence-default",
): THREE.Group {
  const group = new THREE.Group();
  const materials = openingMaterials(styleToken);
  const width = openingWidth; // the instance width always wins (§4.1)
  const height = Math.min(params.height, DOOR_HEIGHT);
  const t = params.frameThickness;

  for (const mesh of buildFrame(
    width,
    0,
    height,
    params,
    materials.frame,
    false,
  )) {
    group.add(mesh);
  }

  const leafCount = params.leaves;
  const leafWidth = (width - 2 * t) / leafCount;
  const leafThickness = 0.04;
  const ajar = 0.28; // radians — slightly open so depth reads

  for (let index = 0; index < leafCount; index++) {
    const pivot = new THREE.Group();
    // Hinge at the outer edge of each leaf's slot.
    const hingeSide =
      leafCount === 2
        ? index === 0
          ? -1
          : 1
        : params.swing === "left"
          ? -1
          : 1;
    const hingeX =
      leafCount === 2
        ? hingeSide * (width / 2 - t)
        : hingeSide * (width / 2 - t);

    pivot.position.set(hingeX, 0, 0);
    pivot.rotation.y = hingeSide * ajar;

    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(leafWidth, height - t, leafThickness),
      materials.leaf,
    );

    leaf.position.set((-hingeSide * leafWidth) / 2, (height - t) / 2, 0);
    pivot.add(leaf);

    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 10, 8),
      materials.handle,
    );

    handle.position.set(
      -hingeSide * (leafWidth - 0.08),
      1.0,
      leafThickness / 2 + 0.03,
    );
    pivot.add(handle);

    group.add(pivot);
  }

  return group;
}

/** A fixed window: frame + sill + glazing split into vertical panes. */
export function buildWindowGroup(
  openingWidth: number,
  params: WindowParams,
  styleToken = "solence-default",
): THREE.Group {
  const group = new THREE.Group();
  const materials = openingMaterials(styleToken);
  const width = openingWidth;
  const t = params.frameThickness;

  for (const mesh of buildFrame(
    width,
    WINDOW_SILL,
    WINDOW_HEAD,
    params,
    materials.frame,
    true,
  )) {
    group.add(mesh);
  }

  const glassHeight = WINDOW_HEAD - WINDOW_SILL - 2 * t;
  const paneWidth = (width - 2 * t - (params.panes - 1) * t) / params.panes;

  for (let index = 0; index < params.panes; index++) {
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(paneWidth, glassHeight, 0.02),
      materials.glass,
    );
    const x = -width / 2 + t + paneWidth / 2 + index * (paneWidth + t);

    glass.position.set(x, WINDOW_SILL + t + glassHeight / 2, 0);
    group.add(glass);

    if (index < params.panes - 1) {
      const mullion = new THREE.Mesh(
        new THREE.BoxGeometry(t, glassHeight, params.frameDepth),
        materials.frame,
      );

      mullion.position.set(
        x + paneWidth / 2 + t / 2,
        WINDOW_SILL + t + glassHeight / 2,
        0,
      );
      group.add(mullion);
    }
  }

  return group;
}

/** Dispose every geometry in a generated opening group (materials are cached, kept). */
export function disposeOpeningGroup(group: THREE.Group): void {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
}
