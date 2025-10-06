import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Ensure params is properly awaited before accessing properties
    const projectId = params.projectId;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Check if user has access to this project
    const userProject = await db.userToProject.findFirst({
      where: {
        userId,
        projectId,
      },
    });

    if (!userProject) {
      return NextResponse.json(
        { error: "You don't have access to this project" },
        { status: 403 }
      );
    }

    // Get all team members for this project
    const teamMembers = await db.userToProject.findMany({
      where: {
        projectId,
      },
      select: {
        userId: true,
        createdAt: true,
      },
    });

    // Get user details from Clerk
    // In a real implementation, you would fetch user details from Clerk API
    // For now, we'll just return the user IDs
    
    return NextResponse.json({ 
      members: teamMembers,
      totalMembers: teamMembers.length
    });
  } catch (error) {
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}
