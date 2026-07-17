/**
 * Shared shader uniforms for Showcase Mode's environment (Phase 2 §8).
 * One mutable uniform object per concern, referenced by BOTH the grass
 * and rain shaders — mutated once per frame in ShowcaseView's single
 * useFrame, so wind coupling (§8.2: rain visibly increases sway) comes
 * free and no React re-renders happen per frame.
 */
import * as THREE from "three";

export const uTime = { value: 0 };
export const uWindStrength = { value: 0.35 };
export const uWindDirection = { value: new THREE.Vector2(1, 0.3).normalize() };
