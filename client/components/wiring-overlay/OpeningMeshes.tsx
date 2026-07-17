"use client";

/**
 * Parametric door/window meshes at each opening's exact plan position
 * (Phase 2 brief §4.1). Shared by the working 3D overlay and Showcase
 * Mode — the `variant` only changes opacity so wiring stays legible in
 * the working view; geometry is identical in both.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { FloorPlan } from "@/lib/api-client";
import {
  buildDoorGroup,
  buildWindowGroup,
  disposeOpeningGroup,
} from "@/lib/opening-geometry";
import {
  DEFAULT_DOOR_PRESET,
  DEFAULT_WINDOW_PRESET,
  DOOR_PRESETS,
  WINDOW_PRESETS,
  nearestPreset,
} from "@/lib/opening-presets";
import { wallFrame } from "@/lib/wall-geometry";

export default function OpeningMeshes({
  plan,
  variant,
  styleToken = "solence-default",
}: {
  plan: FloorPlan;
  variant: "working" | "showcase";
  styleToken?: string;
}) {
  const wallById = useMemo(
    () => new Map(plan.walls.map((wall) => [wall.id, wall])),
    [plan.walls],
  );

  const placed = useMemo(() => {
    return (plan.openings ?? []).flatMap((opening) => {
      const wall = wallById.get(opening.wallId);
      const frame = wall ? wallFrame(wall) : null;

      if (!wall || !frame) return [];

      const preset =
        opening.kind === "door"
          ? (nearestPreset(DOOR_PRESETS, opening.width) ?? DEFAULT_DOOR_PRESET)
          : (nearestPreset(WINDOW_PRESETS, opening.width) ??
            DEFAULT_WINDOW_PRESET);
      const group =
        opening.kind === "door"
          ? buildDoorGroup(
              opening.width,
              (preset as (typeof DOOR_PRESETS)[0]).params,
              styleToken,
            )
          : buildWindowGroup(
              opening.width,
              (preset as (typeof WINDOW_PRESETS)[0]).params,
              styleToken,
            );

      const mid = opening.offset + opening.width / 2;

      group.position.set(
        wall.start.x + frame.ux * mid,
        0,
        wall.start.y + frame.uy * mid,
      );
      group.rotation.y = -frame.angle;

      return [{ id: opening.id, group }];
    });
  }, [plan.openings, wallById, styleToken]);

  // Working view: keep openings translucent so wiring reads through.
  useEffect(() => {
    if (variant !== "working") return;
    for (const { group } of placed) {
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          const material = object.material as THREE.MeshStandardMaterial;

          // Clone so the shared cached materials stay opaque for showcase.
          object.material = material.clone();
          (object.material as THREE.MeshStandardMaterial).transparent = true;
          (object.material as THREE.MeshStandardMaterial).opacity = Math.min(
            0.55,
            (object.material as THREE.MeshStandardMaterial).opacity || 1,
          );
        }
      });
    }
  }, [placed, variant]);

  useEffect(() => {
    return () => {
      for (const { group } of placed) {
        disposeOpeningGroup(group);
        if (variant === "working") {
          group.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              (object.material as THREE.Material).dispose();
            }
          });
        }
      }
    };
  }, [placed, variant]);

  return (
    <>
      {placed.map(({ id, group }) => (
        <primitive key={id} object={group} />
      ))}
    </>
  );
}
