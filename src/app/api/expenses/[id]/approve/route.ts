import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth.simple';
import { prisma } from '@/lib/prisma.simple';
import { PERMISSIONS } from "@/lib/rbac";
import { Prisma } from "@prisma/client";

/**
 * POST /api/expenses/[id]/approve
 * Approve expense and create journal entry
 * FIXED: Wrapped in transaction for atomicity (all-or-nothing)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const businessId = parseInt(String(user.businessId));
    const userId = user.id;

    // Check permission - typically requires manager or admin role
    if (!user.permissions?.includes(PERMISSIONS.EXPENSE_UPDATE)) {
      return NextResponse.json(
        { error: "Forbidden - Insufficient permissions to approve expenses" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const expenseId = parseInt(id);

    // Verify expense exists and belongs to this business
    const expense = await prisma.expense.findFirst({
      where: {
        id: expenseId,
        businessId: parseInt(businessId),
      },
      include: {
        category: {
          include: {
            glAccount: true,
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

    // Determine expense GL account
    const expenseGLAccountId = expense.glAccountId || expense.category.glAccountId!;

    // Get payment method GL account (Cash/Bank)
    const paymentGLAccountId = await getPaymentMethodGLAccount(
      expense.businessId,
      expense.paymentMethod
    );

    if (!paymentGLAccountId) {
      return NextResponse.json(
        {
          error: `No GL account found for payment method: ${expense.paymentMethod}`,
        },
        { status: 400 }
      );
    }

    // ✅ ATOMIC TRANSACTION: Approve expense + Create journal entry
    // If ANY step fails, EVERYTHING rolls back automatically
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Approve the expense
      const approvedExpense = await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: "approved",
          approvedBy: parseInt(userId),
          approvedAt: new Date(),
        },
      });

      // Step 2: Generate journal entry number
      const year = new Date().getFullYear();
      const prefix = `JE-${year}-`;

      const lastEntry = await tx.journalEntry.findFirst({
        where: {
          businessId: expense.businessId,
          entryNumber: {
            startsWith: prefix,
          },
        },
        orderBy: {
          entryNumber: "desc",
        },
        select: {
          entryNumber: true,
        },
      });

      let nextNumber = 1;
      if (lastEntry) {
        const match = lastEntry.entryNumber.match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      const entryNumber = `${prefix}${nextNumber.toString().padStart(4, "0")}`;

      // Step 3: Create journal entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          businessId: expense.businessId,
          entryNumber,
          entryDate: expense.expenseDate,
          entryType: "automated",
          referenceType: "Expense",
          referenceId: expenseId.toString(),
          referenceNumber: expense.referenceNumber,
          description: `Expense: ${expense.description}`,
          notes: `Payment to: ${expense.payeeName} via ${expense.paymentMethod}`,
          status: "posted",
          postedAt: new Date(),
          postedBy: userId,
          totalDebit: expense.amount,
          totalCredit: expense.amount,
          balanced: true,
          createdBy: userId,
        },
      });

      // Step 4: Create journal entry lines
      // Debit: Expense Account
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountId: expenseGLAccountId,
          description: `Expense: ${expense.description}`,
          debit: expense.amount,
          credit: 0,
          lineNumber: 1,
        },
      });

      // Credit: Cash/Bank Account
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountId: paymentGLAccountId,
          description: `Payment via ${expense.paymentMethod} to ${expense.payeeName}`,
          debit: 0,
          credit: expense.amount,
          lineNumber: 2,
        },
      });

      // Step 5: Update account balances
      // Expense account (increase debit)
      await tx.chartOfAccounts.update({
        where: { id: expenseGLAccountId },
        data: {
          currentBalance: {
            increment: expense.amount,
          },
          ytdDebit: {
            increment: expense.amount,
          },
        },
      });

      // Payment method account (decrease credit for assets, or increase credit for liabilities)
      const paymentAccount = await tx.chartOfAccounts.findUnique({
        where: { id: paymentGLAccountId },
        select: { accountType: true, normalBalance: true },
      });

      if (paymentAccount?.normalBalance === "debit") {
        // Asset account (Cash/Bank) - decrease balance
        await tx.chartOfAccounts.update({
          where: { id: paymentGLAccountId },
          data: {
            currentBalance: {
              decrement: expense.amount,
            },
            ytdCredit: {
              increment: expense.amount,
            },
          },
        });
      } else {
        // Liability account (Credit Card) - increase balance
        await tx.chartOfAccounts.update({
          where: { id: paymentGLAccountId },
          data: {
            currentBalance: {
              increment: expense.amount,
            },
            ytdCredit: {
              increment: expense.amount,
            },
          },
        });
      }

      // Step 6: Update expense with journal entry reference and change status to posted
      await tx.expense.update({
        where: { id: expenseId },
        data: {
          journalEntryId: journalEntry.id,
          status: "posted",
        },
      });

      return { approvedExpense, journalEntry };
    }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    });

    // Fetch final expense with all relations
    const finalExpense = await prisma.expense.findUnique({
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
      },
    });

    return NextResponse.json({
      message: "Expense approved and posted to accounting successfully",
      expense: finalExpense,
      journalEntryId: result.journalEntry.id,
    });
  } catch (error) {
    console.error("Error approving expense:", error);
    return NextResponse.json(
      { error: "Failed to approve expense" },
      { status: 500 }
    );
  }
}

/**
 * Get GL account for payment method
 * Maps payment methods to their corresponding GL accounts
 */
async function getPaymentMethodGLAccount(
  businessId: number,
  paymentMethod: string
): Promise<number | null> {
  // Map payment methods to account codes
  const accountCodeMap: { [key: string]: string } = {
    cash: "1010", // Cash on Hand
    cheque: "1020", // Bank - Checking Account
    bank_transfer: "1020", // Bank - Checking Account
    credit_card: "2100", // Credit Card Payable
    other: "1010", // Default to Cash
  };

  const accountCode = accountCodeMap[paymentMethod] || "1010";

  // Find the GL account
  const glAccount = await prisma.chartOfAccounts.findFirst({
    where: {
      businessId,
      accountCode,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  return glAccount?.id || null;
}
