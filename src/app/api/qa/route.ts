import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Create a GoogleGenerativeAI instance directly
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

import { generateEmbedding } from "@/lib/embeddingPipeline";

export async function POST(req: NextRequest) {
  try {
    const { question, projectId } = await req.json();
    const semanticMode = req.nextUrl?.searchParams?.get('semantic') === 'true';
    
    if (!question || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: question and projectId" },
        { status: 400 }
      );
    }

    console.log(`[QA API] Processing question: "${question}" for project: ${projectId}`);
    
    // Get all files for this project - no vector search
    console.log("[QA API] Fetching files for this project");
    const files = await prisma.sourceCodeEmbedding.findMany({
      where: { projectId },
      // For semantic mode, fetch all. For legacy, fetch 10 for perf
      take: semanticMode ? undefined : 10,
    });
    
    console.log(`[QA API] Found ${files.length} files`);
    
    // If no files found, return early
    if (files.length === 0) {
      return NextResponse.json({
        answer: "Sorry, no files were found for this project. Please add some files first.",
        referencedFiles: [],
      });
    }
    
    let topFiles = [];
    if (semanticMode) {
      // --- SEMANTIC SEARCH MODE ---
      try {
        const questionEmbedding = await generateEmbedding(question);
        // Compute cosine similarity for each file
        const scoredFiles = files.map(file => {
          if (
            !file ||
            !file.embedding ||
            !Array.isArray(file.embedding) ||
            !questionEmbedding ||
            !Array.isArray(questionEmbedding) ||
            file.embedding.length !== questionEmbedding.length
          ) {
            return { file, similarity: -1 };
          }
          const embedding = file.embedding as number[];
          const qEmbedding = questionEmbedding; // questionEmbedding is guaranteed to be an array here
          const dot = embedding.reduce((sum, v, i) => sum + v * qEmbedding[i]!, 0);
          const normA = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 0;
          const normB = Math.sqrt(qEmbedding.reduce((sum, v) => sum + v * v, 0)) || 0;
          const similarity = (normA && normB) ? dot / (normA * normB) : -1;
          return { file, similarity };
        });
        // Sort by similarity and take top 5
        topFiles = scoredFiles
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5)
          .map(item => item.file);
      } catch (err) {
        console.error('[QA API] Error in semantic search:', err);
        topFiles = files.slice(0, 5);
      }
    } else {
      // --- LEGACY KEYWORD MODE ---
      const scoredFiles = files.map(file => {
        // Calculate a simple relevance score based on text matching
        const lowerQuestion = question.toLowerCase();
        const lowerFileName = file.fileName.toLowerCase();
        const lowerSummary = file.summary?.toLowerCase();
        const lowerSourceCode = (file.sourceCode || '').toLowerCase();
        
        let score = 0;
        
        // Check for keyword matches in file name
        if (lowerFileName.includes(lowerQuestion)) score += 5;
        
        // Check for keyword matches in summary
        if (lowerSummary.includes(lowerQuestion)) score += 3;
        
        // Check for keyword matches in source code
        if (lowerSourceCode.includes(lowerQuestion)) score += 2;
        
        // Split question into words and check for individual word matches
        const words = lowerQuestion.split(/\s+/).filter((w: string) => w.length > 3);
        for (const word of words) {
          if (lowerFileName.includes(word)) score += 2;
          if (lowerSummary.includes(word)) score += 1;
          if (lowerSourceCode.includes(word)) score += 0.5;
        }
        
        return { file, score };
      });
      // Sort by score and take top results
      topFiles = scoredFiles
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(item => item.file);
    }
    
    // Build context string from top files
    let context = "";
    for (const file of topFiles) {
      context += `File: ${file.fileName}\nSummary: ${file.summary}\nSource Code:\n${file.sourceCode || ''}\n---\n`;
    }
    
    // If still no context, use a generic response
    if (!context) {
      context = "No specific code context available for this project.";
    }
    
    // Construct prompt for Gemini
    console.log("[QA API] Constructing prompt for Gemini");
    const prompt = `You are an AI code assistant. Use the following context from the user's codebase to answer the question.

Context:
${context}

Question: ${question}

Answer the question with detailed explanations. Format your response using markdown:
- Use proper headings (##) for sections
- Format code snippets with triple backticks and the appropriate language
- Use **bold** for important terms
- Use inline code formatting with backticks for variable names, function names, and short code references
- If referencing specific lines or sections of code, clearly indicate the file and line numbers
- Highlight the most relevant parts of the code that answer the question

Answer:`;
    
    // Generate answer from Gemini
    console.log("[QA API] Generating answer from Gemini");
    let answer = "";
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      answer = result.response.text();
    } catch (error) {
      console.error("[QA API] Error generating content with Gemini:", error);
      answer = "Sorry, there was an error generating the answer. Please try again later.";
    }
    
    // Return the answer and referenced files with structured code references
    const structuredReferences = (topFiles || []).map((file: any) => ({
      fileName: file.fileName,
      summary: file.summary || '',
      sourceCode: file.sourceCode || file.codeSnippet || '',
    }));
    return NextResponse.json({
      answer,
      referencedFiles: structuredReferences,
    });
  } catch (err) {
    // Log the detailed error
    console.error("[QA API] Error:", err);
    
    return NextResponse.json(
      { 
        error: "Error generating answer", 
        message: err instanceof Error ? err.message : "Unknown error",
        answer: "Sorry, there was an error generating the answer. Please try again later."
      },
      { status: 500 }
    );
  }
}
