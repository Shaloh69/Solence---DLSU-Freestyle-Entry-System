/**
 * Supabase-backed project repository.
 *
 * Expects a `projects` table:
 *   id uuid primary key,
 *   name text not null,
 *   data jsonb not null,       -- floorPlan/panel/loads/lastResult
 *   created_at timestamptz default now(),
 *   updated_at timestamptz default now()
 *
 * (See server/supabase/schema.sql.)
 */
import { getSupabase } from "./supabase.js";
import { newProject, Project, ProjectRepository } from "./repository.js";

interface ProjectRow {
  id: string;
  name: string;
  data: Pick<Project, "floorPlan" | "panel" | "loads" | "lastResult">;
  created_at: string;
  updated_at: string;
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    floorPlan: row.data.floorPlan ?? null,
    panel: row.data.panel ?? null,
    loads: row.data.loads ?? [],
    lastResult: row.data.lastResult ?? null,
  };
}

function toData(project: Project): ProjectRow["data"] {
  return {
    floorPlan: project.floorPlan,
    panel: project.panel,
    loads: project.loads,
    lastResult: project.lastResult,
  };
}

export class SupabaseProjectRepository implements ProjectRepository {
  async create(name: string): Promise<Project> {
    const project = newProject(name);
    const { data, error } = await getSupabase()
      .from("projects")
      .insert({ id: project.id, name, data: toData(project) })
      .select()
      .single();

    if (error) throw new Error(`Supabase insert failed: ${error.message}`);

    return toProject(data as ProjectRow);
  }

  async list(): Promise<Project[]> {
    const { data, error } = await getSupabase()
      .from("projects")
      .select()
      .order("updated_at", { ascending: false });

    if (error) throw new Error(`Supabase select failed: ${error.message}`);

    return (data as ProjectRow[]).map(toProject);
  }

  async get(id: string): Promise<Project | null> {
    const { data, error } = await getSupabase()
      .from("projects")
      .select()
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Supabase select failed: ${error.message}`);

    return data ? toProject(data as ProjectRow) : null;
  }

  async update(project: Project): Promise<Project> {
    const { data, error } = await getSupabase()
      .from("projects")
      .update({
        name: project.name,
        data: toData(project),
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id)
      .select()
      .single();

    if (error) throw new Error(`Supabase update failed: ${error.message}`);

    return toProject(data as ProjectRow);
  }

  async remove(id: string): Promise<boolean> {
    const { error, count } = await getSupabase()
      .from("projects")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) throw new Error(`Supabase delete failed: ${error.message}`);

    return (count ?? 0) > 0;
  }
}
