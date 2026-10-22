/**
 * Conductor insulation colors for the bill of materials and plan notation.
 *
 * PEC-VERIFY: grounded (neutral) conductor white or gray — PEC 2017
 * 2.0.6; equipment grounding conductor green (or green with yellow
 * stripes) — PEC 2017 2.50.6.119. Hot-conductor colors are not mandated
 * by the code; black / red / blue are the common trade convention for
 * L / L2 / L3. A licensed EE must confirm against the official text.
 */
import type { ConductorRole } from "../types.js";

export const CONDUCTOR_COLORS: Record<ConductorRole, string> = {
  L: "black",
  L2: "red",
  L3: "blue",
  N: "white",
  G: "green",
};
