"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ArrowLeftIcon, PlusIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { formatCurrency } from '@/lib/currencyUtils'

interface Supplier {
  id: number
  name: string
  email: string | null
  mobile: string | null
}

interface AccountsPayable {
  id: number
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  amount: number
  paidAmount: number
  balanceAmount: number
  supplier: Supplier
}

interface PaymentAllocation {
  apId: number
  allocatedAmount: number
}

export default function BatchPaymentPage() {
  const { can } = usePermissions()
  const router = useRouter()
  const searchParams = useSearchParams()
  const apIdsParam = searchParams.get('apIds')

  const [loading, setLoading] = useState(false)
  const [payables, setPayables] = useState<AccountsPayable[]>([])
  const [bankOptions, setBankOptions] = useState<string[]>([])
  const [supplier, setSupplier] = useState<Supplier | null>(null)

  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [totalPaymentAmount, setTotalPaymentAmount] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [referenceNumber, setReferenceNumber] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  // Cheque specific fields
  const [chequeNumber, setChequeNumber] = useState<string>('')
  const [chequeDate, setChequeDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [bankName, setBankName] = useState<string>('')
  const [isPostDated, setIsPostDated] = useState<boolean>(false)

  // Bank transfer specific fields
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('')
  const [bankTransferReference, setBankTransferReference] = useState<string>('')

  // Card payment specific fields
  const [cardType, setCardType] = useState<string>('credit')
  const [cardLast4, setCardLast4] = useState<string>('')
  const [cardTransactionId, setCardTransactionId] = useState<string>('')

  // Payment allocations (how much to pay for each invoice)
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([])

  // Quick add bank dialog
  const [showAddBankDialog, setShowAddBankDialog] = useState<boolean>(false)
  const [newBankName, setNewBankName] = useState<string>('')

  useEffect(() => {
    if (!apIdsParam) {
      toast.error('No invoices selected')
      router.push('/dashboard/accounts-payable')
      return
    }

    fetchPayables()
    fetchBankOptions()
  }, [apIdsParam])

  useEffect(() => {
    // Auto-calculate allocations when payables are loaded
    if (payables.length > 0) {
      const totalBalance = payables.reduce((sum, p) => sum + p.balanceAmount, 0)
      setTotalPaymentAmount(totalBalance.toString())

      // Initialize allocations with full balance for each invoice
      const initialAllocations = payables.map(p => ({
        apId: p.id,
        allocatedAmount: p.balanceAmount
      }))
      setAllocations(initialAllocations)
    }
  }, [payables])

  const fetchPayables = async () => {
    try {
      setLoading(true)
      const apIds = apIdsParam!.split(',').map(id => parseInt(id))

      const response = await fetch('/api/accounts-payable?ids=' + apIds.join(','))
      const data = await response.json()

      if (response.ok) {
        const fetchedPayables = data.payables || []
        setPayables(fetchedPayables)

        // Verify all payables are from the same supplier
        if (fetchedPayables.length > 0) {
          const supplierIds = [...new Set(fetchedPayables.map((p: AccountsPayable) => p.supplier.id))]
          if (supplierIds.length > 1) {
            toast.error('All selected invoices must be from the same supplier')
            router.push('/dashboard/accounts-payable')
            return
          }
          setSupplier(fetchedPayables[0].supplier)
        }
      } else {
        toast.error(data.error || 'Failed to fetch invoices')
        router.push('/dashboard/accounts-payable')
      }
    } catch (error) {
      console.error('Error fetching payables:', error)
      toast.error('Failed to fetch invoices')
      router.push('/dashboard/accounts-payable')
    } finally {
      setLoading(false)
    }
  }

  const fetchBankOptions = async () => {
    try {
      const response = await fetch('/api/bank-options')
      const data = await response.json()
      if (response.ok) {
        setBankOptions(data.banks || [])
      }
    } catch (error) {
      console.error('Error fetching bank options:', error)
    }
  }

  const handleAddNewBank = () => {
    if (newBankName.trim()) {
      if (!bankOptions.includes(newBankName.trim())) {
        setBankOptions([...bankOptions, newBankName.trim()])
      }
      setBankName(newBankName.trim())
      setNewBankName('')
      setShowAddBankDialog(false)
    }
  }

  const updateAllocation = (apId: number, amount: number) => {
    setAllocations(prev =>
      prev.map(a => a.apId === apId ? { ...a, allocatedAmount: amount } : a)
    )
  }

  const getTotalAllocated = () => {
    return allocations.reduce((sum, a) => sum + a.allocatedAmount, 0)
  }

  const getTotalBalance = () => {
    return payables.reduce((sum, p) => sum + p.balanceAmount, 0)
  }

  const autoAllocate = () => {
    const paymentAmount = parseFloat(totalPaymentAmount) || 0
    let remaining = paymentAmount

    const newAllocations = payables.map(payable => {
      if (remaining <= 0) {
        return { apId: payable.id, allocatedAmount: 0 }
      }

      const amountToAllocate = Math.min(remaining, payable.balanceAmount)
      remaining -= amountToAllocate

      return {
        apId: payable.id,
        allocatedAmount: amountToAllocate
      }
    })

    setAllocations(newAllocations)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const paymentAmount = parseFloat(totalPaymentAmount)
    if (!paymentAmount || paymentAmount <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }

    const totalAllocated = getTotalAllocated()
    if (Math.abs(paymentAmount - totalAllocated) > 0.01) {
      toast.error(`Payment amount (${formatCurrency(paymentAmount)}) must match total allocated (${formatCurrency(totalAllocated)})`)
      return
    }

    if (paymentMethod === 'cheque' && !chequeNumber) {
      toast.error('Please enter cheque number')
      return
    }

    if (paymentMethod === 'bank_transfer' && !bankTransferReference) {
      toast.error('Please enter bank transfer reference')
      return
    }

    setLoading(true)

    try {
      const payload: any = {
        batchPayment: true,
        supplierId: supplier!.id,
        paymentMethod,
        totalAmount: paymentAmount,
        paymentDate,
        referenceNumber,
        notes,
        allocations: allocations.filter(a => a.allocatedAmount > 0),
      }

      if (paymentMethod === 'cheque') {
        payload.chequeNumber = chequeNumber
        payload.chequeDate = chequeDate
        payload.bankName = bankName
        payload.isPostDated = isPostDated
      } else if (paymentMethod === 'bank_transfer' || paymentMethod === 'savings_account') {
        payload.bankName = bankName
        payload.bankAccountNumber = bankAccountNumber
        payload.bankTransferReference = bankTransferReference
      } else if (paymentMethod === 'credit_card' || paymentMethod === 'debit_card') {
        payload.cardType = cardType
        payload.cardLast4 = cardLast4
        payload.cardTransactionId = cardTransactionId
      }

      const response = await fetch('/api/payments/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Batch payment recorded successfully for ${allocations.filter(a => a.allocatedAmount > 0).length} invoices`)
        router.push('/dashboard/accounts-payable')
      } else {
        toast.error(data.error || 'Failed to record batch payment')
      }
    } catch (error) {
      console.error('Error recording batch payment:', error)
      toast.error('Failed to record batch payment')
    } finally {
      setLoading(false)
    }
  }

  if (!can(PERMISSIONS.PAYMENT_CREATE)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to create payments.
        </div>
      </div>
    )
  }

  if (loading && payables.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Loading invoices...</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/accounts-payable">
          <Button variant="outline" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Batch Payment</h1>
          <p className="text-muted-foreground mt-1">
            Pay multiple invoices from {supplier?.name} in one transaction
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="border-blue-300 dark:border-blue-700 bg-blue-100 dark:bg-blue-900">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-50 font-bold">Payment Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Supplier</p>
              <p className="font-bold text-gray-900 dark:text-white">{supplier?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Total Invoices</p>
              <p className="font-bold text-gray-900 dark:text-white">{payables.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Total Balance Due</p>
              <p className="font-bold text-red-700 dark:text-red-300">{formatCurrency(getTotalBalance())}</p>
            </div>
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Payment Amount</p>
              <p className="font-bold text-green-700 dark:text-green-300">{formatCurrency(parseFloat(totalPaymentAmount) || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Invoice Allocation Card */}
        <Card className="border-2 border-gray-300 dark:border-gray-600">
          <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b-2 border-gray-300 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900 dark:text-white font-bold">Invoice Allocations</CardTitle>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={autoAllocate}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold border-2 border-blue-700 shadow-md"
              >
                Auto-Allocate
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto border-2 border-gray-300 dark:border-gray-600 rounded-lg">
              <table className="min-w-full divide-y-2 divide-gray-300 dark:divide-gray-600">
                <thead className="bg-gray-200 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white uppercase">Invoice #</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white uppercase">Due Date</th>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white uppercase">Balance Due</th>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white uppercase">Amount to Pay</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y-2 divide-gray-300 dark:divide-gray-600">
                  {payables.map((payable) => {
                    const allocation = allocations.find(a => a.apId === payable.id)
                    return (
                      <tr key={payable.id} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{payable.invoiceNumber}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                          {new Date(payable.dueDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-red-700 dark:text-red-300">
                          {formatCurrency(payable.balanceAmount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={payable.balanceAmount}
                            value={allocation?.allocatedAmount || 0}
                            onChange={(e) => updateAllocation(payable.id, parseFloat(e.target.value) || 0)}
                            className="w-32 px-3 py-2 border-2 border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold rounded-lg text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="bg-gray-200 dark:bg-gray-700 font-bold border-t-4 border-gray-400 dark:border-gray-500">
                    <td colSpan={2} className="px-4 py-4 text-sm text-right text-gray-900 dark:text-white font-bold">Total:</td>
                    <td className="px-4 py-4 text-sm text-right text-red-700 dark:text-red-300 font-bold">
                      {formatCurrency(getTotalBalance())}
                    </td>
                    <td className="px-4 py-4 text-sm text-right text-green-700 dark:text-green-300 font-bold">
                      {formatCurrency(getTotalAllocated())}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {Math.abs(parseFloat(totalPaymentAmount) - getTotalAllocated()) > 0.01 && totalPaymentAmount && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Payment amount ({formatCurrency(parseFloat(totalPaymentAmount))}) does not match total allocated ({formatCurrency(getTotalAllocated())})
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Total Payment Amount <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={totalPaymentAmount}
                  onChange={(e) => setTotalPaymentAmount(e.target.value)}
                  onBlur={autoAllocate}
                  className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                  placeholder="0.00"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Max: {formatCurrency(getTotalBalance())}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Payment Method <span className="text-destructive">*</span>
                </label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="savings_account">Savings Account</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Payment Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                  placeholder="Optional reference"
                />
              </div>
            </div>

            {/* Cheque-specific fields */}
            {paymentMethod === 'cheque' && (
              <div className="border-t border-border pt-4 space-y-4">
                <h3 className="text-lg font-semibold">Cheque Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Cheque Number <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      placeholder="Cheque number"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Cheque Date <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="date"
                      value={chequeDate}
                      onChange={(e) => {
                        setChequeDate(e.target.value)
                        setIsPostDated(new Date(e.target.value) > new Date())
                      }}
                      className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Bank Name
                    </label>
                    <div className="flex gap-2">
                      <Select value={bankName} onValueChange={setBankName}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select or add bank" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankOptions.length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">No banks found</div>
                          )}
                          {bankOptions.map((bank) => (
                            <SelectItem key={bank} value={bank}>
                              {bank}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="default"
                        size="icon"
                        onClick={() => setShowAddBankDialog(true)}
                        title="Add new bank"
                        className="bg-green-600 hover:bg-green-700 text-white font-bold border-2 border-green-700 shadow-md"
                      >
                        <PlusIcon className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center pt-8">
                    <input
                      type="checkbox"
                      id="isPostDated"
                      checked={isPostDated}
                      onChange={(e) => setIsPostDated(e.target.checked)}
                      className="w-4 h-4 text-primary border-input rounded focus:ring-ring"
                    />
                    <label htmlFor="isPostDated" className="ml-2 text-sm font-medium text-foreground">
                      Post-Dated Cheque
                    </label>
                  </div>
                </div>
                {isPostDated && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      ⚠️ This is a post-dated cheque. You will receive a reminder before the cheque date.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Bank transfer / Savings Account fields */}
            {(paymentMethod === 'bank_transfer' || paymentMethod === 'savings_account') && (
              <div className="border-t border-border pt-4 space-y-4">
                <h3 className="text-lg font-semibold">
                  {paymentMethod === 'savings_account' ? 'Savings Account Details' : 'Bank Transfer Details'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Bank Name
                    </label>
                    <div className="flex gap-2">
                      <Select value={bankName} onValueChange={setBankName}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select or add bank" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankOptions.length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">No banks found</div>
                          )}
                          {bankOptions.map((bank) => (
                            <SelectItem key={bank} value={bank}>
                              {bank}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="default"
                        size="icon"
                        onClick={() => setShowAddBankDialog(true)}
                        title="Add new bank"
                        className="bg-green-600 hover:bg-green-700 text-white font-bold border-2 border-green-700 shadow-md"
                      >
                        <PlusIcon className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Bank Account Number
                    </label>
                    <input
                      type="text"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      placeholder="Account number"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Transfer Reference <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={bankTransferReference}
                      onChange={(e) => setBankTransferReference(e.target.value)}
                      className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      placeholder="Transfer reference"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Card payment fields */}
            {(paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && (
              <div className="border-t border-border pt-4 space-y-4">
                <h3 className="text-lg font-semibold">Card Payment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Card Type
                    </label>
                    <Select value={cardType} onValueChange={setCardType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credit">Credit Card</SelectItem>
                        <SelectItem value="debit">Debit Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Last 4 Digits
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={cardLast4}
                      onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      placeholder="1234"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Transaction ID
                    </label>
                    <input
                      type="text"
                      value={cardTransactionId}
                      onChange={(e) => setCardTransactionId(e.target.value)}
                      className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      placeholder="Transaction ID from payment processor"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                placeholder="Optional payment notes"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-end">
          <Link href="/dashboard/accounts-payable">
            <Button
              type="button"
              variant="outline"
              className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-bold border-2 border-gray-400 shadow-md dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white dark:border-gray-500"
            >
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold border-2 border-blue-700 shadow-lg disabled:bg-gray-400 disabled:border-gray-500"
          >
            {loading ? 'Recording Batch Payment...' : (
              <>
                <CurrencyDollarIcon className="w-5 h-5 mr-2" />
                Record Batch Payment
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Quick Add Bank Dialog */}
      <Dialog open={showAddBankDialog} onOpenChange={setShowAddBankDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Bank</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium text-foreground mb-2">
              Bank Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={newBankName}
              onChange={(e) => setNewBankName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddNewBank()
                }
              }}
              className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
              placeholder="Enter bank name"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddBankDialog(false)
                setNewBankName('')
              }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-bold border-2 border-gray-400 shadow-md dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white dark:border-gray-500"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddNewBank}
              className="bg-green-600 hover:bg-green-700 text-white font-bold border-2 border-green-700 shadow-md"
            >
              Add Bank
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
