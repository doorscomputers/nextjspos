'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { PasswordConfirmDialog } from '@/components/PasswordConfirmDialog'
import { MoreVertical, Plus, CheckCircle, Eye, Edit, Trash2, RefreshCw } from 'lucide-react'
import { useTableSort } from '@/hooks/useTableSort'
import { SortableTableHead } from '@/components/ui/sortable-table-head'

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
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLocation, setSelectedLocation] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkApproving, setBulkApproving] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const limit = 50

  // Check permission
  if (!can(PERMISSIONS.INVENTORY_CORRECTION_VIEW)) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">You do not have permission to view inventory corrections.</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetchLocations()
  }, [])

  useEffect(() => {
    fetchCorrections()
  }, [selectedLocation, selectedStatus, currentPage])

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations')
      if (res.ok) {
        const data = await res.json()
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchCorrections = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString()
      })

      if (selectedLocation !== 'all') {
        params.append('locationId', selectedLocation)
      }

      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus)
      }

      const res = await fetch(`/api/inventory-corrections?${params}`)

      if (res.ok) {
        const data = await res.json()
        setCorrections(data.corrections || [])
        setTotalPages(data.pagination?.totalPages || 1)
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

  // Add sorting
  const { sortedData, sortConfig, requestSort } = useTableSort(corrections, { key: 'id', direction: 'desc' })

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

  const toggleSelectAll = () => {
    const pendingCorrections = sortedData.filter(c => c.status === 'pending')
    if (selectedIds.length === pendingCorrections.length && pendingCorrections.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(pendingCorrections.map(c => c.id))
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const isAllSelected = () => {
    const pendingCorrections = sortedData.filter(c => c.status === 'pending')
    return pendingCorrections.length > 0 && selectedIds.length === pendingCorrections.length
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Pending</Badge>
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Approved</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      expired: 'Expired',
      damaged: 'Damaged',
      missing: 'Missing',
      found: 'Found',
      count_error: 'Count Error'
    }
    return labels[reason] || reason
  }

  const getDifferenceDisplay = (difference: number) => {
    if (difference > 0) {
      return <span className="text-green-600 font-medium">+{difference}</span>
    } else if (difference < 0) {
      return <span className="text-red-600 font-medium">{difference}</span>
    }
    return <span className="text-gray-600">0</span>
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Inventory Corrections</h1>
        <p className="text-gray-600 mt-2">Manage stock adjustments for expired, damaged, or missing items</p>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4">
            {/* Location Filter */}
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id.toString()}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh Button */}
            <Button
              variant="outline"
              onClick={() => fetchCorrections()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Bulk Action Buttons */}
          <div className="flex gap-2">
            {can(PERMISSIONS.INVENTORY_CORRECTION_DELETE) && selectedIds.length > 0 && (
              <Button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-50"
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
                className="bg-green-600 hover:bg-green-700 text-white"
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
          </div>

          {/* Add New Button */}
          {can(PERMISSIONS.INVENTORY_CORRECTION_CREATE) && (
            <Button
              onClick={() => router.push('/dashboard/inventory-corrections/new')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Correction
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-2 text-gray-600">Loading corrections...</p>
          </div>
        ) : sortedData.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600">No inventory corrections found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead className="w-[50px]">
                  <Checkbox
                    checked={isAllSelected()}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all pending corrections"
                  />
                </SortableTableHead>
                <SortableTableHead
                  sortKey="createdAt"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction}
                  onSort={requestSort}
                >
                  Date
                </SortableTableHead>
                <SortableTableHead
                  sortKey="location.name"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction}
                  onSort={requestSort}
                >
                  Location
                </SortableTableHead>
                <SortableTableHead
                  sortKey="product.name"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction}
                  onSort={requestSort}
                >
                  Product
                </SortableTableHead>
                <SortableTableHead
                  sortKey="productVariation.name"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction}
                  onSort={requestSort}
                >
                  Variation
                </SortableTableHead>
                <SortableTableHead
                  sortKey="systemCount"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction}
                  onSort={requestSort}
                  align="right"
                >
                  System
                </SortableTableHead>
                <SortableTableHead
                  sortKey="physicalCount"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction}
                  onSort={requestSort}
                  align="right"
                >
                  Physical
                </SortableTableHead>
                <SortableTableHead
                  sortKey="difference"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction}
                  onSort={requestSort}
                  align="right"
                >
                  Difference
                </SortableTableHead>
                <SortableTableHead
                  sortKey="reason"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction}
                  onSort={requestSort}
                >
                  Reason
                </SortableTableHead>
                <SortableTableHead
                  sortKey="status"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction}
                  onSort={requestSort}
                >
                  Status
                </SortableTableHead>
                <SortableTableHead
                  sortKey="createdByUser.username"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction}
                  onSort={requestSort}
                >
                  Created By
                </SortableTableHead>
                <SortableTableHead align="right">
                  Actions
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((correction) => (
                <TableRow key={correction.id}>
                  <TableCell>
                    {correction.status === 'pending' && (
                      <Checkbox
                        checked={selectedIds.includes(correction.id)}
                        onCheckedChange={() => toggleSelect(correction.id)}
                        aria-label={`Select correction #${correction.id}`}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(correction.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">{correction.location.name}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{correction.product.name}</div>
                      <div className="text-sm text-gray-500">{correction.product.sku}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="text-sm">{correction.productVariation.name}</div>
                      <div className="text-xs text-gray-500">{correction.productVariation.sku}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{correction.systemCount}</TableCell>
                  <TableCell className="text-right">{correction.physicalCount}</TableCell>
                  <TableCell className="text-right">{getDifferenceDisplay(correction.difference)}</TableCell>
                  <TableCell>
                    <span className="text-sm">{getReasonLabel(correction.reason)}</span>
                  </TableCell>
                  <TableCell>{getStatusBadge(correction.status)}</TableCell>
                  <TableCell className="text-sm">
                    {correction.createdByUser.firstName || correction.createdByUser.username}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/dashboard/inventory-corrections/${correction.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>

                        {correction.status === 'pending' && can(PERMISSIONS.INVENTORY_CORRECTION_APPROVE) && (
                          <DropdownMenuItem
                            onClick={() => handleApprove(correction.id)}
                            className="text-green-600"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </DropdownMenuItem>
                        )}

                        {correction.status === 'pending' && can(PERMISSIONS.INVENTORY_CORRECTION_UPDATE) && (
                          <DropdownMenuItem
                            onClick={() => router.push(`/dashboard/inventory-corrections/${correction.id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}

                        {correction.status === 'pending' && can(PERMISSIONS.INVENTORY_CORRECTION_DELETE) && (
                          <DropdownMenuItem
                            onClick={() => handleDelete(correction.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

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
