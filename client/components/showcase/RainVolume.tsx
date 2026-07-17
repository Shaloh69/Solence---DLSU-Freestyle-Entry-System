"use client";

/**
 * Camera-following particle rain (Phase 2 §8.3): a THREE.Points
 * cylinder of drops centered on the camera, fall recycled entirely in
 * the vertex shader via mod() — no CPU respawning per frame. Additive
 * blending (commutative, so no depth sorting needed) with a soft fade
 * near the ground so drops don't hard-clip into geometry. X/Z drift
 * follows the shared wind uniforms so rain and grass visibly agree
 * about the weather (§8.2). Mounted only while weather === "rain".
 */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import { uTime, uWindDirection, uWindStrength } from "./environment-uniforms";

const DROP_COUNT = 6000;
const VOLUME_RADIUS = 18;
const VOLUME_HEIGHT = 14;

const VERTEX = /* glsl */ `
  attribute float aSpeed;
  attribute float aPhase;

  uniform float uTime;
  uniform float uWindStrength;
  uniform vec2 uWindDir;

  varying float vGroundFade;

  void main() {
    vec3 p = position;
    // Recycle the fall: descend at aSpeed, wrap inside the volume.
    float fall = mod(aPhase + uTime * aSpeed, ${VOLUME_HEIGHT.toFixed(1)});
    p.y = ${VOLUME_HEIGHT.toFixed(1)} - fall;
    // Wind drift grows as the drop falls (relative to its spawn height).
    p.xz += uWindDir * uWindStrength * fall * 0.35;

    // Soft fade approaching the ground (last 15% of the fall).
    vGroundFade = smoothstep(0.0, ${(VOLUME_HEIGHT * 0.15).toFixed(2)}, p.y);

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = 90.0 / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vGroundFade;

  void main() {
    // Vertical streak: fade the point sprite's horizontal edges hard.
    vec2 c = gl_PointCoord - 0.5;
    float streak = 1.0 - smoothstep(0.0, 0.12, abs(c.x));
    float body = 1.0 - smoothstep(0.35, 0.5, abs(c.y));
    float alpha = streak * body * 0.35 * vGroundFade;
    gl_FragColor = vec4(vec3(0.65, 0.75, 0.9), alpha);
  }
`;

export default function RainVolume() {
  const groupRef = useRef<THREE.Group>(null);

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(DROP_COUNT * 3);
    const speeds = new Float32Array(DROP_COUNT);
    const phases = new Float32Array(DROP_COUNT);

    for (let index = 0; index < DROP_COUNT; index++) {
      const radius = Math.sqrt(Math.random()) * VOLUME_RADIUS;
      const angle = Math.random() * Math.PI * 2;

      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = 0; // y comes from the shader
      positions[index * 3 + 2] = Math.sin(angle) * radius;
      speeds[index] = 7 + Math.random() * 5;
      phases[index] = Math.random() * VOLUME_HEIGHT;
    }

    const points = new THREE.BufferGeometry();

    points.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    points.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    points.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

    const shader = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uTime, uWindStrength, uWindDir: uWindDirection },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return { geometry: points, material: shader };
  }, []);

  // Keep the drop volume centered on the camera in XZ so rain is
  // always around the viewer without particles filling the whole site.
  useFrame(({ camera }) => {
    const group = groupRef.current;

    if (group) {
      group.position.x = camera.position.x;
      group.position.z = camera.position.z;
    }
  });

  return (
    <group ref={groupRef}>
      <points frustumCulled={false} geometry={geometry} material={material} />
    </group>
  );
}
