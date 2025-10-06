import { indexGitHubRepo } from "../src/lib/embeddingPipeline";
import dotenv from "dotenv";
dotenv.config();

const repoUrl = "https://github.com/Meghashree-V/CollabTON_";
const githubToken = process.env.GITHUB_TOKEN;
const projectId = "CollabTON_"; // Use a unique ID for your test project

async function run() {
  await indexGitHubRepo(projectId, repoUrl, githubToken);
  console.log("Indexing complete!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Error indexing repo:", err);
  process.exit(1);
});
