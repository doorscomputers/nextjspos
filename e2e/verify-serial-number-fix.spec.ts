import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * VERIFICATION TEST: Serial Number Movement Bug Fix
 *
 * Bug: Serial number movements were created with serialNumberId: 0
 * Fix: Now captures the created serial number record ID before creating movement
 *
 * This test directly queries the database to verify the fix is working.
 */

test.describe('Serial Number Movement Fix Verification', () => {
  test('Verify all serial number movements have valid serialNumberId > 0', async () => {
    console.log('\n=== VERIFYING SERIAL NUMBER MOVEMENTS ===\n')

    // Query all serial number movements
    const allMovements = await prisma.serialNumberMovement.findMany({
      include: {
        serialNumber: {
          select: {
            serialNumber: true,
            status: true,
            condition: true,
          },
        },
      },
      orderBy: {
        movedAt: 'desc', // FIXED: Use movedAt instead of createdAt
      },
      take: 100, // Check most recent 100 movements
    })

    console.log(`Found ${allMovements.length} serial number movements in database`)

    if (allMovements.length === 0) {
      console.log('No serial number movements found. This is expected if no purchases with serial numbers have been made yet.')
      return
    }

    // Check each movement
    let validMovements = 0
    let invalidMovements = 0
    const invalidRecords: any[] = []

    for (const movement of allMovements) {
      console.log(`\nMovement ID: ${movement.id}`)
      console.log(`  Serial Number ID: ${movement.serialNumberId}`)
      console.log(`  Movement Type: ${movement.movementType}`)

      if (movement.serialNumberId <= 0) {
        console.error(`  ✗ INVALID: serialNumberId is ${movement.serialNumberId}`)
        invalidMovements++
        invalidRecords.push(movement)
      } else {
        console.log(`  ✓ Valid: Linked to serial number`)
        if (movement.serialNumber) {
          console.log(`    Serial: ${movement.serialNumber.serialNumber}`)
          console.log(`    Status: ${movement.serialNumber.status}`)
        }
        validMovements++
      }
    }

    console.log(`\n=== SUMMARY ===`)
    console.log(`Total movements checked: ${allMovements.length}`)
    console.log(`Valid movements (ID > 0): ${validMovements}`)
    console.log(`Invalid movements (ID ≤ 0): ${invalidMovements}`)

    if (invalidMovements > 0) {
      console.error(`\n✗✗✗ BUG DETECTED ✗✗✗`)
      console.error(`Found ${invalidMovements} serial number movements with invalid serialNumberId`)
      console.error(`\nInvalid Records:`)
      invalidRecords.forEach((record, idx) => {
        console.error(`\n${idx + 1}. Movement ID: ${record.id}`)
        console.error(`   Serial Number ID: ${record.serialNumberId}`)
        console.error(`   Movement Type: ${record.movementType}`)
        console.error(`   From Location: ${record.fromLocationId}`)
        console.error(`   To Location: ${record.toLocationId}`)
        console.error(`   Reference: ${record.referenceType} #${record.referenceId}`)
        console.error(`   Created: ${record.createdAt}`)
      })

      throw new Error(`CRITICAL BUG: ${invalidMovements} serial number movements have invalid serialNumberId`)
    }

    console.log(`\n✓✓✓ ALL SERIAL NUMBER MOVEMENTS ARE VALID ✓✓✓`)
    console.log(`Bug fix verified successfully!`)

    // Assert all movements have valid IDs
    allMovements.forEach((movement) => {
      expect(movement.serialNumberId).toBeGreaterThan(0)
    })
  })

  test('Verify recent purchase receipts have properly linked serial numbers', async () => {
    console.log('\n=== VERIFYING PURCHASE RECEIPTS WITH SERIAL NUMBERS ===\n')

    // Get recent purchase receipts
    const recentReceipts = await prisma.purchaseReceipt.findMany({
      take: 10,
      orderBy: {
        receivedAt: 'desc', // FIXED: Use receivedAt for ordering
      },
      include: {
        items: {
          include: {
            purchaseItem: {
              select: {
                requiresSerial: true,
                productId: true, // FIXED: Get ID instead of nested relation
              },
            },
          },
        },
      },
    })

    console.log(`Found ${recentReceipts.length} recent purchase receipts`)

    let receiptsWithSerials = 0
    let totalSerialNumbers = 0

    for (const receipt of recentReceipts) {
      const serializedItems = receipt.items.filter((item) => item.purchaseItem.requiresSerial)

      if (serializedItems.length > 0) {
        receiptsWithSerials++
        console.log(`\nReceipt: ${receipt.receiptNumber}`)
        console.log(`  Status: ${receipt.status}`)
        console.log(`  Date: ${receipt.receiptDate.toISOString().split('T')[0]}`)

        for (const item of serializedItems) {
          console.log(`  Item Product ID: ${item.purchaseItem.productId}`) // FIXED: Show ID instead of name
          console.log(`    Quantity: ${item.quantityReceived}`)
          console.log(`    Requires Serial: YES`)

          // Get serial numbers for this receipt
          const serialNumbers = await prisma.productSerialNumber.findMany({
            where: {
              purchaseReceiptId: receipt.id,
              productId: item.productId,
            },
            include: {
              movements: true,
            },
          })

          console.log(`    Serial Numbers Found: ${serialNumbers.length}`)

          serialNumbers.forEach((sn, idx) => {
            totalSerialNumbers++
            console.log(`      ${idx + 1}. ${sn.serialNumber}`)
            console.log(`         ID: ${sn.id}`)
            console.log(`         Status: ${sn.status}`)
            console.log(`         Movements: ${sn.movements.length}`)

            // Verify each serial number has at least one movement
            expect(sn.movements.length).toBeGreaterThan(0)

            // Verify all movements have valid serialNumberId
            sn.movements.forEach((movement) => {
              expect(movement.serialNumberId).toBe(sn.id)
              expect(movement.serialNumberId).toBeGreaterThan(0)
            })

            if (sn.movements.length > 0) {
              console.log(`         First Movement ID: ${sn.movements[0].serialNumberId} (should be ${sn.id})`)

              if (sn.movements[0].serialNumberId !== sn.id) {
                console.error(`         ✗ MISMATCH DETECTED`)
                throw new Error(`Serial number movement mismatch: expected ${sn.id}, got ${sn.movements[0].serialNumberId}`)
              } else {
                console.log(`         ✓ Movement correctly linked`)
              }
            }
          })
        }
      }
    }

    console.log(`\n=== SUMMARY ===`)
    console.log(`Receipts checked: ${recentReceipts.length}`)
    console.log(`Receipts with serial numbers: ${receiptsWithSerials}`)
    console.log(`Total serial numbers verified: ${totalSerialNumbers}`)

    if (receiptsWithSerials === 0) {
      console.log('\nNo purchase receipts with serial numbers found.')
      console.log('This is expected if no serialized products have been received yet.')
    } else {
      console.log(`\n✓✓✓ ALL SERIAL NUMBERS PROPERLY LINKED TO MOVEMENTS ✓✓✓`)
    }
  })
})
