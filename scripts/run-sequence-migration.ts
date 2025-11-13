#!/usr/bin/env tsx
/**
 * Run sequence tables migration
 * Creates invoice_sequences, receipt_sequences, transfer_sequences, return_sequences tables
 */

import { prisma } from '../src/lib/prisma.simple'
import { readFileSync } from 'fs'
import { join } from 'path'

async function runMigration() {
  console.log('🚀 Running sequence tables migration...')

  try {
    // Read SQL file
    const sqlPath = join(__dirname, '..', 'prisma', 'migrations', 'create-sequence-tables.sql')
    const sql = readFileSync(sqlPath, 'utf-8')

    // Execute SQL (split by semicolons and execute each statement)
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 60)}...`)
      await prisma.$executeRawUnsafe(statement)
    }

    console.log('✅ Migration completed successfully!')
    console.log('\nSequence tables created:')
    console.log('  - invoice_sequences (per business + location + month)')
    console.log('  - receipt_sequences (per business + month)')
    console.log('  - transfer_sequences (per business + month)')
    console.log('  - return_sequences (per business + month)')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

runMigration()
