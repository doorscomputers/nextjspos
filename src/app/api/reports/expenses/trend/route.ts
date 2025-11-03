import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth.simple';
import { prisma } from '@/lib/prisma.simple';
import { PERMISSIONS } from "@/lib/rbac";

// GET - Expense trend report (time-series data)
export async function GET(request: NextRequest) {
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

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const categoryId = searchParams.get("categoryId");
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null;
    const groupBy = searchParams.get("groupBy") || "month"; // day, week, month, year
    const status = searchParams.get("status");

    const where: any = {
      businessId: parseInt(businessId),
      isActive: true,
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

    // Fetch all expenses
    const expenses = await prisma.expense.findMany({
      where,
      select: {
        id: true,
        expenseDate: true,
        amount: true,
        status: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        expenseDate: "asc",
      },
    });

    // Group expenses by time period
    const groupedData: any = {};

    expenses.forEach((expense) => {
      const date = new Date(expense.expenseDate);
      let key: string;

      switch (groupBy) {
        case "day":
          key = date.toISOString().split("T")[0]; // YYYY-MM-DD
          break;
        case "week":
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split("T")[0];
          break;
        case "month":
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          break;
        case "year":
          key = date.getFullYear().toString();
          break;
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }

      if (!groupedData[key]) {
        groupedData[key] = {
          period: key,
          count: 0,
          total: 0,
          expenses: [],
          byCategory: {},
        };
      }

      groupedData[key].count += 1;
      groupedData[key].total += parseFloat(expense.amount.toString());
      groupedData[key].expenses.push(expense);

      // Group by category within period
      const categoryName = expense.category.name;
      if (!groupedData[key].byCategory[categoryName]) {
        groupedData[key].byCategory[categoryName] = {
          count: 0,
          total: 0,
        };
      }
      groupedData[key].byCategory[categoryName].count += 1;
      groupedData[key].byCategory[categoryName].total += parseFloat(
        expense.amount.toString()
      );
    });

    // Convert to array and sort by period
    const trendData = Object.values(groupedData).sort((a: any, b: any) =>
      a.period.localeCompare(b.period)
    );

    // Calculate statistics
    const totalAmount = expenses.reduce(
      (sum, expense) => sum + parseFloat(expense.amount.toString()),
      0
    );

    const averagePerPeriod =
      trendData.length > 0 ? totalAmount / trendData.length : 0;

    // Find highest and lowest periods
    const sortedByTotal = [...trendData].sort(
      (a: any, b: any) => b.total - a.total
    );
    const highestPeriod = sortedByTotal[0] || null;
    const lowestPeriod = sortedByTotal[sortedByTotal.length - 1] || null;

    return NextResponse.json({
      trendData,
      summary: {
        totalExpenses: expenses.length,
        totalAmount,
        averagePerPeriod,
        periods: trendData.length,
        groupBy,
        highestPeriod: highestPeriod
          ? {
              period: highestPeriod.period,
              total: highestPeriod.total,
              count: highestPeriod.count,
            }
          : null,
        lowestPeriod: lowestPeriod
          ? {
              period: lowestPeriod.period,
              total: lowestPeriod.total,
              count: lowestPeriod.count,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error fetching expense trend report:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense trend report" },
      { status: 500 }
    );
  }
}
