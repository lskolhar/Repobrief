#!/usr/bin/env bun
import { prisma } from "../src/lib/prisma";
import { loadGitHubRepository } from "../src/lib/githubLoader";
import { generateEmbedding, summarizeCode } from "../src/lib/embeddingPipeline";
import dotenv from "dotenv";
dotenv.config();

// Use the Speechly Expense Tracker repository
const repoUrl = "https://github.com/adrianhajdin/speechly_expense_tracker_project";
const githubToken = process.env.GITHUB_TOKEN;

async function populateEmbeddings() {
  console.log("Starting embedding population...");
  
  try {
    // First, find an existing project in the database
    const existingProject = await prisma.project.findFirst();
    
    if (!existingProject) {
      console.log("No existing projects found. Creating a test project...");
      const newProject = await prisma.project.create({
        data: {
          name: "Test Project",
          githuburl: repoUrl
        }
      });
      console.log(`Created test project with ID: ${newProject.id}`);
      await processRepo(repoUrl, newProject.id);
    } else {
      console.log(`Using existing project with ID: ${existingProject.id}`);
      await processRepo(repoUrl, existingProject.id);
    }
    
  } catch (error) {
    console.error("Error in populateEmbeddings:", error);
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
    
    // Process up to 30 files to get more comprehensive coverage
    const maxFilesToProcess = 30;
    const filesToProcess = prioritizedDocs.slice(0, maxFilesToProcess);
    
    for (let i = 0; i < filesToProcess.length; i++) {
      const doc = filesToProcess[i];
      if (!doc) continue;
      
      const fileName = doc.metadata?.source || `unknown-file-${i}`;
      const sourceCode = doc.pageContent;
      
      console.log(`Processing ${i+1}/${filesToProcess.length}: ${fileName}`);
      console.log(`Getting summary for ${fileName}`);
      
      // Get summary
      let summary = "";
      try {
        summary = await summarizeCode(sourceCode);
      } catch (err) {
        console.warn(`Error summarizing ${fileName}:`, err);
        summary = `Summary unavailable for ${fileName}`;
      }
      
      // Get embedding
      let embedding: number[] = [];
      try {
        embedding = await generateEmbedding(summary);
      } catch (err) {
        console.warn(`Error generating embedding for ${fileName}:`, err);
        embedding = Array(768).fill(0).map(() => Math.random()); // Fallback to random embedding
      }
      
      // Insert into database
      try {
        // Check available fields
        const fields = Object.keys(prisma.sourceCodeEmbedding.fields || {});
        console.log("Available fields:", fields);
        
        // Create the record
        const data: any = {
          fileName,
          summary,
          projectId
        };
        
        // Add sourceCode if the field exists
        if (fields.includes('sourceCode')) {
          data.sourceCode = sourceCode;
        }
        
        const inserted = await prisma.sourceCodeEmbedding.create({ data });
        
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
    
    console.log("Finished processing files!");
    console.log("Check Prisma Studio to see the entries.");
    
  } catch (error) {
    console.error("Error processing repo:", error);
  }
}

populateEmbeddings().catch(console.error);
