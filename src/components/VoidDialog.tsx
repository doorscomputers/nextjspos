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
  const [managerPassword, setManagerPassword] = useState('')

  // Load initial sale if provided
  useEffect(() => {
    if (isOpen && (initialSaleId || initialInvoiceNumber)) {
      fetchSale(initialSaleId?.toString() || initialInvoiceNumber!)
    }
  }, [isOpen, initialSaleId, initialInvoiceNumber])

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep(initialSaleId || initialInvoiceNumber ? 'confirm' : 'search')
      setSearchQuery(initialInvoiceNumber || '')
      setSale(null)
      setVoidReason('')
      setManagerPassword('')
    }
  }, [isOpen, initialSaleId, initialInvoiceNumber])

  const fetchSale = async (invoiceNumberOrId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/sales/devextreme?searchValue=${encodeURIComponent(invoiceNumberOrId)}&take=1`)
      const data = await response.json()

      if (data.data && data.data.length > 0) {
        const saleData = data.data[0]

        // Validate sale status
        if (saleData.status === 'voided') {
          toast.error('Sale Already Voided', {
            description: `Invoice ${saleData.invoiceNumber} is already voided.`,
          })
          return
        }

        if (saleData.status === 'cancelled') {
          toast.error('Cannot Void Cancelled Sale', {
            description: `Invoice ${saleData.invoiceNumber} is cancelled and cannot be voided.`,
          })
          return
        }

        setSale(saleData)
        setStep('confirm')
      } else {
        toast.error('Sale Not Found', {
          description: `No sale found with invoice number "${invoiceNumberOrId}".`,
        })
      }
    } catch (error) {
      console.error('[Void Search] Error:', error)
      toast.error('Failed to fetch sale details.')
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

    if (!managerPassword.trim()) {
      toast.error('Manager password is required to authorize void')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/sales/${sale.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voidReason: voidReason.trim(),
          managerPassword: managerPassword.trim(),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Sale Voided Successfully', {
          description: `Invoice ${sale.invoiceNumber} has been voided. Inventory has been restored.`,
        })

        onSuccess?.()
        onClose()
      } else {
        toast.error('Void Failed', {
          description: data.error || 'Failed to void sale. Please try again.',
        })
      }
    } catch (error) {
      console.error('[Void Submit] Error:', error)
      toast.error('Failed to void sale. Please try again.')
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

        {/* Step 1: Search for sale */}
        {step === 'search' && (
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
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Only Branch Managers and Admins can authorize void transactions
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'confirm' && !initialSaleId && !initialInvoiceNumber && (
            <Button variant="outline" onClick={handleBack} disabled={submitting}>
              Back to Search
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          {step === 'confirm' && (
            <Button
              variant="destructive"
              onClick={handleVoid}
              disabled={submitting || !voidReason.trim() || !managerPassword.trim()}
              className="gap-2 min-w-32"
            >
              {submitting && <span className="animate-spin">⏳</span>}
              {submitting ? 'Voiding...' : 'Void Sale'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
