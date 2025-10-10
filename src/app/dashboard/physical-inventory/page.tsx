'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'

interface Location {
  id: number
  name: string
}

interface ImportResult {
  message: string
  summary: {
    totalRows: number
    correctionsCreated: number
    skipped: number
    failed?: number
    validationErrors?: number
    errors?: string[]
  }
  corrections: Array<{
    id: number
    productId: number
    variationId: number
    systemCount: number
    physicalCount: number
    difference: number
    status: string
  }>
}

export default function PhysicalInventoryPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { can, user } = usePermissions()
  const [userLocation, setUserLocation] = useState<Location | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasMultipleLocations, setHasMultipleLocations] = useState(false)

  // Check permissions
  const canExport = can(PERMISSIONS.PHYSICAL_INVENTORY_EXPORT)
  const canImport = can(PERMISSIONS.PHYSICAL_INVENTORY_IMPORT)

  useEffect(() => {
    if (!canExport && !canImport) {
      router.push('/dashboard')
      return
    }

    // Check if user has access to multiple locations
    const accessibleLocationIds = getUserAccessibleLocationIds(user)

    // If null, user has access to ALL locations - BLOCK
    if (accessibleLocationIds === null) {
      setHasMultipleLocations(true)
      setError('Physical inventory count is not available for users with access to all locations. Please contact an administrator to assign you to a specific location.')
      return
    }

    // If more than one location - BLOCK
    if (accessibleLocationIds.length > 1) {
      setHasMultipleLocations(true)
      setError('Physical inventory count is only available for users assigned to a single location. You currently have access to multiple locations. Please contact an administrator.')
      return
    }

    // If exactly one location - ALLOW and fetch location details
    if (accessibleLocationIds.length === 1) {
      setHasMultipleLocations(false)
      fetchUserLocation(accessibleLocationIds[0])
    } else {
      setError('No location assigned to your account. Please contact an administrator.')
    }
  }, [canExport, canImport, user])

  const fetchUserLocation = async (locationId: number) => {
    try {
      const response = await fetch('/api/locations')
      if (response.ok) {
        const data = await response.json()
        const location = data.locations.find((loc: Location) => loc.id === locationId)
        if (location) {
          setUserLocation(location)
        } else {
          setError('Your assigned location could not be found')
        }
      }
    } catch (err) {
      console.error('Error fetching location:', err)
      setError('Failed to load your location')
    }
  }

  const handleExport = async () => {
    if (!userLocation) {
      setError('Location not loaded')
      return
    }

    setIsExporting(true)
    setError(null)

    try {
      const response = await fetch(`/api/physical-inventory/export?locationId=${userLocation.id}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Export failed')
      }

      // Download file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch ? filenameMatch[1] : `Physical_Inventory_${userLocation.name}_${new Date().toISOString().split('T')[0]}.xlsx`

      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to export physical inventory')
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setError('Please select an Excel file (.xlsx or .xls)')
        setSelectedFile(null)
        e.target.value = ''
        return
      }
      setSelectedFile(file)
      setError(null)
      setImportResult(null)
    }
  }

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Please select a file to import')
      return
    }

    if (!userLocation) {
      setError('Location not loaded')
      return
    }

    setIsImporting(true)
    setError(null)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('locationId', userLocation.id.toString())
      formData.append('reason', 'physical_inventory_count')

      const response = await fetch('/api/physical-inventory/import', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setImportResult(data)
      setSelectedFile(null)

      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err: any) {
      setError(err.message || 'Failed to import physical inventory')
    } finally {
      setIsImporting(false)
    }
  }

  // If user has multiple locations, show error message
  if (hasMultipleLocations) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-6">
          <div className="flex items-start">
            <svg className="h-6 w-6 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-yellow-800">Access Restricted</h3>
              <p className="mt-2 text-sm text-yellow-700">{error}</p>
              <p className="mt-3 text-sm text-yellow-700">
                <strong>Why this restriction?</strong> Physical inventory counting must be done location-by-location to prevent mistakes.
                Importing corrections to the wrong location could cause serious inventory discrepancies.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!userLocation) {
    return (
      <div className="p-8">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Physical Inventory Count</h1>
        <p className="text-gray-600 mt-2">Export, count, and import physical inventory for accurate stock levels</p>
      </div>

      {/* Location Display - Locked */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div className="ml-3">
            <p className="text-sm font-medium text-blue-800">Location: <span className="font-bold">{userLocation.name}</span></p>
            <p className="text-xs text-blue-600">This location is locked for security. You can only export/import for your assigned location.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-300 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Export Section */}
      {canExport && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 1: Export Current Stock</h2>
          <p className="text-gray-600 mb-4">
            Download an Excel template with current stock levels for <strong>{userLocation.name}</strong>
          </p>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? 'Exporting...' : 'Export Physical Inventory Template'}
          </button>
        </div>
      )}

      {/* Import Section */}
      {canImport && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 2: Import Counted Stock</h2>
          <p className="text-gray-600 mb-4">
            After counting physical stock, fill in the "Physical Count" column and upload the file
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Excel File
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={isImporting}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none disabled:opacity-50"
            />
            {selectedFile && (
              <p className="mt-2 text-sm text-gray-600">Selected: {selectedFile.name}</p>
            )}
          </div>

          <button
            onClick={handleImport}
            disabled={isImporting || !selectedFile}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? 'Importing...' : 'Import Physical Inventory'}
          </button>
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Results</h3>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Total Rows:</span> {importResult.summary.totalRows}
            </p>
            <p className="text-sm text-green-600">
              <span className="font-medium">Corrections Created:</span> {importResult.summary.correctionsCreated}
            </p>
            {importResult.summary.skipped > 0 && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Skipped (No Change):</span> {importResult.summary.skipped}
              </p>
            )}
            {importResult.summary.failed && importResult.summary.failed > 0 && (
              <p className="text-sm text-red-600">
                <span className="font-medium">Failed:</span> {importResult.summary.failed}
              </p>
            )}
          </div>

          {importResult.summary.errors && importResult.summary.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-red-700 mb-2">Errors:</p>
              <ul className="list-disc list-inside text-sm text-red-600 max-h-40 overflow-y-auto">
                {importResult.summary.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <button
              onClick={() => router.push('/dashboard/inventory-corrections')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
            >
              View Inventory Corrections →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
