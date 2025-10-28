import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE - Delete a specific saved question
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const businessId = session.user.businessId;
    const { id } = await params;
    const questionId = parseInt(id);

    if (isNaN(questionId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Verify the question belongs to this user before deleting
    const question = await prisma.savedQuestion.findFirst({
      where: {
        id: questionId,
        userId,
        businessId,
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Delete the question
    await prisma.savedQuestion.delete({
      where: {
        id: questionId,
      },
    });

    return NextResponse.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error("Error deleting question:", error);
    return NextResponse.json(
      { error: "Failed to delete question" },
      { status: 500 }
    );
  }
}

// PATCH - Increment usage count when a saved question is used
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const businessId = session.user.businessId;
    const { id } = await params;
    const questionId = parseInt(id);

    if (isNaN(questionId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Verify the question belongs to this user
    const question = await prisma.savedQuestion.findFirst({
      where: {
        id: questionId,
        userId,
        businessId,
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Increment usage count and update last used timestamp
    const updatedQuestion = await prisma.savedQuestion.update({
      where: {
        id: questionId,
      },
      data: {
        usageCount: {
          increment: 1,
        },
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({ savedQuestion: updatedQuestion });
  } catch (error) {
    console.error("Error updating question usage:", error);
    return NextResponse.json(
      { error: "Failed to update question" },
      { status: 500 }
    );
  }
}
