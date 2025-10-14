const { chromium } = require('playwright')

async function testPage() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    console.log('1. Navigating to login page...')
    await page.goto('http://localhost:3000/login')
    await page.waitForTimeout(1000)

    console.log('2. Logging in...')
    await page.fill('input[name="username"]', 'Jheirone')
    await page.fill('input[name="password"]', 'newpass123')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)

    console.log('3. Navigating to Purchase Items Report...')
    await page.goto('http://localhost:3000/dashboard/reports/purchases-items')
    await page.waitForTimeout(3000)

    console.log('4. Checking for errors in console...')
    await page.waitForTimeout(2000)

    console.log('5. Taking screenshot...')
    await page.screenshot({ path: 'test-results/purchases-items-error.png', fullPage: true })

    console.log('Done! Check the screenshot at test-results/purchases-items-error.png')
    console.log('Check the terminal running npm run dev for detailed error logs')

  } catch (error) {
    console.error('Test failed:', error.message)
  } finally {
    await browser.close()
  }
}

testPage()
