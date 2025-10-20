import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const SCREENSHOT_DIR = path.join(process.cwd(), 'dark-mode-screenshots')

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

// Pages to test with their routes
const PAGES_TO_TEST = [
  { name: 'Dashboard Home', route: '/dashboard', selector: 'main' },
  { name: 'Products List', route: '/dashboard/products', selector: 'main' },
  { name: 'Product Categories', route: '/dashboard/products/categories', selector: 'main' },
  { name: 'Product Brands', route: '/dashboard/products/brands', selector: 'main' },
  { name: 'Product Units', route: '/dashboard/products/units', selector: 'main' },
  { name: 'Stock Management', route: '/dashboard/products/stock', selector: 'main' },
  { name: 'Print Labels', route: '/dashboard/products/print-labels', selector: 'main' },
  { name: 'Locations', route: '/dashboard/locations', selector: 'main' },
  { name: 'Suppliers', route: '/dashboard/suppliers', selector: 'main' },
  { name: 'Customers', route: '/dashboard/customers', selector: 'main' },
  { name: 'POS', route: '/dashboard/pos', selector: 'main' },
  { name: 'Purchases', route: '/dashboard/purchases', selector: 'main' },
  { name: 'Sales', route: '/dashboard/sales', selector: 'main' },
  { name: 'Reports Hub', route: '/dashboard/reports', selector: 'main' },
  { name: 'Sales Today Report', route: '/dashboard/reports/sales-today', selector: 'main' },
  { name: 'Sales History Report', route: '/dashboard/reports/sales-history', selector: 'main' },
  { name: 'Sales Journal Report', route: '/dashboard/reports/sales-journal', selector: 'main' },
  { name: 'Sales Per Item Report', route: '/dashboard/reports/sales-per-item', selector: 'main' },
  { name: 'Sales Per Cashier Report', route: '/dashboard/reports/sales-per-cashier', selector: 'main' },
  { name: 'Profitability Report', route: '/dashboard/reports/profitability', selector: 'main' },
  { name: 'Profit Report', route: '/dashboard/reports/profit', selector: 'main' },
  { name: 'Sales Report', route: '/dashboard/reports/sales-report', selector: 'main' },
  { name: 'Purchases Report', route: '/dashboard/reports/purchases-report', selector: 'main' },
  { name: 'Purchases Items Report', route: '/dashboard/reports/purchases-items', selector: 'main' },
  { name: 'Audit Trail', route: '/dashboard/reports/audit-trail', selector: 'main' },
  { name: 'Users', route: '/dashboard/users', selector: 'main' },
  { name: 'Roles', route: '/dashboard/roles', selector: 'main' },
  { name: 'Settings', route: '/dashboard/settings', selector: 'main' },
  { name: 'AI Assistant', route: '/dashboard/ai-assistant', selector: 'main' },
]

