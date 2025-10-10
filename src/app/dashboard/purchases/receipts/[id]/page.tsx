'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeftIcon, CheckCircleIcon, LockClosedIcon } from '@heroicons/react/24/outline'

interface PurchaseReceiptDetail {
  id: number
  receiptNumber: string
  receiptDate: string
  status: string
  notes: string | null
  purchaseId: number | null
  purchase: {
    id: number
    purchaseOrderNumber: string
    subtotal: string
    taxAmount: string
    discountAmount: string
    shippingCost: string
    totalAmount: string
    supplier: {
      id: number
      name: string
      contactPerson: string | null
      email: string | null
      mobile: string | null
    }
  } | null
  supplier: {
    id: number
    name: string
    contactPerson: string | null
    email: string | null
    mobile: string | null
  }
  location: {
    id: number
    name: string
  }
  receivedBy: number
  receivedAt: string
  approvedBy: number | null
  approvedAt: string | null
  receivedByUser: {
    id: number
    firstName: string
    lastName: string
    surname: string
    username: string
  }
  approvedByUser: {
    id: number
    firstName: string
    lastName: string
    surname: string
    username: string
  } | null
  items: Array<{
    id: number
    quantityReceived: string
    serialNumbers: any
    notes: string | null
    purchaseItem: {
      id: number
      quantity: string
      unitCost: string
      product: {
        id: number
        name: string
      }
      productVariation: {
        id: number
        name: string
        sku: string
        enableSerialNumber: boolean
      }
    } | null
    product: {
      id: number
      name: string
    }
    productVariation: {
      id: number
      name: string
      sku: string
      enableSerialNumber: boolean
    }
    unitCost: string | null
  }>
}

