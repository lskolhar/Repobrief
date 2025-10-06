import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";

export async function POST(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    // Get the authenticated user
    const session = await auth();
    const userId = session?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const projectId = params.projectId;
    
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Check if the user has access to this project
    const userProject = await db.userToProject.findFirst({
      where: {
        userId: userId,
        projectId: projectId,
      },
    });

    if (!userProject) {
      return NextResponse.json(
        { error: "Project not found or you don't have access" },
        { status: 404 }
      );
    }

    // Soft delete the project by setting deletedAt
    const updatedProject = await db.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, project: updatedProject });
  } catch (error) {
    console.error("Error archiving project:", error);
    return NextResponse.json(
      { error: "Failed to archive project" },
      { status: 500 }
    );
  }
}
