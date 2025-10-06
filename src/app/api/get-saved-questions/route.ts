import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // Get the project ID from the query parameters
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    
    if (!projectId) {
      return NextResponse.json(
        { error: "Missing required parameter: projectId" },
        { status: 400 }
      );
    }
    
    // Fetch saved questions for this project
    // Using raw SQL since the Prisma client might not be updated
    const savedQuestions = await prisma.$queryRawUnsafe(`
      SELECT 
        id, 
        question, 
        answer, 
        "referencedFiles", 
        "createdAt"
      FROM "Question"
      WHERE "projectId" = $1
      ORDER BY "createdAt" DESC
    `, projectId);
    
    return NextResponse.json({
      success: true,
      savedQuestions
    });
  } catch (err) {
    console.error("[Get Saved Questions API] Error:", err);
    
    return NextResponse.json(
      { 
        error: "Error fetching saved questions", 
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
