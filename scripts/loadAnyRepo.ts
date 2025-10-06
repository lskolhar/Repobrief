#!/usr/bin/env bun
import { prisma } from "../src/lib/prisma";
import { loadGitHubRepository } from "../src/lib/githubLoader";
import { generateEmbedding, summarizeCode } from "../src/lib/embeddingPipeline";
import { pullCommit } from "../src/lib/github";
import dotenv from "dotenv";
dotenv.config();

const githubToken = process.env.GITHUB_TOKEN;

/**
 * Load any repository by name or URL
 * Usage: bun run scripts/loadAnyRepo.ts [project name or GitHub URL]
 * 
 * Examples:
 *   bun run scripts/loadAnyRepo.ts CollabTon
 *   bun run scripts/loadAnyRepo.ts https://github.com/username/repo
 */
async function loadAnyRepo() {
  // Get project name or URL from command line arguments
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Please provide a project name or GitHub URL as an argument");
    console.log("Usage: bun run scripts/loadAnyRepo.ts [project name or GitHub URL]");
    return;
  }

  // We know args[0] exists because we checked args.length > 0
  const projectIdentifier = args[0]!;
  console.log(`Starting to load repository for: ${projectIdentifier}`);
  
  try {
    // Find the project by name or URL
    const existingProject = await findProject(projectIdentifier);
    
    if (!existingProject) {
      console.log("No project found with this name or GitHub URL. Please create the project first in the UI.");
      return;
    }
    
    console.log(`Found project with ID: ${existingProject.id}`);
    
    // Check if we already have files for this project
    const existingFiles = await prisma.sourceCodeEmbedding.count({
      where: {
        projectId: existingProject.id
      }
    });
    
    if (existingFiles > 0) {
      console.log(`Project already has ${existingFiles} files loaded. Proceeding will add more files.`);
    }
    
    // Process the repository files
    if (!existingProject.githuburl) {
      console.error("Error: Project has no GitHub URL");
      return;
    }
    await processRepo(existingProject.githuburl, existingProject.id);
    
    // Also load commits
    console.log("Loading commits for the project...");
    await pullCommit(existingProject.id);
    
    console.log("Finished loading repository and commits.");
    
  } catch (error) {
    console.error("Error in loadAnyRepo:", error);
  } finally {
    await prisma.$disconnect();
  }
}

async function findProject(identifier: string | undefined) {
  // Handle undefined identifier
  if (!identifier) {
    return null;
  }
  
  // Check if the identifier is a URL or a project name
  const isUrl = identifier.startsWith("http");
  
  if (isUrl) {
    // Find by GitHub URL
    return await prisma.project.findFirst({
      where: {
        githuburl: identifier
      }
    });
  } else {
    // Find by project name
    return await prisma.project.findFirst({
      where: {
        name: {
          contains: identifier,
          mode: 'insensitive'
        }
      }
    });
  }
}

async function processRepo(repoUrl: string, projectId: string) {
  console.log(`Processing repository: ${repoUrl} for project: ${projectId}`);
  
  try {
    // Load repository files
    const docs = await loadGitHubRepository(repoUrl, githubToken, { recursive: true });
    console.log(`Loaded ${docs.length} documents from ${repoUrl}`);
    
    // Process each file
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      if (!doc) {
        console.log(`Skipping undefined document at index ${i}`);
        continue;
      }
      
      const source = doc.metadata?.source;
      
      if (!source) {
        console.log(`Skipping document ${i} with no source`);
        continue;
      }
      
      console.log(`Processing ${i+1}/${docs.length}: ${source}`);
      
      try {
        // Generate summary
        const summary = await summarizeCode(doc.pageContent);
        console.log(`Generated summary for ${source}`);
        
        // Generate embedding
        const embedding = await generateEmbedding(doc.pageContent);
        console.log(`Generated embedding for ${source}`);
        
        // Store in database
        await prisma.sourceCodeEmbedding.create({
          data: {
            projectId: projectId,
            fileName: source,
            sourceCode: doc.pageContent,
            summary: summary,
            embedding: embedding,
          },
        });
        
        console.log(`Inserted embedding for: ${source}`);
      } catch (error) {
        console.error(`Error processing file ${source}:`, error);
      }
    }
    
    console.log(`Finished processing ${docs.length} files for project ${projectId}`);
    
  } catch (error) {
    console.error("Error in processRepo:", error);
  }
}

// Run the script
loadAnyRepo().catch(console.error);
