import { prisma } from "../src/lib/prisma";
import { indexGitHubRepo } from "../src/lib/embeddingPipeline";

async function main() {
  const projects = await prisma.project.findMany();
  const githubToken = process.env.GITHUB_TOKEN;
  for (const project of projects) {
    if (!project.githuburl) {
      console.warn(`Project ${project.id} has no githuburl, skipping.`);
      continue;
    }
    console.log(`Embedding project ${project.id}: ${project.githuburl}`);
    try {
      await indexGitHubRepo(project.id, project.githuburl, githubToken);
      console.log(`Successfully embedded project ${project.id}`);
    } catch (err) {
      console.error(`Error embedding project ${project.id}:`, err);
    }
  }
  process.exit(0);
}

main();
