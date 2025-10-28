'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Button as UiButton } from '@/components/ui/button'
import DataGrid, {
  Column,
  Export,
  FilterRow,
  HeaderFilter,
  Paging,
  SearchPanel,
  ColumnChooser,
  ColumnFixing,
  StateStoring,
  LoadPanel,
  Scrolling,
  Selection,
  Toolbar,
  Item
} from 'devextreme-react/data-grid'
import Button from 'devextreme-react/button'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'

interface User {
  id: number
  username: string
  email: string | null
  surname: string
  firstName: string
  lastName: string | null
  allowLogin: boolean
  roles: string[]
  locations: string[]
  createdAt: string
  fullName?: string
  rolesDisplay?: string
  statusDisplay?: string
  locationsDisplay?: string
}

export default function UsersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const dataGridRef = useRef<any>(null)

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<{id: number, username: string} | null>(null)
  const [resetResult, setResetResult] = useState<{username: string, password: string} | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      console.log('[Users Page] Fetching users...')

      const res = await fetch('/api/users')

      if (!res.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await res.json()

      // Transform data for DataGrid display
      const transformedData = (data.data || data).map((user: User) => ({
        ...user,
        fullName: `${user.surname} ${user.firstName} ${user.lastName || ''}`.trim(),
        rolesDisplay: user.roles.join(', '),
        locationsDisplay: user.locations.join(', '),
        statusDisplay: user.allowLogin ? 'Active' : 'Inactive'
      }))

      console.log('[Users Page] Users fetched:', transformedData.length)
      setUsers(transformedData)
      toast.success('Users loaded successfully')
    } catch (err) {
      console.error('[Users Page] Error fetching users:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (userId: number) => {
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete user')
      }

      setDeleteConfirm(null)
      toast.success('User deleted successfully')
      fetchUsers()
    } catch (err) {
      console.error('[Users Page] Error deleting user:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const handleResetPassword = async (userId: number) => {
    try {
      const res = await fetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reset password')
      }

      const result = await res.json()
      if (result.temporaryPassword) {
        setResetResult({
          username: result.username,
          password: result.temporaryPassword
        })
        toast.success('Password reset successfully!')
      } else {
        toast.success('Password reset successfully!')
      }
      setResetPasswordUser(null)
    } catch (err) {
      console.error('[Users Page] Error resetting password:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to reset password')
    }
  }

  // Excel Export
  const onExportExcel = useCallback(() => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Users')

    exportToExcel({
      component: dataGridRef.current?.instance,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        // Customize Excel cell styling if needed
        if (gridCell.rowType === 'header') {
          excelCell.font = { bold: true }
          excelCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
          }
          excelCell.font.color = { argb: 'FFFFFFFF' }
        }
      }
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Users_${new Date().toISOString().split('T')[0]}.xlsx`
        )
      })
    })
    toast.success('Exporting to Excel...')
  }, [])

  // PDF Export
  const onExportPdf = useCallback(() => {
    const doc = new jsPDF('landscape')

    // Add header
    doc.setFontSize(18)
    doc.text('User Management Report', 14, 20)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)

    exportToPDF({
      jsPDFDocument: doc,
      component: dataGridRef.current?.instance,
      topLeft: { x: 14, y: 35 }
    }).then(() => {
      doc.save(`Users_${new Date().toISOString().split('T')[0]}.pdf`)
    })
    toast.success('Exporting to PDF...')
  }, [])

  // Custom cell render for Roles
  const renderRolesCell = (cellData: any) => {
    const roles = cellData.data.roles || []
    return (
      <div className="flex flex-wrap gap-1 py-1">
        {roles.map((role: string, idx: number) => (
          <span
            key={idx}
            className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
          >
            {role}
          </span>
        ))}
      </div>
    )
  }

  // Custom cell render for Locations
  const renderLocationsCell = (cellData: any) => {
    const locations = cellData.data.locations || []
    return (
      <div className="flex flex-wrap gap-1 py-1">
        {locations.map((location: string, idx: number) => (
          <span
            key={idx}
            className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
          >
            {location}
          </span>
        ))}
      </div>
    )
  }

  // Custom cell render for Status
  const renderStatusCell = (cellData: any) => {
    const isActive = cellData.data.allowLogin
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded ${
          isActive
            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
        }`}
      >
        {isActive ? 'Active' : 'Inactive'}
      </span>
    )
  }

  // Custom cell render for Actions
  const renderActionsCell = (cellData: any) => {
    const user = cellData.data
    return (
      <div className="flex justify-end gap-2">
        <Button
          text="Edit"
          type="default"
          icon="edit"
          onClick={() => router.push(`/dashboard/users/${user.id}/edit`)}
          stylingMode="contained"
          className="dx-button-small"
        />
        <Button
          text="Reset"
          type="normal"
          icon="key"
          onClick={() => setResetPasswordUser({id: user.id, username: user.username})}
          stylingMode="contained"
          className="dx-button-small"
        />
        {deleteConfirm === user.id ? (
          <div className="inline-flex gap-1">
            <Button
              text="Confirm"
              type="danger"
              icon="check"
              onClick={() => handleDelete(user.id)}
              stylingMode="contained"
              className="dx-button-small"
            />
            <Button
              text="Cancel"
              type="normal"
              icon="close"
              onClick={() => setDeleteConfirm(null)}
              stylingMode="outlined"
              className="dx-button-small"
            />
          </div>
        ) : (
          <Button
            text="Delete"
            type="danger"
            icon="trash"
            onClick={() => setDeleteConfirm(user.id)}
            stylingMode="contained"
            className="dx-button-small"
          />
        )}
      </div>
    )
  }

  // Custom cell render for Created Date
  const renderDateCell = (cellData: any) => {
    return new Date(cellData.value).toLocaleDateString()
  }

  return (
    <div className="p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage system users and their access</p>
        </div>
        <div className="flex gap-3">
          <Button
            text="Refresh"
            type="normal"
            icon={loading ? "spin" : "refresh"}
            onClick={fetchUsers}
            disabled={loading}
            stylingMode="contained"
            className="flex items-center gap-2"
          />
          <Button
            text="Add User"
            type="default"
            icon="add"
            onClick={() => router.push('/dashboard/users/new')}
            stylingMode="contained"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">All Users</h2>
          <div className="flex gap-2">
            <Button
              onClick={onExportExcel}
              variant="outline"
              size="sm"
              className="font-medium"
            >
              Export to Excel
            </Button>
            <Button
              onClick={onExportPdf}
              variant="outline"
              size="sm"
              className="font-medium"
            >
              Export to PDF
            </Button>
          </div>
        </div>

        <DataGrid
          ref={dataGridRef}
          dataSource={users}
          showBorders={true}
          columnAutoWidth={false}
          width="100%"
          allowColumnReordering={true}
          allowColumnResizing={true}
          rowAlternationEnabled={true}
          hoverStateEnabled={true}
          className="dx-card wide-card"
        >
          <LoadPanel enabled={loading} />
          <SearchPanel visible={true} width={240} placeholder="Search users..." />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <ColumnChooser enabled={true} mode="select" />
          <ColumnFixing enabled={true} />
          <Scrolling mode="standard" />
          <Paging defaultPageSize={20} />

          <StateStoring
            enabled={true}
            type="localStorage"
            storageKey="usersDataGridState"
          />

          <Column
            dataField="fullName"
            caption="Name"
            minWidth={150}
          />

          <Column
            dataField="username"
            caption="Username"
            minWidth={120}
          />

          <Column
            dataField="email"
            caption="Email"
            minWidth={180}
          />

          <Column
            dataField="locationsDisplay"
            caption="Locations"
            minWidth={150}
            cellRender={renderLocationsCell}
            allowFiltering={true}
            allowSorting={true}
          />

          <Column
            dataField="roles"
            caption="Roles"
            minWidth={150}
            cellRender={renderRolesCell}
            allowFiltering={false}
            allowSorting={false}
          />

          <Column
            dataField="allowLogin"
            caption="Status"
            width={100}
            cellRender={renderStatusCell}
            alignment="center"
          />

          <Column
            dataField="createdAt"
            caption="Created"
            width={120}
            dataType="date"
            cellRender={renderDateCell}
          />

          <Column
            caption="Actions"
            width={320}
            cellRender={renderActionsCell}
            allowFiltering={false}
            allowSorting={false}
            allowExporting={false}
            fixed={true}
            fixedPosition="right"
          />
        </DataGrid>
      </div>

      {/* Reset Password Confirmation Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700 shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">Reset Password</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to reset the password for user <strong className="text-gray-900 dark:text-gray-100">{resetPasswordUser.username}</strong>?
              <br /><br />
              A new temporary password will be generated and displayed to you.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                text="Cancel"
                type="normal"
                onClick={() => setResetPasswordUser(null)}
                stylingMode="outlined"
              />
              <Button
                text="Reset Password"
                type="default"
                icon="key"
                onClick={() => handleResetPassword(resetPasswordUser.id)}
                stylingMode="contained"
              />
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Result Modal */}
      {resetResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 border border-gray-200 dark:border-gray-700 shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-green-600 dark:text-green-400">Password Reset Successful!</h3>
            <div className="bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-200 dark:border-yellow-600 rounded p-4 mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 font-semibold mb-2">
                ⚠️ Important: Copy this password now!
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                This temporary password will only be shown once. Save it securely.
              </p>
            </div>
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono text-sm text-gray-900 dark:text-gray-100">
                  {resetResult.username}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temporary Password</label>
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono text-sm break-all text-gray-900 dark:text-gray-100">
                  {resetResult.password}
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                text="Copy to Clipboard"
                type="normal"
                icon="copy"
                onClick={() => {
                  navigator.clipboard.writeText(`Username: ${resetResult.username}\nPassword: ${resetResult.password}`)
                  toast.success('Copied to clipboard!')
                }}
                stylingMode="contained"
              />
              <Button
                text="Close"
                type="default"
                icon="close"
                onClick={() => setResetResult(null)}
                stylingMode="contained"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
