"use client";

/**
 * The 2D→3D construction-reveal timeline (Phase 2 §1) — Showcase
 * Mode's entry moment. One GSAP timeline (the named exception to the
 * "Motion for in-app UI" rule, §1.2): camera pulls from top-down to
 * perspective → walls rise staggered → roof settles → furniture drops
 * in → fixtures light up → wiring overlay fades in last.
 *
 * §1.3 rules honored here: transforms/opacity only on pre-built
 * geometry (never regenerated), full play once per project per
 * session, instant cut on subsequent toggles and under
 * prefers-reduced-motion, OrbitControls disabled while GSAP drives the
 * camera (damping fights tweens otherwise).
 */
import { useContext, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { playedReveals, RevealContext } from "./reveal-registry";

export default function ConstructionReveal({
  projectId,
  planWidth,
  planHeight,
  controlsRef,
}: {
  projectId: string;
  planWidth: number;
  planHeight: number;
  controlsRef: React.RefObject<{ enabled: boolean; update(): void } | null>;
}) {
  const registry = useContext(RevealContext);
  const { camera } = useThree();
  const builtFor = useRef<string | null>(null);

  useGSAP(
    () => {
      if (!registry || builtFor.current === projectId) return;
      builtFor.current = projectId;

      const walls = [...(registry.objects.get("wall") ?? [])];
      const roofs = [...(registry.objects.get("roof") ?? [])];
      const furniture = [...(registry.objects.get("furniture") ?? [])];
      const fixtures = [...(registry.objects.get("fixture") ?? [])];
      const wiring = [...(registry.objects.get("wiring") ?? [])];

      const centerX = planWidth / 2;
      const centerZ = planHeight / 2;
      const radius = Math.max(planWidth, planHeight);

      const camFrom = new THREE.Vector3(centerX, radius * 1.6, centerZ + 0.01);
      const camTo = new THREE.Vector3(
        centerX + radius * 0.85,
        radius * 0.7,
        centerZ + radius * 1.05,
      );
      const lookAt = new THREE.Vector3(centerX, 1, centerZ);

      // Collect wiring materials once for the closing fade.
      const wiringMaterials: (THREE.Material & { opacity: number })[] = [];

      for (const group of wiring) {
        group.traverse((object) => {
          const material = (object as THREE.Mesh).material as
            | THREE.Material
            | undefined;

          if (material && !wiringMaterials.includes(material)) {
            material.transparent = true;
            wiringMaterials.push(material);
          }
        });
      }

      // Fixture emissive materials, deduped (shared material = 1 tween).
      const fixtureMaterials = new Set<THREE.MeshStandardMaterial>();

      for (const mesh of fixtures) {
        const material = (mesh as THREE.Mesh)
          .material as THREE.MeshStandardMaterial;

        if (material?.emissive) fixtureMaterials.add(material);
      }

      const timeline = gsap.timeline({
        onStart: () => {
          if (controlsRef.current) controlsRef.current.enabled = false;
        },
        onComplete: () => {
          if (controlsRef.current) {
            controlsRef.current.enabled = true;
            controlsRef.current.update();
          }
        },
      });

      // Initial states (§1.1) — set, not animated, so an instant cut
      // via progress(1) lands on the exact final state.
      for (const wall of walls) wall.scale.y = 0.001;
      for (const roof of roofs) {
        roof.position.y += 3;
        const material = (roof as THREE.Mesh).material as THREE.Material;

        if (material) material.transparent = true;
      }
      for (const piece of furniture) {
        piece.userData.revealY = piece.position.y;
        piece.position.y += 3;
        piece.visible = false;
      }
      for (const material of fixtureMaterials) material.emissiveIntensity = 0;
      for (const material of wiringMaterials) material.opacity = 0;

      const camProxy = { t: 0 };

      timeline
        .to(camProxy, {
          t: 1,
          duration: 1.4,
          ease: "power2.inOut",
          onUpdate: () => {
            camera.position.lerpVectors(camFrom, camTo, camProxy.t);
            camera.lookAt(lookAt);
          },
        })
        .to(
          walls.map((wall) => wall.scale),
          {
            y: 1,
            duration: 0.8,
            ease: "power2.out",
            stagger: { each: 0.02, from: "start" },
          },
          "-=0.5",
        )
        .to(
          roofs.map((roof) => roof.position),
          { y: "-=3", duration: 0.6, ease: "power3.out" },
          ">-0.1",
        )
        .add(() => {
          for (const piece of furniture) piece.visible = true;
        })
        .to(
          furniture.map((piece) => piece.position),
          {
            y: (index: number) => furniture[index].userData.revealY as number,
            duration: 0.55,
            ease: "back.out(1.4)",
            stagger: 0.05,
          },
        )
        .to(
          [...fixtureMaterials],
          { emissiveIntensity: 1, duration: 0.7, ease: "power1.in" },
          ">-0.2",
        )
        .to(wiringMaterials, { opacity: 0.95, duration: 0.6 }, ">");

      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduceMotion || playedReveals.has(projectId)) {
        timeline.progress(1); // instant cut to the finished state
      } else {
        playedReveals.add(projectId);
      }
    },
    { dependencies: [projectId] },
  );

  return null;
}
