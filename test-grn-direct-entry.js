const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🚀 Starting GRN Direct Entry Test...\n');

    // Step 1: Login
    console.log('Step 1: Logging in...');
    await page.goto('http://localhost:3000');
    await page.waitForSelector('#username');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Logged in successfully\n');

    // Step 2: Navigate to GRN creation
    console.log('Step 2: Navigating to GRN creation...');
    await page.goto('http://localhost:3000/dashboard/purchases/receipts/new');
    await page.waitForLoadState('networkidle');
    console.log('✅ GRN page loaded\n');

    // Step 3: Click Direct Entry mode
    console.log('Step 3: Switching to Direct Entry mode...');
    const directEntryButton = page.locator('button:has-text("Direct Entry")');
    await directEntryButton.click();
    await page.waitForTimeout(1000);
    console.log('✅ Direct Entry mode selected\n');

    // Step 4: Check if Supplier dropdown is visible and enabled
    console.log('Step 4: Checking Supplier dropdown...');
    const supplierSelect = page.locator('text=Supplier').locator('..').locator('button');
    const isSupplierVisible = await supplierSelect.isVisible();
    const isSupplierEnabled = await supplierSelect.isEnabled();
    console.log(`   Supplier dropdown visible: ${isSupplierVisible}`);
    console.log(`   Supplier dropdown enabled: ${isSupplierEnabled}`);

    // Step 5: Try to click supplier dropdown
    console.log('\nStep 5: Clicking Supplier dropdown...');
    await supplierSelect.click();
    await page.waitForTimeout(1000);

    // Check if dropdown opened
    const supplierOptions = page.locator('[role="option"]');
    const optionCount = await supplierOptions.count();
    console.log(`   Dropdown opened with ${optionCount} options`);

    if (optionCount > 0) {
      console.log('   Supplier options:');
      for (let i = 0; i < Math.min(optionCount, 5); i++) {
        const optionText = await supplierOptions.nth(i).textContent();
        console.log(`   - ${optionText}`);
      }

      // Select first supplier
      await supplierOptions.first().click();
      await page.waitForTimeout(500);
      console.log('✅ Supplier selected\n');
    } else {
      console.log('❌ No supplier options found!\n');
    }

    // Step 6: Check Location dropdown
    console.log('Step 6: Checking Location dropdown...');
    const locationSelect = page.locator('text=Location').locator('..').locator('button').first();
    const isLocationVisible = await locationSelect.isVisible();
    const isLocationEnabled = await locationSelect.isEnabled();
    console.log(`   Location dropdown visible: ${isLocationVisible}`);
    console.log(`   Location dropdown enabled: ${isLocationEnabled}`);

    await locationSelect.click();
    await page.waitForTimeout(1000);

    const locationOptions = page.locator('[role="option"]');
    const locationCount = await locationOptions.count();
    console.log(`   Dropdown opened with ${locationCount} options`);

    if (locationCount > 0) {
      console.log('   Location options:');
      for (let i = 0; i < locationCount; i++) {
        const optionText = await locationOptions.nth(i).textContent();
        console.log(`   - ${optionText}`);
      }

      // Select first location
      await locationOptions.first().click();
      await page.waitForTimeout(500);
      console.log('✅ Location selected\n');
    } else {
      console.log('❌ No location options found!\n');
    }

    // Step 7: Check Add Item button
    console.log('Step 7: Checking Add Item button...');
    const addItemButton = page.locator('button:has-text("Add Item")');
    const isAddItemVisible = await addItemButton.isVisible();
    const isAddItemEnabled = await addItemButton.isEnabled();
    console.log(`   Add Item button visible: ${isAddItemVisible}`);
    console.log(`   Add Item button enabled: ${isAddItemEnabled}`);

    if (isAddItemEnabled) {
      console.log('\n✅ Add Item button is now enabled! Clicking it...');
      await addItemButton.click();
      await page.waitForTimeout(1000);

      // Check if product row appeared
      const productRows = page.locator('tbody tr');
      const rowCount = await productRows.count();
      console.log(`   Product rows in table: ${rowCount}`);

      if (rowCount > 0) {
        console.log('✅ Item row added successfully!\n');

        // Take screenshot
        await page.screenshot({ path: 'grn-direct-entry-success.png', fullPage: true });
        console.log('📸 Screenshot saved: grn-direct-entry-success.png\n');
      }
    } else {
      console.log('❌ Add Item button is still disabled after selecting supplier/location\n');

      // Take screenshot of the issue
      await page.screenshot({ path: 'grn-direct-entry-bug.png', fullPage: true });
      console.log('📸 Screenshot saved: grn-direct-entry-bug.png\n');
    }

    console.log('🎉 Test completed!');
    console.log('\nWaiting 5 seconds before closing browser...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ Error during test:', error.message);
    await page.screenshot({ path: 'grn-error.png', fullPage: true });
    console.log('📸 Error screenshot saved: grn-error.png');
  } finally {
    await browser.close();
  }
})();
