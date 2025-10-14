'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function POSPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentShift, setCurrentShift] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [searchTerm, setSearchTerm] = useState('')
  const [showZReading, setShowZReading] = useState(false)
  const [zReadingData, setZReadingData] = useState<any>(null)
  const [zReadingLoading, setZReadingLoading] = useState(false)

  // Philippine BIR Discount Support
  const [discountType, setDiscountType] = useState<string>('none') // 'none', 'senior', 'pwd'
  const [seniorCitizenId, setSeniorCitizenId] = useState('')
  const [seniorCitizenName, setSeniorCitizenName] = useState('')
  const [pwdId, setPwdId] = useState('')
  const [pwdName, setPwdName] = useState('')

  useEffect(() => {
    checkShift()
    fetchProducts()
  }, [])

  const checkShift = async () => {
    try {
      const res = await fetch('/api/shifts?status=open')
      const data = await res.json()
      if (data.shifts && data.shifts.length > 0) {
        const shift = data.shifts[0]
        // Validate shift has beginning cash
        if (!shift.beginningCash || parseFloat(shift.beginningCash) <= 0) {
          setError('Invalid shift: No beginning cash found. Please contact your manager.')
          router.push('/dashboard/shifts/begin')
          return
        }
        setCurrentShift(shift)
      } else {
        // No open shift, redirect to begin shift
        setError('No active shift found. Please begin your shift first.')
        router.push('/dashboard/shifts/begin')
      }
    } catch (err) {
      console.error('Error checking shift:', err)
      setError('Unable to verify your shift status.')
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?limit=1000')
      const data = await res.json()
      if (data.products) {
        setProducts(data.products)
      }
    } catch (err) {
      console.error('Error fetching products:', err)
    }
  }

  const addToCart = (product: any) => {
    const existing = cart.find(item => item.productVariationId === product.variations[0].id)
    if (existing) {
      setCart(cart.map(item =>
        item.productVariationId === product.variations[0].id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, {
        productId: product.id,
        productVariationId: product.variations[0].id,
        name: product.name,
        unitPrice: parseFloat(product.variations[0].defaultSellingPrice),
        quantity: 1,
        requiresSerial: false,
        serialNumberIds: [],
      }])
    }
  }

  const removeFromCart = (productVariationId: number) => {
    setCart(cart.filter(item => item.productVariationId !== productVariationId))
  }

  const updateQuantity = (productVariationId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productVariationId)
    } else {
      setCart(cart.map(item =>
        item.productVariationId === productVariationId
          ? { ...item, quantity }
          : item
      ))
    }
  }

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
  }

  const calculateDiscount = () => {
    const subtotal = calculateSubtotal()
    if (discountType === 'senior' || discountType === 'pwd') {
      return subtotal * 0.20 // 20% discount for Senior Citizens and PWD
    }
    return 0
  }

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount()
  }

  const handleZReading = async () => {
    setZReadingLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/readings/z-reading?shiftId=${currentShift.id}`)
      const data = await res.json()
      if (res.ok && data.zReading) {
        setZReadingData(data.zReading)
        setShowZReading(true)
      } else {
        setError(data.error || 'Failed to generate Z Reading')
      }
    } catch (err: any) {
      setError('Error generating Z Reading: ' + err.message)
    } finally {
      setZReadingLoading(false)
    }
  }

  const handlePrintZReading = () => {
    window.print()
  }

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError('Cart is empty')
      return
    }

    // Validate discount information
    if (discountType === 'senior') {
      if (!seniorCitizenId || !seniorCitizenName) {
        setError('Please enter Senior Citizen ID and Name for discount')
        return
      }
    } else if (discountType === 'pwd') {
      if (!pwdId || !pwdName) {
        setError('Please enter PWD ID and Name for discount')
        return
      }
    }

    setLoading(true)
    setError('')

    try {
      const subtotal = calculateSubtotal()
      const discountAmount = calculateDiscount()
      const total = calculateTotal()

      const saleData: any = {
        locationId: currentShift.locationId,
        saleDate: new Date().toISOString(),
        items: cart,
        payments: [{ method: paymentMethod, amount: total }],
        discountAmount,
      }

      // Add discount information if applicable
      if (discountType === 'senior') {
        saleData.discountType = 'senior'
        saleData.seniorCitizenId = seniorCitizenId
        saleData.seniorCitizenName = seniorCitizenName
        saleData.vatExempt = true
      } else if (discountType === 'pwd') {
        saleData.discountType = 'pwd'
        saleData.pwdId = pwdId
        saleData.pwdName = pwdName
        saleData.vatExempt = true
      }

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to process sale')
      }

      // Clear cart and discount info, show success
      setCart([])
      setDiscountType('none')
      setSeniorCitizenId('')
      setSeniorCitizenName('')
      setPwdId('')
      setPwdName('')

      alert(`Sale completed! Invoice: ${data.invoiceNumber}${discountAmount > 0 ? `\nDiscount Applied: ₱${discountAmount.toFixed(2)}` : ''}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!currentShift) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-4xl">⏳</div>
              <h2 className="text-xl font-semibold">Checking Shift Status...</h2>
              <p className="text-sm text-muted-foreground">
                Please wait while we verify your active shift
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b p-3 md:p-4">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold">Point of Sale</h1>
          <div className="text-xs md:text-sm">
            <span className="font-medium">Shift:</span> {currentShift.shiftNumber}
            <span className="hidden sm:inline"> | </span>
            <span className="block sm:inline font-medium sm:ml-2">Beginning Cash: ₱{parseFloat(currentShift.beginningCash).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Products List */}
        <div className="flex-1 p-3 md:p-4 overflow-y-auto">
          <Input
            type="search"
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => addToCart(product)}
              >
                <CardContent className="p-3">
                  <h3 className="font-medium text-sm truncate">{product.name}</h3>
                  <p className="text-lg font-bold text-green-600">
                    ₱{parseFloat(product.variations[0]?.defaultSellingPrice || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">Stock: {product.variations[0]?.totalStock || 0}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Cart/Checkout */}
        <div className="w-full md:w-96 bg-white border-t md:border-t-0 md:border-l p-3 md:p-4 flex flex-col max-h-96 md:max-h-full">
          <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4">Cart</h2>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex-1 overflow-y-auto mb-4">
            {cart.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No items in cart</p>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.productVariationId} className="flex items-center gap-1 md:gap-2 p-2 bg-gray-50 rounded text-sm">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-gray-500">₱{item.unitPrice.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.productVariationId, item.quantity - 1)}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.productVariationId, item.quantity + 1)}
                      >
                        +
                      </Button>
                    </div>
                    <p className="font-bold w-20 text-right">₱{(item.unitPrice * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-3 md:pt-4 space-y-3 md:space-y-4">
            {/* Subtotal and Discount Display */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₱{calculateSubtotal().toFixed(2)}</span>
              </div>
              {calculateDiscount() > 0 && (
                <div className="flex justify-between text-red-600 font-medium">
                  <span>Discount (20%):</span>
                  <span>-₱{calculateDiscount().toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base md:text-lg font-bold border-t pt-1">
                <span>Total:</span>
                <span>₱{calculateTotal().toFixed(2)}</span>
              </div>
            </div>

            {/* Philippine BIR Discount Selection */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
              <Label className="text-sm font-bold text-yellow-900">BIR Discount (20%)</Label>
              <Select value={discountType} onValueChange={setDiscountType}>
                <SelectTrigger className="border-yellow-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Discount</SelectItem>
                  <SelectItem value="senior">Senior Citizen (20%)</SelectItem>
                  <SelectItem value="pwd">PWD (20%)</SelectItem>
                </SelectContent>
              </Select>

              {/* Senior Citizen Fields */}
              {discountType === 'senior' && (
                <div className="space-y-2 animate-in fade-in">
                  <div>
                    <Label className="text-xs">Senior Citizen ID <span className="text-red-600">*</span></Label>
                    <Input
                      type="text"
                      placeholder="Enter SC ID Number"
                      value={seniorCitizenId}
                      onChange={(e) => setSeniorCitizenId(e.target.value)}
                      className="text-sm border-yellow-300"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Senior Citizen Name <span className="text-red-600">*</span></Label>
                    <Input
                      type="text"
                      placeholder="Enter SC Full Name"
                      value={seniorCitizenName}
                      onChange={(e) => setSeniorCitizenName(e.target.value)}
                      className="text-sm border-yellow-300"
                    />
                  </div>
                  <p className="text-xs text-yellow-700">VAT-exempt transaction</p>
                </div>
              )}

              {/* PWD Fields */}
              {discountType === 'pwd' && (
                <div className="space-y-2 animate-in fade-in">
                  <div>
                    <Label className="text-xs">PWD ID <span className="text-red-600">*</span></Label>
                    <Input
                      type="text"
                      placeholder="Enter PWD ID Number"
                      value={pwdId}
                      onChange={(e) => setPwdId(e.target.value)}
                      className="text-sm border-yellow-300"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">PWD Name <span className="text-red-600">*</span></Label>
                    <Input
                      type="text"
                      placeholder="Enter PWD Full Name"
                      value={pwdName}
                      onChange={(e) => setPwdName(e.target.value)}
                      className="text-sm border-yellow-300"
                    />
                  </div>
                  <p className="text-xs text-yellow-700">VAT-exempt transaction</p>
                </div>
              )}
            </div>

            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full text-sm md:text-base bg-green-600 hover:bg-green-700 font-bold shadow-lg"
              size="lg"
              onClick={handleCheckout}
              disabled={loading || cart.length === 0}
            >
              {loading ? '⏳ Processing...' : '💰 Complete Sale'}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                className="text-xs md:text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                onClick={() => router.push('/dashboard/readings/x-reading')}
              >
                📊 X Reading
              </Button>
              <Button
                className="text-xs md:text-sm bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                onClick={handleZReading}
                disabled={zReadingLoading || currentShift.status === 'open'}
              >
                {zReadingLoading ? '⏳' : '📋'} Z Reading
              </Button>
            </div>
            <Button
              className="text-xs md:text-sm w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
              onClick={() => router.push('/dashboard/shifts/close')}
            >
              🔒 Close Shift
            </Button>
          </div>
        </div>
      </div>

      {/* Z Reading Modal */}
      {showZReading && zReadingData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-4">
                <h2 className="text-2xl font-bold">Z Reading (End-of-Day)</h2>
                <button
                  onClick={() => setShowZReading(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 print:space-y-2">
                {/* Shift Info */}
                <div className="bg-gray-50 p-4 rounded">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><strong>Shift Number:</strong> {zReadingData.shiftNumber}</div>
                    <div><strong>Date:</strong> {new Date(zReadingData.closedAt).toLocaleDateString()}</div>
                    <div><strong>Opened:</strong> {new Date(zReadingData.openedAt).toLocaleTimeString()}</div>
                    <div><strong>Closed:</strong> {new Date(zReadingData.closedAt).toLocaleTimeString()}</div>
                  </div>
                </div>

                {/* Sales Summary */}
                <div className="border-t pt-4">
                  <h3 className="font-bold mb-2">Sales Summary</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Gross Sales:</span>
                      <span className="font-semibold">₱{parseFloat(zReadingData.grossSales || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Discounts:</span>
                      <span className="font-semibold">₱{parseFloat(zReadingData.totalDiscounts || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Net Sales:</span>
                      <span>₱{parseFloat(zReadingData.netSales || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Transactions:</span>
                      <span className="font-semibold">{zReadingData.transactionCount || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Cash Summary */}
                <div className="border-t pt-4">
                  <h3 className="font-bold mb-2">Cash Summary</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Beginning Cash:</span>
                      <span>₱{parseFloat(zReadingData.beginningCash || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>System Cash (Expected):</span>
                      <span>₱{parseFloat(zReadingData.systemCash || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Actual Cash (Counted):</span>
                      <span>₱{parseFloat(zReadingData.endingCash || 0).toFixed(2)}</span>
                    </div>
                    {zReadingData.cashOver > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Cash Over:</span>
                        <span>₱{parseFloat(zReadingData.cashOver).toFixed(2)}</span>
                      </div>
                    )}
                    {zReadingData.cashShort > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Cash Short:</span>
                        <span>₱{parseFloat(zReadingData.cashShort).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Breakdown */}
                {zReadingData.paymentBreakdown && (
                  <div className="border-t pt-4">
                    <h3 className="font-bold mb-2">Payment Breakdown</h3>
                    <div className="space-y-1 text-sm">
                      {Object.entries(zReadingData.paymentBreakdown).map(([method, amount]: [string, any]) => (
                        <div key={method} className="flex justify-between">
                          <span className="capitalize">{method}:</span>
                          <span>₱{parseFloat(amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t print:hidden">
                <Button
                  onClick={handlePrintZReading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  🖨️ Print
                </Button>
                <Button
                  onClick={() => setShowZReading(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
