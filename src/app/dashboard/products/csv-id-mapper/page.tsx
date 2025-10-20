'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileUp, Download, AlertCircle, CheckCircle, Info } from 'lucide-react'

interface MappingResult {
  success: number
  failed: number
  errors: Array<{ row: number; sku: string; error: string }>
  totalBrands: number
  totalCategories: number
}

export default function CSVIDMapperPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<MappingResult | null>(null)
  const [csvContent, setCsvContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFixingCategories, setIsFixingCategories] = useState(false)
  const [fixResult, setFixResult] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
      setCsvContent(null)
      setError(null)
    }
  }

  const handleProcess = async () => {
    if (!file) {
      setError('Please select a CSV file')
      return
    }

    setIsProcessing(true)
    setError(null)
    setResult(null)
    setCsvContent(null)

    try {
      // Parse CSV file (supports both comma and tab delimited)
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: '', // Auto-detect delimiter (comma or tab)
        complete: async (results) => {
          try {
            const response = await fetch('/api/products/csv-id-mapper', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                products: results.data,
              }),
            })

            const data = await response.json()

            if (!response.ok) {
              throw new Error(data.error || 'Failed to process CSV')
            }

            setResult(data.results)
            setCsvContent(data.csvContent)
          } catch (err: any) {
            setError(err.message)
          } finally {
            setIsProcessing(false)
          }
        },
        error: (error) => {
          setError(`CSV parsing error: ${error.message}`)
          setIsProcessing(false)
        },
      })
    } catch (err: any) {
      setError(err.message)
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!csvContent) return

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `mapped_${file?.name || 'products.csv'}`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFixMissingCategories = async () => {
    if (!result || result.errors.length === 0) return

    setIsFixingCategories(true)
    setFixResult(null)

    try {
      const response = await fetch('/api/categories/import-from-errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errors: result.errors,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create categories')
      }

      setFixResult(`Successfully created ${data.results.success} missing categories! Please re-process your CSV now.`)

      // Auto-reprocess if file is still available
      if (file) {
        setTimeout(() => {
          handleProcess()
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsFixingCategories(false)
    }
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">CSV ID Mapper</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Convert Brand and Category names to IDs for product import
        </p>
      </div>

      {/* Instructions Card */}
      <Card className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <Info className="h-5 w-5" />
            How to Use This Tool
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 dark:text-blue-200">
          <ol className="list-decimal list-inside space-y-2">
            <li><strong>Step 1:</strong> Import all brands using the "Import Brands" page</li>
            <li><strong>Step 2:</strong> Import all categories using the "Import Categories" page</li>
            <li><strong>Step 3:</strong> Upload your original Branch Stock Pivot CSV here (with Brand and Category names)</li>
            <li><strong>Step 4:</strong> Download the mapped CSV (with Brand ID and Category ID)</li>
            <li><strong>Step 5:</strong> Use the mapped CSV to import products with beginning inventory</li>
          </ol>
        </CardContent>
      </Card>

      {/* CSV Format Card */}
      <Card className="mb-6 bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Expected CSV Format</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Your CSV should have these columns (with Brand and Category as names, not IDs)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-md overflow-x-auto">
            <pre className="text-sm text-gray-800 dark:text-gray-200">
              {`Item Code, Item Name, Supplier, Category, Brand, Last Delivery Date, Last Qty Delivered,
?Cost, ?Price, Warehouse, Main Store, Bambang, Tuguegarao, Total Stocks,
?Total Cost, ?Total Price, Active`}
            </pre>
          </div>
          <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Important:</strong> This tool will replace the "Category" and "Brand" columns with "Category ID" and "Brand ID".
              If a brand or category name is not found in your database, it will be reported as an error.
            </span>
          </p>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card className="mb-6 bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Upload Original CSV</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Select your Branch Stock Pivot CSV file with brand and category names
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isProcessing}
                className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              />
            </div>
            <Button
              onClick={handleProcess}
              disabled={!file || isProcessing}
              className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              {isProcessing ? (
                <>Processing...</>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  Process CSV
                </>
              )}
            </Button>
          </div>
          {file && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Selected: {file.name}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800 dark:text-red-200">{error}</AlertDescription>
        </Alert>
      )}

      {/* Fix Success Alert */}
      {fixResult && (
        <Alert className="mb-6 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">{fixResult}</AlertDescription>
        </Alert>
      )}

      {/* Results Section */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200">
                  Successfully Mapped
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-900 dark:text-green-100">
                  {result.success}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-800 dark:text-red-200">
                  Failed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-900 dark:text-red-100">
                  {result.failed}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Available Brands
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                  {result.totalBrands}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-800 dark:text-purple-200">
                  Available Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                  {result.totalCategories}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Download Button */}
          {csvContent && result.success > 0 && (
            <Card className="mb-6 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
                  <CheckCircle className="h-5 w-5" />
                  CSV Ready for Download
                </CardTitle>
                <CardDescription className="text-green-700 dark:text-green-300">
                  Your CSV has been successfully mapped. Download it and use it for product import.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleDownload}
                  className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Mapped CSV
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Errors Table */}
          {result.errors.length > 0 && (
            <Card className="bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">
                  Mapping Errors ({result.errors.length})
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Products that could not be mapped due to missing brands or categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-200 dark:border-gray-700">
                        <TableHead className="text-gray-900 dark:text-white">Row</TableHead>
                        <TableHead className="text-gray-900 dark:text-white">Item Code</TableHead>
                        <TableHead className="text-gray-900 dark:text-white">Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((error, index) => (
                        <TableRow key={index} className="border-gray-200 dark:border-gray-700">
                          <TableCell className="text-gray-900 dark:text-white">{error.row}</TableCell>
                          <TableCell className="font-mono text-sm text-gray-900 dark:text-white">
                            {error.sku}
                          </TableCell>
                          <TableCell className="text-red-600 dark:text-red-400">
                            {error.error}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 space-y-3">
                  <Button
                    onClick={handleFixMissingCategories}
                    disabled={isFixingCategories}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white dark:bg-orange-700 dark:hover:bg-orange-600"
                  >
                    {isFixingCategories ? (
                      <>Fixing Missing Categories...</>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Auto-Fix Missing Categories
                      </>
                    )}
                  </Button>
                  <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                    <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                      <strong>Tip:</strong> Click "Auto-Fix Missing Categories" to automatically create all missing categories from the error list.
                      The system will then re-process your CSV automatically.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
