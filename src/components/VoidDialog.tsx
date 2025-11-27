'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Search, XCircle } from 'lucide-react'
import { toast } from 'sonner'

interface VoidDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  initialSaleId?: number
  initialInvoiceNumber?: string
}

interface Sale {
  id: number
  invoiceNumber: string
  saleDate: string
  totalAmount: number
  status: string
  customer?: {
    name: string
  }
  items: any[]
}

export default function VoidDialog({
  isOpen,
  onClose,
  onSuccess,
  initialSaleId,
  initialInvoiceNumber
}: VoidDialogProps) {
  const [step, setStep] = useState<'search' | 'confirm'>(initialSaleId || initialInvoiceNumber ? 'confirm' : 'search')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Sale search
  const [searchQuery, setSearchQuery] = useState(initialInvoiceNumber || '')
  const [sale, setSale] = useState<Sale | null>(null)

  // Void details
  const [voidReason, setVoidReason] = useState('')
  const [authMethod, setAuthMethod] = useState<'password' | 'rfid'>('password')
  const [managerPassword, setManagerPassword] = useState('')
  const [rfidLocationCode, setRfidLocationCode] = useState('')
  const [initialFetchError, setInitialFetchError] = useState<string | null>(null)

  // Triple confirmation state
  const [confirmationStep, setConfirmationStep] = useState(0) // 0 = not started, 1-3 = confirmation steps

  // Load initial sale if provided (only if valid ID or invoice number)
  useEffect(() => {
    if (isOpen && initialSaleId) {
      // Only auto-fetch if we have a valid sale ID
      fetchSale(initialSaleId.toString(), true)
    } else if (isOpen && initialInvoiceNumber && initialInvoiceNumber.trim().length > 0) {
      // Only auto-fetch if we have a non-empty invoice number
      fetchSale(initialInvoiceNumber.trim(), true)
    }
  }, [isOpen, initialSaleId, initialInvoiceNumber])

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep(initialSaleId || initialInvoiceNumber ? 'confirm' : 'search')
      setSearchQuery(initialInvoiceNumber || '')
      setSale(null)
      setVoidReason('')
      setAuthMethod('password')
      setManagerPassword('')
      setRfidLocationCode('')
      setConfirmationStep(0) // Reset triple confirmation
      setInitialFetchError(null) // Reset initial fetch error
    }
  }, [isOpen, initialSaleId, initialInvoiceNumber])

  const fetchSale = async (invoiceNumberOrId: string, isInitialFetch: boolean = false) => {
    // Don't search if empty or too short
    if (!invoiceNumberOrId || invoiceNumberOrId.trim().length < 2) {
      const errorMsg = 'Please enter at least 2 characters to search'
      toast.error(errorMsg)
      if (isInitialFetch) setInitialFetchError(errorMsg)
      return
    }

    setLoading(true)
    setInitialFetchError(null)
    try {
      // Use exactInvoice parameter when we have a known invoice number (from initial fetch)
      // This ensures we get the exact invoice, not a partial match
      const queryParam = isInitialFetch
        ? `exactInvoice=${encodeURIComponent(invoiceNumberOrId.trim())}`
        : `searchValue=${encodeURIComponent(invoiceNumberOrId.trim())}`
      const response = await fetch(`/api/sales/devextreme?${queryParam}&take=1`)
      const data = await response.json()

      if (data.data && data.data.length > 0) {
        const saleData = data.data[0]

        // IMPORTANT: Verify the search result matches what user searched for
        // This prevents returning random invoices when search doesn't match exactly
        const searchLower = invoiceNumberOrId.trim().toLowerCase()
        const invoiceLower = (saleData.invoiceNumber || '').toLowerCase()
        const customerLower = (saleData.customer?.name || '').toLowerCase()
        const customerMobile = (saleData.customer?.mobile || '').toLowerCase()

        // Check if search term is found in invoice number, customer name, or mobile
        const matchFound = invoiceLower.includes(searchLower) ||
                          customerLower.includes(searchLower) ||
                          customerMobile.includes(searchLower)

        if (!matchFound) {
          const errorMsg = `No sale found matching "${invoiceNumberOrId}".`
          toast.error('Sale Not Found', { description: errorMsg })
          if (isInitialFetch) setInitialFetchError(errorMsg)
          return
        }

        // Validate sale status
        if (saleData.status === 'voided') {
          const errorMsg = `Invoice ${saleData.invoiceNumber} is already voided.`
          toast.error('Sale Already Voided', { description: errorMsg })
          if (isInitialFetch) setInitialFetchError(errorMsg)
          return
        }

        if (saleData.status === 'cancelled') {
          const errorMsg = `Invoice ${saleData.invoiceNumber} is cancelled and cannot be voided.`
          toast.error('Cannot Void Cancelled Sale', { description: errorMsg })
          if (isInitialFetch) setInitialFetchError(errorMsg)
          return
        }

        setSale(saleData)
        setStep('confirm')
      } else {
        const errorMsg = `No sale found with invoice number "${invoiceNumberOrId}".`
        toast.error('Sale Not Found', { description: errorMsg })
        if (isInitialFetch) setInitialFetchError(errorMsg)
      }
    } catch (error) {
      console.error('[Void Search] Error:', error)
      const errorMsg = 'Failed to fetch sale details.'
      toast.error(errorMsg)
      if (isInitialFetch) setInitialFetchError(errorMsg)
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

  const handleVoid = async () => {
    if (!sale) return

    // Validate inputs
    if (!voidReason.trim()) {
      toast.error('Void reason is required')
      return
    }

    // Validate authorization method
    if (authMethod === 'password' && !managerPassword.trim()) {
      toast.error('Manager password is required to authorize void')
      return
    }

    if (authMethod === 'rfid' && !rfidLocationCode.trim()) {
      toast.error('RFID location code is required to authorize void')
      return
    }

    // TRIPLE CONFIRMATION SYSTEM - Extra safety for cashiers
    if (confirmationStep === 0) {
      // First confirmation
      const confirmed = window.confirm(
        '⚠️ ARE YOU SURE?\n\n' +
        `You are about to VOID:\n` +
        `Invoice: ${sale.invoiceNumber}\n` +
        `Amount: ₱${parseFloat(sale.totalAmount.toString()).toFixed(2)}\n` +
        `Customer: ${sale.customer?.name || 'Walk-in Customer'}\n\n` +
        'Click OK to continue or Cancel to stop.'
      )
      if (!confirmed) {
        return // User cancelled
      }
      setConfirmationStep(1)
      return
    }

    if (confirmationStep === 1) {
      // Second confirmation - Make them double-check
      const confirmed = window.confirm(
        '⚠️⚠️ ARE YOU REALLY SURE?\n\n' +
        'Did you check CAREFULLY the Transaction Number and Amount?\n\n' +
        `Invoice: ${sale.invoiceNumber}\n` +
        `Amount: ₱${parseFloat(sale.totalAmount.toString()).toFixed(2)}\n\n` +
        'This action CANNOT be undone!\n\n' +
        'Click OK to continue or Cancel to stop.'
      )
      if (!confirmed) {
        setConfirmationStep(0) // Reset
        return
      }
      setConfirmationStep(2)
      return
    }

    if (confirmationStep === 2) {
      // Third and FINAL confirmation - Last chance
      const confirmed = window.confirm(
        '🚨🚨🚨 FINAL WARNING 🚨🚨🚨\n\n' +
        'ARE YOU REALLY REALLY SURE you want to VOID this Sales Transaction?\n\n' +
        `Invoice: ${sale.invoiceNumber}\n` +
        `Amount: ₱${parseFloat(sale.totalAmount.toString()).toFixed(2)}\n\n` +
        '✅ Inventory will be RESTORED\n' +
        '✅ Customer balance will be ADJUSTED (if credit sale)\n' +
        '✅ Transaction will be marked as VOIDED\n\n' +
        'This is your LAST CHANCE to cancel!\n\n' +
        'Click OK to VOID NOW or Cancel to stop.'
      )
      if (!confirmed) {
        setConfirmationStep(0) // Reset
        return
      }
      // Fall through to actual void process
    }

    // All 3 confirmations passed - proceed with void
    setSubmitting(true)
    try {
      const response = await fetch(`/api/sales/${sale.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voidReason: voidReason.trim(),
          authMethod,
          managerPassword: authMethod === 'password' ? managerPassword.trim() : undefined,
          rfidLocationCode: authMethod === 'rfid' ? rfidLocationCode.trim() : undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Sale Voided Successfully', {
          description: `Invoice ${sale.invoiceNumber} has been voided. Inventory has been restored.`,
        })

        setConfirmationStep(0) // Reset for next time
        onSuccess?.()
        onClose()
      } else {
        toast.error('Void Failed', {
          description: data.error || 'Failed to void sale. Please try again.',
        })
        setConfirmationStep(0) // Reset on error
      }
    } catch (error) {
      console.error('[Void Submit] Error:', error)
      toast.error('Failed to void sale. Please try again.')
      setConfirmationStep(0) // Reset on error
    } finally {
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('search')
      setSale(null)
      setVoidReason('')
      setManagerPassword('')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <XCircle className="h-6 w-6 text-red-600" />
            Void Sale Transaction
          </DialogTitle>
          <DialogDescription>
            Void a sale transaction and restore inventory. Requires manager authorization.
          </DialogDescription>
        </DialogHeader>

        {/* Loading state when auto-fetching from initialInvoiceNumber */}
        {step === 'search' && initialInvoiceNumber && loading && !initialFetchError && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              Loading invoice <span className="font-semibold">{initialInvoiceNumber}</span>...
            </p>
          </div>
        )}

        {/* Error state when initial fetch fails */}
        {step === 'search' && initialInvoiceNumber && !loading && initialFetchError && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">Failed to Load Invoice</h3>
              <p className="text-sm text-red-600 dark:text-red-400">{initialFetchError}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                Invoice: <span className="font-mono font-semibold">{initialInvoiceNumber}</span>
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Search for sale - Only show if NO initialInvoiceNumber provided */}
        {step === 'search' && !initialInvoiceNumber && (
          <div className="space-y-4">
            <form onSubmit={handleSearchSale} className="space-y-4">
              <div>
                <Label htmlFor="searchQuery">Invoice Number</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="searchQuery"
                    type="text"
                    placeholder="Enter invoice number (e.g., INV-001)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    disabled={!searchQuery.trim() || loading}
                    className="gap-2"
                  >
                    <Search className="h-4 w-4" />
                    {loading ? 'Searching...' : 'Search'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Confirm void */}
        {step === 'confirm' && sale && (
          <div className="space-y-6">
            {/* Sale Info */}
            <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100">Warning: Void Transaction</h3>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                    This action will void the sale and restore all items to inventory. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Invoice:</span>
                  <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">{sale.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Date:</span>
                  <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">
                    {new Date(sale.saleDate).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Customer:</span>
                  <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">
                    {sale.customer?.name || 'Walk-in Customer'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                  <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">
                    ₱{parseFloat(sale.totalAmount.toString()).toFixed(2)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600 dark:text-gray-400">Items:</span>
                  <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">
                    {sale.items.length} item(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Void Reason */}
            <div>
              <Label htmlFor="voidReason" className="text-red-700 dark:text-red-400">
                Void Reason <span className="text-red-600">*</span>
              </Label>
              <Textarea
                id="voidReason"
                placeholder="Enter the reason for voiding this sale (e.g., customer request, pricing error, wrong items)"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="mt-1 min-h-[80px]"
                required
              />
            </div>

            {/* Manager Authorization */}
            <div className="space-y-4">
              <Label className="text-red-700 dark:text-red-400">
                Authorization Method <span className="text-red-600">*</span>
              </Label>

              {/* Authorization Method Radio Buttons */}
              <div className="flex gap-6 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="password"
                    checked={authMethod === 'password'}
                    onChange={(e) => setAuthMethod(e.target.value as 'password' | 'rfid')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm font-medium">Manager Password</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="rfid"
                    checked={authMethod === 'rfid'}
                    onChange={(e) => setAuthMethod(e.target.value as 'password' | 'rfid')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm font-medium">RFID Location Code</span>
                </label>
              </div>

              {/* Conditional Fields */}
              {authMethod === 'password' && (
                <div>
                  <Label htmlFor="managerPassword" className="text-red-700 dark:text-red-400">
                    Manager Password <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="managerPassword"
                    type="password"
                    placeholder="Enter manager/admin password to authorize"
                    value={managerPassword}
                    onChange={(e) => setManagerPassword(e.target.value)}
                    className="mt-1"
                    required
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Only Branch Managers and Admins can authorize void transactions
                  </p>
                </div>
              )}

              {authMethod === 'rfid' && (
                <div>
                  <Label htmlFor="rfidLocationCode" className="text-red-700 dark:text-red-400">
                    RFID Location Code <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="rfidLocationCode"
                    type="password"
                    placeholder="Scan or enter RFID location code"
                    value={rfidLocationCode}
                    onChange={(e) => setRfidLocationCode(e.target.value)}
                    className="mt-1 font-mono text-lg tracking-wider"
                    required
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Scan the RFID tag from your location to authorize this void transaction
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-3 pt-4">
          {step === 'confirm' && !initialSaleId && !initialInvoiceNumber && (
            <Button variant="outline" onClick={handleBack} disabled={submitting} size="lg">
              Back to Search
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={submitting} size="lg">
            Cancel
          </Button>
          {step === 'confirm' && (
            <Button
              variant="destructive"
              onClick={handleVoid}
              disabled={
                submitting ||
                !voidReason.trim() ||
                (authMethod === 'password' && !managerPassword.trim()) ||
                (authMethod === 'rfid' && !rfidLocationCode.trim())
              }
              size="lg"
              className="gap-2 min-w-52 font-bold text-xl bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800 shadow-lg"
            >
              {submitting && <span className="animate-spin">⏳</span>}
              <span className="text-white">
                {submitting ? 'Processing Void...' :
                 confirmationStep === 0 ? 'Confirm Void (Step 1)' :
                 confirmationStep === 1 ? 'Double Check (Step 2)' :
                 confirmationStep === 2 ? 'FINAL CONFIRM (Step 3)' : 'Void Transaction'}
              </span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
