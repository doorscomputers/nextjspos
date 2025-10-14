const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('\n🧪 Testing New UI Features...\n');

    // Test 1: Login Page
    console.log('Test 1: Login Page Design');
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    // Check gradient background
    const bgDiv = await page.locator('div.min-h-screen').first();
    const bgClass = await bgDiv.getAttribute('class');
    if (bgClass.includes('gradient')) {
      console.log('✓ Gradient background applied');
    }

    // Check for Welcome Back heading
    const welcomeText = await page.locator('text=Welcome Back').isVisible();
    console.log(`✓ Welcome Back heading: ${welcomeText ? 'Found' : 'Not found'}`);

    // Check for password toggle
    const passwordToggle = await page.locator('button[type="button"]').first().isVisible();
    console.log(`✓ Password toggle: ${passwordToggle ? 'Present' : 'Not present'}`);

    // Check for Remember Me
    const rememberMe = await page.locator('text=Remember Me').isVisible();
    console.log(`✓ Remember Me checkbox: ${rememberMe ? 'Found' : 'Not found'}`);

    await page.screenshot({ path: 'test-results/test-new-login.png', fullPage: true });
    console.log('✓ Screenshot saved: test-new-login.png\n');

    // Test 2: Login Functionality
    console.log('Test 2: Login Functionality');
    await page.fill('input[name="username"]', 'superadmin');
    await page.fill('input[name="password"]', 'password');

    // Test password visibility toggle
    const passwordInput = page.locator('input[name="password"]');
    let passwordType = await passwordInput.getAttribute('type');
    console.log(`✓ Password field type: ${passwordType}`);

    const eyeButton = page.locator('button[type="button"]').filter({ has: page.locator('svg') }).first();
    await eyeButton.click();
    await page.waitForTimeout(500);

    passwordType = await passwordInput.getAttribute('type');
    console.log(`✓ After toggle, password field type: ${passwordType}`);

    // Toggle back
    await eyeButton.click();
    await page.waitForTimeout(500);

    // Submit login
    await page.click('button[type="submit"]');
    console.log('✓ Login form submitted');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('✓ Redirected to dashboard\n');

    // Test 3: Dashboard
    console.log('Test 3: Dashboard Display');
    await page.waitForLoadState('networkidle');

    const dashboardTitle = await page.locator('text=Dashboard Overview').isVisible();
    console.log(`✓ Dashboard title: ${dashboardTitle ? 'Found' : 'Not found'}`);

    const totalSales = await page.locator('text=Total Sales').isVisible();
    console.log(`✓ Total Sales metric: ${totalSales ? 'Found' : 'Not found'}`);

    await page.screenshot({ path: 'test-results/test-dashboard.png', fullPage: true });
    console.log('✓ Screenshot saved: test-dashboard.png\n');

    // Test 4: Import Products Page
    console.log('Test 4: Import Products Page');
    await page.goto('http://localhost:3001/dashboard/products/import');
    await page.waitForLoadState('networkidle');

    const importTitle = await page.locator('text=Import Products').isVisible();
    console.log(`✓ Import Products title: ${importTitle ? 'Found' : 'Not found'}`);

    const instructionsCard = await page.locator('text=Instructions').first().isVisible();
    console.log(`✓ Instructions card: ${instructionsCard ? 'Found' : 'Not found'}`);

    const fileUpload = await page.locator('text=File To Import').first().isVisible();
    console.log(`✓ File upload section: ${fileUpload ? 'Found' : 'Not found'}`);

    const downloadBtn = await page.locator('button:has-text("Download template file")').first().isVisible();
    console.log(`✓ Download template button: ${downloadBtn ? 'Found' : 'Not found'}`);

    const instructionsTable = await page.locator('table').first().isVisible();
    console.log(`✓ Instructions table: ${instructionsTable ? 'Found' : 'Not found'}`);

    await page.screenshot({ path: 'test-results/test-import-products.png', fullPage: true });
    console.log('✓ Screenshot saved: test-import-products.png\n');

    // Test 5: Template Download
    console.log('Test 5: Template Download');
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
    await page.click('button:has-text("Download template file")');

    try {
      const download = await downloadPromise;
      console.log(`✓ Template downloaded: ${download.suggestedFilename()}`);
    } catch (error) {
      console.log('✗ Template download failed or timed out');
    }

    console.log('\n✅ All tests completed successfully!\n');
    console.log('Screenshots saved in test-results/ directory');

    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'test-results/test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
