// src/lib/github.ts
// Utility module for interacting with GitHub using Octokit

import "dotenv/config";
import { Octokit } from "octokit";

// Debug: print the GitHub token being used
console.log("GITHUB_TOKEN:", process.env.GITHUB_TOKEN);

// You will need to provide a GitHub token via environment variable or config
const GITHUB_TOKEN: string = process.env.GITHUB_TOKEN ?? "";

export const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

/**
 * Extracts owner and repo from a GitHub URL using URL API.
 * Throws if invalid.
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid GitHub URL");
  }
  if (parsed.hostname !== "github.com") throw new Error("Invalid GitHub URL");
  const segments = parsed.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
  if (segments.length < 2) throw new Error("Invalid GitHub URL");
  // segments[0] and segments[1] are defined, assert non-null
  const owner = segments[0]!;
  const repo = segments[1]!;
  return { owner, repo };
}

/**
 * Fetch commit hashes and basic info from a GitHub repository.
 */
export async function getCommitHashes(githubUrl: string): Promise<Array<{ hash: string; message: string; author: string; date: string; authorAvatar?: string | null }>> {
  const { owner, repo } = parseGitHubUrl(githubUrl);
  const response = await octokit.request('GET /repos/{owner}/{repo}/commits', {
    owner,
    repo,
    per_page: 20, // adjust as needed
  });

  const commits = response.data ?? [];
  return commits.map(commit => ({
    hash: commit.sha,
    message: commit.commit.message,
    author: commit.commit.author?.name ?? "Unknown",
    date: commit.commit.author?.date ?? "Unknown",
    authorAvatar: commit.author?.avatar_url ?? null, // Add avatar extraction
  }));
}

// Example: fetch commits for a repo
export async function fetchCommits(owner: string, repo: string) {
  const response = await octokit.request('GET /repos/{owner}/{repo}/commits', {
    owner,
    repo,
    per_page: 20,
  });
  return response.data;
}

// Add more GitHub API helpers as needed

import axios from "axios";
import { summarizeCommit } from "./gemini";

// Add a delay function to pause execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches the diff for a commit from GitHub and summarizes it using Gemini.
 * @param repoUrl - The base GitHub repo URL (e.g., https://github.com/org/repo)
 * @param commitHash - The commit hash to summarize
 * @param githubToken - GitHub token for authentication (optional, for private repos or higher rate limits)
 * @returns The summary string or an empty string on error
 */
export async function aiSummarizeCommit(repoUrl: string, commitHash: string, githubToken?: string): Promise<string> {
  const MAX_RETRIES = 3;
  let retries = 0;
  let lastError: any = null;

  while (retries < MAX_RETRIES) {
    try {
      // Construct the GitHub URL for the commit diff
      const diffUrl = `${repoUrl}/commit/${commitHash}.diff`;
      const headers: Record<string, string> = {
        "Accept": "application/vnd.github.v3.diff"
      };
      if (githubToken) {
        headers["Authorization"] = `token ${githubToken}`;
      }
      
      try {
        // Fetch the diff from GitHub
        const { data: diff } = await axios.get(diffUrl, { headers });
        
        // Summarize the diff using Gemini
        return await summarizeCommit(diff);
      } catch (axiosError: any) {
        // Handle specific HTTP errors from GitHub
        if (axiosError.response) {
          const status = axiosError.response.status;
          
          if (status === 403) {
            console.error(`GitHub API 403 Forbidden error for commit ${commitHash}. This may be due to access restrictions or rate limiting.`);
            // Return a generic summary for forbidden resources
            return `Updated code in repository. (Note: Detailed summary unavailable due to GitHub access restrictions)`;
          } else if (status === 404) {
            console.error(`GitHub API 404 Not Found error for commit ${commitHash}. The commit may not exist or be accessible.`);
            return `New commit added to repository. (Note: Detailed summary unavailable as commit details could not be found)`;
          }
        }
        
        // Re-throw for other handling
        throw axiosError;
      }
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error (HTTP 429)
      if (error.response && error.response.status === 429) {
        retries++;
        console.log(`Rate limit hit, retry ${retries}/${MAX_RETRIES}`);
        
        // Get retry-after header or use exponential backoff
        const retryAfter = error.response.headers['retry-after'];
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, retries) * 1000;
        
        console.log(`Waiting ${waitTime}ms before retrying...`);
        await delay(waitTime);
      } else {
        // For other errors, don't retry
        console.error("Error in aiSummarizeCommit:", error);
        return "";
      }
    }
  }
  
  console.error("Max retries reached in aiSummarizeCommit:", lastError);
  return "";
}

// Use local Prisma client for type-safe model access
import { prisma } from "./prisma";

/**
 * Fetch the project and its GitHub URL by projectId from the database
 */
async function fetchProjectGithubUrl(projectId: string) {
  const project = await (prisma as any).project.findUnique({
    where: { id: projectId },
    select: { id: true, githuburl: true }
  });
  if (!project || !project.githuburl) {
    throw new Error("Project or GitHub URL not found");
  }
  return { project, githubUrl: project.githuburl };
}

