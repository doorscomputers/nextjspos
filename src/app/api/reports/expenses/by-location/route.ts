import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth.simple';
import { prisma } from '@/lib/prisma.simple';
import { PERMISSIONS } from "@/lib/rbac";

// GET - Expense report grouped by location
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

    if (status) {
      where.status = status;
    }

    // Fetch expenses grouped by location
    const expensesByLocation = await prisma.expense.groupBy({
      by: ["locationId"],
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

    // Get location details
    const locationIds = expensesByLocation.map((item) => item.locationId);
    const locations = await prisma.businessLocation.findMany({
      where: {
        id: { in: locationIds },
      },
    });

    // Combine data
    const locationMap = new Map(locations.map((loc) => [loc.id, loc]));

    const report = expensesByLocation.map((item) => {
      const location = locationMap.get(item.locationId);
      return {
        locationId: item.locationId,
        locationName: location?.name || "Unknown",
        city: location?.city || null,
        state: location?.state || null,
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
        totalLocations: report.length,
        totalExpenses,
        grandTotal,
      },
    });
  } catch (error) {
    console.error("Error fetching expense by location report:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense by location report" },
      { status: 500 }
    );
  }
}
