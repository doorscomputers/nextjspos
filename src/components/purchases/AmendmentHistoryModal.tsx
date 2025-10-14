'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

interface Amendment {
  id: number
  amendmentNumber: number
  amendmentDate: string
  status: string
  amendmentReason: string
  description?: string
  notes?: string
  previousData: any
  changedFields: any
  newSubtotal?: number
  newTaxAmount?: number
  newTotalAmount?: number
  requestedBy: number
  requestedAt: string
  approvedBy?: number
  approvedAt?: string
  rejectedBy?: number
  rejectedAt?: string
  rejectionReason?: string
}

interface AmendmentHistoryModalProps {
  open: boolean
  onClose: () => void
  purchaseId: number
  referenceNo: string
}

export default function AmendmentHistoryModal({
  open,
  onClose,
  purchaseId,
  referenceNo,
}: AmendmentHistoryModalProps) {
  const { can } = usePermissions()
  const [amendments, setAmendments] = useState<Amendment[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedAmendment, setSelectedAmendment] = useState<Amendment | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (open) {
      fetchAmendments()
    }
  }, [open, purchaseId])

  const fetchAmendments = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/amendments`)
      if (!res.ok) throw new Error('Failed to fetch amendments')

      const data = await res.json()
      setAmendments(data.data || [])
    } catch (error: any) {
      console.error('Error fetching amendments:', error)
      toast.error('Failed to load amendment history')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</Badge>
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Approved</Badge>
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Rejected</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      'price_change': 'Price Change',
      'quantity_change': 'Quantity Change',
      'delivery_date_change': 'Delivery Date Change',
      'payment_terms_change': 'Payment Terms Change',
      'shipping_change': 'Shipping Change',
      'supplier_request': 'Supplier Request',
      'item_addition': 'Item Addition',
      'item_removal': 'Item Removal',
      'discount_adjustment': 'Discount Adjustment',
      'tax_adjustment': 'Tax Adjustment',
      'other': 'Other',
    }
    return labels[reason] || reason
  }

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const viewDetails = (amendment: Amendment) => {
    setSelectedAmendment(amendment)
    setShowDetails(true)
  }

  return (
    <>
      <Dialog open={open && !showDetails} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <DocumentTextIcon className="w-6 h-6" />
              Amendment History - PO {referenceNo}
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-300">
              View all amendments made to this purchase order
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading amendments...</div>
            ) : amendments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No amendments found for this purchase order
              </div>
            ) : (
              <div className="space-y-3">
                {amendments.map((amendment) => (
                  <div
                    key={amendment.id}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-700 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            Amendment #{amendment.amendmentNumber}
                          </h3>
                          {getStatusBadge(amendment.status)}
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Date</p>
                            <p className="text-gray-900 dark:text-white">{formatDate(amendment.amendmentDate)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Reason</p>
                            <p className="text-gray-900 dark:text-white">{getReasonLabel(amendment.amendmentReason)}</p>
                          </div>
                          {amendment.newTotalAmount !== null && (
                            <>
                              <div>
                                <p className="text-gray-600 dark:text-gray-400">Old Total</p>
                                <p className="text-gray-900 dark:text-white">
                                  {formatCurrency(amendment.previousData?.totalAmount)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600 dark:text-gray-400">New Total</p>
                                <p className="text-green-600 dark:text-green-400 font-semibold">
                                  {formatCurrency(amendment.newTotalAmount)}
                                </p>
                              </div>
                            </>
                          )}
                        </div>

                        {amendment.description && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                            {amendment.description}
                          </p>
                        )}

                        {amendment.status === 'rejected' && amendment.rejectionReason && (
                          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded p-2 mt-2">
                            <p className="text-sm text-red-800 dark:text-red-200">
                              <strong>Rejection Reason:</strong> {amendment.rejectionReason}
                            </p>
                          </div>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewDetails(amendment)}
                        className="ml-4"
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Amendment Details Modal */}
      {selectedAmendment && (
        <Dialog open={showDetails} onOpenChange={() => setShowDetails(false)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                Amendment #{selectedAmendment.amendmentNumber} Details
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-300">
                Complete details and changes for this amendment
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Status */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Status</h4>
                {getStatusBadge(selectedAmendment.status)}
              </div>

              {/* Basic Info */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Amendment Date</p>
                    <p className="text-gray-900 dark:text-white">{formatDate(selectedAmendment.amendmentDate)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Reason</p>
                    <p className="text-gray-900 dark:text-white">{getReasonLabel(selectedAmendment.amendmentReason)}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedAmendment.description && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selectedAmendment.description}</p>
                </div>
              )}

              {/* Changed Fields */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Changes Made</h4>
                <div className="space-y-3">
                  {Object.entries(selectedAmendment.changedFields as any).map(([field, newValue]) => (
                    <div key={field} className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                          {field.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Old: {JSON.stringify(selectedAmendment.previousData?.[field])}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
                          New: {JSON.stringify(newValue)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Impact */}
              {selectedAmendment.newTotalAmount !== null && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Financial Impact</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Subtotal</p>
                      <p className="text-gray-900 dark:text-white">{formatCurrency(selectedAmendment.newSubtotal)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Tax</p>
                      <p className="text-gray-900 dark:text-white">{formatCurrency(selectedAmendment.newTaxAmount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Total</p>
                      <p className="text-green-600 dark:text-green-400 font-semibold">
                        {formatCurrency(selectedAmendment.newTotalAmount)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedAmendment.notes && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Notes</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selectedAmendment.notes}</p>
                </div>
              )}

              {/* Rejection Info */}
              {selectedAmendment.status === 'rejected' && selectedAmendment.rejectionReason && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded p-4">
                  <h4 className="font-semibold text-red-900 dark:text-red-200 mb-2">Rejection Information</h4>
                  <p className="text-sm text-red-800 dark:text-red-200">{selectedAmendment.rejectionReason}</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Rejected on {formatDate(selectedAmendment.rejectedAt!)}
                  </p>
                </div>
              )}

              {/* Approval Info */}
              {selectedAmendment.status === 'approved' && (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded p-4">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Approved on {formatDate(selectedAmendment.approvedAt!)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowDetails(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
