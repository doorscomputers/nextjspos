"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ArrowPathIcon, TruckIcon, PlusIcon } from '@heroicons/react/24/outline'
import DataGrid, {
  Column,
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

interface LocationChangeRequest {
  id: number
  attendanceId: number
  fromLocationId: number
  toLocationId: number
  requestedBy: number
  requestedAt: string
  approvedBy: number | null
  approvedAt: string | null
  switchTime: string | null
  status: string
  reason: string
  notes: string | null
  attendance: {
    id: number
    clockInTime: string
    clockOutTime: string | null
  }
  fromLocation: {
    id: number
    name: string
  }
  toLocation: {
    id: number
    name: string
  }
  requestedByUser: {
    id: number
    username: string
    firstName: string | null
    lastName: string | null
  }
  approvedByUser: {
    id: number
    username: string
    firstName: string | null
    lastName: string | null
  } | null
}

export default function LocationChangesPage() {
  const { can, user } = usePermissions()
  const [requests, setRequests] = useState<LocationChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

  useEffect(() => {
    if (can(PERMISSIONS.LOCATION_CHANGE_REQUEST_VIEW) || can(PERMISSIONS.LOCATION_CHANGE_REQUEST_MANAGE) || can(PERMISSIONS.LOCATION_CHANGE_REQUEST_APPROVE)) {
      fetchRequests()
    }
  }, [filter])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const url = filter === 'all' ? '/api/location-changes' : `/api/location-changes?status=${filter}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests || [])
      } else {
        toast.error('Failed to fetch location change requests')
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error)
      toast.error('Failed to fetch requests')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (requestId: number) => {
    if (!confirm('Are you sure you want to approve this location change request?')) {
      return
    }

    try {
      const response = await fetch(`/api/location-changes/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: 'Approved by manager',
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Request approved successfully')
        fetchRequests()
      } else {
        toast.error(data.error || 'Failed to approve request')
      }
    } catch (error) {
      console.error('Failed to approve request:', error)
      toast.error('Failed to approve request')
    }
  }

  const handleReject = async (requestId: number) => {
    const reason = prompt('Please provide a reason for rejection:')
    if (!reason) {
      toast.error('Rejection reason is required')
      return
    }

    try {
      const response = await fetch(`/api/location-changes/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Request rejected successfully')
        fetchRequests()
      } else {
        toast.error(data.error || 'Failed to reject request')
      }
    } catch (error) {
      console.error('Failed to reject request:', error)
      toast.error('Failed to reject request')
    }
  }

  const getEmployeeName = (user: { username: string; firstName: string | null; lastName: string | null }) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim()
    }
    return user.username
  }

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string; label: string }> = {
      'pending': { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200', label: 'Pending' },
      'approved': { color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200', label: 'Approved' },
      'rejected': { color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200', label: 'Rejected' },
      'cancelled': { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: 'Cancelled' },
    }
    const config = configs[status] || { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: status }
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${config.color}`}>
        {config.label}
      </span>
    )
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const canApprove = can(PERMISSIONS.LOCATION_CHANGE_REQUEST_APPROVE) || can(PERMISSIONS.LOCATION_CHANGE_REQUEST_MANAGE)
  const canReject = can(PERMISSIONS.LOCATION_CHANGE_REQUEST_REJECT) || can(PERMISSIONS.LOCATION_CHANGE_REQUEST_MANAGE)

  // Check permissions
  if (!can(PERMISSIONS.LOCATION_CHANGE_REQUEST_VIEW) && !can(PERMISSIONS.LOCATION_CHANGE_REQUEST_MANAGE) && !can(PERMISSIONS.LOCATION_CHANGE_REQUEST_APPROVE)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            You do not have permission to view location change requests.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <TruckIcon className="w-8 h-8" />
            Location Change Requests
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage employee location change requests
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchRequests}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={() => setFilter('all')}
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
        >
          All
        </Button>
        <Button
          onClick={() => setFilter('pending')}
          variant={filter === 'pending' ? 'default' : 'outline'}
          size="sm"
          className={filter === 'pending' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
        >
          Pending
        </Button>
        <Button
          onClick={() => setFilter('approved')}
          variant={filter === 'approved' ? 'default' : 'outline'}
          size="sm"
          className={filter === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}
        >
          Approved
        </Button>
        <Button
          onClick={() => setFilter('rejected')}
          variant={filter === 'rejected' ? 'default' : 'outline'}
          size="sm"
          className={filter === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''}
        >
          Rejected
        </Button>
      </div>

      {/* DataGrid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <DataGrid
          dataSource={requests}
          keyExpr="id"
          showBorders={true}
          showRowLines={true}
          showColumnLines={true}
          rowAlternationEnabled={true}
          hoverStateEnabled={true}
          allowColumnReordering={true}
          allowColumnResizing={true}
          columnAutoWidth={true}
          wordWrapEnabled={false}
          className="dark:bg-gray-800"
        >
          <StateStoring enabled={true} type="localStorage" storageKey="location-changes-grid-state" />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <SearchPanel visible={true} width={240} placeholder="Search requests..." />
          <ColumnChooser enabled={true} mode="select" />
          <Export enabled={true} allowExportSelectedData={true} />
          <Selection mode="multiple" showCheckBoxesMode="always" />
          <Paging enabled={true} defaultPageSize={20} />

          <Column
            dataField="id"
            caption="ID"
            width={80}
            alignment="center"
          />

          <Column
            caption="Employee"
            calculateCellValue={(data: LocationChangeRequest) => getEmployeeName(data.requestedByUser)}
            cellRender={(data) => (
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {getEmployeeName(data.data.requestedByUser)}
              </div>
            )}
          />

          <Column
            dataField="fromLocation.name"
            caption="From Location"
            cellRender={(data) => (
              <span className="text-gray-900 dark:text-gray-100">
                {data.data.fromLocation.name}
              </span>
            )}
          />

          <Column
            dataField="toLocation.name"
            caption="To Location"
            cellRender={(data) => (
              <span className="text-gray-900 dark:text-gray-100">
                {data.data.toLocation.name}
              </span>
            )}
          />

          <Column
            dataField="reason"
            caption="Reason"
            cellRender={(data) => (
              <span className="text-gray-900 dark:text-gray-100 text-sm">
                {data.data.reason}
              </span>
            )}
          />

          <Column
            dataField="requestedAt"
            caption="Requested At"
            dataType="datetime"
            format="MMM dd, yyyy hh:mm a"
            width={160}
          />

          <Column
            dataField="status"
            caption="Status"
            width={120}
            alignment="center"
            cellRender={(data) => getStatusBadge(data.data.status)}
          />

          <Column
            caption="Approver"
            width={150}
            calculateCellValue={(data: LocationChangeRequest) =>
              data.approvedByUser ? getEmployeeName(data.approvedByUser) : '-'
            }
            cellRender={(data) => (
              <span className="text-gray-900 dark:text-gray-100 text-sm">
                {data.data.approvedByUser ? getEmployeeName(data.data.approvedByUser) : '-'}
              </span>
            )}
          />

          <Column
            caption="Actions"
            width={200}
            alignment="center"
            cellRender={(data) => (
              <div className="flex items-center justify-center gap-2">
                {data.data.status === 'pending' && canApprove && (
                  <>
                    <Button
                      onClick={() => handleApprove(data.data.id)}
                      size="sm"
                      className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                    >
                      Approve
                    </Button>
                    {canReject && (
                      <Button
                        onClick={() => handleReject(data.data.id)}
                        variant="destructive"
                        size="sm"
                        className="h-8 px-3 text-xs"
                      >
                        Reject
                      </Button>
                    )}
                  </>
                )}
                {data.data.status !== 'pending' && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {data.data.status === 'approved' ? 'Completed' : 'No actions available'}
                  </span>
                )}
              </div>
            )}
          />

          <Toolbar>
            <Item name="searchPanel" />
            <Item name="exportButton" />
            <Item name="columnChooserButton" />
          </Toolbar>
        </DataGrid>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Requests</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {requests.length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {requests.filter(r => r.status === 'pending').length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Approved</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {requests.filter(r => r.status === 'approved').length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Rejected</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {requests.filter(r => r.status === 'rejected').length}
          </div>
        </div>
      </div>
    </div>
  )
}
