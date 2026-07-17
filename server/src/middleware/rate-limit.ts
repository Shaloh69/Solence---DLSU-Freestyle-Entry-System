/**
 * Minimal in-memory rate limiter (Phase 3 §2.5): the AI inference
 * endpoint is the most expensive call in the system (GPU seconds per
 * request) and was previously unlimited — a cost and availability risk
 * on a public tunnel. Fixed-window per client IP; no external deps and
 * no shared state beyond this process, which matches the current
 * single-instance deployment. Swap for a store-backed limiter when the
 * API ever runs multi-instance.
 */
import { NextFunction, Request, Response } from "express";

interface Window {
  count: number;
  resetAt: number;
}

export function rateLimit(options: { windowMs: number; max: number }) {
  const windows = new Map<string, Window>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const window = windows.get(key);

    if (!window || now >= window.resetAt) {
      windows.set(key, { count: 1, resetAt: now + options.windowMs });

      return next();
    }

    window.count++;
    if (window.count > options.max) {
      res
        .status(429)
        .setHeader(
          "Retry-After",
          String(Math.ceil((window.resetAt - now) / 1000))
        )
        .json({
          error:
            "Too many recognition requests — wait a moment before retrying",
        });

      return;
    }

    next();
  };
}
