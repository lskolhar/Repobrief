#!/usr/bin/env bun
import { prisma } from "../src/lib/prisma";
import { pullCommit } from "../src/lib/github";
import dotenv from "dotenv";
dotenv.config();

// Speechly Expense Tracker repository
const repoUrl = "https://github.com/adrianhajdin/speechly_expense_tracker_project";

async function loadSpeechlyCommits() {
  console.log("Starting to load commits for Speechly Expense Tracker project...");
  
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
    
    // Pull commits for this project
    console.log("Pulling commits from GitHub...");
    await pullCommit(existingProject.id);
    
    console.log("Finished loading commits for the project");
    
  } catch (error) {
    console.error("Error in loadSpeechlyCommits:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
loadSpeechlyCommits().catch(console.error);
