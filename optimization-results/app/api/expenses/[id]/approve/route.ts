import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/rbac";
import { createExpenseJournalEntry } from "@/lib/expense-utils";

// POST - Approve expense and create journal entry
export async function POST(
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
    const userId = user.id;

    // Check permission - typically requires manager or admin role
    if (!user.permissions?.includes(PERMISSIONS.EXPENSE_UPDATE)) {
      return NextResponse.json(
        { error: "Forbidden - Insufficient permissions to approve expenses" },
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
      select: {
        category: {
          select: {
            glAccount: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Can only approve draft expenses
    if (expense.status !== "draft") {
      return NextResponse.json(
        {
          error: `Cannot approve expense with status "${expense.status}". Only draft expenses can be approved.`,
        },
        { status: 400 }
      );
    }

    // Check if GL account is configured
    const hasGLAccount = expense.glAccountId || expense.category.glAccountId;
    if (!hasGLAccount) {
      return NextResponse.json(
        {
          error:
            "Cannot approve expense without GL account. Please configure a GL account for this expense or its category.",
        },
        { status: 400 }
      );
    }

    // Approve the expense first
    const approvedExpense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: "approved",
        approvedBy: parseInt(userId),
        approvedAt: new Date(),
      },
      select: {
        category: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            name: { select: { id: true, name: true } },
          },
        },
        location: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } },
          },
        },
        glAccount: {
          select: {
            id: { select: { id: true, name: true } },
            accountCode: { select: { id: true, name: true } },
            accountName: { select: { id: true, name: true } },
          },
        },
        createdByUser: {
          select: {
            id: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } },
            username: { select: { id: true, name: true } },
          },
        },
        approvedByUser: {
          select: {
            id: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } },
            username: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Create journal entry to post to accounting
    const journalResult = await createExpenseJournalEntry(expenseId, parseInt(userId));

    if (!journalResult.success) {
      // Rollback approval if journal entry creation fails
      await prisma.expense.update({
        where: { id: expenseId },
        data: {
          status: "draft",
          approvedBy: null,
          approvedAt: null,
        },
      });

      return NextResponse.json(
        {
          error: `Failed to create journal entry: ${journalResult.error}`,
        },
        { status: 500 }
      );
    }

    // Fetch updated expense with journal entry
    const finalExpense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: {
        category: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            name: { select: { id: true, name: true } },
          },
        },
        location: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } },
          },
        },
        glAccount: {
          select: {
            id: { select: { id: true, name: true } },
            accountCode: { select: { id: true, name: true } },
            accountName: { select: { id: true, name: true } },
          },
        },
        journalEntry: {
          select: {
            id: { select: { id: true, name: true } },
            entryNumber: { select: { id: true, name: true } },
            entryDate: { select: { id: true, name: true } },
            status: { select: { id: true, name: true } },
          },
        },
        createdByUser: {
          select: {
            id: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } },
            username: { select: { id: true, name: true } },
          },
        },
        approvedByUser: {
          select: {
            id: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } },
            username: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json({
      message: "Expense approved and posted to accounting successfully",
      expense: finalExpense,
      journalEntryId: journalResult.journalEntryId,
    });
  } catch (error) {
    console.error("Error approving expense:", error);
    return NextResponse.json(
      { error: "Failed to approve expense" },
      { status: 500 }
    );
  }
}
