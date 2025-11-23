import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface GapAnalysis {
  location: string;
  locationId: number;
  date: string;
  expectedSequence: number;
  actualSequence: number;
  totalInvoices: number;
  missingSequences: number[];
  gapPercentage: number;
  status: "NORMAL" | "WARNING" | "CRITICAL";
}

async function monitorSequenceGaps() {
  try {
    console.log("🔍 Invoice Sequence Gap Monitor\n");
    console.log("=" .repeat(100));

    // Get all locations
    const locations = await prisma.businessLocation.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    });

    const allAnalysis: GapAnalysis[] = [];

    for (const location of locations) {
      console.log(`\n📍 Analyzing: ${location.name} (ID: ${location.id})`);

      // Get all invoice sequences for this location
      const sequences = await prisma.invoiceSequence.findMany({
        where: {
          locationId: location.id,
        },
        orderBy: [
          { year: "desc" },
          { month: "desc" },
          { day: "desc" },
        ],
        take: 30, // Last 30 sequence records
      });

      for (const seq of sequences) {
        const dateStr = `${seq.year}-${String(seq.month).padStart(2, "0")}-${String(seq.day).padStart(2, "0")}`;

        // Get all sales for this date and location
        const sales = await prisma.sale.findMany({
          where: {
            locationId: location.id,
            saleDate: new Date(dateStr),
          },
          select: { invoiceNumber: true },
          orderBy: { createdAt: "asc" },
        });

        // Extract sequence numbers from invoices
        const usedSequences = sales
          .map((s) => {
            const match = s.invoiceNumber.match(/_(\d{4})$/);
            return match ? parseInt(match[1], 10) : null;
          })
          .filter((n): n is number => n !== null)
          .sort((a, b) => a - b);

        // Find gaps
        const missingSequences: number[] = [];
        const maxUsed = Math.max(...usedSequences, 0);

        for (let i = 1; i <= seq.sequence; i++) {
          if (!usedSequences.includes(i)) {
            missingSequences.push(i);
          }
        }

        const gapPercentage = seq.sequence > 0
          ? (missingSequences.length / seq.sequence) * 100
          : 0;

        let status: "NORMAL" | "WARNING" | "CRITICAL" = "NORMAL";
        if (gapPercentage > 10) status = "CRITICAL";
        else if (gapPercentage > 5) status = "WARNING";

        const analysis: GapAnalysis = {
          location: location.name,
          locationId: location.id,
          date: dateStr,
          expectedSequence: seq.sequence,
          actualSequence: usedSequences.length,
          totalInvoices: sales.length,
          missingSequences,
          gapPercentage,
          status,
        };

        allAnalysis.push(analysis);

        if (missingSequences.length > 0) {
          const statusIcon =
            status === "CRITICAL" ? "🔴" : status === "WARNING" ? "⚠️ " : "ℹ️ ";

          console.log(`\n${statusIcon} ${dateStr}:`);
          console.log(`   Expected Sequence: ${seq.sequence}`);
          console.log(`   Invoices Created: ${usedSequences.length}`);
          console.log(`   Missing Sequences: [${missingSequences.join(", ")}]`);
          console.log(`   Gap Percentage: ${gapPercentage.toFixed(2)}%`);
          console.log(`   Status: ${status}`);
        }
      }
    }

    // Summary Report
    console.log("\n\n");
    console.log("=" .repeat(100));
    console.log("📊 SUMMARY REPORT");
    console.log("=" .repeat(100));

    const totalDays = allAnalysis.length;
    const daysWithGaps = allAnalysis.filter((a) => a.missingSequences.length > 0).length;
    const criticalDays = allAnalysis.filter((a) => a.status === "CRITICAL").length;
    const warningDays = allAnalysis.filter((a) => a.status === "WARNING").length;
    const totalGaps = allAnalysis.reduce((sum, a) => sum + a.missingSequences.length, 0);
    const totalInvoices = allAnalysis.reduce((sum, a) => sum + a.actualSequence, 0);
    const averageGapRate = totalInvoices > 0 ? (totalGaps / (totalInvoices + totalGaps)) * 100 : 0;

    console.log(`\nTotal Days Analyzed: ${totalDays}`);
    console.log(`Days with Gaps: ${daysWithGaps} (${((daysWithGaps / totalDays) * 100).toFixed(1)}%)`);
    console.log(`Warning Days: ${warningDays}`);
    console.log(`Critical Days: ${criticalDays}`);
    console.log(`\nTotal Invoices Created: ${totalInvoices}`);
    console.log(`Total Sequence Gaps: ${totalGaps}`);
    console.log(`Average Gap Rate: ${averageGapRate.toFixed(2)}%`);

    console.log("\n\n📋 INTERPRETATION:");

    if (averageGapRate < 1) {
      console.log("✅ EXCELLENT: Gap rate is very low (<1%). System is performing optimally.");
    } else if (averageGapRate < 3) {
      console.log("✅ GOOD: Gap rate is acceptable (<3%). Normal operational range.");
    } else if (averageGapRate < 5) {
      console.log("⚠️  ACCEPTABLE: Gap rate is moderate (3-5%). Monitor for trends.");
    } else if (averageGapRate < 10) {
      console.log("⚠️  WARNING: Gap rate is elevated (5-10%). Investigate common failures.");
      console.log("   Recommended Actions:");
      console.log("   - Review application error logs");
      console.log("   - Check network stability");
      console.log("   - Review validation logic");
    } else {
      console.log("🔴 CRITICAL: Gap rate is high (>10%). Immediate investigation required!");
      console.log("   Recommended Actions:");
      console.log("   1. Check database connection pool");
      console.log("   2. Review recent code changes");
      console.log("   3. Check for concurrent transaction conflicts");
      console.log("   4. Review error tracking service (Sentry)");
      console.log("   5. Analyze timing of validations in sales flow");
    }

    console.log("\n\n💡 REMEMBER:");
    console.log("- Sequence gaps are NORMAL and BIR-compliant");
    console.log("- Gaps prevent duplicate invoice numbers");
    console.log("- 1-3% gap rate is industry standard");
    console.log("- Only investigate if gap rate exceeds 5%");

    // Most problematic days
    if (criticalDays > 0 || warningDays > 0) {
      console.log("\n\n⚠️  DAYS REQUIRING ATTENTION:\n");

      const problemDays = allAnalysis
        .filter((a) => a.status === "CRITICAL" || a.status === "WARNING")
        .sort((a, b) => b.gapPercentage - a.gapPercentage)
        .slice(0, 10);

      problemDays.forEach((day) => {
        const icon = day.status === "CRITICAL" ? "🔴" : "⚠️ ";
        console.log(`${icon} ${day.date} - ${day.location}`);
        console.log(`   Gap Rate: ${day.gapPercentage.toFixed(2)}%`);
        console.log(`   Missing: [${day.missingSequences.join(", ")}]`);
        console.log("");
      });
    }

    console.log("\n" + "=".repeat(100));

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

monitorSequenceGaps();
