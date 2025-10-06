#!/usr/bin/env bun
import { prisma } from "../src/lib/prisma";
import { loadGitHubRepository } from "../src/lib/githubLoader";
import { generateEmbedding, summarizeCode } from "../src/lib/embeddingPipeline";
import dotenv from "dotenv";
dotenv.config();

// Speechly Expense Tracker repository
const repoUrl = "https://github.com/adrianhajdin/speechly_expense_tracker_project";
const githubToken = process.env.GITHUB_TOKEN;

async function loadSpeechlyRepo() {
  console.log("Starting Speechly Expense Tracker repository loading...");
  
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
      console.log(`Project already has ${existingFiles} files. Clearing them before reloading...`);
      await prisma.sourceCodeEmbedding.deleteMany({
        where: {
          projectId: existingProject.id
        }
      });
    }
    
    // Process the repository
    await processRepo(repoUrl, existingProject.id);
    
  } catch (error) {
    console.error("Error in loadSpeechlyRepo:", error);
  } finally {
    await prisma.$disconnect();
  }
}

async function processRepo(repoUrl: string, projectId: string) {
  try {
    console.log(`Loading documents from ${repoUrl}...`);
    // Set recursive to true to process all files in the repository
    const docs = await loadGitHubRepository(repoUrl, githubToken, { recursive: true });
    console.log(`Loaded ${docs.length} documents.`);
    
    // Prioritize README and important files first
    const prioritizedDocs = docs.sort((a, b) => {
      const fileA = a.metadata?.source || '';
      const fileB = b.metadata?.source || '';
      
      // Prioritize README files
      if (fileA.toLowerCase().includes('readme') && !fileB.toLowerCase().includes('readme')) return -1;
      if (!fileA.toLowerCase().includes('readme') && fileB.toLowerCase().includes('readme')) return 1;
      
      // Prioritize package.json and main source files
      if (fileA.includes('package.json') && !fileB.includes('package.json')) return -1;
      if (!fileA.includes('package.json') && fileB.includes('package.json')) return 1;
      
      // Prioritize source files over configuration files
      if (fileA.includes('/src/') && !fileB.includes('/src/')) return -1;
      if (!fileA.includes('/src/') && fileB.includes('/src/')) return 1;
      
      return 0;
    });
    
    // Process up to 50 files to get more comprehensive coverage
    const maxFilesToProcess = 50;
    const filesToProcess = prioritizedDocs.slice(0, maxFilesToProcess);
    
    for (let i = 0; i < filesToProcess.length; i++) {
      const doc = filesToProcess[i];
      if (!doc) continue;
      
      const fileName = doc.metadata?.source || `unknown-file-${i}`;
      const sourceCode = doc.pageContent;
      
      console.log(`Processing ${i+1}/${filesToProcess.length}: ${fileName}`);
      
      // Get summary
      let summary = "";
      try {
        summary = await summarizeCode(sourceCode);
        console.log(`Generated summary for ${fileName}`);
      } catch (err) {
        console.warn(`Error summarizing ${fileName}:`, err);
        summary = `Summary unavailable for ${fileName}`;
      }
      
      // Get embedding
      let embedding: number[] = [];
      try {
        embedding = await generateEmbedding(summary);
        console.log(`Generated embedding for ${fileName}`);
      } catch (err) {
        console.warn(`Error generating embedding for ${fileName}:`, err);
        embedding = Array(768).fill(0).map(() => Math.random()); // Fallback to random embedding
      }
      
      // Insert into database
      try {
        // Create the record
        const inserted = await prisma.sourceCodeEmbedding.create({
          data: {
            fileName,
            summary,
            sourceCode,
            projectId
          }
        });
        
        // Update with embedding using raw SQL
        if (embedding.length === 768) {
          await prisma.$executeRawUnsafe(
            `UPDATE \"SourceCodeEmbedding\" SET embedding = $1 WHERE id = $2`,
            embedding,
            inserted.id
          );
        }
        
        console.log(`Inserted embedding for: ${fileName}`);
      } catch (err) {
        console.error(`Error inserting ${fileName}:`, err);
      }
    }
    
    console.log(`Finished processing ${filesToProcess.length} files for project ${projectId}`);
    
  } catch (error) {
    console.error("Error processing repository:", error);
  }
}

// Run the script
loadSpeechlyRepo().catch(console.error);
