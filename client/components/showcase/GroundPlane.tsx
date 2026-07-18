"use client";

/**
 * Showcase Mode site/lot ground (Phase 2 §8.1): a grass-toned lawn
 * extending MARGIN meters beyond the BUILDING on every side, with a
 * slightly darker pad hugging the building footprint (not the whole
 * plan — a plan is often much larger than what's drawn, and a
 * plan-sized pad swallowed the lawn as a giant gray apron).
 */
import type { BuildingBounds } from "@/lib/wall-geometry";

import { useMemo } from "react";
import * as THREE from "three";

export const GROUND_MARGIN = 8;

export default function GroundPlane({ bounds }: { bounds: BuildingBounds }) {
  const materials = useMemo(
    () => ({
      lawn: new THREE.MeshStandardMaterial({ color: "#3d7a3f", roughness: 1 }),
      pad: new THREE.MeshStandardMaterial({
        color: "#8a8f94",
        roughness: 0.95,
      }),
    }),
    [],
  );

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minY + bounds.maxY) / 2;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxY - bounds.minY;

  return (
    <>
      <mesh
        material={materials.lawn}
        position={[centerX, -0.03, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry
          args={[width + GROUND_MARGIN * 2, depth + GROUND_MARGIN * 2]}
        />
      </mesh>
      {/* building pad — slab hugging the footprint */}
      <mesh
        material={materials.pad}
        position={[centerX, -0.015, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[width + 1.2, depth + 1.2]} />
      </mesh>
    </>
  );
}
