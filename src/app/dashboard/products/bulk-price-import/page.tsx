"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, ArrowLeft } from "lucide-react"
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
    data?: any
  }>
  summary: {
    totalRows: number
    successCount: number
    errorCount: number
    locationsUpdated: number
  }
}

export default function BulkPriceImportPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string>("")

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
      setResult(null)
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

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first")
      return
    }

    setUploading(true)
    setError("")
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/products/bulk-price-import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import prices')
      }

      setResult(data.data)
      setFile(null)

      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''

      if (data.data.summary.successCount > 0) {
        toast.success(`Successfully updated ${data.data.summary.successCount} products`)
      }
      if (data.data.summary.errorCount > 0) {
        toast.error(`${data.data.summary.errorCount} products failed to update`)
      }

    } catch (error: any) {
      setError(error.message || 'An unexpected error occurred')
      toast.error(error.message || 'Failed to import prices')
    } finally {
      setUploading(false)
    }
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
              <strong>Note:</strong> The new selling price will be applied to ALL business locations automatically.
              Product matching is done by exact name (case-insensitive).
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
              onClick={handleUpload}
              disabled={!file || uploading}
              variant="success"
              className="gap-2"
            >
              {uploading ? (
                <>
                  <span className="animate-spin">&#8987;</span>
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Import Prices
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

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Card */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Import Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <FileSpreadsheet className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total Rows</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{result.summary.totalRows}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium">Successful</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">{result.summary.successCount}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">Failed</p>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">{result.summary.errorCount}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
                <FileSpreadsheet className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">Locations</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{result.summary.locationsUpdated}</p>
                </div>
              </div>
            </div>

            {/* Success Table */}
            {result.updated.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Successfully Updated ({result.updated.length})
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
                      {result.updated.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.row}</TableCell>
                          <TableCell className="font-medium">{item.itemName}</TableCell>
                          <TableCell className="text-right text-green-600 dark:text-green-400 font-semibold">
                            &#8369;{item.newPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
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
            {result.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                  Errors ({result.errors.length})
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
                      {result.errors.map((err, index) => (
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
