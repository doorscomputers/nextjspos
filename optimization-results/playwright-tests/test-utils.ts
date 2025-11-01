import { test, expect } from '@playwright/test'

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const TEST_USER = {
  username: 'admin',
  password: 'password'
}

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  firstPaint: 1500, // 1.5 seconds
  loadTime: 3000,   // 3 seconds
  interactionTime: 1000 // 1 second
}

// Common test utilities
class TestUtils {
  static async login(page) {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="username"]', TEST_USER.username)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**')
  }

  static async measurePerformance(page, action) {
    const startTime = Date.now()
    await action()
    const endTime = Date.now()
    return endTime - startTime
  }

  static async getFirstPaintTime(page) {
    return await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const paintEntry = entries.find(entry => entry.name === 'first-paint')
          if (paintEntry) {
            resolve(paintEntry.startTime)
          }
        })
        observer.observe({ entryTypes: ['paint'] })
      })
    })
  }

  static async waitForDataLoad(page, selector = '[data-testid="loading"]') {
    // Wait for loading indicator to disappear
    await page.waitForSelector(selector, { state: 'hidden', timeout: 10000 })
    // Wait a bit more for data to be fully rendered
    await page.waitForTimeout(500)
  }
}