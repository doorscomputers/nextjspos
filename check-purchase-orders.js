const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkPurchaseOrders() {
  try {
    const purchases = await prisma.purchase.findMany({
      where: {
        businessId: 1,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          }
        },
        items: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    })

    console.log('\n=== Purchase Orders ===')
    console.log('Total found:', purchases.length)

    purchases.forEach(po => {
      console.log('\n---')
      console.log('PO ID:', po.id)
      console.log('PO Number:', po.purchaseOrderNumber)
      console.log('Status:', po.status)
      console.log('Supplier:', po.supplier.name)
      console.log('Supplier ID:', po.supplier.id)
      console.log('Location ID:', po.locationId)
      console.log('Items:', po.items.length)
      po.items.forEach(item => {
        console.log(`  - Item ID: ${item.id}, Product Var ID: ${item.productVariationId}, Qty: ${item.quantityOrdered}`)
      })
    })

    // Check existing GRNs
    const grns = await prisma.purchaseReceipt.findMany({
      where: {
        businessId: 1,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          }
        },
        items: true
      }
    })

    console.log('\n\n=== Existing GRNs ===')
    console.log('Total found:', grns.length)

    if (grns.length > 0) {
      grns.forEach(grn => {
        console.log('\n---')
        console.log('GRN ID:', grn.id)
        console.log('GRN Number:', grn.receiptNumber)
        console.log('Status:', grn.status)
        console.log('Supplier:', grn.supplier.name)
        console.log('Location ID:', grn.locationId)
        console.log('Purchase ID:', grn.purchaseId)
        console.log('Items:', grn.items.length)
      })
    } else {
      console.log('No GRNs found. You can create one from a purchase order.')
    }

    process.exit(0)
  } catch (error) {
    console.error('Error:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkPurchaseOrders()
