"use client";

/**
 * Scroll-triggered stagger reveal for a group of sibling elements (brief
 * §10.11) — GSAP + ScrollTrigger, not Motion: this is exactly the
 * multi-element, viewport-triggered, staggered-timing case 10.11 reserves
 * for GSAP on marketing/landing pages, while in-app UI stays on Motion.
 *
 * Wraps a set of direct children (e.g. a card grid) and fades/slides each
 * one in as the group crosses into view, staggered so a grid reveals in
 * sequence rather than all at once — reinforces asymmetric/bento layouts
 * (brief §10.4) instead of reading as a flat pop-in.
 */
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

export default function ScrollReveal({
  children,
  className,
  stagger = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const prefersReduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const items = container.current
        ? Array.from(container.current.children)
        : [];

      if (prefersReduced || items.length === 0) return;

      gsap.set(items, { opacity: 0, y: 24 });
      ScrollTrigger.batch(items, {
        start: "top 80%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power2.out",
            stagger,
          }),
      });
    },
    { scope: container },
  );

  return (
    <div ref={container} className={className}>
      {children}
    </div>
  );
}
