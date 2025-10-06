import { streamText } from 'ai';
import { createGoogleGenerativeAI, google } from "@ai-sdk/google";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/embeddingPipeline";

// Create a GoogleGenerativeAI instance (Gemini API)
const gemini = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export async function getRagAnswer(question: string, projectId: string) {
  try {
    console.log(`[getRagAnswer] Processing question: "${question}" for project: ${projectId}`);
    
    // 1. Generate embedding for the question
    console.log("[getRagAnswer] Generating embedding for question");
    const queryVector = await generateEmbedding(question);
    
    if (!queryVector || queryVector.length === 0) {
      console.error("[getRagAnswer] Failed to generate embedding for question");
      throw new Error("Failed to generate embedding for question");
    }
    
    const queryVectorStr = queryVector.join(",");
    console.log(`[getRagAnswer] Generated embedding with ${queryVector.length} dimensions`);

    // 2. Query the DB for files from this project
    console.log("[getRagAnswer] Querying database for files");
    let result: any[] = [];
    
    try {
      // Use a simple query without vector similarity
      console.log("[getRagAnswer] Using simple query without vector similarity");
      const files = await prisma.sourceCodeEmbedding.findMany({
        where: { projectId },
        take: 10,
      });
      
      result = files;
      console.log(`[getRagAnswer] Found ${result.length} files`);
    } catch (err) {
      console.error("[getRagAnswer] Error querying database:", err);
      // Continue with empty result
    }

    // If no results found, try without similarity threshold
    if (result.length === 0) {
      console.log("[getRagAnswer] No results, trying without threshold");
      const fallbackResult = await prisma.sourceCodeEmbedding.findMany({
        where: { projectId },
        take: 5,
      });
      
      console.log(`[getRagAnswer] Found ${fallbackResult.length} files without threshold`);
      
      if (fallbackResult.length > 0) {
        // Use fallback results instead
        result.push(...fallbackResult);
      } else {
        // If still no results, just get any files from this project
        console.log("[getRagAnswer] No results, fetching any files");
        const anyFiles = await prisma.sourceCodeEmbedding.findMany({
          where: { projectId },
          take: 5,
        });
        
        console.log(`[getRagAnswer] Found ${anyFiles.length} files`);
        
        if (anyFiles.length > 0) {
          // Add these files to the result
          result.push(...anyFiles);
        }
      }
    }

    // 3. Build context string by concatenating file name, summary, and source code
    let context = "";
    for (const doc of result) {
      context += `File: ${doc.fileName}\nSummary: ${doc.summary}\nSource Code:\n${doc.sourceCode}\n---\n`;
    }

    // If still no context, use a generic response
    if (!context) {
      console.log("[getRagAnswer] No context available, using generic response");
      context = "No specific code context available for this project.";
    }

    // 4. Construct the prompt for Gemini
    console.log("[getRagAnswer] Constructing prompt for Gemini");
    const prompt = `You are an AI code assistant. Use the following context from the user's codebase to answer the question.\n\nContext:\n${context}\n\nQuestion: ${question}\nAnswer:`;

    // 5. Stream answer from Gemini
    console.log("[getRagAnswer] Streaming answer from Gemini");
    const textStream = await streamText({
      model: google("models/gemini-1.5-flash"),
      prompt,
    });

    // 6. Stream output token by token
    async function* streamAnswer() {
      try {
        for await (const delta of textStream.textStream) {
          yield delta;
        }
      } catch (err) {
        console.error("[getRagAnswer] Error in stream:", err);
        yield "Error during streaming. Please try again.";
      }
    }

    // 7. Return the stream and referenced files (with fileName, summary, sourceCode)
    return {
      output: streamAnswer(),
      referencedFiles: result.map((doc: { id: string; fileName: string; summary: string; sourceCode?: string }) => ({
        id: doc.id,
        fileName: doc.fileName,
        summary: doc.summary,
        sourceCode: doc.sourceCode || ""
      })),
    };
  } catch (err) {
    // Log the detailed error
    console.error("[getRagAnswer] Error:", err);
    
    // Always return a stream, even on error
    const errorStream = (async function* () {
      yield `Sorry, there was an error generating the answer: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again later.`;
    })();
    return {
      output: errorStream,
      referencedFiles: [],
    };
  }
}
