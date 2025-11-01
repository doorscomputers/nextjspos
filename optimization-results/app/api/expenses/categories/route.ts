import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/rbac";

// GET - List all expense categories
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const businessId = user.businessId;

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const activeOnly = searchParams.get("activeOnly") === "true";

    const where: any = {
      businessId: parseInt(businessId),
    };

    if (activeOnly) {
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const categories = await prisma.expenseCategory.findMany({
      where,
      select: {
        glAccount: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            accountCode: { select: { id: true, name: true } },
            accountName: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: {
            expenses: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching expense categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense categories" },
      { status: 500 }
    );
  }
}

// POST - Create new expense category
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const businessId = user.businessId;

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.EXPENSE_CREATE)) {
      return NextResponse.json(
        { error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, glAccountId, isActive = true } = body;

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    // Check if category name already exists for this business (case-insensitive)
    const existingCategory = await prisma.expenseCategory.findFirst({
      where: {
        businessId: parseInt(businessId),
        name: {
          equals: name.trim(),
          mode: "insensitive",
        },
      },
    });

    if (existingCategory) {
      return NextResponse.json(
        {
          error: `Expense category "${name}" already exists. Please use a different name.`,
        },
        { status: 409 }
      );
    }

    // If glAccountId provided, verify it exists and belongs to this business
    if (glAccountId) {
      const glAccount = await prisma.chartOfAccounts.findFirst({
        where: {
          id: parseInt(glAccountId),
          businessId: parseInt(businessId),
          accountType: "expense",
          isActive: { select: { id: true, name: true } },
        },
      });

      if (!glAccount) {
        return NextResponse.json(
          { error: "Invalid GL account or account is not an expense account" },
          { status: 400 }
        );
      }
    }

    // Create category
    const category = await prisma.expenseCategory.create({
      data: {
        businessId: parseInt(businessId),
        name: name.trim(),
        description: description?.trim() || null,
        glAccountId: glAccountId ? parseInt(glAccountId) : null,
        isActive,
      },
      select: {
        glAccount: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            accountCode: { select: { id: true, name: true } },
            accountName: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating expense category:", error);
    return NextResponse.json(
      { error: "Failed to create expense category" },
      { status: 500 }
    );
  }
}
