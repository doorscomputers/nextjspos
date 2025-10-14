import { test as setup } from '@playwright/test'

setup('authenticate as warehouse manager', async ({ page }) => {
  // Go to login page
  await page.goto('http://localhost:3003/login')

  // Fill in credentials - use cashier who has access to single location
  await page.getByLabel(/username/i).fill('cashier')
  await page.getByLabel(/password/i).fill('password')

  // Click login button
  await page.getByRole('button', { name: /sign in|login/i }).click()

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard**', { timeout: 10000 })

  // Save authentication state
  await page.context().storageState({ path: '.auth/cashier.json' })

  console.log('✓ Authentication state saved for cashier (single location access)')
})
