# ResPlan plans — attribution

Converted floor plans in this folder are derived from **ResPlan: A
Large-Scale Vector-Graph Dataset of 17,000 Residential Floor Plans**
(https://github.com/m-agour/ResPlan), data licensed **CC BY 4.0**
(https://creativecommons.org/licenses/by/4.0/).

Changes made: geometry rescaled to meters (door-leaf anchor 0.85 m),
wall polygons converted to centerline segments with thickness,
doors/windows attached to walls, room labels mapped to Solence room
types. See `scripts/resplan/convert_resplan.py` and `INDEX.json`
(source sha256, selection rule, per-plan conversion quality).

Takedown requests to ResPlan are honored: if a plan is removed upstream,
remove it here and regenerate.
