/**
 * Registration channel between ShowcaseView's scene pieces and the
 * ConstructionReveal timeline (Phase 2 §1). Components register their
 * Object3Ds via callback refs (no state, no re-renders); the timeline
 * reads the collected map once when it builds.
 */
import type * as THREE from "three";

import { createContext, useContext } from "react";

export type RevealGroup = "wall" | "roof" | "furniture" | "fixture" | "wiring";

export interface RevealRegistry {
  register(group: RevealGroup, object: THREE.Object3D | null): void;
  objects: Map<RevealGroup, Set<THREE.Object3D>>;
}

export function createRevealRegistry(): RevealRegistry {
  const objects = new Map<RevealGroup, Set<THREE.Object3D>>();

  return {
    objects,
    register(group, object) {
      if (!object) return;
      let set = objects.get(group);

      if (!set) {
        set = new Set();
        objects.set(group, set);
      }
      set.add(object);
    },
  };
}

export const RevealContext = createContext<RevealRegistry | null>(null);

export function useRevealRegister(group: RevealGroup) {
  const registry = useContext(RevealContext);

  return (object: THREE.Object3D | null) => registry?.register(group, object);
}

/** Project ids whose full reveal already played this session (§1.3). */
export const playedReveals = new Set<string>();