/**
 * Filter out commits that are already saved in the DB for this project
 */
async function filterOutUnprocessedCommits(projectId: string, commitHashes: string[]) {
  const processed = await (prisma as any).commit.findMany({
    where: {
      projectId,
      commitHash: { in: commitHashes }
    },
    select: { commitHash: true }
  });
  const processedHashes = new Set(processed.map((c: { commitHash: string }) => c.commitHash));
  // Return only new commit hashes
  return commitHashes.filter((hash: string) => !processedHashes.has(hash));
}

/**
 * Pull latest commits from GitHub for a project, filter out already-processed ones
 * Returns up to 10 new commits, each as an object with message, authorName, authorAvatar, committedAt
 */
export async function pullCommit(projectId: string) {
  try {
    // Step 1: Get project and GitHub URL
    console.log('[pullCommit] Fetching project and GitHub URL for projectId:', projectId);
    const { githubUrl } = await fetchProjectGithubUrl(projectId);
    console.log('[pullCommit] Got GitHub URL:', githubUrl);

    // Step 2: Get latest commits from GitHub
    const commits = await getCommitHashes(githubUrl) as Array<{ hash: string; message: string; author: string; date: string; authorAvatar?: string | null }>;
    console.log('[pullCommit] Got commits from GitHub:', commits.length);

    // Step 3: Filter out already-processed commits
    const newHashes: string[] = await filterOutUnprocessedCommits(
      projectId,
      commits.map(c => c.hash)
    );
    console.log('[pullCommit] New commit hashes to process:', newHashes);
    const newCommits = commits.filter((c) => newHashes.includes(c.hash));

    // Step 4: Summarize and save new commits
    console.log('[pullCommit] Processing', newCommits.length, 'new commits');
    for (const commit of newCommits) {
      let summary = '';
      try {
        // Add a delay between commits to avoid rate limiting
        if (newCommits.indexOf(commit) > 0) {
          console.log('[pullCommit] Adding delay between commits to avoid rate limits...');
          await delay(2000); // 2 second delay between commits
        }
        
        summary = await aiSummarizeCommit(githubUrl, commit.hash);
      } catch (err) {
        console.error(`[pullCommit] Error summarizing commit ${commit.hash}:`, err);
        summary = '[AI summary failed]';
      }
      try {
        await prisma.commit.upsert({
          where: { commitHash: commit.hash },
          update: {
            summary,
            message: commit.message,
            authorName: commit.author,
            authorAvatar: commit.authorAvatar ?? '',
            committedAt: new Date(commit.date),
          },
          create: {
            projectId,
            commitHash: commit.hash,
            message: commit.message,
            authorName: commit.author,
            authorAvatar: commit.authorAvatar ?? '',
            committedAt: new Date(commit.date),
            summary,
          }
        });
      } catch (err) {
        console.error(`[pullCommit] Error saving commit ${commit.hash} to Prisma:`, err);
        throw new Error(`Could not save commit ${commit.hash} to database: ` + (err as Error).message);
      }
    }

    // Always return from DB so UI matches Prisma
    try {
      return prisma.commit.findMany({
        where: { projectId },
        orderBy: { committedAt: 'desc' },
      });
    } catch (err) {
      console.error('[pullCommit] Error fetching commits from DB:', err);
      throw new Error('Could not fetch commits from database: ' + (err as Error).message);
    }
  } catch (err) {
    console.error('[pullCommit] Error pulling commits:', err);
    throw new Error('Could not pull commits: ' + (err as Error).message);
  }
}


// TEMP: Automated test: try user's repo, then fallback to public repo if 404
if (import.meta.main) {
  (async () => {
    const testRepos = [
      "https://github.com/Meghashree-V/ComplainHub", // user's repo
      "https://github.com/octocat/Hello-World"      // fallback public repo
    ];
    for (const url of testRepos) {
      try {
        const { owner, repo } = parseGitHubUrl(url);
        console.log("Trying repo:", owner, repo);
        const response = await octokit.request('GET /repos/{owner}/{repo}/commits', {
          owner,
          repo,
          per_page: 20,
        });
        // Sort by date descending and map to type-safe object
        const sortedCommits = [...response.data].sort((a, b) => {
          const dateA = new Date(a.commit?.author?.date ?? 0).getTime();
          const dateB = new Date(b.commit?.author?.date ?? 0).getTime();
          return dateB - dateA;
        });
        const result = sortedCommits.slice(0, 15).map(commit => ({
          hash: commit.sha as string,
          message: commit.commit?.message as string,
          authorName: commit.commit?.author?.name ?? "Unknown",
          authorAvatar: commit.author?.avatar_url ?? null,
          committedAt: commit.commit?.author?.date ?? null,
        }));
        console.log(result);
        return;
      } catch (err: any) {
        if (err.status === 404) {
          console.error(`Repo not found: ${url}. Trying next...`);
        } else {
          console.error("Error fetching commits:", err);
          return;
        }
      }
    }
    console.error("All test repos failed. Please check your token and repo access.");
  })();
}