test.describe('Dark Mode Contrast Audit', () => {
  test.setTimeout(300000) // 5 minutes for the entire test

  test.beforeEach(async ({ page }) => {
    // Login with superadmin credentials
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    await page.fill('[name="username"]', 'superadmin')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard with longer timeout
    await page.waitForURL('**/dashboard**', { timeout: 30000 })
    await page.waitForTimeout(2000) // Give time for initial load

    // Enable dark mode - look for theme switcher button
    // The theme switcher might be a button with moon/sun icon
    const themeSwitcher = page.locator('[data-testid="theme-switcher"]').or(
      page.locator('button:has-text("Dark")').or(
        page.locator('button[aria-label*="theme" i]').or(
          page.locator('button[aria-label*="dark" i]').or(
            page.locator('button').filter({ hasText: /theme|dark|light/i })
          )
        )
      )
    )

    // Try to find and click theme switcher
    try {
      await themeSwitcher.first().click({ timeout: 3000 })
      await page.waitForTimeout(500) // Wait for theme transition

      // Verify dark mode is active by checking HTML class or data attribute
      const htmlElement = page.locator('html')
      const darkModeActive = await htmlElement.evaluate((el) => {
        return el.classList.contains('dark') ||
               el.getAttribute('data-theme') === 'dark' ||
               document.body.classList.contains('dark')
      })

      if (!darkModeActive) {
        console.log('Dark mode might not be active, trying alternative methods...')
        // Try clicking again or look for dropdown
        const darkOption = page.locator('text=Dark').or(page.locator('[value="dark"]'))
        if (await darkOption.isVisible({ timeout: 2000 })) {
          await darkOption.click()
          await page.waitForTimeout(500)
        }
      }
    } catch (error) {
      console.log('Could not find theme switcher, dark mode might be default or unavailable')
    }
  })

  test('Audit all pages for dark mode contrast issues', async ({ page }) => {
    const results: Array<{
      name: string
      route: string
      status: 'success' | 'error' | 'not-found'
      issue?: string
      screenshot?: string
    }> = []

    for (const pageInfo of PAGES_TO_TEST) {
      console.log(`Testing: ${pageInfo.name} (${pageInfo.route})`)

      try {
        // Navigate to the page
        await page.goto(`http://localhost:3000${pageInfo.route}`, {
          waitUntil: 'networkidle',
          timeout: 15000
        })

        // Wait for main content to load
        try {
          await page.waitForSelector(pageInfo.selector, { timeout: 5000 })
        } catch {
          // If selector not found, wait a bit anyway
          await page.waitForTimeout(2000)
        }

        // Take screenshot
        const screenshotName = `${pageInfo.name.toLowerCase().replace(/\s+/g, '-')}.png`
        const screenshotPath = path.join(SCREENSHOT_DIR, screenshotName)
        await page.screenshot({
          path: screenshotPath,
          fullPage: true
        })

        // Check for common contrast issues
        const contrastIssues = await page.evaluate(() => {
          const issues: string[] = []

          // Get computed styles
          const html = document.documentElement
          const body = document.body
          const isDark = html.classList.contains('dark') ||
                        html.getAttribute('data-theme') === 'dark' ||
                        body.classList.contains('dark')

          if (!isDark) {
            issues.push('Dark mode not active')
          }

          // Check for dark backgrounds with dark text
          const elements = document.querySelectorAll('*')
          let darkOnDarkCount = 0
          let lightOnLightCount = 0

          elements.forEach((el) => {
            const computed = window.getComputedStyle(el)
            const bgColor = computed.backgroundColor
            const textColor = computed.color

            // Parse RGB values
            const bgRGB = bgColor.match(/\d+/g)?.map(Number) || []
            const textRGB = textColor.match(/\d+/g)?.map(Number) || []

            if (bgRGB.length >= 3 && textRGB.length >= 3) {
              // Calculate brightness (simple formula)
              const bgBrightness = (bgRGB[0] * 299 + bgRGB[1] * 587 + bgRGB[2] * 114) / 1000
              const textBrightness = (textRGB[0] * 299 + textRGB[1] * 587 + textRGB[2] * 114) / 1000

              // Dark background + dark text
              if (bgBrightness < 128 && textBrightness < 128 && Math.abs(bgBrightness - textBrightness) < 50) {
                darkOnDarkCount++
              }

              // Light background + light text
              if (bgBrightness > 128 && textBrightness > 128 && Math.abs(bgBrightness - textBrightness) < 50) {
                lightOnLightCount++
              }
            }
          })

          if (darkOnDarkCount > 10) {
            issues.push(`Potential dark-on-dark text (${darkOnDarkCount} elements)`)
          }

          if (lightOnLightCount > 10) {
            issues.push(`Potential light-on-light text (${lightOnLightCount} elements)`)
          }

          return issues
        })

        results.push({
          name: pageInfo.name,
          route: pageInfo.route,
          status: 'success',
          issue: contrastIssues.length > 0 ? contrastIssues.join(', ') : undefined,
          screenshot: screenshotName
        })

        console.log(`✓ ${pageInfo.name} - ${contrastIssues.length > 0 ? 'ISSUES FOUND' : 'OK'}`)

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Check if it's a 404 or page doesn't exist
        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          results.push({
            name: pageInfo.name,
            route: pageInfo.route,
            status: 'not-found',
            issue: 'Page not found (404)'
          })
          console.log(`✗ ${pageInfo.name} - NOT FOUND`)
        } else {
          results.push({
            name: pageInfo.name,
            route: pageInfo.route,
            status: 'error',
            issue: errorMessage
          })
          console.log(`✗ ${pageInfo.name} - ERROR: ${errorMessage}`)
        }
      }

      // Small delay between pages
      await page.waitForTimeout(500)
    }

    // Generate report
    console.log('\n' + '='.repeat(80))
    console.log('DARK MODE CONTRAST AUDIT REPORT')
    console.log('='.repeat(80) + '\n')

    const pagesWithIssues = results.filter(r => r.issue && r.status === 'success')
    const pagesOk = results.filter(r => !r.issue && r.status === 'success')
    const pagesNotFound = results.filter(r => r.status === 'not-found')
    const pagesError = results.filter(r => r.status === 'error')

    if (pagesWithIssues.length > 0) {
      console.log('PAGES WITH DARK MODE ISSUES:')
      pagesWithIssues.forEach((page, idx) => {
        console.log(`${idx + 1}. ${page.route} - ${page.name}`)
        console.log(`   Issue: ${page.issue}`)
        console.log(`   Screenshot: ${page.screenshot}\n`)
      })
    }

    if (pagesOk.length > 0) {
      console.log('\nPAGES WITH GOOD DARK MODE:')
      pagesOk.forEach((page, idx) => {
        console.log(`${idx + 1}. ${page.route} - ${page.name} ✓`)
      })
    }

    if (pagesNotFound.length > 0) {
      console.log('\n\nPAGES NOT FOUND (404):')
      pagesNotFound.forEach((page, idx) => {
        console.log(`${idx + 1}. ${page.route} - ${page.name}`)
      })
    }

    if (pagesError.length > 0) {
      console.log('\n\nPAGES WITH ERRORS:')
      pagesError.forEach((page, idx) => {
        console.log(`${idx + 1}. ${page.route} - ${page.name}`)
        console.log(`   Error: ${page.issue}\n`)
      })
    }

    console.log('\n' + '='.repeat(80))
    console.log(`Total Pages Tested: ${results.length}`)
    console.log(`Pages with Issues: ${pagesWithIssues.length}`)
    console.log(`Pages OK: ${pagesOk.length}`)
    console.log(`Pages Not Found: ${pagesNotFound.length}`)
    console.log(`Pages with Errors: ${pagesError.length}`)
    console.log('='.repeat(80))
    console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`)

    // Write report to file
    const reportPath = path.join(SCREENSHOT_DIR, 'dark-mode-audit-report.txt')
    const reportContent = `
DARK MODE CONTRAST AUDIT REPORT
Generated: ${new Date().toISOString()}
=================================================================================

PAGES WITH DARK MODE ISSUES:
${pagesWithIssues.length > 0 ? pagesWithIssues.map((page, idx) =>
  `${idx + 1}. ${page.route} - ${page.name}\n   Issue: ${page.issue}\n   Screenshot: ${page.screenshot}`
).join('\n\n') : 'None'}

PAGES WITH GOOD DARK MODE:
${pagesOk.length > 0 ? pagesOk.map((page, idx) =>
  `${idx + 1}. ${page.route} - ${page.name} ✓`
).join('\n') : 'None'}

PAGES NOT FOUND (404):
${pagesNotFound.length > 0 ? pagesNotFound.map((page, idx) =>
  `${idx + 1}. ${page.route} - ${page.name}`
).join('\n') : 'None'}

PAGES WITH ERRORS:
${pagesError.length > 0 ? pagesError.map((page, idx) =>
  `${idx + 1}. ${page.route} - ${page.name}\n   Error: ${page.issue}`
).join('\n\n') : 'None'}

=================================================================================
SUMMARY:
Total Pages Tested: ${results.length}
Pages with Issues: ${pagesWithIssues.length}
Pages OK: ${pagesOk.length}
Pages Not Found: ${pagesNotFound.length}
Pages with Errors: ${pagesError.length}

Screenshots saved to: ${SCREENSHOT_DIR}
=================================================================================
`

    fs.writeFileSync(reportPath, reportContent)
    console.log(`\nReport saved to: ${reportPath}`)

    // The test should pass, we're just auditing
    expect(results.length).toBeGreaterThan(0)
  })
})
