import { FC } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { title } from "@/components/primitives";

/**
 * Landing page per /DESIGN.md: technical instrument-panel aesthetic —
 * asymmetric hero with a schematic visual, dense spec-sheet feature
 * list. Deliberately not the centered-hero-plus-icon-cards template.
 */

const SPECS: { index: string; name: string; detail: string }[] = [
  {
    index: "01",
    name: "Wire routing",
    detail:
      "A* wall-following pathfinding from every load to the panel; doors are routable gaps, standoff 0.2 m.",
  },
  {
    index: "02",
    name: "Load calculation",
    detail:
      "Branch and feeder loads with PEC Section 2 demand factors; panel schedule generated per run.",
  },
  {
    index: "03",
    name: "Breaker & conductor sizing",
    detail:
      "AWG/mm² and breaker rating per circuit via PEC Table 3.10.1; 125% continuous rule; 3-phase balancing.",
  },
  {
    index: "04",
    name: "Live PEC compliance",
    detail:
      "Ampacity, 80% continuous-load, 3%/5% voltage drop, GFCI by room type — rechecked on every edit.",
  },
  {
    index: "05",
    name: "Lighting design layer",
    detail:
      "Lumen-method auto-placement per room, per-room lux analysis against targets, heatmap overlay.",
  },
  {
    index: "06",
    name: "Permit-ready export",
    detail:
      "Wiring diagram, panel schedule, conductor schedule, and panel directory as a single PDF.",
  },
];

/** Blueprint-style schematic: mini plan + routed circuits + violation. */
const SchematicHero: FC = () => (
  <svg
    aria-hidden
    className="w-full h-auto rounded-panel border border-brand-navy-border bg-brand-navy"
    viewBox="0 0 400 300"
  >
    {/* grid dots */}
    {Array.from({ length: 13 }, (_, row) =>
      Array.from({ length: 17 }, (_, col) => (
        <circle
          key={`${row}-${col}`}
          cx={20 + col * 22.5}
          cy={20 + row * 21.5}
          r={0.8}
          fill="#24406B"
        />
      ))
    )}
    {/* walls */}
    <g stroke="#93A5C1" strokeWidth={5} strokeLinecap="square">
      <line x1={40} y1={40} x2={360} y2={40} />
      <line x1={360} y1={40} x2={360} y2={260} />
      <line x1={360} y1={260} x2={40} y2={260} />
      <line x1={40} y1={260} x2={40} y2={40} />
      <line x1={200} y1={40} x2={200} y2={140} />
      <line x1={200} y1={185} x2={200} y2={260} />
    </g>
    {/* door swing */}
    <path
      d="M 200 185 A 45 45 0 0 1 245 140"
      fill="none"
      stroke="#93A5C1"
      strokeWidth={1}
      strokeDasharray="3 3"
    />
    {/* panel */}
    <rect
      x={48}
      y={48}
      width={16}
      height={24}
      fill="#1B3358"
      stroke="#E6EDF7"
      strokeWidth={1.5}
    />
    <text x={70} y={64} fontSize={10} fill="#93A5C1" fontFamily="monospace">
      LP-1
    </text>
    {/* circuits */}
    <g fill="none" strokeWidth={2.5} strokeLinejoin="round">
      <polyline points="56,72 56,240 120,240 120,200" stroke="#4E79A7" />
      <polyline points="56,72 56,56 180,56 180,100" stroke="#F28E2B" />
      <polyline
        points="56,72 56,56 190,56 190,162 260,162 260,220 320,220"
        stroke="#59A14F"
      />
      <polyline
        points="56,72 56,56 340,56 340,120"
        stroke="#E15759"
        strokeDasharray="6 4"
      />
    </g>
    {/* loads */}
    <circle cx={120} cy={200} r={6} fill="#4E79A7" stroke="#E6EDF7" strokeWidth={1.5} />
    <circle cx={180} cy={100} r={6} fill="#F28E2B" stroke="#E6EDF7" strokeWidth={1.5} />
    <circle cx={320} cy={220} r={6} fill="#59A14F" stroke="#E6EDF7" strokeWidth={1.5} />
    <circle cx={340} cy={120} r={6} fill="#E15759" stroke="#E6EDF7" strokeWidth={1.5} />
    {/* violation callout */}
    <text x={252} y={112} fontSize={9} fill="#E15759" fontFamily="monospace">
      voltage-drop 3.4% ▲
    </text>
    {/* mono annotations */}
    <text x={40} y={285} fontSize={9} fill="#5A6B85" fontFamily="monospace">
      ckt-1 20A · 3.5mm² THHN — 12.4 m
    </text>
    <text x={250} y={285} fontSize={9} fill="#5A6B85" fontFamily="monospace">
      PEC T.3.10.1 · Section 2
    </text>
  </svg>
);

