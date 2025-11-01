import { PrismaClient } from '@prisma/client'

// This script ADDS missing Menu Permission entries for the Bulk Price Editor
// without touching existing role/user assignments. It is idempotent.

const prisma = new PrismaClient()

async function ensureMenu(key: string, name: string, href: string, parentKey: string | null, order: number) {
    // Find parent id (if any)
    let parentId: number | null = null
    if (parentKey) {
        const parent = await prisma.menuPermission.findFirst({ where: { key: parentKey } })
        if (!parent) {
            // Create parent if missing (non-destructive for roles)
            const createdParent = await prisma.menuPermission.create({
                data: { key: parentKey, name: name.includes('Pricing') ? 'Pricing Management' : parentKey, href: href.split('/').slice(0, 3).join('/'), parentId: null, order }
            })
            parentId = createdParent.id
        } else {
            parentId = parent.id
        }
    }

    // Create child if missing
    const existing = await prisma.menuPermission.findFirst({ where: { key } })
    if (!existing) {
        await prisma.menuPermission.create({
            data: { key, name, href, parentId, order }
        })
        console.log(`✅ Added menu: ${name} (${href})`)
    } else {
        console.log(`ℹ️  Menu already exists: ${name}`)
    }
}

async function main() {
    try {
        // Parent: Pricing Management
        await ensureMenu('pricing_management', 'Pricing Management', '/dashboard/products/bulk-price-editor', null, 7)
        // Child: Bulk Price Editor
        await ensureMenu('bulk_price_editor', 'Bulk Price Editor', '/dashboard/products/bulk-price-editor', 'pricing_management', 1)
        console.log('\n✨ Done. Open Settings > Menu Permissions to enable \'Bulk Price Editor\' for roles.')
    } catch (e) {
        console.error('❌ Error adding menu permission:', e)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()


