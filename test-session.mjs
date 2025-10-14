import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable request interception to see cookies
  page.on('response', async (response) => {
    if (response.url().includes('/api/auth')) {
      console.log('Auth API Response:', response.url(), response.status());
      const headers = response.headers();
      if (headers['set-cookie']) {
        console.log('Set-Cookie:', headers['set-cookie']);
      }
    }
  });

  // Go to login page
  await page.goto('http://localhost:3000/login');

  // Fill in credentials
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'password');

  // Click sign in
  await page.click('button[type="submit"]');

  // Wait a bit
  await page.waitForTimeout(2000);

  // Check cookies
  const cookies = await context.cookies();
  console.log('\nCookies after login:');
  cookies.forEach(cookie => {
    console.log(`  ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
  });

  // Try to go to dashboard directly
  await page.goto('http://localhost:3000/dashboard');
  await page.waitForTimeout(2000);

  const finalUrl = page.url();
  console.log('\nFinal URL:', finalUrl);

  if (finalUrl.includes('/dashboard')) {
    console.log('✅ Dashboard accessible!');
  } else {
    console.log('❌ Redirected to:', finalUrl);
  }

  await browser.close();
})();
