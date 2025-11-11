import { PrismaClient } from '@prisma/client'

// This script safely ADDS the missing menu-permission entries for
// "My Transfers" and "My Received Transfers" under the Stock Transfers
// parent menu without clearing any existing data or role assignments.
// It is idempotent.

const prisma = new PrismaClient()

async function ensureMenu(
  key: string,
  name: string,
  href: string,
  parentKey: string | null,
  order: number
) {
  let parentId: number | null = null

  if (parentKey) {
    const parent = await prisma.menuPermission.findUnique({ where: { key: parentKey } })
    if (!parent) {
      throw new Error(`Parent menu with key "${parentKey}" not found. Please create it first.`)
    }
    parentId = parent.id
  }

  const existing = await prisma.menuPermission.findUnique({ where: { key } })
  if (existing) {
    // Update only essential fields if changed; do not alter parentId unintentionally
    await prisma.menuPermission.update({
      where: { id: existing.id },
      data: {
        name,
        href,
        order,
        // If it had no parent but should, set it; otherwise leave as-is
        ...(parentId && existing.parentId !== parentId ? { parentId } : {}),
      },
    })
    console.log(`ℹ️  Menu already exists. Updated: ${name}`)
    return existing.id
  }

  const created = await prisma.menuPermission.create({
    data: { key, name, href, parentId, order },
  })
  console.log(`✅ Added menu: ${name} (${href})`)
  return created.id
}

async function main() {
  try {
    // Ensure parent exists: stock_transfers
    const stockTransfers = await prisma.menuPermission.findUnique({ where: { key: 'stock_transfers' } })
    if (!stockTransfers) {
      throw new Error('Parent menu "stock_transfers" does not exist. Please seed or create it first.')
    }

    // Add My Transfers (order: after create_transfer → typically 3)
    await ensureMenu(
      'my_transfers_report',
      'My Transfers',
      '/dashboard/reports/my-transfers',
      'stock_transfers',
      3
    )

    // Add My Received Transfers (order: 4)
    await ensureMenu(
      'my_received_transfers_report',
      'My Received Transfers',
      '/dashboard/reports/my-received-transfers',
      'stock_transfers',
      4
    )

    console.log('\n✨ Done. New menus are available for assignment in Menu Permissions.')
  } catch (e: any) {
    console.error('❌ Error adding menu permissions:', e.message)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()













