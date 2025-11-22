import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkBambangSales() {
  try {
    console.log("🔍 Investigating Sales Transactions at Bambang Location...\n");

    // Find Bambang location
    const bambangLocation = await prisma.businessLocation.findFirst({
      where: {
        name: {
          contains: "Bambang",
          mode: "insensitive",
        },
      },
      include: {
        business: {
          select: { name: true },
        },
      },
    });

    if (!bambangLocation) {
      console.log("❌ Bambang location not found!");
      return;
    }

    console.log(`📍 Location: ${bambangLocation.name} (ID: ${bambangLocation.id})`);
    console.log(`🏢 Business: ${bambangLocation.business.name}\n`);

    // Get ALL sales for Bambang (including voided, deleted, etc.)
    const allSales = await prisma.sale.findMany({
      where: {
        locationId: bambangLocation.id,
      },
      orderBy: {
        invoiceNumber: "asc",
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
          },
        },
        payments: {
          select: {
            amount: true,
            paymentMethod: true,
          },
        },
      },
    });

    console.log(`📊 Total Sales Found: ${allSales.length}\n`);
    console.log("=" .repeat(100));

    // Display all sales
    allSales.forEach((sale) => {
      const totalAmount = sale.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0
      );

      console.log(`\n📝 Invoice: ${sale.invoiceNumber}`);
      console.log(`   ID: ${sale.id}`);
      console.log(`   Date: ${sale.saleDate.toISOString().split("T")[0]}`);
      console.log(`   Status: ${sale.status}`);
      console.log(`   Type: ${sale.saleType}`);
      console.log(`   Customer: ${sale.customer?.name || "Walk-in"}`);
      console.log(`   Items: ${sale.items.length}`);
      console.log(`   Total: ₱${totalAmount.toFixed(2)}`);
      console.log(`   Created: ${sale.createdAt.toISOString()}`);

      if (sale.deletedAt) {
        console.log(`   ⚠️  DELETED AT: ${sale.deletedAt.toISOString()}`);
      }
    });

    console.log("\n" + "=".repeat(100));

    // Extract transaction numbers
    const invoiceNumbers = allSales
      .map((s) => s.invoiceNumber)
      .filter((inv) => inv.match(/^\d+$/))
      .map(Number)
      .sort((a, b) => a - b);

    console.log(`\n🔢 Transaction Numbers Found: [${invoiceNumbers.join(", ")}]`);

    // Check for gaps
    if (invoiceNumbers.length > 0) {
      const min = Math.min(...invoiceNumbers);
      const max = Math.max(...invoiceNumbers);
      const missing: number[] = [];

      for (let i = min; i <= max; i++) {
        if (!invoiceNumbers.includes(i)) {
          missing.push(i);
        }
      }

      if (missing.length > 0) {
        console.log(`\n⚠️  MISSING TRANSACTION NUMBERS: [${missing.join(", ")}]`);
      } else {
        console.log(`\n✅ No gaps in transaction sequence`);
      }
    }

    // Check for soft-deleted sales
    const deletedSales = allSales.filter((s) => s.deletedAt !== null);
    if (deletedSales.length > 0) {
      console.log(`\n🗑️  Soft-Deleted Sales: ${deletedSales.length}`);
      deletedSales.forEach((sale) => {
        console.log(
          `   - Invoice ${sale.invoiceNumber} (deleted on ${sale.deletedAt?.toISOString()})`
        );
      });
    }

    // Check for voided sales
    const voidedSales = allSales.filter((s) => s.status === "voided");
    if (voidedSales.length > 0) {
      console.log(`\n🚫 Voided Sales: ${voidedSales.length}`);
      voidedSales.forEach((sale) => {
        console.log(`   - Invoice ${sale.invoiceNumber} (${sale.status})`);
      });
    }

    // Check CashierShift for any additional clues
    console.log("\n\n💰 Checking Cashier Shifts...\n");
    const shifts = await prisma.cashierShift.findMany({
      where: {
        locationId: bambangLocation.id,
      },
      orderBy: {
        startedAt: "desc",
      },
      take: 5,
      include: {
        cashier: {
          select: {
            username: true,
          },
        },
        sales: {
          select: {
            invoiceNumber: true,
            status: true,
          },
        },
      },
    });

    shifts.forEach((shift) => {
      console.log(`\n🕐 Shift ID: ${shift.id}`);
      console.log(`   Cashier: ${shift.cashier.username}`);
      console.log(`   Started: ${shift.startedAt.toISOString()}`);
      console.log(`   Ended: ${shift.endedAt?.toISOString() || "Still Open"}`);
      console.log(`   Status: ${shift.status}`);
      console.log(
        `   Sales in this shift: ${shift.sales.map((s) => s.invoiceNumber).join(", ")}`
      );
    });

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBambangSales();
