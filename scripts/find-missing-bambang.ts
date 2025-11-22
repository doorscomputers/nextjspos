import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function findMissingSales() {
  try {
    console.log("🔍 Searching for missing sales 5 and 6...\n");

    // Search for any invoice containing "0005" or "0006"
    const sales5 = await prisma.sale.findMany({
      where: {
        invoiceNumber: {
          contains: "0005",
        },
      },
      include: {
        location: {
          select: { name: true },
        },
        customer: {
          select: { name: true },
        },
      },
    });

    const sales6 = await prisma.sale.findMany({
      where: {
        invoiceNumber: {
          contains: "0006",
        },
      },
      include: {
        location: {
          select: { name: true },
        },
        customer: {
          select: { name: true },
        },
      },
    });

    console.log(`\n📝 Sales with "0005" in invoice number: ${sales5.length}`);
    sales5.forEach((sale) => {
      console.log(`   Invoice: ${sale.invoiceNumber}`);
      console.log(`   Location: ${sale.location.name}`);
      console.log(`   Date: ${sale.saleDate.toISOString().split("T")[0]}`);
      console.log(`   Status: ${sale.status}`);
      console.log(`   Customer: ${sale.customer?.name || "Walk-in"}`);
      console.log(`   Deleted: ${sale.deletedAt ? "YES - " + sale.deletedAt.toISOString() : "NO"}`);
      console.log("");
    });

    console.log(`\n📝 Sales with "0006" in invoice number: ${sales6.length}`);
    sales6.forEach((sale) => {
      console.log(`   Invoice: ${sale.invoiceNumber}`);
      console.log(`   Location: ${sale.location.name}`);
      console.log(`   Date: ${sale.saleDate.toISOString().split("T")[0]}`);
      console.log(`   Status: ${sale.status}`);
      console.log(`   Customer: ${sale.customer?.name || "Walk-in"}`);
      console.log(`   Deleted: ${sale.deletedAt ? "YES - " + sale.deletedAt.toISOString() : "NO"}`);
      console.log("");
    });

    // Search for Bambang sales on Nov 22, 2025
    console.log("\n\n📅 All Bambang sales on 2025-11-22:\n");
    const bambangToday = await prisma.sale.findMany({
      where: {
        location: {
          name: {
            contains: "Bambang",
          },
        },
        saleDate: new Date("2025-11-22"),
      },
      orderBy: {
        invoiceNumber: "asc",
      },
      include: {
        customer: {
          select: { name: true },
        },
        items: true,
        payments: true,
      },
    });

    bambangToday.forEach((sale) => {
      const total = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      console.log(`📝 ${sale.invoiceNumber}`);
      console.log(`   ID: ${sale.id}`);
      console.log(`   Status: ${sale.status}`);
      console.log(`   Customer: ${sale.customer?.name || "Walk-in"}`);
      console.log(`   Items: ${sale.items.length}`);
      console.log(`   Total: ₱${total.toFixed(2)}`);
      console.log(`   Created: ${sale.createdAt.toISOString()}`);
      if (sale.deletedAt) {
        console.log(`   ⚠️  DELETED: ${sale.deletedAt.toISOString()}`);
      }
      console.log("");
    });

    // Check if there's a pattern - maybe deleted sales?
    console.log("\n\n🗑️  Checking for soft-deleted sales at Bambang...\n");
    const deletedSales = await prisma.sale.findMany({
      where: {
        location: {
          name: {
            contains: "Bambang",
          },
        },
        deletedAt: {
          not: null,
        },
      },
      include: {
        location: {
          select: { name: true },
        },
        customer: {
          select: { name: true },
        },
      },
    });

    if (deletedSales.length > 0) {
      console.log(`Found ${deletedSales.length} deleted sales at Bambang:`);
      deletedSales.forEach((sale) => {
        console.log(`   Invoice: ${sale.invoiceNumber}`);
        console.log(`   Date: ${sale.saleDate.toISOString().split("T")[0]}`);
        console.log(`   Status: ${sale.status}`);
        console.log(`   Deleted At: ${sale.deletedAt?.toISOString()}`);
        console.log("");
      });
    } else {
      console.log("No soft-deleted sales found at Bambang");
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

findMissingSales();
