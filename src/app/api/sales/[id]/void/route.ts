import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, isSuperAdmin, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { addStock, deductStock, StockTransactionType } from '@/lib/stockOperations'
import bcrypt from 'bcryptjs'
import { sendVoidTransactionAlert } from '@/lib/email'
import { getManilaDate } from '@/lib/timezone'
import { sendTelegramVoidTransactionAlert } from '@/lib/telegram'
import {
  decrementShiftTotalsForVoid,
  decrementShiftTotalsForExchangeVoid,
} from '@/lib/shift-running-totals'

/**
 * POST /api/sales/[id]/void - Void a sale transaction
 * Requires manager authorization
 * Restores inventory and updates serial numbers
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessIdNumber = Number(user.businessId)
    const userIdNumber = Number(user.id)
    const userDisplayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || `User#${userIdNumber}`
    if (Number.isNaN(businessIdNumber) || Number.isNaN(userIdNumber)) {
      return NextResponse.json({ error: 'Invalid user context' }, { status: 400 })
    }

    // Check permission
    if (!hasPermission(user, PERMISSIONS.SELL_VOID)) {
      return NextResponse.json(
        { error: 'Forbidden - Missing sell.void permission' },
        { status: 403 }
      )
    }

    const saleId = Number((await params).id)
    if (Number.isNaN(saleId)) {
      return NextResponse.json({ error: 'Invalid sale id' }, { status: 400 })
    }
    const body = await request.json()
    const { voidReason, authMethod = 'password', managerPassword, rfidLocationCode } = body

    // Validate required fields
    if (!voidReason) {
      return NextResponse.json({ error: 'Void reason is required' }, { status: 400 })
    }

    // Authorization tracking variables (used by both password and RFID methods)
    let authorizingUserId: number | null = null
    let authorizingUsername: string | null = null
    let authMethod_description = ''

    // Validate authorization based on method
    if (authMethod === 'password') {
      if (!managerPassword) {
        return NextResponse.json(
          { error: 'Manager password is required to void transactions' },
          { status: 400 }
        )
      }

      // Verify manager/admin password
      const managerUsers = await prisma.user.findMany({
        where: {
          businessId: businessIdNumber,
          roles: {
            some: {
              role: {
                name: {
                  in: ['Branch Manager', 'Main Branch Manager', 'Branch Admin', 'All Branch Admin', 'Super Admin'],
                },
              },
          },
        },
      },
      select: {
        id: true,
        username: true,
        password: true,
      },
    })

    let passwordValid = false

    for (const manager of managerUsers) {
      const isMatch = await bcrypt.compare(managerPassword, manager.password)
      if (isMatch) {
        passwordValid = true
        authorizingUserId = manager.id
        authorizingUsername = manager.username
        authMethod_description = `Manager: ${manager.username}`
        break
      }
    }

      if (!passwordValid) {
        return NextResponse.json(
          { error: 'Invalid manager password. Only managers or admins can authorize voids.' },
          { status: 403 }
        )
      }
    } else if (authMethod === 'rfid') {
      // Validate RFID location code
      if (!rfidLocationCode) {
        return NextResponse.json(
          { error: 'RFID location code is required for void authorization' },
          { status: 400 }
        )
      }

      // Verify RFID location code exists and belongs to this business
      const location = await prisma.businessLocation.findFirst({
        where: {
          businessId: businessIdNumber,
          locationCode: rfidLocationCode.trim(),
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          locationCode: true,
        },
      })

      if (!location) {
        return NextResponse.json(
          { error: 'Invalid RFID location code. Please scan a valid location tag.' },
          { status: 403 }
        )
      }

      // For RFID auth, the current user is the authorizer (they scanned the location tag)
      authorizingUserId = userIdNumber
      authorizingUsername = user.username
      authMethod_description = `RFID: ${location.locationCode} (${location.name})`

      console.log(`[Void] Authorized by RFID location code: ${location.locationCode} (${location.name})`)
    } else {
      return NextResponse.json(
        { error: 'Invalid authorization method' },
        { status: 400 }
      )
    }

    // Fetch the sale with payments for running totals update
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payments: true, // Include payments for running totals decrement
      },
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    // Check business ownership
    if (sale.businessId !== businessIdNumber) {
      return NextResponse.json(
        { error: 'Sale does not belong to your business' },
        { status: 403 }
      )
    }

    // Check if already voided
    if (sale.status === 'voided') {
      return NextResponse.json({ error: 'Sale is already voided' }, { status: 400 })
    }

    // Cannot void cancelled sales
    if (sale.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot void a cancelled sale' }, { status: 400 })
    }

    // SAME-DAY VOID POLICY: a sale may only be voided on its own business day
    // while the originating shift is still open. Past-day corrections must go
    // through the Customer Return / Exchange flow, which correctly handles
    // stock, price difference, and expected cash. Super Admins may override
    // for genuine emergencies.
    if (!isSuperAdmin(user)) {
      // sale_date is a DATE column holding the PH calendar date; Prisma returns
      // it as UTC midnight, so the ISO date part IS the PH business day.
      const saleDay = sale.saleDate.toISOString().slice(0, 10)
      const manilaToday = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
      }).format(new Date())

      if (saleDay !== manilaToday) {
        return NextResponse.json(
          {
            error:
              `Cannot void: this sale is dated ${saleDay}, not today. Voids are only ` +
              `allowed on the same business day. To correct a past sale, process a ` +
              `Customer Return or Exchange instead — it adjusts stock and cash correctly.`,
          },
          { status: 400 }
        )
      }

      if (sale.shiftId) {
        const saleShift = await prisma.cashierShift.findUnique({
          where: { id: sale.shiftId },
          select: { status: true },
        })
        if (saleShift && saleShift.status !== 'open') {
          return NextResponse.json(
            {
              error:
                'Cannot void: the shift this sale belongs to is already closed (Z reading done). ' +
                'Process a Customer Return or Exchange instead.',
            },
            { status: 400 }
          )
        }
      }
    }

    const isExchangeSale = sale.saleType === 'exchange'

    // Block voiding a sale that has active returns/exchanges against it.
    // Voiding would restore ALL sold items even though some were already
    // returned to stock — double-counting inventory.
    // (An exchange sale's own return leg links via returnNumber, not saleId,
    // so this check does not block voiding the exchange itself.)
    const activeReturns = await prisma.customerReturn.findMany({
      where: {
        businessId: businessIdNumber,
        saleId,
        status: { notIn: ['rejected', 'cancelled', 'voided'] },
      },
      select: { id: true, returnNumber: true, status: true },
    })

    if (activeReturns.length > 0) {
      return NextResponse.json(
        {
          error:
            `Cannot void this sale: it already has ${activeReturns.length} return/exchange ` +
            `record(s) against it (${activeReturns.map((r) => r.returnNumber).join(', ')}). ` +
            `Voiding would double-restore inventory. Process the remaining items through ` +
            `the return/refund flow instead.`,
        },
        { status: 400 }
      )
    }

    // Void the sale and restore inventory in transaction
    // Use 60 second timeout to handle multi-item voids with inventory restoration
    const result = await prisma.$transaction(async (tx) => {
      // RACE CONDITION PROTECTION: Use FOR UPDATE NOWAIT to lock the sale row
      // This prevents double-void by ensuring only one transaction can process at a time
      // NOWAIT causes immediate failure if another transaction holds the lock
      let freshSale: { id: number; status: string }[]
      try {
        freshSale = await tx.$queryRaw<{ id: number; status: string }[]>`
          SELECT id, status FROM sales WHERE id = ${saleId} FOR UPDATE NOWAIT
        `
      } catch (lockError: any) {
        // Handle lock contention - another void is in progress
        if (lockError.message?.includes('could not obtain lock') ||
            lockError.code === '55P03') { // PostgreSQL lock_not_available error code
          throw new Error('VOID_IN_PROGRESS')
        }
        throw lockError
      }

      if (!freshSale || freshSale.length === 0) {
        throw new Error('Sale not found')
      }

      const saleStatus = freshSale[0].status

      // Double-check status inside transaction (atomic check)
      if (saleStatus === 'voided') {
        throw new Error('ALREADY_VOIDED')
      }
      if (saleStatus === 'cancelled') {
        throw new Error('SALE_CANCELLED')
      }

      // Update sale status to voided
      const voidedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          status: 'voided',
        },
      })

      // NOTE: Customer balances are calculated dynamically from sales
      // When a sale is voided, it's automatically excluded from AR calculations
      // No need to update customer.outstandingBalance (field doesn't exist)

      // Create void transaction record
      const voidTransaction = await tx.voidTransaction.create({
        data: {
          businessId: businessIdNumber,
          locationId: sale.locationId,
          saleId,
          voidReason: voidReason,
          originalAmount: sale.totalAmount,
          voidedBy: userIdNumber,
          approvedBy: authorizingUserId, // Manager or current user (for RFID)
          approvedAt: getManilaDate(),
          requiresManagerApproval: authMethod === 'password', // true for password, false for RFID
        },
      })

      // Restore inventory for each item
      for (const item of sale.items) {
        const quantityNumber = parseFloat(item.quantity.toString())

        await addStock({
          tx,
          businessId: businessIdNumber,
          productId: item.productId,
          productVariationId: item.productVariationId,
          locationId: sale.locationId,
          quantity: quantityNumber,
          type: StockTransactionType.ADJUSTMENT,
          referenceType: 'sale_void',
          referenceId: voidTransaction.id,
          userId: userIdNumber,
          userDisplayName,
          notes: `Voided sale ${sale.invoiceNumber} - ${voidReason}`,
        })
        // Restore serial numbers if applicable
        if (item.serialNumbers && Array.isArray(item.serialNumbers)) {
          const serialNumbersData = item.serialNumbers as any[]

          for (const snData of serialNumbersData) {
            // Find the serial number record
            const serialNumber = await tx.productSerialNumber.findFirst({
              where: {
                id: snData.id,
                businessId: businessIdNumber,
              },
            })

            if (serialNumber) {
              // Restore serial number to in_stock status
              await tx.productSerialNumber.update({
                where: { id: serialNumber.id },
                data: {
                  status: 'in_stock',
                  saleId: null,
                  soldAt: null,
                  soldTo: null,
                },
              })

              // Create movement record
              await tx.serialNumberMovement.create({
                data: {
                  serialNumberId: serialNumber.id,
                  movementType: 'void',
                  toLocationId: sale.locationId,
                  referenceType: 'sale',
                  referenceId: saleId,
                  movedBy: userIdNumber,
                  notes: `Voided from sale ${sale.invoiceNumber}`,
                },
              })
            }
          }
        }
      }

      // EXCHANGE VOID: fully reverse the return leg too.
      // An exchange has two legs: returned items were ADDED to stock and
      // replacement items were DEDUCTED. The loop above already restored the
      // replacement items; without this block the returned items' stock stays
      // inflated and the customer_returns row dangles in 'exchanged' status.
      if (isExchangeSale) {
        const linkedReturn = await tx.customerReturn.findFirst({
          where: {
            businessId: businessIdNumber,
            returnNumber: `RTN-${sale.invoiceNumber}`,
            status: 'exchanged',
          },
          include: { items: true },
        })

        if (linkedReturn) {
          // Deduct the previously-restored returned items back out.
          // allowNegative: the returned unit may have been sold since the
          // exchange — the ledger must still record the reversal.
          for (const rItem of linkedReturn.items) {
            await deductStock({
              tx,
              businessId: businessIdNumber,
              productId: rItem.productId,
              productVariationId: rItem.productVariationId,
              locationId: linkedReturn.locationId,
              quantity: parseFloat(rItem.quantity.toString()),
              type: StockTransactionType.ADJUSTMENT,
              referenceType: 'sale_void',
              referenceId: voidTransaction.id,
              userId: userIdNumber,
              userDisplayName,
              notes: `Voided exchange ${sale.invoiceNumber} - reversing returned item from ${linkedReturn.returnNumber}`,
              allowNegative: true,
              skipAvailabilityCheck: true,
            })
          }

          // Close the return record so it no longer dangles
          await tx.customerReturn.update({
            where: { id: linkedReturn.id },
            data: { status: 'voided' },
          })

          // Revert serial numbers the exchange return leg put back in stock:
          // they belong to the customer again (exchange never happened)
          const returnMovements = await tx.serialNumberMovement.findMany({
            where: {
              referenceType: 'exchange_return',
              referenceId: linkedReturn.id,
            },
          })
          for (const movement of returnMovements) {
            await tx.productSerialNumber.update({
              where: { id: movement.serialNumberId },
              data: {
                status: 'sold',
                saleId: linkedReturn.saleId,
                soldAt: getManilaDate(),
              },
            })
            await tx.serialNumberMovement.create({
              data: {
                serialNumberId: movement.serialNumberId,
                movementType: 'void',
                referenceType: 'sale_void',
                referenceId: voidTransaction.id,
                movedBy: userIdNumber,
                notes: `Voided exchange ${sale.invoiceNumber} - serial returned to customer (original sale)`,
              },
            })
          }

          // Revert serials issued by the exchange back to in_stock
          // (exchange sale items don't carry serialNumbers JSON, so the
          // generic restore loop above missed them)
          const issueMovements = await tx.serialNumberMovement.findMany({
            where: {
              referenceType: 'exchange_issue',
              referenceId: saleId,
            },
          })
          for (const movement of issueMovements) {
            await tx.productSerialNumber.update({
              where: { id: movement.serialNumberId },
              data: {
                status: 'in_stock',
                saleId: null,
                soldAt: null,
                soldTo: null,
              },
            })
            await tx.serialNumberMovement.create({
              data: {
                serialNumberId: movement.serialNumberId,
                movementType: 'void',
                toLocationId: sale.locationId,
                referenceType: 'sale_void',
                referenceId: voidTransaction.id,
                movedBy: userIdNumber,
                notes: `Voided exchange ${sale.invoiceNumber} - issued serial restored to stock`,
              },
            })
          }
        }
      }

      // Update shift running totals for voided sale (decrement counters)
      // Only if sale has a shiftId (POS sales) AND the shift is still open —
      // a closed shift's running totals are frozen history behind its Z
      // reading and must not change (Super Admin past-day override path).
      const saleShiftForTotals = sale.shiftId
        ? await tx.cashierShift.findUnique({
            where: { id: sale.shiftId },
            select: { status: true },
          })
        : null
      if (sale.shiftId && saleShiftForTotals?.status === 'open') {
        if (isExchangeSale) {
          // Exchange sales never touched VAT/discount running totals —
          // reverse exactly what incrementShiftTotalsForExchange recorded
          await decrementShiftTotalsForExchangeVoid(
            sale.shiftId,
            {
              exchangeTotal: parseFloat(sale.subtotal.toString()),
              returnTotal: parseFloat(sale.discountAmount.toString()),
              totalAmount: parseFloat(sale.totalAmount.toString()),
              payments: sale.payments.map((p: any) => ({
                paymentMethod: p.paymentMethod,
                amount: parseFloat(p.amount.toString()),
              })),
            },
            tx
          )
        } else {
          await decrementShiftTotalsForVoid(
            sale.shiftId,
            {
              subtotal: parseFloat(sale.subtotal.toString()),
              totalAmount: parseFloat(sale.totalAmount.toString()),
              discountAmount: parseFloat(sale.discountAmount.toString()),
              discountType: sale.discountType,
              payments: sale.payments.map((p: any) => ({
                paymentMethod: p.paymentMethod,
                amount: parseFloat(p.amount.toString()),
              })),
            },
            tx  // CRITICAL: Pass transaction client for atomicity
          )
        }
      }

      return { voidedSale, voidTransaction }
    }, {
      timeout: 60000, // 60 seconds for multi-item voids
      maxWait: 10000, // Max 10 seconds to acquire lock
    })

    // Create audit log
    await createAuditLog({
      businessId: businessIdNumber,
      userId: userIdNumber,
      username: user.username,
      action: AuditAction.SALE_VOID,
      entityType: EntityType.SALE,
      entityIds: [saleId],
      description: `Voided sale ${sale.invoiceNumber}. Reason: ${voidReason}. Authorization: ${authMethod_description}`,
      metadata: {
        saleId,
        invoiceNumber: sale.invoiceNumber,
        voidReason,
        authMethod,
        authMethodDescription: authMethod_description,
        approvedBy: authorizingUserId,
        approvedByUsername: authorizingUsername,
        totalAmount: parseFloat(sale.totalAmount.toString()),
      },
    })

    // CRITICAL FIX: Delete idempotency keys that cached this sale's response
    // This allows users to create a new sale with the same items after voiding
    // Without this, the idempotency system would return the cached (voided) sale
    // NOTE: Using JSONB extraction instead of LIKE to avoid false matches
    // (e.g., LIKE '%"id":42,%' would wrongly match sale 420)
    try {
      const deletedKeys = await prisma.$executeRaw`
        DELETE FROM idempotency_keys
        WHERE business_id = ${businessIdNumber}
        AND (response_body::jsonb->>'id')::int = ${saleId}
        AND endpoint = '/api/sales'
      `
      if (deletedKeys > 0) {
        console.log(`[Void] Deleted ${deletedKeys} idempotency key(s) for voided sale ${saleId}`)
      }
    } catch (idempotencyError) {
      // Non-critical - log but don't fail the void
      console.error('[Void] Error deleting idempotency keys:', idempotencyError)
    }

    // Send void alert notifications (async, don't wait)
    setImmediate(async () => {
      try {
        const location = await prisma.businessLocation.findUnique({
          where: { id: sale.locationId },
        })

        const alertData = {
          saleNumber: sale.invoiceNumber,
          totalAmount: parseFloat(sale.totalAmount.toString()),
          cashierName: user.username || user.name || 'Unknown',
          locationName: location?.name || 'Unknown Location',
          timestamp: new Date(),
          reason: voidReason,
          itemCount: sale.items.length,
        }

        await Promise.all([
          sendVoidTransactionAlert(alertData),
          sendTelegramVoidTransactionAlert(alertData),
        ])
      } catch (notificationError) {
        console.error('Void alert notification error:', notificationError)
      }
    })

    return NextResponse.json({
      success: true,
      message: isExchangeSale
        ? 'Exchange voided: replacement items restored to stock AND returned items removed from stock. ' +
          'If the customer actually swapped items, re-enter the exchange now — otherwise inventory will not match.'
        : 'Sale voided successfully',
      sale: result.voidedSale,
      voidTransaction: result.voidTransaction,
    })
  } catch (error: any) {
    console.error('Error voiding sale:', error)

    // Handle specific race condition errors
    if (error.message === 'ALREADY_VOIDED') {
      return NextResponse.json(
        { error: 'Sale is already voided (concurrent void detected)' },
        { status: 400 }
      )
    }
    if (error.message === 'VOID_IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Another void operation is in progress. Please wait and try again.' },
        { status: 409 } // 409 Conflict
      )
    }
    if (error.message === 'SALE_CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot void a cancelled sale' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to void sale', details: error.message },
      { status: 500 }
    )
  }
}

