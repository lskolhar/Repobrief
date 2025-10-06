"use client";
import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { api } from "@/trpc/react";
import { useProjectsCtx } from "@/hooks/project-context";

// The type for a commit with summary
export type CommitWithSummary = {
  id: string;
  commitMessage: string;
  commitAuthorName: string;
  commitAuthorAvatar: string | null;
  commitHash: string;
  commitDate: string;
  summary?: string;
};

export function CommitDashLog() {
  const { project } = useProjectsCtx();
  const projectId = project?.id;
  const {
    data: commits,
    isLoading,
    error,
  } = api.project.pullCommits.useQuery(
    { projectId: projectId ?? "" },
    { enabled: !!projectId }
  );

  if (!projectId) {
    return <div className="text-muted-foreground">Select a project to view commits.</div>;
  }
  if (isLoading) {
    return <div>Loading commits...</div>;
  }
  if (error) {
    return <div className="text-destructive">Error loading commits: {error.message}</div>;
  }
  if (!commits || commits.length === 0) {
    return <div>No commits found for this project.</div>;
  }

  return (
    <ul className="space-y-6">
      {commits.map((commit: any, index: number) => (
        <li key={commit.id} className="relative flex gap-x-4">
          <div className="flex flex-col items-center">
            <div
              className={
                index === commits.length - 1
                  ? "h-6"
                  : "-mb-6 h-6 border-l-2 border-gray-200 dark:border-gray-700"
              }
            />
            <img
              src={commit.authorAvatar || commit.commitAuthorAvatar || undefined}
              alt="Commit Avatar"
              className="relative mt-3 size-8 flex-none rounded bg-gray-50"
            />
          </div>
          <div className="flex-auto rounded-md bg-white p-3 ring-1 ring-inset ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
            <div className="flex justify-between gap-x-4">
              <Link
                href={`${project?.githuburl}/commit/${commit.commitHash}`}
                target="_blank"
                className="py-0.5 text-xs leading-5 text-rose-500 hover:underline"
              >
                <span className="font-medium text-gray-900 dark:text-gray-100">{commit.authorName || commit.commitAuthorName}</span>
                <span className="inline-flex items-center ml-2">
                  {commit.commitHash.substring(0, 7)}
                  <svg className="ml-1 size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m5-1 3 3m0 0-3 3m3-3H10" /></svg>
                </span>
              </Link>
              <span className="font-semibold">{commit.message || commit.commitMessage}</span>
            </div>
            <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-500 dark:text-gray-300">
              {commit.summary}
            </pre>
            <div className="mt-1 text-xs text-gray-400">{format(new Date(commit.committedAt || commit.commitDate), "yyyy-MM-dd HH:mm:ss")}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
