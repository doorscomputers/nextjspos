import { prisma } from './prisma'

/**
 * Serial Number Status Types
 */
export enum SerialNumberStatus {
  IN_STOCK = 'in_stock',
  SOLD = 'sold',
  IN_TRANSIT = 'in_transit',
  RETURNED = 'returned',
  DAMAGED = 'damaged',
  WARRANTY_RETURN = 'warranty_return',
}

/**
 * Serial Number Condition Types
 */
export enum SerialNumberCondition {
  NEW = 'new',
  USED = 'used',
  REFURBISHED = 'refurbished',
  DAMAGED = 'damaged',
  DEFECTIVE = 'defective',
}

/**
 * Serial Number Movement Types
 */
export enum SerialNumberMovementType {
  PURCHASE = 'purchase',
  SALE = 'sale',
  TRANSFER_OUT = 'transfer_out',
  TRANSFER_IN = 'transfer_in',
  CUSTOMER_RETURN = 'customer_return',
  SUPPLIER_RETURN = 'supplier_return',
  DAMAGE = 'damage',
  REPAIR = 'repair',
}

/**
 * Check if a serial number already exists for a business
 */
export async function serialNumberExists(
  businessId: number,
  serialNumber: string
): Promise<boolean> {
  const existing = await prisma.productSerialNumber.findUnique({
    where: {
      businessId_serialNumber: {
        businessId,
        serialNumber,
      },
    },
  })
  return !!existing
}

/**
 * Validate serial number format (basic validation)
 */
export function validateSerialNumber(serialNumber: string): {
  valid: boolean
  error?: string
} {
  if (!serialNumber || serialNumber.trim().length === 0) {
    return { valid: false, error: 'Serial number is required' }
  }

  if (serialNumber.length < 3) {
    return { valid: false, error: 'Serial number must be at least 3 characters' }
  }

  if (serialNumber.length > 191) {
    return { valid: false, error: 'Serial number must be less than 191 characters' }
  }

  // Check for valid characters (alphanumeric, hyphens, underscores)
  const validPattern = /^[a-zA-Z0-9\-_]+$/
  if (!validPattern.test(serialNumber)) {
    return { valid: false, error: 'Serial number can only contain letters, numbers, hyphens, and underscores' }
  }

  return { valid: { select: { id: true, name: true } } }
}

/**
 * Create a new serial number record
 */
export async function createSerialNumber({
  businessId,
  productId,
  productVariationId,
  serialNumber,
  imei,
  currentLocationId,
  purchaseId,
  purchaseReceiptId,
  purchaseCost,
  condition = SerialNumberCondition.NEW,
  notes,
  userId,
}: {
  businessId: number
  productId: number
  productVariationId: number
  serialNumber: string
  imei?: string
  currentLocationId: number
  purchaseId?: number
  purchaseReceiptId?: number
  purchaseCost?: number
  condition?: SerialNumberCondition
  notes?: string
  userId: number
}) {
  // Validate serial number format
  const validation = validateSerialNumber(serialNumber)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  // Check if serial number already exists
  const exists = await serialNumberExists(businessId, serialNumber)
  if (exists) {
    throw new Error(`Serial number ${serialNumber} already exists`)
  }

  // Create serial number record
  const serialNumberRecord = await prisma.productSerialNumber.create({
    data: {
      businessId,
      productId,
      productVariationId,
      serialNumber,
      imei,
      status: SerialNumberStatus.IN_STOCK,
      condition,
      currentLocationId,
      purchaseId,
      purchaseReceiptId,
      purchasedAt: new Date(),
      purchaseCost,
      notes,
    },
  })

  // Create movement record
  await prisma.serialNumberMovement.create({
    data: {
      serialNumberId: serialNumberRecord.id,
      movementType: SerialNumberMovementType.PURCHASE,
      toLocationId: currentLocationId,
      referenceType: 'purchase',
      referenceId: purchaseId,
      movedBy: userId,
      notes: `Serial number received from purchase`,
    },
  })

  return serialNumberRecord
}

/**
 * Update serial number status
 */
export async function updateSerialNumberStatus({
  serialNumberId,
  status,
  locationId,
  notes,
  userId,
}: {
  serialNumberId: number
  status: SerialNumberStatus
  locationId?: number
  notes?: string
  userId: number
}) {
  const update: any = {
    status,
    updatedAt: new Date(),
  }

  if (locationId !== undefined) {
    update.currentLocationId = locationId
  }

  if (notes) {
    update.notes = notes
  }

  return await prisma.productSerialNumber.update({
    where: { id: serialNumberId },
    data: update,
  })
}

/**
 * Mark serial number as sold
 */
