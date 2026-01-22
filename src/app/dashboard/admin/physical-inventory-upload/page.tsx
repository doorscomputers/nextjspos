'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import {
  DocumentArrowUpIcon,
  DocumentArrowDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'

interface Location {
  id: number
  name: string
}

interface InvalidBranch {
  row: number
  providedName: string
  suggestion?: string
}

interface UpdateDetail {
  correctionId: number
  stockTransactionId: number
  locationName: string
  productId: number
  productName: string
  variationName: string
  itemCode: string
  previousStock: number
  newStock: number
  difference: number
  type: 'updated'
}

interface VerifiedDetail {
  correctionId: number
  locationName: string
  productId: number
  productName: string
  variationName: string
  itemCode: string
  verifiedStock: number
  type: 'verified'
}

interface UploadResult {
  success: boolean
  message: string
  summary?: {
    totalRows: number
    itemsUpdated: number
    itemsVerified: number
    locationsAffected: string[]
    atomicTransaction: boolean
  }
  updatedDetails?: UpdateDetail[]
  verifiedDetails?: VerifiedDetail[]
  error?: string
  invalidBranches?: InvalidBranch[]
  validBranches?: string[]
  productErrors?: string[]
}

export default function AdminPhysicalInventoryUploadPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { can, user } = usePermissions()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState<string>('')

  const canUpload = can(PERMISSIONS.ADMIN_PHYSICAL_INVENTORY_UPLOAD)

  useEffect(() => {
    if (!canUpload) {
      router.push('/dashboard')
      return
    }
    fetchLocations()
    // Generate new idempotency key on mount
    generateNewIdempotencyKey()
  }, [canUpload])

  const generateNewIdempotencyKey = () => {
    setIdempotencyKey(`${Date.now()}-${Math.random().toString(36).substring(2, 15)}`)
  }

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      if (response.ok) {
        const data = await response.json()
        setLocations(data.locations || [])
      }
    } catch (err) {
      console.error('Error fetching locations:', err)
      setError('Failed to load locations')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportTemplate = async () => {
    setIsExporting(true)
    setError(null)

    try {
      const url = selectedLocationId
        ? `/api/admin/physical-inventory-upload/export?locationId=${selectedLocationId}`
        : '/api/admin/physical-inventory-upload/export?all=true'

      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Export failed')
      }

      // Download file
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl

      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch ? filenameMatch[1] : `Physical_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`

      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err: any) {
      setError(err.message || 'Failed to export template')
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setError('Please select an Excel file (.xlsx or .xls)')
        setSelectedFile(null)
        e.target.value = ''
        return
      }
      setSelectedFile(file)
      setError(null)
      setUploadResult(null)
      // Generate new idempotency key for new file
      generateNewIdempotencyKey()
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload')
      return
    }

    setIsUploading(true)
    setError(null)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/admin/physical-inventory-upload', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey
        },
        body: formData
      })

      const data = await response.json()

      setUploadResult(data)

      if (data.success) {
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        // Generate new key for next upload
        generateNewIdempotencyKey()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload physical inventory')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRetry = () => {
    // Keep the same idempotency key for retry (in case of network failure)
    handleUpload()
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Physical Inventory Upload</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Upload physical inventory counts for any location. The system will update stock and record history for each item.
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start">
          <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">Expected Excel Format</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Your Excel file must have these columns: <strong>DATE, BRANCH, ITEM CODE, ITEM NAME, ACTUAL COUNT</strong>
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              <strong>BRANCH</strong> must match exactly with your location names. <strong>ITEM CODE</strong> must match the product SKU.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            <p className="ml-3 text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Export Template Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Step 1: Export Template (Optional)</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Download a template with current inventory data. Fill in the ACTUAL COUNT column after counting.
        </p>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Location (optional - leave empty for all)
            </label>
            <select
              value={selectedLocationId || ''}
              onChange={(e) => setSelectedLocationId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            onClick={handleExportTemplate}
            disabled={isExporting}
            className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400"
          >
            {isExporting ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <DocumentArrowDownIcon className="h-4 w-4" />
            )}
            {isExporting ? 'Exporting...' : 'Export Template'}
          </Button>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Step 2: Upload Physical Inventory</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Upload your Excel file with physical counts. All branch names must match your locations exactly.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Excel File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={isUploading}
              className="block w-full text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none disabled:opacity-50 file:mr-4 file:py-2 file:px-4 file:rounded-l-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300 hover:file:bg-blue-100"
            />
            {selectedFile && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Selected: <span className="font-medium">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <Button
              variant="success"
              onClick={handleUpload}
              disabled={isUploading || !selectedFile}
              className="gap-2"
            >
              {isUploading ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <DocumentArrowUpIcon className="h-4 w-4" />
              )}
              {isUploading ? 'Uploading...' : 'Upload & Update Inventory'}
            </Button>
          </div>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className={`rounded-lg shadow-sm border p-6 ${
          uploadResult.success
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-start mb-4">
            {uploadResult.success ? (
              <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            ) : (
              <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
            )}
            <div className="ml-3">
              <h3 className={`text-lg font-semibold ${
                uploadResult.success
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-red-800 dark:text-red-200'
              }`}>
                {uploadResult.success ? 'Upload Successful' : 'Upload Failed'}
              </h3>
              <p className={`text-sm ${
                uploadResult.success
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {uploadResult.message}
              </p>
            </div>
          </div>

          {/* Success Summary */}
          {uploadResult.success && uploadResult.summary && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Total Rows</p>
                  <p className="font-medium text-gray-900 dark:text-white">{uploadResult.summary.totalRows}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Items Updated</p>
                  <p className="font-medium text-orange-600 dark:text-orange-400">{uploadResult.summary.itemsUpdated}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Items Verified</p>
                  <p className="font-medium text-green-600 dark:text-green-400">{uploadResult.summary.itemsVerified}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Locations</p>
                  <p className="font-medium text-gray-900 dark:text-white">{uploadResult.summary.locationsAffected?.length || 0}</p>
                </div>
              </div>
              {uploadResult.summary.locationsAffected && uploadResult.summary.locationsAffected.length > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Locations: {uploadResult.summary.locationsAffected.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Updated Items Table (Discrepancies) */}
          {uploadResult.success && uploadResult.updatedDetails && uploadResult.updatedDetails.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 overflow-x-auto mb-4">
              <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-2">
                Updated Items (Discrepancies Found)
              </h4>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Location</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Item Code</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Product</th>
                    <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400">Previous</th>
                    <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400">New</th>
                    <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadResult.updatedDetails.slice(0, 20).map((item, idx) => (
                    <tr key={idx} className="border-b dark:border-gray-700">
                      <td className="py-2 px-2 text-gray-900 dark:text-white">{item.locationName}</td>
                      <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{item.itemCode}</td>
                      <td className="py-2 px-2 text-gray-900 dark:text-white">{item.productName}</td>
                      <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-400">{item.previousStock}</td>
                      <td className="py-2 px-2 text-right font-medium text-gray-900 dark:text-white">{item.newStock}</td>
                      <td className={`py-2 px-2 text-right font-medium ${
                        item.difference > 0
                          ? 'text-green-600 dark:text-green-400'
                          : item.difference < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {item.difference > 0 ? '+' : ''}{item.difference}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {uploadResult.updatedDetails.length > 20 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Showing first 20 of {uploadResult.updatedDetails.length} updated items
                </p>
              )}
            </div>
          )}

          {/* Verified Items Table (Counts Match) */}
          {uploadResult.success && uploadResult.verifiedDetails && uploadResult.verifiedDetails.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 overflow-x-auto mb-4">
              <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
                Verified Items (Counts Match)
              </h4>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Location</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Item Code</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Product</th>
                    <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400">Verified Stock</th>
                    <th className="text-center py-2 px-2 text-gray-600 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadResult.verifiedDetails.slice(0, 20).map((item, idx) => (
                    <tr key={idx} className="border-b dark:border-gray-700">
                      <td className="py-2 px-2 text-gray-900 dark:text-white">{item.locationName}</td>
                      <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{item.itemCode}</td>
                      <td className="py-2 px-2 text-gray-900 dark:text-white">{item.productName}</td>
                      <td className="py-2 px-2 text-right font-medium text-gray-900 dark:text-white">{item.verifiedStock}</td>
                      <td className="py-2 px-2 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          Verified
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {uploadResult.verifiedDetails.length > 20 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Showing first 20 of {uploadResult.verifiedDetails.length} verified items
                </p>
              )}
            </div>
          )}

          {/* Invalid Branches Error */}
          {!uploadResult.success && uploadResult.invalidBranches && uploadResult.invalidBranches.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">Invalid Branch Names</h4>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Row</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Provided Name</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Suggestion</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadResult.invalidBranches.map((item, idx) => (
                    <tr key={idx} className="border-b dark:border-gray-700">
                      <td className="py-2 px-2 text-gray-900 dark:text-white">{item.row}</td>
                      <td className="py-2 px-2 text-red-600 dark:text-red-400">{item.providedName}</td>
                      <td className="py-2 px-2 text-green-600 dark:text-green-400">{item.suggestion || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {uploadResult.validBranches && uploadResult.validBranches.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Valid branch names:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{uploadResult.validBranches.join(', ')}</p>
                </div>
              )}
            </div>
          )}

          {/* Product Errors */}
          {!uploadResult.success && uploadResult.productErrors && uploadResult.productErrors.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">Product Errors</h4>
              <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 max-h-40 overflow-y-auto">
                {uploadResult.productErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Retry Button for Failed Uploads */}
          {!uploadResult.success && (
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={handleRetry}
                disabled={isUploading || !selectedFile}
                className="gap-2"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Retry Upload
              </Button>
            </div>
          )}

          {/* View Corrections Link */}
          {uploadResult.success && (
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/inventory-corrections')}
                className="gap-2"
              >
                View Inventory Corrections
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
