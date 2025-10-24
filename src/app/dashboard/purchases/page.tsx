"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { PlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import DataGrid, {
  Column,
  MasterDetail,
  Paging,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Export,
  ColumnChooser,
  StateStoring,
  Selection,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid'
import { Template } from 'devextreme-react/core/template'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currencyUtils'

interface Purchase {
  id: number
  purchaseOrderNumber: string
  purchaseDate: string
  expectedDeliveryDate: string | null
  status: string
  subtotal: number
  taxAmount: number
  discountAmount: number
  shippingCost: number
  totalAmount: number
  notes: string | null
  createdAt: string
  supplier: {
    id: number
    name: string
    mobile: string | null
    email: string | null
  }
  items: Array<{
    id: number
    quantity: number
    quantityReceived: number
    unitCost: number
    lineTotal: number
    product: {
      name: string
      sku: string
    }
    productVariation: {
      name: string
      sku: string | null
    }
  }>
  receipts: Array<{
    id: number
    receiptNumber: string
    receivedDate: string
    status: string
    notes: string | null
    receivedBy: number
    receivedAt: string
  }>
}

export default function PurchasesDevExtremePage() {
  const { can } = usePermissions()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPurchases()
  }, [])

  const fetchPurchases = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/purchases?includeDetails=true')
      if (response.ok) {
        const data = await response.json()
        setPurchases(data.purchases || [])
      } else {
        toast.error('Failed to fetch purchase orders')
      }
    } catch (error) {
      console.error('Failed to fetch purchases:', error)
      toast.error('Failed to fetch purchase orders')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; label: string; className?: string }> = {
      'draft': { variant: 'secondary', label: 'Draft' },
      'pending': {
        variant: 'default',
        label: 'Pending',
        className: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700'
      },
      'ordered': { variant: 'default', label: 'Ordered' },
      'partial': {
        variant: 'default',
        label: 'Partial',
        className: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700'
      },
      'received': {
        variant: 'default',
        label: 'Received',
        className: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700'
      },
      'completed': {
        variant: 'default',
        label: 'Completed',
        className: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700'
      },
      'cancelled': { variant: 'destructive', label: 'Cancelled' },
    }

    const config = statusConfig[status] || { variant: 'secondary', label: status }

    return (
      <Badge variant={config.variant} className={`capitalize ${config.className || ''}`}>
        {config.label}
      </Badge>
    )
  }

  const DetailTemplate = (props: { data: { data: Purchase } }) => {
    const purchase = props.data.data

    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-900">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Purchase Items */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Purchase Order Items ({purchase.items.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ordered</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Received</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit Cost</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {purchase.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {item.product.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {item.productVariation.name}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={`text-sm font-medium ${
                          item.quantityReceived >= item.quantity
                            ? 'text-green-600'
                            : item.quantityReceived > 0
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          {item.quantityReceived}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">
                        {formatCurrency(item.unitCost)}
                      </td>
                      <td className="px-4 py-2 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Total:
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency(purchase.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Related GRN (Goods Received Notes) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Goods Received Notes (GRN) - {purchase.receipts.length}
            </h3>
            {purchase.receipts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No GRN records found</p>
                <p className="text-sm mt-2">Items haven't been received yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {purchase.receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {receipt.receiptNumber}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Received: {new Date(receipt.receivedDate).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge
                        variant={receipt.status === 'received' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {receipt.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Received: {new Date(receipt.receivedAt).toLocaleString()}
                    </div>
                    {receipt.notes && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">
                        Note: {receipt.notes}
                      </div>
                    )}
                    <div className="mt-3">
                      <Link href={`/dashboard/purchases/receipts/${receipt.id}`}>
                        <Button size="sm" variant="outline" className="text-xs">
                          View GRN Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {purchase.receipts.length === 0 && can(PERMISSIONS.PURCHASE_RECEIPT_CREATE) && (
              <div className="mt-4">
                <Link href={`/dashboard/purchases/receipts/create?purchaseId=${purchase.id}`}>
                  <Button size="sm" className="w-full">
                    Create GRN (Receive Items)
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Subtotal:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {formatCurrency(purchase.subtotal)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Tax:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {formatCurrency(purchase.taxAmount)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Discount:</span>
              <span className="ml-2 font-medium text-red-600 dark:text-red-400">
                -{formatCurrency(purchase.discountAmount)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Shipping:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {formatCurrency(purchase.shippingCost)}
              </span>
            </div>
          </div>
          {purchase.notes && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400 text-sm">Notes:</span>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{purchase.notes}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!can(PERMISSIONS.PURCHASE_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view purchase orders.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Purchase Orders
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Manage purchase orders with master-detail view
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={fetchPurchases}
            variant="outline"
            size="default"
            className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm"
          >
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {can(PERMISSIONS.PURCHASE_CREATE) && (
            <Link href="/dashboard/purchases/create">
              <Button
                size="default"
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all font-semibold"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                New Purchase Order
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* DevExtreme DataGrid with Master-Detail */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <DataGrid
          dataSource={purchases}
          keyExpr="id"
          showBorders={true}
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          height={700}
        >
          <StateStoring enabled={true} type="localStorage" storageKey="purchasesGridState" />
          <Selection mode="multiple" showCheckBoxesMode="always" />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <SearchPanel visible={true} width={300} placeholder="Search purchase orders..." />
          <ColumnChooser enabled={true} mode="select" />
          <Paging defaultPageSize={25} />
          <Export enabled={true} formats={['xlsx', 'pdf']} />

          {/* Master-Detail Configuration */}
          <MasterDetail
            enabled={true}
            component={DetailTemplate}
          />

          <Column
            dataField="purchaseOrderNumber"
            caption="PO Number"
            width={150}
            cellRender={(data) => (
              <Link href={`/dashboard/purchases/${data.data.id}`}>
                <span className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline cursor-pointer">
                  {data.text}
                </span>
              </Link>
            )}
          />

          <Column
            dataField="purchaseDate"
            caption="PO Date"
            dataType="date"
            format="MMM dd, yyyy"
            width={120}
          />

          <Column
            dataField="supplier.name"
            caption="Supplier"
            minWidth={150}
          />

          <Column
            caption="Items"
            width={80}
            alignment="center"
            calculateCellValue={(data: Purchase) => data.items.length}
            cellRender={(data) => (
              <Badge variant="outline" className="text-xs">
                {data.text}
              </Badge>
            )}
          />

          <Column
            caption="GRN Count"
            width={100}
            alignment="center"
            calculateCellValue={(data: Purchase) => data.receipts?.length || 0}
            cellRender={(data) => (
              <Badge
                variant={data.value > 0 ? 'default' : 'secondary'}
                className="text-xs"
              >
                {data.text}
              </Badge>
            )}
          />

          <Column
            dataField="totalAmount"
            caption="Total Amount"
            dataType="number"
            format="₱#,##0.00"
            width={130}
            alignment="right"
          />

          <Column
            dataField="status"
            caption="Status"
            width={120}
            alignment="center"
            cellRender={(data) => getStatusBadge(data.value)}
          />

          <Column
            dataField="expectedDeliveryDate"
            caption="Expected Delivery"
            dataType="date"
            format="MMM dd, yyyy"
            width={140}
          />

          <Toolbar>
            <Item name="groupPanel" />
            <Item name="searchPanel" />
            <Item name="exportButton" />
            <Item name="columnChooserButton" />
          </Toolbar>
        </DataGrid>
      </div>
    </div>
  )
}
