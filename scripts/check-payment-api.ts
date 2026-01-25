import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Simulating Payment Report API Query ===\n");

  // This mimics what the API does
  const businessId = 1; // The user's businessId from the screenshot

  // Check payments with the same query as the API
  const payments = await prisma.salePayment.findMany({
    where: {
      sale: {
        businessId: businessId,
        status: "completed", // This is the filter in the API
      },
    },
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
    take: 20,
  });

  console.log("Payments found (API query simulation):", payments.length);

  if (payments.length > 0) {
    console.log("\nFirst 5 payments:");
    payments.slice(0, 5).forEach(p => {
      console.log({
        id: p.id,
        invoiceNumber: p.sale?.invoiceNumber,
        amount: Number(p.amount),
        method: p.paymentMethod,
        paidAt: p.paidAt,
        locationName: p.sale?.location?.name,
        saleStatus: p.sale?.status,
      });
    });
  }

  // Check date range - what dates exist
  const dateRange = await prisma.salePayment.aggregate({
    _min: { paidAt: true },
    _max: { paidAt: true },
  });
  console.log("\nPayment date range:");
  console.log("  Oldest:", dateRange._min.paidAt);
  console.log("  Newest:", dateRange._max.paidAt);

  // Check by location
  const paymentsByLocation = await prisma.salePayment.groupBy({
    by: ['saleId'],
    _count: true,
  });

  // Get unique locations
  const locations = await prisma.businessLocation.findMany({
    where: { businessId: 1, deletedAt: null },
    select: { id: true, name: true, isActive: true }
  });
  console.log("\nLocations:");
  locations.forEach(l => console.log(`  ${l.id}: ${l.name} (active: ${l.isActive})`));

  // Check payments by sale location
  const salesWithPayments = await prisma.sale.findMany({
    where: {
      businessId: 1,
      status: "completed",
    },
    select: {
      locationId: true,
      location: { select: { name: true } },
      _count: { select: { payments: true } }
    },
    take: 100,
  });

  const locationPaymentCounts: Record<string, number> = {};
  salesWithPayments.forEach(s => {
    const locName = s.location?.name || 'Unknown';
    locationPaymentCounts[locName] = (locationPaymentCounts[locName] || 0) + s._count.payments;
  });
  console.log("\nPayments by location:");
  Object.entries(locationPaymentCounts).forEach(([loc, count]) => {
    console.log(`  ${loc}: ${count}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
