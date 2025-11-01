'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { PlusIcon, ArrowPathIcon, EyeIcon, PencilIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import DataGrid, {
  Column,
  Export,
  FilterRow,
  Grouping,
  GroupPanel,
  Pager,
  Paging,
  SearchPanel,
  Summary,
  TotalItem,
  Sorting,
  HeaderFilter,
  ColumnChooser,
  ColumnFixing,
  StateStoring,
  LoadPanel,
  Scrolling,
  Selection,
  MasterDetail,
  RemoteOperations,
} from 'devextreme-react/data-grid'
import CustomStore from 'devextreme/data/custom_store'
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
  updatedAt: string
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
  createdByUser: {
    id: number
    username: string
    firstName: string | null
    lastName: string | null
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
  }>
  // Calculated fields
  totalItems: number
  totalQuantity: number
  totalReceived: number
  receiptCount: number
  isFullyReceived: boolean
  isPartiallyReceived: boolean
  isNotReceived: boolean
  supplierName: string
  locationName: string
  creatorName: string
}

export default function PurchasesOptimizedPage() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [gridInitialized, setGridInitialized] = useState(false)

  // Create custom store for server-side operations
  const dataSource = new CustomStore({
    key: 'id',
    load: async (loadOptions) => {
      try {
        setLoading(true)

        const params = new URLSearchParams()

        // Pagination
        if (loadOptions.skip) params.append('skip', loadOptions.skip.toString())
        if (loadOptions.take) params.append('take', loadOptions.take.toString())

        // Sorting
        if (loadOptions.sort && Array.isArray(loadOptions.sort) && loadOptions.sort.length > 0) {
          const sort = loadOptions.sort[0] as any
          params.append('sortBy', sort.selector || sort)
          params.append('sortOrder', sort.desc ? 'desc' : 'asc')
        }

        // Filtering
        if (loadOptions.filter) {
          const filters = loadOptions.filter
          if (Array.isArray(filters)) {
            filters.forEach(filter => {
              if (filter[0] && filter[1] && filter[2] !== undefined) {
                const [field, operator, value] = filter
                if (field === 'search' && value) {
                  params.append('search', value.toString())
                } else if (field === 'status' && value) {
                  params.append('status', value.toString())
                } else if (field === 'supplier.name' && value) {
                  params.append('supplierId', value.toString())
                } else if (field === 'location.name' && value) {
                  params.append('locationId', value.toString())
                } else if (field === 'purchaseDate' && value) {
                  if (operator === '>=') {
                    params.append('startDate', value.toString())
                  } else if (operator === '<=') {
                    params.append('endDate', value.toString())
                  }
                }
              }
            })
          }
        }

        const response = await fetch(`/api/purchases/route-optimized?${params.toString()}`)

        if (!response.ok) {
          throw new Error('Failed to fetch purchases')
        }

        const data = await response.json()

        return {
          data: data.data,
          totalCount: data.totalCount
        }
      } catch (error) {
        console.error('Error loading purchases:', error)
        toast.error('Failed to load purchases')
        return { data: [], totalCount: 0 }
      } finally {
        setLoading(false)
      }
    }
  })

  const dataGridRef = useRef<any>(null)

  const handleRefresh = useCallback(() => {
    if (dataGridRef.current) {
      dataGridRef.current.instance.refresh()
    }
  }, [])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      received: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      completed: 'bg-green-100 text-green-800'
    }
    return (
      <Badge className={variants[status] || 'bg-gray-100 text-gray-800'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const getReceiptStatusBadge = (purchase: Purchase) => {
    if (purchase.isFullyReceived) {
      return <Badge className="bg-green-100 text-green-800">Fully Received</Badge>
    } else if (purchase.isPartiallyReceived) {
      return <Badge className="bg-yellow-100 text-yellow-800">Partially Received</Badge>
    } else {
      return <Badge className="bg-red-100 text-red-800">Not Received</Badge>
    }
  }

  const MasterDetailTemplate = ({ data }: { data: Purchase }) => (
    <div className="p-4 bg-gray-50 dark:bg-gray-800">
      <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Purchase Order Details</h4>

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <span className="font-medium">PO Number:</span> {data.purchaseOrderNumber}
        </div>
        <div>
          <span className="font-medium">Status:</span> {getStatusBadge(data.status)}
        </div>
        <div>
          <span className="font-medium">Supplier:</span> {data.supplierName}
        </div>
        <div>
          <span className="font-medium">Location:</span> {data.locationName}
        </div>
        <div>
          <span className="font-medium">Purchase Date:</span> {new Date(data.purchaseDate).toLocaleDateString()}
        </div>
        <div>
          <span className="font-medium">Expected Delivery:</span> {data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate).toLocaleDateString() : 'N/A'}
        </div>
        <div>
          <span className="font-medium">Created By:</span> {data.creatorName}
        </div>
        <div>
          <span className="font-medium">Receipt Status:</span> {getReceiptStatusBadge(data)}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-4 gap-4 text-sm mb-4">
        <div>
          <span className="font-medium">Subtotal:</span> {formatCurrency(data.subtotal)}
        </div>
        <div>
          <span className="font-medium">Tax:</span> {formatCurrency(data.taxAmount)}
        </div>
        <div>
          <span className="font-medium">Discount:</span> {formatCurrency(data.discountAmount)}
        </div>
        <div>
          <span className="font-medium">Total:</span> {formatCurrency(data.totalAmount)}
        </div>
      </div>

      {/* Items Summary */}
      <div className="text-sm">
        <span className="font-medium">Items:</span> {data.totalItems} items, {data.totalQuantity} qty ordered, {data.totalReceived} qty received
      </div>

      {data.notes && (
        <div className="mt-2 text-sm">
          <span className="font-medium">Notes:</span> {data.notes}
        </div>
      )}
    </div>
  )

  if (!can(PERMISSIONS.PURCHASE_VIEW)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to view purchases.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Purchase Orders (Optimized)
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Server-side pagination, filtering, and sorting for optimal performance
          </p>
        </div>

        <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-2">
          {can(PERMISSIONS.PURCHASE_CREATE) && (
            <Link href="/dashboard/purchases/add">
              <Button className="w-full sm:w-auto">
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Purchase Order
              </Button>
            </Link>
          )}

          <Button
            variant="outline"
            onClick={handleRefresh}
            className="w-full sm:w-auto"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Optimized DataGrid with Server-Side Operations */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Purchase Orders Grid (Server-Side Optimized)
        </h2>

        <DataGrid
          ref={dataGridRef}
          dataSource={dataSource}
          showBorders={true}
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          height={700}
          keyExpr="id"
          onContentReady={() => {
            if (!gridInitialized) {
              setGridInitialized(true)
              console.log('Optimized purchases grid initialized and ready')
            }
          }}
          wordWrapEnabled={false}
          allowColumnReordering={true}
          allowColumnResizing={true}
        >
          <RemoteOperations
            filtering={true}
            sorting={true}
            paging={true}
            grouping={false}
          />

          <StateStoring enabled={true} type="localStorage" storageKey="purchasesOptimizedState" />
          <LoadPanel enabled={true} />
          <Scrolling mode="virtual" />
          <Selection mode="multiple" showCheckBoxesMode="always" />
          <Export enabled={true} formats={['xlsx', 'pdf']} allowExportSelectedData={true} />
          <ColumnChooser enabled={true} mode="select" />
          <ColumnFixing enabled={true} />
          <SearchPanel visible={true} width={300} placeholder="Search purchase orders..." />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <Paging defaultPageSize={50} />
          <Grouping autoExpandAll={false} />
          <GroupPanel visible={true} emptyPanelText="Drag column headers here to group by status, supplier, or location" />
          <Sorting mode="multiple" />

          {/* Master-Detail for purchase details */}
          <MasterDetail enabled={true} component={MasterDetailTemplate} />

          {/* Fixed Columns */}
          <Column
            dataField="purchaseOrderNumber"
            caption="PO Number"
            width={150}
            fixed={true}
            fixedPosition="left"
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
            caption="Purchase Date"
            width={120}
            dataType="date"
            format="MMM dd, yyyy"
            cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text}</span>}
          />
          <Column
            dataField="supplierName"
            caption="Supplier"
            minWidth={150}
            cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text}</span>}
          />
          <Column
            dataField="locationName"
            caption="Location"
            width={120}
            cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text}</span>}
          />
          <Column
            dataField="status"
            caption="Status"
            width={120}
            cellRender={(data) => getStatusBadge(data.text)}
          />
          <Column
            dataField="totalAmount"
            caption="Total Amount"
            width={120}
            dataType="number"
            format="currency"
            cellRender={(data) => <span className="font-mono text-gray-900 dark:text-gray-100">{formatCurrency(data.text)}</span>}
          />
          <Column
            dataField="totalItems"
            caption="Items"
            width={80}
            alignment="center"
            cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text}</span>}
          />
          <Column
            dataField="totalQuantity"
            caption="Qty Ordered"
            width={100}
            alignment="center"
            cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text}</span>}
          />
          <Column
            dataField="totalReceived"
            caption="Qty Received"
            width={100}
            alignment="center"
            cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text}</span>}
          />
          <Column
            caption="Receipt Status"
            width={140}
            cellRender={(data) => getReceiptStatusBadge(data.data)}
          />
          <Column
            dataField="creatorName"
            caption="Created By"
            width={120}
            cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text}</span>}
          />
          <Column
            dataField="createdAt"
            caption="Created"
            width={120}
            dataType="datetime"
            format="MMM dd, yyyy"
            cellRender={(data) => <span className="text-gray-600 dark:text-gray-400">{data.text}</span>}
          />
          <Column
            caption="Actions"
            width={120}
            allowSorting={false}
            allowFiltering={false}
            cellRender={(data) => (
              <div className="flex space-x-1">
                <Link href={`/dashboard/purchases/${data.data.id}`}>
                  <Button size="sm" variant="outline">
                    <EyeIcon className="h-3 w-3" />
                  </Button>
                </Link>
                <Link href={`/dashboard/purchases/${data.data.id}/edit`}>
                  <Button size="sm" variant="outline">
                    <PencilIcon className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            )}
          />
        </DataGrid>
      </div>
    </div>
  )
}
