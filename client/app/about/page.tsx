import { FC } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import SkyBackground from "@/components/SkyBackground";

/**
 * About page (brief §10.7): the real story — why Solence exists, who
 * builds it (role-based credits, not named individuals), where it sits
 * in the Team Lanzones product family, and the principles that are
 * actual product decisions.
 */

const ROLES = [
  { role: "Lead Systems Architect", scope: "Engine, API, and data model" },
  { role: "Electrical Engineering Lead", scope: "PEC rules and verification" },
  { role: "Frontend Engineer", scope: "CAD editor and 3D overlay" },
  { role: "Firmware Engineer", scope: "Cross-product hardware (Phasor)" },
  { role: "ML Engineer", scope: "Floor-plan recognition (solence-vision)" },
];

const FAMILY = [
  {
    name: "Solence",
    tag: "This product",
    detail:
      "Automatic electrical wiring design with live PEC compliance and permit-ready export.",
    highlight: true,
  },
  {
    name: "Phasor",
    tag: "IoT",
    detail:
      "Electricity submetering — the same Node/Express/TypeScript stack Solence's API follows.",
    highlight: false,
  },
  {
    name: "QueuedIn",
    tag: "Ops",
    detail:
      "Queue management for service counters — shared Supabase infrastructure choices.",
    highlight: false,
  },
];

const PRINCIPLES = [
  {
    index: "01",
    title: "Manual override is always available",
    body: "Every AI-generated result — a routed wire, a sized breaker, an auto-placed fixture — is an ordinary object the engineer can drag, replace, or delete. Automation proposes; the licensed engineer decides. There is no locked output anywhere in the product.",
  },
  {
    index: "02",
    title: "Compliance figures are never presented as verified until they are",
    body: "Every PEC ampacity value, demand factor, and illuminance target in the engine ships flagged PEC-VERIFY or LIGHTING-VERIFY until a licensed electrical engineer confirms it against the current code edition — and every exported PDF carries that disclaimer. That honesty earns more trust from licensed engineers than vague “AI-powered” claims would.",
  },
  {
    index: "03",
    title: "One engine, every surface",
    body: "The canvas, the 3D overlay, the schedules, and the PDF all read from the same backend computation. Nothing is drawn twice, so nothing can disagree.",
  },
];

const AboutPage: FC = () => {
  return (
    <>
      <div className="fixed inset-0 z-0 pointer-events-none">
        <SkyBackground />
      </div>

      <section className="relative w-full max-w-5xl mx-auto">
        {/* Why this exists — narrative */}
        <div className="py-16 md:py-24 max-w-3xl">
          <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-brand-amber-dark dark:text-brand-amber">
            Why this exists
          </p>
          <h1 className="font-display font-bold tracking-tight text-4xl mt-3">
            The violation was always there. It just waited for the inspector
            to find it.
          </h1>
          <div className="text-default-600 mt-6 space-y-4">
            <p>
              An electrical design in the Philippines typically starts as a
              hand calculation, becomes an AutoCAD drawing with no engine
              behind it, and gets its first real code check at MERALCO/LGU
              inspection — after the drawings are signed and, often, after
              the wire is in the wall. When a PEC violation surfaces there,
              the fix costs ₱50,000–500,000 and weeks of rework.
            </p>
            <p>
              Solence moves that check to the first minute of design. Draw
              the plan, place the loads, and the same engine that will print
              the permit documents routes the wiring, sizes the breakers and
              conductors, and runs the code rules continuously — so the
              violation is a red line on a screen, not a failed inspection.
            </p>
            <p>
              It started life as BEPVY, a luminance simulator built by
              electrical engineering students. That photometric engine
              wasn&apos;t thrown away — it became Solence&apos;s lighting
              design layer, placing and verifying fixtures with the same
              lumen-method math it always had.
            </p>
          </div>
        </div>

        {/* Who builds it — role-based credits */}
        <div className="py-12 md:py-16" id="team">
          <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-brand-amber-dark dark:text-brand-amber">
            Who builds it
          </p>
          <h2 className="font-display font-semibold text-3xl tracking-tight mt-2 mb-3">
            Team Lanzones
          </h2>
          <p className="text-default-600 max-w-2xl mb-8">
            A small Philippine software and hardware development team
            building tools for local engineering and operations problems.
          </p>
          <div className="bg-content1/70 border border-default-200 rounded-panel overflow-hidden">
            {ROLES.map((member, index) => (
              <div
                key={member.role}
                className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6 px-6 py-4 border-b border-default-200 last:border-0"
              >
                <span className="font-mono text-xs text-default-400 w-8">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="font-medium sm:w-64">{member.role}</p>
                <p className="text-sm text-default-500">{member.scope}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Product family */}
        <div className="py-12 md:py-16">
          <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-brand-amber-dark dark:text-brand-amber">
            Product family
          </p>
          <h2 className="font-display font-semibold text-3xl tracking-tight mt-2 mb-8">
            Solence sits alongside Phasor and QueuedIn
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FAMILY.map((product) => (
              <div
                key={product.name}
                className={`bg-content1/70 rounded-panel p-6 border ${
                  product.highlight ? "border-brand-teal" : "border-default-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-display font-semibold text-lg">
                    {product.name}
                  </p>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-default-500 border border-default-300 rounded-chip px-1.5 py-0.5">
                    {product.tag}
                  </span>
                </div>
                <p className="text-sm text-default-600 mt-3">
                  {product.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Principles */}
        <div className="py-12 md:py-16">
          <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-brand-amber-dark dark:text-brand-amber">
            Principles
          </p>
          <h2 className="font-display font-semibold text-3xl tracking-tight mt-2 mb-8">
            Product decisions, not marketing copy
          </h2>
          <div className="space-y-4">
            {PRINCIPLES.map((principle) => (
              <div
                key={principle.index}
                className="flex gap-5 bg-content1/70 border border-default-200 rounded-panel p-6"
              >
                <span className="font-mono text-sm text-brand-amber-dark dark:text-brand-amber shrink-0 pt-0.5">
                  {principle.index}
                </span>
                <div>
                  <h3 className="font-display font-semibold text-lg">
                    {principle.title}
                  </h3>
                  <p className="text-sm text-default-600 mt-2">
                    {principle.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div
          className="mb-20 rounded-panel border border-default-200 bg-content1/70 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          id="contact"
        >
          <div>
            <h2 className="font-display font-semibold text-xl">Get in touch</h2>
            <p className="text-default-500 text-sm mt-1">
              Licensed EE willing to verify PEC tables, LGU interested in a
              pilot, or a firm with feedback — we want to hear it.
            </p>
            <p className="font-mono text-sm mt-3">
              team.lanzones@solence.ph
              {/* TODO(Hubs): confirm the public contact address */}
            </p>
          </div>
          <Link
            className="bg-brand-teal-dark hover:bg-brand-teal transition-colors px-6 py-2.5 rounded-control text-white font-medium whitespace-nowrap flex items-center gap-2"
            href="/projects"
          >
            Try Solence
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
};

export default AboutPage;
