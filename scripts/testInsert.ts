#!/usr/bin/env bun
import { prisma } from "../src/lib/prisma";
import dotenv from "dotenv";
dotenv.config();

async function insertTestEmbedding() {
  console.log("Starting test insert...");
  
  try {
    // Check what fields are available in the model
    console.log("Available fields in SourceCodeEmbedding model:", Object.keys(prisma.sourceCodeEmbedding.fields));
    
    // First create the row without the embedding
    const inserted = await prisma.sourceCodeEmbedding.create({
      data: {
        fileName: "test-file.ts",
        summary: "This is a test summary created to verify the database connection.",
        sourceCode: "console.log('Hello world');", // required field
        projectId: "clsb4jjkx0000ixc1kcpxwqr2", // Use an existing project ID from your database
      },
    });
    
    // Now update with a raw SQL query to add the embedding
    const testEmbedding = Array(768).fill(0).map(() => Math.random());
    await prisma.$executeRawUnsafe(
      `UPDATE \"SourceCodeEmbedding\" SET embedding = $1 WHERE id = $2`,
      testEmbedding,
      inserted.id
    );
    
    console.log("Test embedding inserted successfully with ID:", inserted.id);
    console.log("Check Prisma Studio to see the entry.");
  } catch (error) {
    console.error("Error inserting test embedding:", error);
  } finally {
    await prisma.$disconnect();
  }
}

insertTestEmbedding().catch(console.error);
