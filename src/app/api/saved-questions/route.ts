import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Fetch all saved questions for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const businessId = session.user.businessId;

    // Fetch saved questions for this user, ordered by usage count and last used
    const savedQuestions = await prisma.savedQuestion.findMany({
      where: {
        userId,
        businessId,
      },
      orderBy: [
        { usageCount: "desc" },
        { lastUsedAt: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ savedQuestions });
  } catch (error) {
    console.error("Error fetching saved questions:", error);
    return NextResponse.json(
      { error: "Failed to fetch saved questions" },
      { status: 500 }
    );
  }
}

// POST - Save a new question
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const businessId = session.user.businessId;

    const body = await req.json();
    const { question, category } = body;

    if (!question || typeof question !== "string" || question.trim() === "") {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    // Check if this question already exists for this user
    const existingQuestion = await prisma.savedQuestion.findFirst({
      where: {
        userId,
        businessId,
        question: question.trim(),
      },
    });

    if (existingQuestion) {
      return NextResponse.json(
        { error: "This question is already saved" },
        { status: 400 }
      );
    }

    // Create the saved question
    const savedQuestion = await prisma.savedQuestion.create({
      data: {
        userId,
        businessId,
        question: question.trim(),
        category: category || null,
      },
    });

    return NextResponse.json({ savedQuestion }, { status: 201 });
  } catch (error) {
    console.error("Error saving question:", error);
    return NextResponse.json(
      { error: "Failed to save question" },
      { status: 500 }
    );
  }
}

// DELETE - Delete all saved questions (optional bulk delete)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const businessId = session.user.businessId;

    // Delete all saved questions for this user
    await prisma.savedQuestion.deleteMany({
      where: {
        userId,
        businessId,
      },
    });

    return NextResponse.json({ message: "All saved questions deleted" });
  } catch (error) {
    console.error("Error deleting saved questions:", error);
    return NextResponse.json(
      { error: "Failed to delete saved questions" },
      { status: 500 }
    );
  }
}
