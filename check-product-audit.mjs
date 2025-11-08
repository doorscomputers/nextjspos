import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAudit() {
  try {
    console.log('\n=== AUDIT LOG FOR "Another Sample 1" ===\n')
    
    // Find the product
    const product = await prisma.product.findFirst({
      where: {
        name: {
          contains: 'Another Sample 1',
          mode: 'insensitive'
        }
      }
    })
    
    if (!product) {
      console.log('❌ Product not found')
      return
    }
    
    console.log(`Product ID: ${product.id}`)
    console.log(`Created At: ${product.createdAt}`)
    console.log(`Updated At: ${product.updatedAt}`)
    
    // Check audit logs
    console.log('\n--- Audit Logs ---')
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'Product',
        entityIds: {
          has: product.id
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    
    if (auditLogs.length === 0) {
      console.log('No audit logs found for this product')
    } else {
      console.log(`Found ${auditLogs.length} audit log entries:`)
      console.table(auditLogs.map(log => ({
        action: log.action,
        user: log.username,
        date: log.createdAt,
        description: log.description
      })))
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAudit()
