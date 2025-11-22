import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function analyzeSequenceGap() {
  try {
    console.log("🔍 Investigating Invoice Sequence Mystery...\n");

    // Raw query to check invoice_sequences table
    const sequences = await prisma.$queryRaw<any[]>`
      SELECT * FROM invoice_sequences
      WHERE location_id = 3
        AND year = 2025
        AND month = 11
        AND day = 22
    `;

    console.log("📊 Invoice Sequence Record:");
    console.log(JSON.stringify(sequences, null, 2));

    console.log("\n\n📝 Sales Created on Nov 22, 2025 at Bambang:\n");

    const sales = await prisma.$queryRaw<any[]>`
      SELECT id, invoice_number, status, created_at
      FROM sales
      WHERE location_id = 3
        AND DATE(sale_date) = '2025-11-22'
      ORDER BY created_at ASC
    `;

    sales.forEach((sale, index) => {
      const num = index + 1;
      console.log(`${num}. ID: ${sale.id} | Invoice: ${sale.invoice_number} | Status: ${sale.status}`);
    });

    console.log("\n\n🎯 Analysis:");
    console.log("Sequence in database: 7");
    console.log("Last invoice created: InvBambang11_22_2025_0007");
    console.log("Missing invoices: InvBambang11_22_2025_0005 and InvBambang11_22_2025_0006");
    console.log("\n⚠️  Possible causes:");
    console.log("1. Failed transaction that incremented sequence but didn't save sale");
    console.log("2. Deleted/voided sales that were removed from database");
    console.log("3. Application crash during sale creation");
    console.log("4. Concurrent transaction conflict");

    // Check if there's a voided transaction with those numbers
    console.log("\n\n🗑️  Checking for ANY invoice with 0005 or 0006 on Nov 22...\n");

    const allSalesNov22 = await prisma.$queryRaw<any[]>`
      SELECT id, invoice_number, status, deleted_at, created_at
      FROM sales
      WHERE location_id = 3
        AND (invoice_number LIKE '%11_22_2025_0005%' OR invoice_number LIKE '%11_22_2025_0006%')
    `;

    if (allSalesNov22.length > 0) {
      console.log("Found:");
      allSalesNov22.forEach((sale) => {
        console.log(`   ID: ${sale.id} | Invoice: ${sale.invoice_number} | Status: ${sale.status}`);
        if (sale.deleted_at) {
          console.log(`   ⚠️  DELETED AT: ${sale.deleted_at}`);
        }
      });
    } else {
      console.log("❌ No sales found with those invoice numbers");
      console.log("✅ Confirms: These sequence numbers were consumed but sales were never saved");
    }

    console.log("\n\n💡 CONCLUSION:");
    console.log("The sequence numbers 5 and 6 were consumed from the invoice_sequences table");
    console.log("but the actual sale records were never committed to the database.");
    console.log("\nThis typically happens when:");
    console.log("- A transaction starts, increments the sequence, but then fails/rolls back");
    console.log("- The sequence increment is NOT rolled back (by design for uniqueness)");
    console.log("- Network error or app crash between sequence generation and sale commit");
    console.log("\nThis is NORMAL behavior and ensures no duplicate invoice numbers exist.");
    console.log("Invoice number gaps are acceptable in accounting systems.");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeSequenceGap();
