"use client";

/**
 * Day/night environmental background (DESIGN.md §4 "Animated sky",
 * brief §10.3): layered SVG + CSS keyframes — deliberately NOT
 * WebGL/canvas, so it never competes with the CAD canvas for GPU.
 *
 * Day: sun with a soft pulsing glow, three parallax cloud layers
 * drifting at different speeds, warm-horizon gradient.
 * Night: multi-box-shadow star field twinkling in three offset phases,
 * a crescent-moon SVG with a backlit-dial halo, and infrequent
 * randomized shooting stars.
 *
 * Scope: rendered only by marketing/dashboard shells (landing, about,
 * projects) — never behind the active floor-plan editor. Animations
 * pause when the tab is hidden and are disabled entirely under
 * prefers-reduced-motion (see globals.css).
 *
 * Star positions come from a seeded PRNG at module scope so server and
 * client render identical box-shadows (no hydration mismatch).
 */
import React, { useEffect, useRef } from "react";

/** Deterministic PRNG (mulberry32) — stable across SSR/CSR. */
function mulberry32(seed: number) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function starShadows(count: number, seed: number, color: string): string {
  const random = mulberry32(seed);
  const shadows: string[] = [];

  for (let i = 0; i < count; i++) {
    const x = (random() * 100).toFixed(2);
    const y = (random() * 70).toFixed(2); // keep stars in the upper sky

    shadows.push(`${x}vw ${y}vh ${color}`);
  }

  return shadows.join(", ");
}

const STARS_A = starShadows(90, 7, "#E6EDF7");
const STARS_B = starShadows(60, 21, "#93A5C1");
const STARS_C = starShadows(40, 55, "#E6EDF7");

const SHOOTING_STARS = [
  { st: "12%", sl: "72%", sr: "28deg", sd: "23s", sdelay: "3s" },
  { st: "22%", sl: "38%", sr: "36deg", sd: "31s", sdelay: "12s" },
  { st: "8%", sl: "55%", sr: "22deg", sd: "41s", sdelay: "26s" },
];

function CloudBand({ seed, scale }: { seed: number; scale: number }) {
  const random = mulberry32(seed);
  const puffs = Array.from({ length: 4 }, (_, i) => ({
    cx: 90 + i * 200 + random() * 90,
    cy: 40 + random() * 25,
    r: (34 + random() * 22) * scale,
  }));

  return (
    <svg fill="white" preserveAspectRatio="none" viewBox="0 0 900 120">
      {puffs.map((puff, index) => (
        <g key={index}>
          <ellipse
            cx={puff.cx}
            cy={puff.cy}
            rx={puff.r * 1.9}
            ry={puff.r * 0.55}
          />
          <ellipse
            cx={puff.cx - puff.r * 0.7}
            cy={puff.cy + puff.r * 0.18}
            rx={puff.r}
            ry={puff.r * 0.42}
          />
          <ellipse
            cx={puff.cx + puff.r * 0.8}
            cy={puff.cy + puff.r * 0.15}
            rx={puff.r * 1.1}
            ry={puff.r * 0.4}
          />
        </g>
      ))}
    </svg>
  );
}

export default function SkyBackground() {
  const rootRef = useRef<HTMLDivElement>(null);

  // Pause every sky animation while the tab is hidden.
  useEffect(() => {
    function onVisibility() {
      rootRef.current?.classList.toggle("sky-paused", document.hidden);
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <div ref={rootRef} aria-hidden className="sky-root">
      {/* ---- Day ---- */}
      <div className="sky-day">
        <div className="sky-sun" />
        <div className="sky-clouds sky-clouds-far">
          <CloudBand scale={0.7} seed={3} />
          <CloudBand scale={0.7} seed={3} />
        </div>
        <div className="sky-clouds sky-clouds-mid">
          <CloudBand scale={1} seed={11} />
          <CloudBand scale={1} seed={11} />
        </div>
        <div className="sky-clouds sky-clouds-near">
          <CloudBand scale={1.35} seed={27} />
          <CloudBand scale={1.35} seed={27} />
        </div>
      </div>

      {/* ---- Night ---- */}
      <div className="sky-night">
        <div className="sky-stars sky-stars-a" style={{ boxShadow: STARS_A }} />
        <div className="sky-stars sky-stars-b" style={{ boxShadow: STARS_B }} />
        <div className="sky-stars sky-stars-c" style={{ boxShadow: STARS_C }} />

        <svg className="sky-moon" height="84" viewBox="0 0 84 84" width="84">
          <defs>
            <mask id="sky-moon-crescent">
              <rect fill="white" height="84" width="84" />
              <circle cx="52" cy="34" fill="black" r="30" />
            </mask>
          </defs>
          <circle
            cx="42"
            cy="42"
            fill="#E6EDF7"
            mask="url(#sky-moon-crescent)"
            r="30"
          />
        </svg>

        {SHOOTING_STARS.map((star, index) => (
          <span
            key={index}
            className="sky-shooting"
            style={
              {
                "--st": star.st,
                "--sl": star.sl,
                "--sr": star.sr,
                "--sd": star.sd,
                "--sdelay": star.sdelay,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
