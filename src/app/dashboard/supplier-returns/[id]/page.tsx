"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { ArrowLeftIcon, CheckCircleIcon, ExclamationTriangleIcon, WrenchIcon } from '@heroicons/react/24/outline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Button as DxButton } from 'devextreme-react/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from 'sonner'

interface SupplierReturn {
  id: number
  returnNumber: string
  returnDate: string
  status: string
  returnReason: string
  totalAmount: number
  notes: string | null
  createdAt: string
  supplier: {
    id: number
    name: string
    mobile: string | null
    email: string | null
  }
  location: {
    id: number
    name: string
  }
  items: {
    id: number
    quantity: number
    unitCost: number
    condition: string
    notes: string | null
    serialNumbers: any[] | null
    product: {
      id: number
      name: string
    }
    productVariation: {
      id: number
      name: string
    }
  }[]
}

export default function SupplierReturnDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { can } = usePermissions()
  const [supplierReturn, setSupplierReturn] = useState<SupplierReturn | null>(null)
  const [loading, setLoading] = useState(true)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [processing, setProcessing] = useState(false)

  const returnId = params?.id as string

  useEffect(() => {
    if (returnId) {
      fetchReturn()
    }
  }, [returnId])

  const fetchReturn = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/supplier-returns/${returnId}`)
      const data = await response.json()

      if (response.ok) {
        setSupplierReturn(data)
      } else {
        toast.error(data.error || 'Failed to fetch supplier return')
        router.push('/dashboard/supplier-returns')
      }
    } catch (error) {
      console.error('Error fetching supplier return:', error)
      toast.error('Failed to fetch supplier return')
      router.push('/dashboard/supplier-returns')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    try {
      setProcessing(true)
      const response = await fetch(`/api/supplier-returns/${returnId}/approve`, {
        method: 'POST',
      })
      const data = await response.json()

      if (response.ok) {
        toast.success('Supplier return approved - stock deducted')
        setApproveDialogOpen(false)
        fetchReturn()
      } else {
        toast.error(data.error || 'Failed to approve supplier return')
        if (data.details) {
          toast.error(`Details: ${data.details}`)
        }
      }
    } catch (error) {
      console.error('Error approving supplier return:', error)
      toast.error('Failed to approve supplier return')
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number | string | undefined | null) => {
    const numAmount = Number(amount) || 0
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numAmount).replace('PHP', '₱')
  }

  const getStatusBadge = (status: string) => {
    const config: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string } } = {
      'pending': { variant: 'secondary', label: 'Pending' },
      'approved': { variant: 'default', label: 'Approved' },
    }
    const statusConfig = config[status] || { variant: 'outline', label: status }
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
  }

  const getReasonBadge = (reason: string) => {
    const config: { [key: string]: { variant: "default" | "secondary" | "destructive" | "outline", label: string } } = {
      'warranty': { variant: 'default', label: 'Warranty' },
      'defective': { variant: 'destructive', label: 'Defective' },
      'damaged': { variant: 'secondary', label: 'Damaged' },
    }
    const reasonConfig = config[reason] || { variant: 'outline', label: reason }
    return <Badge variant={reasonConfig.variant}>{reasonConfig.label}</Badge>
  }

  const getConditionBadge = (condition: string) => {
    const config: {
      [key: string]: {
        icon: React.ComponentType<{ className?: string }>
        bgColor: string
        textColor: string
        borderColor: string
        label: string
      }
    } = {
      'damaged': {
        icon: ExclamationTriangleIcon,
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-800',
        borderColor: 'border-orange-200',
        label: 'Damaged',
      },
      'defective': {
        icon: WrenchIcon,
        bgColor: 'bg-red-50',
        textColor: 'text-red-800',
        borderColor: 'border-red-200',
        label: 'Defective',
      },
      'warranty_claim': {
        icon: CheckCircleIcon,
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-200',
        label: 'Warranty Claim',
      },
    }

    const conditionConfig = config[condition] || config['damaged']
    const Icon = conditionConfig.icon

    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${conditionConfig.bgColor} ${conditionConfig.textColor} ${conditionConfig.borderColor}`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{conditionConfig.label}</span>
      </div>
    )
  }

  const getConditionSummary = () => {
    if (!supplierReturn) return { damaged: 0, defective: 0, warranty: 0, total: 0 }

    const damaged = supplierReturn.items.filter(i => i.condition === 'damaged').length
    const defective = supplierReturn.items.filter(i => i.condition === 'defective').length
    const warranty = supplierReturn.items.filter(i => i.condition === 'warranty_claim').length

    return { damaged, defective, warranty, total: supplierReturn.items.length }
  }

  if (!can(PERMISSIONS.PURCHASE_RETURN_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view supplier returns.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500">Loading supplier return...</div>
        </div>
      </div>
    )
  }

  if (!supplierReturn) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500">Supplier return not found</div>
        </div>
      </div>
    )
  }

  const conditionSummary = getConditionSummary()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <DxButton
            text="Back"
            icon="back"
            stylingMode="outlined"
            onClick={() => router.push('/dashboard/supplier-returns')}
          />
          <div>
            <h1 className="text-3xl font-bold">{supplierReturn.returnNumber}</h1>
            <p className="text-gray-500 mt-1">Supplier Return Details</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {supplierReturn.status === 'pending' && can(PERMISSIONS.PURCHASE_RETURN_APPROVE) && (
            <DxButton
              text="Approve Return"
              type="success"
              icon="check"
              stylingMode="contained"
              onClick={() => setApproveDialogOpen(true)}
              hint="Approve this supplier return and deduct stock"
            />
          )}
        </div>
      </div>

      {supplierReturn.status === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900">Stock Deduction Warning</h3>
              <p className="text-yellow-800 text-sm mt-1">
                Approving this return will <strong>REMOVE {supplierReturn.items.reduce((sum, item) => sum + parseFloat(item.quantity.toString()), 0)} units</strong> from stock at {supplierReturn.location.name}.
              </p>
              <p className="text-yellow-800 text-sm mt-1">
                Serial numbers will be marked as 'supplier_return' and removed from circulation.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Return Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Return Number</p>
                <p className="font-medium">{supplierReturn.returnNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Return Date</p>
                <p className="font-medium">{formatDate(supplierReturn.returnDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <div className="mt-1">{getStatusBadge(supplierReturn.status)}</div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Return Reason</p>
                <div className="mt-1">{getReasonBadge(supplierReturn.returnReason)}</div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-medium">{supplierReturn.location.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="font-medium text-lg">{formatCurrency(supplierReturn.totalAmount)}</p>
              </div>
            </div>
            {supplierReturn.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500 mb-1">Notes</p>
                <p className="text-gray-700">{supplierReturn.notes}</p>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Supplier Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Supplier Name</p>
                <p className="font-medium text-lg">{supplierReturn.supplier.name}</p>
              </div>
              {supplierReturn.supplier.mobile && (
                <div>
                  <p className="text-sm text-gray-500">Mobile</p>
                  <p className="font-medium">{supplierReturn.supplier.mobile}</p>
                </div>
              )}
              {supplierReturn.supplier.email && (
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{supplierReturn.supplier.email}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Return Items</h2>
            <div className="space-y-4">
              {supplierReturn.items.map((item) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{item.product.name}</h3>
                      <p className="text-sm text-gray-600">{item.productVariation.name}</p>
                    </div>
                    {getConditionBadge(item.condition)}
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Quantity</p>
                      <p className="font-medium">{parseFloat(item.quantity.toString())}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Unit Cost</p>
                      <p className="font-medium">{formatCurrency(parseFloat(item.unitCost.toString()))}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Subtotal</p>
                      <p className="font-medium">
                        {formatCurrency(parseFloat(item.quantity.toString()) * parseFloat(item.unitCost.toString()))}
                      </p>
                    </div>
                  </div>

                  {item.serialNumbers && item.serialNumbers.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-gray-500 mb-2">Serial Numbers:</p>
                      <div className="flex flex-wrap gap-2">
                        {item.serialNumbers.map((sn: any, index: number) => (
                          <span key={index} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                            {sn.serialNumber || sn.imei}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.notes && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-gray-500">Notes:</p>
                      <p className="text-sm text-gray-700 mt-1">{item.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Items:</span>
                <span className="font-medium">{supplierReturn.items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Quantity:</span>
                <span className="font-medium">
                  {supplierReturn.items.reduce((sum, item) => sum + parseFloat(item.quantity.toString()), 0)}
                </span>
              </div>
              <div className="pt-3 border-t">
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total Amount:</span>
                  <span className="font-bold">{formatCurrency(supplierReturn.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Condition Breakdown</h2>
            <div className="space-y-3">
              {conditionSummary.damaged > 0 && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-orange-600" />
                    <span className="text-gray-700">Damaged</span>
                  </div>
                  <span className="font-medium">{conditionSummary.damaged}</span>
                </div>
              )}
              {conditionSummary.defective > 0 && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <WrenchIcon className="w-4 h-4 text-red-600" />
                    <span className="text-gray-700">Defective</span>
                  </div>
                  <span className="font-medium">{conditionSummary.defective}</span>
                </div>
              )}
              {conditionSummary.warranty > 0 && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-gray-700">Warranty Claim</span>
                  </div>
                  <span className="font-medium">{conditionSummary.warranty}</span>
                </div>
              )}
            </div>
          </div>

          {supplierReturn.status === 'approved' && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-green-900">Approved</h3>
                  <p className="text-green-800 text-sm mt-1">
                    This return has been approved and stock has been deducted.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Supplier Return</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this supplier return?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-red-900 mb-2">This action will:</p>
                  <ul className="list-disc list-inside space-y-1 text-red-800">
                    <li>
                      <strong>REMOVE {supplierReturn.items.reduce((sum, item) => sum + parseFloat(item.quantity.toString()), 0)} units</strong> from stock at {supplierReturn.location.name}
                    </li>
                    <li>Mark serial numbers as 'supplier_return'</li>
                    <li>Remove items from inventory circulation</li>
                    <li>Create negative stock transactions</li>
                  </ul>
                  <p className="mt-3 font-medium">This action cannot be easily undone.</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing}
            >
              {processing ? 'Approving...' : 'Approve Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
