/**
 * Project + simulation REST surface. Contract documented in docs/api.md.
 */
import { NextFunction, Request, Response, Router } from "express";
import { ProjectRepository } from "../db/repository.js";
import { HttpError } from "../middleware/error-handler.js";
import {
  autoLightingSchema,
  bulkLoadsSchema,
  createProjectSchema,
  floorPlanSchema,
  loadSchema,
  panelSchema,
  simulateOptionsSchema,
  updateProjectSchema,
} from "../schemas.js";
import { autoPlaceLighting } from "../engine/lighting/index.js";
import { broadcastToProject } from "../realtime/index.js";
import { simulate } from "../engine/simulate.js";
import { generatePermitPdf } from "../engine/pdf/permit-pdf.js";
import { tierOf } from "../middleware/tier.js";

type Handler = (req: Request, res: Response) => Promise<void>;

/** Route async errors into the error-handling middleware. */
function wrap(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

export function projectsRouter(repo: ProjectRepository): Router {
  const router = Router();

  async function requireProject(id: string) {
    const project = await repo.get(id);

    if (!project) throw new HttpError(404, `Project ${id} not found`);

    return project;
  }

  // ---- Project CRUD ----

  router.post(
    "/projects",
    wrap(async (req, res) => {
      const { name } = createProjectSchema.parse(req.body);
      const tier = tierOf(res);
      const existing = await repo.list();

      if (existing.length >= tier.maxProjects) {
        throw new HttpError(
          403,
          `The ${tier.name} tier allows ${tier.maxProjects} project` +
            `${tier.maxProjects === 1 ? "" : "s"} — upgrade to Pro for unlimited projects`
        );
      }
      const project = await repo.create(name);

      res.status(201).json(project);
    })
  );

  router.get(
    "/projects",
    wrap(async (_req, res) => {
      res.json(await repo.list());
    })
  );

  router.get(
    "/projects/:id",
    wrap(async (req, res) => {
      res.json(await requireProject(req.params.id));
    })
  );

  router.patch(
    "/projects/:id",
    wrap(async (req, res) => {
      const changes = updateProjectSchema.parse(req.body);
      const project = await requireProject(req.params.id);

      if (changes.name !== undefined) project.name = changes.name;
      res.json(await repo.update(project));
    })
  );

  router.delete(
    "/projects/:id",
    wrap(async (req, res) => {
      const removed = await repo.remove(req.params.id);

      if (!removed) throw new HttpError(404, `Project ${req.params.id} not found`);
      res.status(204).end();
    })
  );

  // ---- Floor plan & panel ----

  router.put(
    "/projects/:id/floorplan",
    wrap(async (req, res) => {
      const floorPlan = floorPlanSchema.parse(req.body);
      const project = await requireProject(req.params.id);

      project.floorPlan = floorPlan;
      res.json(await repo.update(project));
    })
  );

  router.put(
    "/projects/:id/panel",
    wrap(async (req, res) => {
      const panel = panelSchema.parse(req.body);
      const project = await requireProject(req.params.id);

      project.panel = panel;
      res.json(await repo.update(project));
    })
  );

  // ---- Load placement ----

  router.put(
    "/projects/:id/loads",
    wrap(async (req, res) => {
      const loads = bulkLoadsSchema.parse(req.body);
      const ids = new Set(loads.map((load) => load.id));

      if (ids.size !== loads.length) {
        throw new HttpError(400, "Duplicate load ids in bulk replace");
      }
      const project = await requireProject(req.params.id);

      project.loads = loads;
      res.json(await repo.update(project));
    })
  );

  router.post(
    "/projects/:id/loads",
    wrap(async (req, res) => {
      const load = loadSchema.parse(req.body);
      const project = await requireProject(req.params.id);

      if (project.loads.some((existing) => existing.id === load.id)) {
        throw new HttpError(409, `Load ${load.id} already exists`);
      }
      project.loads.push(load);
      res.status(201).json(await repo.update(project));
    })
  );

  router.put(
    "/projects/:id/loads/:loadId",
    wrap(async (req, res) => {
      const load = loadSchema.parse(req.body);

      if (load.id !== req.params.loadId) {
        throw new HttpError(400, "Load id in body must match the URL");
      }
      const project = await requireProject(req.params.id);
      const index = project.loads.findIndex(
        (existing) => existing.id === req.params.loadId
      );

      if (index === -1) {
        throw new HttpError(404, `Load ${req.params.loadId} not found`);
      }
      project.loads[index] = load;
      res.json(await repo.update(project));
    })
  );

  router.delete(
    "/projects/:id/loads/:loadId",
    wrap(async (req, res) => {
      const project = await requireProject(req.params.id);
      const before = project.loads.length;

      project.loads = project.loads.filter(
        (load) => load.id !== req.params.loadId
      );
      if (project.loads.length === before) {
        throw new HttpError(404, `Load ${req.params.loadId} not found`);
      }
      res.json(await repo.update(project));
    })
  );

  // ---- Auto-lighting (section 9: the ported illumination engine) ----

  router.post(
    "/projects/:id/lighting/auto",
    wrap(async (req, res) => {
      const options = autoLightingSchema.parse(req.body ?? {});
      const project = await requireProject(req.params.id);

      if (!project.floorPlan || project.floorPlan.rooms.length === 0) {
        throw new HttpError(
          422,
          "Draw at least one room before auto-generating lighting"
        );
      }

      const rooms = project.floorPlan.rooms.filter(
        (room) => !options.roomIds || options.roomIds.includes(room.id)
      );

      if (rooms.length === 0) {
        throw new HttpError(404, "None of the requested rooms exist");
      }

      const targetRoomIds = new Set(rooms.map((room) => room.id));

      if (options.replaceExisting ?? true) {
        // Auto-generated fixtures are identifiable by their id prefix.
        project.loads = project.loads.filter(
          (load) =>
            !(
              load.id.startsWith("lf-") &&
              load.roomId &&
              targetRoomIds.has(load.roomId)
            )
        );
      }

      const results = rooms.map((room) =>
        autoPlaceLighting(room, {
          targetLux: options.targetLux,
          fixture: options.fixture,
        })
      );

      for (const result of results) {
        project.loads.push(...result.loads);
      }

      const updated = await repo.update(project);

      res.json({
        project: updated,
        placements: results.map((result) => result.meta),
      });
    })
  );

  // ---- Simulation ----

  router.post(
    "/projects/:id/simulate",
    wrap(async (req, res) => {
      const options = simulateOptionsSchema.parse(req.body ?? {});
      const project = await requireProject(req.params.id);

      if (!project.floorPlan) {
        throw new HttpError(422, "Project has no floor plan");
      }
      if (!project.panel) {
        throw new HttpError(422, "Project has no distribution panel placed");
      }
      if (project.loads.length === 0) {
        throw new HttpError(422, "Project has no loads placed");
      }

      const result = simulate({
        floorPlan: project.floorPlan,
        panel: project.panel,
        loads: project.loads,
        options,
      });

      const tier = tierOf(res);

      if (result.circuits.length > tier.maxCircuits) {
        throw new HttpError(
          403,
          `This design needs ${result.circuits.length} circuits; the ` +
            `${tier.name} tier allows up to ${tier.maxCircuits} — upgrade to Pro for unlimited circuits`
        );
      }

      project.lastResult = result;
      await repo.update(project);
      broadcastToProject(project.id, { type: "simulation", result });
      res.json(result);
    })
  );

  router.get(
    "/projects/:id/results",
    wrap(async (req, res) => {
      const project = await requireProject(req.params.id);

      if (!project.lastResult) {
        throw new HttpError(404, "Project has not been simulated yet");
      }
      res.json(project.lastResult);
    })
  );

  // ---- Export ----

  router.post(
    "/projects/:id/export",
    wrap(async (req, res) => {
      const tier = tierOf(res);

      if (!tier.canExport) {
        throw new HttpError(
          403,
          `PDF export is not included in the ${tier.name} tier — upgrade to Pro to export permit-ready documents`
        );
      }
      const project = await requireProject(req.params.id);

      if (!project.floorPlan || !project.panel) {
        throw new HttpError(422, "Project needs a floor plan and a panel");
      }
      if (!project.lastResult) {
        throw new HttpError(422, "Run a simulation before exporting");
      }

      const pdf = await generatePermitPdf({
        projectName: project.name,
        floorPlan: project.floorPlan,
        panel: project.panel,
        result: project.lastResult,
      });
      const safeName = project.name.replace(/[^\w.-]+/g, "_");

      res
        .setHeader("Content-Type", "application/pdf")
        .setHeader(
          "Content-Disposition",
          `attachment; filename="${safeName}-permit.pdf"`
        )
        .send(pdf);
    })
  );

  return router;
}
