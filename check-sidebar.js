const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('Opening application...\n');

    // Try port 3001 first (user's port)
    await page.goto('http://localhost:3001/login');
    await page.waitForTimeout(2000);

    console.log('Please log in manually, then I will check the sidebar...');
    console.log('Press Ctrl+C when done to close browser.\n');

    // Wait for user to login
    await page.waitForTimeout(60000);

  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
