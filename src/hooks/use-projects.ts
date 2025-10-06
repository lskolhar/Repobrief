import { useLocalStorage } from "./use-local-storage";
import { api } from "@/trpc/react";
import { useMemo } from "react";

export function useProjects() {
  const { data: projects = [] } = api.project.getProjects.useQuery();
  const [projectId, setProjectId] = useLocalStorage<string | null>(
    "repobrief-project-id",
    null
  );

  const project = useMemo(
    () => projects.find((p) => p.id === projectId) || null,
    [projects, projectId]
  );

  return {
    projects,
    projectId,
    setProjectId,
    project,
  };
}
