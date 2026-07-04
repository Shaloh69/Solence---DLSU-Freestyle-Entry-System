/**
 * Project persistence. The API depends only on this interface; the
 * concrete store is Supabase when configured, in-memory otherwise (so
 * local development and tests need no credentials).
 */
import { randomUUID } from "node:crypto";
import { ElectricalLoad, FloorPlan, Panel } from "../engine/types.js";
import { SimulationResult } from "../engine/simulate.js";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  floorPlan: FloorPlan | null;
  panel: Panel | null;
  loads: ElectricalLoad[];
  lastResult: SimulationResult | null;
}

export interface ProjectRepository {
  create(name: string): Promise<Project>;
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  update(project: Project): Promise<Project>;
  remove(id: string): Promise<boolean>;
}

export function newProject(name: string): Project {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    floorPlan: null,
    panel: null,
    loads: [],
    lastResult: null,
  };
}

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly projects = new Map<string, Project>();

  async create(name: string): Promise<Project> {
    const project = newProject(name);

    this.projects.set(project.id, project);

    return structuredClone(project);
  }

  async list(): Promise<Project[]> {
    return [...this.projects.values()].map((project) =>
      structuredClone(project)
    );
  }

  async get(id: string): Promise<Project | null> {
    const project = this.projects.get(id);

    return project ? structuredClone(project) : null;
  }

  async update(project: Project): Promise<Project> {
    if (!this.projects.has(project.id)) {
      throw new Error(`Project ${project.id} not found`);
    }
    const updated = { ...project, updatedAt: new Date().toISOString() };

    this.projects.set(project.id, structuredClone(updated));

    return structuredClone(updated);
  }

  async remove(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }
}
