/**
 * Test Sales API with proper authentication
 * No browser - just API requests using cookie-based auth
 */

const { PrismaClient } = require('@prisma/client')
const { request } = require('@playwright/test')

const prisma = new PrismaClient()
const BASE_URL = 'http://127.0.0.1:3006'

async function testSalesWithAuth() {
  let context

  try {
    console.log('\n=== Testing Sales API with Authentication ===\n')

    // Create API request context
    context = await request.newContext({
      baseURL: BASE_URL
    })

    // Step 1: Login to get session cookie
    console.log('1. Logging in as superadmin...')
    const loginResponse = await context.post('/api/auth/callback/credentials', {
      form: {
        username: 'superadmin',
        password: 'password',
        redirect: 'false',
        json: 'true'
      }
    })

    console.log('Login status:', loginResponse.status())
    if (loginResponse.status() !== 200) {
      const body = await loginResponse.text()
      console.log('Login response:', body)
      throw new Error('Login failed')
    }

    console.log('✓ Login successful')

    // Step 2: Get test data
    console.log('\n2. Fetching test data...')
    const superadmin = await prisma.user.findFirst({
      where: { username: 'superadmin' },
      include: { business: { include: { locations: true } } }
    })

    const testLocationId = superadmin.business.locations[0].id
    console.log('✓ Business ID:', superadmin.businessId)
    console.log('✓ Location ID:', testLocationId)

    // Get or create customer
    let customer = await prisma.customer.findFirst({
      where: { businessId: superadmin.businessId }
    })

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          businessId: superadmin.businessId,
          name: 'Test Customer',
          mobile: '1234567890'
        }
      })
    }
    console.log('✓ Customer ID:', customer.id)

    // Get a product with stock
    const productWithStock = await prisma.variationLocationDetails.findFirst({
      where: {
        locationId: testLocationId,
        qtyAvailable: { gt: 0 }
      },
      include: {
        productVariation: true
      }
    })

    if (!productWithStock) {
      console.log('✗ No products with stock found. Please create some inventory first.')
      return
    }

    console.log('✓ Found product:', productWithStock.productVariation.name)
    console.log('✓ Available stock:', productWithStock.qtyAvailable.toString())

    // Step 3: Try to create a sale
    console.log('\n3. Creating a sale...')
    const saleData = {
      locationId: testLocationId,
      customerId: customer.id,
      saleDate: new Date().toISOString(),
      items: [
        {
          productId: productWithStock.productId,
          productVariationId: productWithStock.productVariationId,
          quantity: 1,
          unitPrice: parseFloat(productWithStock.productVariation.sellingPrice.toString()),
        }
      ],
      payments: [
        {
          method: 'cash',
          amount: parseFloat(productWithStock.productVariation.sellingPrice.toString()),
        }
      ],
      taxAmount: 0,
      discountAmount: 0,
      shippingCost: 0,
      notes: 'Test sale via API',
    }

    console.log('Sale data:', JSON.stringify(saleData, null, 2))

    const saleResponse = await context.post('/api/sales', {
      data: saleData
    })

    console.log('Sale creation status:', saleResponse.status())
    const responseBody = await saleResponse.text()
    console.log('Response:', responseBody)

    if (saleResponse.ok()) {
      const sale = JSON.parse(responseBody)
      console.log('\n✓✓✓ SALE CREATED SUCCESSFULLY ✓✓✓')
      console.log('Invoice Number:', sale.invoiceNumber)
      console.log('Total Amount:', sale.totalAmount)
      console.log('Status:', sale.status)
    } else {
      console.log('\n✗✗✗ SALE CREATION FAILED ✗✗✗')
    }

    console.log('\n=== Test Complete ===\n')
  } catch (error) {
    console.error('Error:', error.message)
    console.error(error.stack)
  } finally {
    if (context) {
      await context.dispose()
    }
    await prisma.$disconnect()
  }
}

testSalesWithAuth()
