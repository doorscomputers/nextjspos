import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkInvoiceSequences() {
  try {
    console.log("🔍 Checking invoice_sequences table for Bambang...\n");

    // Find Bambang location
    const bambangLocation = await prisma.businessLocation.findFirst({
      where: {
        name: {
          contains: "Bambang",
        },
      },
    });

    if (!bambangLocation) {
      console.log("❌ Bambang location not found!");
      return;
    }

    console.log(`📍 Location: ${bambangLocation.name} (ID: ${bambangLocation.id})\n`);

    // Get all invoice sequences for Bambang
    const sequences = await prisma.invoiceSequence.findMany({
      where: {
        locationId: bambangLocation.id,
      },
      orderBy: [
        { year: "desc" },
        { month: "desc" },
        { day: "desc" },
      ],
    });

    console.log(`📊 Invoice Sequences Found: ${sequences.length}\n`);
    console.log("=" .repeat(80));

    sequences.forEach((seq) => {
      console.log(
        `\n📅 ${seq.year}-${String(seq.month).padStart(2, "0")}-${String(seq.day).padStart(2, "0")}`
      );
      console.log(`   Sequence Number: ${seq.sequence}`);
      console.log(`   Last Updated: ${seq.updatedAt.toISOString()}`);
    });

    console.log("\n" + "=".repeat(80));

    // Now let's check Nov 22, 2025 specifically
    const nov22Seq = await prisma.invoiceSequence.findFirst({
      where: {
        locationId: bambangLocation.id,
        year: 2025,
        month: 11,
        day: 22,
      },
    });

    console.log("\n📅 November 22, 2025 Sequence:");
    if (nov22Seq) {
      console.log(`   Current Sequence: ${nov22Seq.sequence}`);
      console.log(`   Last Updated: ${nov22Seq.updatedAt.toISOString()}`);
    } else {
      console.log("   ❌ No sequence record found!");
    }

    // Check actual sales for Nov 22
    const nov22Sales = await prisma.sale.findMany({
      where: {
        locationId: bambangLocation.id,
        saleDate: new Date("2025-11-22"),
      },
      select: {
        invoiceNumber: true,
        createdAt: true,
        status: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    console.log(`\n📝 Actual Sales on Nov 22: ${nov22Sales.length}`);
    nov22Sales.forEach((sale, index) => {
      console.log(`   ${index + 1}. ${sale.invoiceNumber} (${sale.status}) - ${sale.createdAt.toISOString()}`);
    });

    // Extract sequence numbers from invoice numbers
    console.log("\n🔢 Sequence Analysis:");
    const seqNumbers = nov22Sales
      .map((s) => {
        const match = s.invoiceNumber.match(/_(\d{4})$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n) => n !== null) as number[];

    console.log(`   Invoice sequences used: [${seqNumbers.join(", ")}]`);
    console.log(`   Database sequence value: ${nov22Seq?.sequence || "N/A"}`);

    // Check for mismatch
    const maxUsed = Math.max(...seqNumbers, 0);
    const expected = nov22Seq?.sequence || 0;

    if (maxUsed !== expected) {
      console.log(`\n⚠️  MISMATCH DETECTED!`);
      console.log(`   Highest invoice number used: ${maxUsed}`);
      console.log(`   Current sequence value: ${expected}`);
      console.log(`   Difference: ${expected - maxUsed}`);
    } else {
      console.log(`\n✅ Sequence is in sync`);
    }

    // Check for gaps
    const missing: number[] = [];
    for (let i = 1; i <= maxUsed; i++) {
      if (!seqNumbers.includes(i)) {
        missing.push(i);
      }
    }

    if (missing.length > 0) {
      console.log(`\n⚠️  MISSING SEQUENCE NUMBERS: [${missing.join(", ")}]`);
      console.log(`   These numbers were skipped or deleted`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkInvoiceSequences();
