import { FC, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import SkyBackground from "@/components/SkyBackground";

/**
 * Landing page — built from docs/component-specs/landing.md against
 * /DESIGN.md (brief §10.4–10.6). Nine sections: hero, problem/solution
 * bento, process diagram, feature deep-dive with real engine output,
 * scope spec-sheet, market section, pricing, roadmap, final CTA.
 */

/* ---------- shared chrome ---------- */

function Eyebrow({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p
      className="font-mono text-[11px] font-medium uppercase tracking-widest text-brand-amber-dark dark:text-brand-amber"
      id={id}
    >
      {children}
    </p>
  );
}

/** Card with drafting-style corner registration marks + mono index. */
function RegCard({
  index,
  title,
  children,
  className = "",
}: {
  index?: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const corner = "absolute w-3 h-3 border-brand-teal/60";

  return (
    <div
      className={`relative bg-content1/70 border border-default-200 rounded-panel p-6 ${className}`}
    >
      <span className={`${corner} top-1.5 left-1.5 border-t border-l`} />
      <span className={`${corner} top-1.5 right-1.5 border-t border-r`} />
      <span className={`${corner} bottom-1.5 left-1.5 border-b border-l`} />
      <span className={`${corner} bottom-1.5 right-1.5 border-b border-r`} />
      {index && (
        <span className="font-mono text-xs text-brand-amber-dark dark:text-brand-amber">
          {index}
        </span>
      )}
      <h3 className="font-display font-semibold text-lg mt-1">{title}</h3>
      <div className="text-sm text-default-600 mt-2">{children}</div>
    </div>
  );
}

/* ---------- section 1: hero + animated schematic ---------- */

const SchematicHero: FC = () => (
  <svg
    aria-hidden
    className="w-full h-auto rounded-panel border border-brand-navy-border bg-brand-navy"
    viewBox="0 0 400 300"
  >
    {Array.from({ length: 13 }, (_, row) =>
      Array.from({ length: 17 }, (_, col) => (
        <circle
          key={`${row}-${col}`}
          cx={20 + col * 22.5}
          cy={20 + row * 21.5}
          fill="#24406B"
          r={0.8}
        />
      ))
    )}
    <g stroke="#93A5C1" strokeLinecap="square" strokeWidth={5}>
      <line x1={40} x2={360} y1={40} y2={40} />
      <line x1={360} x2={360} y1={40} y2={260} />
      <line x1={360} x2={40} y1={260} y2={260} />
      <line x1={40} x2={40} y1={260} y2={40} />
      <line x1={200} x2={200} y1={40} y2={140} />
      <line x1={200} x2={200} y1={185} y2={260} />
    </g>
    <path
      d="M 200 185 A 45 45 0 0 1 245 140"
      fill="none"
      stroke="#93A5C1"
      strokeDasharray="3 3"
      strokeWidth={1}
    />
    <rect
      fill="#1B3358"
      height={24}
      stroke="#E6EDF7"
      strokeWidth={1.5}
      width={16}
      x={48}
      y={48}
    />
    <text fill="#93A5C1" fontFamily="monospace" fontSize={10} x={70} y={64}>
      LP-1
    </text>
    {/* Wires draw themselves in (CSS stroke-dash, staggered) */}
    <g fill="none" strokeLinejoin="round" strokeWidth={2.5}>
      <polyline
        className="schematic-wire"
        points="56,72 56,240 120,240 120,200"
        stroke="#4E79A7"
      />
      <polyline
        className="schematic-wire"
        points="56,72 56,56 180,56 180,100"
        stroke="#F28E2B"
      />
      <polyline
        className="schematic-wire"
        points="56,72 56,56 190,56 190,162 260,162 260,220 320,220"
        stroke="#59A14F"
      />
      <polyline
        className="schematic-wire"
        points="56,72 56,56 340,56 340,120"
        stroke="#E15759"
        strokeDasharray="6 4"
      />
    </g>
    <circle cx={120} cy={200} fill="#4E79A7" r={6} stroke="#E6EDF7" strokeWidth={1.5} />
    <circle cx={180} cy={100} fill="#F28E2B" r={6} stroke="#E6EDF7" strokeWidth={1.5} />
    <circle cx={320} cy={220} fill="#59A14F" r={6} stroke="#E6EDF7" strokeWidth={1.5} />
    <circle cx={340} cy={120} fill="#E15759" r={6} stroke="#E6EDF7" strokeWidth={1.5} />
    <text fill="#E15759" fontFamily="monospace" fontSize={9} x={252} y={112}>
      voltage-drop 3.4% ▲
    </text>
    <text fill="#5A6B85" fontFamily="monospace" fontSize={9} x={40} y={285}>
      ckt-1 20A · 3.5mm² THHN — 12.4 m
    </text>
    <text fill="#5A6B85" fontFamily="monospace" fontSize={9} x={250} y={285}>
      PEC T.3.10.1 · Section 2
    </text>
  </svg>
);

/* ---------- section 3: process diagram ---------- */

const STEPS = [
  { label: "Draw or import", detail: "Walls, rooms, doors — or a PDF/image trace" },
  { label: "Place loads", detail: "Outlets, lighting, HVAC from the library" },
  { label: "Auto-route", detail: "Wall-following A* to the panel" },
  { label: "Auto-calculate", detail: "Loads + demand per PEC Section 2" },
  { label: "Auto-size", detail: "Breakers + conductors per T.3.10.1" },
  { label: "Export", detail: "Permit-ready PDF with schedules" },
];

/* ---------- section 4: feature visuals (real engine output shapes) ---------- */

function ViolationVisual() {
  return (
    <div className="bg-content1/70 border border-default-200 rounded-panel p-4 space-y-2">
      <div className="flex items-start gap-3 p-3 rounded-control bg-danger/10 border border-danger/40">
        <span className="font-mono text-[11px] uppercase tracking-wider text-danger mt-0.5">
          error
        </span>
        <div>
          <p className="text-sm">
            Circuit ckt-4: branch voltage drop 3.42% exceeds the 3% branch
            limit (18.5 m run at 15.6 A)
          </p>
          <p className="font-mono text-[11px] text-default-400 mt-1">
            voltage-drop-branch · PEC voltage drop recommendation
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3 p-3 rounded-control bg-danger/10 border border-danger/40">
        <span className="font-mono text-[11px] uppercase tracking-wider text-danger mt-0.5">
          error
        </span>
        <p className="text-sm">
          Outlet &quot;Counter outlet&quot; in Kitchen must be GFCI-protected
        </p>
      </div>
    </div>
  );
}

function ScheduleVisual() {
  const rows = [
    ["1", "Refrigerator", "A", "1,200", "15 A", "2.0 mm² THHN"],
    ["2", "Kitchen lights", "B", "300", "15 A", "2.0 mm² THHN"],
    ["3", "A/C split type", "A", "1,800", "20 A", "3.5 mm² THHN"],
  ];

  return (
    <div className="bg-content1/70 border border-default-200 rounded-panel p-4 overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="font-mono text-[11px] uppercase tracking-wider text-default-500">
            <th className="pb-2 pr-3">Ckt</th>
            <th className="pb-2 pr-3">Description</th>
            <th className="pb-2 pr-3">Ph</th>
            <th className="pb-2 pr-3">VA</th>
            <th className="pb-2 pr-3">Breaker</th>
            <th className="pb-2">Conductor</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-default-200">
              {row.map((cell, index) => (
                <td key={index} className="py-2 pr-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="font-mono text-[10px] text-default-400 mt-2">
        Main 60 A · Phase A 3,000 VA / Phase B 300 VA · PEC-VERIFY pending
      </p>
    </div>
  );
}

function HeatmapVisual() {
  // Same hue ramp the editor's lux heatmap uses (220 -> 0 by lux).
  const cells = [
    40, 80, 120, 90, 50, 70, 160, 240, 180, 80, 90, 220, 320, 260, 100, 70,
    170, 250, 190, 85, 45, 85, 130, 95, 55,
  ];

  return (
    <div className="bg-content1/70 border border-default-200 rounded-panel p-4">
      <div className="grid grid-cols-5 gap-1">
        {cells.map((lux, index) => (
          <div
            key={index}
            className="aspect-square rounded-chip"
            style={{
              backgroundColor: `hsl(${Math.max(0, 220 - Math.min(lux, 500) * 0.44)}, 80%, 50%)`,
              opacity: 0.75,
            }}
          />
        ))}
      </div>
      <p className="font-mono text-[10px] text-default-400 mt-3">
        Kitchen · avg 305 lx vs 300 lx target · 18 fixtures (lumen method)
      </p>
    </div>
  );
}

function MiniSchematic({ violation = false }: { violation?: boolean }) {
  return (
    <svg
      aria-hidden
      className="w-full h-auto rounded-panel border border-brand-navy-border bg-brand-navy"
      viewBox="0 0 300 170"
    >
      <g stroke="#93A5C1" strokeLinecap="square" strokeWidth={4}>
        <rect fill="none" height={130} width={260} x={20} y={20} />
        <line x1={150} x2={150} y1={20} y2={80} />
        <line x1={150} x2={150} y1={110} y2={150} />
      </g>
      <rect fill="#1B3358" height={18} stroke="#E6EDF7" width={12} x={28} y={28} />
      <g fill="none" strokeWidth={2}>
        <polyline points="34,46 34,130 110,130" stroke="#4E79A7" />
        <polyline points="34,46 34,32 200,32 200,95" stroke="#59A14F" />
        {violation && (
          <polyline
            points="34,46 34,32 250,32 250,120"
            stroke="#E15759"
            strokeDasharray="5 3"
          />
        )}
      </g>
      <circle cx={110} cy={130} fill="#4E79A7" r={5} stroke="#E6EDF7" />
      <circle cx={200} cy={95} fill="#59A14F" r={5} stroke="#E6EDF7" />
      {violation && <circle cx={250} cy={120} fill="#E15759" r={5} stroke="#E6EDF7" />}
    </svg>
  );
}

const FEATURES: {
  eyebrow: string;
  title: string;
  body: string;
  visual: ReactNode;
}[] = [
  {
    eyebrow: "Routing",
    title: "Wall-following auto-routing",
    body: "Every load routes to the panel over a rasterized walkability grid — wire hugs walls at a 0.2 m standoff, crosses through doorways, and never beelines across open floor. A* over the plan, compressed into clean orthogonal runs.",
    visual: <MiniSchematic />,
  },
  {
    eyebrow: "Sizing",
    title: "Breakers and conductors, sized per circuit",
    body: "Connected and continuous VA roll up per circuit; the 125% continuous rule sets required ampacity, the next standard breaker is selected, and the conductor is sized to protect against that breaker from PEC Table 3.10.1 — never just against the load.",
    visual: <ScheduleVisual />,
  },
  {
    eyebrow: "Compliance",
    title: "Violations at design time, not at inspection",
    body: "Nine rule modules re-run on every edit: ampacity, the 80% continuous-load rule, 3%/5% voltage drop over the actual routed length, GFCI by room type, and photometric under-/over-lighting. Results push live over WebSocket.",
    visual: <ViolationVisual />,
  },
  {
    eyebrow: "3D overlay",
    title: "The whole design, in 3D",
    body: "Walls extrude with door and window cuts; wiring renders at conduit height with drops to each load, color-coded by circuit with violations in red. CAD layers toggle walls, loads, lighting, wiring, and the heatmap independently.",
    visual: <MiniSchematic violation />,
  },
  {
    eyebrow: "Lighting layer",
    title: "Lumen-method lighting design, built in",
    body: "The original BEPVY photometric engine places the fewest fixtures that meet each room's lux target, then verifies achieved illuminance per room. Fixtures are ordinary loads — same circuits, same sizing, same wiring engine.",
    visual: <HeatmapVisual />,
  },
];

/* ---------- section 5: scope table ---------- */

const SCOPE_ROWS: [string, string, "shipping" | "planned"][] = [
  ["Single-phase 2-wire (120 V) / 3-wire (120/240 V)", "Residential", "shipping"],
  ["Branch auto-sizing: lighting / appliance / laundry", "Residential", "shipping"],
  ["Service entrance & main breaker auto-sizing", "Residential", "shipping"],
  ["GFCI requirements by room type", "Residential", "shipping"],
  ["3-phase 4-wire (230/400 V) load balancing", "Commercial", "shipping"],
  ["Motor branch circuits (FLA / MCA / MOCP)", "Commercial", "planned"],
  ["Transformer sizing · bus duct · switchgear", "Commercial", "planned"],
  ["Emergency / egress circuit separation", "Commercial", "planned"],
];

/* ---------- section 8: roadmap ---------- */

const ROADMAP = [
  { tag: "V2", label: "AI floor-plan recognition" },
  { tag: "V2", label: "BIM / IFC export" },
  { tag: "V3", label: "Short-circuit analysis" },
  { tag: "V3", label: "AR inspection overlay" },
];

/* ---------- page ---------- */

const Home: FC = () => {
  return (
    <>
      <div className="fixed inset-0 z-0 pointer-events-none">
        <SkyBackground />
      </div>

      <section className="relative w-full max-w-6xl mx-auto">
        {/* 1 — Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center py-16 md:py-24">
          <div>
            <Eyebrow>Electrical design · Philippine Electrical Code</Eyebrow>
            <h1 className="font-display font-bold tracking-tight text-4xl md:text-5xl leading-tight mt-3">
              Draw the floor plan.
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-b from-[#14B8A6] to-[#0D9488]">
                Solence wires it.
              </span>
            </h1>
            <p className="mt-5 text-default-600 max-w-lg">
              Auto-routed branch wiring, sized breakers and conductors, live
              PEC compliance checks, and lumen-method lighting design — from
              a floor plan to a permit-ready PDF, without hand drafting in
              CAD.
            </p>
            <div className="flex gap-3 mt-8">
              <Link
                className="bg-brand-teal-dark hover:bg-brand-teal transition-colors px-6 py-2.5 rounded-control text-white font-medium flex items-center gap-2"
                href="/projects"
              >
                Open a project
                <ArrowRight size={16} />
              </Link>
              <Link
                className="border border-default-300 hover:border-brand-teal transition-colors px-6 py-2.5 rounded-control font-medium"
                href="/about"
              >
                Why we built this
              </Link>
            </div>
            <p className="font-mono text-xs text-default-400 mt-8">
              3% max branch VD · 80% continuous rule · PEC Table 3.10.1 ·
              wall-following A*
            </p>
          </div>
          <SchematicHero />
        </div>

        {/* 2 — Problem / Solution bento */}
        <div className="py-14 md:py-24">
          <Eyebrow>The problem</Eyebrow>
          <h2 className="font-display font-semibold text-3xl tracking-tight mt-2 mb-8">
            Violations surface at inspection — when they’re most expensive
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 lg:row-span-2 relative bg-content1/70 border border-default-200 border-l-4 border-l-danger rounded-panel p-8">
              <span className="font-mono text-xs text-danger">PROBLEM</span>
              <h3 className="font-display font-semibold text-2xl mt-2">
                Load calcs by hand, drafting with no automation, code checks
                at the very end
              </h3>
              <p className="text-default-600 mt-3 max-w-xl">
                Philippine electrical engineers and licensed master
                electricians compute loads manually, draft wiring in AutoCAD
                with no engine behind it, and only discover PEC violations at
                MERALCO/LGU inspection — after the design is on paper and the
                wire is in the wall.
              </p>
              <div className="mt-6 font-mono">
                <p className="text-3xl font-medium text-danger">
                  ₱50,000–500,000
                </p>
                <p className="text-xs text-default-500 mt-1">
                  typical rework cost per inspection-stage violation
                </p>
              </div>
            </div>
            <RegCard index="01" title="Compute while you draw">
              Loads, demand factors, and feeder ampacity recompute on every
              edit — the panel schedule is never stale.
            </RegCard>
            <RegCard index="02" title="Code checks are continuous">
              Nine PEC rule modules run against the live design and push
              results the moment recompute finishes.
            </RegCard>
            <RegCard index="03" title="Manual override, always">
              Every AI result — routes, sizes, fixtures — is an ordinary
              editable object. Automation proposes; the engineer decides.
            </RegCard>
          </div>
        </div>

        {/* 3 — How it works: connected process diagram */}
        <div className="py-14 md:py-24" id="how-it-works">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="font-display font-semibold text-3xl tracking-tight mt-2 mb-10">
            Six steps, one engine
          </h2>
          <ol className="relative flex flex-col lg:flex-row gap-8 lg:gap-0">
            {/* connecting rail */}
            <span
              aria-hidden
              className="absolute hidden lg:block top-5 left-[4%] right-[4%] h-px bg-default-300"
            />
            <span
              aria-hidden
              className="absolute lg:hidden top-2 bottom-2 left-5 w-px bg-default-300"
            />
            {STEPS.map((step, index) => (
              <li
                key={step.label}
                className="relative flex lg:flex-col items-start gap-4 lg:flex-1 lg:px-2"
              >
                <span className="relative z-10 flex items-center justify-center w-10 h-10 shrink-0 rounded-chip border border-brand-teal bg-background font-mono text-sm text-brand-teal-dark dark:text-brand-teal">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-medium">{step.label}</p>
                  <p className="text-xs text-default-500 mt-1">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* 4 — Feature deep-dive */}
        <div className="py-14 md:py-24 space-y-16" id="features">
          <div>
            <Eyebrow>Capabilities</Eyebrow>
            <h2 className="font-display font-semibold text-3xl tracking-tight mt-2">
              Real engine output — not mockups
            </h2>
            <p className="text-default-500 text-sm mt-2 max-w-2xl">
              The visuals below are the same shapes the engine produces: its
              violation messages, its schedule rows, its lux analysis. What
              you see on this page is what the tool computes.
            </p>
          </div>
          {FEATURES.map((feature, index) => (
            <div
              key={feature.title}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center"
            >
              <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                <Eyebrow>{feature.eyebrow}</Eyebrow>
                <h3 className="font-display font-semibold text-2xl tracking-tight mt-2">
                  {feature.title}
                </h3>
                <p className="text-default-600 mt-3">{feature.body}</p>
              </div>
              <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                {feature.visual}
              </div>
            </div>
          ))}
        </div>

        {/* 5 — Scope comparison spec sheet */}
        <div className="py-14 md:py-24" id="scope">
          <Eyebrow>Simulation scope</Eyebrow>
          <h2 className="font-display font-semibold text-3xl tracking-tight mt-2 mb-8">
            Residential today, commercial next
          </h2>
          <div className="bg-content1/70 border border-default-200 rounded-panel overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="font-mono text-[11px] uppercase tracking-wider text-default-500 border-b border-default-200">
                  <th className="p-4">Capability</th>
                  <th className="p-4">Class</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {SCOPE_ROWS.map(([capability, klass, status]) => (
                  <tr
                    key={capability}
                    className="border-b border-default-200 last:border-0"
                  >
                    <td className="p-4 text-sm">{capability}</td>
                    <td className="p-4 font-mono text-xs text-default-500">
                      {klass}
                    </td>
                    <td className="p-4">
                      <span
                        className={`font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-chip border ${
                          status === "shipping"
                            ? "text-success border-success/50 bg-success/10"
                            : "text-default-500 border-default-300"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6 — Market credibility */}
        <div className="py-14 md:py-24">
          <Eyebrow>Built for the Philippine market</Eyebrow>
          <h2 className="font-display font-semibold text-3xl tracking-tight mt-2 mb-8">
            The code is the PEC. The inspector is MERALCO/LGU. The tool
            should know both.
          </h2>
          {/* TODO(Hubs): exact deck figures — PRC-licensed EE count and
              Metro Cebu monthly building permits — go in the two
              qualitative tiles below once confirmed. Do not invent them. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-content1/70 border border-default-200 rounded-panel p-6">
              <p className="font-mono text-3xl font-medium text-danger">
                ₱50k–500k
              </p>
              <p className="text-sm text-default-600 mt-2">
                rework cost when a PEC violation is found at inspection
                instead of at design time.
              </p>
            </div>
            <div className="bg-content1/70 border border-default-200 rounded-panel p-6">
              <p className="font-display font-semibold text-lg">
                PRC-licensed workflow
              </p>
              <p className="text-sm text-default-600 mt-2">
                Built around how licensed electrical engineers and master
                electricians actually submit: panel schedules, conductor
                schedules, and a directory the inspector can read.
              </p>
            </div>
            <div className="bg-content1/70 border border-default-200 rounded-panel p-6">
              <p className="font-display font-semibold text-lg">
                Honest about verification
              </p>
              <p className="text-sm text-default-600 mt-2">
                Every code table ships flagged PEC-VERIFY until a licensed EE
                confirms it — and every export says so. No silently invented
                compliance numbers.
              </p>
            </div>
          </div>
        </div>

        {/* 7 — Pricing */}
        <div className="py-14 md:py-24" id="pricing">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="font-display font-semibold text-3xl tracking-tight mt-2 mb-8">
            Start free, upgrade when the project does
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            <div className="bg-content1/70 border border-default-200 rounded-panel p-6">
              <p className="font-mono text-[11px] uppercase tracking-widest text-default-500">
                Free
              </p>
              <p className="font-display text-3xl font-semibold mt-2">₱0</p>
              <ul className="text-sm text-default-600 mt-4 space-y-1.5">
                <li>1 project</li>
                <li>Up to 5 circuits</li>
                <li>Full live compliance</li>
                <li className="text-default-400">No PDF export</li>
              </ul>
            </div>
            <div className="relative bg-content1/90 border-2 border-brand-teal rounded-panel p-6 lg:-my-3 lg:py-9">
              <span className="absolute -top-2.5 left-6 font-mono text-[10px] uppercase tracking-widest bg-brand-teal text-white px-2 py-0.5 rounded-chip">
                Recommended
              </span>
              <p className="font-mono text-[11px] uppercase tracking-widest text-brand-teal-dark dark:text-brand-teal">
                Pro
              </p>
              <p className="font-display text-3xl font-semibold mt-2">
                ₱699
                <span className="text-sm text-default-500 font-normal">
                  /mo
                </span>
              </p>
              <ul className="text-sm text-default-600 mt-4 space-y-1.5">
                <li>Unlimited projects</li>
                <li>Unlimited circuits</li>
                <li>Permit-ready PDF export</li>
                <li>Lighting auto-design</li>
              </ul>
            </div>
            <div className="bg-content1/70 border border-default-200 rounded-panel p-6">
              <p className="font-mono text-[11px] uppercase tracking-widest text-default-500">
                Firm
              </p>
              <p className="font-display text-3xl font-semibold mt-2">
                ₱1,999
                <span className="text-sm text-default-500 font-normal">
                  /mo
                </span>
              </p>
              <ul className="text-sm text-default-600 mt-4 space-y-1.5">
                <li>Team seats</li>
                <li>API access</li>
                <li>Custom component library</li>
              </ul>
            </div>
            <div className="bg-content1/70 border border-default-200 rounded-panel p-6">
              <p className="font-mono text-[11px] uppercase tracking-widest text-default-500">
                LGU / DPWH
              </p>
              <p className="font-display text-3xl font-semibold mt-2">
                Custom
              </p>
              <ul className="text-sm text-default-600 mt-4 space-y-1.5">
                <li>Bulk licensing</li>
                <li>Audit trail</li>
                <li>BIM export (roadmap)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 8 — Roadmap timeline */}
        <div className="py-14 md:py-24" id="roadmap">
          <Eyebrow>Roadmap</Eyebrow>
          <h2 className="font-display font-semibold text-3xl tracking-tight mt-2 mb-10">
            Actively developed
          </h2>
          <div className="relative flex flex-col sm:flex-row gap-8 sm:gap-0">
            <span
              aria-hidden
              className="absolute hidden sm:block top-2.5 left-[6%] right-[6%] h-px bg-default-300"
            />
            {ROADMAP.map((item) => (
              <div
                key={item.label}
                className="relative flex sm:flex-col items-center gap-3 sm:flex-1 sm:text-center"
              >
                <span className="relative z-10 w-5 h-5 rounded-full border-2 border-brand-teal bg-background" />
                <div>
                  <p className="font-mono text-[11px] text-brand-amber-dark dark:text-brand-amber">
                    {item.tag}
                  </p>
                  <p className="text-sm font-medium">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 9 — Final CTA */}
        <div className="mb-20 rounded-panel border border-default-200 bg-content1/70 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 className="font-display font-semibold text-xl">
              Find violations while the wire is still a line on the screen.
            </h2>
            <p className="text-default-500 text-sm mt-1 max-w-xl">
              Draw a plan, place loads, and watch the engine route, size, and
              check it — then export the PDF the permit office expects.
            </p>
          </div>
          <Link
            className="bg-brand-teal-dark hover:bg-brand-teal transition-colors px-6 py-2.5 rounded-control text-white font-medium whitespace-nowrap flex items-center gap-2"
            href="/projects"
          >
            Start designing
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
};

export default Home;
