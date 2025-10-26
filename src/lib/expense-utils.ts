/**
 * Expense Management Utilities
 *
 * Helper functions for expense operations including:
 * - Reference number generation
 * - Accounting integration (journal entries)
 * - Status transitions
 */

import prisma from "@/lib/prisma";

/**
 * Generate unique expense reference number
 * Pattern: EXP-YYYY-0001
 */
export async function generateExpenseReferenceNumber(
  businessId: number
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EXP-${year}-`;

  // Get the last expense reference for this business and year
  const lastExpense = await prisma.expense.findFirst({
    where: {
      businessId,
      referenceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      referenceNumber: "desc",
    },
    select: {
      referenceNumber: true,
    },
  });

  let nextNumber = 1;
  if (lastExpense) {
    // Extract number from reference (e.g., "EXP-2025-0123" -> 123)
    const match = lastExpense.referenceNumber.match(/(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  // Pad with zeros to 4 digits
  const paddedNumber = nextNumber.toString().padStart(4, "0");
  return `${prefix}${paddedNumber}`;
}

/**
 * Get GL account for payment method
 * Maps payment methods to their corresponding GL accounts
 */
export async function getPaymentMethodGLAccount(
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

/**
 * Create journal entry for expense
 * Debit: Expense Account
 * Credit: Cash/Bank Account (based on payment method)
 */
export async function createExpenseJournalEntry(
  expenseId: number,
  userId: number
): Promise<{ success: boolean; journalEntryId?: number; error?: string }> {
  try {
    // Get expense details with relations
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        category: {
          include: {
            glAccount: true,
          },
        },
        glAccount: true,
      },
    });

    if (!expense) {
      return { success: false, error: "Expense not found" };
    }

    // Determine expense GL account (use expense.glAccount or category.glAccount)
    const expenseGLAccountId =
      expense.glAccountId || expense.category.glAccountId;

    if (!expenseGLAccountId) {
      return {
        success: false,
        error: "No GL account configured for this expense or category",
      };
    }

    // Get payment method GL account (Cash/Bank)
    const paymentGLAccountId = await getPaymentMethodGLAccount(
      expense.businessId,
      expense.paymentMethod
    );

    if (!paymentGLAccountId) {
      return {
        success: false,
        error: `No GL account found for payment method: ${expense.paymentMethod}`,
      };
    }

    // Generate journal entry number
    const year = new Date().getFullYear();
    const prefix = `JE-${year}-`;

    const lastEntry = await prisma.journalEntry.findFirst({
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

    // Create journal entry with lines in a transaction
    const journalEntry = await prisma.$transaction(async (tx) => {
      // Create journal entry
      const je = await tx.journalEntry.create({
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

      // Create debit line (Expense Account)
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: je.id,
          accountId: expenseGLAccountId,
          description: `Expense: ${expense.description}`,
          debit: expense.amount,
          credit: 0,
          lineNumber: 1,
        },
      });

      // Create credit line (Cash/Bank Account)
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: je.id,
          accountId: paymentGLAccountId,
          description: `Payment via ${expense.paymentMethod} to ${expense.payeeName}`,
          debit: 0,
          credit: expense.amount,
          lineNumber: 2,
        },
      });

      // Update account balances
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

      // Update expense with journal entry reference
      await tx.expense.update({
        where: { id: expenseId },
        data: {
          journalEntryId: je.id,
          status: "posted",
        },
      });

      return je;
    });

    return { success: true, journalEntryId: journalEntry.id };
  } catch (error) {
    console.error("Error creating expense journal entry:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Void an expense and create reversing journal entry
 */
export async function voidExpenseAndCreateReversal(
  expenseId: number,
  userId: number,
  voidReason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        journalEntry: {
          include: {
            lines: true,
          },
        },
      },
    });

    if (!expense) {
      return { success: false, error: "Expense not found" };
    }

    if (expense.status === "void") {
      return { success: false, error: "Expense is already voided" };
    }

    if (!expense.journalEntry) {
      // Just void the expense if no journal entry exists
      await prisma.expense.update({
        where: { id: expenseId },
        data: {
          status: "void",
          voidedBy: userId,
          voidedAt: new Date(),
          voidReason,
        },
      });
      return { success: true };
    }

    // Create reversing journal entry
    await prisma.$transaction(async (tx) => {
      // Generate reversal entry number
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

      // Create reversing journal entry
      const reversalEntry = await tx.journalEntry.create({
        data: {
          businessId: expense.businessId,
          entryNumber,
          entryDate: new Date(),
          entryType: "reversing",
          referenceType: "Expense",
          referenceId: expenseId.toString(),
          referenceNumber: expense.referenceNumber,
          description: `VOID: ${expense.description}`,
          notes: `Reversal of ${expense.journalEntry.entryNumber}. Reason: ${voidReason}`,
          status: "posted",
          postedAt: new Date(),
          postedBy: userId,
          totalDebit: expense.amount,
          totalCredit: expense.amount,
          balanced: true,
          createdBy: userId,
          reversalOfId: expense.journalEntryId,
        },
      });

      // Create reversed lines (swap debits and credits)
      for (const line of expense.journalEntry.lines) {
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: reversalEntry.id,
            accountId: line.accountId,
            description: `REVERSAL: ${line.description}`,
            debit: line.credit, // Swap
            credit: line.debit, // Swap
            lineNumber: line.lineNumber,
          },
        });

        // Update account balances (reverse the original entry)
        if (line.debit > 0) {
          await tx.chartOfAccounts.update({
            where: { id: line.accountId },
            data: {
              currentBalance: {
                decrement: line.debit,
              },
              ytdCredit: {
                increment: line.debit,
              },
            },
          });
        }

        if (line.credit > 0) {
          const account = await tx.chartOfAccounts.findUnique({
            where: { id: line.accountId },
            select: { normalBalance: true },
          });

          if (account?.normalBalance === "debit") {
            await tx.chartOfAccounts.update({
              where: { id: line.accountId },
              data: {
                currentBalance: {
                  increment: line.credit,
                },
                ytdDebit: {
                  increment: line.credit,
                },
              },
            });
          } else {
            await tx.chartOfAccounts.update({
              where: { id: line.accountId },
              data: {
                currentBalance: {
                  decrement: line.credit,
                },
                ytdDebit: {
                  increment: line.credit,
                },
              },
            });
          }
        }
      }

      // Update original journal entry status
      await tx.journalEntry.update({
        where: { id: expense.journalEntryId },
        data: {
          status: "reversed",
          reversedAt: new Date(),
          reversedBy: userId,
        },
      });

      // Update expense
      await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: "void",
          voidedBy: userId,
          voidedAt: new Date(),
          voidReason,
        },
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Error voiding expense:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
