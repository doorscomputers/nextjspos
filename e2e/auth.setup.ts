import { test as setup } from '@playwright/test'

setup('authenticate as superadmin', async ({ page }) => {
  // Go to login page
  await page.goto('http://localhost:3003/login')

  // Fill in credentials
  await page.getByLabel(/username/i).fill('superadmin')
  await page.getByLabel(/password/i).fill('password')

  // Click login button
  await page.getByRole('button', { name: /sign in|login/i }).click()

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard**', { timeout: 10000 })

  // Save authentication state
  await page.context().storageState({ path: '.auth/superadmin.json' })

  console.log('✓ Authentication state saved for superadmin')
})
