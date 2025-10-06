"use client";
import React from "react";
import SafeMarkdown from "@/components/safe-markdown";
import { format } from "date-fns";
import { api } from "@/trpc/react";
import { useProjectsCtx } from "@/hooks/project-context";
import { User } from "lucide-react";

// Extend the commit type to include summary

type CommitWithSummary = {
  id?: string;
  message: string;
  authorName: string;
  authorAvatar: string | null;
  committedAt: string;
  summary?: string;
  commitHash?: string;
};

export function CommitLog() {
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
    // Log the full error object to the browser console
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error('CommitLog error:', error);
    }
    // Log the full error object to the browser console
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error('CommitLog error:', error);
    }
    return (
      <div className="text-destructive">
        <div>Error loading commits: {error.message}</div>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
          {JSON.stringify(error, null, 2)}
        </pre>
        {error.data?.zodError && (
          <pre>{JSON.stringify(error.data.zodError, null, 2)}</pre>
        )}
        {error.data?.stack && (
          <details>
            <summary>Stack Trace</summary>
            <pre>{error.data.stack}</pre>
          </details>
        )}
      </div>
    );
  }
  if (!commits || commits.length === 0) {
    return <div className="text-muted-foreground">No commits found for this project.</div>;
  }

  return (
    <div>
      <h3 className="font-semibold mb-2">Recent Commits</h3>
      <ul className="space-y-4">
        {commits.map((commit: any) => {
          // Debug: print the commit object
          if (typeof window !== 'undefined') {
            // eslint-disable-next-line no-console
            console.log('Commit object:', commit);
          }
          const safeCommit: CommitWithSummary = {
            id: commit.id,
            message: commit.message,
            authorName: commit.authorName,
            authorAvatar: commit.authorAvatar,
            committedAt: typeof commit.committedAt === 'string' ? commit.committedAt : commit.committedAt?.toISOString?.() ?? '',
            summary: commit.summary,
            commitHash: commit.commitHash,
          };
          // Compute the GitHub commit URL
          let commitUrl = undefined;
          if (project?.githuburl && safeCommit.commitHash) {
            commitUrl = `${project.githuburl.replace(/\.git$/, '')}/commit/${safeCommit.commitHash}`;
          }
          return (
            <li key={safeCommit.commitHash || safeCommit.id}>
              <a
                href={commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-lg shadow p-6 border border-gray-200 transition hover:bg-gray-50 focus:ring-2 focus:ring-blue-200"
                style={{ textDecoration: 'none' }}
              >
              <div className="flex items-start space-x-4">
                {safeCommit.authorAvatar ? (
  <img
    src={safeCommit.authorAvatar}
    alt={safeCommit.authorName}
    className="w-10 h-10 rounded-full mt-1"
    onError={(e) => {
      (e.currentTarget as HTMLImageElement).style.display = 'none';
      const next = e.currentTarget.nextElementSibling;
      if (next) (next as HTMLElement).style.display = '';
    }}
    style={{ display: safeCommit.authorAvatar ? '' : 'none' }}
  />
) : null}
{(!safeCommit.authorAvatar || safeCommit.authorAvatar === '' || safeCommit.authorAvatar === null) && (
  <User className="w-10 h-10 text-gray-400 mt-1" />
)}
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                    <span className="font-semibold text-gray-900">{safeCommit.authorName}</span>
                    <span className="text-xs text-gray-400">committed</span>
                    <span className="text-xs text-gray-400 sm:ml-auto">{format(new Date(safeCommit.committedAt), "yyyy-MM-dd HH:mm:ss")}</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="font-mono text-xs text-gray-400">{safeCommit.commitHash?.slice(0, 7)}</span>
                    <span className="font-bold text-base text-gray-800">{safeCommit.message}</span>
                  </div>
                  {safeCommit.summary && (
                    <div className="border border-gray-100 bg-gray-50 rounded p-3 mt-3">
                      <SafeMarkdown className="prose prose-sm mb-0">
                        {safeCommit.summary}
                      </SafeMarkdown>
                    </div>
                  )}
                </div>
              </div>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
