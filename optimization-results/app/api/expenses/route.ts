import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/rbac";
import { generateExpenseReferenceNumber } from "@/lib/expense-utils";

// GET - List all expenses with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const businessId = user.businessId;

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.EXPENSE_VIEW)) {
      return NextResponse.json(
        { error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const categoryId = searchParams.get("categoryId");
    const locationId = searchParams.get("locationId");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const paymentMethod = searchParams.get("paymentMethod");

    const where: any = {
      businessId: parseInt(businessId),
      isActive: { select: { id: true, name: true } },
    };

    if (search) {
      where.OR = [
        { referenceNumber: { contains: search, mode: "insensitive" } },
        { payeeName: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (categoryId) {
      where.categoryId = parseInt(categoryId);
    }

    if (locationId) {
      where.locationId = parseInt(locationId);
    }

    if (status) {
      where.status = status;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (startDate) {
      where.expenseDate = {
        ...where.expenseDate,
        gte: new Date(startDate),
      };
    }

    if (endDate) {
      where.expenseDate = {
        ...where.expenseDate,
        lte: new Date(endDate),
      };
    }

    const expenses = await prisma.expense.findMany({
      where,
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
      orderBy: {
        expenseDate: "desc",
      },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}

// POST - Create new expense
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const businessId = user.businessId;
    const userId = user.id;

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.EXPENSE_CREATE)) {
      return NextResponse.json(
        { error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
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
    if (!categoryId) {
      return NextResponse.json(
        { error: "Category is required" },
        { status: 400 }
      );
    }

    if (!locationId) {
      return NextResponse.json(
        { error: "Location is required" },
        { status: 400 }
      );
    }

    if (!expenseDate) {
      return NextResponse.json(
        { error: "Expense date is required" },
        { status: 400 }
      );
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Payment method is required" },
        { status: 400 }
      );
    }

    if (!payeeName || payeeName.trim().length === 0) {
      return NextResponse.json(
        { error: "Payee name is required" },
        { status: 400 }
      );
    }

    if (!description || description.trim().length === 0) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    // Verify category exists and belongs to this business
    const category = await prisma.expenseCategory.findFirst({
      where: {
        id: parseInt(categoryId),
        businessId: parseInt(businessId),
        isActive: { select: { id: true, name: true } },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Invalid expense category" },
        { status: 400 }
      );
    }

    // Verify location exists and belongs to this business
    const location = await prisma.businessLocation.findFirst({
      where: {
        id: parseInt(locationId),
        businessId: parseInt(businessId),
        isActive: { select: { id: true, name: true } },
      },
    });

    if (!location) {
      return NextResponse.json(
        { error: "Invalid business location" },
        { status: 400 }
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

    // Generate reference number
    const referenceNumber = await generateExpenseReferenceNumber(
      parseInt(businessId)
    );

    // Create expense
    const expense = await prisma.expense.create({
      data: {
        businessId: parseInt(businessId),
        categoryId: parseInt(categoryId),
        locationId: parseInt(locationId),
        referenceNumber,
        expenseDate: new Date(expenseDate),
        amount: parseFloat(amount),
        paymentMethod,
        payeeName: payeeName.trim(),
        description: description.trim(),
        glAccountId: glAccountId ? parseInt(glAccountId) : null,
        attachmentUrl: attachmentUrl?.trim() || null,
        status: "draft",
        createdBy: parseInt(userId),
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
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("Error creating expense:", error);
    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 500 }
    );
  }
}
