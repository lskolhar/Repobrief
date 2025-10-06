import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { Octokit } from "@octokit/rest";

export interface LoadGitHubRepositoryOptions {
  branch?: string;
  ignoreFiles?: string[];
  recursive?: boolean;
  unknown?: "warn" | "error" | "ignore";
  concurrency?: number;
}

// The shape of a document returned by the loader
export interface GitHubRepoDocument {
  pageContent: string;
  metadata: {
    source: string; // file path in the repo
    [key: string]: any; // possible extra metadata
  };
}


/**
 * Loads files from a GitHub repository using the GithubRepoLoader from LangChain Community.
 * @param repoUrl The GitHub repository URL (e.g., https://github.com/owner/repo)
 * @param accessToken Optional GitHub access token for private repos
 * @param options Loader options: recursive
 * @returns List of loaded documents (files)
 */
export async function loadGitHubRepository(
  repoUrl: string,
  accessToken?: string,
  options: { recursive?: boolean } = {}
) {
  try {
    console.log(`Loading GitHub repository: ${repoUrl}`);
    console.log(`Access token provided: ${accessToken ? 'Yes' : 'No'}`);
    console.log(`Recursive: ${options.recursive ?? false}`);
    
    const loader = new GithubRepoLoader(repoUrl, {
      branch: "main",
      recursive: options.recursive ?? false,
      unknown: "warn",
      accessToken: accessToken,
      maxConcurrency: 5, // Removed maxFiles as it's not in the type definition
      ignoreFiles: [
        "**/*.jpg",
        "**/*.jpeg",
        "**/*.png",
        "**/*.gif",
        "**/*.svg",
        "**/*.ico",
        "**/*.mp4",
        "**/*.mp3",
        "**/*.wav",
        "**/*.ogg",
        "**/*.pdf",
        "**/*.zip",
        "**/*.tar.gz",
      ],
    });

    // Try loading the repository
    const docs = await loader.load();
    console.log(`Successfully loaded ${docs.length} documents from ${repoUrl}`);
    return docs;
  } catch (error) {
    console.error(`Error loading GitHub repository ${repoUrl}:`, error);
    
    // Try with different branch if main fails
    try {
      console.log(`Trying with 'master' branch instead of 'main'...`);
      const loader = new GithubRepoLoader(repoUrl, {
        branch: "master",
        recursive: options.recursive ?? false,
        unknown: "warn",
        accessToken: accessToken,
        maxConcurrency: 5,
        ignoreFiles: [
          "**/*.jpg",
          "**/*.jpeg",
          "**/*.png",
          "**/*.gif",
          "**/*.svg",
          "**/*.ico",
          "**/*.mp4",
          "**/*.mp3",
          "**/*.wav",
          "**/*.ogg",
          "**/*.pdf",
          "**/*.zip",
          "**/*.tar.gz",
        ],
      });
      
      const docs = await loader.load();
      console.log(`Successfully loaded ${docs.length} documents from ${repoUrl} using master branch`);
      return docs;
    } catch (secondError) {
      console.error(`Error loading with master branch:`, secondError);
      
      // If both attempts fail, return an empty array with a sample README
      console.log(`Creating a sample README for empty repository`);
      return [{
        pageContent: `# ${repoUrl.split('/').pop()}

This repository appears to be empty or inaccessible. Please add some files to this repository.`,
        metadata: {
          source: 'README.md'
        }
      }];
    }
  }
}

/**
 * Calculate required credits for a GitHub repository based on total file count
 * @param githubUrl The GitHub repository URL
 * @param githubToken Optional GitHub access token for private repos
 * @returns Number of credits required
 */
export async function checkCredits(githubUrl: string, githubToken?: string): Promise<number> {
  try {
    const octokit = new Octokit({ auth: githubToken });
    const urlParts = githubUrl.split('/');
    const githubOwner = urlParts[3];
    const githubRepo = urlParts[4];

    if (!githubOwner || !githubRepo) {
      return 0;
    }

    const totalFiles = await getFileCount('', octokit, githubOwner, githubRepo, 0);
    // Calculate credits: 1 credit per file, minimum 10 credits
    return Math.max(10, totalFiles);
  } catch (error) {
    console.error('Error checking credits:', error);
    return 0;
  }
}

/**
 * Recursively count files in a GitHub repository
 */
async function getFileCount(
  path: string,
  octokit: Octokit,
  githubOwner: string,
  githubRepo: string,
  accumulator: number
): Promise<number> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: githubOwner,
      repo: githubRepo,
      path: path,
    });

    if (!Array.isArray(data)) {
      if (data.type === 'file') {
        return accumulator + 1;
      }
      return accumulator;
    }

    let fileCount = 0;
    const directories: string[] = [];

    for (const item of data) {
      if (item.type === 'dir') {
        directories.push(item.path);
      } else if (item.type === 'file') {
        fileCount++;
      }
    }

    if (directories.length > 0) {
      const directoryFileCounts = await Promise.all(
        directories.map((dir) => getFileCount(dir, octokit, githubOwner, githubRepo, 0))
      );
      fileCount += directoryFileCounts.reduce((sum, count) => sum + count, 0);
    }

    return accumulator + fileCount;
  } catch (error) {
    console.error('Error counting files:', error);
    return accumulator;
  }
}

// Demo: Run with `bun run src/lib/githubLoader.ts` to test
if (import.meta.main) {
  (async () => {
    const repoUrl = "https://github.com/langchain-ai/langchainjs";
    const githubToken = process.env.GITHUB_TOKEN; // Set in your .env if needed
    try {
      const files = await loadGitHubRepository(repoUrl, githubToken);
      console.log("Loaded files:", files.map(f => f.metadata?.source || f.pageContent));
    } catch (err) {
      console.error("Error loading repo:", err);
    }
  })();
}

