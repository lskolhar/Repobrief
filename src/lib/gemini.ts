import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Summarizes a git commit diff using Gemini
 * @param diff - The git diff string
 * @returns The summary text from Gemini
 */
export async function summarizeCommit(diff: string): Promise<string> {
  const MAX_RETRIES = 3;
  let retries = 0;
  
  const prompt = `
You are an expert programmer. Summarize the following git diff in clear, concise language for a changelog or PR reviewer.
The diff is in standard unified format.

${diff}
`;

  while (retries < MAX_RETRIES) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      retries++;
      console.error(`Gemini summarizeCommit error (attempt ${retries}/${MAX_RETRIES}):`, error);
      
      if (retries < MAX_RETRIES) {
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, retries) * 1000;
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Return a generic summary as fallback
        console.log("Max retries reached for summarizeCommit, using fallback summary");
        return "Updated code with various improvements and fixes.";
      }
    }
  }
  
  // This should never be reached due to the fallback in the catch block
  return "Code changes made to the repository.";
}

// Gemini Embedding Function
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

export async function generateEmbedding(text: string): Promise<number[]> {
  const MAX_RETRIES = 3;
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      // Gemini expects content as an array of parts
      const result = await embeddingModel.embedContent({
        content: {
          role: "user",
          parts: [{ text: text || "empty text" }],
        }
      });
      
      if (!result.embedding || !result.embedding.values || result.embedding.values.length === 0) {
        throw new Error("Empty embedding returned from Gemini API");
      }
      
      return result.embedding.values; // Should be an array of 768 numbers
    } catch (error) {
      retries++;
      console.error(`Gemini embedding error (attempt ${retries}/${MAX_RETRIES}):`, error);
      
      if (retries < MAX_RETRIES) {
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, retries) * 1000;
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Create a deterministic fallback embedding based on the text
        console.log("Max retries reached, using fallback embedding");
        
        // Return a deterministic array of 768 numbers based on the text
        // This is just a fallback and won't have semantic meaning
        const fallbackEmbedding = new Array(768).fill(0).map((_, i) => {
          // Use a simple hash of the text + position to generate a value between -1 and 1
          const hash = Array.from(text || "fallback").reduce((h, c) => 
            Math.imul(31, h) + c.charCodeAt(0) | 0, i + 1);
          return (hash % 200) / 100 - 1;
        });
        
        return fallbackEmbedding;
      }
    }
  }
  
  // This should never be reached due to the fallback in the catch block
  return new Array(768).fill(0);
}

// Example usage (for testing, remove or comment out in production)
if (require.main === module) {
  // Test embedding generation
  generateEmbedding("hello world").then(embedding => {
    console.log("Gemini embedding (length):", embedding.length);
    console.log(embedding);
  }).catch(console.error);

  // Example diff string for summary
  const diff = `
--git a/README.md b/README.md
index cc23ebe..c8d7fad 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,2 @@
 # ComplainHub
-The Complaint Management System is a full-stack web application designed for students to register complaints related to various issues such as WiFi problems, hostel maintenance, food quality, and more. Admins can efficiently track, categorize, prioritize, and resolve complaints through an interactive dashboard.
+The Complaint Management System is a full-stack web application designed for students to register complaints related to various issues such as WiFi problems, hostel maintenance, food quality, and more.The Admin will efficiently track, categorize, prioritize, and resolve complaints through an interactive dashboard.
`;

  summarizeCommit(diff).then(summary => {
    console.log("Gemini summary:", summary);
  });
}
