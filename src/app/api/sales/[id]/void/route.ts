import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { addStock, StockTransactionType } from '@/lib/stockOperations'
import bcrypt from 'bcryptjs'
import { sendVoidTransactionAlert } from '@/lib/email'
import { getManilaDate } from '@/lib/timezone'
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

    // Void the sale and restore inventory in transaction
    // Use 60 second timeout to handle multi-item voids with inventory restoration
    const result = await prisma.$transaction(async (tx) => {
      // RACE CONDITION PROTECTION: Re-fetch sale inside transaction with fresh status
      // This prevents double-void if two requests arrive simultaneously
      const freshSale = await tx.sale.findUnique({
        where: { id: saleId },
        select: { status: true },
      })

      if (!freshSale) {
        throw new Error('Sale not found')
      }

      // Double-check status inside transaction (atomic check)
      if (freshSale.status === 'voided') {
        throw new Error('ALREADY_VOIDED')
      }
      if (freshSale.status === 'cancelled') {
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

    // Handle specific race condition errors
    if (error.message === 'ALREADY_VOIDED') {
      return NextResponse.json(
        { error: 'Sale is already voided (concurrent void detected)' },
        { status: 400 }
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

