/**
 * Attaches the caller's tier limits to res.locals.tier. Replace the
 * header/env resolution with the authenticated user's plan once
 * Supabase auth is wired in.
 */
import { NextFunction, Request, Response } from "express";
import { resolveTier, TierLimits } from "../tiers.js";

export function tierMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.locals.tier = resolveTier(
    req.headers["x-solence-tier"],
    process.env.DEFAULT_TIER
  );
  next();
}

export function tierOf(res: Response): TierLimits {
  return res.locals.tier;
}
