#!/usr/bin/env bun
import { prisma } from "../src/lib/prisma";
import { loadGitHubRepository } from "../src/lib/githubLoader";
import { generateEmbedding, summarizeCode } from "../src/lib/embeddingPipeline";
import { pullCommit } from "../src/lib/github";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

const githubToken = process.env.GITHUB_TOKEN;

/**
 * This script diagnoses and fixes repository loading issues
 * It provides detailed error information and attempts to fix common problems
 */
async function debugAndFixRepo() {
  // Get project name or URL from command line arguments
  const args = process.argv.slice(2);
  const projectIdentifier = args[0] || "CollabTON_";
  
  console.log(`Debugging repository for: ${projectIdentifier}`);
  
  try {
    // Find the project by name or URL
    const existingProject = await findProject(projectIdentifier);
    
    if (!existingProject) {
      console.log("No project found with this name or GitHub URL. Please create the project first in the UI.");
      return;
    }
    
    console.log(`Found project with ID: ${existingProject.id}`);
    console.log(`GitHub URL: ${existingProject.githuburl}`);
    
    // Check if the repository exists and is accessible
    await checkRepositoryAccess(existingProject.githuburl!);
    
    // Check if we already have files for this project
    const existingFiles = await prisma.sourceCodeEmbedding.count({
      where: {
        projectId: existingProject.id
      }
    });
    
    console.log(`Project has ${existingFiles} files loaded.`);
    
    // Process the repository files with verbose logging
    await processRepoWithDebug(existingProject.githuburl!, existingProject.id);
    
    // Also load commits with verbose logging
    console.log("Loading commits for the project...");
    await pullCommitWithDebug(existingProject.id);
    
    console.log("Debugging and fixing completed.");
    
  } catch (error) {
    console.error("Error in debugAndFixRepo:", error);
  } finally {
    await prisma.$disconnect();
  }
}

async function findProject(identifier: string) {
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

async function checkRepositoryAccess(repoUrl: string) {
  console.log(`Checking access to repository: ${repoUrl}`);
  
  try {
    // Extract owner and repo from URL
    const urlParts = repoUrl.split('/');
    const owner = urlParts[urlParts.length - 2];
    const repo = urlParts[urlParts.length - 1];
    
    console.log(`Owner: ${owner}, Repo: ${repo}`);
    
    // Check if the repository exists
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    console.log(`Checking GitHub API: ${apiUrl}`);
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };
    
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }
    
    const response = await axios.get(apiUrl, { headers });
    
    console.log(`Repository exists. Status: ${response.status}`);
    console.log(`Repository info: ${response.data.name}, ${response.data.description}`);
    console.log(`Default branch: ${response.data.default_branch}`);
    
    return true;
  } catch (error: any) {
    console.error(`Error accessing repository: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Response data:`, error.response.data);
      
      if (error.response.status === 404) {
        console.error(`Repository not found. Please check the URL.`);
      } else if (error.response.status === 403) {
        console.error(`Access forbidden. Check your GitHub token.`);
      } else if (error.response.status === 401) {
        console.error(`Unauthorized. Your GitHub token may be invalid.`);
      }
    }
    return false;
  }
}

async function processRepoWithDebug(repoUrl: string, projectId: string) {
  console.log(`Processing repository with debug: ${repoUrl} for project: ${projectId}`);
  
  try {
    // Load repository files with verbose logging
    console.log(`Loading files with token: ${githubToken ? 'Token provided' : 'No token'}`);
    
    // Try loading with different options if needed
    let docs: Array<{ pageContent: string; metadata?: { source?: string } }> = [];
    
    try {
      console.log("Attempting to load repository with recursive option...");
      docs = await loadGitHubRepository(repoUrl, githubToken, { recursive: true });
      console.log(`Loaded ${docs.length} documents with recursive option`);
    } catch (error) {
      console.error("Error loading with recursive option:", error);
      
      console.log("Trying without recursive option...");
      docs = await loadGitHubRepository(repoUrl, githubToken, { recursive: false });
      console.log(`Loaded ${docs.length} documents without recursive option`);
    }
    
    if (docs.length === 0) {
      console.error("No documents loaded. Repository may be empty or inaccessible.");
      return;
    }
    
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
        console.log(`Generating summary for ${source}...`);
        const summary = await summarizeCode(doc.pageContent);
        console.log(`Generated summary for ${source}`);
        
        // Generate embedding
        console.log(`Generating embedding for ${source}...`);
        const embedding = await generateEmbedding(doc.pageContent);
        console.log(`Generated embedding for ${source}`);
        
        // Store in database
        console.log(`Storing ${source} in database...`);
        await prisma.sourceCodeEmbedding.create({
          data: {
            projectId: projectId,
            fileName: source,
            sourceCode: doc.pageContent,
            summary: summary,
            embedding: embedding,
          },
        });
        
        console.log(`Successfully stored ${source} in database`);
      } catch (error) {
        console.error(`Error processing file ${source}:`, error);
      }
    }
    
    console.log(`Finished processing ${docs.length} files for project ${projectId}`);
    
  } catch (error) {
    console.error("Error in processRepoWithDebug:", error);
  }
}

async function pullCommitWithDebug(projectId: string) {
  try {
    console.log(`Pulling commits for project ${projectId} with debug...`);
    await pullCommit(projectId);
    console.log(`Successfully pulled commits for project ${projectId}`);
  } catch (error) {
    console.error(`Error pulling commits for project ${projectId}:`, error);
  }
}

// Run the script
debugAndFixRepo().catch(console.error);
