"use client";

/**
 * Instanced grass with vertex-shader wind (Phase 2 §8.1-8.2), built
 * from the vendored `procedural-grass` skill's GLSL/InstancedMesh path
 * (.claude/skills/procedural-grass — MIT, CK42BB). Simplified to what
 * this scene needs: multi-layer wind (global sway + gust waves + per-
 * blade turbulence) computed entirely in the vertex shader, 2-tier
 * density LOD (dense near ring, sparse far ring), and scatter that
 * skips the building footprint. Zero per-frame JavaScript work — the
 * shared uTime/uWindStrength uniforms are mutated once per frame by
 * ShowcaseView.
 */
import { useMemo } from "react";
import * as THREE from "three";

import { GROUND_MARGIN } from "./GroundPlane";
import { uTime, uWindDirection, uWindStrength } from "./environment-uniforms";

const BLADE_HEIGHT = 0.28;
const BLADE_WIDTH = 0.035;
const NEAR_COUNT = 24000;
const FAR_COUNT = 8000;

const VERTEX = /* glsl */ `
  attribute vec4 aPosRot;   // xyz = world position, w = Y rotation
  attribute vec2 aScaleVar; // x = height scale, y = color variation

  uniform float uTime;
  uniform float uWindStrength;
  uniform vec2 uWindDir;

  varying float vHeight;
  varying float vColorVar;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    float heightFactor = uv.y; // 0 at root, 1 at tip
    vHeight = heightFactor;
    vColorVar = aScaleVar.y;

    // Rotate the blade around Y, scale its height per instance.
    float c = cos(aPosRot.w);
    float s = sin(aPosRot.w);
    vec3 scaled = vec3(position.x, position.y * aScaleVar.x, position.z);
    vec3 rotated = vec3(
      scaled.x * c - scaled.z * s,
      scaled.y,
      scaled.x * s + scaled.z * c
    );
    vec3 worldPos = rotated + aPosRot.xyz;

    // Multi-layer wind (skill: global sway + gusts + turbulence),
    // scaled by height^2 so roots stay planted.
    float globalPhase = dot(worldPos.xz, uWindDir) * 0.5 + uTime * 1.2;
    vec2 sway = uWindDir * sin(globalPhase) * 0.16;
    float gustPhase = dot(worldPos.xz, uWindDir) * 0.35 + uTime * 2.5;
    float gustEnv = smoothstep(0.3, 0.7, noise2D(worldPos.xz * 0.02 + uTime * 0.3));
    sway += uWindDir * sin(gustPhase) * 0.22 * gustEnv;
    float bladeHash = hash(aPosRot.xz * 10.0);
    sway += vec2(sin(uTime * 3.0 + bladeHash * 6.28),
                 cos(uTime * 2.1 + bladeHash * 6.28)) * 0.05;

    float h2 = heightFactor * heightFactor;
    worldPos.xz += sway * h2 * uWindStrength * aScaleVar.x;

    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vHeight;
  varying float vColorVar;

  void main() {
    vec3 rootColor = vec3(0.13, 0.32, 0.12);
    vec3 tipColor = vec3(0.36, 0.62, 0.26);
    vec3 color = mix(rootColor, tipColor, vHeight);
    color *= 0.9 + vColorVar * 0.2;
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** Tapered 3-segment blade; uv.y carries the 0..1 height factor. */
function bladeGeometry(): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(BLADE_WIDTH, BLADE_HEIGHT, 1, 3);

  geometry.translate(0, BLADE_HEIGHT / 2, 0);
  const positions = geometry.attributes.position;

  for (let index = 0; index < positions.count; index++) {
    const y = positions.getY(index) / BLADE_HEIGHT;

    positions.setX(index, positions.getX(index) * (1 - y * 0.85));
    // Slight forward bow so blades don't read as flat cards.
    positions.setZ(index, Math.sin(y * Math.PI * 0.5) * 0.03);
  }
  geometry.computeVertexNormals();

  return geometry;
}

function scatter(
  count: number,
  planWidth: number,
  planHeight: number,
  ring: "near" | "far",
  seed: number,
): { posRot: Float32Array; scaleVar: Float32Array } {
  // Deterministic PRNG so the field doesn't reshuffle on re-mount.
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;

    return state / 4294967296;
  };

  const posRot = new Float32Array(count * 4);
  const scaleVar = new Float32Array(count * 2);
  const nearBand = GROUND_MARGIN * 0.5;
  let placed = 0;
  let guard = 0;

  while (placed < count && guard < count * 30) {
    guard++;
    const x = -GROUND_MARGIN + random() * (planWidth + GROUND_MARGIN * 2);
    const z = -GROUND_MARGIN + random() * (planHeight + GROUND_MARGIN * 2);

    // Skip the building footprint (+pad).
    if (x > -0.4 && x < planWidth + 0.4 && z > -0.4 && z < planHeight + 0.4) {
      continue;
    }

    // Ring split: near = within nearBand of the footprint, far = beyond.
    const distance = Math.max(
      -0.4 - x,
      x - (planWidth + 0.4),
      -0.4 - z,
      z - (planHeight + 0.4),
    );
    const isNear = distance <= nearBand;

    if ((ring === "near") !== isNear) continue;

    posRot[placed * 4] = x;
    posRot[placed * 4 + 1] = 0;
    posRot[placed * 4 + 2] = z;
    posRot[placed * 4 + 3] = random() * Math.PI * 2;
    scaleVar[placed * 2] = 0.7 + random() * 0.6;
    scaleVar[placed * 2 + 1] = random();
    placed++;
  }

  return {
    posRot: posRot.subarray(0, placed * 4),
    scaleVar: scaleVar.subarray(0, placed * 2),
  };
}

function GrassRing({
  planWidth,
  planHeight,
  ring,
  count,
}: {
  planWidth: number;
  planHeight: number;
  ring: "near" | "far";
  count: number;
}) {
  const { geometry, material, instanceCount } = useMemo(() => {
    const blade = bladeGeometry();
    const { posRot, scaleVar } = scatter(
      count,
      planWidth,
      planHeight,
      ring,
      ring === "near" ? 1337 : 7331,
    );
    const instanced = new THREE.InstancedBufferGeometry();

    instanced.index = blade.index;
    instanced.attributes.position = blade.attributes.position;
    instanced.attributes.uv = blade.attributes.uv;
    instanced.attributes.normal = blade.attributes.normal;
    instanced.setAttribute(
      "aPosRot",
      new THREE.InstancedBufferAttribute(posRot, 4),
    );
    instanced.setAttribute(
      "aScaleVar",
      new THREE.InstancedBufferAttribute(scaleVar, 2),
    );
    instanced.instanceCount = posRot.length / 4;

    const shader = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uTime,
        uWindStrength,
        uWindDir: uWindDirection,
      },
      side: THREE.DoubleSide,
    });

    return {
      geometry: instanced,
      material: shader,
      instanceCount: posRot.length / 4,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planWidth, planHeight, ring, count]);

  if (instanceCount === 0) return null;

  return <mesh frustumCulled={false} geometry={geometry} material={material} />;
}

export default function GrassField({
  planWidth,
  planHeight,
}: {
  planWidth: number;
  planHeight: number;
}) {
  return (
    <>
      <GrassRing
        count={NEAR_COUNT}
        planHeight={planHeight}
        planWidth={planWidth}
        ring="near"
      />
      <GrassRing
        count={FAR_COUNT}
        planHeight={planHeight}
        planWidth={planWidth}
        ring="far"
      />
    </>
  );
}
