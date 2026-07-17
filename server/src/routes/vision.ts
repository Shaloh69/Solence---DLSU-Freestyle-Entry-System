/**
 * Bridge to solence-vision (brief §7.4/§2.4). Express is the only
 * caller of solence-vision — the frontend never connects to it
 * directly. This route kicks off a recognition job, relays its staged
 * progress over the existing /ws gateway as `ai-progress` events
 * (queued -> running_wall_segmentation -> running_detection -> fusing
 * -> done/applied, or error), and on completion converts the fused
 * result into the project's FloorPlan via engine/vision-import.ts.
 */
import { Router } from "express";
import multer from "multer";
import { WebSocket } from "ws";
import { ProjectRepository } from "../db/repository.js";
import { HttpError } from "../middleware/error-handler.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { broadcastToProject } from "../realtime/index.js";
import { config } from "../config.js";
import { VisionResult, visionResultToFloorPlan } from "../engine/vision-import.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  // §2.5: server-side type gate — non-images are rejected before a byte
  // reaches solence-vision (PIL still re-validates on the Python side).
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith("image/"));
  },
});

/** GPU inference is the most expensive call in the system (§2.5). */
const recognizeLimiter = rateLimit({ windowMs: 60_000, max: 6 });

interface VisionJobEvent {
  stage: string;
  message?: string;
  final?: boolean;
}

/** Relay one job's progress; resolves once the job reaches a final stage. */
async function relayJob(
  projectId: string,
  jobId: string,
  repo: ProjectRepository
): Promise<void> {
  const wsUrl = `${config.visionUrl.replace(/^http/, "ws")}/ws/jobs/${jobId}`;
  const socket = new WebSocket(wsUrl);

  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  await new Promise<void>((resolve, reject) => {
    socket.on("message", (raw) => {
      void (async () => {
        let event: VisionJobEvent;

        try {
          event = JSON.parse(String(raw));
        } catch {
          return;
        }

        broadcastToProject(projectId, {
          type: "ai-progress",
          jobId,
          stage: event.stage,
          message: event.message,
        });

        if (event.stage === "error") {
          socket.close();
          reject(new Error(event.message ?? "solence-vision recognition failed"));

          return;
        }

        if (event.final || event.stage === "done") {
          try {
            const statusRes = await fetch(`${config.visionUrl}/jobs/${jobId}`);
            const status = (await statusRes.json()) as { result?: VisionResult };

            if (status.result) {
              const project = await repo.get(projectId);

              if (project) {
                project.floorPlan = visionResultToFloorPlan(
                  status.result,
                  project.floorPlan
                );
                await repo.update(project);
                broadcastToProject(projectId, {
                  type: "ai-progress",
                  jobId,
                  stage: "applied",
                  message: "Floor plan updated from AI recognition",
                });
              }
            }
            resolve();
          } catch (error) {
            reject(error);
          } finally {
            socket.close();
          }
        }
      })();
    });
    socket.once("close", () => resolve());
    socket.once("error", reject);
  });
}

export function visionRouter(repo: ProjectRepository): Router {
  const router = Router();

  router.post(
    "/projects/:id/recognize",
    recognizeLimiter,
    upload.single("image"),
    async (req, res, next) => {
      try {
        const project = await repo.get(req.params.id);

        if (!project) {
          throw new HttpError(404, `Project ${req.params.id} not found`);
        }
        if (!req.file) {
          throw new HttpError(400, "Upload a floor plan image as 'image'");
        }

        const form = new FormData();

        form.append(
          "image",
          new Blob([req.file.buffer]),
          req.file.originalname || "plan.png"
        );

        const upstream = await fetch(`${config.visionUrl}/recognize`, {
          method: "POST",
          body: form,
        });

        if (!upstream.ok) {
          const detail = await upstream.text();

          throw new HttpError(upstream.status, `solence-vision: ${detail}`);
        }

        const { jobId } = (await upstream.json()) as { jobId: string };

        res.status(202).json({ jobId });

        relayJob(project.id, jobId, repo).catch((error) => {
          broadcastToProject(project.id, {
            type: "ai-progress",
            jobId,
            stage: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
