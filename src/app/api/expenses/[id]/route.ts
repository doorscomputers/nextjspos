import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth.simple';
import { prisma } from '@/lib/prisma.simple';
import { PERMISSIONS } from "@/lib/rbac";

// GET - Get single expense
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
    const businessId = parseInt(String(user.businessId));

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.EXPENSE_VIEW)) {
      return NextResponse.json(
        { error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    const expenseId = parseInt(params.id);

    const expense = await prisma.expense.findFirst({
      where: {
        id: expenseId,
        businessId: parseInt(businessId),
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            glAccountId: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        glAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
          },
        },
        journalEntry: {
          select: {
            id: true,
            entryNumber: true,
            entryDate: true,
            status: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        approvedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        voidedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json(expense);
  } catch (error) {
    console.error("Error fetching expense:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense" },
      { status: 500 }
    );
  }
}

// PUT - Update expense
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
    const businessId = parseInt(String(user.businessId));

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.EXPENSE_UPDATE)) {
      return NextResponse.json(
        { error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    const expenseId = parseInt(params.id);
    const body = await request.json();

    // Verify expense exists and belongs to this business
    const existingExpense = await prisma.expense.findFirst({
      where: {
        id: expenseId,
        businessId: parseInt(businessId),
      },
    });

    if (!existingExpense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Cannot edit approved, posted, or voided expenses
    if (
      existingExpense.status !== "draft" &&
      existingExpense.status !== "approved"
    ) {
      return NextResponse.json(
        {
          error: `Cannot edit expense with status "${existingExpense.status}"`,
        },
        { status: 400 }
      );
    }

    const {
      categoryId,
      locationId,
      expenseDate,
      amount,
      paymentMethod,
      payeeName,
      description,
      glAccountId,
      attachmentUrl,
    } = body;

    // Validation
    if (amount !== undefined && parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (payeeName !== undefined && payeeName.trim().length === 0) {
      return NextResponse.json(
        { error: "Payee name cannot be empty" },
        { status: 400 }
      );
    }

    if (description !== undefined && description.trim().length === 0) {
      return NextResponse.json(
        { error: "Description cannot be empty" },
        { status: 400 }
      );
    }

    // Verify category if provided
    if (categoryId !== undefined) {
      const category = await prisma.expenseCategory.findFirst({
        where: {
          id: parseInt(categoryId),
          businessId: parseInt(businessId),
          isActive: true,
        },
      });

      if (!category) {
        return NextResponse.json(
          { error: "Invalid expense category" },
          { status: 400 }
        );
      }
    }

    // Verify location if provided
    if (locationId !== undefined) {
      const location = await prisma.businessLocation.findFirst({
        where: {
          id: parseInt(locationId),
          businessId: parseInt(businessId),
          isActive: true,
        },
      });

      if (!location) {
        return NextResponse.json(
          { error: "Invalid business location" },
          { status: 400 }
        );
      }
    }

    // Verify GL account if provided
    if (glAccountId !== undefined && glAccountId !== null) {
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

    // Update expense
    const updateData: any = {};
    if (categoryId !== undefined)
      updateData.categoryId = parseInt(categoryId);
    if (locationId !== undefined)
      updateData.locationId = parseInt(locationId);
    if (expenseDate !== undefined)
      updateData.expenseDate = new Date(expenseDate);
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (payeeName !== undefined) updateData.payeeName = payeeName.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (glAccountId !== undefined)
      updateData.glAccountId = glAccountId ? parseInt(glAccountId) : null;
    if (attachmentUrl !== undefined)
      updateData.attachmentUrl = attachmentUrl?.trim() || null;

    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: updateData,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        glAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        approvedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json(expense);
  } catch (error) {
    console.error("Error updating expense:", error);
    return NextResponse.json(
      { error: "Failed to update expense" },
      { status: 500 }
    );
  }
}

// DELETE - Delete (soft delete) expense
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
    const businessId = parseInt(String(user.businessId));

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.EXPENSE_DELETE)) {
      return NextResponse.json(
        { error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    const expenseId = parseInt(params.id);

    // Verify expense exists and belongs to this business
    const expense = await prisma.expense.findFirst({
      where: {
        id: expenseId,
        businessId: parseInt(businessId),
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Can only delete draft expenses
    if (expense.status !== "draft") {
      return NextResponse.json(
        {
          error: `Cannot delete expense with status "${expense.status}". Only draft expenses can be deleted.`,
        },
        { status: 400 }
      );
    }

    // Soft delete - mark as inactive
    await prisma.expense.update({
      where: { id: expenseId },
      data: { isActive: false },
    });

    return NextResponse.json({
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting expense:", error);
    return NextResponse.json(
      { error: "Failed to delete expense" },
      { status: 500 }
    );
  }
}
