'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeftIcon, EyeIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface PurchaseReturn {
  id: number
  returnNumber: string
  returnDate: string
  status: string
  returnReason: string
  expectedAction: string
  totalAmount: number
  supplier: {
    id: number
    name: string
  }
  purchaseReceipt: {
    id: number
    receiptNumber: string
    purchase?: {
      purchaseOrderNumber: string
    }
  }
  items: any[]
  createdAt: string
}

export default function PurchaseReturnsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [returns, setReturns] = useState<PurchaseReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchReturns()
  }, [statusFilter])

  const fetchReturns = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const res = await fetch(`/api/purchases/returns?${params.toString()}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch returns')
      }

      const data = await res.json()
      setReturns(data.returns || [])
    } catch (error: any) {
      console.error('Error fetching returns:', error)
      toast.error(error.message || 'Failed to fetch purchase returns')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getReasonLabel = (reason: string) => {
    const reasons: Record<string, string> = {
      damaged: 'Damaged',
      wrong_item: 'Wrong Item',
      quality_issue: 'Quality Issue',
      overcharge: 'Overcharge',
      expired: 'Expired',
      defective: 'Defective',
      not_as_ordered: 'Not as Ordered',
    }
    return reasons[reason] || reason
  }

  const getActionLabel = (action: string) => {
    const actions: Record<string, string> = {
      refund: 'Refund',
      replacement: 'Replacement',
      credit_note: 'Credit Note',
    }
    return actions[action] || action
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/dashboard/purchases/receipts">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to GRN
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Purchase Returns
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-300">
          Manage returns to suppliers for damaged, defective, or incorrect items
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectItem
                    value="all"
                    className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    All Statuses
                  </SelectItem>
                  <SelectItem
                    value="pending"
                    className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Pending
                  </SelectItem>
                  <SelectItem
                    value="approved"
                    className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Approved
                  </SelectItem>
                  <SelectItem
                    value="completed"
                    className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Completed
                  </SelectItem>
                  <SelectItem
                    value="rejected"
                    className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Rejected
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchReturns} disabled={loading}>
              <ArrowPathIcon className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Returns Table */}
      <Card className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-gray-900 dark:text-white">
                Purchase Returns ({returns.length})
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                View and manage all purchase returns
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-gray-600 dark:text-gray-300">
              Loading returns...
            </div>
          ) : returns.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                No purchase returns found
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Create returns from approved GRN receipts
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-300 dark:border-gray-600">
                    <TableHead className="text-gray-900 dark:text-white">Return #</TableHead>
                    <TableHead className="text-gray-900 dark:text-white">Date</TableHead>
                    <TableHead className="text-gray-900 dark:text-white">GRN #</TableHead>
                    <TableHead className="text-gray-900 dark:text-white">Supplier</TableHead>
                    <TableHead className="text-gray-900 dark:text-white">Reason</TableHead>
                    <TableHead className="text-gray-900 dark:text-white">Expected Action</TableHead>
                    <TableHead className="text-gray-900 dark:text-white">Items</TableHead>
                    <TableHead className="text-gray-900 dark:text-white text-right">Amount</TableHead>
                    <TableHead className="text-gray-900 dark:text-white">Status</TableHead>
                    <TableHead className="text-gray-900 dark:text-white">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((ret) => (
                    <TableRow
                      key={ret.id}
                      className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <TableCell className="font-medium text-gray-900 dark:text-white">
                        {ret.returnNumber}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {new Date(ret.returnDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {ret.purchaseReceipt.receiptNumber}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {ret.supplier.name}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {getReasonLabel(ret.returnReason)}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {getActionLabel(ret.expectedAction)}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">
                        {ret.items.length}
                      </TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-gray-300">
                        ₱{ret.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(ret.status)}>
                          {ret.status.charAt(0).toUpperCase() + ret.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Link href={`/dashboard/purchases/returns/${ret.id}`}>
                            <Button variant="outline" size="sm">
                              <EyeIcon className="w-4 h-4 mr-2" />
                              View
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
