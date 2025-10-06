#!/usr/bin/env bun
import { prisma } from "../src/lib/prisma";
import { loadGitHubRepository } from "../src/lib/githubLoader";
import { generateEmbedding, summarizeCode } from "../src/lib/embeddingPipeline";
import dotenv from "dotenv";
dotenv.config();

// CollabTon repository from the user's GitHub
const repoUrl = "https://github.com/Meghashree-V/CollabTON_";
const githubToken = process.env.GITHUB_TOKEN;

async function loadCollabTonRepo() {
  console.log("Starting CollabTon repository loading...");
  
  try {
    // Find the project with this GitHub URL
    const existingProject = await prisma.project.findFirst({
      where: {
        githuburl: repoUrl
      }
    });
    
    if (!existingProject) {
      console.log("No project found with this GitHub URL. Please create the project first in the UI.");
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
    await processRepo(repoUrl, existingProject.id);
    
  } catch (error) {
    console.error("Error in loadCollabTonRepo:", error);
  } finally {
    await prisma.$disconnect();
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
loadCollabTonRepo().catch(console.error);
