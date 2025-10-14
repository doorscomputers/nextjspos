import { test, expect } from '@playwright/test'

test('Simple login test', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login')

  // Take screenshot of login page
  await page.screenshot({ path: 'login-page.png' })

  // Fill credentials
  await page.locator('#username').fill('admin')
  await page.locator('#password').fill('password')

  // Take screenshot after filling
  await page.screenshot({ path: 'login-filled.png' })

  // Click submit
  await page.click('button[type="submit"]')

  // Wait a bit
  await page.waitForTimeout(3000)

  // Take screenshot of result
  await page.screenshot({ path: 'login-after-submit.png' })

  // Check URL
  console.log('Current URL:', page.url())

  // Check for any error messages
  const errorElement = await page.locator('text=/Login failed/').count()
  console.log('Error messages found:', errorElement)
})
