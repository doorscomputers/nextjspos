"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button as UiButton } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { toast } from 'sonner'
import { ArrowLeftIcon, PlusIcon, CheckIcon } from '@heroicons/react/24/outline'
import { ChevronsUpDown } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/currencyUtils'
import { cn } from '@/lib/utils'
import Button from 'devextreme-react/button'

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

export default function NewPaymentPage() {
  const { can } = usePermissions()
  const router = useRouter()
  const searchParams = useSearchParams()
  const apIdFromUrl = searchParams.get('apId')

  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [payables, setPayables] = useState<AccountsPayable[]>([])
  const [filteredPayables, setFilteredPayables] = useState<AccountsPayable[]>([])
  const [bankOptions, setBankOptions] = useState<string[]>([])

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [selectedAPId, setSelectedAPId] = useState<string>(apIdFromUrl || '')
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [amount, setAmount] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [referenceNumber, setReferenceNumber] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [supplierSearchOpen, setSupplierSearchOpen] = useState<boolean>(false)

  // Cheque specific fields
  const [chequeNumber, setChequeNumber] = useState<string>('')
  const [chequeDate, setChequeDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [bankName, setBankName] = useState<string>('')
  const [isPostDated, setIsPostDated] = useState<boolean>(false)

  // Bank transfer specific fields
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('')
  const [bankTransferReference, setBankTransferReference] = useState<string>('')

  // Quick add bank dialog
  const [showAddBankDialog, setShowAddBankDialog] = useState<boolean>(false)
  const [newBankName, setNewBankName] = useState<string>('')
  const [newBankAccountNumber, setNewBankAccountNumber] = useState<string>('')

  // Card payment specific fields
  const [cardType, setCardType] = useState<string>('credit')
  const [cardLast4, setCardLast4] = useState<string>('')
  const [cardTransactionId, setCardTransactionId] = useState<string>('')

  useEffect(() => {
    fetchSuppliers()
    fetchPayables()
    fetchBankOptions()
  }, [])

  useEffect(() => {
    if (apIdFromUrl && payables.length > 0) {
      const ap = payables.find(p => p.id.toString() === apIdFromUrl)
      if (ap) {
        // Auto-populate supplier, invoice, and amount from the selected payable
        setSelectedSupplierId(ap.supplier.id.toString())
        setSelectedAPId(apIdFromUrl)
        setAmount(ap.balanceAmount.toString())

        // Log for debugging
        console.log('Auto-populated from AP:', {
          supplierId: ap.supplier.id,
          supplierName: ap.supplier.name,
          apId: apIdFromUrl,
          amount: ap.balanceAmount
        })
      }
    }
  }, [apIdFromUrl, payables])

  useEffect(() => {
    if (selectedSupplierId) {
      const filtered = payables.filter(p =>
        p.supplier.id.toString() === selectedSupplierId && p.balanceAmount > 0
      )
      setFilteredPayables(filtered)

      if (filtered.length === 1 && !selectedAPId) {
        setSelectedAPId(filtered[0].id.toString())
        setAmount(filtered[0].balanceAmount.toString())
      }
    } else {
      setFilteredPayables([])
    }
  }, [selectedSupplierId, payables])

  useEffect(() => {
    if (selectedAPId) {
      const ap = payables.find(p => p.id.toString() === selectedAPId)
      if (ap && !amount) {
        setAmount(ap.balanceAmount.toString())
      }
    }
  }, [selectedAPId, payables])

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers')
      const data = await response.json()
      if (response.ok) {
        setSuppliers(data.suppliers || [])
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const fetchPayables = async () => {
    try {
      const response = await fetch('/api/accounts-payable?status=unpaid,partially_paid')
      const data = await response.json()
      if (response.ok) {
        setPayables(data.payables || [])
      }
    } catch (error) {
      console.error('Error fetching payables:', error)
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

  const handleAddNewBank = async () => {
    if (newBankName.trim()) {
      try {
        // Save bank to backend if API exists, otherwise just add to local state
        const response = await fetch('/api/bank-options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bankName: newBankName.trim(),
            accountNumber: newBankAccountNumber.trim() || null
          }),
        })

        if (response.ok) {
          const data = await response.json()
          toast.success('Bank added successfully')
        }
      } catch (error) {
        console.log('Bank options API not available, adding to local state only')
      }

      if (!bankOptions.includes(newBankName.trim())) {
        setBankOptions([...bankOptions, newBankName.trim()])
      }
      setBankName(newBankName.trim())
      if (newBankAccountNumber.trim()) {
        setBankAccountNumber(newBankAccountNumber.trim())
      }
      setNewBankName('')
      setNewBankAccountNumber('')
      setShowAddBankDialog(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedAPId) {
      toast.error('Please select an invoice to pay')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }

    const ap = payables.find(p => p.id.toString() === selectedAPId)
    if (ap && parseFloat(amount) > ap.balanceAmount) {
      toast.error(`Payment amount cannot exceed balance of ${formatCurrency(ap.balanceAmount)}`)
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
        accountsPayableId: parseInt(selectedAPId),
        supplierId: parseInt(selectedSupplierId), // Add supplierId to payload
        paymentMethod,
        amount: parseFloat(amount),
        paymentDate,
        referenceNumber,
        notes,
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

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Payment recorded successfully')
        router.push('/dashboard/accounts-payable')
      } else {
        toast.error(data.error || 'Failed to record payment')
      }
    } catch (error) {
      console.error('Error recording payment:', error)
      toast.error('Failed to record payment')
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

  const selectedAP = payables.find(p => p.id.toString() === selectedAPId)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/accounts-payable">
          <UiButton variant="outline" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </UiButton>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Record Payment</h1>
          <p className="text-muted-foreground mt-1">Make a payment to supplier</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Supplier <span className="text-destructive">*</span>
                </label>
                {apIdFromUrl && selectedAPId ? (
                  <div>
                    <div className="w-full px-4 py-2 border border-input bg-muted text-foreground rounded-lg">
                      {(() => {
                        // Try to get supplier from the selected payable first
                        const selectedPayable = payables.find(p => p.id.toString() === selectedAPId)
                        if (selectedPayable) {
                          return selectedPayable.supplier.name
                        }
                        // Fallback to suppliers list
                        const supplier = suppliers.find(s => s.id.toString() === selectedSupplierId)
                        return supplier ? supplier.name : 'Loading...'
                      })()}
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-500 mt-1 flex items-center gap-1">
                      ✓ Auto-selected from invoice
                    </p>
                  </div>
                ) : (
                  <Popover open={supplierSearchOpen} onOpenChange={setSupplierSearchOpen}>
                    <PopoverTrigger asChild>
                      <UiButton
                        variant="outline"
                        role="combobox"
                        aria-expanded={supplierSearchOpen}
                        className="w-full justify-between bg-background hover:bg-background"
                      >
                        {selectedSupplierId
                          ? suppliers.find((supplier) => supplier.id.toString() === selectedSupplierId)?.name
                          : "Select supplier"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </UiButton>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 bg-popover border border-border shadow-lg" align="start">
                      <Command className="bg-popover">
                        <CommandInput placeholder="Search supplier..." className="bg-background" />
                        <CommandList className="bg-popover">
                          <CommandEmpty>No supplier found.</CommandEmpty>
                          <CommandGroup>
                            {suppliers.map((supplier) => (
                              <CommandItem
                                key={supplier.id}
                                value={supplier.name}
                                onSelect={() => {
                                  setSelectedSupplierId(supplier.id.toString())
                                  setSelectedAPId('') // Reset invoice selection when supplier changes
                                  setSupplierSearchOpen(false)
                                }}
                                className="cursor-pointer"
                              >
                                <CheckIcon
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedSupplierId === supplier.id.toString() ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {supplier.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Invoice <span className="text-destructive">*</span>
                </label>
                <Select value={selectedAPId} onValueChange={setSelectedAPId} disabled={!selectedSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPayables.map(ap => (
                      <SelectItem key={ap.id} value={ap.id.toString()}>
                        {ap.invoiceNumber} - Balance: {formatCurrency(ap.balanceAmount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedAP && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Invoice Amount</p>
                    <p className="font-semibold text-foreground">{formatCurrency(selectedAP.amount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Paid Amount</p>
                    <p className="font-semibold text-green-600 dark:text-green-500">{formatCurrency(selectedAP.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Balance Due</p>
                    <p className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(selectedAP.balanceAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Due Date</p>
                    <p className="font-semibold text-foreground">
                      {new Date(selectedAP.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  Payment Amount <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                  placeholder="0.00"
                  required
                />
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
                        text=""
                        type="success"
                        icon="add"
                        onClick={() => setShowAddBankDialog(true)}
                        hint="Add new bank"
                        stylingMode="contained"
                      />
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
                        text=""
                        type="success"
                        icon="add"
                        onClick={() => setShowAddBankDialog(true)}
                        hint="Add new bank"
                        stylingMode="contained"
                      />
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last 4 Digits
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={cardLast4}
                      onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="1234"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transaction ID
                    </label>
                    <input
                      type="text"
                      value={cardTransactionId}
                      onChange={(e) => setCardTransactionId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              text="Cancel"
              type="normal"
              icon="close"
              stylingMode="outlined"
            />
          </Link>
          <Button
            text={loading ? 'Recording Payment...' : 'Record Payment'}
            type="default"
            icon="save"
            disabled={loading}
            onClick={(e) => {
              // Create a synthetic event for form submission
              const formEvent = { preventDefault: () => {} } as React.FormEvent
              handleSubmit(formEvent)
            }}
            stylingMode="contained"
          />
        </div>
      </form>

      {/* Quick Add Bank Dialog */}
      <Dialog open={showAddBankDialog} onOpenChange={setShowAddBankDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Bank</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Bank Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    document.getElementById('newBankAccountNumber')?.focus()
                  }
                }}
                className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                placeholder="Enter bank name"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Account Number
              </label>
              <input
                id="newBankAccountNumber"
                type="text"
                value={newBankAccountNumber}
                onChange={(e) => setNewBankAccountNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddNewBank()
                  }
                }}
                className="w-full px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                placeholder="Enter account number (optional)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional: This will be used for bank transfers and tracking
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              text="Cancel"
              type="normal"
              icon="close"
              onClick={() => {
                setShowAddBankDialog(false)
                setNewBankName('')
                setNewBankAccountNumber('')
              }}
              stylingMode="outlined"
            />
            <Button
              text="Add Bank"
              type="success"
              icon="plus"
              onClick={handleAddNewBank}
              stylingMode="contained"
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
