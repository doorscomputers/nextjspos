import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { addStock, StockTransactionType } from '@/lib/stockOperations'
import bcrypt from 'bcryptjs'
import { sendVoidTransactionAlert } from '@/lib/email'
import { sendTelegramVoidTransactionAlert } from '@/lib/telegram'
import { decrementShiftTotalsForVoid } from '@/lib/shift-running-totals'

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
    const { voidReason, managerPassword } = body

    // Validate required fields
    if (!voidReason) {
      return NextResponse.json({ error: 'Void reason is required' }, { status: 400 })
    }

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
    let authorizingManager = null

    for (const manager of managerUsers) {
      const isMatch = await bcrypt.compare(managerPassword, manager.password)
      if (isMatch) {
        passwordValid = true
        authorizingManager = manager
        break
      }
    }

    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid manager password. Only managers or admins can authorize voids.' },
        { status: 403 }
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

    // Void the sale and restore inventory in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update sale status to voided
      const voidedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          status: 'voided',
        },
      }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

      // CRITICAL: If this was a credit/charge invoice sale, reduce customer's outstanding balance
      // Credit sales are identified by:
      // 1. sale.status === 'pending' (unpaid or partially paid)
      // 2. sale.totalAmount > sale.paidAmount (has unpaid balance)
      // 3. sale.customerId is not null (has a customer account)
      const totalAmount = parseFloat(sale.totalAmount.toString())
      const paidAmount = parseFloat(sale.paidAmount?.toString() || '0')
      const unpaidAmount = totalAmount - paidAmount

      if (sale.customerId && unpaidAmount > 0.01) {
        // This is a credit sale with unpaid balance - reduce customer outstanding balance
        console.log(`[Void] Reducing customer balance by ${unpaidAmount} for voided credit sale ${sale.invoiceNumber}`)

        await tx.customer.update({
          where: { id: sale.customerId },
          data: {
            outstandingBalance: {
              decrement: unpaidAmount, // Reduce by unpaid amount
            },
          },
        })
      }

      // Create void transaction record
      const voidTransaction = await tx.voidTransaction.create({
        data: {
          businessId: businessIdNumber,
          saleId,
          voidedBy: userIdNumber,
          voidedAt: new Date(),
          reason: voidReason,
          authorizedBy: authorizingManager.id,
          authorizedByUsername: authorizingManager.username,
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

      // Update shift running totals for voided sale (decrement counters)
      // Only if sale has a shiftId (POS sales)
      if (sale.shiftId) {
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

      return { voidedSale, voidTransaction }
    })

    // Create audit log
    await createAuditLog({
      businessId: businessIdNumber,
      userId: userIdNumber,
      username: user.username,
      action: AuditAction.SALE_VOID,
      entityType: EntityType.SALE,
      entityIds: [saleId],
      description: `Voided sale ${sale.invoiceNumber}. Reason: ${voidReason}. Authorized by: ${authorizingManager.username}`,
      metadata: {
        saleId,
        invoiceNumber: sale.invoiceNumber,
        voidReason,
        authorizedBy: authorizingManager.id,
        authorizedByUsername: authorizingManager.username,
        totalAmount: parseFloat(sale.totalAmount.toString()),
      },
    })

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
      message: 'Sale voided successfully',
      sale: result.voidedSale,
      voidTransaction: result.voidTransaction,
    })
  } catch (error: any) {
    console.error('Error voiding sale:', error)
    return NextResponse.json(
      { error: 'Failed to void sale', details: error.message },
      { status: 500 }
    )
  }
}

