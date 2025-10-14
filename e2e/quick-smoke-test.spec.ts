/**
 * QUICK SMOKE TEST - UltimatePOS Modern
 * Quick verification of key functionality
 */

import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

test.describe('Quick Smoke Tests', () => {
  test('Home page loads', async ({ page }) => {
    await page.goto(BASE_URL)
    await expect(page).toHaveURL(/login|dashboard/)
  })

  test('Login page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)

    // Wait for page to load completely
    await page.waitForLoadState('domcontentloaded')

    // Check for login form elements
    const usernameInput = page.locator('input[name="username"]')
    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.locator('button[type="submit"]')

    // Give it extra time to render
    await expect(usernameInput).toBeVisible({ timeout: 15000 })
    await expect(passwordInput).toBeVisible({ timeout: 15000 })
    await expect(submitButton).toBeVisible({ timeout: 15000 })
  })

  test('Can fill login form', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('domcontentloaded')

    const usernameInput = page.locator('input[name="username"]')
    const passwordInput = page.locator('input[name="password"]')

    await usernameInput.waitFor({ state: 'visible', timeout: 15000 })
    await usernameInput.fill('admin')
    await passwordInput.fill('password')

    const usernameValue = await usernameInput.inputValue()
    expect(usernameValue).toBe('admin')
  })
})
