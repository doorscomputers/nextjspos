const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  // Track API responses and console logs
  const apiResponses = []
  const consoleLogs = []

  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`)
  })

  page.on('response', async response => {
    const url = response.url()
    if (url.includes('/api/')) {
      const status = response.status()
      let body = null
      try {
        body = await response.json()
      } catch (e) {
        try {
          body = await response.text()
        } catch (e2) {
          body = 'Unable to read response body'
        }
      }
      apiResponses.push({ url, status, body })
      console.log(`\n[API] ${url}`)
      console.log(`Status: ${status}`)
      if (typeof body === 'string') {
        console.log(`Body: ${body}`)
      } else {
        console.log(`Body:`, JSON.stringify(body, null, 2))
      }
    }
  })

  try {
    console.log('1. Going to login page...')
    await page.goto('http://localhost:3005/login')

    console.log('2. Logging in as branchmanager...')
    await page.fill('input[name="username"]', 'branchmanager')
    await page.fill('input[name="password"]', '111111')
    await page.click('button[type="submit"]')

    console.log('3. Waiting for dashboard...')
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    console.log('4. Going to inventory corrections page...')
    await page.goto('http://localhost:3005/dashboard/inventory-corrections/new')
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    console.log('5. Finding barcode input...')
    const barcodeInput = await page.locator('input[placeholder*="Scan barcode"]').first()

    console.log('6. Entering SKU PCI-0002...')
    await barcodeInput.fill('PCI-0002')

    console.log('7. Pressing Enter...')
    await barcodeInput.press('Enter')

    console.log('8. Waiting for API responses...')
    await page.waitForTimeout(5000)

    console.log('\n=== System Count Field ===')
    const systemCountInput = await page.locator('input#systemCount').first()
    const systemCountValue = await systemCountInput.inputValue()
    console.log('System count value:', systemCountValue)

    console.log('\n=== Screenshot ===')
    await page.screenshot({ path: 'test-barcode-result.png', fullPage: true })
    console.log('Screenshot saved to: test-barcode-result.png')

    console.log('\n=== Console Logs ===')
    consoleLogs.forEach(log => console.log(log))

    console.log('\n=== Summary ===')
    console.log(`Total API calls: ${apiResponses.length}`)
    console.log(`System count populated: ${systemCountValue !== '' && systemCountValue !== '—'}`)

  } catch (error) {
    console.error('Error:', error)
    await page.screenshot({ path: 'test-barcode-error.png', fullPage: true })
  } finally {
    await browser.close()
  }
}

main()
