/**
 * Deterministic color per circuit for the 2D canvas, 3D overlay, and
 * schedule tables. Distinct, dark/light-friendly categorical palette;
 * violations always render red regardless of circuit color.
 */
export const CIRCUIT_PALETTE = [
  "#4E79A7", // blue
  "#F28E2B", // orange
  "#59A14F", // green
  "#B07AA1", // purple
  "#76B7B2", // teal
  "#EDC948", // yellow
  "#FF9DA7", // pink
  "#9C755F", // brown
  "#86BCB6", // seafoam
  "#D37295", // magenta
];

export const VIOLATION_COLOR = "#E15759";

export function circuitColor(circuitId: string | undefined, circuitIds: string[]): string {
  if (!circuitId) return "#888888";
  const index = circuitIds.indexOf(circuitId);

  return CIRCUIT_PALETTE[(index >= 0 ? index : 0) % CIRCUIT_PALETTE.length];
}

/** Phase leg colors (PH convention-ish; presentation only). */
export const PHASE_COLORS: Record<string, string> = {
  A: "#E15759",
  B: "#4E79A7",
  C: "#EDC948",
};
