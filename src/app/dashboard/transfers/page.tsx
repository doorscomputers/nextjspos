"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { PlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { Button as UiButton } from '@/components/ui/button'
import { toast } from 'sonner'
import Button from 'devextreme-react/button'
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

interface Transfer {
  id: number
  transferNumber: string
  transferDate: string
  fromLocationId: number
  toLocationId: number
  status: string
  stockDeducted: boolean
  notes: string | null
  createdAt: string
  fromLocation: { name: string }
  toLocation: { name: string }
  items: Array<{
    id: number
    quantity: string
    receivedQuantity: string | null
    verified: boolean
    product: {
      name: string
      sku: string
    }
    productVariation: {
      name: string
      sku: string | null
    }
  }>
  creator?: { username: string } | null
  checker?: { username: string } | null
  sender?: { username: string } | null
  arrivalMarker?: { username: string } | null
  verifier?: { username: string } | null
  completer?: { username: string } | null
  checkedAt: string | null
  sentAt: string | null
  arrivedAt: string | null
  verifiedAt: string | null
  completedAt: string | null
}

export default function TransfersDevExtremePage() {
  const { can, user } = usePermissions()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [userLocations, setUserLocations] = useState<any[]>([])
  const [hasAccessToAll, setHasAccessToAll] = useState(false)

  useEffect(() => {
    fetchUserLocations()
  }, [user])

  useEffect(() => {
    if (userLocations.length > 0 || hasAccessToAll) {
      fetchTransfers()
    }
  }, [userLocations, hasAccessToAll])

  const fetchUserLocations = async () => {
    try {
      const response = await fetch('/api/user-locations')
      if (response.ok) {
        const data = await response.json()
        setUserLocations(data.locations || [])
        setHasAccessToAll(data.hasAccessToAll || false)
        
        console.log('👤 User locations loaded:', data.locations.length)
        console.log('🌍 Has access to all locations:', data.hasAccessToAll)
      }
    } catch (error) {
      console.error('Failed to fetch user locations:', error)
    }
  }

  const fetchTransfers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/transfers?includeDetails=true')
      if (response.ok) {
        const data = await response.json()
        setTransfers(data || [])
        
        console.log(`📦 Loaded ${data?.length || 0} transfers`)
        if (!hasAccessToAll && userLocations.length > 0) {
          const locationNames = userLocations.map((l: any) => l.name).join(', ')
          console.log(`🔒 Filtered by user locations: ${locationNames}`)
        }
      } else {
        toast.error('Failed to fetch transfers')
      }
    } catch (error) {
      console.error('Failed to fetch transfers:', error)
      toast.error('Failed to fetch transfers')
    } finally {
      setLoading(false)
    }
  }

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; label: string }> = {
      'draft': { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: 'Draft' },
      'pending_check': { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200', label: 'Pending Check' },
      'checked': { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200', label: 'Checked' },
      'in_transit': { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200', label: 'In Transit' },
      'arrived': { color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200', label: 'Arrived' },
      'verifying': { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200', label: 'Verifying' },
      'verified': { color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200', label: 'Verified' },
      'completed': { color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200', label: 'Completed' },
      'cancelled': { color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200', label: 'Cancelled' },
    }
    return configs[status] || { color: 'bg-gray-100 text-gray-800', label: status }
  }

  const getStatusBadge = (status: string) => {
    const config = getStatusConfig(status)
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${config.color}`}>
        {config.label}
      </span>
    )
  }

  const DetailTemplate = (props: { data: { data: Transfer } }) => {
    const transfer = props.data.data

    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-900">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Transfer Items */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Transfer Items ({transfer.items.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sent</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Received</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {transfer.items.map((item) => (
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
                          item.receivedQuantity
                            ? parseFloat(item.receivedQuantity) >= parseFloat(item.quantity)
                              ? 'text-green-600'
                              : 'text-yellow-600'
                            : 'text-gray-400'
                        }`}>
                          {item.receivedQuantity || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {item.verified ? (
                          <Badge variant="default" className="text-xs">Verified</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Pending</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Status History & Workflow */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Workflow History
            </h3>
            <div className="space-y-4">
              {/* Created */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">1</span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Created</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {transfer.creator?.username || 'Unknown'} • {new Date(transfer.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Checked */}
              {transfer.checkedAt && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <span className="text-green-600 dark:text-green-400 text-xs font-bold">✓</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Approved</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {transfer.checker?.username || 'Unknown'} • {new Date(transfer.checkedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Sent */}
              {transfer.sentAt && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <span className="text-purple-600 dark:text-purple-400 text-xs font-bold">→</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Sent (Stock Deducted)
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {transfer.sender?.username || 'Unknown'} • {new Date(transfer.sentAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Arrived */}
              {transfer.arrivedAt && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                    <span className="text-indigo-600 dark:text-indigo-400 text-xs font-bold">📦</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Arrived</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {transfer.arrivalMarker?.username || 'Unknown'} • {new Date(transfer.arrivedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Verified */}
              {transfer.verifiedAt && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center">
                    <span className="text-cyan-600 dark:text-cyan-400 text-xs font-bold">✓✓</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Items Verified
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {transfer.verifier?.username || 'Unknown'} • {new Date(transfer.verifiedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Completed */}
              {transfer.completedAt && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <span className="text-green-600 dark:text-green-400 text-xs font-bold">🎉</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Completed (Stock Added)
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {transfer.completer?.username || 'Unknown'} • {new Date(transfer.completedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Current Status Badge */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Status:</span>
                {getStatusBadge(transfer.status)}
              </div>
              {transfer.stockDeducted && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  ✓ Stock has been deducted from origin location
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        {transfer.notes && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes:</h3>
            <p className="text-sm text-gray-900 dark:text-gray-100">{transfer.notes}</p>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6 flex justify-end">
          <Link href={`/dashboard/transfers/${transfer.id}`}>
            <Button size="sm" variant="outline">
              View Full Details & Take Actions
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!can(PERMISSIONS.STOCK_TRANSFER_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view stock transfers.
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
            Stock Transfers
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Manage stock transfers with master-detail view
          </p>
          {/* Location Filter Info */}
          {!hasAccessToAll && userLocations.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                📍 Filtered by: {userLocations.map((l: any) => l.name).join(', ')}
              </Badge>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                (Showing transfers from/to your assigned location{userLocations.length > 1 ? 's' : ''})
              </span>
            </div>
          )}
          {hasAccessToAll && (
            <div className="mt-2">
              <Badge variant="secondary" className="text-xs">
                🌍 Viewing all locations
              </Badge>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchTransfers} variant="outline" size="sm">
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {can(PERMISSIONS.STOCK_TRANSFER_CREATE) && (
            <Link href="/dashboard/transfers/create">
              <Button
                text="New Transfer"
                type="default"
                icon="add"
                stylingMode="contained"
              />
            </Link>
          )}
        </div>
      </div>

      {/* DevExtreme DataGrid with Master-Detail */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <DataGrid
          dataSource={transfers}
          keyExpr="id"
          showBorders={true}
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          height={700}
        >
          <StateStoring enabled={true} type="localStorage" storageKey="transfersGridState" />
          <Selection mode="multiple" showCheckBoxesMode="always" />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <SearchPanel visible={true} width={300} placeholder="Search transfers..." />
          <ColumnChooser enabled={true} mode="select" />
          <Paging defaultPageSize={25} />
          <Export enabled={true} formats={['xlsx', 'pdf']} />

          {/* Master-Detail Configuration */}
          <MasterDetail
            enabled={true}
            component={DetailTemplate}
          />

          <Column
            dataField="transferNumber"
            caption="Transfer #"
            width={150}
            cellRender={(data) => (
              <Link href={`/dashboard/transfers/${data.data.id}`}>
                <span className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline cursor-pointer">
                  {data.text}
                </span>
              </Link>
            )}
          />

          <Column
            dataField="transferDate"
            caption="Transfer Date"
            dataType="date"
            format="MMM dd, yyyy"
            width={130}
          />

          <Column
            dataField="fromLocation.name"
            caption="From Location"
            minWidth={150}
          />

          <Column
            dataField="toLocation.name"
            caption="To Location"
            minWidth={150}
          />

          <Column
            caption="Items"
            width={80}
            alignment="center"
            calculateCellValue={(data: Transfer) => data.items.length}
            cellRender={(data) => (
              <Badge variant="outline" className="text-xs">
                {data.text}
              </Badge>
            )}
          />

          <Column
            caption="Verified"
            width={90}
            alignment="center"
            calculateCellValue={(data: Transfer) => {
              const verified = data.items.filter(item => item.verified).length
              const total = data.items.length
              return `${verified}/${total}`
            }}
            cellRender={(data) => {
              const [verified, total] = data.text.split('/')
              const isComplete = verified === total
              return (
                <Badge
                  variant={isComplete ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {data.text}
                </Badge>
              )
            }}
          />

          <Column
            dataField="status"
            caption="Status"
            width={130}
            alignment="center"
            cellRender={(data) => getStatusBadge(data.value)}
          />

          <Column
            dataField="stockDeducted"
            caption="Stock Status"
            width={130}
            alignment="center"
            cellRender={(data) => (
              <Badge
                variant={data.value ? 'default' : 'secondary'}
                className="text-xs"
              >
                {data.value ? 'Deducted' : 'Not Deducted'}
              </Badge>
            )}
          />

          <Column
            dataField="createdAt"
            caption="Created"
            dataType="date"
            format="MMM dd, yyyy"
            width={120}
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
