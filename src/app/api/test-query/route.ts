import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * TEST ENDPOINT - For automated testing only
 * Allows tests to query database records directly
 *
 * SECURITY: Only enabled in development mode
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test endpoint not available in production' },
      { status: 403 }
    )
  }

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { query, where, include, orderBy, take, skip } = body

    // Map query names to Prisma models
    const modelMap: Record<string, any> = {
      productSerialNumber: prisma.productSerialNumber,
      serialNumberMovement: prisma.serialNumberMovement,
      purchase: prisma.purchase,
      purchaseItem: prisma.purchaseItem,
      purchaseReceipt: prisma.purchaseReceipt,
      purchaseReceiptItem: prisma.purchaseReceiptItem,
      stockTransaction: prisma.stockTransaction,
      variationLocationDetails: prisma.variationLocationDetails,
      sale: prisma.sale,
      saleItem: prisma.saleItem,
      customer: prisma.customer,
      supplier: prisma.supplier,
    }

    const model = modelMap[query]

    if (!model) {
      return NextResponse.json(
        { error: `Unknown query model: ${query}` },
        { status: 400 }
      )
    }

    // Execute query
    const options: any = { where }
    if (include) options.include = include
    if (orderBy) options.orderBy = orderBy
    if (take) options.take = take
    if (skip) options.skip = skip

    const result = await model.findFirst(options)

    if (!result) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Test query error:', error)
    return NextResponse.json(
      {
        error: 'Test query failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Also support findMany for listing records
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test endpoint not available in production' },
      { status: 403 }
    )
  }

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const whereJson = searchParams.get('where')
    const includeJson = searchParams.get('include')

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter required' },
        { status: 400 }
      )
    }

    const modelMap: Record<string, any> = {
      productSerialNumber: prisma.productSerialNumber,
      serialNumberMovement: prisma.serialNumberMovement,
      purchase: prisma.purchase,
      purchaseItem: prisma.purchaseItem,
      purchaseReceipt: prisma.purchaseReceipt,
      purchaseReceiptItem: prisma.purchaseReceiptItem,
      stockTransaction: prisma.stockTransaction,
      variationLocationDetails: prisma.variationLocationDetails,
      sale: prisma.sale,
      saleItem: prisma.saleItem,
      customer: prisma.customer,
      supplier: prisma.supplier,
    }

    const model = modelMap[query]

    if (!model) {
      return NextResponse.json(
        { error: `Unknown query model: ${query}` },
        { status: 400 }
      )
    }

    const options: any = {}
    if (whereJson) options.where = JSON.parse(whereJson)
    if (includeJson) options.include = JSON.parse(includeJson)

    const results = await model.findMany(options)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Test query error:', error)
    return NextResponse.json(
      {
        error: 'Test query failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
