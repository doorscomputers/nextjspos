import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth.simple';
import { prisma } from '@/lib/prisma.simple';
import { PERMISSIONS } from "@/lib/rbac";

// GET - Get single expense category
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const businessId = user.businessId;
    const categoryId = parseInt(params.id);

    const category = await prisma.expenseCategory.findFirst({
      where: {
        id: categoryId,
        businessId: parseInt(businessId),
      },
      include: {
        glAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
          },
        },
        _count: {
          select: {
            expenses: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Expense category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error fetching expense category:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense category" },
      { status: 500 }
    );
  }
}

// PUT - Update expense category
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const businessId = user.businessId;

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.EXPENSE_UPDATE)) {
      return NextResponse.json(
        { error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    const categoryId = parseInt(params.id);
    const body = await request.json();
    const { name, description, glAccountId, isActive } = body;

    // Verify category exists and belongs to this business
    const existingCategory = await prisma.expenseCategory.findFirst({
      where: {
        id: categoryId,
        businessId: parseInt(businessId),
      },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Expense category not found" },
        { status: 404 }
      );
    }

    // Validation
    if (name !== undefined && (!name || name.trim().length === 0)) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    // Check if name already exists for another category (case-insensitive)
    if (name && name.trim() !== existingCategory.name) {
      const duplicateCategory = await prisma.expenseCategory.findFirst({
        where: {
          businessId: parseInt(businessId),
          name: {
            equals: name.trim(),
            mode: "insensitive",
          },
          id: {
            not: categoryId,
          },
        },
      });

      if (duplicateCategory) {
        return NextResponse.json(
          {
            error: `Expense category "${name}" already exists. Please use a different name.`,
          },
          { status: 409 }
        );
      }
    }

    // If glAccountId provided, verify it exists and belongs to this business
    if (glAccountId) {
      const glAccount = await prisma.chartOfAccounts.findFirst({
        where: {
          id: parseInt(glAccountId),
          businessId: parseInt(businessId),
          accountType: "expense",
          isActive: true,
        },
      });

      if (!glAccount) {
        return NextResponse.json(
          { error: "Invalid GL account or account is not an expense account" },
          { status: 400 }
        );
      }
    }

    // Update category
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined)
      updateData.description = description?.trim() || null;
    if (glAccountId !== undefined)
      updateData.glAccountId = glAccountId ? parseInt(glAccountId) : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const category = await prisma.expenseCategory.update({
      where: { id: categoryId },
      data: updateData,
      include: {
        glAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
          },
        },
        _count: {
          select: {
            expenses: true,
          },
        },
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error updating expense category:", error);
    return NextResponse.json(
      { error: "Failed to update expense category" },
      { status: 500 }
    );
  }
}

// DELETE - Delete (soft delete) expense category
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const businessId = user.businessId;

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.EXPENSE_DELETE)) {
      return NextResponse.json(
        { error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    const categoryId = parseInt(params.id);

    // Verify category exists and belongs to this business
    const category = await prisma.expenseCategory.findFirst({
      where: {
        id: categoryId,
        businessId: parseInt(businessId),
      },
      include: {
        _count: {
          select: {
            expenses: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Expense category not found" },
        { status: 404 }
      );
    }

    // Check if category has expenses
    if (category._count.expenses > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category "${category.name}" because it has ${category._count.expenses} expense(s) associated with it. Please mark it as inactive instead.`,
        },
        { status: 400 }
      );
    }

    // Soft delete - just mark as inactive
    await prisma.expenseCategory.update({
      where: { id: categoryId },
      data: { isActive: false },
    });

    return NextResponse.json({
      message: "Expense category marked as inactive successfully",
    });
  } catch (error) {
    console.error("Error deleting expense category:", error);
    return NextResponse.json(
      { error: "Failed to delete expense category" },
      { status: 500 }
    );
  }
}
