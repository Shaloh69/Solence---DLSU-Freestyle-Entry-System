"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody, CardFooter } from "@heroui/card";
import { Input } from "@heroui/input";
import { Plus, Trash2, FolderOpen, Zap } from "lucide-react";

import { title, subtitle } from "@/components/primitives";
import { api, Project } from "@/lib/api-client";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setProjects(await api.projects.list());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Cannot reach the Solence API (${err.message}). Is the server running on port 4000?`
          : String(err)
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const project = await api.projects.create(name.trim());

      router.push(`/projects/${project.id}/editor`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.projects.remove(id).catch(() => undefined);
    await refresh();
  }

  return (
    <section className="w-full max-w-4xl mx-auto px-6 py-10">
      <h1 className={title({ color: "brand", size: "sm" })}>Projects</h1>
      <p className={subtitle()}>
        Each project holds a floor plan, its loads, and the latest wiring
        design.
      </p>

      <div className="flex gap-3 my-6">
        <Input
          placeholder="New project name (e.g. Bungalow — Lot 4)"
          value={name}
          onValueChange={setName}
          onKeyDown={(event) => event.key === "Enter" && void create()}
        />
        <Button
          color="primary"
          isLoading={busy}
          startContent={<Plus size={16} />}
          onPress={() => void create()}
        >
          Create
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-danger-50 text-danger text-sm">
          {error}
        </div>
      )}

      {projects === null && !error && (
        <p className="text-default-500">Loading projects…</p>
      )}

      {projects !== null && projects.length === 0 && (
        <p className="text-default-500">
          No projects yet — create one above to start designing.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {projects?.map((project) => (
          <Card key={project.id} className="bg-content1/60 backdrop-blur-md">
            <CardBody
              className="cursor-pointer"
              onClick={() => router.push(`/projects/${project.id}/editor`)}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-control border border-brand-teal/40 bg-brand-teal/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-brand-teal" />
                </div>
                <div>
                  <p className="font-semibold">{project.name}</p>
                  <p className="text-xs text-default-500">
                    {project.loads.length} load
                    {project.loads.length === 1 ? "" : "s"}
                    {project.lastResult
                      ? ` · ${project.lastResult.circuits.length} circuits`
                      : " · not simulated"}
                    {" · updated "}
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardBody>
            <CardFooter className="gap-2 justify-end pt-0">
              <Button
                size="sm"
                variant="flat"
                startContent={<FolderOpen size={14} />}
                onPress={() => router.push(`/projects/${project.id}/editor`)}
              >
                Open
              </Button>
              <Button
                size="sm"
                variant="flat"
                color="danger"
                startContent={<Trash2 size={14} />}
                onPress={() => void remove(project.id)}
              >
                Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
