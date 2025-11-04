"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeftIcon, CheckIcon, XMarkIcon, ExclamationTriangleIcon, ShieldCheckIcon, WrenchIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface CustomerReturn {
  id: number
  returnNumber: string
  returnDate: string
  status: string
  totalRefundAmount: number
  notes: string | null
  createdAt: string
  approvedAt: string | null
  approvedBy: number | null
  replacementIssued: boolean
  replacementIssuedAt: string | null
  replacementIssuedBy: number | null
  replacementSaleId: number | null
  customer: {
    id: number
    name: string
    mobile: string | null
    email: string | null
  } | null
  sale: {
    id: number
    invoiceNumber: string
    saleDate: string
    totalAmount: number
  }
  items: ReturnItem[]
}

interface ReturnItem {
  id: number
  productId: number
  productVariationId: number
  quantity: number
  unitPrice: number
  condition: string
  returnType: string
  serialNumbers: any
  notes: string | null
}

export default function CustomerReturnDetailPage() {
  const { can } = usePermissions()
  const params = useParams()
  const router = useRouter()
  const returnId = params.id as string

  const [customerReturn, setCustomerReturn] = useState<CustomerReturn | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // For rejection
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  // For replacement issuance
  const [showReplacementDialog, setShowReplacementDialog] = useState(false)

  useEffect(() => {
    fetchCustomerReturn()
  }, [returnId])

  const fetchCustomerReturn = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/customer-returns/${returnId}`)
      const data = await response.json()

      if (response.ok) {
        setCustomerReturn(data)
      } else {
        toast.error(data.error || 'Failed to fetch customer return')
      }
    } catch (error) {
      console.error('Error fetching customer return:', error)
      toast.error('Failed to fetch customer return')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!confirm('Approve this return? Stock will be restored for resellable items.')) {
      return
    }

    try {
      setActionLoading(true)
      const response = await fetch(`/api/customer-returns/${returnId}/approve`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Customer return approved - stock restored for resellable items')
        fetchCustomerReturn()
      } else {
        toast.error(data.error || 'Failed to approve return')
      }
    } catch (error) {
      console.error('Error approving return:', error)
      toast.error('Failed to approve return')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!confirm('Reject this return? This action cannot be undone.')) {
      return
    }

    try {
      setActionLoading(true)
      const response = await fetch(`/api/customer-returns/${returnId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Customer return rejected')
        setShowRejectDialog(false)
        fetchCustomerReturn()
      } else {
        toast.error(data.error || 'Failed to reject return')
      }
    } catch (error) {
      console.error('Error rejecting return:', error)
      toast.error('Failed to reject return')
    } finally {
      setActionLoading(false)
    }
  }

  const handleIssueReplacement = async () => {
    if (!customerReturn) return

    // Get replacement items from the return
    const replacementItems = customerReturn.items
      .filter(item => item.returnType === 'replacement')
      .map(item => ({
        productId: item.productId,
        productVariationId: item.productVariationId,
        quantity: item.quantity,
        unitCost: item.unitPrice, // Use the original price as cost
      }))

    if (replacementItems.length === 0) {
      toast.error('No items marked for replacement')
      return
    }

    // Show confirmation
    const itemList = replacementItems
      .map((item, index) => `\n${index + 1}. Product ${item.productId} (Qty: ${item.quantity})`)
      .join('')

    const confirmed = confirm(
      `Issue replacement for the following items?${itemList}\n\nThis will deduct inventory from the return location.`
    )

    if (!confirmed) return

    // Process replacement
    await processReplacementIssuance(replacementItems)
  }

  const processReplacementIssuance = async (replacementItems: any[]) => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/customer-returns/${returnId}/issue-replacement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ replacementItems }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Replacement issued successfully - Invoice: ${data.replacementSale.invoiceNumber}`)
        setShowReplacementDialog(false)
        fetchCustomerReturn()
      } else {
        toast.error(data.error || 'Failed to issue replacement')
      }
    } catch (error) {
      console.error('Error issuing replacement:', error)
      toast.error('Failed to issue replacement')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`
  }

  const getStatusBadge = (status: string) => {
    const config: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string } } = {
      'pending': { variant: 'secondary', label: 'Pending Approval' },
      'approved': { variant: 'default', label: 'Approved' },
      'rejected': { variant: 'destructive', label: 'Rejected' },
    }
    const statusConfig = config[status] || { variant: 'outline', label: status }
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
  }

  const getConditionBadge = (condition: string) => {
    const config: { [key: string]: { icon: any, bgColor: string, textColor: string, label: string } } = {
      'resellable': {
        icon: ShieldCheckIcon,
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        label: 'Resellable'
      },
      'damaged': {
        icon: ExclamationTriangleIcon,
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        label: 'Damaged'
      },
      'defective': {
        icon: WrenchIcon,
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        label: 'Defective'
      },
    }
    const conditionConfig = config[condition] || config.resellable
    const Icon = conditionConfig.icon

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${conditionConfig.bgColor} ${conditionConfig.textColor}`}>
        <Icon className="w-3 h-3 mr-1" />
        {conditionConfig.label}
      </span>
    )
  }

  const getReturnTypeBadge = (returnType: string) => {
    return (
      <Badge variant={returnType === 'refund' ? 'default' : 'secondary'}>
        {returnType === 'refund' ? 'Refund' : 'Replacement'}
      </Badge>
    )
  }

  const getAvailableActions = () => {
    if (!customerReturn) return []

    const actions = []

    // Only pending returns can be approved or rejected
    if (customerReturn.status === 'pending') {
      if (can(PERMISSIONS.CUSTOMER_RETURN_APPROVE)) {
        actions.push({
          label: 'Approve Return',
          icon: CheckIcon,
          onClick: handleApprove,
          variant: 'default' as const
        })
      }
      if (can(PERMISSIONS.CUSTOMER_RETURN_DELETE)) {
        actions.push({
          label: 'Reject Return',
          icon: XMarkIcon,
          onClick: handleReject,
          variant: 'destructive' as const
        })
      }
    }

    // Approved returns with replacement items can issue replacements
    if (customerReturn.status === 'approved' && !customerReturn.replacementIssued) {
      const hasReplacementItems = customerReturn.items.some(item => item.returnType === 'replacement')

      if (hasReplacementItems && can(PERMISSIONS.CUSTOMER_RETURN_APPROVE)) {
        actions.push({
          label: 'Issue Replacement',
          icon: ArrowPathIcon,
          onClick: handleIssueReplacement,
          variant: 'default' as const
        })
      }
    }

    return actions
  }

  if (!can(PERMISSIONS.CUSTOMER_RETURN_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view customer returns.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="text-gray-500">Loading return details...</div>
      </div>
    )
  }

  if (!customerReturn) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Customer return not found
        </div>
      </div>
    )
  }

  const availableActions = getAvailableActions()

  // Calculate condition summary
  const conditionSummary = {
    resellable: customerReturn.items.filter(i => i.condition === 'resellable').length,
    damaged: customerReturn.items.filter(i => i.condition === 'damaged').length,
    defective: customerReturn.items.filter(i => i.condition === 'defective').length,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/customer-returns">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{customerReturn.returnNumber}</h1>
            <p className="text-gray-500 mt-1">Customer Return Details</p>
          </div>
        </div>
        <div>
          {getStatusBadge(customerReturn.status)}
        </div>
      </div>

      {/* Action Buttons */}
      {availableActions.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex flex-wrap gap-2">
            {availableActions.map((action, index) => {
              const Icon = action.icon
              return (
                <Button
                  key={index}
                  variant={action.variant}
                  onClick={action.onClick}
                  disabled={actionLoading}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {action.label}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {/* Stock Restoration Alert */}
      {customerReturn.status === 'pending' && conditionSummary.resellable > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <div className="flex items-start">
            <ShieldCheckIcon className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
            <div>
              <h3 className="font-semibold text-blue-900">Stock Restoration</h3>
              <p className="text-sm text-blue-800 mt-1">
                Approving this return will restore stock for <strong>{conditionSummary.resellable} resellable item(s)</strong>.
                {conditionSummary.damaged > 0 && ` ${conditionSummary.damaged} damaged item(s) will not be restored.`}
                {conditionSummary.defective > 0 && ` ${conditionSummary.defective} defective item(s) will not be restored.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {customerReturn.status === 'approved' && !customerReturn.replacementIssued && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <div className="flex items-start">
            <CheckIcon className="w-5 h-5 text-green-600 mt-0.5 mr-3" />
            <div>
              <h3 className="font-semibold text-green-900">Return Approved</h3>
              <p className="text-sm text-green-800 mt-1">
                This return was approved on {customerReturn.approvedAt ? formatDate(customerReturn.approvedAt) : 'N/A'}.
                {conditionSummary.resellable > 0 && ` Stock was restored for ${conditionSummary.resellable} resellable item(s).`}
              </p>
            </div>
          </div>
        </div>
      )}

      {customerReturn.replacementIssued && (
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
          <div className="flex items-start">
            <ArrowPathIcon className="w-5 h-5 text-purple-600 mt-0.5 mr-3" />
            <div>
              <h3 className="font-semibold text-purple-900">Replacement Issued</h3>
              <p className="text-sm text-purple-800 mt-1">
                Replacement items were issued on {customerReturn.replacementIssuedAt ? formatDate(customerReturn.replacementIssuedAt) : 'N/A'}.
                {customerReturn.replacementSaleId && ` Sale ID: ${customerReturn.replacementSaleId}`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Return Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Return Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Return Date</label>
                <div className="font-medium">{formatDate(customerReturn.returnDate)}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Created At</label>
                <div className="font-medium">{new Date(customerReturn.createdAt).toLocaleString()}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Original Sale</label>
                <Link
                  href={`/dashboard/sales/${customerReturn.sale.id}`}
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  {customerReturn.sale.invoiceNumber}
                </Link>
                <div className="text-sm text-gray-500">
                  {formatDate(customerReturn.sale.saleDate)} - {formatCurrency(customerReturn.sale.totalAmount)}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Total Refund Amount</label>
                <div className="font-semibold text-lg text-gray-900">
                  {formatCurrency(customerReturn.totalRefundAmount)}
                </div>
              </div>
            </div>
            {customerReturn.notes && (
              <div>
                <label className="text-sm text-gray-500">Notes</label>
                <div className="font-medium">{customerReturn.notes}</div>
              </div>
            )}
          </div>

          {/* Customer Info */}
          {customerReturn.customer && (
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold">Customer Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Name</label>
                  <div className="font-medium">{customerReturn.customer.name}</div>
                </div>
                {customerReturn.customer.mobile && (
                  <div>
                    <label className="text-sm text-gray-500">Mobile</label>
                    <div className="font-medium">{customerReturn.customer.mobile}</div>
                  </div>
                )}
                {customerReturn.customer.email && (
                  <div>
                    <label className="text-sm text-gray-500">Email</label>
                    <div className="font-medium">{customerReturn.customer.email}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Return Items ({customerReturn.items.length})</h2>
            <div className="space-y-3">
              {customerReturn.items.map((item) => (
                <div key={item.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium">Product #{item.productId}</div>
                      <div className="text-sm text-gray-500">Variation #{item.productVariationId}</div>
                    </div>
                    <div className="flex gap-2">
                      {getConditionBadge(item.condition)}
                      {getReturnTypeBadge(item.returnType)}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                    <div>
                      <span className="text-gray-500">Quantity:</span>
                      <span className="ml-2 font-medium">{item.quantity}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Unit Price:</span>
                      <span className="ml-2 font-medium">{formatCurrency(item.unitPrice)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total:</span>
                      <span className="ml-2 font-semibold">{formatCurrency(item.quantity * item.unitPrice)}</span>
                    </div>
                  </div>

                  {/* Condition Explanation */}
                  <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    {item.condition === 'resellable' && (
                      <span>✓ Stock will be restored - item available for resale</span>
                    )}
                    {item.condition === 'damaged' && (
                      <span>⚠ Stock will not be restored - item marked as damaged</span>
                    )}
                    {item.condition === 'defective' && (
                      <span>⚠ Stock will not be restored - item marked as defective (warranty)</span>
                    )}
                  </div>

                  {item.notes && (
                    <div className="mt-2 text-sm">
                      <span className="text-gray-500">Notes:</span>
                      <span className="ml-2">{item.notes}</span>
                    </div>
                  )}

                  {/* Serial Numbers */}
                  {item.serialNumbers && Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0 && (
                    <div className="mt-2 text-sm">
                      <span className="text-gray-500">Serial Numbers:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.serialNumbers.map((sn: any, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                            {sn.serialNumber || sn.imei || `SN-${sn.id}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Items:</span>
                <span className="font-medium">{customerReturn.items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Resellable:</span>
                <span className="font-medium text-green-600">{conditionSummary.resellable}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Damaged:</span>
                <span className="font-medium text-orange-600">{conditionSummary.damaged}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Defective:</span>
                <span className="font-medium text-red-600">{conditionSummary.defective}</span>
              </div>
              <div className="pt-3 border-t">
                <div className="flex justify-between">
                  <span className="text-gray-900 font-semibold">Refund Amount:</span>
                  <span className="font-semibold text-lg">{formatCurrency(customerReturn.totalRefundAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Return Status</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <div className={customerReturn.status === 'pending' ? 'font-bold text-blue-600' : ''}>
                • Pending Approval
              </div>
              <div className={customerReturn.status === 'approved' ? 'font-bold text-green-600' : ''}>
                • Approved (Stock Restored)
              </div>
              <div className={customerReturn.status === 'rejected' ? 'font-bold text-red-600' : ''}>
                • Rejected
              </div>
            </div>
          </div>

          {/* Condition Legend */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Condition Guide</h3>
            <div className="space-y-2 text-xs text-blue-800">
              <div>
                <span className="font-semibold">Resellable:</span> Stock restored, available for sale
              </div>
              <div>
                <span className="font-semibold">Damaged:</span> No stock restoration, item damaged
              </div>
              <div>
                <span className="font-semibold">Defective:</span> No stock restoration, warranty claim
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
