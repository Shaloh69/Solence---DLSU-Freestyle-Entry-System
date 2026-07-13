import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { healthRouter } from "./routes/health.js";
import { projectsRouter } from "./routes/projects.js";
import { visionRouter } from "./routes/vision.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { tierMiddleware } from "./middleware/tier.js";
import {
  InMemoryProjectRepository,
  ProjectRepository,
} from "./db/repository.js";
import { SupabaseProjectRepository } from "./db/supabase-repository.js";
import { isSupabaseConfigured } from "./db/supabase.js";

export interface AppOptions {
  /** Override the repository (used by tests). */
  repository?: ProjectRepository;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

  const repository =
    options.repository ??
    (isSupabaseConfigured()
      ? new SupabaseProjectRepository()
      : new InMemoryProjectRepository());

  if (!options.repository && !isSupabaseConfigured()) {
    console.warn(
      "Supabase not configured — using in-memory project storage (data is lost on restart)"
    );
  }

  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: "10mb" }));
  app.use(tierMiddleware);

  app.use("/api", healthRouter);
  app.use("/api", projectsRouter(repository));
  app.use("/api", visionRouter(repository));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