const Home: FC = () => {
  return (
    <section className="w-full max-w-6xl mx-auto px-6">
      {/* Hero — asymmetric, left-aligned */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center py-14 md:py-20">
        <div>
          <p className="font-mono text-xs text-brand-teal mb-3 tracking-widest uppercase">
            Electrical design · Philippine Electrical Code
          </p>
          <h1 className="font-display font-bold tracking-tight text-4xl md:text-5xl leading-tight">
            Draw the floor plan.
            <br />
            <span className={title({ color: "brand" })}>Solence wires it.</span>
          </h1>
          <p className="mt-5 text-default-600 max-w-lg">
            Auto-routed branch wiring, sized breakers and conductors, live
            PEC compliance checks, and lumen-method lighting design — from a
            floor plan to a permit-ready PDF, without hand drafting in CAD.
          </p>
          <div className="flex gap-3 mt-8">
            <Link
              href="/projects"
              className="bg-brand-teal-dark hover:bg-brand-teal transition-colors px-6 py-2.5 rounded-control text-white font-medium flex items-center gap-2"
            >
              Open a project
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/about"
              className="border border-default-300 hover:border-brand-teal transition-colors px-6 py-2.5 rounded-control font-medium"
            >
              How it works
            </Link>
          </div>
          <p className="font-mono text-xs text-default-400 mt-8">
            3% max branch VD · 80% continuous rule · PEC Table 3.10.1 ·
            wall-following A*
          </p>
        </div>
        <SchematicHero />
      </div>

      {/* Capabilities — dense spec sheet, not icon cards */}
      <div className="py-10 md:py-16">
        <h2 className="font-display font-semibold text-2xl mb-1">
          What the engine computes
        </h2>
        <p className="text-default-500 text-sm mb-8">
          Every figure below is produced by the same backend engine the PDF
          export uses — nothing is drawn by hand twice.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
          {SPECS.map((spec) => (
            <div
              key={spec.index}
              className="flex gap-4 py-4 border-t border-default-200"
            >
              <span className="font-mono text-sm text-brand-amber pt-0.5 shrink-0">
                {spec.index}
              </span>
              <div>
                <p className="font-medium">{spec.name}</p>
                <p className="text-sm text-default-500 mt-1">{spec.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Closing strip — bordered, no gradient */}
      <div className="mb-16 rounded-panel border border-default-200 bg-content1/60 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h2 className="font-display font-semibold text-xl">
            Find violations at design time, not at inspection.
          </h2>
          <p className="text-default-500 text-sm mt-1 max-w-xl">
            MERALCO/LGU rework costs ₱50,000–500,000 when a violation
            surfaces on site. Solence flags it while the wire is still a
            line on the screen.
          </p>
        </div>
        <Link
          href="/projects"
          className="bg-brand-teal-dark hover:bg-brand-teal transition-colors px-6 py-2.5 rounded-control text-white font-medium whitespace-nowrap flex items-center gap-2"
        >
          Start designing
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
};

export default Home;
