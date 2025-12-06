'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArrowLeftIcon, CheckCircleIcon, QrCodeIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import Link from 'next/link'

interface SerialNumberData {
  serialNumber: string
  imei?: string
  condition: 'new' | 'used' | 'refurbished' | 'damaged' | 'defective'
}

interface PurchaseItem {
  id: number
  productId: number
  productVariationId: number
  quantity: string
  quantityReceived: string
  requiresSerial: boolean
  product: {
    id: number
    name: string
    sku: string
  }
  productVariation: {
    id: number
    name: string
  }
}

interface Purchase {
  id: number
  purchaseOrderNumber: string
  status: string
  supplier: {
    name: string
  }
  items: PurchaseItem[]
}

export default function ReceiveGoodsPage() {
  const params = useParams()
  const router = useRouter()
  const purchaseId = params.id as string

  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0])
  const [receiveQuantities, setReceiveQuantities] = useState<{ [key: number]: number }>({})
  const [serialNumbers, setSerialNumbers] = useState<{ [key: number]: SerialNumberData[] }>({})
  const [notes, setNotes] = useState('')

  // Current serial input
  const [currentItemId, setCurrentItemId] = useState<number | null>(null)
  const [serialInput, setSerialInput] = useState('')
  const [bulkSerialInput, setBulkSerialInput] = useState('')
  const [entryMode, setEntryMode] = useState<'scan' | 'bulk'>('scan')

  useEffect(() => {
    fetchPurchase()
  }, [purchaseId])

  const fetchPurchase = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/purchases?page=1&limit=1000`)
      const data = await response.json()

      if (response.ok) {
        const foundPurchase = data.purchases?.find((p: Purchase) => p.id === parseInt(purchaseId))
        if (foundPurchase) {
          setPurchase(foundPurchase)

          // Initialize receive quantities
          const quantities: { [key: number]: number } = {}
          foundPurchase.items.forEach((item: PurchaseItem) => {
            const remaining = parseFloat(item.quantity) - parseFloat(item.quantityReceived)
            quantities[item.id] = remaining > 0 ? remaining : 0
          })
          setReceiveQuantities(quantities)
        } else {
          toast.error('Purchase order not found')
          router.push('/dashboard/purchases')
        }
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Failed to load purchase order')
    } finally {
      setLoading(false)
    }
  }

  const addSerialNumber = async (itemId: number) => {
    if (!serialInput.trim()) {
      toast.error('Please enter a serial number')
      return
    }

    const existingSerials = serialNumbers[itemId] || []

    // Check duplicate in current session
    if (existingSerials.some(sn => sn.serialNumber === serialInput.trim())) {
      toast.error('Duplicate serial number in this receipt')
      setSerialInput('')
      return
    }

    // Check if limit reached
    if (existingSerials.length >= receiveQuantities[itemId]) {
      toast.error('All serial numbers entered for this item')
      return
    }

    // Check if serial exists in database
    try {
      console.log('[Serial Check] Checking serial:', serialInput.trim())
      const checkResponse = await fetch(`/api/serial-numbers/check?serial=${encodeURIComponent(serialInput.trim())}`)
      console.log('[Serial Check] Response status:', checkResponse.status)

      if (!checkResponse.ok) {
        console.error('[Serial Check] API error:', checkResponse.statusText)
        toast.error('Failed to validate serial number. Please try again.')
        return
      }

      const checkData = await checkResponse.json()
      console.log('[Serial Check] Response data:', checkData)

      if (checkData.exists) {
        console.log('[Serial Check] DUPLICATE FOUND!')
        toast.error(
          `⚠️ Serial number already exists!\n` +
          `Product: ${checkData.serial.product}\n` +
          `Supplier: ${checkData.serial.supplier}\n` +
          `Receipt: ${checkData.serial.receiptNumber}`,
          { duration: 6000 }
        )
        setSerialInput('')
        return
      }

      console.log('[Serial Check] Serial is unique, proceeding...')
    } catch (error) {
      console.error('[Serial Check] Exception:', error)
      toast.error('Failed to validate serial number. Please try again.')
      return
    }

    const newSerial: SerialNumberData = {
      serialNumber: serialInput.trim(),
      condition: 'new'
    }

    const updated = [...existingSerials, newSerial]
    setSerialNumbers({ ...serialNumbers, [itemId]: updated })
    setSerialInput('')

    const remaining = receiveQuantities[itemId] - updated.length
    if (remaining > 0) {
      toast.success(`Serial added! ${remaining} remaining`)
    } else {
      toast.success('All serials entered for this item!')
    }
  }

  const processBulkSerials = async (itemId: number) => {
    if (!bulkSerialInput.trim()) {
      toast.error('Please enter serial numbers')
      return
    }

    const lines = bulkSerialInput
      .split(/[\n,;]/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))

    const existingSerials = serialNumbers[itemId] || []
    const maxNeeded = receiveQuantities[itemId] - existingSerials.length
    const newSerials: SerialNumberData[] = []
    const skippedDuplicates: string[] = []
    const skippedInDb: string[] = []
    let skippedExcess = 0

    toast.loading('Validating serial numbers...', { id: 'bulk-validate' })

    for (const line of lines) {
      const sn = line.trim()

      // Check if we've reached the limit
      if (newSerials.length >= maxNeeded) {
        skippedExcess++
        continue
      }

      // Check duplicates in current session (silently skip)
      if (existingSerials.some(s => s.serialNumber === sn) || newSerials.some(s => s.serialNumber === sn)) {
        skippedDuplicates.push(sn)
        continue
      }

      // Check if serial exists in database
      try {
        const checkResponse = await fetch(`/api/serial-numbers/check?serial=${encodeURIComponent(sn)}`)
        const checkData = await checkResponse.json()

        if (checkData.exists) {
          skippedInDb.push(sn)
          continue
        }
      } catch (error) {
        console.error('Error checking serial:', sn, error)
        continue
      }

      newSerials.push({
        serialNumber: sn,
        condition: 'new'
      })
    }

    toast.dismiss('bulk-validate')

    // Build summary message
    const messages: string[] = []

    if (newSerials.length > 0) {
      const updated = [...existingSerials, ...newSerials]
      setSerialNumbers({ ...serialNumbers, [itemId]: updated })
      setBulkSerialInput('')
      messages.push(`✅ Successfully added ${newSerials.length} serial number(s)`)
    }

    if (skippedDuplicates.length > 0) {
      messages.push(`📋 Ignored ${skippedDuplicates.length} duplicate(s) in file`)
    }

    if (skippedInDb.length > 0) {
      messages.push(`⚠️ Ignored ${skippedInDb.length} serial(s) already in database`)
    }

    if (skippedExcess > 0) {
      messages.push(`📦 Ignored ${skippedExcess} excess serial(s) - only ${maxNeeded} needed`)
    }

    if (newSerials.length > 0) {
      toast.success(messages.join('\n'), { duration: 5000 })
    } else {
      toast.error('No valid serial numbers to add. ' + messages.slice(1).join('. '))
    }
  }

  const removeSerial = (itemId: number, index: number) => {
    const existingSerials = serialNumbers[itemId] || []
    const updated = existingSerials.filter((_, i) => i !== index)
    setSerialNumbers({ ...serialNumbers, [itemId]: updated })
  }

  const downloadTemplate = (itemId: number) => {
    if (!purchase) return

    const item = purchase.items.find(i => i.id === itemId)
    if (!item) return

    const receiveQty = receiveQuantities[itemId] || 0

    // Create CSV content
    const csvContent = [
      '# Serial Number Import Template',
      `# Product: ${item.product.name} - ${item.productVariation.name}`,
      `# SKU: ${item.product.sku}`,
      `# Supplier: ${purchase.supplier.name}`,
      `# Date: ${receiveDate}`,
      `# Quantity to Receive: ${receiveQty}`,
      '',
      'Serial Number',
      ...Array(receiveQty).fill('')
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `serials_${item.product.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.csv`)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success('Template downloaded!')
  }

  
  const handleSubmit = async () => {
    if (!purchase) return

    try {
      // Build items array
      const itemsToReceive = Object.entries(receiveQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, qty]) => {
          const purchaseItem = purchase.items.find(i => i.id === parseInt(itemId))
          const itemSerialNumbers = serialNumbers[parseInt(itemId)] || []

          // Validate serial numbers if required
          if (purchaseItem?.requiresSerial && itemSerialNumbers.length !== qty) {
            throw new Error(`${purchaseItem.product.name} requires ${qty} serial number(s), but only ${itemSerialNumbers.length} provided`)
          }

          return {
            purchaseItemId: parseInt(itemId),
            quantityReceived: qty,
            serialNumbers: itemSerialNumbers.length > 0 ? itemSerialNumbers : undefined,
            notes: '',
          }
        })

      if (itemsToReceive.length === 0) {
        toast.error('Please specify quantities to receive')
        return
      }

      setSaving(true)
      const response = await fetch(`/api/purchases/${purchaseId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptDate: receiveDate,
          items: itemsToReceive,
          notes,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        console.log('✅ GRN Created Successfully:', data)
        console.log('🔄 Redirecting to:', `/dashboard/purchases/receipts/${data.id}`)

        toast.success(`GRN ${data.receiptNumber} created successfully! Redirecting...`)

        // Don't reset saving state - keep button disabled during redirect
        // Redirect to the GRN detail page
        router.push(`/dashboard/purchases/receipts/${data.id}`)
        return // Exit early, don't reset saving state
      } else {
        console.error('❌ GRN Creation Failed:', data.error)

        // If a pending GRN already exists, redirect to it
        if (data.existingGRNId) {
          toast.error(data.error || 'GRN already exists. Redirecting...')
          setTimeout(() => {
            router.push(`/dashboard/purchases/receipts/${data.existingGRNId}`)
          }, 1500)
          return // Keep button disabled during redirect
        }

        toast.error(data.error || 'Failed to create GRN')
        setSaving(false)
      }
    } catch (error: any) {
      console.error('❌ Error creating GRN:', error)
      toast.error(error.message || 'Failed to create GRN')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!purchase) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Purchase order not found
        </div>
      </div>
    )
  }

  // Check if PO is cancelled - cannot receive goods for cancelled POs
  if (purchase.status === 'cancelled') {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <XMarkIcon className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-800">Cannot Receive Goods</h3>
              <p className="mt-2 text-red-700">
                This Purchase Order (<strong>{purchase.purchaseOrderNumber}</strong>) has been cancelled.
                You cannot create a Goods Receipt Note (GRN) for a cancelled purchase order.
              </p>
              <div className="mt-4">
                <Link href={`/dashboard/purchases/${purchaseId}`}>
                  <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
                    <ArrowLeftIcon className="w-4 h-4 mr-2" />
                    Back to Purchase Order
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Check if PO is already fully received
  if (purchase.status === 'received') {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-800">Already Fully Received</h3>
              <p className="mt-2 text-green-700">
                This Purchase Order (<strong>{purchase.purchaseOrderNumber}</strong>) has already been fully received.
                No more goods can be added.
              </p>
              <div className="mt-4">
                <Link href={`/dashboard/purchases/${purchaseId}`}>
                  <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-100">
                    <ArrowLeftIcon className="w-4 h-4 mr-2" />
                    Back to Purchase Order
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/purchases/${purchaseId}`}>
            <Button
              variant="outline"
              size="sm"
              className="group px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 border-2 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 rounded-lg font-semibold"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform duration-300" />
              <span className="bg-gradient-to-r from-gray-700 to-gray-900 dark:from-gray-200 dark:to-gray-100 group-hover:from-blue-600 group-hover:to-indigo-600 dark:group-hover:from-blue-400 dark:group-hover:to-indigo-400 bg-clip-text text-transparent">
                Back
              </span>
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Receive Goods - Create GRN</h1>
            <p className="text-gray-500 mt-1">
              PO: {purchase.purchaseOrderNumber} | Supplier: {purchase.supplier.name}
            </p>
          </div>
        </div>
      </div>

      {/* Receipt Date */}
      <div className="bg-white p-6 rounded-lg shadow">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Receipt Date
        </label>
        <input
          type="date"
          value={receiveDate}
          readOnly
          disabled
          className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
        />
        <p className="text-xs text-gray-500 mt-2">
          Receipt date is recorded automatically when you submit.
        </p>
      </div>

      {/* Items */}
      <div className="space-y-4">
        {purchase.items.map((item) => {
          const ordered = parseFloat(item.quantity)
          const received = parseFloat(item.quantityReceived)
          const remaining = ordered - received
          const receiveQty = receiveQuantities[item.id] || 0
          const itemSerials = serialNumbers[item.id] || []
          const serialsComplete = !item.requiresSerial || itemSerials.length === receiveQty

          return (
            <div key={item.id} className="bg-white p-6 rounded-lg shadow space-y-4">
              {/* Item Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{item.product.name}</h3>
                  <p className="text-sm text-gray-500">
                    {item.productVariation.name} • SKU: {item.product.sku}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Ordered: {ordered} | Received: {received} | Remaining: {remaining}
                  </p>
                </div>
                {item.requiresSerial && (
                  <Badge variant="secondary">Serial Numbers Required</Badge>
                )}
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity to Receive
                </label>
                <input
                  type="number"
                  min="0"
                  max={remaining}
                  value={receiveQty}
                  onChange={(e) => setReceiveQuantities({
                    ...receiveQuantities,
                    [item.id]: parseFloat(e.target.value) || 0
                  })}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={remaining <= 0}
                />
                <span className="ml-2 text-sm text-gray-500">(Max: {remaining})</span>
              </div>

              {/* Serial Number Input */}
              {item.requiresSerial && receiveQty > 0 && (
                <div className="border-t pt-4 space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    {/* Progress */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Serial Numbers Progress</span>
                      <Badge variant={serialsComplete ? "default" : "destructive"}>
                        {itemSerials.length} / {receiveQty}
                      </Badge>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          serialsComplete ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min((itemSerials.length / receiveQty) * 100, 100)}%` }}
                      />
                    </div>

                    {/* Entry Mode Toggle */}
                    <div className="flex gap-2 mb-4">
                      <Button
                        type="button"
                        size="sm"
                        variant={entryMode === 'scan' ? 'default' : 'outline'}
                        onClick={() => {
                          setEntryMode('scan')
                          setCurrentItemId(item.id)
                        }}
                        className={entryMode === 'scan'
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                          : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                        }
                      >
                        <QrCodeIcon className="w-4 h-4 mr-2" />
                        Scan 1 by 1
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={entryMode === 'bulk' ? 'default' : 'outline'}
                        onClick={() => {
                          setEntryMode('bulk')
                          setCurrentItemId(item.id)
                        }}
                        className={entryMode === 'bulk'
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                          : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                        }
                      >
                        Bulk Import
                      </Button>
                    </div>

                    {/* Scan Mode */}
                    {currentItemId === item.id && entryMode === 'scan' && itemSerials.length < receiveQty && (
                      <div className="bg-white border-2 border-blue-400 rounded-lg p-4">
                        <div className="flex gap-2">
                          <Input
                            value={serialInput}
                            onChange={(e) => setSerialInput(e.target.value)}
                            placeholder="Scan or type serial number..."
                            className="flex-1 text-lg font-mono"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addSerialNumber(item.id)
                              }
                            }}
                          />
                          <Button
                            onClick={() => addSerialNumber(item.id)}
                            className="px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                          >
                            Add
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          💡 Press Enter after each scan
                        </p>
                      </div>
                    )}

                    {/* Bulk Mode */}
                    {currentItemId === item.id && entryMode === 'bulk' && itemSerials.length < receiveQty && (
                      <div className="bg-white border-2 border-blue-400 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Import from CSV or Paste</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => downloadTemplate(item.id)}
                            className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 hover:from-purple-100 hover:to-indigo-100 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30 text-purple-700 dark:text-purple-300 border-2 border-purple-300 dark:border-purple-700 shadow-md hover:shadow-lg transition-all duration-200 font-medium hover:scale-105"
                          >
                            Download Template
                          </Button>
                        </div>
                        <textarea
                          value={bulkSerialInput}
                          onChange={(e) => setBulkSerialInput(e.target.value)}
                          placeholder="Paste serial numbers here (one per line)&#10;&#10;Example:&#10;SN123456&#10;SN123457&#10;SN123458"
                          rows={6}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => processBulkSerials(item.id)}
                            className="px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                          >
                            Import Serials
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setBulkSerialInput('')}
                            className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700 dark:hover:to-gray-600 border-2 border-gray-300 dark:border-gray-600 shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                          >
                            Clear
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                          💡 Tip: Download the template, fill it in Excel, then copy & paste the serial numbers here
                        </p>
                      </div>
                    )}

                    {/* Serial Numbers List */}
                    {itemSerials.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Entered Serial Numbers:</h4>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {itemSerials.map((sn, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-2 bg-white rounded border"
                            >
                              <span className="font-mono text-sm font-semibold">{sn.serialNumber}</span>
                              <button
                                onClick={() => removeSerial(item.id, index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Notes */}
      <div className="bg-white p-6 rounded-lg shadow">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="Enter any notes about this receipt..."
        />
      </div>

      {/* Submit */}
      <div className="bg-white p-6 rounded-lg shadow flex gap-3">
        <Button
          onClick={handleSubmit}
          disabled={saving}
          size="lg"
          className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg hover:shadow-2xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <CheckCircleIcon className="w-5 h-5 mr-2" />
          {saving ? 'Creating GRN...' : 'Create GRN'}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push(`/dashboard/purchases/${purchaseId}`)}
          size="lg"
          className="px-6 py-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700 dark:hover:to-gray-600 border-2 border-gray-300 dark:border-gray-600 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 font-medium text-gray-700 dark:text-gray-200"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
