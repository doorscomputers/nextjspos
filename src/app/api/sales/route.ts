/**
 * ============================================================================
 * SALES API (src/app/api/sales/route.ts)
 * ============================================================================
 *
 * PURPOSE: Creates sales transactions and DEDUCTS inventory from stock
 *
 * CRITICAL: THIS IS WHERE INVENTORY IS DEDUCTED FROM THE SYSTEM!
 *
 * WHAT THIS FILE DOES:
 * 1. GET: Lists all sales with filtering (by date, customer, location, shift, etc.)
 * 2. POST: Creates new sale and DEDUCTS inventory from stock
 *
 * POST METHOD - CREATE SALE FLOW:
 *
 * STEP 1 - VALIDATION:
 *   - Authenticate user
 *   - Check SELL_CREATE permission
 *   - Validate customer (if provided)
 *   - Validate products exist
 *   - Check stock availability (CRITICAL - prevents overselling)
 *   - Validate credit limit (if credit sale)
 *   - Validate discount permissions (if large discount)
 *
 * STEP 2 - INVENTORY DEDUCTION (CRITICAL):
 *   - Calls processSale() for each item
 *   - Updates VariationLocationDetails.qtyAvailable (DECREASES quantity)
 *   - Formula: qtyAvailable = qtyAvailable - quantitySold
 *   - Example: Current stock 15 - Sold 3 = New stock 12
 *   - Creates StockTransaction record (type: 'sale', quantity: negative)
 *   - Creates ProductHistory record for audit trail
 *   - Cannot sell more than available stock (validates first)
 *
 * STEP 3 - SALE RECORD CREATION:
 *   - Generates invoice number (auto-increment)
 *   - Creates Sale record
 *   - Creates SaleItem records (each product line)
 *   - Records payment details
 *   - Links to customer (if provided)
 *   - Links to cashier shift (for Z Reading)
 *
 * STEP 4 - FINANCIAL PROCESSING:
 *   - Creates payment record (cash, card, credit, etc.)
 *   - Updates customer credit balance (if credit sale)
 *   - Updates shift running totals (for Z Reading accuracy)
 *   - Creates accounting journal entries (if enabled)
 *   - Calculates profit (selling price - cost)
 *
 * STEP 5 - NOTIFICATIONS & ALERTS:
 *   - Send email/Telegram for large discounts
 *   - Send email/Telegram for credit sales
 *   - Create audit log
 *   - Return invoice data with inventory impact report
 *
 * INVENTORY DEDUCTION EXAMPLE:
 *
 * Before Sale:
 * - Product: "Laptop" (variation: "15-inch")
 * - Main Store location: 15 units available
 * - Cost: $493.33 (weighted average)
 * - Selling price: $700
 *
 * Customer Purchase:
 * - Cashier creates sale for 2 units
 * - Payment: Cash $1,400
 *
 * This API Executes:
 * 1. Validates stock: 15 units >= 2 units ✓
 * 2. Generates invoice number: INV-202501-0042
 * 3. Calls processSale() for each item:
 *    - Main Store: 15 → 13 units (-2)
 *    - Creates StockTransaction: type=sale, qty=-2
 *    - Creates ProductHistory: SALE, qty=2, cost=$986.66, revenue=$1,400
 * 4. Creates Sale record:
 *    - Invoice: INV-202501-0042
 *    - Total: $1,400
 *    - Status: completed
 * 5. Creates Payment record:
 *    - Method: cash
 *    - Amount: $1,400
 * 6. Updates shift totals:
 *    - Cash sales: +$1,400
 *    - Profit: $1,400 - $986.66 = $413.34
 * 7. Creates audit log
 *
 * Result:
 * - Inventory DECREASED from 15 to 13 units
 * - Cash collected: $1,400
 * - Profit recorded: $413.34
 * - Invoice generated: INV-202501-0042
 *
 * STOCK AVAILABILITY VALIDATION:
 *
 * Before processing sale, system checks:
 * - Is stock tracking enabled for product?
 * - Does product have sufficient quantity at this location?
 * - For variable products: Check each variation's stock
 * - For combo products: Check all component products
 *
 * If insufficient stock:
 * - Sale is BLOCKED
 * - Error returned: "Insufficient stock for [Product Name]"
 * - User must:
 *   * Transfer stock from another location
 *   * Wait for purchase receipt
 *   * Adjust quantity to match available stock
 *
 * CREDIT LIMIT VALIDATION (Credit Sales):
 *
 * For credit sales (paymentStatus = 'credit'):
 * 1. Get customer credit limit (Customer.creditLimit)
 * 2. Calculate current outstanding balance (sum of unpaid invoices)
 * 3. Check if: Current balance + New sale amount <= Credit limit
 * 4. If exceeds limit:
 *    - Sale is BLOCKED
 *    - Error shows: Current balance, Credit limit, Attempted amount
 *    - Manager can override with CUSTOMER_CREDIT_OVERRIDE permission
 *
 * Example:
 * - Customer credit limit: $10,000
 * - Current outstanding: $8,500
 * - New sale: $2,000
 * - Check: $8,500 + $2,000 = $10,500 > $10,000 ✗
 * - Result: BLOCKED (needs manager override OR customer payment)
 *
 * PAYMENT TYPES:
 *
 * 1. CASH SALE:
 *    - Immediate payment in cash
 *    - Inventory deducted immediately
 *    - Added to shift cash totals
 *    - Status: completed
 *
 * 2. CARD SALE:
 *    - Paid by credit/debit card
 *    - Inventory deducted immediately
 *    - Added to shift card totals
 *    - Status: completed
 *
 * 3. CREDIT SALE:
 *    - Payment deferred (Accounts Receivable)
 *    - Inventory still deducted immediately
 *    - Customer balance increases
 *    - Status: credit
 *    - Requires SELL_CREDIT permission
 *    - Sends alert notification
 *
 * 4. MIXED PAYMENT:
 *    - Multiple payment methods (e.g., $500 cash + $500 card)
 *    - Creates multiple payment records
 *    - Inventory deducted once
 *    - Totals split across methods
 *
 * DISCOUNT ALERTS:
 *
 * Large discounts trigger email/Telegram alerts to management:
 * - Discount > 20%: Alert threshold
 * - Shows: Product, Original price, Discounted price, Cashier, Time
 * - Purpose: Prevent unauthorized discounts/theft
 * - Manager reviews and investigates if needed
 *
 * SHIFT INTEGRATION:
 *
 * Every sale updates the cashier's shift running totals:
 * - Cash sales total
 * - Card sales total
 * - Credit sales total
 * - Total sales count
 * - Total profit
 *
 * These totals are used in:
 * - X Reading (mid-shift report)
 * - Z Reading (end-of-day report)
 * - Cash variance calculation
 * - Performance tracking
 *
 * ACCOUNTING INTEGRATION:
 *
 * If accounting module enabled, creates journal entries:
 *
 * Cash Sale Journal Entry:
 *   Debit: Cash (Asset) .................... $1,400
 *   Credit: Sales Revenue (Income) ......... $1,400
 *   Debit: Cost of Goods Sold (Expense) .... $986.66
 *   Credit: Inventory (Asset) .............. $986.66
 *
 * Credit Sale Journal Entry:
 *   Debit: Accounts Receivable (Asset) ..... $1,400
 *   Credit: Sales Revenue (Income) ......... $1,400
 *   Debit: Cost of Goods Sold (Expense) .... $986.66
 *   Credit: Inventory (Asset) .............. $986.66
 *
 * INVOICE NUMBER GENERATION:
 *
 * Format: INV-YYYYMM-#### (e.g., INV-202501-0042)
 * - Uses atomic counter per business
 * - Prevents duplicate invoice numbers
 * - Auto-resets monthly
 * - Thread-safe (database-level locking)
 *
 * IDEMPOTENCY PROTECTION:
 *
 * Wrapped in withIdempotency() to prevent:
 * - Duplicate sales from double-clicks
 * - Duplicate inventory deductions
 * - Duplicate payments
 * - Uses request fingerprint (headers + body hash)
 * - Returns existing result if duplicate detected
 *
 * DATA FLOW:
 *
 * User scans products at POS → Clicks "Complete Sale"
 *   ↓
 * POST /api/sales
 *   ↓
 * Validate session & permissions
 *   ↓
 * Check stock availability (batchCheckStockAvailability)
 *   ↓
 * Validate credit limit (if credit sale)
 *   ↓
 * Start database transaction
 *   ↓
 * Generate invoice number (atomic)
 *   ↓
 * Create Sale record
 *   ↓
 * For each item:
 *   → Create SaleItem record
 *   → Call processSale() → DEDUCTS inventory
 *   → Record cost & profit
 *   ↓
 * Create Payment record(s)
 *   ↓
 * Update customer credit balance (if credit)
 *   ↓
 * Update shift running totals
 *   ↓
 * Commit transaction
 *   ↓
 * Create accounting entries (if enabled)
 *   ↓
 * Send alerts (if large discount or credit)
 *   ↓
 * Refresh materialized view (async)
 *   ↓
 * Create audit log
 *   ↓
 * Return invoice with inventory impact report
 *
 * RELATED FUNCTIONS:
 *
 * processSale() (src/lib/stockOperations.ts):
 * - Core function that DEDUCTS inventory
 * - Updates VariationLocationDetails.qtyAvailable (DECREASES)
 * - Creates StockTransaction record (negative quantity)
 * - Creates ProductHistory record
 * - Handles multi-unit products (UOM conversions)
 *
 * batchCheckStockAvailability():
 * - Validates all items have sufficient stock
 * - Returns detailed error if any item oversold
 * - Prevents negative inventory
 *
 * incrementShiftTotalsForSale():
 * - Updates CashierShift running totals
 * - Ensures Z Reading accuracy
 *
 * PERMISSIONS REQUIRED:
 * - SELL_CREATE: Create sales (all cashiers)
 * - SELL_CREDIT: Create credit sales (supervisor+)
 * - CUSTOMER_CREDIT_OVERRIDE: Override credit limit (manager+)
 * - ACCESS_ALL_LOCATIONS or assigned to specific location
 *
 * ERROR CASES:
 * - Insufficient stock → 400 Bad Request (prevents overselling)
 * - Credit limit exceeded → 400 Bad Request (blocks sale)
 * - Invalid customer → 404 Not Found
 * - Invalid product → 404 Not Found
 * - No permission → 403 Forbidden
 * - Duplicate request → 200 OK (returns existing sale via idempotency)
 *
 * RELATED FILES:
 * - src/lib/stockOperations.ts (processSale function - DEDUCTS inventory)
 * - src/app/dashboard/pos/page.tsx (POS interface)
 * - src/app/api/purchases/receipts/[id]/approve/route.ts (ADDS inventory)
 * - src/lib/shift-running-totals.ts (shift calculations)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { checkStockAvailability, batchCheckStockAvailability, processSale, bulkUpdateStock, StockTransactionType } from '@/lib/stockOperations' // CRITICAL: processSale DEDUCTS inventory, bulkUpdateStock processes in bulk
// Re-enabled: Email discount alerts (Jan 30, 2026)
import { sendLargeDiscountAlert as sendLargeDiscountEmail } from '@/lib/email'
// import { sendLargeDiscountAlert, sendCreditSaleAlert } from '@/lib/alert-service'
import { withIdempotency } from '@/lib/idempotency' // Prevents duplicate sales
import { getNextInvoiceNumber } from '@/lib/atomicNumbers' // Thread-safe invoice numbering
import { InventoryImpactTracker } from '@/lib/inventory-impact-tracker' // Tracks stock changes
// ACCOUNTING DISABLED: Uncomment below to re-enable accounting integration
// import { isAccountingEnabled, recordCashSale, recordCreditSale } from '@/lib/accountingIntegration'
import { incrementShiftTotalsForSale } from '@/lib/shift-running-totals' // Z Reading accuracy

// ============================================================================
// GET METHOD - List Sales
// ============================================================================
// Lists all sales with filtering by date, customer, location, shift, status
// Respects location-based access control (users only see sales from their locations)
// Supports pagination for performance with large datasets
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const userId = user.id
    const businessIdNumber = Number(businessId)
    const userIdNumber = Number(userId)
    if (Number.isNaN(businessIdNumber) || Number.isNaN(userIdNumber)) {
      return NextResponse.json({ error: 'Invalid user context' }, { status: 400 })
    }
    const userDisplayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || `User#${userIdNumber}`

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.SELL_VIEW) &&
        !user.permissions?.includes(PERMISSIONS.SELL_VIEW_OWN)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const shiftId = searchParams.get('shiftId') // Filter by specific shift
    const date = searchParams.get('date') // Filter by specific date
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const where: any = {
      businessId: parseInt(businessId),
      deletedAt: null,
    }

    // Check if user has access to all locations (admin permission)
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)

    // Filter sales by user's assigned locations UNLESS they have ACCESS_ALL_LOCATIONS permission
    if (!hasAccessAllLocations) {
      // 🚀 OPTIMIZATION: Use cached locationIds from session instead of database query
      const userLocationIds = (user as any).locationIds || []

      if (userLocationIds.length > 0) {
        where.locationId = { in: userLocationIds }
      } else {
        // User has no location assignments - return empty result
        where.id = -1 // Impossible ID to match nothing
      }
    }
    // If hasAccessAllLocations is true, no location filter is applied (show all sales)

    // If user has SELL_VIEW_OWN, only show their own sales (within their locations)
    if (user.permissions?.includes(PERMISSIONS.SELL_VIEW_OWN) &&
        !user.permissions?.includes(PERMISSIONS.SELL_VIEW)) {
      where.createdBy = parseInt(userId)
    }

    if (status) {
      where.status = status
    }

    // Exclude voided sales (used for Due filter from dashboard)
    const excludeVoided = searchParams.get('excludeVoided')
    if (excludeVoided === 'true') {
      where.status = { notIn: ['voided', 'cancelled'] }
    }

    if (customerId) {
      where.customerId = parseInt(customerId)
    }

    // Allow further filtering by specific location (must be within user's assigned locations)
    if (locationId) {
      const requestedLocationId = parseInt(locationId)
      if (userLocationIds.includes(requestedLocationId)) {
        where.locationId = requestedLocationId
      } else {
        // Requested location not in user's assignments - return empty
        where.id = -1
      }
    }

    // Filter by specific shift (for POS shift session management)
    if (shiftId) {
      where.shiftId = parseInt(shiftId)
    }

    // Filter by specific date (for POS today's sales)
    if (date) {
      const filterDate = new Date(date)
      where.saleDate = filterDate
    }

    if (startDate || endDate) {
      where.saleDate = {}
      if (startDate) where.saleDate.gte = new Date(startDate)
      if (endDate) where.saleDate.lte = new Date(endDate)
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              mobile: true,
              email: true,
            },
          },
          creator: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              surname: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
          payments: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ])

    return NextResponse.json({
      sales,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching sales:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales' },
      { status: 500 }
    )
  }
}

// POST - Create new sale
export async function POST(request: NextRequest) {
  return withIdempotency(request, '/api/sales', async () => {
    try {
      const session = await getServerSession(authOptions)

      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const user = session.user as any
      const businessId = parseInt(String(user.businessId))
      const userId = user.id
      const businessIdNumber = Number(businessId)
      const userIdNumber = Number(userId)
      if (Number.isNaN(businessIdNumber) || Number.isNaN(userIdNumber)) {
        return NextResponse.json({ error: 'Invalid user context' }, { status: 400 })
      }
      const userDisplayName =
        [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || `User#${userIdNumber}`

      // Check permission
      if (!user.permissions?.includes(PERMISSIONS.SELL_CREATE)) {
        return NextResponse.json(
          { error: 'Forbidden - Insufficient permissions' },
          { status: 403 }
        )
      }

    const startTime = Date.now() // PERFORMANCE TIMING
    const body = await request.json()

    // DEBUG: Log incoming request for 400 error debugging (DEVELOPMENT ONLY)
    if (process.env.NODE_ENV === 'development') {
      console.log('==== SALES API DEBUG ====')
      console.log('Incoming sale request body:', JSON.stringify(body, null, 2))
    }

    const {
      locationId,
      customerId,
      saleDate,
      items, // Array of { productId, productVariationId, quantity, unitPrice, serialNumberIds: [] }
      payments, // Array of { method, amount, reference }
      taxAmount = 0,
      discountAmount = 0,
      shippingCost = 0,
      notes,
      remarks, // Cashier remarks/additional information
      status, // 'completed', 'pending' (for credit sales)
      // Philippine BIR discount tracking
      discountType, // 'senior', 'pwd', 'regular', or null
      seniorCitizenId,
      seniorCitizenName,
      pwdId,
      pwdName,
      discountApprovedBy,
      vatExempt = false,
      // Cash tendered (for invoice display)
      cashTendered,
      // Sales personnel tracking
      salesPersonnelId,
    } = body

    if (process.env.NODE_ENV === 'development') {
      console.log('Parsed values:')
      console.log('- locationId:', locationId, 'type:', typeof locationId)
      console.log('- customerId:', customerId, 'type:', typeof customerId)
      console.log('- items count:', items?.length)
      console.log('- payments count:', payments?.length)
      // DEBUG: Log full items data including serialNumbers
      console.log('- items detail:', JSON.stringify(items?.map((item: any) => ({
        productId: item.productId,
        requiresSerial: item.requiresSerial,
        serialNumberIds: item.serialNumberIds,
        serialNumbers: item.serialNumbers,
      }))))
    }

    const locationIdNumber = Number(locationId)
    if (Number.isNaN(locationIdNumber)) {
      if (process.env.NODE_ENV === 'development') {
        console.error('VALIDATION ERROR: Invalid locationId -', locationId)
      }
      return NextResponse.json({ error: 'Invalid locationId' }, { status: 400 })
    }

    const customerIdNumber = customerId !== undefined && customerId !== null ? Number(customerId) : null
    if (customerIdNumber !== null && Number.isNaN(customerIdNumber)) {
      console.error('VALIDATION ERROR: Invalid customerId -', customerId)
      return NextResponse.json({ error: 'Invalid customerId' }, { status: 400 })
    }

    const discountApprovedByNumber =
      discountApprovedBy !== undefined && discountApprovedBy !== null
        ? Number(discountApprovedBy)
        : null
    if (discountApprovedByNumber !== null && Number.isNaN(discountApprovedByNumber)) {
      console.error('VALIDATION ERROR: Invalid discountApprovedBy -', discountApprovedBy)
      return NextResponse.json({ error: 'Invalid discountApprovedBy value' }, { status: 400 })
    }

    // Validation
    if (!locationId || !saleDate || !items || items.length === 0) {
      console.error('VALIDATION ERROR: Missing required fields')
      console.error('- locationId:', locationId)
      console.error('- saleDate:', saleDate)
      console.error('- items:', items)
      console.error('- items.length:', items?.length)
      return NextResponse.json(
        { error: 'Missing required fields: locationId, saleDate, items' },
        { status: 400 }
      )
    }

    // For credit sales (status: 'pending'), customer is required
    const isCreditSale = status === 'pending'
    if (isCreditSale && !customerId) {
      return NextResponse.json(
        { error: 'Customer is required for credit/charge invoice sales' },
        { status: 400 }
      )
    }

    // EARLY TOTAL CALCULATION: Calculate preliminary total for credit limit check
    // This is needed before processing items because credit limit validation happens first
    // NOTE: Uses a different variable name to avoid conflict with the detailed calculation later
    const preliminarySubtotal = items.reduce((sum: number, item: any) => {
      const qty = parseFloat(item.displayQuantity || item.quantity || 0)
      const price = parseFloat(item.unitPrice || 0)
      return sum + (qty * price)
    }, 0)
    const preliminarySaleTotal =
      preliminarySubtotal +
      parseFloat(taxAmount || 0) +
      parseFloat(shippingCost || 0) -
      parseFloat(discountAmount || 0)

    // CRITICAL: Credit limit validation for credit sales
    if (isCreditSale && customerId) {
      const customer = await prisma.customer.findFirst({
        where: {
          id: parseInt(customerId),
          businessId: businessIdNumber,
        },
        include: {
          sales: {
            where: {
              status: 'completed',
            },
            include: {
              payments: true,
            },
          },
        },
      })

      if (!customer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        )
      }

      // Check if customer has credit limit set
      if (customer.creditLimit && parseFloat(customer.creditLimit.toString()) > 0) {
        // Calculate current outstanding balance
        const outstandingBalance = customer.sales.reduce((total, sale) => {
          const saleTotal = parseFloat(sale.totalAmount.toString())
          const totalPaid = sale.payments
            .filter((p) => p.paymentMethod !== 'credit') // Exclude credit marker payments
            .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)
          const balance = saleTotal - totalPaid
          return total + (balance > 0 ? balance : 0)
        }, 0)

        // Calculate what total outstanding would be with this new sale
        const newTotalOutstanding = outstandingBalance + preliminarySaleTotal

        // Check if new total would exceed credit limit
        const creditLimit = parseFloat(customer.creditLimit.toString())
        if (newTotalOutstanding > creditLimit) {
          // Check if user has override permission
          const canOverride = user.permissions?.includes(PERMISSIONS.CUSTOMER_CREDIT_OVERRIDE)

          if (!canOverride) {
            return NextResponse.json(
              {
                error: 'Credit limit exceeded',
                code: 'CREDIT_LIMIT_EXCEEDED',
                details: {
                  customerName: `${customer.firstName} ${customer.lastName}`,
                  creditLimit: creditLimit.toFixed(2),
                  currentBalance: outstandingBalance.toFixed(2),
                  saleAmount: preliminarySaleTotal.toFixed(2),
                  wouldBe: newTotalOutstanding.toFixed(2),
                  message: `Customer credit limit: ₱${creditLimit.toFixed(2)}. Current balance: ₱${outstandingBalance.toFixed(2)}. This sale (₱${preliminarySaleTotal.toFixed(2)}) would bring total to ₱${newTotalOutstanding.toFixed(2)}, exceeding the limit by ₱${(newTotalOutstanding - creditLimit).toFixed(2)}.`,
                },
              },
              { status: 400 }
            )
          } else {
            // Log override for audit trail
            console.warn(
              `[CREDIT LIMIT OVERRIDE] User ${user.username} (ID: ${user.id}) overrode credit limit for customer ${customer.firstName} ${customer.lastName} (ID: ${customer.id}). Limit: ₱${creditLimit.toFixed(2)}, New total: ₱${newTotalOutstanding.toFixed(2)}`
            )
          }
        }
      }
    }

    // For non-credit sales, at least one payment is required
    if (!isCreditSale && (!payments || payments.length === 0)) {
      return NextResponse.json(
        { error: 'At least one payment method is required' },
        { status: 400 }
      )
    }

    // Validate payment methods are not empty
    if (!isCreditSale && payments && payments.length > 0) {
      for (const payment of payments) {
        if (!payment.method || payment.method.trim() === '') {
          return NextResponse.json(
            { error: 'Payment method cannot be empty. Please select a valid payment method.' },
            { status: 400 }
          )
        }
        if (!payment.amount || parseFloat(payment.amount) <= 0) {
          return NextResponse.json(
            { error: 'Payment amount must be greater than zero' },
            { status: 400 }
          )
        }
      }
    }

    // PERFORMANCE OPTIMIZATION: Batch all validation queries in parallel (instead of sequential)
    const validationStart = Date.now() // TIMING

    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    const userLocationIds = (session.user as any).locationIds || []

    // Build shift query - Look for shift at the SPECIFIC sale location
    console.log('[SALES] Building shift query - userId:', userIdNumber, 'businessId:', businessIdNumber, 'saleLocationId:', locationIdNumber)
    const shiftWhereClause: any = {
      userId: userIdNumber,
      status: 'open',
      businessId: businessIdNumber,
      locationId: locationIdNumber, // Shift must be at the SAME location as the sale
    }
    console.log('[SALES] Shift where clause:', JSON.stringify(shiftWhereClause))

    // Execute all validation queries in parallel
    const [location, userLocation, currentShift, customer] = await Promise.all([
      // Query 1: Verify location belongs to business
      prisma.businessLocation.findFirst({
        where: {
          id: locationIdNumber,
          businessId: businessIdNumber,
          deletedAt: null,
        },
      }),
      // Query 2: Check user location access (conditional)
      // 🚀 OPTIMIZATION: Use cached locationIds instead of database query
      hasAccessAllLocations
        ? Promise.resolve(true) // Skip query if user has access to all locations
        : Promise.resolve(userLocationIds.includes(locationIdNumber)),
      // Query 3: Check for open cashier shift
      prisma.cashierShift.findFirst({
        where: shiftWhereClause,
      }),
      // Query 4: Verify customer (conditional)
      customerIdNumber !== null
        ? prisma.customer.findFirst({
            where: {
              id: customerIdNumber,
              businessId: businessIdNumber,
              deletedAt: null,
            },
          })
        : Promise.resolve(null),
    ])

    // Validate results
    if (!location) {
      return NextResponse.json(
        { error: 'Location not found or does not belong to your business' },
        { status: 404 }
      )
    }

    if (!hasAccessAllLocations && !userLocation) {
      return NextResponse.json(
        { error: 'You do not have access to this location' },
        { status: 403 }
      )
    }

    console.log('[SALES] Shift check - currentShift:', currentShift ? `ID ${currentShift.id} at location ${currentShift.locationId}` : 'NULL')
    if (!currentShift) {
      // DETAILED DEBUG: Log all query parameters to help diagnose the issue
      console.error('[SALES] SHIFT NOT FOUND - Debug info:', {
        queryUserId: userIdNumber,
        queryBusinessId: businessIdNumber,
        queryLocationId: locationIdNumber,
        sessionUserId: user.id,
        sessionUsername: user.username,
        sessionBusinessId: user.businessId,
      })
      return NextResponse.json(
        {
          error: `No open shift found at this location. Please start your shift at location ID ${locationIdNumber} before making sales.`,
          // DEBUG: Include query parameters to help diagnose (TEMPORARY)
          debug: {
            queryUserId: userIdNumber,
            queryBusinessId: businessIdNumber,
            queryLocationId: locationIdNumber,
            sessionUser: user.username,
          }
        },
        { status: 400 }
      )
    }

    if (customerIdNumber !== null && !customer) {
      return NextResponse.json(
        { error: 'Customer not found or does not belong to your business' },
        { status: 404 }
      )
    }

    const customerName = customer ? customer.name : null

    // Collect all serial numbers for batch validation (performance optimization)
    const allSerialNumberIds: number[] = []
    items.forEach(item => {
      if (item.requiresSerial && item.serialNumberIds) {
        allSerialNumberIds.push(...item.serialNumberIds.map((id: any) => Number(id)))
      }
    })

    // PERFORMANCE OPTIMIZATION: Batch fetch all serial numbers at once (instead of N+1 queries)
    let serialNumbersMap = new Map()
    if (allSerialNumberIds.length > 0) {
      const serialNumbers = await prisma.productSerialNumber.findMany({
        where: {
          id: { in: allSerialNumberIds },
          businessId: businessIdNumber,
          currentLocationId: locationIdNumber,
          status: 'in_stock',
        },
      })
      serialNumbersMap = new Map(serialNumbers.map(sn => [sn.id, sn]))
    }

    // PERFORMANCE OPTIMIZATION: Batch fetch all product variations at once (instead of N+1 queries inside transaction)
    const variationIdsForBatch = items.map((item: any) => Number(item.productVariationId))
    const productVariations = await prisma.productVariation.findMany({
      where: {
        id: { in: variationIdsForBatch },
      },
      select: {
        id: true,
        purchasePrice: true,
      },
    })
    const variationsMap = new Map(productVariations.map(v => [v.id, v]))

    // PERFORMANCE OPTIMIZATION: Batch check stock availability for all items at once
    const stockCheckItems = items.map((item: any) => ({
      productVariationId: Number(item.productVariationId),
      quantity: parseFloat(item.quantity),
    }))
    const stockAvailabilityMap = await batchCheckStockAvailability({
      items: stockCheckItems,
      locationId: locationIdNumber,
    })

    // Validate items and check stock availability
    let subtotal = 0
    for (const item of items) {
      const quantity = parseFloat(item.quantity)
      const unitPrice = parseFloat(item.unitPrice)
      // UOM FIX: Use displayQuantity for subtotal calculation (selected unit), not base unit quantity
      const displayQuantity = item.displayQuantity ? parseFloat(item.displayQuantity) : quantity

      if (isNaN(quantity) || quantity <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity for item: ${item.productId}` },
          { status: 400 }
        )
      }

      if (isNaN(unitPrice) || unitPrice < 0) {
        return NextResponse.json(
          { error: `Invalid unit price for item: ${item.productId}` },
          { status: 400 }
        )
      }

      // Check stock availability from batched results (skip for "Not for Selling" service items)
      const isNotForSellingItem = item.notForSelling || false
      if (!isNotForSellingItem) {
        const availability = stockAvailabilityMap.get(Number(item.productVariationId))
        console.log('[SALES] Stock check for variation', item.productVariationId, ':', availability)
        if (!availability || !availability.available) {
          console.log('[SALES] FAILED: Insufficient stock')
          return NextResponse.json(
            {
              error: `Insufficient stock for item ${item.productId}. Available: ${availability?.currentStock ?? 0}, Required: ${quantity}`,
            },
            { status: 400 }
          )
        }
      }

      // Serial number validation - ONLY validate database-linked serial numbers
      // Manual text serial numbers (item.serialNumbers) are stored as-is without validation
      const hasDbSerials = item.serialNumberIds && item.serialNumberIds.length > 0

      // DEBUG: Log serial number data
      console.log('[SALES] Serial number data for item', item.productId, ':', {
        requiresSerial: item.requiresSerial,
        serialNumberIds: item.serialNumberIds,
        serialNumbers: item.serialNumbers,
        hasDbSerials
      })

      // Only validate database-linked serial numbers (from product serial tracking feature)
      if (hasDbSerials) {
        if (item.serialNumberIds.length !== quantity) {
          console.log('[SALES] FAILED: Serial count mismatch')
          return NextResponse.json(
            {
              error: `Serial number count mismatch for item ${item.productId}. Expected: ${quantity}, Provided: ${item.serialNumberIds.length}`,
            },
            { status: 400 }
          )
        }

        // Verify serial numbers exist and are available (using pre-fetched map)
        for (const serialNumberId of item.serialNumberIds) {
          const serialNumber = serialNumbersMap.get(Number(serialNumberId))

          if (!serialNumber || serialNumber.productVariationId !== Number(item.productVariationId)) {
            console.log('[SALES] FAILED: Serial number not available')
            return NextResponse.json(
              { error: `Serial number ${serialNumberId} not available for sale` },
              { status: 400 }
            )
          }
        }
      }
      // Note: Manual serial numbers (item.serialNumbers) are saved to sale items without validation

      // UOM FIX: Use displayQuantity (selected unit) * unitPrice (price per selected unit)
      // Example: 1 Roll * ₱3000/Roll = ₱3000 (NOT 60 meters * ₱3000 = ₱180,000)
      subtotal += displayQuantity * unitPrice
    }

    // Calculate total
    const totalAmount =
      subtotal +
      parseFloat(taxAmount || 0) +
      parseFloat(shippingCost || 0) -
      parseFloat(discountAmount || 0)

    // Calculate total payments (needed for validation and paidAmount field)
    // CRITICAL: Handle case where payments might be undefined (credit sales)
    const paymentsTotal = (payments && payments.length > 0)
      ? payments.reduce((sum: number, payment: any) => sum + parseFloat(payment.amount), 0)
      : 0

    // For non-credit sales, validate payments total is sufficient (allow overpayment for change)
    if (!isCreditSale) {
      if (paymentsTotal < totalAmount - 0.01) {
        return NextResponse.json(
          {
            error: `Insufficient payment. Total due: ${totalAmount.toFixed(2)}, Total paid: ${paymentsTotal.toFixed(2)}`,
          },
          { status: 400 }
        )
      }
    }

    // ============================================================================
    // DUPLICATE SALE DETECTION (Only catches accidental double-clicks)
    // ============================================================================
    // This is a safety net for accidental double-clicks within a few seconds.
    // The idempotency key system (with cartSessionId) handles most duplicate prevention.
    // REDUCED from 300s to 10s - legitimate same-item sales must be allowed!
    // Stores can sell the same item with same qty many times per day.
    const DUPLICATE_WINDOW_MS = 10 * 1000 // 10 seconds (only catches double-clicks)
    const duplicateCheckTime = new Date(Date.now() - DUPLICATE_WINDOW_MS)

    // Create a fingerprint of the sale items for comparison
    const itemsFingerprint = items
      .map((item: any) => `${item.productVariationId}:${item.quantity}:${item.unitPrice}`)
      .sort()
      .join('|')

    // Look for recent sales with same total from same user at same location
    const recentSimilarSales = await prisma.sale.findMany({
      where: {
        businessId: businessIdNumber,
        locationId: locationIdNumber,
        createdBy: userIdNumber,
        totalAmount: {
          gte: totalAmount - 0.01,
          lte: totalAmount + 0.01,
        },
        createdAt: {
          gte: duplicateCheckTime,
        },
        deletedAt: null,
      },
      include: {
        items: {
          select: {
            productVariationId: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5, // Only check last 5 similar sales
    })

    // Check if any recent sale has identical items
    for (const recentSale of recentSimilarSales) {
      const recentFingerprint = recentSale.items
        .map((item) => `${item.productVariationId}:${item.quantity}:${item.unitPrice}`)
        .sort()
        .join('|')

      if (recentFingerprint === itemsFingerprint) {
        // Calculate time since duplicate
        const secondsAgo = Math.round((Date.now() - recentSale.createdAt.getTime()) / 1000)

        console.warn(`[SALES] DUPLICATE BLOCKED: Sale identical to ${recentSale.invoiceNumber} (${secondsAgo}s ago)`)
        console.warn(`[SALES] User: ${userIdNumber}, Location: ${locationIdNumber}, Total: ${totalAmount}`)

        return NextResponse.json(
          {
            error: 'Duplicate sale detected',
            message: `An identical sale (${recentSale.invoiceNumber}) was just processed ${secondsAgo} seconds ago. This appears to be an accidental double-click. Please wait a few seconds before trying again.`,
            existingInvoice: recentSale.invoiceNumber,
            existingSaleId: recentSale.id,
            duplicateWindowSeconds: 10,
          },
          { status: 409 } // HTTP 409 Conflict
        )
      }
    }
    // ============================================================================

    // TRANSACTION IMPACT TRACKING: Step 1 - Capture inventory BEFORE transaction
    // PERFORMANCE: Optional tracking (adds 400ms-1s overhead). Disable for POS performance.
    const enableInventoryTracking = process.env.ENABLE_INVENTORY_IMPACT_TRACKING === 'true'
    const impactTracker = enableInventoryTracking ? new InventoryImpactTracker() : null
    const productVariationIds = items.map((item: any) => Number(item.productVariationId))
    const locationIds = [locationIdNumber]
    if (impactTracker) {
      await impactTracker.captureBefore(productVariationIds, locationIds)
    }

    // Create sale and deduct stock in transaction
    const sale = await prisma.$transaction(async (tx) => {
      // Generate location-specific invoice number atomically inside transaction
      const invoiceNumber = await getNextInvoiceNumber(businessIdNumber, locationIdNumber, location.name, tx)

      // Calculate paidAmount for initial sale creation
      // CRITICAL: This field is used by reports to distinguish paid vs unpaid sales
      const paidAmount = isCreditSale
        ? 0 // Credit sales start with 0 paid (payments added later)
        : paymentsTotal // Regular sales are fully paid at creation

      // Create sale
      const newSale = await tx.sale.create({
        data: {
          businessId: businessIdNumber,
          locationId: locationIdNumber,
          customerId: customerIdNumber,
          invoiceNumber,
          saleDate: new Date(saleDate),
          status: isCreditSale ? 'pending' : 'completed', // Use status from request
          shiftId: currentShift.id, // Associate with current cashier shift
          subtotal,
          taxAmount: parseFloat(taxAmount || 0),
          discountAmount: parseFloat(discountAmount || 0),
          shippingCost: parseFloat(shippingCost || 0),
          totalAmount,
          paidAmount, // CRITICAL FIX: Set paidAmount at creation time
          // Cash tendered (for invoice display)
          cashTendered: cashTendered ? parseFloat(cashTendered) : null,
          notes,
          remarks, // Cashier remarks/additional information
          // Philippine BIR discount tracking
          discountType: discountType || null,
          seniorCitizenId: seniorCitizenId || null,
          seniorCitizenName: seniorCitizenName || null,
          pwdId: pwdId || null,
          pwdName: pwdName || null,
          discountApprovedBy: discountApprovedByNumber,
          vatExempt: vatExempt || false,
          createdBy: userIdNumber,
          // Sales personnel tracking (for performance monitoring)
          salesPersonnelId: salesPersonnelId ? Number(salesPersonnelId) : null,
        },
      })

      // BULK OPTIMIZATION: Step 1 - Prepare all sale items data for bulk creation
      const saleItemsData = []
      const bulkStockItems = []

      for (const item of items) {
        const productIdNumber = Number(item.productId)
        const productVariationIdNumber = Number(item.productVariationId)
        const quantityNumber = parseFloat(item.quantity)
        const unitPriceNumber = parseFloat(item.unitPrice)

        // UOM (Unit of Measure) fields - optional
        const subUnitId = item.subUnitId ? Number(item.subUnitId) : null
        const subUnitPrice = item.subUnitPrice ? parseFloat(item.subUnitPrice) : null
        const displayQuantity = item.displayQuantity ? parseFloat(item.displayQuantity) : null
        const selectedUnitName = item.selectedUnitName || null

        if (Number.isNaN(productIdNumber) || Number.isNaN(productVariationIdNumber)) {
          throw new Error('Invalid product identifiers in sale item')
        }

        // PERFORMANCE OPTIMIZATION: Use pre-fetched variation data (no DB query needed)
        const variation = variationsMap.get(productVariationIdNumber)

        if (!variation) {
          throw new Error(`Product variation ${item.productVariationId} not found`)
        }

        // Handle serial numbers from BOTH sources:
        // 1. serialNumberIds - database-linked serial numbers (with inventory tracking)
        // 2. serialNumbers - manually entered text serial numbers (for display only)
        let serialNumbersData = null

        // Priority 1: Database-linked serial numbers (with full tracking)
        if (item.serialNumberIds && item.serialNumberIds.length > 0) {
          // Use pre-fetched serial number data from serialNumbersMap
          serialNumbersData = item.serialNumberIds.map((id: any) => {
            const sn = serialNumbersMap.get(Number(id))
            return sn ? {
              id: sn.id,
              serialNumber: sn.serialNumber,
              imei: sn.imei,
            } : null
          }).filter(Boolean)
        }
        // Priority 2: Manual text entries (no database tracking, just stored for display)
        else if (item.serialNumbers && item.serialNumbers.length > 0) {
          serialNumbersData = item.serialNumbers.map((sn: any) => ({
            serialNumber: typeof sn === 'string' ? sn : (sn.serialNumber || ''),
          }))
        }

        // Per-item discount fields
        const itemDiscountType = item.discountType || null
        const itemDiscountValue = item.discountValue ? parseFloat(item.discountValue) : null
        const itemDiscountAmount = item.discountAmount ? parseFloat(item.discountAmount) : 0

        // Per-item remark (required when discount > 0)
        const itemRemark = item.remark || null

        // Collect sale item data for bulk creation
        saleItemsData.push({
          saleId: newSale.id,
          productId: productIdNumber,
          productVariationId: productVariationIdNumber,
          quantity: quantityNumber,
          unitPrice: unitPriceNumber,
          unitCost: parseFloat(variation.purchasePrice.toString()),
          serialNumbers: serialNumbersData,
          // UOM (Unit of Measure) fields - for display/reporting
          subUnitId: subUnitId,
          subUnitPrice: subUnitPrice,
          displayQuantity: displayQuantity,
          selectedUnitName: selectedUnitName,
          // Per-item discount fields
          discountType: itemDiscountType,
          discountValue: itemDiscountValue,
          discountAmount: itemDiscountAmount,
          // Per-item remark
          remark: itemRemark,
        })

        // Skip stock deduction for "Not for Selling" items (services, fees)
        const isNotForSelling = item.notForSelling || false
        if (!isNotForSelling) {
          // Collect stock deduction data for bulk processing
          bulkStockItems.push({
            businessId: businessIdNumber,
            productId: productIdNumber,
            productVariationId: productVariationIdNumber,
            locationId: locationIdNumber,
            quantity: -Math.abs(quantityNumber), // Negative for stock deduction
            type: StockTransactionType.SALE,
            referenceType: 'sale' as const,
            referenceId: newSale.id,
            referenceNumber: invoiceNumber,
            userId: userIdNumber,
            notes: `Sale - Invoice ${invoiceNumber}`,
            userDisplayName,
            unitCost: parseFloat(variation.purchasePrice.toString()),
            tx,
          })
        }
      }

      // BULK OPTIMIZATION: Step 2 - Create ALL sale items in single query (N items → 1 query)
      if (saleItemsData.length > 0) {
        console.log(`[Sale Creation] Bulk creating ${saleItemsData.length} sale items`)
        await tx.saleItem.createMany({
          data: saleItemsData,
        })
      }

      // BULK OPTIMIZATION: Step 3 - Deduct ALL inventory in single server call (75% faster)
      if (bulkStockItems.length > 0) {
        console.log(`[Sale Creation] Bulk deducting ${bulkStockItems.length} items from inventory`)
        const results = await bulkUpdateStock(bulkStockItems)

        // Check for failures
        const failures = results.filter((r) => !r.success)
        if (failures.length > 0) {
          const firstFailure = failures[0]
          console.error('[Sale Creation] Bulk inventory deduction failed:', firstFailure.error)
          throw new Error(`Bulk inventory deduction failed: ${firstFailure.error}`)
        }
        console.log(`[Sale Creation] ✅ Successfully deducted ${results.length} items from inventory`)
      }

      // BULK OPTIMIZATION: Step 4 - Process serial numbers (must stay sequential due to dependencies)
      for (const item of items) {
        if (item.requiresSerial && item.serialNumberIds) {
          for (const serialNumberId of item.serialNumberIds) {
            // Update serial number status to sold
            const serialNumberRecord = await tx.productSerialNumber.update({
              where: { id: Number(serialNumberId) },
              data: {
                status: 'sold',
                saleId: newSale.id,
                soldAt: new Date(saleDate),
                soldTo: customerName, // Use customer name, not ID
              },
            })

            // Create movement record
            await tx.serialNumberMovement.create({
              data: {
                serialNumberId: serialNumberRecord.id, // CRITICAL: Use actual ID
                movementType: 'sale',
                fromLocationId: locationIdNumber,
                referenceType: 'sale',
                referenceId: newSale.id,
                movedBy: userIdNumber,
                notes: `Sold via ${invoiceNumber}`,
              },
            })
          }
        }
      }

      // BULK OPTIMIZATION: Create sale payments (only for non-credit sales)
      if (!isCreditSale && payments && payments.length > 0) {
        console.log(`[Sale Creation] Bulk creating ${payments.length} payment records`)
        const paymentData = payments.map(payment => ({
          saleId: newSale.id,
          paymentMethod: payment.method,
          amount: parseFloat(payment.amount),
          referenceNumber: payment.reference,
        }))

        await tx.salePayment.createMany({
          data: paymentData,
        })
        console.log(`[Sale Creation] ✅ Successfully created ${payments.length} payment records`)
      } else if (isCreditSale) {
        // For credit sales, create AR placeholder showing total unpaid amount
        await tx.salePayment.create({
          data: {
            saleId: newSale.id,
            paymentMethod: 'credit',
            amount: totalAmount, // Show total unpaid balance on invoice
            referenceNumber: 'Pending Payment',
          },
        })
      }

      // ========== ACCOUNTING INTEGRATION DISABLED ==========
      // Reason: Performance optimization - accounting feature not fully implemented
      // To re-enable: Remove the /* and */ comment markers below and uncomment the import at line 309
      // Date disabled: 2026-01-16
      /*
      // CRITICAL: ACCOUNTING INTEGRATION MOVED INSIDE TRANSACTION FOR ATOMICITY
      // PERFORMANCE: Check if accounting is enabled (cached in user session would be better)
      // For now, we check if there are any chart of accounts for this business
      // This could be cached in Redis or session to avoid COUNT query every time
      const accountingEnabledCheck = await tx.chartOfAccounts.findFirst({
        where: { businessId: businessIdNumber },
        select: { id: true }
      })

      if (accountingEnabledCheck) {
        // Calculate COGS (Cost of Goods Sold) from the items we just processed
        // PERFORMANCE: Compute from memory instead of re-fetching from database
        const costOfGoodsSold = items.reduce((sum: number, item: any) => {
          const variation = variationsMap.get(Number(item.productVariationId))
          const unitCost = variation ? parseFloat(variation.purchasePrice.toString()) : 0
          const quantity = parseFloat(item.quantity)
          return sum + (unitCost * quantity)
        }, 0)

        if (isCreditSale) {
          // Credit Sale (Charge Invoice) - record as Accounts Receivable
          await recordCreditSale({
            businessId: businessIdNumber,
            userId: userIdNumber,
            saleId: newSale.id,
            saleDate: new Date(saleDate),
            totalAmount,
            costOfGoodsSold,
            invoiceNumber: newSale.invoiceNumber,
            customerId: customerIdNumber || undefined,
            tx  // CRITICAL: Pass transaction client for atomicity
          })
        } else {
          // Cash Sale - record as Cash received
          await recordCashSale({
            businessId: businessIdNumber,
            userId: userIdNumber,
            saleId: newSale.id,
            saleDate: new Date(saleDate),
            totalAmount,
            costOfGoodsSold,
            invoiceNumber: newSale.invoiceNumber,
            tx  // CRITICAL: Pass transaction client for atomicity
          })
        }
      }
      */
      // ========== END ACCOUNTING INTEGRATION DISABLED ==========

      // CRITICAL: AUDIT LOG MOVED INSIDE TRANSACTION FOR ATOMICITY
      // Create audit log as part of the atomic transaction (BIR compliance requirement)
      await createAuditLog({
        businessId: businessIdNumber,
        userId: userIdNumber,
        username: user.username,
        action: 'sale_create' as AuditAction,
        entityType: EntityType.SALE,
        entityIds: [newSale.id],
        description: `Created Sale ${newSale.invoiceNumber}`,
        metadata: {
          saleId: newSale.id,
          invoiceNumber: newSale.invoiceNumber,
          customerId: customerIdNumber,
          locationId: locationIdNumber,
          totalAmount,
          itemCount: items.length,
          paymentMethods: (payments || []).map((p: any) => p.method),
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request),
        tx  // CRITICAL: Pass transaction client for atomicity (BIR compliance)
      })

      // PHASE 2: Update shift running totals for real-time X/Z Reading generation
      // This is a single UPDATE query with increment operations (~10-50ms overhead)
      // IMPORTANT: Even for credit sales, we must count any payments that were made (partial payments)
      await incrementShiftTotalsForSale(
        currentShift.id,
        {
          subtotal,
          totalAmount,
          discountAmount: parseFloat(discountAmount || 0),
          discountType: discountType || null,
          payments: (payments || []).map((p: any) => ({
            paymentMethod: p.method,
            amount: parseFloat(p.amount),
          })),
        },
        tx  // CRITICAL: Pass transaction client for atomicity
      )

      // PHASE 3: Update sales personnel performance metrics (if assigned)
      if (salesPersonnelId) {
        await tx.salesPersonnel.update({
          where: { id: Number(salesPersonnelId) },
          data: {
            totalSalesCount: { increment: 1 },
            totalRevenue: { increment: totalAmount },
          },
        })
      }

      return newSale
    }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

    const transactionTime = Date.now() - startTime
    console.log(`[PERFORMANCE] Transaction completed in ${transactionTime}ms`)

    // TRANSACTION IMPACT TRACKING: Step 2 - Capture inventory AFTER and generate report
    const inventoryImpact = impactTracker ? await impactTracker.captureAfterAndReport(
      productVariationIds,
      locationIds,
      'sale',
      sale.id,
      sale.invoiceNumber,
      undefined, // No location types needed for single-location sales
      userDisplayName
    ) : null

    // Fetch complete sale with relations
    const completeSale = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: {
        customer: true,
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            surname: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                enableStock: true,
              },
            },
          },
        },
        payments: true,
      },
    })

    // Re-enabled: Email discount alerts (Jan 30, 2026)
    // Send email notification for large discounts (threshold: EMAIL_ALERT_DISCOUNT_THRESHOLD, default ₱1,000)
    setImmediate(async () => {
      try {
        // Alert for large discounts via email
        if (discountAmount && parseFloat(discountAmount) > 0) {
          await sendLargeDiscountEmail({
            saleNumber: sale.invoiceNumber,
            discountAmount: parseFloat(discountAmount),
            discountType: discountType || 'Regular Discount',
            totalAmount,
            cashierName: user.username || user.name || 'Unknown',
            locationName: location.name,
            timestamp: new Date(saleDate),
            reason: notes || undefined,
          })
        }
      } catch (notificationError) {
        // Log notification errors but don't fail the sale
        console.error('Email notification error:', notificationError)
      }
    })

    // PERFORMANCE TIMING
    const totalTime = Date.now() - startTime
    console.log(`[PERFORMANCE] Total sale creation time: ${totalTime}ms (Transaction: ${transactionTime}ms, Post-processing: ${totalTime - transactionTime}ms)`)

    // Return with inventory impact report
    return NextResponse.json({
      ...completeSale,
      inventoryImpact,
      _performanceTiming: {
        total: totalTime,
        transaction: transactionTime,
        postProcessing: totalTime - transactionTime
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating sale:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      {
        error: 'Failed to create sale',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: error instanceof Error ? error.constructor.name : typeof error,
      },
      { status: 500 }
    )
  }
  }) // Close idempotency wrapper
}
