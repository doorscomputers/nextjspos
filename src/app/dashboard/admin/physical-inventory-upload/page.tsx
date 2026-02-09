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
  XCircleIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

interface PreviewUpdate {
  locationName: string
  itemCode: string
  productId: number
  productName: string
  variationName: string
  previousStock: number
  newStock: number
  difference: number
  type: 'update'
}

interface PreviewVerified {
  locationName: string
  itemCode: string
  productId: number
  productName: string
  variationName: string
  verifiedStock: number
  type: 'verified'
}

interface PreviewResult {
  success: boolean
  preview: boolean
  message: string
  summary: {
    totalRows: number
    itemsToUpdate: number
    itemsVerified: number
    locationsAffected: string[]
    hasDiscrepancies: boolean
  }
  previewUpdates: PreviewUpdate[]
  previewVerified: PreviewVerified[]
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
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
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

  // Step 1: Preview what will be changed
  const handlePreview = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload')
      return
    }

    setIsUploading(true)
    setError(null)
    setUploadResult(null)
    setPreviewResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('preview', 'true')

      const response = await fetch('/api/admin/physical-inventory-upload', {
        method: 'POST',
        headers: {
          'Idempotency-Key': `preview-${idempotencyKey}`
        },
        body: formData
      })

      // Handle 413 Payload Too Large
      if (response.status === 413) {
        setError(`File too large (${(selectedFile.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 4.5 MB. Please split your Excel file into smaller parts.`)
        return
      }

      // Try to parse JSON, handle invalid responses
      let data
      try {
        data = await response.json()
      } catch (parseError) {
        setError(`Server error: ${response.status} ${response.statusText}. Please try again.`)
        return
      }

      if (data.success && data.preview) {
        setPreviewResult(data)
        // If there are discrepancies, require confirmation
        if (data.summary.hasDiscrepancies) {
          setIsConfirming(true)
        } else {
          // No discrepancies, just verified items - auto-apply
          await handleConfirmUpload()
        }
      } else {
        // Validation error
        setUploadResult(data)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to preview physical inventory')
    } finally {
      setIsUploading(false)
    }
  }

  // Step 2: Confirm and apply the changes
  const handleConfirmUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      // No preview flag = actual update

      const response = await fetch('/api/admin/physical-inventory-upload', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey
        },
        body: formData
      })

      const data = await response.json()

      setUploadResult(data)
      setPreviewResult(null)
      setIsConfirming(false)

      if (data.success) {
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        generateNewIdempotencyKey()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload physical inventory')
    } finally {
      setIsUploading(false)
    }
  }

  // Cancel preview and go back
  const handleCancelPreview = () => {
    setPreviewResult(null)
    setIsConfirming(false)
  }

  const handleRetry = () => {
    // Keep the same idempotency key for retry (in case of network failure)
    handlePreview()
  }

  const handleExportPDF = () => {
    if (!uploadResult?.success) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })

    // Header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Physical Inventory Verification Report', pageWidth / 2, 20, { align: 'center' })

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${today}`, pageWidth / 2, 28, { align: 'center' })

    // Summary Section
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Summary', 14, 40)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const summary = uploadResult.summary
    doc.text([
      `Total Rows Processed: ${summary?.totalRows || 0}`,
      `Items Updated (Discrepancies): ${summary?.itemsUpdated || 0}`,
      `Items Verified (Counts Match): ${summary?.itemsVerified || 0}`,
      `Location: ${summary?.locationsAffected?.join(', ') || 'N/A'}`
    ], 14, 48)

    let currentY = 72

    // Updated Items Table (Discrepancies)
    if (uploadResult.updatedDetails && uploadResult.updatedDetails.length > 0) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(234, 88, 12) // Orange
      doc.text('Updated Items (Discrepancies Found)', 14, currentY)
      doc.setTextColor(0, 0, 0)

      const updatedData = uploadResult.updatedDetails.map(item => [
        item.locationName,
        item.itemCode,
        item.productName.substring(0, 35) + (item.productName.length > 35 ? '...' : ''),
        item.previousStock.toString(),
        item.newStock.toString(),
        (item.difference > 0 ? '+' : '') + item.difference.toString()
      ])

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Location', 'Item Code', 'Product', 'Previous', 'New', 'Change']],
        body: updatedData,
        theme: 'grid',
        headStyles: { fillColor: [234, 88, 12], fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 28 },
          2: { cellWidth: 60 },
          3: { cellWidth: 18, halign: 'right' },
          4: { cellWidth: 18, halign: 'right' },
          5: { cellWidth: 18, halign: 'right' }
        },
        margin: { left: 14, right: 14 }
      })

      currentY = (doc as any).lastAutoTable.finalY + 10
    }

    // Verified Items Table
    if (uploadResult.verifiedDetails && uploadResult.verifiedDetails.length > 0) {
      // Check if need new page
      if (currentY > 240) {
        doc.addPage()
        currentY = 20
      }

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(22, 163, 74) // Green
      doc.text('Verified Items (Counts Match)', 14, currentY)
      doc.setTextColor(0, 0, 0)

      const verifiedData = uploadResult.verifiedDetails.map(item => [
        item.locationName,
        item.itemCode,
        item.productName.substring(0, 40) + (item.productName.length > 40 ? '...' : ''),
        item.verifiedStock.toString(),
        'Verified'
      ])

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Location', 'Item Code', 'Product', 'Stock', 'Status']],
        body: verifiedData,
        theme: 'grid',
        headStyles: { fillColor: [22, 163, 74], fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 28 },
          2: { cellWidth: 70 },
          3: { cellWidth: 20, halign: 'right' },
          4: { cellWidth: 22, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      })
    }

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )
    }

    // Save PDF
    const filename = `Physical_Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(filename)
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
              onClick={handlePreview}
              disabled={isUploading || !selectedFile || isConfirming}
              className="gap-2"
            >
              {isUploading ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <DocumentArrowUpIcon className="h-4 w-4" />
              )}
              {isUploading ? 'Processing...' : 'Preview & Validate'}
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Confirmation Section */}
      {previewResult && isConfirming && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg shadow-sm border border-yellow-300 dark:border-yellow-800 p-6 mb-6">
          <div className="flex items-start mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200">
                Confirmation Required - Discrepancies Found
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                {previewResult.summary.itemsToUpdate} item(s) have different counts than the system.
                Review the changes below before applying.
              </p>
            </div>
          </div>

          {/* Preview Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Total Rows</p>
                <p className="font-medium text-gray-900 dark:text-white">{previewResult.summary.totalRows}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">To Update</p>
                <p className="font-medium text-orange-600 dark:text-orange-400">{previewResult.summary.itemsToUpdate}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Verified (Match)</p>
                <p className="font-medium text-green-600 dark:text-green-400">{previewResult.summary.itemsVerified}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Locations</p>
                <p className="font-medium text-gray-900 dark:text-white">{previewResult.summary.locationsAffected.length}</p>
              </div>
            </div>
          </div>

          {/* Discrepancies Table */}
          {previewResult.previewUpdates.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 overflow-x-auto mb-4">
              <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-2">
                Items to be Updated (Discrepancies)
              </h4>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Location</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Item Code</th>
                    <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Product</th>
                    <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400">System Stock</th>
                    <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400">Physical Count</th>
                    <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {previewResult.previewUpdates.map((item, idx) => (
                    <tr key={idx} className="border-b dark:border-gray-700">
                      <td className="py-2 px-2 text-gray-900 dark:text-white">{item.locationName}</td>
                      <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{item.itemCode}</td>
                      <td className="py-2 px-2 text-gray-900 dark:text-white">{item.productName}</td>
                      <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-400">{item.previousStock}</td>
                      <td className="py-2 px-2 text-right font-medium text-blue-600 dark:text-blue-400">{item.newStock}</td>
                      <td className={`py-2 px-2 text-right font-medium ${
                        item.difference > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {item.difference > 0 ? '+' : ''}{item.difference}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="success"
              onClick={handleConfirmUpload}
              disabled={isUploading}
              className="gap-2"
            >
              {isUploading ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircleIcon className="h-4 w-4" />
              )}
              {isUploading ? 'Applying...' : 'Confirm & Apply Changes'}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelPreview}
              disabled={isUploading}
              className="gap-2"
            >
              <XCircleIcon className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}

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
                  Location: {uploadResult.summary.locationsAffected.join(', ')}
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

          {/* Action Buttons for Success */}
          {uploadResult.success && (
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={handleExportPDF}
                className="gap-2 hover:border-red-500 hover:text-red-700 dark:hover:text-red-400"
              >
                <DocumentTextIcon className="h-4 w-4" />
                Export PDF Report
              </Button>
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
