"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, ArrowLeft, Eye, ArrowUp, ArrowDown, Minus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"

interface PreviewItem {
  row: number
  itemName: string
  oldPrice: number
  newPrice: number
  priceDifference: number
  productId: number
  variationIds: number[]
  status: 'will_update' | 'no_change'
}

interface PreviewResult {
  preview: PreviewItem[]
  errors: Array<{
    row: number
    itemName?: string
    error: string
  }>
  summary: {
    totalRows: number
    willUpdate: number
    noChange: number
    errorCount: number
    locationsCount: number
  }
}

interface ImportResult {
  updated: Array<{
    row: number
    itemName: string
    newPrice: number
    locationsUpdated: number
    variationsUpdated: number
  }>
  errors: Array<{
    row: number
    itemName?: string
    error: string
  }>
  summary: {
    totalRows: number
    successCount: number
    errorCount: number
    locationsUpdated: number
  }
}

type ViewMode = 'upload' | 'preview' | 'result'

export default function BulkPriceImportPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")

  const [viewMode, setViewMode] = useState<ViewMode>('upload')
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const fileName = selectedFile.name.toLowerCase()
      if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        setError("Please select a CSV or Excel (.xlsx) file")
        setFile(null)
        return
      }
      setFile(selectedFile)
      setError("")
      setPreviewData(null)
      setImportResult(null)
      setViewMode('upload')
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/products/bulk-price-import')
      if (!response.ok) throw new Error('Failed to download template')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'bulk-price-import-template.xlsx'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Template downloaded successfully')
    } catch (error) {
      setError('Failed to download template')
      toast.error('Failed to download template')
    }
  }

  const handlePreview = async () => {
    if (!file) {
      setError("Please select a file first")
      return
    }

    setLoading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('preview', 'true')

      const response = await fetch('/api/products/bulk-price-import', {
        method: 'POST',
        body: formData,
      })

      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Non-JSON response:', text)
        throw new Error('Server error: ' + (text.substring(0, 100) || 'Unknown error'))
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to preview prices')
      }

      setPreviewData(data.data)
      setViewMode('preview')
      toast.success('Preview loaded - Review changes before applying')

    } catch (error: any) {
      setError(error.message || 'An unexpected error occurred')
      toast.error(error.message || 'Failed to preview prices')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!file) {
      setError("File not found. Please upload again.")
      return
    }

    setLoading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append('file', file)
      // No preview flag = actual import

      const response = await fetch('/api/products/bulk-price-import', {
        method: 'POST',
        body: formData,
      })

      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Non-JSON response:', text)
        throw new Error('Server error: ' + (text.substring(0, 100) || 'Unknown error'))
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import prices')
      }

      setImportResult(data.data)
      setViewMode('result')
      setFile(null)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      if (data.data.summary.successCount > 0) {
        toast.success(`Successfully updated ${data.data.summary.successCount} products!`)
      }
      if (data.data.summary.errorCount > 0) {
        toast.error(`${data.data.summary.errorCount} products failed to update`)
      }

    } catch (error: any) {
      setError(error.message || 'An unexpected error occurred')
      toast.error(error.message || 'Failed to import prices')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setViewMode('upload')
    setPreviewData(null)
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleStartOver = () => {
    setViewMode('upload')
    setPreviewData(null)
    setImportResult(null)
    setFile(null)
    setError("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatPrice = (price: number) => {
    return `₱${price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bulk Price Import</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Upload a CSV or Excel file to update product prices for all locations
          </p>
        </div>
        <Button
          onClick={() => router.push('/dashboard/products')}
          variant="outline"
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* UPLOAD VIEW */}
      {viewMode === 'upload' && (
        <>
          {/* Instructions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                File Format Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <p className="mb-3">Your CSV or Excel file must have the following columns:</p>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Column</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">1</TableCell>
                      <TableCell>
                        <span className="font-semibold">Item Name</span>
                        <span className="text-red-600 ml-1">(Required)</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        Exact product name as it appears in the system (case-insensitive match)
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">2</TableCell>
                      <TableCell>
                        <span className="font-semibold">New Selling Price</span>
                        <span className="text-red-600 ml-1">(Required)</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        New price to apply (e.g., 2934.00 or 2,934.00). This price will be applied to ALL business locations.
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <strong>Safety Note:</strong> After uploading, you will see a PREVIEW of all changes before they are applied.
                  You can review old vs new prices and confirm only when you're ready.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload File</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Browse...
                </label>
                <input
                  id="file-upload"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">
                  {file ? (
                    <span className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-green-600" />
                      {file.name}
                    </span>
                  ) : (
                    'No file selected (.csv or .xlsx)'
                  )}
                </span>
                <Button
                  onClick={handlePreview}
                  disabled={!file || loading}
                  variant="default"
                  className="gap-2"
                >
                  {loading ? (
                    <>
                      <span className="animate-spin">&#8987;</span>
                      Loading...
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Preview Changes
                    </>
                  )}
                </Button>
              </div>

              <div className="pt-2 border-t">
                <Button
                  onClick={handleDownloadTemplate}
                  variant="outline"
                  className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400"
                >
                  <Download className="w-4 h-4" />
                  Download Template File
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* PREVIEW VIEW */}
      {viewMode === 'preview' && previewData && (
        <Card>
          <CardHeader className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Eye className="w-5 h-5" />
              Preview - Review Changes Before Applying
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <FileSpreadsheet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300">Total Rows</p>
                  <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{previewData.summary.totalRows}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-xs text-green-700 dark:text-green-300">Will Update</p>
                  <p className="text-xl font-bold text-green-900 dark:text-green-100">{previewData.summary.willUpdate}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <Minus className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="text-xs text-gray-700 dark:text-gray-300">No Change</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{previewData.summary.noChange}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-xs text-red-700 dark:text-red-300">Errors</p>
                  <p className="text-xl font-bold text-red-900 dark:text-red-100">{previewData.summary.errorCount}</p>
                </div>
              </div>
            </div>

            {/* Preview Table */}
            {previewData.preview.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Price Changes Preview ({previewData.preview.length} products)
                </h3>
                <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">Current Price</TableHead>
                        <TableHead className="text-right">New Price</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.preview.map((item, index) => (
                        <TableRow key={index} className={item.status === 'no_change' ? 'opacity-50' : ''}>
                          <TableCell>{item.row}</TableCell>
                          <TableCell className="font-medium">{item.itemName}</TableCell>
                          <TableCell className="text-right text-gray-600 dark:text-gray-400">
                            {formatPrice(item.oldPrice)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPrice(item.newPrice)}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.priceDifference !== 0 ? (
                              <span className={`flex items-center justify-end gap-1 ${
                                item.priceDifference > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                              }`}>
                                {item.priceDifference > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                {formatPrice(Math.abs(item.priceDifference))}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.status === 'will_update' ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                Will Update
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                No Change
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Errors */}
            {previewData.errors.length > 0 && (
              <div>
                <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                  Errors ({previewData.errors.length}) - These will be skipped
                </h3>
                <div className="overflow-x-auto max-h-48 overflow-y-auto border border-red-200 dark:border-red-800 rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-red-50 dark:bg-red-950">
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.errors.map((err, index) => (
                        <TableRow key={index}>
                          <TableCell>{err.row}</TableCell>
                          <TableCell>{err.itemName || 'N/A'}</TableCell>
                          <TableCell className="text-red-600 dark:text-red-400">{err.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Location Info */}
            <Alert className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
              <AlertCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <AlertDescription className="text-purple-800 dark:text-purple-200">
                Prices will be updated across <strong>{previewData.summary.locationsCount} location(s)</strong>.
              </AlertDescription>
            </Alert>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button
                onClick={handleCancel}
                variant="outline"
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmImport}
                variant="success"
                className="flex-1 gap-2"
                disabled={loading || previewData.summary.willUpdate === 0}
              >
                {loading ? (
                  <>
                    <span className="animate-spin">&#8987;</span>
                    Applying Changes...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm & Apply {previewData.summary.willUpdate} Updates
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RESULT VIEW */}
      {viewMode === 'result' && importResult && (
        <Card>
          <CardHeader className="bg-green-50 dark:bg-green-950 border-b border-green-200 dark:border-green-800">
            <CardTitle className="text-lg flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle className="w-5 h-5" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <FileSpreadsheet className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total Rows</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{importResult.summary.totalRows}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium">Successful</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">{importResult.summary.successCount}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">Failed</p>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">{importResult.summary.errorCount}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
                <FileSpreadsheet className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">Locations</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{importResult.summary.locationsUpdated}</p>
                </div>
              </div>
            </div>

            {/* Success Table */}
            {importResult.updated.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Successfully Updated ({importResult.updated.length})
                </h3>
                <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">New Price</TableHead>
                        <TableHead className="text-center">Locations</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.updated.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.row}</TableCell>
                          <TableCell className="font-medium">{item.itemName}</TableCell>
                          <TableCell className="text-right text-green-600 dark:text-green-400 font-semibold">
                            {formatPrice(item.newPrice)}
                          </TableCell>
                          <TableCell className="text-center">{item.locationsUpdated}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Error Table */}
            {importResult.errors.length > 0 && (
              <div>
                <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                  Errors ({importResult.errors.length})
                </h3>
                <div className="overflow-x-auto max-h-64 overflow-y-auto border border-red-200 dark:border-red-800 rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-red-50 dark:bg-red-950">
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.errors.map((err, index) => (
                        <TableRow key={index}>
                          <TableCell>{err.row}</TableCell>
                          <TableCell>{err.itemName || 'N/A'}</TableCell>
                          <TableCell className="text-red-600 dark:text-red-400">{err.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Start Over Button */}
            <div className="pt-4 border-t">
              <Button onClick={handleStartOver} variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Import Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
