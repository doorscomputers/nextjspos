"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, Download, FileText, CheckCircle, XCircle, AlertCircle } from "lucide-react"
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
  errors: Array<{
    row: number
    error: string
    data?: any
  }>
}

export default function ImportProductsPage() {
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

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/products/import/template')
      if (!response.ok) throw new Error('Failed to download template')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'product_import_template.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      setError('Failed to download template')
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
      // Parse CSV file
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            // Map CSV columns to expected format
            const products = results.data.map((row: any) => ({
              name: row['Product Name'],
              brand: row['Brand'] || null,
              unit: row['Unit'],
              category: row['Category'] || null,
              subCategory: row['Sub category'] || null,
              sku: row['SKU'] || null,
              barcodeType: row['Barcode Type'] || 'C128',
              manageStock: row['Manage Stock'],
              alertQuantity: row['Alert quantity'] || null,
              expiresIn: row['Expires in'] || null,
              expiryPeriodUnit: row['Expiry Period Unit'] || null,
              applicableTax: row['Applicable Tax'] || null,
              sellingPriceTaxType: row['Selling Price Tax Type'] || 'inclusive',
              productType: row['Product Type'],
              variationName: row['Variation Name'] || null,
              variationValues: row['Variation Values'] || null,
              variationSKUs: row['Variation SKUs'] || null,
              purchasePriceInclTax: row['Purchase Price (Including Tax)'] || null,
              purchasePriceExclTax: row['Purchase Price (Excluding Tax)'] || null,
              profitMargin: row['Profit Margin %'] || null,
              sellingPrice: row['Selling Price'] || null,
              openingStock: row['Opening Stock'] || null,
              openingStockLocation: row['Opening stock location'] || null,
              expiryDate: row['Expiry Date'] || null,
              enableProductDescription: row['Enable Product description; IMEI or Serial Number'] || null,
              weight: row['Weight'] || null,
              rack: row['Rack'] || null,
              row: row['Row'] || null,
              position: row['Position'] || null,
              image: row['Image'] || null,
              productDescription: row['Product Description'] || null,
              customField1: row['Custom Field1'] || null,
              customField2: row['Custom Field2'] || null,
              customField3: row['Custom Field3'] || null,
              customField4: row['Custom Field4'] || null,
              notForSelling: row['Not for selling'] || '0',
              productLocations: row['Product locations'] || null,
            }))

            // Send to API
            const response = await fetch('/api/products/import', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ products }),
            })

            const data = await response.json()

            if (!response.ok) {
              throw new Error(data.error || 'Failed to import products')
            }

            setResult(data.results)
            setFile(null)

            // Reset file input
            const fileInput = document.getElementById('file-upload') as HTMLInputElement
            if (fileInput) fileInput.value = ''

          } catch (error: any) {
            setError(error.message || 'Failed to import products')
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Products</h1>
          <p className="text-sm text-gray-600 mt-1">
            Upload a CSV file to import multiple products at once
          </p>
        </div>
        <Button
          onClick={() => router.push('/dashboard/products')}
          variant="outline"
        >
          Back to Products
        </Button>
      </div>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-700">
            <p className="font-semibold mb-2">Carefully follow the instructions before importing the file.</p>
            <p className="mb-2">The columns of the CSV file should be in the following order:</p>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Column Number</TableHead>
                  <TableHead>Column Name</TableHead>
                  <TableHead>Instruction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instructionRows.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.number}</TableCell>
                    <TableCell>
                      <span className="font-medium">{row.name}</span>
                      {row.required && <span className="text-red-600 ml-1">(Required)</span>}
                      {row.optional && <span className="text-gray-500 ml-1">(Optional)</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.instruction}
                      {row.options && (
                        <div className="mt-1">
                          <span className="font-semibold">{row.options.label}:</span>
                          <span className="ml-1">{row.options.values}</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">File To Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label
              htmlFor="file-upload"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
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
            <span className="text-sm text-gray-600">
              {file ? file.name : 'No file selected'}
            </span>
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="ml-auto"
            >
              {uploading ? 'Uploading...' : 'Submit'}
            </Button>
          </div>

          <Button
            onClick={handleDownloadTemplate}
            variant="default"
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Download template file
          </Button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-green-700 font-medium">Successful</p>
                  <p className="text-2xl font-bold text-green-900">{result.success}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <XCircle className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-sm text-red-700 font-medium">Failed</p>
                  <p className="text-2xl font-bold text-red-900">{result.failed}</p>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-gray-900 mb-2">Errors:</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Error</TableHead>
                        <TableHead>Product Name</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((error, index) => (
                        <TableRow key={index}>
                          <TableCell>{error.row}</TableCell>
                          <TableCell className="text-red-600">{error.error}</TableCell>
                          <TableCell>{error.data?.name || 'N/A'}</TableCell>
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

const instructionRows = [
  { number: 1, name: 'Product Name', required: true, instruction: 'Name of the product' },
  { number: 2, name: 'Brand', optional: true, instruction: 'Name of the brand (If not found new brand with the given name will be created)' },
  { number: 3, name: 'Unit', required: true, instruction: 'Name of the unit' },
  { number: 4, name: 'Category', optional: true, instruction: 'Name of the Category (If not found new category with the given name will be created)' },
  { number: 5, name: 'Sub category', optional: true, instruction: 'Name of the Sub-Category (If not found new sub-category with the given name under the parent Category will be created)' },
  { number: 6, name: 'SKU', optional: true, instruction: 'Product SKU. If blank an SKU will be automatically generated' },
  { number: 7, name: 'Barcode Type', optional: true, instruction: 'Barcode Type for the product', options: { label: 'Currently supported', values: 'C128, C39, EAN-13, EAN-8, UPC-A, UPC-E, ITF-14' } },
  { number: 8, name: 'Manage Stock', required: true, instruction: 'Enable or disable stock management', options: { label: 'Available Options', values: '1 = Yes, 0 = No' } },
  { number: 9, name: 'Alert quantity', optional: true, instruction: 'Alert quantity' },
  { number: 10, name: 'Expires in', optional: true, instruction: 'Product expiry period (Only in numbers)' },
  { number: 11, name: 'Expiry Period Unit', optional: true, instruction: 'Unit for the expiry period', options: { label: 'Available Options', values: 'days, months' } },
  { number: 12, name: 'Applicable Tax', optional: true, instruction: 'Name of the Tax Rate' },
  { number: 13, name: 'Selling Price Tax Type', required: true, instruction: 'Selling Price Tax Type', options: { label: 'Available Options', values: 'inclusive, exclusive' } },
  { number: 14, name: 'Product Type', required: true, instruction: 'Product Type', options: { label: 'Available Options', values: 'single, variable' } },
  { number: 15, name: 'Variation Name', optional: true, instruction: 'Name of the variation (Ex: Size, Color etc) - Required if product type is variable' },
  { number: 16, name: 'Variation Values', optional: true, instruction: 'Values for the variation separated with \'|\' (Ex: Red|Blue|Green)' },
  { number: 17, name: 'Variation SKUs', optional: true, instruction: 'SKUs of each variations separated by \'|\' if product type is variable' },
  { number: 18, name: 'Purchase Price (Including Tax)', optional: true, instruction: 'Purchase Price (Including Tax) (Only in numbers). For variable products \'|\' separated values with the same order as Variation Values (Ex: 84|85|88)' },
  { number: 19, name: 'Purchase Price (Excluding Tax)', optional: true, instruction: 'Purchase Price (Excluding Tax) (Only in numbers)' },
  { number: 20, name: 'Profit Margin %', optional: true, instruction: 'Profit Margin (Only in numbers)' },
  { number: 21, name: 'Selling Price', optional: true, instruction: 'Selling Price (Only in numbers). If blank selling price will be calculated with the given Purchase Price and Applicable Tax' },
  { number: 22, name: 'Opening Stock', optional: true, instruction: 'Opening Stock (Only in numbers). For variable products separate stock quantities with \'|\' (Ex: 100|150|200)' },
  { number: 23, name: 'Opening stock location', optional: true, instruction: 'Name of the business location. If blank first business location will be used' },
  { number: 24, name: 'Expiry Date', optional: true, instruction: 'Stock Expiry Date', options: { label: 'Format', values: 'mm-dd-yyyy; Ex: 11-25-2018' } },
  { number: 25, name: 'Enable Product description, IMEI or Serial Number', optional: true, instruction: '', options: { label: 'Available Options', values: '1 = Yes, 0 = No' } },
  { number: 26, name: 'Weight', optional: true, instruction: 'Optional' },
  { number: 27, name: 'Rack', optional: true, instruction: 'Rack details seperated by \'|\' for different business locations serially. (Ex: R1|R5|R12)' },
  { number: 28, name: 'Row', optional: true, instruction: 'Row details seperated by \'|\' for different business locations serially. (Ex: ROW1|ROW2|ROW3)' },
  { number: 29, name: 'Position', optional: true, instruction: 'Position details seperated by \'|\' for different business locations serially. (Ex: POS1|POS2|POS3)' },
  { number: 30, name: 'Image', optional: true, instruction: 'Image name with extension. (Image name must be uploaded to the server public/uploads/img.) Or URL of the image' },
  { number: 31, name: 'Product Description', optional: true, instruction: '' },
  { number: 32, name: 'Custom Field1', optional: true, instruction: '' },
  { number: 33, name: 'Custom Field2', optional: true, instruction: '' },
  { number: 34, name: 'Custom Field3', optional: true, instruction: '' },
  { number: 35, name: 'Custom Field4', optional: true, instruction: '' },
  { number: 36, name: 'Not for selling', optional: true, instruction: '', options: { label: 'Available Options', values: '1 = Yes, 0 = No' } },
  { number: 37, name: 'Product locations', optional: true, instruction: 'Comma separated string of business location names where product will be available' },
]
