import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    // Get the request body
    const { question, answer, projectId, referencedFiles } = await req.json();
    
    if (!question || !answer || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: question, answer, and projectId" },
        { status: 400 }
      );
    }
    
    // Verify the project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    
    // Get the first user as a fallback (this is a simplification)
    const user = await prisma.user.findFirst();
    
    if (!user) {
      return NextResponse.json(
        { error: "No users found in the system" },
        { status: 404 }
      );
    }
    
    // Use raw SQL to insert the question since the Prisma client might not be updated
    const result = await prisma.$executeRawUnsafe(`
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
      question, 
      answer, 
      JSON.stringify(referencedFiles || []), 
      projectId, 
      user.id
    );
    
    return NextResponse.json({
      success: true,
      message: "Question saved successfully"
    });
  } catch (err) {
    console.error("[Save Question API] Error:", err);
    
    return NextResponse.json(
      { 
        error: "Error saving question", 
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
