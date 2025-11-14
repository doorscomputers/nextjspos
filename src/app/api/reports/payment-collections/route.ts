import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/rbac";
import { Prisma } from "@prisma/client";

/**
 * Payment Collection Report API
 * Shows AR payment collections with cross-location tracking
 * Critical for understanding which location collected payments for invoices created at other locations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    // Permission check
    if (!user.permissions?.includes(PERMISSIONS.REPORT_CUSTOMER_PAYMENTS)) {
      return NextResponse.json(
        { error: "Insufficient permissions to view payment collection reports" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const paymentMethod = searchParams.get("paymentMethod");
    const collectionLocationId = searchParams.get("collectionLocationId");
    const saleLocationId = searchParams.get("saleLocationId");
    const cashierId = searchParams.get("cashierId");

    // Convert businessId to integer
    const businessId = parseInt(String(user.businessId));

    // Default to current month if no dates provided
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    let startDate = startDateParam ? new Date(startDateParam) : firstDayOfMonth;
    let endDate = endDateParam ? new Date(endDateParam) : lastDayOfMonth;
    if (endDateParam) {
      endDate.setHours(23, 59, 59, 999);
    }

    // Build where clause for sale payments
    // IMPORTANT: Only show AR payments (payments on credit sales)
    // Credit sales have an initial payment with paymentMethod='credit' as a marker
    // Then actual AR payments are recorded with real payment methods (cash, card, etc.)
    const where: Prisma.SalePaymentWhereInput = {
      sale: {
        businessId: businessId,
        // CRITICAL: Only include payments on credit sales
        // A credit sale MUST have at least one payment with paymentMethod='credit'
        payments: {
          some: {
            paymentMethod: "credit",
          },
        },
      },
      // Exclude the initial "credit" marker payment (we only want actual AR collections)
      paymentMethod: { not: 'credit' },
      // Always filter by date range (defaults to current month)
      paidAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Payment method filter
    if (paymentMethod && paymentMethod !== "all") {
      where.paymentMethod = paymentMethod;
    }

    // Collection location filter (where payment was collected)
    if (collectionLocationId && collectionLocationId !== "all") {
      where.cashierShift = {
        locationId: parseInt(collectionLocationId),
      };
    }

    // Sale location filter (where original sale was made)
    if (saleLocationId && saleLocationId !== "all") {
      where.sale = {
        ...where.sale,
        locationId: parseInt(saleLocationId),
      };
    }

    // Cashier filter (who collected the payment)
    if (cashierId && cashierId !== "all") {
      where.collectedBy = parseInt(cashierId);
    }

    // Fetch payment collections with all related data
    const collections = await prisma.salePayment.findMany({
      where,
      include: {
        sale: {
          include: {
            customer: {
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
          },
        },
        cashierShift: {
          select: {
            id: true,
            shiftNumber: true,
            locationId: true,
          },
        },
        collectedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        paidAt: "desc",
      },
    });

    // Transform data and identify cross-location collections
    const collectionsList = collections.map((payment) => {
      const saleLocationId = payment.sale.locationId;
      const collectionLocationId = payment.cashierShift?.locationId || null;
      const isCrossLocation = saleLocationId !== collectionLocationId && collectionLocationId !== null;

      const customerName = payment.sale.customer
        ? payment.sale.customer.name || "Walk-in Customer"
        : "Walk-in Customer";

      const collectorName = payment.collectedByUser
        ? `${payment.collectedByUser.firstName} ${payment.collectedByUser.lastName}`
        : "Unknown";

      // For collection location: if collected at POS (has shiftId), use sale location
      // Otherwise it was collected online/manually
      const collectionLocation = payment.cashierShift
        ? payment.sale.location.name  // Use sale location when collected at POS
        : "Online/Manual";

      return {
        id: payment.id,
        invoiceNumber: payment.sale.invoiceNumber,
        saleDate: payment.sale.saleDate,
        paymentDate: payment.paidAt,
        customerName,
        customerId: payment.sale.customerId,
        saleLocation: payment.sale.location.name,
        saleLocationId,
        collectionLocation,
        collectionLocationId,
        isCrossLocation,
        paymentMethod: payment.paymentMethod,
        amount: parseFloat(payment.amount.toString()),
        referenceNumber: payment.referenceNumber,
        shiftNumber: payment.cashierShift?.shiftNumber || null,
        collectedBy: collectorName,
        collectedById: payment.collectedBy,
      };
    });

    // Calculate summary statistics
    const totalAmount = collectionsList.reduce((sum, c) => sum + c.amount, 0);
    const crossLocationCollections = collectionsList.filter((c) => c.isCrossLocation);
    const crossLocationAmount = crossLocationCollections.reduce((sum, c) => sum + c.amount, 0);

    // Group by collection location
    const byCollectionLocation = collectionsList.reduce((acc, c) => {
      const location = c.collectionLocation;
      if (!acc[location]) {
        acc[location] = { count: 0, amount: 0 };
      }
      acc[location].count += 1;
      acc[location].amount += c.amount;
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    // Group by payment method
    const byPaymentMethod = collectionsList.reduce((acc, c) => {
      const method = c.paymentMethod;
      if (!acc[method]) {
        acc[method] = { count: 0, amount: 0 };
      }
      acc[method].count += 1;
      acc[method].amount += c.amount;
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    return NextResponse.json({
      success: true,
      data: {
        collections: collectionsList,
        summary: {
          totalCollections: collectionsList.length,
          totalAmount,
          crossLocationCollections: crossLocationCollections.length,
          crossLocationAmount,
          crossLocationPercentage:
            collectionsList.length > 0
              ? ((crossLocationCollections.length / collectionsList.length) * 100).toFixed(2)
              : "0.00",
          byCollectionLocation,
          byPaymentMethod,
        },
      },
    });
  } catch (error) {
    console.error("Payment Collection Report Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment collection report" },
      { status: 500 }
    );
  }
}
