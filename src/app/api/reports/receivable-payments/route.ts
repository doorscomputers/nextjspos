import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/rbac";
import { Prisma } from "@prisma/client";

/**
 * Receivable Payments Report API
 * Shows all AR payment collections with detailed payment information
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
        { error: "Insufficient permissions to view receivable payments reports" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const customerId = searchParams.get("customerId");
    const paymentMethod = searchParams.get("paymentMethod");
    const locationId = searchParams.get("locationId");
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
    // IMPORTANT: Only show AR payments (payments on credit sales by actual customers)
    // Credit sales have an initial payment with paymentMethod='credit' as a marker
    // Then actual AR payments are recorded with real payment methods (cash, card, etc.)
    const where: Prisma.SalePaymentWhereInput = {
      sale: {
        businessId: businessId,
        // CRITICAL: Only include payments on credit sales WITH a customer (not walk-in)
        customerId: {
          not: null, // Must have a customer assigned
        },
        // Exclude walk-in customers (they don't have credit accounts)
        customer: {
          name: {
            not: {
              contains: "Walk-in",
              mode: "insensitive"
            }
          }
        },
        // A credit sale MUST have at least one payment with paymentMethod='credit'
        payments: {
          some: {
            paymentMethod: "credit",
          },
        },
      },
      // Exclude the initial "credit" marker payment (we only want actual AR collections)
      paymentMethod: {
        not: "credit",
      },
      // Always filter by date range (defaults to current month)
      paidAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Customer filter
    if (customerId && customerId !== "all") {
      where.sale = {
        ...where.sale,
        customerId: parseInt(customerId),
      };
    }

    // Payment method filter
    if (paymentMethod && paymentMethod !== "all") {
      where.paymentMethod = paymentMethod;
    }

    // Location filter (where sale was made)
    if (locationId && locationId !== "all") {
      where.sale = {
        ...where.sale,
        locationId: parseInt(locationId),
      };
    }

    // Cashier filter (who collected the payment)
    if (cashierId && cashierId !== "all") {
      where.collectedBy = parseInt(cashierId);
    }

    // Fetch receivable payments
    const payments = await prisma.salePayment.findMany({
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

    // Transform payment data
    const paymentList = payments.map((payment) => {
      const customerName = payment.sale.customer
        ? payment.sale.customer.name || "Walk-in Customer"
        : "Walk-in Customer";

      const collectorName = payment.collectedByUser
        ? `${payment.collectedByUser.firstName} ${payment.collectedByUser.lastName}`
        : "System";

      // For collection location: if collected at POS (has shiftId), use sale location
      // Otherwise it was collected online/manually
      const collectionLocation = payment.cashierShift
        ? payment.sale.location.name  // Use sale location when collected at POS
        : "Online/Manual";

      return {
        id: payment.id,
        paymentDate: payment.paidAt,
        invoiceNumber: payment.sale.invoiceNumber,
        invoiceDate: payment.sale.saleDate,
        customerId: payment.sale.customerId,
        customerName,
        saleLocation: payment.sale.location.name,
        saleLocationId: payment.sale.locationId,
        collectionLocation,
        collectionLocationId: payment.cashierShift?.locationId || null,
        paymentMethod: payment.paymentMethod,
        amount: parseFloat(payment.amount.toString()),
        referenceNumber: payment.referenceNumber,
        shiftNumber: payment.cashierShift?.shiftNumber || null,
        collectedBy: collectorName,
        collectedById: payment.collectedBy,
      };
    });

    // Calculate summary statistics
    const summary = {
      totalPayments: paymentList.length,
      totalAmount: paymentList.reduce((sum, p) => sum + p.amount, 0),
      byPaymentMethod: paymentList.reduce((acc, p) => {
        if (!acc[p.paymentMethod]) {
          acc[p.paymentMethod] = { count: 0, amount: 0 };
        }
        acc[p.paymentMethod].count += 1;
        acc[p.paymentMethod].amount += p.amount;
        return acc;
      }, {} as Record<string, { count: number; amount: number }>),
      byLocation: paymentList.reduce((acc, p) => {
        const location = p.saleLocation;
        if (!acc[location]) {
          acc[location] = { count: 0, amount: 0 };
        }
        acc[location].count += 1;
        acc[location].amount += p.amount;
        return acc;
      }, {} as Record<string, { count: number; amount: number }>),
    };

    return NextResponse.json({
      success: true,
      data: {
        payments: paymentList,
        summary,
      },
    });
  } catch (error) {
    console.error("Receivable Payments Report Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch receivable payments report" },
      { status: 500 }
    );
  }
}
