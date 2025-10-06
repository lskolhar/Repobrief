import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

import { pullCommit } from "@/lib/github";
import { loadGitHubRepository, checkCredits } from "@/lib/githubLoader";
import { generateEmbedding, summarizeCode } from "@/lib/embeddingPipeline";

export const projectRouter = createTRPCRouter({
  // Check credits required for a repository
  checkCredits: protectedProcedure
    .input(
      z.object({
        githubUrl: z.string(),
        githubToken: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Get file count from the repository
        const fileCount = await checkCredits(input.githubUrl, input.githubToken);

        // Get user's current credits
        const user = await ctx.db.user.findUnique({
          where: { id: ctx.user.userId! },
          select: { credits: true }
        });

        if (!user) {
          throw new Error('User not found');
        }

        return {
          fileCount,
          userCredits: user.credits
        };
      } catch (error: any) {
        console.error('Error checking credits:', error);
        throw new Error(error.message || 'Failed to check credits');
      }
    }),
  createProject: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        githuburl: z.string(),
        githubtoken: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First check if user has enough credits
      const fileCount = await checkCredits(input.githuburl, input.githubtoken);
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.user.userId! },
        select: { credits: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.credits < fileCount) {
        throw new Error('Insufficient credits');
      }

      // Create the project and deduct credits
      const project = await ctx.db.project.create({
        data: {
          name: input.name,
          githuburl: input.githuburl,
          userToProject: {
            create: {
              userId: ctx.user.userId!,
            }
          }
        }
      });

      // Deduct credits
      await ctx.db.user.update({
        where: { id: ctx.user.userId! },
        data: { credits: { decrement: fileCount } }
      });

      // Record the transaction
      await ctx.db.stripeTransaction.create({
        data: {
          credits: -fileCount,
          user: { connect: { id: ctx.user.userId! } }
        }
      });
      
      // Start the embedding process asynchronously
      void (async () => {
        try {
          console.log(`Starting embedding process for project ${project.id} (${input.githuburl})...`);
          
          // Add retry logic for loading repository files
          const MAX_RETRIES = 3;
          let retries = 0;
          let docs: Array<{ pageContent: string; metadata?: { source?: string } }> = [];
          
          while (retries < MAX_RETRIES && docs.length === 0) {
            try {
              // Load repository files
              docs = await loadGitHubRepository(input.githuburl, input.githubtoken || undefined, { recursive: true });
              console.log(`Loaded ${docs.length} documents from ${input.githuburl}`);
              
              // If no docs were loaded, retry
              if (docs.length === 0) {
                retries++;
                console.log(`No documents loaded, retrying (${retries}/${MAX_RETRIES})...`);
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 3000 * retries));
              }
            } catch (loadError) {
              retries++;
              console.error(`Error loading repository (attempt ${retries}/${MAX_RETRIES}):`, loadError);
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 3000 * retries));
            }
          }
          
          // If still no docs after all retries, log error and return
          if (docs.length === 0) {
            console.error(`Failed to load any documents from ${input.githuburl} after ${MAX_RETRIES} attempts`);
            return;
          }
          
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
          
          // Process ALL files for maximum coverage
          const filesToProcess = prioritizedDocs;
          
          // Process each file
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
              // Create the record
              const inserted = await ctx.db.sourceCodeEmbedding.create({
                data: {
                  fileName,
                  summary,
                  sourceCode,
                  projectId: project.id
                }
              });
              
              // Update with embedding using raw SQL
              if (embedding.length === 768) {
                await ctx.db.$executeRawUnsafe(
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
          
          console.log(`Finished embedding process for project ${project.id}`);
          
          // After loading files, also fetch commits automatically
          try {
            console.log(`Fetching commits for project ${project.id}...`);
            await pullCommit(project.id);
            console.log(`Successfully fetched commits for project ${project.id}`);
          } catch (commitError) {
            console.error(`Error fetching commits for project ${project.id}:`, commitError);
          }
        } catch (error) {
          console.error(`Error in embedding process for project ${project.id}:`, error);
        }
      })();
      
      return project;
    }),
  // Returns all projects for the current user (not deleted, most recent first)
  getProjects: protectedProcedure.query(async ({ ctx }) => {
    // Check if user ID is available
    if (!ctx.user?.userId) {
      console.warn('User ID not available in getProjects query');
      return [];
    }
    
    try {
      const projects = await ctx.db.project.findMany({
        where: {
          userToProject: {
            some: {
              userId: ctx.user.userId,
            },
          },
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });
      return projects;
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
  }),
  pullCommits: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return pullCommit(input.projectId);
    }),
  // Save a question and answer
  saveAnswer: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        question: z.string(),
        answer: z.string(),
        referencedFiles: z.any(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Use raw SQL to insert the question since the Prisma client might not be updated
        const result = await ctx.db.$executeRawUnsafe(`
          INSERT INTO "Question" (
            "id", 
            "createdAt", 
            "updatedAt", 
            "question", 
            "answer", 
            "referencedFiles", 
            "projectId", 
            "userId"
          ) 
          VALUES (
            gen_random_uuid()::text, 
            NOW(), 
            NOW(), 
            $1, 
            $2, 
            $3::jsonb, 
            $4, 
            $5
          )
          RETURNING "id"
        `, 
          input.question, 
          input.answer, 
          JSON.stringify(input.referencedFiles || []), 
          input.projectId, 
          ctx.user.userId!
        );
        
        return { success: true, message: "Answer saved successfully" };
      } catch (error) {
        console.error("Error saving question:", error);
        throw new Error("Failed to save question");
      }
    }),
    
  // Get saved questions for a project
  getQuestions: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        // Use raw SQL to get questions since the Prisma client might not be updated
        const questions = await ctx.db.$queryRawUnsafe(`
          SELECT 
            q."id", 
            q."createdAt", 
            q."updatedAt", 
            q."question", 
            q."answer", 
            q."referencedFiles", 
            q."projectId",
            u."id" as "userId",
            u."firstName",
            u."lastName",
            u."imageUrl"
          FROM "Question" q
          JOIN "User" u ON q."userId" = u."id"
          WHERE q."projectId" = $1
          ORDER BY q."createdAt" DESC
        `, input.projectId);
        
        return questions;
      } catch (error) {
        console.error("Error getting questions:", error);
        return [];
      }
    }),
});