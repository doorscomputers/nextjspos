import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth.simple';
import { prisma } from '@/lib/prisma.simple';
import { PERMISSIONS } from "@/lib/rbac";
import { voidExpenseAndCreateReversal } from "@/lib/expense-utils";

// POST - Void expense and create reversing journal entry
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
    const businessId = parseInt(String(user.businessId));
    const userId = user.id;

    // Check permission - typically requires admin role
    if (!user.permissions?.includes(PERMISSIONS.EXPENSE_DELETE)) {
      return NextResponse.json(
        { error: "Forbidden - Insufficient permissions to void expenses" },
        { status: 403 }
      );
    }

    const expenseId = parseInt(params.id);
    const body = await request.json();
    const { voidReason } = body;

    // Validation
    if (!voidReason || voidReason.trim().length === 0) {
      return NextResponse.json(
        { error: "Void reason is required" },
        { status: 400 }
      );
    }

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

    // Cannot void draft or already voided expenses
    if (expense.status === "draft") {
      return NextResponse.json(
        {
          error:
            "Cannot void draft expense. Please delete it instead or approve it first.",
        },
        { status: 400 }
      );
    }

    if (expense.status === "void") {
      return NextResponse.json(
        { error: "Expense is already voided" },
        { status: 400 }
      );
    }

    // Void expense and create reversing entry
    const result = await voidExpenseAndCreateReversal(
      expenseId,
      parseInt(userId),
      voidReason.trim()
    );

    if (!result.success) {
      return NextResponse.json(
        { error: `Failed to void expense: ${result.error}` },
        { status: 500 }
      );
    }

    // Fetch updated expense
    const voidedExpense = await prisma.expense.findUnique({
      where: { id: expenseId },
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

    return NextResponse.json({
      message: "Expense voided successfully",
      expense: voidedExpense,
    });
  } catch (error) {
    console.error("Error voiding expense:", error);
    return NextResponse.json(
      { error: "Failed to void expense" },
      { status: 500 }
    );
  }
}
