import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.simple'
import { mobileRoute } from '@/lib/mobileCount'

export const dynamic = 'force-dynamic' // always per request (auth + live data)

/**
 * GET /api/mobile/count/products[?since=ISO]
 * Product list for offline lookup on the phone. BLIND: no quantities, no prices.
 * With `since`, only products/variations changed after that time (deleted ones
 * are returned with deleted: true so the phone can remove them).
 */
export const GET = mobileRoute(async (req, me) => {
  const sinceRaw = req.nextUrl.searchParams.get('since')
  const since = sinceRaw ? new Date(sinceRaw) : null
  if (since && isNaN(since.getTime())) {
    return NextResponse.json({ error: 'Invalid "since" date.' }, { status: 400 })
  }
  const serverTime = new Date().toISOString()

  const rows = await prisma.productVariation.findMany({
    where: {
      businessId: me.businessId,
      ...(since
        ? { OR: [{ updatedAt: { gt: since } }, { product: { updatedAt: { gt: since } } }] }
        : { deletedAt: null, product: { deletedAt: null, isActive: true } }),
    },
    select: {
      id: true,
      productId: true,
      name: true,
      sku: true,
      subSku: true,
      deletedAt: true,
      product: { select: { name: true, deletedAt: true, isActive: true } },
    },
    orderBy: { id: 'asc' },
  })

  return NextResponse.json({
    serverTime,
    products: rows.map(v => ({
      variationId: v.id,
      productId: v.productId,
      name: v.product.name,
      variationName: v.name,
      sku: v.sku,
      subSku: v.subSku,
      ...(since ? { deleted: !!(v.deletedAt || v.product.deletedAt || !v.product.isActive) } : {}),
    })),
  })
})
