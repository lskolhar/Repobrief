import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Create a GoogleGenerativeAI instance directly
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Generate a fallback answer when the Gemini API fails
 * @param question The user's question
 * @param files Array of files with their content and metadata
 * @returns A formatted answer string
 */
function generateFallbackAnswer(question: string, files: any[]): string {
  // Extract keywords from the question
  const questionLower = question.toLowerCase();
  const questionWords = questionLower.split(/\s+/);
  const questionKeywords = questionWords.filter((word: string) => 
    word.length > 3 && !['what', 'where', 'when', 'which', 'about', 'does', 'this', 'that', 'have', 'from', 'with', 'file', 'code', 'function', 'page', 'button', 'component'].includes(word)
  );
  
  // Create a basic answer structure
  let answer = `FILE LOCATION:\n`;
  
  // Add information about relevant files
  if (files.length === 0) {
    answer += "No specific files found for this question.\n\n";
  } else {
    // List the top 3 most relevant files
    const topFiles = files.slice(0, 3);
    topFiles.forEach((file, index) => {
      answer += `${index + 1}. ${file.fileName}\n`;
      
      // Add matching lines if available
      if (file.matchingLines && file.matchingLines.length > 0) {
        answer += "   Relevant lines: ";
        file.matchingLines.slice(0, 5).forEach((lineNum: number, idx: number) => {
          answer += `Line ${lineNum}${idx < Math.min(4, file.matchingLines.length - 1) ? ", " : ""}`;  
        });
        answer += "\n";
      }
    });
    answer += "\n";
  }
  
  // Add explanation section
  answer += "EXPLANATION:\n";
  answer += `Based on the files in this repository, `;
  
  // Add README summary if available
  const readmeFile = files.find((file: any) => file.fileName.toLowerCase().includes('readme'));
  if (readmeFile) {
    // Extract a brief description from the README
    const readmeLines = readmeFile.sourceCode.split('\n');
    const descriptionLines = readmeLines.slice(0, 10).join(' ');
    answer += `this project appears to be ${descriptionLines.substring(0, 200)}...\n\n`;
  } else {
    // Generic fallback
    answer += `this project contains ${files.length} files. The most relevant files to your question about "${question}" are listed above.\n\n`;
  }
  
  // Add note about keywords
  if (questionKeywords.length > 0) {
    answer += `I searched for these keywords: ${questionKeywords.join(", ")}\n\n`;
  }
  
  // Add apology for limited information
  answer += "NOTE: Due to API limitations, I'm providing a simplified answer. For more detailed information, please try again later or rephrase your question.";
  
  return answer;
}

