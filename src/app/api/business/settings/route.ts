import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// GET - Fetch business settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const businessId = (session.user as any).businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: parseInt(businessId) },
      include: {
        currency: true,
      },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json({ business })
  } catch (error) {
    console.error('Error fetching business settings:', error)
    return NextResponse.json({ error: 'Failed to fetch business settings' }, { status: 500 })
  }
}

// PUT - Update business settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.BUSINESS_SETTINGS_EDIT)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      currencyId,
      startDate,
      taxNumber1,
      taxLabel1,
      taxNumber2,
      taxLabel2,
      defaultProfitPercent,
      timeZone,
      fyStartMonth,
      accountingMethod,
      defaultSalesDiscount,
      sellPriceTax,
      skuPrefix,
      skuFormat,
      enableTooltip,
      barcodeProductSKU,
      barcodeProductName,
      barcodeBusinessName,
      barcodeProductVariation,
      barcodeProductPrice,
      barcodePackingDate,
    } = body

    const business = await prisma.business.update({
      where: { id: parseInt(businessId) },
      data: {
        name,
        currencyId: currencyId ? parseInt(currencyId) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        taxNumber1,
        taxLabel1,
        taxNumber2,
        taxLabel2,
        defaultProfitPercent: defaultProfitPercent ? parseFloat(defaultProfitPercent) : undefined,
        timeZone,
        fyStartMonth: fyStartMonth ? parseInt(fyStartMonth) : undefined,
        accountingMethod,
        defaultSalesDiscount: defaultSalesDiscount ? parseFloat(defaultSalesDiscount) : null,
        sellPriceTax,
        skuPrefix,
        skuFormat,
        enableTooltip,
        barcodeProductSKU: barcodeProductSKU !== undefined ? barcodeProductSKU : undefined,
        barcodeProductName: barcodeProductName !== undefined ? barcodeProductName : undefined,
        barcodeBusinessName: barcodeBusinessName !== undefined ? barcodeBusinessName : undefined,
        barcodeProductVariation: barcodeProductVariation !== undefined ? barcodeProductVariation : undefined,
        barcodeProductPrice: barcodeProductPrice !== undefined ? barcodeProductPrice : undefined,
        barcodePackingDate: barcodePackingDate !== undefined ? barcodePackingDate : undefined,
      },
      include: {
        currency: true,
      },
    })

    return NextResponse.json({ business, message: 'Business settings updated successfully' })
  } catch (error) {
    console.error('Error updating business settings:', error)
    return NextResponse.json({ error: 'Failed to update business settings' }, { status: 500 })
  }
}
