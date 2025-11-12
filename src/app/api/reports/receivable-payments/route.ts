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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const customerId = searchParams.get("customerId");
    const paymentMethod = searchParams.get("paymentMethod");
    const locationId = searchParams.get("locationId");
    const cashierId = searchParams.get("cashierId");

    // Build where clause for sale payments
    const where: Prisma.SalePaymentWhereInput = {
      sale: {
        businessId: user.businessId,
        status: "completed",
      },
      // Exclude the initial "credit" marker payment
      paymentMethod: {
        not: "credit",
      },
    };

    // Date range filter
    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) {
        where.paidAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.paidAt.lte = end;
      }
    }

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
                firstName: true,
                lastName: true,
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
          include: {
            location: {
              select: {
                id: true,
                name: true,
              },
            },
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
        ? payment.sale.customer.name ||
          `${payment.sale.customer.firstName} ${payment.sale.customer.lastName}`
        : "Walk-in Customer";

      const collectorName = payment.collectedByUser
        ? `${payment.collectedByUser.firstName} ${payment.collectedByUser.lastName}`
        : "System";

      const collectionLocation = payment.cashierShift
        ? payment.cashierShift.location.name
        : "Online/System";

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
