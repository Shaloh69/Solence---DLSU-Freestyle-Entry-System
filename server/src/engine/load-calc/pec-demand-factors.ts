/**
 * PEC Section 2 demand factors.
 *
 * ============================ PEC-VERIFY ============================
 * PLACEHOLDER DATA. These tiers follow the familiar NEC Article 220
 * pattern for dwelling lighting demand and small-appliance/laundry
 * circuits. They are NOT verified against the current Philippine
 * Electrical Code. A licensed electrical engineer must confirm the
 * tier boundaries, percentages, and which load types they apply to
 * before permit use.
 * ====================================================================
 */

export interface DemandTier {
  /** Inclusive lower bound of the tier in VA. */
  fromVa: number;
  /** Exclusive upper bound (Infinity for the last tier). */
  toVa: number;
  /** Fraction of the load in this tier counted toward demand. */
  factor: number;
}

/** General lighting + general-purpose receptacle demand tiers. PEC-VERIFY. */
export const LIGHTING_DEMAND_TIERS: DemandTier[] = [
  { fromVa: 0, toVa: 3000, factor: 1.0 },
  { fromVa: 3000, toVa: 120000, factor: 0.35 },
  { fromVa: 120000, toVa: Infinity, factor: 0.25 },
];

/**
 * Unit load per small-appliance / laundry branch circuit, VA.
 * PEC-VERIFY: placeholder (NEC 220.52 pattern).
 */
export const SMALL_APPLIANCE_CIRCUIT_VA = 1500;

/**
 * Demand factor applied to fixed appliances when four or more are on the
 * feeder. PEC-VERIFY: placeholder (NEC 220.53 pattern).
 */
export const FIXED_APPLIANCE_DEMAND_FACTOR = 0.75;
export const FIXED_APPLIANCE_MIN_COUNT = 4;

/**
 * General lighting unit load per square meter of floor area, VA/m².
 * PEC-VERIFY: placeholder (NEC 220.12 dwelling pattern, 3 VA/ft² ≈ 33 VA/m²
 * — PEC uses 24 VA/m² in some editions; must be confirmed).
 */
export const GENERAL_LIGHTING_VA_PER_SQM = 24;
