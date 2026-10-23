/**
 * Switch-leg conductors (W5) — what runs from a lighting box to its
 * wall switch, and between the two switches of a 2-way pair.
 *
 * PEC-VERIFY (a licensed EE must confirm against the official PEC 2017
 * text; values so far follow the NEC 2014 structure PEC 2017 mirrors):
 * - Colors: the code does not assign colors to switched or traveler
 *   conductors (only neutral white/gray — PEC 2017 2.0.6 — and ground
 *   green — 2.50.6.119); red (switched) and yellow (traveler) are the
 *   trade convention used here.
 * - No neutral to the switch box: PEC 2017 4.4.1.2(C) (NEC 404.2(C))
 *   requires a grounded conductor at switch locations except where the
 *   switch box is reached by a raceway large enough to add one later —
 *   Solence runs concealed conduit, so the exception is assumed.
 * - Equipment ground to every switch box: PEC 2017 4.4.1.9(B)
 *   (NEC 404.9(B)), sized as the circuit's EGC (Table 2.50.6.13).
 * - Switched and traveler conductors are sized as the circuit's
 *   ungrounded conductor (they carry the switched group's current).
 */
import type { SwitchLegRole } from "../types.js";

export const SWITCH_LEG_COLORS: Record<SwitchLegRole, string> = {
  S: "red",
  T: "yellow",
};

/** Box → first switch: supply hot down, switched hot back, ground. */
export const SWITCH_DROP_ROLES = ["L", "S", "G"] as const;

/** Between a 2-way pair: switched hot passing through, two travelers, ground. */
export const TRAVELER_RUN_ROLES = ["S", "T", "T", "G"] as const;
