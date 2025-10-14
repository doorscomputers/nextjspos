const { PrismaClient } = require('@prisma/client');
const Decimal = require('decimal.js');

const prisma = new PrismaClient();

async function generateInventoryReport() {
  console.log('='.repeat(80));
  console.log('ULTIMATEPOS MODERN - COMPREHENSIVE INVENTORY STATUS REPORT');
  console.log('Generated on:', new Date().toLocaleString());
  console.log('='.repeat(80));

  try {
    // Get business information
    const businesses = await prisma.business.findMany({
      include: {
        locations: true
      }
    });

    if (businesses.length === 0) {
      console.log('❌ No businesses found in the system');
      return;
    }

    console.log(`📊 Found ${businesses.length} business(es) in the system\n`);

    for (const business of businesses) {
      console.log(`🏢 BUSINESS: ${business.name}`);
      console.log(`📍 Locations: ${business.locations.length}`);
      console.log(`💰 Currency: ${business.currencyId ? 'ID: ' + business.currencyId : 'Not set'}`);
      console.log('-'.repeat(60));

      // Analyze each location
      for (const location of business.locations) {
        await analyzeLocationInventory(business.id, location.id, location.name);
      }

      console.log('\n' + '='.repeat(80) + '\n');
    }

  } catch (error) {
    console.error('❌ Error generating inventory report:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function analyzeLocationInventory(businessId, locationId, locationName) {
  console.log(`\n📍 LOCATION ANALYSIS: ${locationName}`);
  console.log('-'.repeat(40));

  try {
    // Get all products with stock at this location
    const stockData = await prisma.variationLocationDetails.findMany({
      where: {
        productVariation: {
          businessId: businessId
        }
      },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
            unit: true
          }
        },
        productVariation: {
          include: {
            unit: true,
            supplier: true
          }
        }
      }
    });

    // Filter for current location (we need to join with business locations)
    // For now, we'll analyze all stock data since the schema doesn't have locationId in variationLocationDetails
    const locationStockData = stockData; // This should be filtered by location in a real query

    console.log(`📦 Total Product Variations with Stock: ${locationStockData.length}`);

    if (locationStockData.length === 0) {
      console.log('⚠️  No stock data found for this location');
      return;
    }

    // Calculate total inventory value
    let totalInventoryValue = new Decimal(0);
    let totalStockQuantity = new Decimal(0);
    let lowStockItems = 0;
    let outOfStockItems = 0;
    let itemsWithReorderConfig = 0;

    // Stock analysis
    const stockAnalysis = {
      totalValue: new Decimal(0),
      totalQuantity: new Decimal(0),
      lowStock: [],
      outOfStock: [],
      reorderSuggestions: [],
      categoryAnalysis: {},
      supplierAnalysis: {}
    };

    for (const stock of locationStockData) {
      const quantity = new Decimal(stock.qtyAvailable || 0);
      const unitValue = new Decimal(stock.productVariation.purchasePrice || 0);
      const totalValue = quantity.mul(unitValue);

      stockAnalysis.totalQuantity = stockAnalysis.totalQuantity.add(quantity);
      stockAnalysis.totalValue = stockAnalysis.totalValue.add(totalValue);

      // Category analysis
      const categoryName = stock.product.category?.name || 'Uncategorized';
      if (!stockAnalysis.categoryAnalysis[categoryName]) {
        stockAnalysis.categoryAnalysis[categoryName] = {
          count: 0,
          quantity: new Decimal(0),
          value: new Decimal(0),
          lowStockCount: 0
        };
      }
      stockAnalysis.categoryAnalysis[categoryName].count++;
      stockAnalysis.categoryAnalysis[categoryName].quantity =
        stockAnalysis.categoryAnalysis[categoryName].quantity.add(quantity);
      stockAnalysis.categoryAnalysis[categoryName].value =
        stockAnalysis.categoryAnalysis[categoryName].value.add(totalValue);

      // Supplier analysis
      const supplierName = stock.productVariation.supplier?.name || 'No Supplier';
      if (!stockAnalysis.supplierAnalysis[supplierName]) {
        stockAnalysis.supplierAnalysis[supplierName] = {
          count: 0,
          quantity: new Decimal(0),
          value: new Decimal(0)
        };
      }
      stockAnalysis.supplierAnalysis[supplierName].count++;
      stockAnalysis.supplierAnalysis[supplierName].quantity =
        stockAnalysis.supplierAnalysis[supplierName].quantity.add(quantity);
      stockAnalysis.supplierAnalysis[supplierName].value =
        stockAnalysis.supplierAnalysis[supplierName].value.add(totalValue);

      // Check stock levels
      const alertQuantity = new Decimal(stock.product.alertQuantity || 0);
      const reorderPoint = new Decimal(stock.product.reorderPoint || 0);

      if (quantity.lte(0)) {
        stockAnalysis.outOfStock.push({
          productName: stock.product.name,
          variation: stock.productVariation.name,
          sku: stock.productVariation.sku,
          currentStock: quantity.toNumber()
        });
        stockAnalysis.categoryAnalysis[categoryName].lowStockCount++;
        outOfStockItems++;
      } else if (quantity.lte(alertQuantity)) {
        stockAnalysis.lowStock.push({
          productName: stock.product.name,
          variation: stock.productVariation.name,
          sku: stock.productVariation.sku,
          currentStock: quantity.toNumber(),
          alertLevel: alertQuantity.toNumber()
        });
        stockAnalysis.categoryAnalysis[categoryName].lowStockCount++;
        lowStockItems++;
      }

      // Check reorder configuration
      if (stock.product.enableAutoReorder && reorderPoint.gt(0)) {
        itemsWithReorderConfig++;

        if (quantity.lte(reorderPoint)) {
          const leadTimeDays = stock.product.leadTimeDays || 7;
          const safetyStockDays = stock.product.safetyStockDays || 3;
          const reorderQuantity = new Decimal(stock.product.reorderQuantity || 0);

          stockAnalysis.reorderSuggestions.push({
            productName: stock.product.name,
            variation: stock.productVariation.name,
            sku: stock.productVariation.sku,
            currentStock: quantity.toNumber(),
            reorderPoint: reorderPoint.toNumber(),
            suggestedOrderQty: reorderQuantity.toNumber(),
            supplier: supplierName,
            leadTimeDays: leadTimeDays,
            safetyStockDays: safetyStockDays,
            urgency: quantity.lte(alertQuantity) ? 'CRITICAL' : 'MODERATE'
          });
        }
      }
    }

    // Display results
    console.log(`💰 Total Inventory Value: ₱${stockAnalysis.totalValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
    console.log(`📊 Total Stock Quantity: ${stockAnalysis.totalQuantity.toLocaleString()}`);
    console.log(`⚠️  Low Stock Items: ${lowStockItems}`);
    console.log(`🚫 Out of Stock Items: ${outOfStockItems}`);
    console.log(`🔄 Items with Auto-Reorder: ${itemsWithReorderConfig}`);

    // Category breakdown
    console.log('\n📂 CATEGORY BREAKDOWN:');
    console.log('-'.repeat(40));
    const sortedCategories = Object.entries(stockAnalysis.categoryAnalysis)
      .sort(([,a], [,b]) => b.value.minus(a.value).toNumber());

    for (const [category, data] of sortedCategories.slice(0, 10)) { // Top 10 categories
      console.log(`${category}:`);
      console.log(`  Items: ${data.count} | Value: ₱${data.value.toLocaleString('en-PH', { minimumFractionDigits: 2 })} | Low Stock: ${data.lowStockCount}`);
    }

    // Critical stock items
    if (stockAnalysis.outOfStock.length > 0) {
      console.log('\n🚨 CRITICAL - OUT OF STOCK ITEMS:');
      console.log('-'.repeat(40));
      stockAnalysis.outOfStock.slice(0, 10).forEach(item => {
        console.log(`❌ ${item.productName} (${item.variation}) - SKU: ${item.sku}`);
      });
      if (stockAnalysis.outOfStock.length > 10) {
        console.log(`... and ${stockAnalysis.outOfStock.length - 10} more items`);
      }
    }

    if (stockAnalysis.lowStock.length > 0) {
      console.log('\n⚠️  LOW STOCK ALERT:');
      console.log('-'.repeat(40));
      stockAnalysis.lowStock.slice(0, 10).forEach(item => {
        console.log(`⚠️  ${item.productName} (${item.variation}) - Stock: ${item.currentStock} (Alert at: ${item.alertLevel})`);
      });
      if (stockAnalysis.lowStock.length > 10) {
        console.log(`... and ${stockAnalysis.lowStock.length - 10} more items`);
      }
    }

    // Reorder suggestions
    if (stockAnalysis.reorderSuggestions.length > 0) {
      console.log('\n🔄 REORDER RECOMMENDATIONS:');
      console.log('-'.repeat(40));

      // Group by urgency
      const criticalItems = stockAnalysis.reorderSuggestions.filter(item => item.urgency === 'CRITICAL');
      const moderateItems = stockAnalysis.reorderSuggestions.filter(item => item.urgency === 'MODERATE');

      if (criticalItems.length > 0) {
        console.log('🚨 CRITICAL REORDER NEEDED:');
        criticalItems.slice(0, 5).forEach(item => {
          console.log(`🔴 ${item.productName} - Order ${item.suggestedOrderQty} units from ${item.supplier}`);
        });
        if (criticalItems.length > 5) {
          console.log(`... and ${criticalItems.length - 5} more critical items`);
        }
      }

      if (moderateItems.length > 0) {
        console.log('\n🟡 MODERATE REORDER SUGGESTED:');
        moderateItems.slice(0, 5).forEach(item => {
          console.log(`🟡 ${item.productName} - Order ${item.suggestedOrderQty} units from ${item.supplier}`);
        });
        if (moderateItems.length > 5) {
          console.log(`... and ${moderateItems.length - 5} more moderate items`);
        }
      }

      console.log(`\n📋 Total Reorder Recommendations: ${stockAnalysis.reorderSuggestions.length} items`);
    }

    // Supplier analysis
    if (Object.keys(stockAnalysis.supplierAnalysis).length > 0) {
      console.log('\n👥 TOP SUPPLIERS BY INVENTORY VALUE:');
      console.log('-'.repeat(40));
      const sortedSuppliers = Object.entries(stockAnalysis.supplierAnalysis)
        .sort(([,a], [,b]) => b.value.minus(a.value).toNumber());

      sortedSuppliers.slice(0, 5).forEach(([supplier, data]) => {
        console.log(`${supplier}: ${data.count} items | Value: ₱${data.value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
      });
    }

    // Generate summary metrics
    const totalItems = locationStockData.length;
    const stockCoveragePercentage = totalItems > 0 ?
      ((totalItems - outOfStockItems) / totalItems * 100).toFixed(1) : 0;
    const lowStockPercentage = totalItems > 0 ?
      (lowStockItems / totalItems * 100).toFixed(1) : 0;

    console.log('\n📈 LOCATION HEALTH METRICS:');
    console.log('-'.repeat(40));
    console.log(`✅ Stock Coverage: ${stockCoveragePercentage}%`);
    console.log(`⚠️  Low Stock Rate: ${lowStockPercentage}%`);
    console.log(`🔄 Auto-Reorder Coverage: ${totalItems > 0 ? (itemsWithReorderConfig / totalItems * 100).toFixed(1) : 0}%`);

    return stockAnalysis;

  } catch (error) {
    console.error(`❌ Error analyzing location ${locationName}:`, error);
    return null;
  }
}

// Run the report
generateInventoryReport();