export async function markSerialNumberAsSold({
  businessId,
  serialNumber,
  saleId,
  soldTo,
  userId,
  warrantyMonths,
}: {
  businessId: number
  serialNumber: string
  saleId: number
  soldTo: string
  userId: number
  warrantyMonths?: number
}) {
  // Get serial number record
  const serialNumberRecord = await prisma.productSerialNumber.findUnique({
    where: {
      businessId_serialNumber: {
        businessId,
        serialNumber,
      },
    },
  })

  if (!serialNumberRecord) {
    throw new Error(`Serial number ${serialNumber} not found`)
  }

  if (serialNumberRecord.status !== SerialNumberStatus.IN_STOCK) {
    throw new Error(`Serial number ${serialNumber} is not available (status: ${serialNumberRecord.status})`)
  }

  // Calculate warranty dates
  const warrantyStartDate = new Date()
  let warrantyEndDate: Date | undefined
  if (warrantyMonths) {
    warrantyEndDate = new Date()
    warrantyEndDate.setMonth(warrantyEndDate.getMonth() + warrantyMonths)
  }

  // Update serial number
  const updated = await prisma.productSerialNumber.update({
    where: { id: serialNumberRecord.id },
    data: {
      status: SerialNumberStatus.SOLD,
      saleId,
      soldAt: new Date(),
      soldTo,
      warrantyStartDate,
      warrantyEndDate,
    },
  })

  // Create movement record
  await prisma.serialNumberMovement.create({
    data: {
      serialNumberId: serialNumberRecord.id,
      movementType: SerialNumberMovementType.SALE,
      fromLocationId: serialNumberRecord.currentLocationId || undefined,
      referenceType: 'sale',
      referenceId: saleId,
      movedBy: userId,
      notes: `Sold to ${soldTo}`,
    },
  })

  return updated
}

/**
 * Mark serial number as in transit (for transfers)
 */
export async function markSerialNumberInTransit({
  businessId,
  serialNumber,
  fromLocationId,
  toLocationId,
  transferId,
  userId,
}: {
  businessId: number
  serialNumber: string
  fromLocationId: number
  toLocationId: number
  transferId: number
  userId: number
}) {
  const serialNumberRecord = await prisma.productSerialNumber.findUnique({
    where: {
      businessId_serialNumber: {
        businessId,
        serialNumber,
      },
    },
  })

  if (!serialNumberRecord) {
    throw new Error(`Serial number ${serialNumber} not found`)
  }

  if (serialNumberRecord.status !== SerialNumberStatus.IN_STOCK) {
    throw new Error(`Serial number ${serialNumber} is not available (status: ${serialNumberRecord.status})`)
  }

  if (serialNumberRecord.currentLocationId !== fromLocationId) {
    throw new Error(`Serial number ${serialNumber} is not at the source location`)
  }

  // Update status to in_transit (but don't change location yet)
  const updated = await prisma.productSerialNumber.update({
    where: { id: serialNumberRecord.id },
    data: {
      status: SerialNumberStatus.IN_TRANSIT,
    },
  })

  // Create movement record for transfer_out
  await prisma.serialNumberMovement.create({
    data: {
      serialNumberId: serialNumberRecord.id,
      movementType: SerialNumberMovementType.TRANSFER_OUT,
      fromLocationId,
      toLocationId,
      referenceType: 'transfer',
      referenceId: transferId,
      movedBy: userId,
      notes: `Transfer initiated from location ${fromLocationId} to ${toLocationId}`,
    },
  })

  return updated
}

/**
 * Complete serial number transfer (mark as received)
 */
export async function completeSerialNumberTransfer({
  businessId,
  serialNumber,
  toLocationId,
  transferId,
  userId,
}: {
  businessId: number
  serialNumber: string
  toLocationId: number
  transferId: number
  userId: number
}) {
  const serialNumberRecord = await prisma.productSerialNumber.findUnique({
    where: {
      businessId_serialNumber: {
        businessId,
        serialNumber,
      },
    },
  })

  if (!serialNumberRecord) {
    throw new Error(`Serial number ${serialNumber} not found`)
  }

  if (serialNumberRecord.status !== SerialNumberStatus.IN_TRANSIT) {
    throw new Error(`Serial number ${serialNumber} is not in transit`)
  }

  // Update location and status
  const updated = await prisma.productSerialNumber.update({
    where: { id: serialNumberRecord.id },
    data: {
      status: SerialNumberStatus.IN_STOCK,
      currentLocationId: toLocationId,
    },
  })

  // Create movement record for transfer_in
  await prisma.serialNumberMovement.create({
    data: {
      serialNumberId: serialNumberRecord.id,
      movementType: SerialNumberMovementType.TRANSFER_IN,
      fromLocationId: serialNumberRecord.currentLocationId,
      toLocationId,
      referenceType: 'transfer',
      referenceId: transferId,
      movedBy: userId,
      notes: `Transfer completed at location ${toLocationId}`,
    },
  })

  return updated
}

/**
 * Mark serial number as returned by customer
 */
