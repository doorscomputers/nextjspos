import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/rbac";

// GET - Main expense report with filtering and grouping
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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const categoryId = searchParams.get("categoryId");
    const locationId = searchParams.get("locationId");
    const status = searchParams.get("status");
    const paymentMethod = searchParams.get("paymentMethod");
    const groupBy = searchParams.get("groupBy"); // category, location, paymentMethod, month

    const where: any = {
      businessId: parseInt(businessId),
      isActive: { select: { id: true, name: true } },
    };

    // Filter by date range
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

    // Fetch expenses
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
      },
      orderBy: {
        expenseDate: "desc",
      },
    });

    // Calculate totals
    const totalAmount = expenses.reduce(
      (sum, expense) => sum + parseFloat(expense.amount.toString()),
      0
    );

    const totalByStatus = expenses.reduce((acc: any, expense) => {
      const status = expense.status;
      if (!acc[status]) {
        acc[status] = 0;
      }
      acc[status] += parseFloat(expense.amount.toString());
      return acc;
    }, {});

    // Group expenses if requested
    let groupedData: any = null;
    if (groupBy) {
      groupedData = {};

      expenses.forEach((expense) => {
        let key: string;

        switch (groupBy) {
          case "category":
            key = expense.category.name;
            break;
          case "location":
            key = expense.location.name;
            break;
          case "paymentMethod":
            key = expense.paymentMethod;
            break;
          case "month":
            const date = new Date(expense.expenseDate);
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            break;
          default:
            key = "Other";
        }

        if (!groupedData[key]) {
          groupedData[key] = {
            count: 0,
            total: 0,
            expenses: [],
          };
        }

        groupedData[key].count += 1;
        groupedData[key].total += parseFloat(expense.amount.toString());
        groupedData[key].expenses.push(expense);
      });
    }

    return NextResponse.json({
      expenses,
      summary: {
        totalExpenses: expenses.length,
        totalAmount,
        totalByStatus,
      },
      groupedData,
    });
  } catch (error) {
    console.error("Error fetching expense report:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense report" },
      { status: 500 }
    );
  }
}
