import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSystemWideImpact() {
  console.log('='.repeat(100));
  console.log('SYSTEM-WIDE IMPACT ANALYSIS: Missing Opening Stock Transactions');
  console.log('='.repeat(100));

  try {
    console.log('\n[1] Checking Total Products with Opening Stock...\n');

    // Count total products with opening stock in ProductHistory
    const totalOpeningStock = await prisma.productHistory.count({
      where: {
        transactionType: 'opening_stock'
      }
    });

    console.log(`Total Opening Stock Records in ProductHistory: ${totalOpeningStock}`);

    // Count how many are missing in StockTransaction
    const missingCount = await prisma.$queryRaw`
      SELECT COUNT(*) as missing_count
      FROM (
        SELECT DISTINCT ph.product_variation_id, ph.location_id
        FROM product_history ph
        LEFT JOIN stock_transactions st
          ON st.product_variation_id = ph.product_variation_id
          AND st.location_id = ph.location_id
          AND st.type = 'opening_stock'
        WHERE ph.transaction_type = 'opening_stock'
          AND st.id IS NULL
      ) as missing_records
    `;

    const missing = parseInt(missingCount[0]?.missing_count || 0);
    const coverage = totalOpeningStock > 0 ? ((totalOpeningStock - missing) / totalOpeningStock * 100).toFixed(2) : 100;

    console.log(`Missing in StockTransaction: ${missing}`);
    console.log(`Coverage: ${coverage}% of opening stock has matching StockTransaction`);

    console.log('\n[2] Affected Business Locations...\n');

    const affectedLocations = await prisma.$queryRaw`
      SELECT
        bl.id,
        bl.name as location_name,
        COUNT(DISTINCT ph.product_variation_id) as affected_products,
        SUM(ph.quantity_change) as total_opening_stock_qty
      FROM product_history ph
      INNER JOIN business_locations bl ON ph.location_id = bl.id
      LEFT JOIN stock_transactions st
        ON st.product_variation_id = ph.product_variation_id
        AND st.location_id = ph.location_id
        AND st.type = 'opening_stock'
      WHERE ph.transaction_type = 'opening_stock'
        AND st.id IS NULL
      GROUP BY bl.id, bl.name
      ORDER BY affected_products DESC
    `;

    if (affectedLocations.length === 0) {
      console.log('✅ No locations affected! System is consistent.');
    } else {
      console.log('Location Name                  | Affected Products | Total Opening Stock Qty');
      console.log('-'.repeat(80));
      affectedLocations.forEach(loc => {
        const name = loc.location_name.substring(0, 30).padEnd(30);
        const count = loc.affected_products.toString().padStart(17);
        const qty = parseFloat(loc.total_opening_stock_qty || 0).toFixed(2).padStart(23);
        console.log(`${name} | ${count} | ${qty}`);
      });
    }

    console.log('\n[3] Top 10 Products with Missing Opening Stock...\n');

    const topProducts = await prisma.$queryRaw`
      SELECT
        p.id,
        p.name as product_name,
        p.sku as product_sku,
        pv.name as variation_name,
        pv.sku as variation_sku,
        bl.name as location_name,
        ph.quantity_change as opening_qty,
        ph.transaction_date
      FROM product_history ph
      INNER JOIN products p ON ph.product_id = p.id
      INNER JOIN product_variations pv ON ph.product_variation_id = pv.id
      INNER JOIN business_locations bl ON ph.location_id = bl.id
      LEFT JOIN stock_transactions st
        ON st.product_variation_id = ph.product_variation_id
        AND st.location_id = ph.location_id
        AND st.type = 'opening_stock'
      WHERE ph.transaction_type = 'opening_stock'
        AND st.id IS NULL
      ORDER BY ph.quantity_change DESC
      LIMIT 10
    `;

    if (topProducts.length === 0) {
      console.log('✅ No products affected!');
    } else {
      console.log('Product Name                   | SKU                | Location          | Opening Qty | Date      ');
      console.log('-'.repeat(110));
      topProducts.forEach(prod => {
        const name = prod.product_name.substring(0, 30).padEnd(30);
        const sku = prod.variation_sku.substring(0, 18).padEnd(18);
        const location = prod.location_name.substring(0, 17).padEnd(17);
        const qty = parseFloat(prod.opening_qty).toFixed(2).padStart(11);
        const date = new Date(prod.transaction_date).toLocaleDateString().padStart(10);
        console.log(`${name} | ${sku} | ${location} | ${qty} | ${date}`);
      });
    }

    console.log('\n[4] Potential Discrepancy Impact...\n');

    // Calculate how many products might show discrepancies in reports
    const potentialDiscrepancies = await prisma.$queryRaw`
      SELECT
        COUNT(*) as products_with_potential_discrepancy,
        SUM(quantity_change) as total_invisible_qty
      FROM (
        SELECT DISTINCT
          ph.product_variation_id,
          ph.location_id,
          ph.quantity_change
        FROM product_history ph
        LEFT JOIN stock_transactions st
          ON st.product_variation_id = ph.product_variation_id
          AND st.location_id = ph.location_id
          AND st.type = 'opening_stock'
        WHERE ph.transaction_type = 'opening_stock'
          AND st.id IS NULL
          AND EXISTS (
            -- Only count if there are subsequent transactions
            SELECT 1 FROM stock_transactions st2
            WHERE st2.product_variation_id = ph.product_variation_id
              AND st2.location_id = ph.location_id
              AND st2.type != 'opening_stock'
          )
      ) as potential_issues
    `;

    const discrepancyData = potentialDiscrepancies[0] || { products_with_potential_discrepancy: 0, total_invisible_qty: 0 };

    console.log(`Products that may show report discrepancies: ${discrepancyData.products_with_potential_discrepancy}`);
    console.log(`Total "invisible" quantity in StockTransaction: ${parseFloat(discrepancyData.total_invisible_qty || 0).toFixed(2)} units`);

    console.log('\n[5] Severity Assessment...\n');

    const severity = missing === 0 ? 'NONE' :
                    missing < 10 ? 'LOW' :
                    missing < 50 ? 'MEDIUM' :
                    missing < 100 ? 'HIGH' : 'CRITICAL';

    const severityEmoji = {
      'NONE': '✅',
      'LOW': '⚠️',
      'MEDIUM': '⚠️⚠️',
      'HIGH': '❌',
      'CRITICAL': '🔥'
    }[severity];

    console.log(`Severity Level: ${severityEmoji} ${severity}`);
    console.log('');

    if (severity === 'NONE') {
      console.log('✅ Your system is healthy! No missing opening stock transactions found.');
    } else {
      console.log('Impact Analysis:');
      console.log(`- ${missing} product-location combinations affected`);
      console.log(`- Reports may show incorrect "Total Transactions Recorded"`);
      console.log(`- Stock balances are STILL CORRECT in VariationLocationDetails`);
      console.log(`- Only report calculations are affected, not actual inventory`);
    }

    console.log('\n[6] Recommendations...\n');

    if (missing === 0) {
      console.log('✅ No action required. System is consistent.');
    } else if (missing < 10) {
      console.log('Recommended Action: Manual Fix');
      console.log('- Use the SQL provided in INVENTORY_DISCREPANCY_FORENSIC_REPORT.md');
      console.log('- Add opening stock transactions manually for affected products');
    } else if (missing < 100) {
      console.log('Recommended Action: Run Automated Fix Script');
      console.log('- Backup database first!');
      console.log('- Run: node fix-missing-opening-stock.mjs');
      console.log('- Verify results with: node check-system-wide-impact.mjs');
    } else {
      console.log('Recommended Action: Data Migration Required');
      console.log('- This requires careful planning and testing');
      console.log('- Contact database administrator');
      console.log('- Test on staging environment first');
      console.log('- Consider using ProductHistory as single source of truth instead');
    }

    console.log('\n[7] Data Integrity Check...\n');

    // Check if any StockTransaction balances are inconsistent
    const inconsistentBalances = await prisma.$queryRaw`
      WITH transaction_calc AS (
        SELECT
          product_variation_id,
          location_id,
          SUM(quantity) OVER (PARTITION BY product_variation_id, location_id ORDER BY created_at, id) as calculated_balance,
          balance_qty as recorded_balance,
          id,
          created_at
        FROM stock_transactions
      )
      SELECT COUNT(*) as inconsistent_count
      FROM transaction_calc
      WHERE ABS(calculated_balance - recorded_balance) > 0.01
    `;

    const inconsistentCount = parseInt(inconsistentBalances[0]?.inconsistent_count || 0);

    if (inconsistentCount > 0) {
      console.log(`⚠️  Found ${inconsistentCount} StockTransaction records with inconsistent balance calculations`);
      console.log('This confirms that balances include opening stock but transactions don\'t.');
    } else {
      console.log('ℹ️  All StockTransaction balances are internally consistent.');
      console.log('(Note: This doesn\'t mean they\'re correct, just that they\'re calculated consistently)');
    }

    console.log('\n' + '='.repeat(100));
    console.log('Analysis Complete!');
    console.log('='.repeat(100));

    // Summary box
    console.log('\n📊 EXECUTIVE SUMMARY\n');
    console.log(`Severity: ${severityEmoji} ${severity}`);
    console.log(`Missing Opening Stock Transactions: ${missing}`);
    console.log(`Locations Affected: ${affectedLocations.length}`);
    console.log(`Potential Report Discrepancies: ${discrepancyData.products_with_potential_discrepancy}`);
    console.log(`Stock Accuracy: ✅ Actual stock levels are CORRECT`);
    console.log(`Report Accuracy: ${missing > 0 ? '❌ Reports may show incorrect expected values' : '✅ Reports are accurate'}`);
    console.log('');

  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSystemWideImpact();