export async function markSerialNumberAsReturned({
  businessId,
  serialNumber,
  returnId,
  condition,
  userId,
}: {
  businessId: number
  serialNumber: string
  returnId: number
  condition: SerialNumberCondition
  userId: number
}) {
  const serialNumberRecord = await prisma.productSerialNumber.findUnique({
    where: {
      businessId_serialNumber: {
        businessId,
        serialNumber,
      },
    },
  })

  if (!serialNumberRecord) {
    throw new Error(`Serial number ${serialNumber} not found`)
  }

  if (serialNumberRecord.status !== SerialNumberStatus.SOLD) {
    throw new Error(`Serial number ${serialNumber} was not sold`)
  }

  // Update status and condition
  const updated = await prisma.productSerialNumber.update({
    where: { id: serialNumberRecord.id },
    data: {
      status: SerialNumberStatus.RETURNED,
      condition,
    },
  })

  // Create movement record
  await prisma.serialNumberMovement.create({
    data: {
      serialNumberId: serialNumberRecord.id,
      movementType: SerialNumberMovementType.CUSTOMER_RETURN,
      toLocationId: serialNumberRecord.currentLocationId || undefined,
      referenceType: 'return',
      referenceId: returnId,
      movedBy: userId,
      notes: `Returned by customer - condition: ${condition}`,
    },
  })

  return updated
}

/**
 * Find serial numbers by product and location
 */
export async function findAvailableSerialNumbers({
  businessId,
  productId,
  productVariationId,
  locationId,
  limit = 100,
}: {
  businessId: number
  productId: number
  productVariationId: number
  locationId: number
  limit?: number
}) {
  return await prisma.productSerialNumber.findMany({
    where: {
      businessId,
      productId,
      productVariationId,
      currentLocationId: locationId,
      status: SerialNumberStatus.IN_STOCK,
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: limit,
  })
}

/**
 * Get serial number details with movement history
 */
export async function getSerialNumberDetails(
  businessId: number,
  serialNumber: string
) {
  const serialNumberRecord = await prisma.productSerialNumber.findUnique({
    where: {
      businessId_serialNumber: {
        businessId,
        serialNumber,
      },
    },
    select: {
      movements: {
        orderBy: {
          movedAt: 'desc',
        },
      },
    },
  })

  return serialNumberRecord
}

/**
 * Bulk create serial numbers (for purchase receipts)
 */
export async function bulkCreateSerialNumbers({
  businessId,
  productId,
  productVariationId,
  serialNumbers,
  currentLocationId,
  purchaseId,
  purchaseReceiptId,
  purchaseCost,
  condition = SerialNumberCondition.NEW,
  userId,
}: {
  businessId: number
  productId: number
  productVariationId: number
  serialNumbers: Array<{ serialNumber: string; imei?: string }>
  currentLocationId: number
  purchaseId?: number
  purchaseReceiptId?: number
  purchaseCost?: number
  condition?: SerialNumberCondition
  userId: number
}) {
  const results = []
  const errors = []

  for (const serial of serialNumbers) {
    try {
      const created = await createSerialNumber({
        businessId,
        productId,
        productVariationId,
        serialNumber: serial.serialNumber,
        imei: serial.imei,
        currentLocationId,
        purchaseId,
        purchaseReceiptId,
        purchaseCost,
        condition,
        userId,
      })
      results.push(created)
    } catch (error) {
      errors.push({
        serialNumber: serial.serialNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return {
    success: results.length,
    errorCount: errors.length,
    results,
    errors,
  }
}

/**
 * Validate serial numbers against expected list (for transfer verification)
 */
export async function validateSerialNumbersForTransfer({
  businessId,
  serialNumbers,
  expectedSerials,
  fromLocationId,
}: {
  businessId: number
  serialNumbers: string[]
  expectedSerials: string[]
  fromLocationId: number
}) {
  const validation = {
    valid: { select: { id: true, name: true } },
    errors: [] as string[],
    missing: [] as string[],
    extra: [] as string[],
    invalidStatus: [] as string[],
  }

  // Check for missing serials
  const receivedSet = new Set(serialNumbers)
  for (const expected of expectedSerials) {
    if (!receivedSet.has(expected)) {
      validation.missing.push(expected)
      validation.valid = false
    }
  }

  // Check for extra serials
  const expectedSet = new Set(expectedSerials)
  for (const received of serialNumbers) {
    if (!expectedSet.has(received)) {
      validation.extra.push(received)
      validation.valid = false
    }
  }

  // Validate each serial number
  for (const serialNumber of serialNumbers) {
    const record = await prisma.productSerialNumber.findUnique({
      where: {
        businessId_serialNumber: {
          businessId,
          serialNumber,
        },
      },
    })

    if (!record) {
      validation.errors.push(`Serial number ${serialNumber} not found`)
      validation.valid = false
      continue
    }

    if (record.status !== SerialNumberStatus.IN_TRANSIT) {
      validation.invalidStatus.push(`${serialNumber} (status: ${record.status})`)
      validation.valid = false
    }
  }

  return validation
}
