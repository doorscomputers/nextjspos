import { test, expect } from '@playwright/test'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pcinet.shop'

test.describe('Menu Permissions System', () => {

  test('Check All Branch Admin menu permissions and visibility', async ({ page }) => {
    // Step 1: Login as superadmin to check Menu Permissions page
    console.log('🔐 Logging in as superadmin...')
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="username"]', 'superadmin')
    await page.fill('input[name="password"]', 'Sss999....')
    await page.click('button[type="submit"]')

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard**', { timeout: 10000 })
    console.log('✅ Superadmin logged in')

    // Step 2: Navigate to Menu Permissions
    console.log('📋 Navigating to Menu Permissions...')
    await page.goto(`${BASE_URL}/dashboard/settings/menu-permissions`)
    await page.waitForLoadState('networkidle')

    // Step 3: Select "All Branch Admin" role
    console.log('🎯 Selecting All Branch Admin role...')

    // Find and click the "All Branch Admin" row in the DataGrid
    await page.locator('text=All Branch Admin').first().click()
    await page.waitForTimeout(2000) // Wait for menus to load

    // Step 4: Check how many menus are displayed
    const menuCheckboxes = await page.locator('input[type="checkbox"]').count()
    console.log(`📊 Found ${menuCheckboxes} checkboxes on page`)

    // Count how many are checked
    const checkedBoxes = await page.locator('input[type="checkbox"]:checked').count()
    console.log(`✅ ${checkedBoxes} checkboxes are CHECKED`)
    console.log(`❌ ${menuCheckboxes - checkedBoxes} checkboxes are UNCHECKED`)

    // Step 5: Check the menu count badge
    const menuCountText = await page.locator('text=/\\d+ of \\d+ menus enabled/').first().textContent()
    console.log(`📈 Menu count display: ${menuCountText}`)

    // Step 6: Take screenshot for verification
    await page.screenshot({
      path: 'tests/screenshots/all-branch-admin-menus.png',
      fullPage: true
    })
    console.log('📸 Screenshot saved: tests/screenshots/all-branch-admin-menus.png')

    // Logout
    await page.click('text=My Profile')
    await page.click('text=Logout')
    console.log('👋 Superadmin logged out')
  })

  test('Check pcinetadmin sidebar menus', async ({ page }) => {
    // Login as pcinetadmin
    console.log('🔐 Logging in as pcinetadmin...')
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="username"]', 'pcinetadmin')
    await page.fill('input[name="password"]', '111111')
    await page.click('button[type="submit"]')

    // Wait for dashboard
    await page.waitForURL('**/dashboard**', { timeout: 10000 })
    console.log('✅ pcinetadmin logged in')

    // Wait for sidebar to render
    await page.waitForTimeout(2000)

    // Count visible menu items in sidebar
    const sidebarMenus = await page.locator('aside nav a, aside nav button').allTextContents()
    console.log(`\n📋 Sidebar Menus Visible to pcinetadmin:`)
    console.log('=' .repeat(50))
    sidebarMenus.forEach((menu, idx) => {
      console.log(`  ${idx + 1}. ${menu.trim()}`)
    })
    console.log(`\nTotal: ${sidebarMenus.length} menus`)

    // Check if specific menus are visible
    const hasAccounting = sidebarMenus.some(m => m.includes('Accounting'))
    const hasAdministration = sidebarMenus.some(m => m.includes('Administration'))
    const hasTechnicalServices = sidebarMenus.some(m => m.includes('Technical Services'))
    const hasHRAttendance = sidebarMenus.some(m => m.includes('HR & Attendance'))

    console.log('\n🔍 Specific Menu Checks:')
    console.log(`  Accounting: ${hasAccounting ? '✅ VISIBLE' : '❌ HIDDEN'}`)
    console.log(`  Administration: ${hasAdministration ? '✅ VISIBLE' : '❌ HIDDEN'}`)
    console.log(`  Technical Services: ${hasTechnicalServices ? '✅ VISIBLE' : '❌ HIDDEN'}`)
    console.log(`  HR & Attendance: ${hasHRAttendance ? '✅ VISIBLE' : '❌ HIDDEN'}`)

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/pcinetadmin-sidebar.png',
      fullPage: true
    })
    console.log('\n📸 Screenshot saved: tests/screenshots/pcinetadmin-sidebar.png')
  })

  test('Modify All Branch Admin menus and verify changes', async ({ page }) => {
    // Step 1: Login as superadmin
    console.log('🔐 Logging in as superadmin...')
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="username"]', 'superadmin')
    await page.fill('input[name="password"]', 'Sss999....')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 10000 })

    // Step 2: Go to Menu Permissions
    console.log('📋 Navigating to Menu Permissions...')
    await page.goto(`${BASE_URL}/dashboard/settings/menu-permissions`)
    await page.waitForLoadState('networkidle')

    // Step 3: Select "All Branch Admin"
    await page.locator('text=All Branch Admin').first().click()
    await page.waitForTimeout(2000)

    // Step 4: Find and uncheck "Accounting" and "Administration"
    console.log('⚙️ Unchecking Accounting and Administration menus...')

    // Find the Accounting parent menu checkbox
    const accountingSection = page.locator('div').filter({ hasText: /^Accounting$/ }).first()
    const accountingCheckbox = accountingSection.locator('input[type="checkbox"]').first()

    if (await accountingCheckbox.isChecked()) {
      await accountingCheckbox.click()
      console.log('  ❌ Unchecked Accounting')
    } else {
      console.log('  ⚠️ Accounting was already unchecked')
    }

    // Find the Administration parent menu checkbox
    const administrationSection = page.locator('div').filter({ hasText: /^Administration$/ }).first()
    const administrationCheckbox = administrationSection.locator('input[type="checkbox"]').first()

    if (await administrationCheckbox.isChecked()) {
      await administrationCheckbox.click()
      console.log('  ❌ Unchecked Administration')
    } else {
      console.log('  ⚠️ Administration was already unchecked')
    }

    await page.waitForTimeout(1000)

    // Step 5: Save changes
    console.log('💾 Saving changes...')
    await page.click('button:has-text("Save Changes")')

    // Wait for success notification
    await page.waitForSelector('text=/saved successfully/i', { timeout: 5000 })
    console.log('✅ Changes saved successfully')

    await page.waitForTimeout(2000)

    // Step 6: Logout
    await page.locator('a[href="/dashboard/profile"]').click()
    await page.waitForTimeout(500)
    // Look for logout button or link
    const logoutButton = page.locator('text=/logout/i').first()
    if (await logoutButton.isVisible()) {
      await logoutButton.click()
    }
    console.log('👋 Superadmin logged out')

    // Step 7: Login as pcinetadmin to verify
    console.log('\n🔐 Logging in as pcinetadmin to verify changes...')
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="username"]', 'pcinetadmin')
    await page.fill('input[name="password"]', '111111')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 10000 })

    // Wait for sidebar
    await page.waitForTimeout(2000)

    // Check if Accounting and Administration are hidden
    const menus = await page.locator('aside nav a, aside nav button').allTextContents()
    const hasAccounting = menus.some(m => m.includes('Accounting'))
    const hasAdministration = menus.some(m => m.includes('Administration'))

    console.log('\n✅ VERIFICATION RESULTS:')
    console.log('=' .repeat(50))
    console.log(`  Accounting menu: ${hasAccounting ? '❌ STILL VISIBLE (FAILED)' : '✅ HIDDEN (SUCCESS)'}`)
    console.log(`  Administration menu: ${hasAdministration ? '❌ STILL VISIBLE (FAILED)' : '✅ HIDDEN (SUCCESS)'}`)

    // Take final screenshot
    await page.screenshot({
      path: 'tests/screenshots/pcinetadmin-after-changes.png',
      fullPage: true
    })
    console.log('\n📸 Screenshot saved: tests/screenshots/pcinetadmin-after-changes.png')

    // Assertions
    expect(hasAccounting).toBe(false)
    expect(hasAdministration).toBe(false)
  })
})
