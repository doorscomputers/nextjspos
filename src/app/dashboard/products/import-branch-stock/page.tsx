"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Database } from "lucide-react"
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
import Papa from "papaparse"

interface ImportResult {
  success: number
  failed: number
  skipped: number
  totalInventoryRecords: number
  errors: Array<{
    row: number
    sku: string
    error: string
  }>
}

export default function ImportBranchStockPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string>("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError("Please select a CSV file")
        setFile(null)
        return
      }
      setFile(selectedFile)
      setError("")
      setResult(null)
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
      // Parse CSV file (supports both comma and tab delimited)
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: '', // Auto-detect delimiter (comma or tab)
        complete: async (results) => {
          try {
            // Debug: Log first row to see what columns were detected
            console.log('=== CLIENT DEBUG START ===')
            console.log('CSV Columns detected:', results.meta.fields)
            console.log('Total rows parsed:', results.data.length)
            console.log('First row data:', JSON.stringify(results.data[0], null, 2))
            console.log('First row Item Code:', results.data[0]['Item Code'])
            console.log('First row Item Name:', results.data[0]['Item Name'])
            console.log('All keys in first row:', Object.keys(results.data[0]))
            console.log('=== CLIENT DEBUG END ===')

            // Send raw CSV data to API
            const response = await fetch('/api/products/import-branch-stock', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ products: results.data }),
            })

            // Read response as text first to handle non-JSON errors
            const responseText = await response.text()

            // Try to parse as JSON
            let data
            try {
              data = JSON.parse(responseText)
            } catch (parseError) {
              // If JSON parsing fails, show the raw error text
              throw new Error(`Server error: ${responseText.substring(0, 500)}`)
            }

            if (!response.ok) {
              throw new Error(data.error || 'Failed to import branch stock')
            }

            setResult(data.results)
            setFile(null)

            // Reset file input
            const fileInput = document.getElementById('file-upload') as HTMLInputElement
            if (fileInput) fileInput.value = ''

          } catch (error: any) {
            setError(error.message || 'Failed to import branch stock')
          } finally {
            setUploading(false)
          }
        },
        error: (error) => {
          setError(`Failed to parse CSV file: ${error.message}`)
          setUploading(false)
        }
      })

    } catch (error: any) {
      setError(error.message || 'An unexpected error occurred')
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Import Branch Stock</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            One-time import to populate beginning inventory from Branch Stock Pivot CSV
          </p>
        </div>
        <Button
          onClick={() => router.push('/dashboard/products')}
          variant="outline"
        >
          Back to Products
        </Button>
      </div>

      {/* Important Notice */}
      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <strong>Important:</strong> This is a one-time migration tool to import beginning inventory from your Branch Stock Pivot CSV file.
          All products will be created as single-type products with beginning inventory recorded in Product History.
        </AlertDescription>
      </Alert>

      {/* Expected CSV Format Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Expected CSV Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <p className="font-semibold mb-2">Your CSV file should have the following columns:</p>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Column Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Required</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Item Code</TableCell>
                  <TableCell>Product SKU</TableCell>
                  <TableCell className="text-red-600">Yes</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Item Name</TableCell>
                  <TableCell>Product name</TableCell>
                  <TableCell className="text-red-600">Yes</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Supplier</TableCell>
                  <TableCell>Supplier name (ignored in import)</TableCell>
                  <TableCell className="text-gray-500">No</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium bg-green-50 dark:bg-green-950">Category ID</TableCell>
                  <TableCell className="bg-green-50 dark:bg-green-950">Category ID from categories table (must import categories first)</TableCell>
                  <TableCell className="bg-green-50 dark:bg-green-950 text-orange-600">Must Import First</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium bg-green-50 dark:bg-green-950">Brand ID</TableCell>
                  <TableCell className="bg-green-50 dark:bg-green-950">Brand ID from brands table (must import brands first)</TableCell>
                  <TableCell className="bg-green-50 dark:bg-green-950 text-orange-600">Must Import First</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">?Cost</TableCell>
                  <TableCell>Purchase price (₱ symbol and commas will be removed)</TableCell>
                  <TableCell className="text-gray-500">No</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">?Price</TableCell>
                  <TableCell>Selling price (₱ symbol and commas will be removed)</TableCell>
                  <TableCell className="text-gray-500">No</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium bg-yellow-50 dark:bg-yellow-950">Warehouse</TableCell>
                  <TableCell className="bg-yellow-50 dark:bg-yellow-950">Stock quantity at Main Warehouse location</TableCell>
                  <TableCell className="bg-yellow-50 dark:bg-yellow-950 text-orange-600">Stock Column</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium bg-yellow-50 dark:bg-yellow-950">Main Store</TableCell>
                  <TableCell className="bg-yellow-50 dark:bg-yellow-950">Stock quantity at Main Store location</TableCell>
                  <TableCell className="bg-yellow-50 dark:bg-yellow-950 text-orange-600">Stock Column</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium bg-yellow-50 dark:bg-yellow-950">Bambang</TableCell>
                  <TableCell className="bg-yellow-50 dark:bg-yellow-950">Stock quantity at Bambang location</TableCell>
                  <TableCell className="bg-yellow-50 dark:bg-yellow-950 text-orange-600">Stock Column</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium bg-yellow-50 dark:bg-yellow-950">Tuguegarao</TableCell>
                  <TableCell className="bg-yellow-50 dark:bg-yellow-950">Stock quantity at Tuguegarao location</TableCell>
                  <TableCell className="bg-yellow-50 dark:bg-yellow-950 text-orange-600">Stock Column</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Active</TableCell>
                  <TableCell>TRUE or FALSE</TableCell>
                  <TableCell className="text-gray-500">No</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Important Notes:</h4>
            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li className="text-red-600 dark:text-red-400 font-bold">⚠️ You MUST import Brands and Categories FIRST before importing products!</li>
              <li>The CSV must use "Brand ID" and "Category ID" columns with numeric IDs from the database</li>
              <li>Negative stock values will be converted to 0</li>
              <li>The "Warehouse" column will be mapped to "Main Warehouse" location in database</li>
              <li>All products will be created as single-type products</li>
              <li>Beginning inventory will be recorded in Product History for audit trail</li>
              <li>Products with duplicate SKUs will be skipped</li>
              <li>All 4 locations must exist in the database before import</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload CSV File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
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
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {file ? file.name : 'No file selected'}
            </span>
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="ml-auto"
            >
              {uploading ? 'Importing...' : 'Import Branch Stock'}
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium">Successful</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">{result.success}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">Failed</p>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">{result.failed}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">Skipped</p>
                  <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{result.skipped}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Database className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">Inventory Records</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{result.totalInventoryRecords}</p>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Errors & Skipped Items:</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((error, index) => (
                        <TableRow key={index}>
                          <TableCell>{error.row}</TableCell>
                          <TableCell className="font-mono">{error.sku}</TableCell>
                          <TableCell className="text-red-600 dark:text-red-400">{error.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {result.success > 0 && (
              <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Successfully imported {result.success} products with {result.totalInventoryRecords} beginning inventory records across all locations.
                  All inventory changes have been recorded in Product History for audit trail.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
