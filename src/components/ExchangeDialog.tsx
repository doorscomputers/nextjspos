'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeftRight, Search, Plus, Trash2, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

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
}

export default function ExchangeDialog({ isOpen, onClose, onSuccess, initialSaleId }: ExchangeDialogProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<'search' | 'select-return' | 'select-exchange' | 'confirm'>(initialSaleId ? 'select-return' : 'search')
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
  const [searchingProducts, setSearchingProducts] = useState(false)

  // Exchange details
  const [exchangeReason, setExchangeReason] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')

  // Load initial sale if provided
  useEffect(() => {
    if (isOpen && initialSaleId) {
      fetchSale(initialSaleId.toString())
    }
  }, [isOpen, initialSaleId])

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep(initialSaleId ? 'select-return' : 'search')
      setSearchQuery('')
      setSale(null)
      setReturnItems([])
      setExchangeItems([])
      setExchangeReason('')
      setPaymentMethod('cash')
      setProductSearch('')
      setSearchResults([])
    }
  }, [isOpen, initialSaleId])

  const fetchSale = async (invoiceNumberOrId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/sales?search=${encodeURIComponent(invoiceNumberOrId)}&take=1`)
      const data = await response.json()

      if (data.data && data.data.length > 0) {
        const saleData = data.data[0]

        // Validate sale age (7 days)
        const saleDate = new Date(saleData.saleDate)
        const today = new Date()
        const daysDiff = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24))

        if (daysDiff > 7) {
          toast({
            title: 'Exchange Period Expired',
            description: `This sale is ${daysDiff} days old. Only items purchased within 7 days can be exchanged.`,
            variant: 'destructive',
          })
          return
        }

        setSale(saleData)
        setStep('select-return')
      } else {
        toast({
          title: 'Sale Not Found',
          description: 'No sale found with that invoice number.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch sale details.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
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
      // Remove from return items
      setReturnItems(returnItems.filter(ri => ri.saleItemId !== item.id))
    } else {
      // Add to return items
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
        ri.saleItemId === saleItemId
          ? { ...ri, quantity: validQty }
          : ri
      ))
    }
  }

  const searchProducts = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearchingProducts(true)
    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(query)}&take=10`)
      const data = await response.json()
      setSearchResults(data.data || [])
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to search products.',
        variant: 'destructive',
      })
    } finally {
      setSearchingProducts(false)
    }
  }

  const handleAddExchangeItem = (product: any, variation?: any) => {
    const variationToUse = variation || product.variations?.[0]

    if (!variationToUse) {
      toast({
        title: 'Error',
        description: 'Product has no variations available.',
        variant: 'destructive',
      })
      return
    }

    const newItem: ExchangeItem = {
      productId: product.id,
      productVariationId: variationToUse.id,
      productName: variation ? `${product.name} - ${variation.name}` : product.name,
      quantity: 1,
      unitPrice: parseFloat(variationToUse.sellingPrice?.toString() || '0'),
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

  const calculateTotals = () => {
    const returnTotal = returnItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const exchangeTotal = exchangeItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const priceDifference = exchangeTotal - returnTotal
    const customerPays = Math.max(0, priceDifference)
    const customerCredit = Math.abs(Math.min(0, priceDifference))

    return {
      returnTotal,
      exchangeTotal,
      priceDifference,
      customerPays,
      customerCredit,
    }
  }

  const handleSubmitExchange = async () => {
    if (!sale) return
    if (returnItems.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one item to return.',
        variant: 'destructive',
      })
      return
    }
    if (exchangeItems.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one item to exchange.',
        variant: 'destructive',
      })
      return
    }
    if (!exchangeReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for the exchange.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const totals = calculateTotals()

      const response = await fetch(`/api/sales/${sale.id}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      toast({
        title: 'Exchange Processed',
        description: `Exchange ${data.exchangeNumber} completed successfully.`,
      })

      if (onSuccess) {
        onSuccess(data)
      }

      onClose()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process exchange.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const totals = calculateTotals()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Process Exchange
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1: Search for Sale */}
          {step === 'search' && (
            <div className="space-y-4">
              <div>
                <Label>Search Original Sale</Label>
                <form onSubmit={handleSearchSale} className="flex gap-2 mt-2">
                  <Input
                    placeholder="Enter invoice number or scan barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <Button type="submit" disabled={loading}>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </form>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">Exchange Policy</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Items must be exchanged within 7 days of purchase</li>
                      <li>Customer can exchange for any other item(s)</li>
                      <li>Price difference will be calculated automatically</li>
                      <li>If new items cost more, customer pays the difference</li>
                      <li>If new items cost less, customer can add more items</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Select Items to Return */}
          {step === 'select-return' && sale && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Invoice:</span>{' '}
                    <span className="font-medium">{sale.invoiceNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Date:</span>{' '}
                    <span className="font-medium">{new Date(sale.saleDate).toLocaleDateString()}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">Customer:</span>{' '}
                    <span className="font-medium">{sale.customer?.name || 'Walk-in Customer'}</span>
                  </div>
                </div>
              </div>

              <div>
                <Label>Select Items to Return</Label>
                <div className="mt-2 space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                  {sale.items.map((item) => {
                    const returnItem = returnItems.find(ri => ri.saleItemId === item.id)
                    const isSelected = !!returnItem

                    return (
                      <div
                        key={item.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                        onClick={() => !isSelected && handleToggleReturnItem(item)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-medium">{item.productVariation?.name || item.product.name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              SKU: {item.productVariation?.sku || item.product.sku}
                            </p>
                            <p className="text-sm mt-1">
                              ₱{parseFloat(item.unitPrice.toString()).toFixed(2)} × {item.quantity} = ₱
                              {parseFloat(item.lineTotal.toString()).toFixed(2)}
                            </p>
                          </div>

                          {isSelected && (
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">Return Qty:</Label>
                              <Input
                                type="number"
                                min="0"
                                max={item.quantity}
                                value={returnItem.quantity}
                                onChange={(e) => handleUpdateReturnQuantity(item.id, parseInt(e.target.value) || 0)}
                                className="w-20"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {returnItems.length > 0 && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Return Total: ₱{totals.returnTotal.toFixed(2)}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {returnItems.length} item(s) selected for return
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('search')}>
                  Back
                </Button>
                <Button
                  onClick={() => setStep('select-exchange')}
                  disabled={returnItems.length === 0}
                  className="flex-1"
                >
                  Next: Select Exchange Items
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Select Exchange Items */}
          {step === 'select-exchange' && (
            <div className="space-y-4">
              <div>
                <Label>Search Products to Exchange</Label>
                <div className="relative mt-2">
                  <Input
                    placeholder="Search products by name or SKU..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value)
                      searchProducts(e.target.value)
                    }}
                  />
                  {searchingProducts && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {searchResults.map((product) => (
                        <div
                          key={product.id}
                          className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0"
                          onClick={() => handleAddExchangeItem(product)}
                        >
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            SKU: {product.sku} | Stock: {product.variations?.[0]?.currentStock || 0}
                          </p>
                          <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-1">
                            ₱{parseFloat(product.variations?.[0]?.sellingPrice || 0).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {exchangeItems.length > 0 && (
                <div>
                  <Label>Exchange Items</Label>
                  <div className="mt-2 space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                    {exchangeItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-3 border rounded-lg p-3">
                        <div className="flex-1">
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            ₱{item.unitPrice.toFixed(2)} each
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Qty:</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateExchangeQuantity(index, parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                        </div>
                        <div className="text-right min-w-24">
                          <p className="font-medium">₱{(item.quantity * item.unitPrice).toFixed(2)}</p>
                        </div>
                        <Button
                          size="icon-sm"
                          variant="outline"
                          onClick={() => handleRemoveExchangeItem(index)}
                          className="hover:border-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {exchangeItems.length > 0 && (
                <div className="space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Return Value:</span>
                      <span className="font-medium">₱{totals.returnTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Exchange Value:</span>
                      <span className="font-medium">₱{totals.exchangeTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="font-medium">Price Difference:</span>
                      <span className={`font-bold ${totals.priceDifference >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {totals.priceDifference >= 0 ? '+' : ''}₱{totals.priceDifference.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {totals.customerPays > 0 && (
                    <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <p className="font-medium text-red-900 dark:text-red-100">
                        Customer Must Pay: ₱{totals.customerPays.toFixed(2)}
                      </p>
                      <div className="mt-3">
                        <Label>Payment Method</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="gcash">Gcash</SelectItem>
                            <SelectItem value="nfc">NFC</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="card">Card Transaction</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {totals.customerCredit > 0 && (
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <p className="font-medium text-green-900 dark:text-green-100">
                        Customer Credit: ₱{totals.customerCredit.toFixed(2)}
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Customer can select more items to use this credit
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('select-return')}>
                  Back
                </Button>
                <Button
                  onClick={() => setStep('confirm')}
                  disabled={exchangeItems.length === 0}
                  className="flex-1"
                >
                  Next: Confirm Exchange
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm and Submit */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div>
                <Label>Reason for Exchange *</Label>
                <Textarea
                  placeholder="e.g., Defective item, Wrong size, Customer preference..."
                  value={exchangeReason}
                  onChange={(e) => setExchangeReason(e.target.value)}
                  className="mt-2 min-h-24"
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">{exchangeReason.length}/500 characters</p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="font-medium text-blue-900 dark:text-blue-100 mb-3">Exchange Summary</p>

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-blue-700 dark:text-blue-300 font-medium mb-1">Items Being Returned:</p>
                    {returnItems.map((item, index) => (
                      <div key={index} className="flex justify-between text-blue-800 dark:text-blue-200">
                        <span>{item.productName} × {item.quantity}</span>
                        <span>₱{(item.quantity * item.unitPrice).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-medium mt-1 pt-1 border-t border-blue-200 dark:border-blue-700">
                      <span>Return Total:</span>
                      <span>₱{totals.returnTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-blue-700 dark:text-blue-300 font-medium mb-1">Exchange Items:</p>
                    {exchangeItems.map((item, index) => (
                      <div key={index} className="flex justify-between text-blue-800 dark:text-blue-200">
                        <span>{item.productName} × {item.quantity}</span>
                        <span>₱{(item.quantity * item.unitPrice).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-medium mt-1 pt-1 border-t border-blue-200 dark:border-blue-700">
                      <span>Exchange Total:</span>
                      <span>₱{totals.exchangeTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-t-2 border-blue-300 dark:border-blue-700 pt-2">
                    {totals.customerPays > 0 ? (
                      <div className="flex justify-between font-bold text-red-600 dark:text-red-400">
                        <span>Customer Pays ({paymentMethod}):</span>
                        <span>₱{totals.customerPays.toFixed(2)}</span>
                      </div>
                    ) : totals.customerCredit > 0 ? (
                      <div className="flex justify-between font-bold text-green-600 dark:text-green-400">
                        <span>Customer Credit:</span>
                        <span>₱{totals.customerCredit.toFixed(2)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between font-bold text-gray-600 dark:text-gray-400">
                        <span>Even Exchange</span>
                        <span>₱0.00</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('select-exchange')}>
                  Back
                </Button>
                <Button
                  onClick={handleSubmitExchange}
                  disabled={submitting || !exchangeReason.trim()}
                  className="flex-1"
                  variant="success"
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
      </DialogContent>
    </Dialog>
  )
}
