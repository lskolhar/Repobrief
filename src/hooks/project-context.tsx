'use client';
import React, { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLocalStorage } from './use-local-storage';
import { api } from '@/trpc/react';

export type Project = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  githuburl: string | null;
  deletedAt: Date | null;
};

export interface ProjectContextType {
  projects: Project[];
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  project: Project | null;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { data: projects = [] } = api.project.getProjects.useQuery();
  const [projectId, setProjectId] = useLocalStorage<string | null>('repobrief-project-id', null);

  const project = useMemo(
    () => projects.find((p) => p.id === projectId) || null,
    [projects, projectId]
  );

  const value = useMemo<ProjectContextType>(
    () => ({ projects, projectId, setProjectId, project }),
    [projects, projectId, project]
  );

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectsCtx(): ProjectContextType {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectsCtx must be used within ProjectProvider');
  return ctx;
}