export async function POST(req: NextRequest) {
  try {
    const { question, projectId } = await req.json();
    
    if (!question || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: question and projectId" },
        { status: 400 }
      );
    }

    console.log(`[Simple QA] Processing question: "${question}" for project: ${projectId}`);
    
    // Get all files for this project
    console.log("[Simple QA] Fetching files for this project");
    const allFiles = await prisma.sourceCodeEmbedding.findMany({
      where: { projectId },
      select: {
        id: true,
        fileName: true,
        summary: true,
        sourceCode: true
      },
    });
    
    console.log(`[Simple QA] Found ${allFiles.length} files`);
    
    // If no files found, return early
    if (allFiles.length === 0) {
      return NextResponse.json({
        answer: "Sorry, no files were found for this project. Please add some files first.",
        referencedFiles: [],
      });
    }
    
    // Extract keywords from the question
    const questionLower = question.toLowerCase();
    const questionWords = questionLower.split(/\s+/);
    const questionKeywords = questionWords.filter((word: string) => 
      word.length > 3 && !['what', 'where', 'when', 'which', 'about', 'does', 'this', 'that', 'have', 'from', 'with', 'file', 'code', 'function', 'page', 'button', 'component'].includes(word)
    );
    
    console.log("[Simple QA] Keywords extracted from question:", questionKeywords);
    
    // Find files that contain the keywords
    const matchingFiles = allFiles.filter((file: any) => {
      const fileNameLower = file.fileName.toLowerCase();
      const sourceCodeLower = (file.sourceCode || '').toLowerCase();
      
      // Check for keyword matches in file name or source code
      for (const keyword of questionKeywords) {
        if (fileNameLower.includes(keyword) || sourceCodeLower.includes(keyword)) {
          console.log(`[Simple QA] Found keyword "${keyword}" in file: ${file.fileName}`);
          return true;
        }
      }
      
      return false;
    });
    
    // Find specific line numbers where keywords appear
    const enhancedMatchingFiles = matchingFiles.map((file: any) => {
      // Create a copy of the file
      const enhancedFile = { ...file };
      
      // Find line numbers where keywords appear
      const matchingLines: number[] = [];
      const matchingLineContents: string[] = [];
      const sourceCodeLines = (file.sourceCode || '').split('\n');
      
      sourceCodeLines.forEach((line: string, index: number) => {
        const lineLower = line.toLowerCase();
        for (const keyword of questionKeywords) {
          if (lineLower.includes(keyword.toLowerCase())) {
            matchingLines.push(index + 1); // +1 because line numbers start at 1
            matchingLineContents.push(line.trim());
            break; // Only add each line once
          }
        }
      });
      
      // Add matching line information to the file
      enhancedFile.matchingLines = matchingLines;
      enhancedFile.matchingLineContents = matchingLineContents;
      
      return enhancedFile;
    });
    
    console.log(`[Simple QA] Found ${matchingFiles.length} files matching keywords`);
    
    // Prioritize README files first
    const readmeFiles = allFiles.filter((file: any) => 
      file.fileName.toLowerCase().includes('readme')
    );
    
    // Then prioritize package.json for project info
    const packageFiles = allFiles.filter((file: any) => 
      file.fileName.toLowerCase().includes('package.json')
    );
    
    // Then source files - prioritize main entry points and important files
    const sourceFiles = allFiles.filter((file: any) => {
      const lowerFileName = file.fileName.toLowerCase();
      return (
        (lowerFileName.includes('/src/') || 
         lowerFileName.includes('/app/') ||
         lowerFileName.includes('/pages/') ||
         lowerFileName.includes('index.') ||
         lowerFileName.includes('main.') ||
         lowerFileName.includes('app.')) && 
        !readmeFiles.includes(file) && 
        !packageFiles.includes(file)
      );
    });
    
    // Then other important config files
    const configFiles = allFiles.filter((file: any) => {
      const lowerFileName = file.fileName.toLowerCase();
      return (
        (lowerFileName.includes('.config.') ||
         lowerFileName.includes('tsconfig.') ||
         lowerFileName.includes('webpack.') ||
         lowerFileName.includes('.env') ||
         lowerFileName.includes('dockerfile')) &&
        !readmeFiles.includes(file) && 
        !packageFiles.includes(file) &&
        !sourceFiles.includes(file)
      );
    });
    
    // Combine in priority order, putting matching files first
    const prioritizedFiles = [
      ...enhancedMatchingFiles.filter((file: any) => !readmeFiles.includes(file)), // Matching files first (except README)
      ...readmeFiles,
      ...enhancedMatchingFiles.filter((file: any) => readmeFiles.includes(file)), // README files that match keywords
      ...packageFiles.filter((file: any) => !enhancedMatchingFiles.includes(file)),
      ...sourceFiles.filter((file: any) => !enhancedMatchingFiles.includes(file)),
      ...configFiles.filter((file: any) => !enhancedMatchingFiles.includes(file)),
      ...allFiles.filter((file: any) => 
        !readmeFiles.includes(file) && 
        !packageFiles.includes(file) && 
        !sourceFiles.includes(file) &&
        !configFiles.includes(file) &&
        !enhancedMatchingFiles.includes(file)
      )
    ].slice(0, 15); // Limit to 15 files
    
    // Build context string from prioritized files
    let context = "";
    for (const file of prioritizedFiles) {
      context += `File: ${file.fileName}\nSummary: ${file.summary}\nSource Code:\n${file.sourceCode || ''}\n---\n`;
    }
    
    // Construct prompt for Gemini with specific instructions
    console.log("[Simple QA] Constructing prompt for Gemini");
    const prompt = `You are an AI code assistant for a project. Use the following context from the user's codebase to answer the question.
    
When answering questions about specific code or features, focus on the exact files that contain the relevant keywords from the question.
If the question is about a specific UI element, button, or feature, identify the exact file and line numbers where it's implemented.

For each file that contains matching keywords, I've provided the specific line numbers and line contents. Use this information to give precise answers.

FORMATTING INSTRUCTIONS:
1. Make main technology names or key points BOLD by using <b>text</b> HTML tags instead of markdown
2. Use proper numbered or bulleted lists for listing features, technologies, or steps
3. For section titles, use UPPERCASE followed by a colon (e.g., "TECHNOLOGIES USED:")
4. Start your answer with a clear title that summarizes the question
5. When mentioning code or file names, be very specific about where to find them
6. Keep your answer concise and focused on the question
7. Avoid technical jargon unless necessary
8. Structure your answer with clear sections and white space for readability
9. For each technology or feature, include:
   - The name in bold
   - A brief description
   - Where it's used in the codebase (file and line numbers)
   - How it contributes to the project
10. For code snippets, clearly indicate line numbers and format them properly
11. If multiple files are involved, list them in order of relevance
12. When showing code, include the exact line numbers where keywords were found
13. Format lists with proper indentation and spacing for readability

Context:
${context}

Question: ${question}

Answer the question with a well-structured, easy-to-read response that directly addresses the question. Make sure to reference specific files and line numbers when relevant:`;
    
    // Generate answer from Gemini
    console.log("[Simple QA] Generating answer from Gemini");
    let answer = "";
    
    // Add retry logic for Gemini API
    const MAX_RETRIES = 3;
    let retries = 0;
    
    while (retries < MAX_RETRIES) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        answer = result.response.text();
        break; // Success, exit the retry loop
      } catch (error: any) {
        retries++;
        console.error(`[Simple QA] Gemini API error (attempt ${retries}/${MAX_RETRIES}):`, error);
        
        // If rate limited (429), wait longer
        const isRateLimited = error?.status === 429;
        
        if (retries < MAX_RETRIES) {
          // Exponential backoff with longer waits for rate limiting
          const delay = Math.pow(2, retries) * (isRateLimited ? 5000 : 1000);
          console.log(`[Simple QA] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Generate a fallback answer based on the context
          console.log("[Simple QA] Max retries reached, using fallback answer generation");
          
          // Create a simple fallback answer based on the files we found
          answer = generateFallbackAnswer(question, prioritizedFiles);
        }
      }
    }
    
    // Post-process the answer to improve formatting while preserving HTML bold tags
    answer = answer
      .replace(/^#+\s+/gm, '') // Remove heading markers
      .replace(/^\*\s+/gm, '• ') // Replace * bullets with bullet points
      .replace(/^\d+\.\s+/gm, (match) => match) // Preserve numbered lists
      // HTML bold tags are already preserved (<b>text</b>)
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Convert any markdown bold to HTML bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markers
      .replace(/`([^`]+)`/g, '$1') // Remove code markers
      .replace(/```[\s\S]*?```/g, (match) => { // Clean code blocks
        return match
          .replace(/```[\w]*\n/, '') // Remove opening ```
          .replace(/```$/, ''); // Remove closing ```
      })
      // Improve section formatting
      .replace(/(FILE LOCATION:)/g, '\n$1')
      .replace(/(CODE SNIPPET:)/g, '\n$1')
      .replace(/(EXPLANATION:)/g, '\n$1')
      // Add spacing around code blocks for better readability
      .replace(/(<Button|function|import|export|class|const|let|var)/g, '\n$1')
      .replace(/(\n[A-Za-z_]+\([^)]*\)\s*{)/g, '\n$1') // Add space before function definitions
      .replace(/\n\n+/g, '\n\n'); // Normalize spacing
    
    return NextResponse.json({
      answer,
      referencedFiles: prioritizedFiles
        // Filter to include more relevant files
        .filter((file: any) => {
          // Always include README and package.json files
          if (file.fileName.toLowerCase().includes('readme') || 
              file.fileName.toLowerCase().includes('package.json')) {
            return true;
          }
          
          // Always include files that match keywords from the question
          const lowerFileName = file.fileName.toLowerCase();
          const lowerSourceCode = (file.sourceCode || '').toLowerCase();
          
          // Check if any keywords are in the file name or source code
          for (const keyword of questionKeywords) {
            if (lowerFileName.includes(keyword) || lowerSourceCode.includes(keyword)) {
              return true;
            }
          }
          
          // Include important source files that might be relevant
          if ((lowerFileName.includes('/src/') || 
               lowerFileName.includes('/app/') ||
               lowerFileName.includes('/pages/') ||
               lowerFileName.includes('index.') ||
               lowerFileName.includes('main.') ||
               lowerFileName.includes('app.')) &&
              // Only include if they might be relevant to the question
              questionKeywords.some((keyword: string) => 
                lowerFileName.includes(keyword.substring(0, 4)) || 
                lowerSourceCode.includes(keyword)
              )) {
            return true;
          }
          
          // Skip less relevant files
          return false;
        })
        // Limit to at most 10 files but ensure we have the most relevant ones
        .slice(0, 10)
        .map((file: any) => ({
          id: file.id,
          fileName: file.fileName,
          summary: file.summary,
          sourceCode: file.sourceCode || "",
          matchingLines: file.matchingLines || [],
          matchingLineContents: file.matchingLineContents || []
        })),
    });
  } catch (err) {
    // Log the detailed error
    console.error("[Simple QA] Error:", err);
    
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
