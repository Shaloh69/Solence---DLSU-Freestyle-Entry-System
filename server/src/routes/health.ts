import { Router } from "express";
import { isSupabaseConfigured } from "../db/supabase.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "solence-api",
    supabase: isSupabaseConfigured() ? "configured" : "not configured",
    timestamp: new Date().toISOString(),
  });
});
