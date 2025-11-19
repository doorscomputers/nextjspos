import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * Background Job Queue API
 *
 * Handles creation and listing of async jobs for long-running operations
 * This prevents HTTP timeout failures for large transactions
 */

// Job type definitions
export type JobType =
  | 'transfer_send'
  | 'transfer_complete'
  | 'sale_create'
  | 'purchase_approve'
  | 'purchase_receive'

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

// Job payload interfaces
export interface TransferSendPayload {
  transferId: number
  notes?: string
}

export interface TransferCompletePayload {
  transferId: number
  notes?: string
}

export interface SaleCreatePayload {
  locationId: number
  customerId?: number
  saleDate: string
  items: any[]
  payments: any[]
  taxAmount?: number
  discountAmount?: number
  shippingCost?: number
  notes?: string
  status?: string
  // BIR discount fields
  discountType?: string
  seniorCitizenId?: string
  seniorCitizenName?: string
  pwdId?: string
  pwdName?: string
  discountApprovedBy?: number
  vatExempt?: boolean
  cashTendered?: number
}

export interface PurchaseApprovePayload {
  receiptId: number
}

// POST /api/jobs - Create a new background job
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const userId = parseInt(String(user.id))

    const body = await request.json()
    const { type, payload } = body as { type: JobType; payload: any }

    // Validate job type
    const validTypes: JobType[] = [
      'transfer_send',
      'transfer_complete',
      'sale_create',
      'purchase_approve',
      'purchase_receive',
    ]

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid job type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate permissions based on job type
    const permissionMap: Record<JobType, string> = {
      transfer_send: PERMISSIONS.STOCK_TRANSFER_SEND,
      transfer_complete: PERMISSIONS.STOCK_TRANSFER_COMPLETE,
      sale_create: PERMISSIONS.SELL_CREATE,
      purchase_approve: PERMISSIONS.PURCHASE_RECEIVE,
      purchase_receive: PERMISSIONS.PURCHASE_RECEIVE,
    }

    const requiredPermission = permissionMap[type]
    if (!user.permissions?.includes(requiredPermission)) {
      return NextResponse.json(
        { error: `Forbidden - Requires ${requiredPermission} permission` },
        { status: 403 }
      )
    }

    // Calculate total items for progress tracking
    let total = 0
    if (type === 'transfer_send' || type === 'transfer_complete') {
      const transferId = (payload as TransferSendPayload).transferId
      const transfer = await prisma.stockTransfer.findUnique({
        where: { id: transferId },
        select: { items: true },
      })
      total = transfer?.items.length || 0
    } else if (type === 'sale_create') {
      const salePayload = payload as SaleCreatePayload
      total = salePayload.items?.length || 0
    } else if (type === 'purchase_approve') {
      const purchasePayload = payload as PurchaseApprovePayload
      const receipt = await prisma.purchaseReceipt.findUnique({
        where: { id: purchasePayload.receiptId },
        select: { items: true },
      })
      total = receipt?.items.length || 0
    }

    // Create job
    const job = await prisma.job.create({
      data: {
        businessId,
        userId,
        type,
        status: 'pending',
        progress: 0,
        total,
        payload: payload as any, // Cast to Prisma.JsonValue
        attempts: 0,
        maxAttempts: 3,
      },
    })

    console.log(`✅ Job created: ${job.id} (type: ${type}, total: ${total} items)`)

    // Return immediately with job ID
    return NextResponse.json(
      {
        jobId: job.id,
        status: 'pending',
        message: `Job created. Processing ${total} items in background.`,
      },
      { status: 202 } // 202 Accepted
    )
  } catch (error: any) {
    console.error('Error creating job:', error)
    return NextResponse.json(
      { error: 'Failed to create job', details: error.message },
      { status: 500 }
    )
  }
}

// GET /api/jobs - List jobs for current user/business
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const userId = parseInt(String(user.id))

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as JobStatus | null
    const type = searchParams.get('type') as JobType | null
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {
      businessId,
    }

    // Users can only see their own jobs (unless admin)
    if (!user.permissions?.includes(PERMISSIONS.VIEW_ALL_JOBS)) {
      where.userId = userId
    }

    if (status) {
      where.status = status
    }

    if (type) {
      where.type = type
    }

    const jobs = await prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        total: true,
        error: true,
        attempts: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        // Don't return payload or result (too large)
      },
    })

    return NextResponse.json(jobs)
  } catch (error: any) {
    console.error('Error fetching jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs', details: error.message },
      { status: 500 }
    )
  }
}
