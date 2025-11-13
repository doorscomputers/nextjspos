"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MagnifyingGlassIcon, CheckCircleIcon, XCircleIcon, CreditCardIcon } from '@heroicons/react/24/outline'
import { formatCurrency } from '@/lib/currencyUtils'
import { toast } from 'sonner'

interface UnpaidInvoice {
  id: number
  invoiceNumber: string
  invoiceDate: string
  totalAmount: number
  paidAmount: number
  balance: number
  customerName: string
  customerId: number
}

interface ARPaymentCollectionModalProps {
  isOpen: boolean
  onClose: () => void
  shiftId: number
  onPaymentSuccess?: () => void
  preSelectedCustomerId?: number  // Pre-filter to specific customer
  preSelectedCustomerName?: string  // Display customer name
}

export default function ARPaymentCollectionModal({
  isOpen,
  onClose,
  shiftId,
  onPaymentSuccess,
  preSelectedCustomerId,
  preSelectedCustomerName
}: ARPaymentCollectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<UnpaidInvoice | null>(null)

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [processing, setProcessing] = useState(false)

  // Fetch unpaid invoices
  const fetchUnpaidInvoices = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/reports/unpaid-invoices')
      if (!response.ok) throw new Error('Failed to fetch unpaid invoices')

      const data = await response.json()
      setUnpaidInvoices(data.invoices || [])
    } catch (error: any) {
      console.error('Error fetching unpaid invoices:', error)
      toast.error('Failed to load unpaid invoices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchUnpaidInvoices()
      setSelectedInvoice(null)
      setPaymentAmount('')
      setPaymentMethod('cash')
      setReferenceNumber('')
    }
  }, [isOpen])

  // Filter invoices by search term and pre-selected customer
  const filteredInvoices = unpaidInvoices.filter(invoice => {
    // If pre-selected customer, filter to that customer only
    if (preSelectedCustomerId && invoice.customerId !== preSelectedCustomerId) {
      return false
    }
    // Then apply search filter
    return (
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  // Handle invoice selection
  const selectInvoice = (invoice: UnpaidInvoice) => {
    setSelectedInvoice(invoice)
    setPaymentAmount(invoice.balance.toString())
  }

  // Handle payment submission
  const handleSubmitPayment = async () => {
    if (!selectedInvoice) {
      toast.error('Please select an invoice')
      return
    }

    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }

    if (amount > selectedInvoice.balance) {
      toast.error('Payment amount cannot exceed invoice balance')
      return
    }

    if (!paymentMethod) {
      toast.error('Please select a payment method')
      return
    }

    setProcessing(true)
    try {
      const response = await fetch(`/api/sales/${selectedInvoice.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          paymentMethod,
          referenceNumber: referenceNumber || null,
          shiftId, // Link to current shift
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record payment')
      }

      toast.success(`Payment of ${formatCurrency(amount)} recorded successfully!`, {
        description: `Invoice ${selectedInvoice.invoiceNumber} - Remaining balance: ${formatCurrency(data.invoice.newBalance)}`
      })

      // Refresh invoice list
      await fetchUnpaidInvoices()

      // Reset form
      setSelectedInvoice(null)
      setPaymentAmount('')
      setPaymentMethod('cash')
      setReferenceNumber('')

      // Notify parent
      if (onPaymentSuccess) {
        onPaymentSuccess()
      }

    } catch (error: any) {
      console.error('Error recording payment:', error)
      toast.error(error.message || 'Failed to record payment')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCardIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Collect AR Payment
            {preSelectedCustomerName && (
              <span className="ml-2 px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full border border-green-300">
                Customer: {preSelectedCustomerName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by invoice number or customer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={fetchUnpaidInvoices}>
              Refresh
            </Button>
          </div>

          {/* Invoice List */}
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading invoices...</div>
              ) : filteredInvoices.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {searchTerm ? 'No invoices found matching your search' : 'No unpaid invoices found'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow
                        key={invoice.id}
                        className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                          selectedInvoice?.id === invoice.id ? 'bg-blue-50 dark:bg-blue-950' : ''
                        }`}
                        onClick={() => selectInvoice(invoice)}
                      >
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>{new Date(invoice.invoiceDate).toLocaleDateString()}</TableCell>
                        <TableCell>{invoice.customerName}</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.totalAmount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.paidAmount)}</TableCell>
                        <TableCell className="text-right font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(invoice.balance)}
                        </TableCell>
                        <TableCell>
                          {selectedInvoice?.id === invoice.id && (
                            <CheckCircleIcon className="w-5 h-5 text-blue-600" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* Payment Form */}
          {selectedInvoice && (
            <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Collect Payment</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Invoice: <span className="font-medium">{selectedInvoice.invoiceNumber}</span></div>
                  <div>Customer: <span className="font-medium">{selectedInvoice.customerName}</span></div>
                  <div>Total Amount: <span className="font-medium">{formatCurrency(selectedInvoice.totalAmount)}</span></div>
                  <div>Outstanding Balance: <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(selectedInvoice.balance)}</span></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paymentAmount">Payment Amount *</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="text-lg font-bold"
                  />
                </div>

                <div>
                  <Label htmlFor="paymentMethod">Payment Method *</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="paymentMethod">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="gcash">GCash</SelectItem>
                      <SelectItem value="paymaya">PayMaya</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentMethod !== 'cash' && (
                  <div className="col-span-2">
                    <Label htmlFor="referenceNumber">Reference Number</Label>
                    <Input
                      id="referenceNumber"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="Transaction ID, Cheque #, etc."
                    />
                  </div>
                )}
              </div>

              <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800">
                <AlertDescription className="text-yellow-800 dark:text-yellow-200 text-sm">
                  <strong>Note:</strong> This payment will be recorded in your current shift and included in today's X/Z reading.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitPayment}
            disabled={!selectedInvoice || processing}
          >
            {processing ? 'Processing...' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
