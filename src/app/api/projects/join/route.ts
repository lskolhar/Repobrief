import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Check if project exists
    const project = await db.project.findUnique({
      where: {
        id: projectId,
        deletedAt: null,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Check if user is already a member of the project
    const existingMembership = await db.userToProject.findFirst({
      where: {
        userId,
        projectId,
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { message: "You are already a member of this project" },
        { status: 200 }
      );
    }

    // Add user to project
    await db.userToProject.create({
      data: {
        userId,
        projectId,
      },
    });

    return NextResponse.json(
      { message: "Successfully joined the project" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error joining project:", error);
    return NextResponse.json(
      { error: "Failed to join project" },
      { status: 500 }
    );
  }
}
