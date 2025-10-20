'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'

interface PurchaseReturn {
  id: number
  returnNumber: string
  returnDate: string
  status: string
  returnReason: string
  expectedAction: string
  subtotal: number
  taxAmount: number
  discountAmount: number
  totalAmount: number
  notes: string
  supplier: {
    id: number
    name: string
    contactPerson?: string
    email?: string
    mobile?: string
  }
  purchaseReceipt: {
    id: number
    receiptNumber: string
    receiptDate: string
    purchase?: {
      id: number
      purchaseOrderNumber: string
    }
  }
  items: Array<{
    id: number
    productId: number
    productVariationId: number
    quantityReturned: number
    unitCost: number
    condition: string
    notes?: string
    serialNumbers?: any
    product: {
      id: number
      name: string
    }
    productVariation: {
      id: number
      name: string
    }
    purchaseReceiptItem: {
      id: number
      productId: number
      productVariationId: number
      quantityReceived: number
    }
  }>
  debitNotes: Array<{
    id: number
    debitNoteNumber: string
    debitNoteDate: string
    amount: number
    status: string
  }>
  createdAt: string
  approvedBy?: number
  approvedAt?: string
}

export default function ReturnDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const returnId = params.id as string

  const [purchaseReturn, setPurchaseReturn] = useState<PurchaseReturn | null>(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)

  useEffect(() => {
    fetchReturn()
  }, [returnId])

  const fetchReturn = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/purchases/returns/${returnId}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch return')
      }

      const data = await res.json()
      setPurchaseReturn(data.purchaseReturn)
    } catch (error: any) {
      console.error('Error fetching return:', error)
      toast.error(error.message || 'Failed to fetch purchase return')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!purchaseReturn) return

    setApproving(true)
    try {
      const res = await fetch(`/api/purchases/returns/${returnId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to approve return')
      }

      const data = await res.json()
      toast.success('Purchase return approved successfully')
      setShowApproveModal(false)
      fetchReturn()
    } catch (error: any) {
      console.error('Error approving return:', error)
      toast.error(error.message || 'Failed to approve return')
    } finally {
      setApproving(false)
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

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'good_condition':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'damaged':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'defective':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'expired':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
      case 'wrong_item':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getConditionLabel = (condition: string) => {
    const conditions: Record<string, string> = {
      good_condition: 'Good Condition',
      damaged: 'Damaged',
      defective: 'Defective',
      expired: 'Expired',
      wrong_item: 'Wrong Item',
    }
    return conditions[condition] || condition
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="text-center py-12 text-gray-600 dark:text-gray-300">
          Loading purchase return...
        </div>
      </div>
    )
  }

  if (!purchaseReturn) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-300 mb-4">Purchase return not found</p>
          <Link href="/dashboard/purchases/returns">
            <Button>
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Returns
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/purchases/returns">
              <Button variant="outline" size="sm">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {purchaseReturn.returnNumber}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Purchase Return Details
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={getStatusColor(purchaseReturn.status)}>
              {purchaseReturn.status.charAt(0).toUpperCase() + purchaseReturn.status.slice(1)}
            </Badge>
            {purchaseReturn.status === 'pending' && (
              <Button
                onClick={() => setShowApproveModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircleIcon className="w-4 h-4 mr-2" />
                Approve Return
              </Button>
            )}
          </div>
        </div>

        {/* Status Alert */}
        {purchaseReturn.status === 'pending' && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                  Pending Approval
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  This return is awaiting approval. Once approved, inventory will be reduced and a debit note will be created.
                </p>
              </div>
            </div>
          </div>
        )}

        {purchaseReturn.status === 'approved' && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-green-800 dark:text-green-300 mb-1">
                  Return Approved
                </h3>
                <p className="text-sm text-green-700 dark:text-green-400">
                  This return has been approved. Inventory has been reduced and a debit note has been created.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Return Information */}
          <Card className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Return Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Return Number
                  </label>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {purchaseReturn.returnNumber}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Return Date
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(purchaseReturn.returnDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    GRN Number
                  </label>
                  <Link
                    href={`/dashboard/purchases/receipts/${purchaseReturn.purchaseReceipt.id}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {purchaseReturn.purchaseReceipt.receiptNumber}
                  </Link>
                </div>
                {purchaseReturn.purchaseReceipt.purchase && (
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      PO Number
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {purchaseReturn.purchaseReceipt.purchase.purchaseOrderNumber}
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Return Reason
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {getReasonLabel(purchaseReturn.returnReason)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Expected Action
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {getActionLabel(purchaseReturn.expectedAction)}
                  </p>
                </div>
              </div>
              {purchaseReturn.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Notes
                  </label>
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                    {purchaseReturn.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Return Items */}
          <Card className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Returned Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-300 dark:border-gray-600">
                    <TableHead className="text-gray-900 dark:text-white">Product</TableHead>
                    <TableHead className="text-gray-900 dark:text-white">Condition</TableHead>
                    <TableHead className="text-gray-900 dark:text-white text-right">Qty Returned</TableHead>
                    <TableHead className="text-gray-900 dark:text-white text-right">Unit Cost</TableHead>
                    <TableHead className="text-gray-900 dark:text-white text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseReturn.items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="border-gray-300 dark:border-gray-600"
                    >
                      <TableCell className="text-gray-900 dark:text-white">
                        <div>
                          <p className="font-medium">{item.product.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {item.productVariation.name}
                          </p>
                          {item.notes && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getConditionColor(item.condition)}>
                          {getConditionLabel(item.condition)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-gray-900 dark:text-white">
                        {item.quantityReturned}
                      </TableCell>
                      <TableCell className="text-right text-gray-900 dark:text-white">
                        ₱{item.unitCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-gray-900 dark:text-white font-medium">
                        ₱{(item.quantityReturned * item.unitCost).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Debit Notes */}
          {purchaseReturn.debitNotes && purchaseReturn.debitNotes.length > 0 && (
            <Card className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                  <DocumentTextIcon className="w-5 h-5" />
                  Debit Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-300 dark:border-gray-600">
                      <TableHead className="text-gray-900 dark:text-white">DN Number</TableHead>
                      <TableHead className="text-gray-900 dark:text-white">Date</TableHead>
                      <TableHead className="text-gray-900 dark:text-white text-right">Amount</TableHead>
                      <TableHead className="text-gray-900 dark:text-white">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseReturn.debitNotes.map((dn) => (
                      <TableRow key={dn.id} className="border-gray-300 dark:border-gray-600">
                        <TableCell className="text-gray-900 dark:text-white font-medium">
                          {dn.debitNoteNumber}
                        </TableCell>
                        <TableCell className="text-gray-900 dark:text-white">
                          {new Date(dn.debitNoteDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right text-gray-900 dark:text-white">
                          ₱{dn.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(dn.status)}>
                            {dn.status.charAt(0).toUpperCase() + dn.status.slice(1)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Supplier Information */}
          <Card className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Supplier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Name
                </label>
                <p className="text-gray-900 dark:text-white font-medium">
                  {purchaseReturn.supplier.name}
                </p>
              </div>
              {purchaseReturn.supplier.contactPerson && (
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Contact Person
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {purchaseReturn.supplier.contactPerson}
                  </p>
                </div>
              )}
              {purchaseReturn.supplier.email && (
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Email
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {purchaseReturn.supplier.email}
                  </p>
                </div>
              )}
              {purchaseReturn.supplier.mobile && (
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Mobile
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {purchaseReturn.supplier.mobile}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Amount Summary */}
          <Card className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Amount Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                <span className="text-gray-900 dark:text-white">
                  ₱{purchaseReturn.subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {purchaseReturn.taxAmount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Tax</span>
                  <span className="text-gray-900 dark:text-white">
                    ₱{purchaseReturn.taxAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {purchaseReturn.discountAmount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Discount</span>
                  <span className="text-gray-900 dark:text-white">
                    -₱{purchaseReturn.discountAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-300 dark:border-gray-600 pt-3 flex justify-between items-center">
                <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                <span className="font-bold text-lg text-gray-900 dark:text-white">
                  ₱{purchaseReturn.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approve Modal */}
      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircleIcon className="w-6 h-6" />
              Approve Purchase Return
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-300">
              Confirm approval of {purchaseReturn.returnNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                What will happen:
              </h4>
              <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
                <li>Inventory will be reduced by the returned quantities</li>
                <li>A debit note will be created against the supplier</li>
                <li>Accounts payable balance will be adjusted</li>
                <li>Serial numbers (if any) will be marked as returned</li>
              </ul>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Warning:</strong> This action cannot be undone. Please verify all details before approving.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowApproveModal(false)}
              disabled={approving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircleIcon className="w-4 h-4 mr-2" />
              {approving ? 'Approving...' : 'Confirm Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
