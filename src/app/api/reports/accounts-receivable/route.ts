import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/rbac";
import { Prisma } from "@prisma/client";

/**
 * Accounts Receivable Report API
 * Shows customer outstanding balances with aging analysis
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
        { error: "Insufficient permissions to view accounts receivable reports" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const locationId = searchParams.get("locationId");
    const minBalance = searchParams.get("minBalance");
    const showZeroBalances = searchParams.get("showZeroBalances") === "true";

    // Build where clause for sales
    // NOTE: We fetch all sales with customers (regardless of status), then filter by balance
    // Credit sales have status="pending", cash sales have status="completed"
    // We need both to calculate AR correctly
    const where: Prisma.SaleWhereInput = {
      businessId: user.businessId,
      deletedAt: null,
      customerId: {
        not: null, // Only get sales with customers (not walk-in)
      },
      // Don't filter by status - include both "pending" (credit) and "completed" (paid) sales
    };

    // Customer filter
    if (customerId && customerId !== "all") {
      where.customerId = parseInt(customerId);
    }

    // Location filter
    if (locationId && locationId !== "all") {
      where.locationId = parseInt(locationId);
    }

    // Fetch sales with outstanding balances
    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            mobile: true,
            creditLimit: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        payments: true,
      },
      orderBy: {
        saleDate: "asc",
      },
    });

    // Calculate balances per customer
    const customerBalances = new Map<
      number,
      {
        customerId: number;
        customerName: string;
        email: string | null;
        mobile: string | null;
        creditLimit: number | null;
        totalInvoices: number;
        totalAmount: number;
        totalPaid: number;
        outstandingBalance: number;
        oldestInvoiceDate: Date;
        invoices: Array<{
          id: number;
          invoiceNumber: string;
          saleDate: Date;
          locationName: string;
          totalAmount: number;
          totalPaid: number;
          balance: number;
          daysOverdue: number;
        }>;
      }
    >();

    // Process each sale
    sales.forEach((sale) => {
      const totalAmount = parseFloat(sale.totalAmount.toString());
      // Use paidAmount from Sale model (already tracks total paid, excluding credit method)
      const totalPaid = parseFloat(sale.paidAmount?.toString() || "0");
      const balance = totalAmount - totalPaid;

      // Skip if balance is zero and not showing zero balances
      if (balance <= 0.01 && !showZeroBalances) {
        return;
      }

      // Skip if below minimum balance threshold
      if (minBalance && balance < parseFloat(minBalance)) {
        return;
      }

      const customerId = sale.customerId;
      if (!customerId) return; // Skip walk-in sales without customer

      const customerName =
        sale.customer?.name ||
        `${sale.customer?.firstName || ""} ${sale.customer?.lastName || ""}`.trim() ||
        "Unknown Customer";

      const daysOverdue = Math.floor(
        (new Date().getTime() - new Date(sale.saleDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // Get or create customer entry
      if (!customerBalances.has(customerId)) {
        customerBalances.set(customerId, {
          customerId,
          customerName,
          email: sale.customer?.email || null,
          mobile: sale.customer?.mobile || null,
          creditLimit: sale.customer?.creditLimit
            ? parseFloat(sale.customer.creditLimit.toString())
            : null,
          totalInvoices: 0,
          totalAmount: 0,
          totalPaid: 0,
          outstandingBalance: 0,
          oldestInvoiceDate: sale.saleDate,
          invoices: [],
        });
      }

      const customerEntry = customerBalances.get(customerId)!;

      // Update customer totals
      customerEntry.totalInvoices += 1;
      customerEntry.totalAmount += totalAmount;
      customerEntry.totalPaid += totalPaid;
      customerEntry.outstandingBalance += balance;

      // Update oldest invoice date
      if (new Date(sale.saleDate) < new Date(customerEntry.oldestInvoiceDate)) {
        customerEntry.oldestInvoiceDate = sale.saleDate;
      }

      // Add invoice details
      customerEntry.invoices.push({
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        saleDate: sale.saleDate,
        locationName: sale.location.name,
        totalAmount,
        totalPaid,
        balance,
        daysOverdue,
      });
    });

    // Convert map to array and sort by outstanding balance (highest first)
    const customerList = Array.from(customerBalances.values()).sort(
      (a, b) => b.outstandingBalance - a.outstandingBalance
    );

    // Calculate aging buckets for each customer
    const customersWithAging = customerList.map((customer) => {
      const aging = {
        current: 0, // 0-30 days
        days31_60: 0, // 31-60 days
        days61_90: 0, // 61-90 days
        over90: 0, // Over 90 days
      };

      customer.invoices.forEach((invoice) => {
        if (invoice.daysOverdue <= 30) {
          aging.current += invoice.balance;
        } else if (invoice.daysOverdue <= 60) {
          aging.days31_60 += invoice.balance;
        } else if (invoice.daysOverdue <= 90) {
          aging.days61_90 += invoice.balance;
        } else {
          aging.over90 += invoice.balance;
        }
      });

      const oldestDays = Math.floor(
        (new Date().getTime() - new Date(customer.oldestInvoiceDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      return {
        ...customer,
        oldestInvoiceDays: oldestDays,
        aging,
      };
    });

    // Calculate summary statistics
    const summary = {
      totalCustomers: customersWithAging.length,
      totalOutstanding: customersWithAging.reduce(
        (sum, c) => sum + c.outstandingBalance,
        0
      ),
      totalInvoices: customersWithAging.reduce(
        (sum, c) => sum + c.totalInvoices,
        0
      ),
      aging: {
        current: customersWithAging.reduce(
          (sum, c) => sum + c.aging.current,
          0
        ),
        days31_60: customersWithAging.reduce(
          (sum, c) => sum + c.aging.days31_60,
          0
        ),
        days61_90: customersWithAging.reduce(
          (sum, c) => sum + c.aging.days61_90,
          0
        ),
        over90: customersWithAging.reduce((sum, c) => sum + c.aging.over90, 0),
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        customers: customersWithAging,
        summary,
      },
    });
  } catch (error) {
    console.error("Accounts Receivable Report Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts receivable report" },
      { status: 500 }
    );
  }
}
