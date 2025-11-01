import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

function splitSQLStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let inDollarQuote = false
  let dollarQuoteTag = ''

  const lines = sql.split('\n')

  for (const line of lines) {
    // Skip comment-only lines
    if (line.trim().startsWith('--')) {
      continue
    }

    // Check for dollar-quote start/end
    const dollarMatch = line.match(/\$([A-Za-z]*)\$/)
    if (dollarMatch) {
      const tag = dollarMatch[0]
      if (!inDollarQuote) {
        inDollarQuote = true
        dollarQuoteTag = tag
      } else if (tag === dollarQuoteTag) {
        inDollarQuote = false
        dollarQuoteTag = ''
      }
    }

    current += line + '\n'

    // If we hit a semicolon and we're not in a dollar quote, it's a statement boundary
    if (line.includes(';') && !inDollarQuote) {
      const trimmed = current.trim()
      if (trimmed && trimmed !== ';') {
        statements.push(trimmed)
      }
      current = ''
    }
  }

  // Add any remaining content
  if (current.trim()) {
    statements.push(current.trim())
  }

  return statements
}

async function runMigration() {
  try {
    console.log('Reading migration SQL file...')
    const migrationPath = path.join(
      __dirname,
      '..',
      'prisma',
      'migrations',
      '20250131_create_stock_pivot_materialized_view',
      'migration.sql'
    )

    const sql = fs.readFileSync(migrationPath, 'utf-8')

    console.log('Parsing SQL statements...')
    const statements = splitSQLStatements(sql)
    console.log(`Found ${statements.length} statements to execute`)

    console.log('Executing migration...')
    console.log('This may take a few moments (populating materialized view)...')

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      const preview = stmt.substring(0, 60).replace(/\s+/g, ' ')
      console.log(`[${i + 1}/${statements.length}] ${preview}...`)

      try {
        await prisma.$executeRawUnsafe(stmt)
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.code === 'P2010' && error.meta?.code === '42P07') {
          console.log(`  ⚠️ Already exists, skipping`)
        } else {
          throw error
        }
      }
    }

    console.log('✅ Migration completed successfully!')
    console.log('Materialized view "stock_pivot_view" has been created')
    console.log('Refresh function "refresh_stock_pivot_view()" is available')

    // Test the view by getting row count
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM stock_pivot_view
    `
    console.log(`View contains ${result[0].count} product variations`)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runMigration()
