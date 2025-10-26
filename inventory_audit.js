/**
 * SYSTEM-WIDE INVENTORY AUDIT
 *
 * This script checks ALL products across ALL locations to identify
 * inventory discrepancies between transaction history and actual qtyAvailable.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runInventoryAudit() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   SYSTEM-WIDE INVENTORY AUDIT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const startTime = Date.now();

  // Get all business locations
  const locations = await prisma.businessLocation.findMany({
    select: { id: true, name: true }
  });

  console.log(`Found ${locations.length} business locations\n`);

  // Get all products with variations
  const products = await prisma.product.findMany({
    where: { enableStock: true },
    include: {
      variations: {
        include: {
          variationLocationDetails: true
        }
      }
    }
  });

  console.log(`Found ${products.length} products with stock tracking enabled\n`);
  console.log('Analyzing inventory integrity...\n');

  const results = {
    totalProducts: products.length,
    totalLocations: locations.length,
    totalVariationLocationCombos: 0,
    perfectMatch: 0,
    hasDiscrepancy: 0,
    criticalDiscrepancies: [], // > 10% difference
    minorDiscrepancies: [], // <= 10% difference
    totalUnitsDiscrepancy: 0,
    totalValueDiscrepancy: 0
  };

  // Create location map for quick lookup
  const locationMap = new Map(locations.map(loc => [loc.id, loc.name]));

  // Process each product and variation
  for (const product of products) {
    for (const variation of product.variations) {
      for (const detail of variation.variationLocationDetails) {
        results.totalVariationLocationCombos++;

        const locationName = locationMap.get(detail.locationId) || 'Unknown';

        // Calculate expected inventory from stock transactions
        const transactions = await prisma.stockTransaction.findMany({
          where: {
            productId: product.id,
            productVariationId: variation.id,
            locationId: detail.locationId
          },
          orderBy: { createdAt: 'asc' }
        });

        let calculatedBalance = 0;
        for (const tx of transactions) {
          calculatedBalance += parseFloat(tx.quantity);
        }

        const actualBalance = parseFloat(detail.qtyAvailable);
        const difference = calculatedBalance - actualBalance;
        const percentDiff = actualBalance > 0 ? Math.abs((difference / actualBalance) * 100) : (difference !== 0 ? 100 : 0);

        if (Math.abs(difference) < 0.01) {
          // Perfect match (accounting for floating point precision)
          results.perfectMatch++;
        } else {
          // Discrepancy found
          results.hasDiscrepancy++;
          results.totalUnitsDiscrepancy += Math.abs(difference);

          const unitCost = parseFloat(detail.sellingPrice || variation.sellingPrice || 0);
          const valueDiff = Math.abs(difference) * unitCost;
          results.totalValueDiscrepancy += valueDiff;

          const discrepancy = {
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            variationName: variation.name,
            variationSku: variation.sku,
            locationId: detail.locationId,
            locationName,
            calculated: calculatedBalance,
            actual: actualBalance,
            difference: difference,
            percentDiff: percentDiff.toFixed(2),
            unitCost: unitCost,
            valueDiff: valueDiff.toFixed(2),
            transactionCount: transactions.length
          };

          if (percentDiff > 10 || Math.abs(difference) > 5) {
            results.criticalDiscrepancies.push(discrepancy);
          } else {
            results.minorDiscrepancies.push(discrepancy);
          }
        }
      }
    }
  }

  // Sort critical discrepancies by value impact
  results.criticalDiscrepancies.sort((a, b) => parseFloat(b.valueDiff) - parseFloat(a.valueDiff));
  results.minorDiscrepancies.sort((a, b) => parseFloat(b.valueDiff) - parseFloat(a.valueDiff));

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

  // Print summary report
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   AUDIT SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Total Products Audited:              ${results.totalProducts}`);
  console.log(`Total Locations:                     ${results.totalLocations}`);
  console.log(`Total Product-Location Combinations: ${results.totalVariationLocationCombos}`);
  console.log('');
  console.log(`✓ Perfect Matches:                   ${results.perfectMatch} (${((results.perfectMatch / results.totalVariationLocationCombos) * 100).toFixed(1)}%)`);
  console.log(`✗ Discrepancies Found:               ${results.hasDiscrepancy} (${((results.hasDiscrepancy / results.totalVariationLocationCombos) * 100).toFixed(1)}%)`);
  console.log(`  - Critical (>10% or >5 units):     ${results.criticalDiscrepancies.length}`);
  console.log(`  - Minor (≤10% and ≤5 units):       ${results.minorDiscrepancies.length}`);
  console.log('');
  console.log(`Total Units Discrepancy:             ${results.totalUnitsDiscrepancy.toFixed(2)} units`);
  console.log(`Total Value Impact:                  ₱${results.totalValueDiscrepancy.toFixed(2)}`);
  console.log('');
  console.log(`Audit completed in ${elapsedTime} seconds`);

  // Print critical discrepancies
  if (results.criticalDiscrepancies.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   CRITICAL DISCREPANCIES (Top 20)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const top20 = results.criticalDiscrepancies.slice(0, 20);

    for (let i = 0; i < top20.length; i++) {
      const d = top20[i];
      console.log(`${i + 1}. ${d.productName} (${d.productSku})`);
      console.log(`   Location: ${d.locationName}`);
      console.log(`   Calculated: ${d.calculated} | Actual: ${d.actual} | Diff: ${d.difference > 0 ? '+' : ''}${d.difference} (${d.percentDiff}%)`);
      console.log(`   Value Impact: ₱${d.valueDiff} | Transactions: ${d.transactionCount}`);
      console.log('');
    }

    if (results.criticalDiscrepancies.length > 20) {
      console.log(`... and ${results.criticalDiscrepancies.length - 20} more critical discrepancies\n`);
    }
  }

  // Generate detailed CSV report
  const csv = generateCSVReport(results);
  const fs = require('fs');
  const csvFilename = `inventory_audit_${new Date().toISOString().split('T')[0]}.csv`;
  fs.writeFileSync(csvFilename, csv);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Detailed CSV report saved to: ${csvFilename}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Print recommendations
  printRecommendations(results);

  await prisma.$disconnect();
  return results;
}

function generateCSVReport(results) {
  const allDiscrepancies = [...results.criticalDiscrepancies, ...results.minorDiscrepancies];

  let csv = 'Product ID,Product Name,Product SKU,Variation Name,Variation SKU,Location ID,Location Name,';
  csv += 'Calculated Qty,Actual Qty,Difference,Percent Diff,Unit Cost,Value Impact,Transaction Count,Severity\n';

  for (const d of allDiscrepancies) {
    const severity = results.criticalDiscrepancies.includes(d) ? 'CRITICAL' : 'MINOR';
    csv += `${d.productId},"${d.productName}","${d.productSku}","${d.variationName}","${d.variationSku}",`;
    csv += `${d.locationId},"${d.locationName}",${d.calculated},${d.actual},${d.difference},`;
    csv += `${d.percentDiff},${d.unitCost},${d.valueDiff},${d.transactionCount},${severity}\n`;
  }

  return csv;
}

function printRecommendations(results) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const discrepancyRate = (results.hasDiscrepancy / results.totalVariationLocationCombos) * 100;

  if (discrepancyRate === 0) {
    console.log('✓ EXCELLENT: No inventory discrepancies found!');
    console.log('  Your inventory system is working correctly.');
  } else if (discrepancyRate < 5) {
    console.log('⚠ MINOR ISSUES: Low discrepancy rate detected');
    console.log(`  ${results.hasDiscrepancy} out of ${results.totalVariationLocationCombos} records affected (${discrepancyRate.toFixed(1)}%)`);
    console.log('  Actions:');
    console.log('  1. Review the discrepancies in the CSV report');
    console.log('  2. Run data correction script for affected products');
    console.log('  3. Monitor for new discrepancies');
  } else if (discrepancyRate < 20) {
    console.log('⚠ MODERATE ISSUES: Significant discrepancies detected');
    console.log(`  ${results.hasDiscrepancy} out of ${results.totalVariationLocationCombos} records affected (${discrepancyRate.toFixed(1)}%)`);
    console.log('  Actions:');
    console.log('  1. URGENT: Run data correction script ASAP');
    console.log('  2. Audit transaction processing code for bugs');
    console.log('  3. Add real-time validation to prevent future issues');
  } else {
    console.log('🚨 CRITICAL ISSUES: Systemic inventory integrity failure');
    console.log(`  ${results.hasDiscrepancy} out of ${results.totalVariationLocationCombos} records affected (${discrepancyRate.toFixed(1)}%)`);
    console.log('  Actions:');
    console.log('  1. STOP: Do not deploy to production');
    console.log('  2. IMMEDIATE: Fix transaction processing APIs');
    console.log('  3. Run comprehensive data correction');
    console.log('  4. Add automated testing and monitoring');
    console.log('  5. Consider database triggers as backup');
  }

  console.log('');

  if (results.criticalDiscrepancies.length > 0) {
    console.log(`⚠ ${results.criticalDiscrepancies.length} CRITICAL discrepancies require immediate attention`);
    console.log(`  Financial Impact: ₱${results.totalValueDiscrepancy.toFixed(2)}`);
    console.log('');
  }

  console.log('Next Steps:');
  console.log('  1. Review the CSV report: inventory_audit_YYYY-MM-DD.csv');
  console.log('  2. Run: node fix_inventory_discrepancies.js (after creating fix script)');
  console.log('  3. Audit and fix transaction processing code');
  console.log('  4. Re-run this audit to verify corrections');
  console.log('');
}

// Run the audit
runInventoryAudit()
  .then((results) => {
    if (results.hasDiscrepancy > 0) {
      process.exit(1); // Exit with error code if discrepancies found
    } else {
      process.exit(0); // Exit successfully if all clear
    }
  })
  .catch((error) => {
    console.error('AUDIT FAILED:', error);
    process.exit(2);
  });
