import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth.simple';
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/rbac";

// GET - Expense report grouped by category
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
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null;
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

    if (locationId) {
      where.locationId = parseInt(locationId);
    }

    if (status) {
      where.status = status;
    }

    // Fetch expenses grouped by category
    const expensesByCategory = await prisma.expense.groupBy({
      by: ["categoryId"],
      where,
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
      _avg: {
        amount: true,
      },
    });

    // Get category details
    const categoryIds = expensesByCategory.map((item) => item.categoryId);
    const categories = await prisma.expenseCategory.findMany({
      where: {
        id: { in: categoryIds },
      },
      include: {
        glAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
          },
        },
      },
    });

    // Combine data
    const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));

    const report = expensesByCategory.map((item) => {
      const category = categoryMap.get(item.categoryId);
      return {
        categoryId: item.categoryId,
        categoryName: category?.name || "Unknown",
        glAccount: category?.glAccount || null,
        totalExpenses: item._count.id,
        totalAmount: item._sum.amount || 0,
        averageAmount: item._avg.amount || 0,
      };
    });

    // Sort by total amount descending
    report.sort((a, b) => parseFloat(b.totalAmount.toString()) - parseFloat(a.totalAmount.toString()));

    // Calculate grand total
    const grandTotal = report.reduce(
      (sum, item) => sum + parseFloat(item.totalAmount.toString()),
      0
    );

    const totalExpenses = report.reduce((sum, item) => sum + item.totalExpenses, 0);

    return NextResponse.json({
      report,
      summary: {
        totalCategories: report.length,
        totalExpenses,
        grandTotal,
      },
    });
  } catch (error) {
    console.error("Error fetching expense by category report:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense by category report" },
      { status: 500 }
    );
  }
}