export default function PurchaseReceiptDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [receipt, setReceipt] = useState<PurchaseReceiptDetail | null>(null)
  const [verificationChecked, setVerificationChecked] = useState(false)

  const fetchReceipt = async () => {
    setLoading(true)
    try {
      console.log('Fetching receipt ID:', params.id)
      const res = await fetch(`/api/purchases/receipts/${params.id}`)
      console.log('Response status:', res.status)

      if (!res.ok) {
        const error = await res.json()
        console.error('API Error:', error)
        throw new Error(error.error || 'Failed to fetch receipt')
      }

      const data = await res.json()
      console.log('Receipt data received:', data)
      setReceipt(data)
    } catch (error: any) {
      console.error('Error fetching receipt:', error)
      toast.error(error.message || 'Failed to load receipt')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (can(PERMISSIONS.PURCHASE_RECEIPT_VIEW)) {
      fetchReceipt()
    }
  }, [params.id])

  const handleApprove = async () => {
    if (!receipt) return

    if (!confirm('Are you sure you want to approve this receipt? This will add inventory to stock and cannot be undone.')) {
      return
    }

    setApproving(true)
    try {
      const res = await fetch(`/api/purchases/receipts/${receipt.id}/approve`, {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to approve receipt')
      }

      toast.success('Receipt approved successfully! Inventory has been added.')
      fetchReceipt() // Refresh to show updated status
    } catch (error: any) {
      console.error('Error approving receipt:', error)
      toast.error(error.message || 'Failed to approve receipt')
    } finally {
      setApproving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount)
  }

  const getFullName = (user: { firstName: string; lastName: string; surname: string } | null) => {
    if (!user) return 'N/A'
    return `${user.firstName} ${user.surname} ${user.lastName}`.trim()
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
    }

    return (
      <Badge variant="outline" className={styles[status] || ''}>
        {status.toUpperCase()}
      </Badge>
    )
  }

  if (!can(PERMISSIONS.PURCHASE_RECEIPT_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view purchase receipts.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-8">Loading...</div>
      </div>
    )
  }

  if (!receipt) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Receipt not found
        </div>
      </div>
    )
  }

  const totalQuantity = receipt.items.reduce(
    (sum, item) => sum + parseFloat(item.quantityReceived),
    0
  )

  const totalValue = receipt.items.reduce((sum, item) => {
    const unitCost = item.purchaseItem?.unitCost || item.unitCost || '0'
    return sum + parseFloat(item.quantityReceived) * parseFloat(unitCost.toString())
  }, 0)

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/purchases/receipts">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              Back to Receipts
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{receipt.receiptNumber}</h1>
            <p className="text-gray-600 mt-1">Goods Received Note Details</p>
          </div>
        </div>
        <div>
          {getStatusBadge(receipt.status)}
        </div>
      </div>

      {/* Lock Warning for Approved Receipts */}
      {receipt.status === 'approved' && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-start gap-3">
          <LockClosedIcon className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">This receipt has been approved and finalized</p>
            <p className="text-sm text-blue-700 mt-1">
              Approved receipts cannot be edited to maintain data integrity. Use Inventory Corrections if adjustments are needed.
            </p>
          </div>
        </div>
      )}

      {/* Pending Approval Warning */}
      {receipt.status === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-start gap-3">
          <CheckCircleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-900">Pending Approval</p>
            <p className="text-sm text-yellow-700 mt-1">
              This receipt requires approval before inventory is added to stock. Total quantity: <strong>{totalQuantity} units</strong> worth <strong>{formatCurrency(totalValue)}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Verification Checkbox - Only show if pending and user can approve */}
      {receipt.status === 'pending' && can(PERMISSIONS.PURCHASE_RECEIPT_APPROVE) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Verification Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Please verify the following before approval:</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>All product details (name, SKU, variation) are correct</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Quantities received match the physical count</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Unit costs and total values are accurate</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Supplier information is correct</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>Serial numbers (if applicable) are properly recorded</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>No damaged or defective items are included</span>
                </li>
              </ul>
            </div>

            <div className="flex items-start gap-3 bg-white border-2 border-blue-300 rounded-lg p-4">
              <input
                type="checkbox"
                id="verification"
                checked={verificationChecked}
                onChange={(e) => setVerificationChecked(e.target.checked)}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
              />
              <label htmlFor="verification" className="flex-1 cursor-pointer">
                <p className="font-semibold text-gray-900">I confirm that I have carefully verified all details above</p>
                <p className="text-sm text-gray-600 mt-1">
                  By checking this box, I certify that all information is accurate and complete. This action will update inventory and create accounts payable entries.
                </p>
              </label>
            </div>

            {verificationChecked && (
              <div className="pt-2">
                <Button
                  onClick={handleApprove}
                  disabled={approving}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                  size="lg"
                >
                  <CheckCircleIcon className="w-5 h-5 mr-2" />
                  {approving ? 'Updating Inventory...' : 'Approve & Update Inventory'}
                </Button>
              </div>
            )}

            {!verificationChecked && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-sm text-gray-600">
                  Please check the verification box above to enable the approval button
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Receipt Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Receipt Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-sm text-gray-600">GRN Number:</span>
              <p className="font-medium">{receipt.receiptNumber}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Receipt Date:</span>
              <p className="font-medium">{formatDate(receipt.receiptDate)}</p>
            </div>
            {receipt.purchase ? (
              <div>
                <span className="text-sm text-gray-600">Purchase Order:</span>
                <p className="font-medium">
                  <Link
                    href={`/dashboard/purchases/${receipt.purchase.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {receipt.purchase.purchaseOrderNumber}
                  </Link>
                </p>
              </div>
            ) : (
              <div>
                <span className="text-sm text-gray-600">Purchase Order:</span>
                <p className="font-medium">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                    Direct Entry (No PO)
                  </Badge>
                </p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-600">Location:</span>
              <p className="font-medium">{receipt.location.name}</p>
            </div>
            {receipt.notes && (
              <div>
                <span className="text-sm text-gray-600">Notes:</span>
                <p className="font-medium">{receipt.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-sm text-gray-600">Supplier Name:</span>
              <p className="font-medium">
                {receipt.purchase ? receipt.purchase.supplier.name : receipt.supplier.name}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Contact Person:</span>
              <p className="font-medium">
                {receipt.purchase
                  ? (receipt.purchase.supplier.contactPerson || 'N/A')
                  : (receipt.supplier.contactPerson || 'N/A')
                }
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Email:</span>
              <p className="font-medium">
                {receipt.purchase
                  ? (receipt.purchase.supplier.email || 'N/A')
                  : (receipt.supplier.email || 'N/A')
                }
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Mobile:</span>
              <p className="font-medium">
                {receipt.purchase
                  ? (receipt.purchase.supplier.mobile || 'N/A')
                  : (receipt.supplier.mobile || 'N/A')
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approval Workflow */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-sm text-gray-600 mb-1">Step 1: Received By (Encoder)</p>
              <p className="font-medium text-lg">{getFullName(receipt.receivedByUser)}</p>
              <p className="text-sm text-gray-500">@{receipt.receivedByUser.username}</p>
              <p className="text-xs text-gray-400 mt-1">{formatDate(receipt.receivedAt)}</p>
            </div>

            <div className={`border-l-4 pl-4 ${receipt.approvedByUser ? 'border-green-500' : 'border-gray-300'}`}>
              <p className="text-sm text-gray-600 mb-1">Step 2: Approved By (Approving Officer)</p>
              {receipt.approvedByUser ? (
                <>
                  <p className="font-medium text-lg">{getFullName(receipt.approvedByUser)}</p>
                  <p className="text-sm text-gray-500">@{receipt.approvedByUser.username}</p>
                  <p className="text-xs text-gray-400 mt-1">{receipt.approvedAt && formatDate(receipt.approvedAt)}</p>
                </>
              ) : (
                <p className="text-gray-400 italic">Awaiting approval</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Received Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Product</th>
                  <th className="text-left py-3 px-4">SKU</th>
                  <th className="text-right py-3 px-4">Ordered</th>
                  <th className="text-right py-3 px-4">Received</th>
                  {can(PERMISSIONS.PURCHASE_VIEW_COST) && (
                    <>
                      <th className="text-right py-3 px-4">Unit Cost</th>
                      <th className="text-right py-3 px-4">Total</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item) => {
                  const product = item.purchaseItem?.product || item.product
                  const variation = item.purchaseItem?.productVariation || item.productVariation
                  const orderedQty = item.purchaseItem?.quantity || '-'
                  const unitCost = item.purchaseItem?.unitCost || item.unitCost || '0'

                  return (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-gray-500">{variation.name}</p>
                          {variation.enableSerialNumber && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Serial Number Required
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {variation.sku}
                      </td>
                      <td className="text-right py-3 px-4">
                        {orderedQty}
                      </td>
                      <td className="text-right py-3 px-4 font-medium">
                        {item.quantityReceived}
                      </td>
                      {can(PERMISSIONS.PURCHASE_VIEW_COST) && (
                        <>
                          <td className="text-right py-3 px-4">
                            {formatCurrency(unitCost)}
                          </td>
                          <td className="text-right py-3 px-4 font-medium">
                            {formatCurrency(parseFloat(item.quantityReceived) * parseFloat(unitCost.toString()))}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td colSpan={3} className="py-3 px-4 text-right">
                    TOTAL:
                  </td>
                  <td className="text-right py-3 px-4">
                    {totalQuantity} units
                  </td>
                  {can(PERMISSIONS.PURCHASE_VIEW_COST) && (
                    <>
                      <td className="text-right py-3 px-4"></td>
                      <td className="text-right py-3 px-4">
                        {formatCurrency(totalValue)}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Cost Summary - Only show if purchase exists and user can view cost */}
          {receipt.purchase && can(PERMISSIONS.PURCHASE_VIEW_COST) && (
            <div className="mt-6 border-t pt-4">
              <h3 className="font-semibold mb-4">Purchase Order Summary</h3>
              <div className="max-w-md ml-auto space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(receipt.purchase.subtotal)}</span>
                </div>
                {parseFloat(receipt.purchase.discountAmount) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount:</span>
                    <span className="font-medium">-{formatCurrency(receipt.purchase.discountAmount)}</span>
                  </div>
                )}
                {parseFloat(receipt.purchase.shippingCost) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping Cost:</span>
                    <span className="font-medium">{formatCurrency(receipt.purchase.shippingCost)}</span>
                  </div>
                )}
                {parseFloat(receipt.purchase.taxAmount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="font-medium">{formatCurrency(receipt.purchase.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total Amount:</span>
                  <span>{formatCurrency(receipt.purchase.totalAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Serial Numbers */}
          {receipt.items.some(item => item.serialNumbers) && (
            <div className="mt-6 space-y-4">
              <h3 className="font-semibold">Serial Numbers</h3>
              {receipt.items
                .filter(item => item.serialNumbers)
                .map((item) => {
                  const serialNumbers = item.serialNumbers as any[]
                  const product = item.purchaseItem?.product || item.product
                  const variation = item.purchaseItem?.productVariation || item.productVariation

                  return (
                    <div key={item.id} className="border rounded-lg p-4">
                      <p className="font-medium mb-2">
                        {product.name} - {variation.name}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {serialNumbers.map((sn, index) => (
                          <div key={index} className="bg-gray-50 p-2 rounded text-sm">
                            <p><strong>Serial:</strong> {sn.serialNumber}</p>
                            {sn.imei && <p><strong>IMEI:</strong> {sn.imei}</p>}
                            <p><strong>Condition:</strong> {sn.condition || 'new'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
