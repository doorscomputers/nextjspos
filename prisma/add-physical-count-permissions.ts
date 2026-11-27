/**
 * One-time setup for the Mobile Physical Count feature.
 * Run AFTER prisma/sql/2026-11-27-mobile-count.sql:
 *   npx tsx prisma/add-physical-count-permissions.ts
 *
 * - Creates permissions physical_count.mobile and physical_count.view (if missing)
 * - Creates the "Physical Count Sessions" menu item next to "Inventory Corrections"
 * - Gives physical_count.view + the menu to every role that has inventory_correction.approve
 * - Gives physical_count.mobile to the "Inventory Counter" role; assign it to other roles in Roles.
 * Safe to run more than once (only upserts / skipDuplicates; nothing is deleted).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const mobile = await prisma.permission.upsert({
    where: { name: 'physical_count.mobile' },
    update: {},
    create: { name: 'physical_count.mobile', guardName: 'web' },
  })
  const view = await prisma.permission.upsert({
    where: { name: 'physical_count.view' },
    update: {},
    create: { name: 'physical_count.view', guardName: 'web' },
  })
  console.log('✅ Permissions:', mobile.name, view.name)

  const sibling = await prisma.menuPermission.findUnique({ where: { key: 'inventory_corrections' } })
  const menu = await prisma.menuPermission.upsert({
    where: { key: 'physical_count_sessions' },
    update: {},
    create: {
      key: 'physical_count_sessions',
      name: 'Physical Count Sessions',
      href: '/dashboard/physical-count-sessions',
      parentId: sibling?.parentId ?? null,
      order: (sibling?.order ?? 0) + 1,
    },
  })
  console.log('✅ Menu:', menu.key)

  const approverRoles = await prisma.role.findMany({
    where: { permissions: { some: { permission: { name: 'inventory_correction.approve' } } } },
    select: { id: true, name: true },
  })
  if (approverRoles.length) {
    await prisma.rolePermission.createMany({
      data: approverRoles.map(r => ({ roleId: r.id, permissionId: view.id })),
      skipDuplicates: true,
    })
    await prisma.roleMenuPermission.createMany({
      data: approverRoles.map(r => ({ roleId: r.id, menuPermissionId: menu.id })),
      skipDuplicates: true,
    })
  }
  console.log('✅ View access given to:', approverRoles.map(r => r.name).join(', ') || '(none)')

  // The existing "Inventory Counter" role is meant for counting: it gets the app permission.
  const counterRoles = await prisma.role.findMany({ where: { name: 'Inventory Counter' }, select: { id: true } })
  if (counterRoles.length) {
    await prisma.rolePermission.createMany({
      data: counterRoles.map(r => ({ roleId: r.id, permissionId: mobile.id })),
      skipDuplicates: true,
    })
  }
  console.log(`✅ App permission given to ${counterRoles.length} "Inventory Counter" role(s)`)
  console.log('ℹ  Other counters: Roles → tick "Count stock with the mobile app".')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
