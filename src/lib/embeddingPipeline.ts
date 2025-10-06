import { prisma } from "./prisma";
import { loadGitHubRepository } from "./githubLoader";
import type { GitHubRepoDocument } from "./githubLoader";

/**
 * Loads, summarizes, embeds, and saves all source files from a GitHub repo into the database.
 * @param projectId - The project ID in the DB
 * @param repoUrl - The GitHub repo URL
 * @param githubToken - Optional GitHub token
 */
export async function indexGitHubRepo(projectId: string, repoUrl: string, githubToken?: string) {
  console.log("[EmbeddingPipeline] Loading documents from repo:", repoUrl);
  const rawDocs = await loadGitHubRepository(repoUrl, githubToken);
  // Ensure each doc has a metadata.source property (fallback to empty string if missing)
  const docs: GitHubRepoDocument[] = rawDocs.map((doc: any) => ({
    pageContent: doc.pageContent,
    metadata: {
      source: doc.metadata?.source || "",
      ...doc.metadata
    }
  }));
  console.log(`[EmbeddingPipeline] Loaded ${docs.length} documents.`);

  // Summarize and embed each doc sequentially with clear progress logs
  console.log("[EmbeddingPipeline] Summarizing and embedding documents...");
  for (let idx = 0; idx < docs.length; idx++) {
    const doc = docs[idx];
    if (!doc) {
      console.warn(`[EmbeddingPipeline] Skipping undefined doc at index ${idx}`);
      continue;
    }
    const fileName = doc.metadata.source;
    const sourceCode = doc.pageContent;
    console.log(`processing ${idx + 1}/${docs.length}`);
    console.log(`getting summary for ${fileName}`);
    let summary = "";
    try {
      summary = await summarizeCode(sourceCode);
    } catch (err) {
      summary = "";
      console.warn(`[EmbeddingPipeline] Gemini summary error for ${fileName}:`, err);
    }
    let embedding: number[] = [];
    try {
      embedding = await generateEmbedding(summary);
    } catch (err) {
      embedding = createFallbackEmbedding(summary);
      console.warn(`[EmbeddingPipeline] Gemini embedding error for ${fileName}:`, err);
    }
    if (!embedding || !Array.isArray(embedding) || embedding.length !== 768) {
      console.warn(`[EmbeddingPipeline] Invalid embedding for ${fileName}`);
      continue;
    }
    try {
      // Insert the row without the embedding first
      const inserted = await prisma.sourceCodeEmbedding.create({
        data: {
          fileName,
          summary,
          sourceCode,
          projectId,
        },
      });
      // Now update the embedding with a raw SQL query
      await prisma.$executeRawUnsafe(
        `UPDATE "SourceCodeEmbedding" SET embedding = $1 WHERE id = $2`,
        embedding,
        inserted.id
      );
      console.log(`Inserted embedding for: ${fileName}`);
    } catch (err) {
      console.error(`[EmbeddingPipeline] DB insert error for ${fileName}:`, err);
    }
  }
  console.log("[EmbeddingPipeline] All embeddings processed and inserted.");
}

import { summarizeCommit, generateEmbedding as geminiGenerateEmbedding } from "./gemini";

/**
 * Creates a deterministic pseudo-random embedding based on the input text
 * This is used as a fallback when the Gemini API fails
 */
function createFallbackEmbedding(text: string): number[] {
  // Simple hash function to get a number from a string
  const hash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  };

  // Create a seeded random number generator
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  // Generate 768 dimensions using the text as seed
  const textHash = hash(text);
  const embedding: number[] = [];
  for (let i = 0; i < 768; i++) {
    embedding.push(seededRandom(textHash + i));
  }

  return embedding;
}

export async function summarizeCode(code: string): Promise<string> {
  try {
    // Use Gemini API to summarize code (prompt: explain purpose, 100 words max)
    const prompt = `You are an intelligent senior software engineer specializing in onboarding people. Explain the purpose of the following code in no more than 100 words.\n\n${code.slice(0, 10000)}`;
    return await summarizeCommit(prompt);
  } catch (err) {
    console.warn("[EmbeddingPipeline] Gemini summarizeCode error:", err);
    return "";
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Use Gemini API to generate a 768-dim embedding
    return await geminiGenerateEmbedding(text);
  } catch (err) {
    console.warn("[EmbeddingPipeline] Gemini generateEmbedding error:", err);
    return createFallbackEmbedding(text);
  }
}
