import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Payment Report API
 * Shows all payments with invoice details, customer information, and payment method breakdown
 * Critical for cash reconciliation and preventing unaccounted cash (Z Reading accuracy)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const paymentMethod = searchParams.get("paymentMethod"); // cash, card, cheque, bank_transfer, gcash, paymaya
    const locationId = searchParams.get("locationId");
    const customerId = searchParams.get("customerId");
    const shiftId = searchParams.get("shiftId");
    const collectedBy = searchParams.get("collectedBy");

    // Parse businessId to integer (session stores it as string)
    const businessId = parseInt(String(session.user.businessId));

    console.log("[Payment Report API] Session businessId:", session.user.businessId, "Parsed:", businessId);
    console.log("[Payment Report API] Filters - startDate:", startDate, "endDate:", endDate, "locationId:", locationId);

    // Build dynamic where clause
    const where: Prisma.SalePaymentWhereInput = {
      sale: {
        businessId: businessId,
        status: "completed", // Only include completed sales
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

    // Payment method filter
    if (paymentMethod && paymentMethod !== "all") {
      where.paymentMethod = paymentMethod;
    }

    // Location filter
    if (locationId && locationId !== "all") {
      where.sale = {
        ...where.sale,
        locationId: parseInt(locationId),
      };
    }

    // Customer filter
    if (customerId && customerId !== "all") {
      where.sale = {
        ...where.sale,
        customerId: parseInt(customerId),
      };
    }

    // Shift filter
    if (shiftId && shiftId !== "all") {
      where.shiftId = parseInt(shiftId);
    }

    // Collected by filter (for AR payments)
    if (collectedBy && collectedBy !== "all") {
      where.collectedBy = parseInt(collectedBy);
    }

    // Fetch payment data with related information
    const payments = await prisma.salePayment.findMany({
      where,
      include: {
        sale: {
          include: {
            customer: true,
            location: true,
            creator: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        cashierShift: {
          select: {
            id: true,
            shiftNumber: true,
            openedAt: true,
            closedAt: true,
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

    console.log("[Payment Report API] Query returned", payments.length, "payments");
    console.log("[Payment Report API] Where clause:", JSON.stringify(where, null, 2));

    // Calculate payment method totals
    const paymentMethodTotals = payments.reduce(
      (acc, payment) => {
        const method = payment.paymentMethod;
        const amount = parseFloat(payment.amount.toString());

        if (!acc[method]) {
          acc[method] = 0;
        }
        acc[method] += amount;
        acc.total += amount;

        return acc;
      },
      { total: 0 } as Record<string, number>
    );

    // Transform data for response
    const paymentList = payments.map((payment) => {
      const customerName = payment.sale.customer
        ? `${payment.sale.customer.firstName} ${payment.sale.customer.lastName}`
        : "Walk-in Customer";

      const collectorName = payment.collectedByUser
        ? `${payment.collectedByUser.firstName} ${payment.collectedByUser.lastName}`
        : null;

      const creatorName = `${payment.sale.creator.firstName} ${payment.sale.creator.lastName}`;

      return {
        id: payment.id,
        invoiceNumber: payment.sale.invoiceNumber,
        saleDate: payment.sale.saleDate,
        paidAt: payment.paidAt,
        customerName,
        customerId: payment.sale.customerId,
        locationName: payment.sale.location.name,
        locationId: payment.sale.locationId,
        paymentMethod: payment.paymentMethod,
        amount: parseFloat(payment.amount.toString()),
        referenceNumber: payment.referenceNumber,
        shiftNumber: payment.cashierShift?.shiftNumber || null,
        shiftId: payment.shiftId,
        collectedBy: collectorName,
        collectedById: payment.collectedBy,
        createdBy: creatorName,
        saleTotal: parseFloat(payment.sale.totalAmount.toString()),
        isArPayment: payment.shiftId !== payment.sale.shiftId, // True if payment collected in different shift than sale
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        payments: paymentList,
        summary: {
          totalPayments: payments.length,
          totalAmount: paymentMethodTotals.total,
          paymentMethodBreakdown: paymentMethodTotals,
        },
      },
    });
  } catch (error) {
    console.error("Payment Report Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment report" },
      { status: 500 }
    );
  }
}
