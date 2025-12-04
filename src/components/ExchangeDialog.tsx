'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeftRight, Search, Trash2, AlertCircle, Plus } from 'lucide-react'
import { toast } from 'sonner'
import ExchangeInvoicePrint from '@/components/ExchangeInvoicePrint'

interface ExchangeDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (exchangeData: any) => void
  initialSaleId?: number
}

interface SaleItem {
  id: number
  productId: number
  productVariationId: number
  quantity: number
  unitPrice: number
  discountAmount?: number
  discountType?: string
  lineTotal: number
  product: {
    name: string
    sku: string
  }
  productVariation?: {
    name: string
    sku: string
  }
}

interface Sale {
  id: number
  invoiceNumber: string
  saleDate: string
  locationId: number
  customer?: {
    name: string
  }
  items: SaleItem[]
  totalAmount: number
}

interface ReturnItem {
  saleItemId: number
  quantity: number
  productName: string
  unitPrice: number
}

interface ExchangeItem {
  productId: number
  productVariationId: number
  productName: string
  quantity: number
  unitPrice: number
  originalPrice: number
}

export default function ExchangeDialog({ isOpen, onClose, onSuccess, initialSaleId }: ExchangeDialogProps) {
  const { data: session } = useSession()
  const currentLocationId = (session?.user as any)?.currentLocationId

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Sale search
  const [searchQuery, setSearchQuery] = useState('')
  const [sale, setSale] = useState<Sale | null>(null)

  // Return items
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([])

  // Exchange items
  const [exchangeItems, setExchangeItems] = useState<ExchangeItem[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  // POS-style instant search
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Exchange details
  const [exchangeReason, setExchangeReason] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')

  // Print state
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [completedExchange, setCompletedExchange] = useState<any>(null)

  // Load initial sale if provided
  useEffect(() => {
    if (isOpen && initialSaleId) {
      fetchSale(initialSaleId.toString())
    }
  }, [isOpen, initialSaleId])

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setSale(null)
      setReturnItems([])
      setExchangeItems([])
      setExchangeReason('')
      setPaymentMethod('cash')
      setProductSearch('')
      setSearchResults([])
      setAllProducts([])
    }
  }, [isOpen])

  // Load products when sale is found
  useEffect(() => {
    if (sale && allProducts.length === 0) {
      fetchAllProducts()
    }
  }, [sale])

  // Client-side product filtering
  useEffect(() => {
    if (productSearch.length < 2) {
      setSearchResults([])
      return
    }

    const query = productSearch.toLowerCase()
    const filterLocationId = currentLocationId || sale?.locationId

    const filtered = allProducts.filter(p => {
      const matchesSearch =
        p.name?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.variations?.some((v: any) => v.sku?.toLowerCase().includes(query))

      if (!matchesSearch) return false

      if (filterLocationId && p.variations && p.variations.length > 0) {
        const hasStock = p.variations.some((v: any) => {
          if (!v.variationLocationDetails || !Array.isArray(v.variationLocationDetails)) {
            return false
          }

          const locationStock = v.variationLocationDetails.find(
            (detail: any) => {
              const detailLocId = String(detail.locationId)
              const filterLocId = String(filterLocationId)
              return detailLocId === filterLocId || detail.locationId === filterLocationId
            }
          )

          if (!locationStock) return false

          const qtyAvailable = Number(locationStock.qtyAvailable)
          return !isNaN(qtyAvailable) && qtyAvailable > 0
        })

        return hasStock
      }

      return false
    }).slice(0, 30)

    setSearchResults(filtered)
  }, [productSearch, allProducts, sale, currentLocationId])

  const fetchSale = async (invoiceNumberOrId: string) => {
    setLoading(true)
    try {
      // Use exactInvoice for direct lookup to avoid partial match issues
      const response = await fetch(`/api/sales/devextreme?exactInvoice=${encodeURIComponent(invoiceNumberOrId)}&take=1`)
      const data = await response.json()

      console.log('[Exchange] Fetching invoice:', invoiceNumberOrId)
      console.log('[Exchange] API response:', { totalCount: data.totalCount, dataLength: data.data?.length })

      if (data.data && data.data.length > 0) {
        const saleData = data.data[0]

        console.log('[Exchange] Found sale:', saleData.invoiceNumber, 'Status:', saleData.status)

        // Check if sale status allows exchange
        if (saleData.status === 'voided') {
          toast.error('Cannot Exchange Voided Sale', {
            description: `Invoice ${saleData.invoiceNumber} has been voided and cannot be exchanged.`,
          })
          return
        }

        // Validate sale age (7 days)
        const saleDate = new Date(saleData.saleDate)
        const today = new Date()
        const daysDiff = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24))

        if (daysDiff > 7) {
          toast.error('Exchange Period Expired', {
            description: `This sale is ${daysDiff} days old. Only items purchased within 7 days can be exchanged.`,
          })
          return
        }

        setSale(saleData)
      } else {
        toast.error('Sale Not Found', {
          description: `No sale found with invoice number "${invoiceNumberOrId}".`,
        })
      }
    } catch (error) {
      console.error('[Exchange] Error:', error)
      toast.error('Failed to fetch sale details.')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllProducts = async () => {
    setLoadingProducts(true)
    try {
      const res = await fetch('/api/products?limit=10000&forTransaction=true')
      const data = await res.json()

      if (data.products) {
        const productsWithVariations = data.products.filter((p: any) =>
          p.variations && p.variations.length > 0
        )
        setAllProducts(productsWithVariations)
      }
    } catch (error) {
      console.error('[Exchange] Error loading products:', error)
      toast.error('Failed to load products.')
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleSearchSale = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      fetchSale(searchQuery.trim())
    }
  }

  const handleToggleReturnItem = (item: SaleItem) => {
    const existingIndex = returnItems.findIndex(ri => ri.saleItemId === item.id)

    if (existingIndex >= 0) {
      setReturnItems(returnItems.filter(ri => ri.saleItemId !== item.id))
    } else {
      setReturnItems([...returnItems, {
        saleItemId: item.id,
        quantity: item.quantity,
        productName: item.productVariation?.name || item.product.name,
        unitPrice: parseFloat(item.unitPrice.toString()),
      }])
    }
  }

  const handleUpdateReturnQuantity = (saleItemId: number, newQuantity: number) => {
    const saleItem = sale?.items.find(i => i.id === saleItemId)
    if (!saleItem) return

    const maxQty = parseFloat(saleItem.quantity.toString())
    const validQty = Math.max(0, Math.min(newQuantity, maxQty))

    if (validQty === 0) {
      setReturnItems(returnItems.filter(ri => ri.saleItemId !== saleItemId))
    } else {
      setReturnItems(returnItems.map(ri =>
        ri.saleItemId === saleItemId ? { ...ri, quantity: validQty } : ri
      ))
    }
  }

  const handleAddExchangeItem = (product: any, variation?: any, locationPrice?: number) => {
    const variationToUse = variation || product.variations?.[0]

    if (!variationToUse) {
      toast.error('Product has no variations available.')
      return
    }

    // Use location-specific price if provided, otherwise fallback to base variation price
    const price = locationPrice || parseFloat(variationToUse.sellingPrice?.toString() || '0')
    const newItem: ExchangeItem = {
      productId: product.id,
      productVariationId: variationToUse.id,
      productName: variation ? `${product.name} - ${variation.name}` : product.name,
      quantity: 1,
      unitPrice: price,
      originalPrice: price,
    }

    setExchangeItems([...exchangeItems, newItem])
    setProductSearch('')
    setSearchResults([])
  }

  const handleRemoveExchangeItem = (index: number) => {
    setExchangeItems(exchangeItems.filter((_, i) => i !== index))
  }

  const handleUpdateExchangeQuantity = (index: number, newQuantity: number) => {
    setExchangeItems(exchangeItems.map((item, i) =>
      i === index ? { ...item, quantity: Math.max(1, newQuantity) } : item
    ))
  }

  const handleUpdateExchangePrice = (index: number, newPrice: number) => {
    setExchangeItems(exchangeItems.map((item, i) =>
      i === index ? { ...item, unitPrice: Math.max(0, newPrice) } : item
    ))
  }

  const calculateTotals = () => {
    const returnTotal = returnItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const exchangeTotal = exchangeItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const priceDifference = exchangeTotal - returnTotal
    const customerPays = Math.max(0, priceDifference)
    const customerCredit = Math.abs(Math.min(0, priceDifference))

    return { returnTotal, exchangeTotal, priceDifference, customerPays, customerCredit }
  }

  const handleSubmitExchange = async () => {
    if (!sale) return
    if (submitting) return
    if (returnItems.length === 0) {
      toast.error('Please select at least one item to return.')
      return
    }
    if (exchangeItems.length === 0) {
      toast.error('Please select at least one item to exchange.')
      return
    }
    if (!exchangeReason.trim()) {
      toast.error('Please provide a reason for the exchange.')
      return
    }

    setSubmitting(true)
    try {
      const totals = calculateTotals()
      const idempotencyKey = `exchange-${sale.id}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`

      const response = await fetch(`/api/sales/${sale.id}/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          returnItems: returnItems.map(ri => ({
            saleItemId: ri.saleItemId,
            quantity: ri.quantity,
          })),
          exchangeItems: exchangeItems.map(ei => ({
            productId: ei.productId,
            productVariationId: ei.productVariationId,
            quantity: ei.quantity,
            unitPrice: ei.unitPrice,
          })),
          exchangeReason,
          paymentMethod: totals.customerPays > 0 ? paymentMethod : undefined,
          paymentAmount: totals.customerPays,
          notes: `Exchange for original sale ${sale.invoiceNumber}`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process exchange')
      }

      toast.success('Exchange Processed', {
        description: `Exchange ${data.exchangeNumber} completed successfully.`,
      })

      if (onSuccess) {
        onSuccess(data)
      }

      // Show print dialog instead of closing immediately
      setCompletedExchange(data)
      setShowPrintDialog(true)
    } catch (error: any) {
      toast.error(error.message || 'Failed to process exchange.')
    } finally {
      setSubmitting(false)
    }
  }

  const totals = calculateTotals()

  const handleClosePrintDialog = () => {
    setShowPrintDialog(false)
    setCompletedExchange(null)
    onClose() // Close the main exchange dialog after print dialog closes
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] w-[1400px] max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ArrowLeftRight className="h-5 w-5" />
            Process Exchange
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* Search Invoice Section */}
          <div className="mt-4 mb-6">
            <form onSubmit={handleSearchSale} className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Enter invoice number or scan barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11"
                  disabled={loading}
                />
              </div>
              <Button type="submit" disabled={loading} size="lg">
                <Search className="h-4 w-4 mr-2" />
                {loading ? 'Searching...' : 'Search Sale'}
              </Button>
            </form>

            {!sale && (
              <div className="mt-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">Exchange Policy</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Items must be exchanged within 7 days of purchase</li>
                      <li>Price difference will be calculated automatically</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content - Only show if sale is loaded */}
          {sale && (
            <div className="space-y-6">
              {/* Sale Info */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Invoice:</span>{' '}
                    <span className="font-medium">{sale.invoiceNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Date:</span>{' '}
                    <span className="font-medium">{new Date(sale.saleDate).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Customer:</span>{' '}
                    <span className="font-medium">{sale.customer?.name || 'Walk-in Customer'}</span>
                  </div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-2 gap-6">
                {/* Left: Original Sale Items */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3">1. Select Items to Return</h3>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {sale.items.map((item) => {
                      const returnItem = returnItems.find(ri => ri.saleItemId === item.id)
                      const isSelected = !!returnItem

                      return (
                        <div
                          key={item.id}
                          className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                          onClick={() => handleToggleReturnItem(item)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.productVariation?.name || item.product.name}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {item.discountAmount && parseFloat(item.discountAmount.toString()) > 0 ? (
                                  <>
                                    <span className="line-through text-gray-400">
                                      ₱{(parseFloat(item.unitPrice.toString()) + parseFloat(item.discountAmount.toString())).toFixed(2)}
                                    </span>
                                    {' → '}
                                    <span className="text-green-600 dark:text-green-400">
                                      ₱{parseFloat(item.unitPrice.toString()).toFixed(2)}
                                    </span>
                                    <span className="ml-1 text-orange-500">
                                      ({item.discountType || 'Discounted'})
                                    </span>
                                    {' × '}{item.quantity}
                                  </>
                                ) : parseFloat(item.unitPrice.toString()) === 0 ? (
                                  <>
                                    <span className="text-purple-600 dark:text-purple-400 font-medium">₱0.00 (Freebie)</span>
                                    {' × '}{item.quantity}
                                  </>
                                ) : (
                                  <>₱{parseFloat(item.unitPrice.toString()).toFixed(2)} × {item.quantity}</>
                                )}
                              </p>
                            </div>

                            {isSelected && (
                              <div className="flex items-center gap-2">
                                <Label className="text-xs">Qty:</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max={item.quantity}
                                  value={returnItem.quantity}
                                  onChange={(e) => handleUpdateReturnQuantity(item.id, parseInt(e.target.value) || 0)}
                                  className="w-16 h-8 text-sm"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {returnItems.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex justify-between font-medium">
                        <span>Return Total:</span>
                        <span className="text-red-600">-₱{totals.returnTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Exchange Items */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3">2. Select Exchange Items</h3>

                  {/* Product Search */}
                  <div className="mb-4">
                    <div className="relative">
                      <Input
                        placeholder={loadingProducts ? "Loading..." : "Search products..."}
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        disabled={loadingProducts}
                        className="h-10"
                      />

                      {/* Dropdown Results */}
                      {searchResults.length > 0 && !loadingProducts && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-xl max-h-[300px] overflow-y-auto">
                          {searchResults.map((product) => {
                            const filterLocationId = currentLocationId || sale?.locationId
                            let maxAvailableStock = 0
                            let bestVariation = product.variations?.[0]
                            let locationPrice = 0

                            if (filterLocationId && product.variations) {
                              product.variations.forEach((variation: any) => {
                                if (variation.variationLocationDetails) {
                                  const locationStock = variation.variationLocationDetails.find(
                                    (detail: any) => String(detail.locationId) === String(filterLocationId)
                                  )
                                  if (locationStock) {
                                    const stock = Number(locationStock.qtyAvailable)
                                    if (stock > maxAvailableStock) {
                                      maxAvailableStock = stock
                                      bestVariation = variation
                                      // Use location-specific price, fallback to base variation price
                                      locationPrice = Number(locationStock.sellingPrice) || Number(variation.sellingPrice) || 0
                                    }
                                  }
                                }
                              })
                            }

                            if (maxAvailableStock <= 0) return null

                            return (
                              <div
                                key={product.id}
                                className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900 cursor-pointer border-b last:border-b-0"
                                onClick={() => handleAddExchangeItem(product, bestVariation, locationPrice)}
                              >
                                <p className="font-medium text-sm">{product.name}</p>
                                <div className="flex justify-between text-xs mt-1">
                                  <span className="text-gray-600">Stock: {maxAvailableStock}</span>
                                  <span className="text-green-600 font-bold">
                                    ₱{locationPrice.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected Exchange Items */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {exchangeItems.map((item, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        {/* Product name - full width on top */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm leading-tight">{item.productName}</p>
                          </div>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            onClick={() => handleRemoveExchangeItem(index)}
                            className="hover:border-red-500 hover:text-red-700 dark:hover:text-red-400 flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {/* Price input - editable */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Price:</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm">₱</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateExchangePrice(index, parseFloat(e.target.value) || 0)}
                              className="w-24 h-8 text-sm"
                            />
                          </div>
                          {item.unitPrice !== item.originalPrice && (
                            <span className="text-xs text-orange-500">
                              (was ₱{item.originalPrice.toFixed(2)})
                            </span>
                          )}
                        </div>
                        {/* Quantity controls - bottom row */}
                        <div className="flex items-center justify-center gap-2 pt-2 border-t">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() => handleUpdateExchangeQuantity(index, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="h-8 w-8"
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateExchangeQuantity(index, parseInt(e.target.value) || 1)}
                            className="w-16 h-8 text-center font-semibold text-base"
                          />
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() => handleUpdateExchangeQuantity(index, item.quantity + 1)}
                            className="h-8 w-8"
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {exchangeItems.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex justify-between font-medium">
                        <span>Exchange Total:</span>
                        <span className="text-green-600">+₱{totals.exchangeTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Section: Summary & Submit */}
              {returnItems.length > 0 && exchangeItems.length > 0 && (
                <div className="space-y-4">
                  {/* Price Summary */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Return Value:</span>
                        <p className="font-medium">₱{totals.returnTotal.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Exchange Value:</span>
                        <p className="font-medium">₱{totals.exchangeTotal.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Difference:</span>
                        <p className={`font-bold ${totals.priceDifference >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {totals.priceDifference >= 0 ? '+' : ''}₱{totals.priceDifference.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {totals.customerPays > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <Label>Payment Method (Customer must pay ₱{totals.customerPays.toFixed(2)})</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="gcash">Gcash</SelectItem>
                            <SelectItem value="nfc">NFC</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Exchange Reason */}
                  <div>
                    <Label>Reason for Exchange *</Label>
                    <Textarea
                      placeholder="e.g., Defective item, Wrong size..."
                      value={exchangeReason}
                      onChange={(e) => setExchangeReason(e.target.value)}
                      className="mt-2 min-h-20"
                      maxLength={500}
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={onClose} disabled={submitting} className="flex-1">
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmitExchange}
                      disabled={submitting || !exchangeReason.trim()}
                      variant="success"
                      className="flex-1"
                    >
                      {submitting ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Processing...
                        </>
                      ) : (
                        <>
                          <ArrowLeftRight className="h-4 w-4 mr-2" />
                          Process Exchange
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

      {/* Exchange Receipt Print Dialog */}
      {completedExchange && (
        <ExchangeInvoicePrint
          exchange={completedExchange}
          isOpen={showPrintDialog}
          onClose={handleClosePrintDialog}
        />
      )}
    </>
  )
}
