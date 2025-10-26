const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('🔄 Setting transfer workflow mode to "simple"...')

    const result = await prisma.business.updateMany({
      data: {
        transferWorkflowMode: 'simple',
      },
    })

    console.log('✅ Updated', result.count, 'business(es) to use simplified transfer workflow')
    console.log('🎉 Simplified workflow is now active!')
    console.log('')
    console.log('📝 Simplified Workflow:')
    console.log('  1. Draft → Send Transfer (stock deducted)')
    console.log('  2. In Transit → Receive Transfer (stock added)')
    console.log('  3. Completed!')
    console.log('')
    console.log('ℹ️  To switch back to full workflow, run:')
    console.log('   UPDATE business SET transfer_workflow_mode = \'full\';')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
