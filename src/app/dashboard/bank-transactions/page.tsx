"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/currencyUtils'
import { useRouter } from 'next/navigation'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BanknotesIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'

interface BankTransaction {
  id: number
  transactionDate: string
  transactionType: string
  amount: string
  bankName: string
  accountNumber: string | null
  transactionNumber: string | null
  description: string | null
  runningBalance: number
  payment?: {
    id: number
    paymentNumber: string
    supplier: {
      id: number
      name: string
    }
    accountsPayable?: {
      id: number
      invoiceNumber: string
    }
  }
}

interface Bank {
  id: number
  bankName: string
  accountNumber: string
  currentBalance: string
  isActive: boolean
}

export default function BankTransactionsPage() {
  const { can } = usePermissions()
  const router = useRouter()
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [bankNameFilter, setBankNameFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    if (can(PERMISSIONS.BANK_TRANSACTION_VIEW)) {
      fetchTransactions()
      fetchBanks()
    }
  }, [])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (bankNameFilter) params.append('bankName', bankNameFilter)
      if (typeFilter) params.append('transactionType', typeFilter)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/bank-transactions?${params}`)
      const data = await response.json()

      if (response.ok) {
        setTransactions(data.transactions || [])
      } else {
        toast.error(data.error || 'Failed to fetch bank transactions')
      }
    } catch (error) {
      console.error('Error fetching bank transactions:', error)
      toast.error('Failed to fetch bank transactions')
    } finally {
      setLoading(false)
    }
  }

  const fetchBanks = async () => {
    try {
      const response = await fetch('/api/banks')
      if (response.ok) {
        const data = await response.json()
        setBanks(data.filter((bank: Bank) => bank.isActive))
      }
    } catch (error) {
      console.error('Error fetching banks:', error)
    }
  }

  const handleApplyFilters = () => {
    fetchTransactions()
  }

  const handleClearFilters = () => {
    setBankNameFilter('')
    setTypeFilter('')
    setStartDate('')
    setEndDate('')
    fetchTransactions()
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'payment':
        return <ArrowDownIcon className="w-5 h-5 text-red-500" />
      case 'receipt':
        return <ArrowUpIcon className="w-5 h-5 text-green-500" />
      default:
        return <BanknotesIcon className="w-5 h-5 text-gray-500" />
    }
  }

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'payment':
        return <Badge variant="destructive">Payment</Badge>
      case 'receipt':
        return <Badge className="bg-green-500 hover:bg-green-600">Receipt</Badge>
      case 'transfer':
        return <Badge variant="secondary">Transfer</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  if (!can(PERMISSIONS.BANK_TRANSACTION_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          You do not have permission to view bank transactions.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">Loading bank transactions...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Bank Transactions</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Monitor all bank account activity with running balance</p>
        </div>
        {can(PERMISSIONS.BANK_TRANSACTION_CREATE) && (
          <Button onClick={() => router.push('/dashboard/bank-transactions/manual')}>
            <PlusIcon className="w-5 h-5 mr-2" />
            Add Manual Transaction
          </Button>
        )}
      </div>

      {/* Bank Account Balances */}
      {banks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {banks.map((bank) => (
            <Card key={bank.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {bank.bankName}
                </CardTitle>
                <CardDescription className="text-xs">
                  {bank.accountNumber}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(bank.currentBalance)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                placeholder="Search bank name..."
                value={bankNameFilter}
                onChange={(e) => setBankNameFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Transaction Type</Label>
              <Select value={typeFilter || "all"} onValueChange={(value) => setTypeFilter(value === "all" ? "" : value)}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleApplyFilters}>
              <MagnifyingGlassIcon className="w-4 h-4 mr-2" />
              Apply Filters
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Ledger */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No bank transactions found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Type</th>
                    <th className="text-left py-3 px-4">Description</th>
                    <th className="text-left py-3 px-4">Bank</th>
                    <th className="text-right py-3 px-4">Debit</th>
                    <th className="text-right py-3 px-4">Credit</th>
                    <th className="text-right py-3 px-4">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const amount = parseFloat(tx.amount.toString())
                    const isDebit = amount < 0

                    return (
                      <tr key={tx.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-3 px-4">
                          {format(new Date(tx.transactionDate), 'MMM dd, yyyy')}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getTransactionIcon(tx.transactionType)}
                            {getTransactionBadge(tx.transactionType)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm">{tx.description}</p>
                            {tx.payment && (
                              <p className="text-xs text-gray-500">
                                {tx.payment.paymentNumber} - {tx.payment.supplier.name}
                                {tx.payment.accountsPayable && ` (${tx.payment.accountsPayable.invoiceNumber})`}
                              </p>
                            )}
                            {tx.transactionNumber && (
                              <p className="text-xs text-gray-500">Ref: {tx.transactionNumber}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {tx.bankName}
                        </td>
                        <td className="py-3 px-4 text-right text-red-600 font-medium">
                          {isDebit ? formatCurrency(Math.abs(amount)) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-green-600 font-medium">
                          {!isDebit ? formatCurrency(Math.abs(amount)) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold">
                          {formatCurrency(tx.runningBalance)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
