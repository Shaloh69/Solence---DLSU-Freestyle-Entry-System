# Landing page — component specs (brief §10.6, methodology §10.10)

Authored from /DESIGN.md before building. Each section lists tokens,
layout, and interaction; the build must match this spec and is audited
against DESIGN.md §7's banned list afterward.

Global: `SkyBackground` behind everything (fixed, z-0, pointer-events
none); content sections stack in a `max-w-6xl` container; section
vertical rhythm 96px (`py-24`) desktop / 56px mobile; every section
heading = mono-caps eyebrow (11px, tracking-widest, amber or muted) +
Space Grotesk headline (32–40px, 600–700, tracking-tight). Copy states
capability plainly; no "elevate/supercharge".

1. **Hero** — 2-col grid (stacked <lg). Left: teal mono eyebrow,
   display-xl headline (brand-teal gradient on the second line), body
   copy ≤ 60ch, CTA pair (solid teal `rounded-control` + bordered),
   mono stat strip. Right: `SchematicHero` SVG on navy `rounded-panel`
   with `border-brand-navy-border`; wires draw in via
   `.schematic-wire` stroke-dash animation (3.2s, staggered 0.5s);
   reduced-motion = already-drawn.
2. **Problem / Solution** — bento grid `lg:grid-cols-3`, problem card
   spans 2 cols + 2 rows (danger-tinted left rule, rework-cost mono
   readout ₱50,000–500,000); three solution cards 1×1 with corner
   registration marks + mono index (`01–03`). Cards: `surface` bg,
   `border`, `rounded-panel`, 24px padding, NO shadow.
3. **How it works** — 6 numbered nodes (mono digits in 2px-radius
   bordered squares) connected by a 1px rule; horizontal rail lg+,
   vertical rail with left line <lg. Node label + one-line detail.
4. **Feature deep-dive** — 5 alternating 2-col rows (visual side flips
   each row). Visuals are real product output, not decoration:
   compliance row renders an actual violation card; sizing row renders
   3 real schedule rows (mono); lighting row renders a lux heatmap
   swatch grid (same hue ramp as the app); routing/3D rows reuse
   schematic fragments.
5. **Scope comparison** — spec-sheet table: mono-caps header row,
   dense mono body rows, `Shipping`/`Planned` status chips (honest:
   commercial motor/transformer items are Planned).
6. **Market credibility** — "Built for the Philippine market": one
   real stat tile (₱50k–500k rework, from the deck) + two qualitative
   tiles (PRC-licensed workflow, MERALCO/LGU inspection reality).
   Exact deck figures (PRC count, Metro Cebu permits/month) are
   TODO-commented for Hubs — never invented.
7. **Pricing** — asymmetric 4-tier grid; Pro emphasized (teal border,
   mono `RECOMMENDED` tag, larger); Free/Firm/LGU standard cards.
   Real prices: Free ₱0 / Pro ₱699/mo / Firm ₱1,999/mo / LGU custom.
8. **Roadmap** — horizontal timeline strip: mono version tags
   (`V2 V2 V3 V3`) on nodes along a 1px rule; items from the deck.
9. **Final CTA** — bordered strip (no gradient), left copy + solid teal
   CTA. Site footer is global (`SiteFooter`).
