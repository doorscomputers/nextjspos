const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🚀 Testing GRN Direct Entry (assuming already logged in)...\n');

    // Navigate directly to GRN page
    console.log('Step 1: Opening GRN creation page...');
    await page.goto('http://localhost:3000/dashboard/purchases/receipts/new');
    await page.waitForLoadState('networkidle');
    console.log('✅ GRN page loaded\n');

    // Take initial screenshot
    await page.screenshot({ path: 'step1-grn-page-loaded.png', fullPage: true });
    console.log('📸 Screenshot 1: step1-grn-page-loaded.png\n');

    // Click Direct Entry mode
    console.log('Step 2: Clicking Direct Entry button...');
    await page.waitForSelector('button:has-text("Direct Entry")');
    await page.click('button:has-text("Direct Entry")');
    await page.waitForTimeout(1000);
    console.log('✅ Direct Entry clicked\n');

    // Take screenshot after clicking Direct Entry
    await page.screenshot({ path: 'step2-direct-entry-clicked.png', fullPage: true });
    console.log('📸 Screenshot 2: step2-direct-entry-clicked.png\n');

    // Check Supplier dropdown
    console.log('Step 3: Testing Supplier dropdown...');
    const supplierTrigger = page.locator('text=Supplier *').locator('..').locator('button').first();
   await supplierTrigger.waitFor({ state: 'visible', timeout: 5000 });

    const isSupplierEnabled = await supplierTrigger.isEnabled();
    console.log(`   Supplier dropdown enabled: ${isSupplierEnabled}`);

    if (isSupplierEnabled) {
      await supplierTrigger.click();
      await page.waitForTimeout(1000);

      // Count options
      const options = page.locator('[role="option"]');
      const count = await options.count();
      console.log(`   Found ${count} supplier options`);

      if (count > 0) {
        // List all suppliers
        console.log('   Available suppliers:');
        for (let i = 0; i < count; i++) {
          const text = await options.nth(i).textContent();
          console.log(`   ${i + 1}. ${text}`);
        }

        // Select first supplier
        await options.first().click();
        await page.waitForTimeout(500);
        console.log('✅ First supplier selected\n');

        await page.screenshot({ path: 'step3-supplier-selected.png', fullPage: true });
        console.log('📸 Screenshot 3: step3-supplier-selected.png\n');
      } else {
        console.log('❌ No suppliers found in dropdown!\n');
      }
    } else {
      console.log('❌ Supplier dropdown is disabled!\n');
    }

    // Check Location dropdown
    console.log('Step 4: Testing Location dropdown...');
    const locationTrigger = page.locator('text=Location *').locator('..').locator('button').first();
    const isLocationEnabled = await locationTrigger.isEnabled();
    console.log(`   Location dropdown enabled: ${isLocationEnabled}`);

    if (isLocationEnabled) {
      await locationTrigger.click();
      await page.waitForTimeout(1000);

      const locationOptions = page.locator('[role="option"]');
      const locationCount = await locationOptions.count();
      console.log(`   Found ${locationCount} location options`);

      if (locationCount > 0) {
        console.log('   Available locations:');
        for (let i = 0; i < locationCount; i++) {
          const text = await locationOptions.nth(i).textContent();
          console.log(`   ${i + 1}. ${text}`);
        }

        await locationOptions.first().click();
        await page.waitForTimeout(500);
        console.log('✅ First location selected\n');

        await page.screenshot({ path: 'step4-location-selected.png', fullPage: true });
        console.log('📸 Screenshot 4: step4-location-selected.png\n');
      } else {
        console.log('❌ No locations found in dropdown!\n');
      }
    } else {
      console.log('❌ Location dropdown is disabled!\n');
    }

    // Check Add Item button
    console.log('Step 5: Testing Add Item button...');
    const addItemButton = page.locator('button:has-text("Add Item")');
    const isVisible = await addItemButton.isVisible();
    const isEnabled = await addItemButton.isEnabled();
    console.log(`   Add Item button visible: ${isVisible}`);
    console.log(`   Add Item button enabled: ${isEnabled}`);

    if (isEnabled) {
      await addItemButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ Add Item button clicked\n');

      await page.screenshot({ path: 'step5-item-added.png', fullPage: true });
      console.log('📸 Screenshot 5: step5-item-added.png\n');

      // Check if a row was added
      const rows = page.locator('tbody tr');
      const rowCount = await rows.count();
      console.log(`   Table now has ${rowCount} row(s)\n`);
    } else {
      console.log('❌ Add Item button is disabled!\n');
      await page.screenshot({ path: 'step5-add-item-disabled.png', fullPage: true });
      console.log('📸 Screenshot 5: step5-add-item-disabled.png (showing the bug)\n');
    }

    console.log('🎉 Test completed! Browser will stay open for 10 seconds...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
    console.log('📸 Error screenshot: error-screenshot.png');
  } finally {
    await browser.close();
  }
})();
