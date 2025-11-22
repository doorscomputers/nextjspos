import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

/**
 * POST /api/admin/sync-cashier-void-permission
 *
 * Adds SELL_VOID permission to Sales Cashier roles
 * Requires Super Admin access
 *
 * This fixes the issue where SELL_VOID was added to code but not synced to database
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Only Super Admins can run this sync
    if (!hasPermission(user, PERMISSIONS.ADMIN_MANAGE_USERS)) {
      return NextResponse.json(
        { error: 'Forbidden - Only Super Admins can sync permissions' },
        { status: 403 }
      )
    }

    console.log('[Permission Sync] 🔄 Starting SELL_VOID permission sync...')

    // Step 1: Find or Create SELL_VOID permission
    let permission = await prisma.permission.findUnique({
      where: { name: 'sell.void' }
    })

    if (!permission) {
      console.log('[Permission Sync] ⚠️  Permission not found, creating it...')

      // Create the permission
      permission = await prisma.permission.create({
        data: {
          name: 'sell.void',
          guardName: 'web',
        }
      })

      console.log(`[Permission Sync] ✅ Created permission: ${permission.name} (ID: ${permission.id})`)
    } else {
      console.log(`[Permission Sync] ✅ Found existing permission: ${permission.name} (ID: ${permission.id})`)
    }

    // Step 2: Find all Sales Cashier roles
    const cashierRoles = await prisma.role.findMany({
      where: { name: 'Sales Cashier' },
      include: {
        business: {
          select: {
            id: true,
            name: true
          }
        },
        permissions: {
          where: {
            permission: {
              name: 'sell.void'
            }
          }
        }
      }
    })

    if (cashierRoles.length === 0) {
      return NextResponse.json(
        {
          error: 'No "Sales Cashier" roles found',
          message: 'Roles might have different names or haven\'t been seeded yet'
        },
        { status: 404 }
      )
    }

    console.log(`[Permission Sync] 📋 Found ${cashierRoles.length} Sales Cashier role(s)`)

    // Step 3: Add permission to each role
    let addedCount = 0
    let alreadyHadCount = 0
    const results = []

    for (const role of cashierRoles) {
      const businessName = role.business?.name || `Business #${role.businessId}`

      // Check if already has permission
      if (role.permissions.length > 0) {
        console.log(`[Permission Sync] ✓ ${businessName} - Already has permission`)
        alreadyHadCount++
        results.push({
          role: role.name,
          business: businessName,
          status: 'already_exists'
        })
        continue
      }

      // Add permission to role
      try {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id
          }
        })

        console.log(`[Permission Sync] ✅ ${businessName} - Permission added`)
        addedCount++
        results.push({
          role: role.name,
          business: businessName,
          status: 'added'
        })
      } catch (error: any) {
        if (error.code === 'P2002') {
          // Unique constraint - permission already exists
          alreadyHadCount++
          results.push({
            role: role.name,
            business: businessName,
            status: 'already_exists'
          })
        } else {
          console.error(`[Permission Sync] ❌ Error for ${businessName}:`, error.message)
          results.push({
            role: role.name,
            business: businessName,
            status: 'error',
            error: error.message
          })
        }
      }
    }

    console.log('[Permission Sync] 🎉 Sync complete!')

    return NextResponse.json({
      success: true,
      message: 'Permission sync completed successfully',
      summary: {
        totalRoles: cashierRoles.length,
        permissionsAdded: addedCount,
        alreadyHad: alreadyHadCount
      },
      results,
      nextSteps: addedCount > 0
        ? [
            'Users must LOGOUT and LOGIN again',
            'This refreshes their session with new permissions',
            'Go to Reports → Sales Today',
            'Check console: hasVoidPermission should be TRUE',
            'Verify Void button appears in Action column'
          ]
        : [
            'All roles already have the permission!',
            'If Void button still not showing, check user role assignment'
          ]
    })

  } catch (error: any) {
    console.error('[Permission Sync] Fatal error:', error)
    return NextResponse.json(
      {
        error: 'Permission sync failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}
