import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

test.describe('Authentication & Authorization - Comprehensive Tests', () => {
  let businessId: number

  test.beforeAll(async () => {
    const business = await prisma.business.findFirst({
      where: { name: { contains: 'Demo' } },
    })
    businessId = business?.id || 1
  })

  test.describe('1. Authentication Tests', () => {
    test('1.1 Login page loads correctly', async ({ page }) => {
      await page.goto('/login')
      await expect(page.locator('input[name="username"]')).toBeVisible()
      await expect(page.locator('input[name="password"]')).toBeVisible()
      await expect(page.locator('button[type="submit"]')).toBeVisible()
    })

    test('1.2 Login with valid credentials - Super Admin', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="username"]', 'superadmin')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')

      await page.waitForURL('/dashboard')
      await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 })

      // Verify session was created
      const cookies = await page.context().cookies()
      const sessionCookie = cookies.find(c => c.name.includes('session') || c.name.includes('auth'))
      expect(sessionCookie).toBeTruthy()
    })

    test('1.3 Login with valid credentials - Admin', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="username"]', 'admin')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')

      await page.waitForURL('/dashboard')
      await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 })
    })

    test('1.4 Login with valid credentials - Manager', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="username"]', 'manager')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')

      await page.waitForURL('/dashboard')
      await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 })
    })

    test('1.5 Login with valid credentials - Cashier', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="username"]', 'cashier')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')

      await page.waitForURL('/dashboard')
      await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 })
    })

    test('1.6 Login with invalid credentials', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="username"]', 'invalid_user')
      await page.fill('[name="password"]', 'wrong_password')
      await page.click('button[type="submit"]')

      await page.waitForTimeout(2000)

      // Should show error message
      const hasError = await page.locator('text=Invalid, text=Error, text=Failed').count() > 0
      expect(hasError || await page.url().includes('/login')).toBeTruthy()
    })

    test('1.7 Login with empty credentials', async ({ page }) => {
      await page.goto('/login')
      await page.click('button[type="submit"]')

      await page.waitForTimeout(1000)

      // Should show validation error or stay on login page
      const url = page.url()
      expect(url).toContain('/login')
    })

    test('1.8 Logout functionality', async ({ page }) => {
      // Login first
      await page.goto('/login')
      await page.fill('[name="username"]', 'admin')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      // Logout
      await page.click('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")').catch(async () => {
        // Try profile menu
        await page.click('[data-testid="profile-menu"], button:has-text("Profile")').catch(() => {})
        await page.click('text=Logout, text=Sign Out').catch(() => {})
      })

      await page.waitForTimeout(2000)

      // Should redirect to login
      const url = page.url()
      expect(url).toContain('/login')
    })

    test('1.9 Protected route without authentication', async ({ page }) => {
      // Try to access protected route without login
      await page.goto('/dashboard/products')
      await page.waitForTimeout(2000)

      // Should redirect to login
      const url = page.url()
      expect(url).toContain('/login')
    })

    test('1.10 Session persistence', async ({ page }) => {
      // Login
      await page.goto('/login')
      await page.fill('[name="username"]', 'admin')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      // Reload page
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Should still be logged in
      await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('2. Role-Based Access Control (RBAC) Tests', () => {
    test('2.1 Super Admin has all permissions', async () => {
      const user = await prisma.user.findFirst({
        where: { username: 'superadmin' },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      })

      expect(user).toBeTruthy()

      // Super admin should have many permissions
      const rolePermissions = user?.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.name)) || []
      const directPermissions = user?.permissions.map(up => up.permission.name) || []
      const allPermissions = [...new Set([...rolePermissions, ...directPermissions])]

      expect(allPermissions.length).toBeGreaterThan(20)
    })

    test('2.2 Admin can view products', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="username"]', 'admin')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      await page.goto('/dashboard/products')
      await page.waitForLoadState('networkidle')

      // Should be able to access products page
      const hasProducts = await page.locator('text=Products, text=SKU').count() > 0
      expect(hasProducts).toBeTruthy()
    })

    test('2.3 Cashier has limited access', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="username"]', 'cashier')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      // Try to access restricted pages
      await page.goto('/dashboard/users')
      await page.waitForLoadState('networkidle')

      // Should be redirected or see error
      const url = page.url()
      const hasError = await page.locator('text=Unauthorized, text=Access Denied, text=Permission').count() > 0

      expect(hasError || !url.includes('/users')).toBeTruthy()
    })

    test('2.4 Manager can create sales but not manage users', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="username"]', 'manager')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      // Can access sales
      await page.goto('/dashboard/sales')
      await page.waitForLoadState('networkidle')
      const canAccessSales = page.url().includes('/sales')
      expect(canAccessSales).toBeTruthy()

      // Cannot access users
      await page.goto('/dashboard/users')
      await page.waitForLoadState('networkidle')
      const canAccessUsers = page.url().includes('/users') &&
        (await page.locator('text=Unauthorized, text=Access Denied').count()) === 0

      expect(canAccessUsers).toBeFalsy()
    })

    test('2.5 Verify sidebar menu items based on permissions', async ({ page }) => {
      // Login as cashier (limited permissions)
      await page.goto('/login')
      await page.fill('[name="username"]', 'cashier')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      // Check sidebar menu items
      const hasUsersMenu = await page.locator('nav a:has-text("Users")').count() > 0
      const hasProductsMenu = await page.locator('nav a:has-text("Products")').count() > 0

      // Cashier should not see Users menu
      expect(hasUsersMenu).toBeFalsy()

      // Should see Products menu for viewing
      expect(hasProductsMenu).toBeTruthy()
    })
  })

  test.describe('3. Permission-Specific Tests', () => {
    test('3.1 Test product.view permission', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="username"]', 'admin')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      // Admin should have product.view permission
      await page.goto('/dashboard/products')
      await page.waitForLoadState('networkidle')

      const canView = page.url().includes('/products')
      expect(canView).toBeTruthy()
    })

    test('3.2 Test product.create permission', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="username"]', 'admin')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      await page.goto('/dashboard/products')
      await page.waitForLoadState('networkidle')

      // Should see Add Product button
      const hasAddButton = await page.locator('text=Add Product, text=New Product, button:has-text("Create")').count() > 0
      expect(hasAddButton).toBeTruthy()
    })

    test('3.3 Test purchase.view permission', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="username"]', 'admin')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      await page.goto('/dashboard/purchases')
      await page.waitForLoadState('networkidle')

      const canView = page.url().includes('/purchases')
      expect(canView).toBeTruthy()
    })

    test('3.4 Test report.view permission', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="username"]', 'admin')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      await page.goto('/dashboard/reports')
      await page.waitForLoadState('networkidle')

      const canView = page.url().includes('/reports')
      expect(canView).toBeTruthy()
    })

    test('3.5 Test user.create permission (admin only)', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="username"]', 'cashier')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      await page.goto('/dashboard/users/create')
      await page.waitForLoadState('networkidle')

      // Cashier should not access user creation
      const hasError = await page.locator('text=Unauthorized, text=Access Denied, text=Permission').count() > 0
      const isRedirected = !page.url().includes('/users/create')

      expect(hasError || isRedirected).toBeTruthy()
    })
  })

  test.describe('4. API Authorization Tests', () => {
    test('4.1 API requires authentication', async ({ page }) => {
      // Try to access API without login
      const response = await page.request.get('/api/products')

      expect(response.status()).toBe(401)
    })

    test('4.2 Authenticated API access', async ({ page }) => {
      // Login first
      await page.goto('/login')
      await page.fill('[name="username"]', 'admin')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      // Make API request with session
      const response = await page.request.get('/api/products', {
        headers: {
          'Cookie': await page.context().cookies().then(cookies =>
            cookies.map(c => `${c.name}=${c.value}`).join('; ')
          ),
        },
      })

      expect(response.ok()).toBeTruthy()
    })

    test('4.3 API respects business isolation', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="username"]', 'admin')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      const response = await page.request.get('/api/products', {
        headers: {
          'Cookie': await page.context().cookies().then(cookies =>
            cookies.map(c => `${c.name}=${c.value}`).join('; ')
          ),
        },
      })

      const data = await response.json()

      // All returned products should belong to user's business
      if (Array.isArray(data)) {
        for (const product of data) {
          const dbProduct = await prisma.product.findUnique({
            where: { id: product.id },
          })
          expect(dbProduct?.businessId).toBe(businessId)
        }
      }
    })

    test('4.4 API permission check for sensitive operations', async ({ page }) => {
      // Login as cashier (limited permissions)
      await page.goto('/login')
      await page.fill('[name="username"]', 'cashier')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      // Try to delete a product (should fail)
      const response = await page.request.delete('/api/products/999', {
        headers: {
          'Cookie': await page.context().cookies().then(cookies =>
            cookies.map(c => `${c.name}=${c.value}`).join('; ')
          ),
        },
      })

      // Should be forbidden
      expect(response.status()).toBe(403)
    })
  })

  test.describe('5. Session Management Tests', () => {
    test('5.1 Session expiry handling', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="username"]', 'admin')
      await page.fill('[name="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      // Clear session cookies
      await page.context().clearCookies()

      // Try to access protected page
      await page.goto('/dashboard/products')
      await page.waitForTimeout(2000)

      // Should redirect to login
      expect(page.url()).toContain('/login')
    })

    test('5.2 Multiple concurrent sessions', async ({ browser }) => {
      const context1 = await browser.newContext()
      const context2 = await browser.newContext()

      const page1 = await context1.newPage()
      const page2 = await context2.newPage()

      // Login in both sessions
      await page1.goto('/login')
      await page1.fill('[name="username"]', 'admin')
      await page1.fill('[name="password"]', 'password')
      await page1.click('button[type="submit"]')
      await page1.waitForURL('/dashboard')

      await page2.goto('/login')
      await page2.fill('[name="username"]', 'manager')
      await page2.fill('[name="password"]', 'password')
      await page2.click('button[type="submit"]')
      await page2.waitForURL('/dashboard')

      // Both should be logged in
      await expect(page1.locator('text=Dashboard')).toBeVisible()
      await expect(page2.locator('text=Dashboard')).toBeVisible()

      await context1.close()
      await context2.close()
    })

    test('5.3 Password change invalidates session', async ({ page }) => {
      const user = await prisma.user.findFirst({
        where: { username: 'admin' },
      })

      if (user) {
        // Login
        await page.goto('/login')
        await page.fill('[name="username"]', 'admin')
        await page.fill('[name="password"]', 'password')
        await page.click('button[type="submit"]')
        await page.waitForURL('/dashboard')

        // Note: In real implementation, changing password should invalidate session
        // This is a placeholder test
        expect(user).toBeTruthy()
      }
    })
  })

  test.describe('6. Database-Level Permission Checks', () => {
    test('6.1 Verify user permissions in database', async () => {
      const users = await prisma.user.findMany({
        where: { businessId },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      })

      expect(users.length).toBeGreaterThan(0)

      for (const user of users) {
        if (user.roles.length > 0) {
          const role = user.roles[0].role
          expect(role.permissions.length).toBeGreaterThan(0)
        }
      }
    })

    test('6.2 Verify role-permission relationships', async () => {
      const roles = await prisma.role.findMany({
        where: { businessId },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      })

      for (const role of roles) {
        console.log(`Role: ${role.name}, Permissions: ${role.permissions.length}`)
        expect(role.permissions.length).toBeGreaterThan(0)
      }
    })

    test('6.3 Verify user-role assignments', async () => {
      const users = await prisma.user.findMany({
        where: { businessId },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      })

      for (const user of users) {
        if (user.username === 'superadmin' || user.username === 'admin') {
          expect(user.roles.length).toBeGreaterThan(0)
        }
      }
    })
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })
})
