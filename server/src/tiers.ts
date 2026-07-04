/**
 * Pricing-tier feature flags (Free / Pro / Firm / LGU), enforced at the
 * API even though billing is not implemented yet.
 *
 * Tier resolution (until Supabase auth carries a tier per user):
 *   1. `x-solence-tier` request header (dev/testing)
 *   2. DEFAULT_TIER env var
 *   3. "pro" fallback so local development is unrestricted
 */
export type TierName = "free" | "pro" | "firm" | "lgu";

export interface TierLimits {
  name: TierName;
  /** Max projects per account. */
  maxProjects: number;
  /** Max circuits a simulation may produce. */
  maxCircuits: number;
  /** Permit-ready PDF export. */
  canExport: boolean;
  /** Firm tier: external API access + custom component library. */
  apiAccess: boolean;
  customLibrary: boolean;
  /** LGU/DPWH tier: audit trail + BIM export (future). */
  auditTrail: boolean;
}

export const TIERS: Record<TierName, TierLimits> = {
  free: {
    name: "free",
    maxProjects: 1,
    maxCircuits: 5,
    canExport: false,
    apiAccess: false,
    customLibrary: false,
    auditTrail: false,
  },
  pro: {
    name: "pro",
    maxProjects: Infinity,
    maxCircuits: Infinity,
    canExport: true,
    apiAccess: false,
    customLibrary: false,
    auditTrail: false,
  },
  firm: {
    name: "firm",
    maxProjects: Infinity,
    maxCircuits: Infinity,
    canExport: true,
    apiAccess: true,
    customLibrary: true,
    auditTrail: false,
  },
  lgu: {
    name: "lgu",
    maxProjects: Infinity,
    maxCircuits: Infinity,
    canExport: true,
    apiAccess: true,
    customLibrary: true,
    auditTrail: true,
  },
};

export function resolveTier(
  headerValue: unknown,
  envDefault: string | undefined
): TierLimits {
  const candidate =
    (typeof headerValue === "string" && headerValue.toLowerCase()) ||
    envDefault?.toLowerCase() ||
    "pro";

  return TIERS[candidate as TierName] ?? TIERS.pro;
}
