'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PasswordConfirmDialog } from '@/components/PasswordConfirmDialog'
import { Plus, CheckCircle, XCircle, Eye, Edit, Trash2 } from 'lucide-react'
import DataGrid, {
  Column,
  ColumnChooser,
  ColumnChooserSearch,
  ColumnChooserSelection,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Export,
  Selection,
  Toolbar,
  Item,
  Scrolling,
  LoadPanel,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver-es'
import { exportDataGrid } from 'devextreme/excel_exporter'

interface InventoryCorrection {
  id: number
  systemCount: number
  physicalCount: number
  difference: number
  reason: string
  remarks: string | null
  status: string
  createdAt: string
  updatedAt: string
  approvedAt: string | null
  rejectedAt?: string | null
  product: {
    id: number
    name: string
    sku: string
  }
  productVariation: {
    id: number
    name: string
    sku: string
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
  approvedByUser: {
    id: number
    username: string
    firstName: string | null
    lastName: string | null
  } | null
}

export default function InventoryCorrectionsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { can } = usePermissions()
  const [corrections, setCorrections] = useState<InventoryCorrection[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkApproving, setBulkApproving] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)

  // Check permission
  if (!can(PERMISSIONS.INVENTORY_CORRECTION_VIEW)) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">You do not have permission to view inventory corrections.</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetchCorrections()
  }, [])

  const fetchCorrections = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/inventory-corrections?limit=1000')

      if (res.ok) {
        const data = await res.json()
        setCorrections(data.corrections || [])
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to fetch inventory corrections')
      }
    } catch (error) {
      console.error('Error fetching corrections:', error)
      toast.error('Failed to fetch inventory corrections')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (correctionId: number) => {
    if (!confirm('Are you sure you want to approve this inventory correction? This will update the stock levels and cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/inventory-corrections/${correctionId}/approve`, {
        method: 'POST'
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || 'Inventory correction approved successfully')
        fetchCorrections() // Refresh list
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to approve inventory correction')
      }
    } catch (error) {
      console.error('Error approving correction:', error)
      toast.error('Failed to approve inventory correction')
    }
  }

  const handleDelete = async (correctionId: number) => {
    if (!confirm('Are you sure you want to delete this inventory correction? This action cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/inventory-corrections/${correctionId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        toast.success('Inventory correction deleted successfully')
        fetchCorrections() // Refresh list
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to delete inventory correction')
      }
    } catch (error) {
      console.error('Error deleting correction:', error)
      toast.error('Failed to delete inventory correction')
    }
  }

  const handleReject = async (correctionId: number) => {
    const reason = prompt('Please enter the reason for rejection (optional):')

    if (reason === null) {
      // User cancelled the prompt
      return
    }

    if (!confirm('Are you sure you want to reject this inventory correction? This will mark it as rejected and no stock adjustments will be made.')) {
      return
    }

    try {
      const res = await fetch(`/api/inventory-corrections/${correctionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || 'Inventory correction rejected successfully')
        fetchCorrections() // Refresh list
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to reject inventory correction')
      }
    } catch (error) {
      console.error('Error rejecting correction:', error)
      toast.error('Failed to reject inventory correction')
    }
  }

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) {
      toast.error('Please select corrections to approve')
      return
    }

    if (!confirm(`Are you sure you want to approve ${selectedIds.length} inventory correction(s)? This will update the stock levels and cannot be undone.`)) {
      return
    }

    // Show password confirmation dialog
    setShowPasswordDialog(true)
  }

  const executeBulkApprove = async (password: string) => {
    // Verify password first
    const verifyRes = await fetch('/api/auth/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })

    if (!verifyRes.ok) {
      const error = await verifyRes.json()
      throw new Error(error.error || 'Invalid password')
    }

    // Password verified, proceed with bulk approve
    try {
      setBulkApproving(true)
      const res = await fetch('/api/inventory-corrections/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correctionIds: selectedIds })
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || 'Bulk approval completed')
        setSelectedIds([]) // Clear selection
        fetchCorrections() // Refresh list
      } else {
        const error = await res.json()
        throw new Error(error.error || 'Failed to bulk approve corrections')
      }
    } catch (error: any) {
      console.error('Error bulk approving:', error)
      throw error
    } finally {
      setBulkApproving(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select corrections to delete')
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedIds.length} inventory correction(s)? This action cannot be undone.`)) {
      return
    }

    try {
      setBulkDeleting(true)
      const res = await fetch('/api/inventory-corrections/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correctionIds: selectedIds })
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || 'Bulk delete completed')
        setSelectedIds([]) // Clear selection
        fetchCorrections() // Refresh list
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to bulk delete corrections')
      }
    } catch (error: any) {
      console.error('Error bulk deleting:', error)
      toast.error('Failed to bulk delete corrections')
    } finally {
      setBulkDeleting(false)
    }
  }

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      beginning_inventory: 'Beginning Inventory',
      expired: 'Expired',
      damaged: 'Damaged',
      missing: 'Missing',
      found: 'Found',
      count_error: 'Count Error'
    }
    return labels[reason] || reason
  }

  const onExporting = useCallback((e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Inventory Corrections')

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'InventoryCorrections.xlsx')
      })
    })
  }, [])

  const renderStatusCell = (data: any) => {
    const status = data.value
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-400">Pending</Badge>
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400">Approved</Badge>
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-400">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const renderDifferenceCell = (data: any) => {
    const difference = data.value
    if (difference > 0) {
      return <span className="text-green-600 dark:text-green-400 font-medium">+{difference}</span>
    } else if (difference < 0) {
      return <span className="text-red-600 dark:text-red-400 font-medium">{difference}</span>
    }
    return <span className="text-gray-600 dark:text-gray-400">0</span>
  }

  const renderActionsCell = (data: any) => {
    const correction = data.data as InventoryCorrection
    // Check if current user created this correction (self-approval restriction)
    const currentUserId = session?.user?.id ? Number(session.user.id) : null
    const isOwnCorrection = currentUserId === correction.createdByUser?.id

    return (
      <div className="flex items-center justify-end gap-1.5">
        {/* Approve Button - Hidden for own corrections (self-approval restriction) */}
        {correction.status === 'pending' && can(PERMISSIONS.INVENTORY_CORRECTION_APPROVE) && !isOwnCorrection && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleApprove(correction.id)}
            className="gap-1.5 px-3 border-green-500 text-green-700 hover:bg-green-50 hover:border-green-600 hover:shadow-sm dark:border-green-600 dark:text-green-400 dark:hover:bg-green-950 dark:hover:border-green-500 transition-all"
            title="Approve correction"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            <span className="font-medium text-xs">Approve</span>
          </Button>
        )}

        {/* Reject Button - Hidden for own corrections (self-rejection restriction) */}
        {correction.status === 'pending' && can(PERMISSIONS.INVENTORY_CORRECTION_REJECT) && !isOwnCorrection && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleReject(correction.id)}
            className="gap-1.5 px-3 border-red-500 text-red-700 hover:bg-red-50 hover:border-red-600 hover:shadow-sm dark:border-red-600 dark:text-red-400 dark:hover:bg-red-950 dark:hover:border-red-500 transition-all"
            title="Reject correction"
          >
            <XCircle className="h-3.5 w-3.5" />
            <span className="font-medium text-xs">Reject</span>
          </Button>
        )}

        {/* View Button */}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => router.push(`/dashboard/inventory-corrections/${correction.id}`)}
          className="hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950 transition-all"
          title="View details"
        >
          <Eye className="h-4 w-4" />
        </Button>

        {/* Edit Button */}
        {correction.status === 'pending' && can(PERMISSIONS.INVENTORY_CORRECTION_UPDATE) && (
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => router.push(`/dashboard/inventory-corrections/${correction.id}/edit`)}
            className="hover:border-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-950 transition-all"
            title="Edit correction"
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}

        {/* Delete Button */}
        {correction.status === 'pending' && can(PERMISSIONS.INVENTORY_CORRECTION_DELETE) && (
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => handleDelete(correction.id)}
            className="hover:border-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950 transition-all"
            title="Delete correction"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }

  const onSelectionChanged = useCallback((e: any) => {
    const selectedRowsData = e.selectedRowsData as InventoryCorrection[]
    // Only allow selection of pending corrections
    const pendingIds = selectedRowsData
      .filter(row => row.status === 'pending')
      .map(row => row.id)
    setSelectedIds(pendingIds)
  }, [])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Inventory Corrections</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Manage stock adjustments for expired, damaged, or missing items</p>
      </div>

      {/* Bulk Actions and New Button */}
      <div className="mb-4 flex items-center gap-2 justify-end">
        {can(PERMISSIONS.INVENTORY_CORRECTION_DELETE) && selectedIds.length > 0 && (
          <Button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            {bulkDeleting ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-red-600 border-t-transparent"></div>
                Deleting {selectedIds.length}...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Bulk Delete ({selectedIds.length})
              </>
            )}
          </Button>
        )}

        {can(PERMISSIONS.INVENTORY_CORRECTION_APPROVE) && selectedIds.length > 0 && (
          <Button
            onClick={handleBulkApprove}
            disabled={bulkApproving}
            variant="success"
          >
            {bulkApproving ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Approving {selectedIds.length}...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Bulk Approve ({selectedIds.length})
              </>
            )}
          </Button>
        )}

        {can(PERMISSIONS.INVENTORY_CORRECTION_CREATE) && (
          <Button
            onClick={() => router.push('/dashboard/inventory-corrections/new')}
            variant="success"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Correction
          </Button>
        )}
      </div>

      {/* DevExtreme DataGrid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <DataGrid
          dataSource={corrections}
          showBorders={true}
          showRowLines={true}
          showColumnLines={false}
          rowAlternationEnabled={true}
          hoverStateEnabled={true}
          allowColumnReordering={true}
          allowColumnResizing={true}
          columnAutoWidth={true}
          wordWrapEnabled={false}
          onExporting={onExporting}
          onSelectionChanged={onSelectionChanged}
        >
          <LoadPanel enabled={loading} />
          <Selection mode="multiple" selectAllMode="page" showCheckBoxesMode="always" />
          <Scrolling mode="virtual" rowRenderingMode="virtual" />
          <Paging defaultPageSize={20} />
          <Pager
            visible={true}
            displayMode="full"
            showPageSizeSelector={true}
            allowedPageSizes={[10, 20, 50, 100]}
            showInfo={true}
            showNavigationButtons={true}
          />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <SearchPanel visible={true} width={240} placeholder="Search..." />
          <ColumnChooser enabled={true} mode="select" height={400}>
            <ColumnChooserSearch enabled={true} />
            <ColumnChooserSelection allowSelectAll={true} />
          </ColumnChooser>
          <Export enabled={true} allowExportSelectedData={true} />

          <Toolbar>
            <Item name="searchPanel" />
            <Item name="columnChooserButton" />
            <Item name="exportButton" />
          </Toolbar>

          <Column
            dataField="id"
            caption="ID"
            width={80}
            alignment="left"
          />

          <Column
            dataField="createdAt"
            caption="Date"
            dataType="date"
            format="MM/dd/yyyy"
            width={110}
          />

          <Column
            dataField="location.name"
            caption="Location"
            width={150}
          />

          <Column
            dataField="product.name"
            caption="Product"
            width={200}
          />

          <Column
            dataField="product.sku"
            caption="Product SKU"
            width={120}
          />

          <Column
            dataField="productVariation.name"
            caption="Variation"
            width={120}
          />

          <Column
            dataField="systemCount"
            caption="System"
            dataType="number"
            alignment="right"
            width={90}
          />

          <Column
            dataField="physicalCount"
            caption="Physical"
            dataType="number"
            alignment="right"
            width={90}
          />

          <Column
            dataField="difference"
            caption="Difference"
            dataType="number"
            alignment="right"
            width={100}
            cellRender={renderDifferenceCell}
          />

          <Column
            dataField="reason"
            caption="Reason"
            width={150}
            calculateCellValue={(data: InventoryCorrection) => getReasonLabel(data.reason)}
          />

          <Column
            dataField="status"
            caption="Status"
            width={110}
            cellRender={renderStatusCell}
          />

          <Column
            dataField="createdByUser.username"
            caption="Created By"
            width={130}
            calculateCellValue={(data: InventoryCorrection) =>
              data.createdByUser.firstName || data.createdByUser.username
            }
          />

          <Column
            caption="Actions"
            width={320}
            alignment="right"
            cellRender={renderActionsCell}
            allowFiltering={false}
            allowSorting={false}
            allowExporting={false}
          />
        </DataGrid>
      </div>

      {/* Password Confirmation Dialog */}
      <PasswordConfirmDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onConfirm={executeBulkApprove}
        title="Confirm Bulk Approval"
        description={`You are about to approve ${selectedIds.length} inventory correction(s). Please enter your password to confirm this action.`}
        actionLabel="Approve Selected"
      />
    </div>
  )
}
