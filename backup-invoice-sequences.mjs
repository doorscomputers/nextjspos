import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backupInvoiceSequences() {
  try {
    const result = await prisma.$queryRaw`SELECT * FROM invoice_sequences`
    console.log('Invoice Sequences Backup:')
    console.log(JSON.stringify(result, null, 2))

    // Save to file
    const fs = await import('fs')
    fs.writeFileSync(
      'invoice_sequences_backup.json',
      JSON.stringify(result, null, 2)
    )
    console.log('\nBackup saved to invoice_sequences_backup.json')
  } catch (error) {
    console.error('Error backing up invoice_sequences:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

backupInvoiceSequences()
