"use client";

/**
 * Showcase Mode site/lot ground (Phase 2 §8.1): a grass-toned plane
 * extending MARGIN meters beyond the plan on every side, with a
 * slightly darker "pad" under the building footprint so the house
 * doesn't float on uniform green.
 */
import { useMemo } from "react";
import * as THREE from "three";

export const GROUND_MARGIN = 8;

export default function GroundPlane({
  planWidth,
  planHeight,
}: {
  planWidth: number;
  planHeight: number;
}) {
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

  return (
    <>
      <mesh
        material={materials.lawn}
        position={[planWidth / 2, -0.03, planHeight / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry
          args={[planWidth + GROUND_MARGIN * 2, planHeight + GROUND_MARGIN * 2]}
        />
      </mesh>
      {/* building pad — slab under the footprint */}
      <mesh
        material={materials.pad}
        position={[planWidth / 2, -0.015, planHeight / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[planWidth + 0.6, planHeight + 0.6]} />
      </mesh>
    </>
  );
}
