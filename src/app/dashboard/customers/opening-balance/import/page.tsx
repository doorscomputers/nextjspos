"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, CheckCircle, XCircle, AlertCircle, Download, FileSpreadsheet } from "lucide-react"
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
  totalAmountImported: number
  errors: Array<{
    row: number
    customerName: string
    error: string
  }>
  successDetails: Array<{
    row: number
    customerName: string
    customerId: number
    amount: number
    invoiceNumber: string
    action: 'created' | 'updated'
  }>
}

interface PreviewRow {
  CustomerName: string
  OpeningBalance: string
  Notes: string
}

export default function ImportOpeningBalancePage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<PreviewRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string>("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError("Please select a CSV file")
        setFile(null)
        setPreviewData([])
        return
      }
      setFile(selectedFile)
      setError("")
      setResult(null)

      // Parse and preview
      Papa.parse(selectedFile, {
        delimiter: "",
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as any[]
          const preview = data.slice(0, 10).map((row) => ({
            CustomerName: row.CustomerName || row.Name || row.customer_name || '',
            OpeningBalance: row.OpeningBalance || row.opening_balance || row.Amount || row.Balance || '',
            Notes: row.Notes || row.notes || '',
          }))
          setPreviewData(preview)
        },
        error: (err) => {
          setError(`Failed to parse CSV: ${err.message}`)
        }
      })
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
      Papa.parse(file, {
        delimiter: "",
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const response = await fetch('/api/customers/opening-balance/import', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ data: results.data }),
            })

            const data = await response.json()

            if (!response.ok) {
              throw new Error(data.error || 'Failed to import opening balances')
            }

            setResult(data.results)
            setFile(null)
            setPreviewData([])

            // Reset file input
            const fileInput = document.getElementById('file-upload') as HTMLInputElement
            if (fileInput) fileInput.value = ''

          } catch (error: any) {
            setError(error.message || 'Failed to import opening balances')
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

  const downloadTemplate = () => {
    const csvContent = `CustomerName,OpeningBalance,Notes
Juan Dela Cruz,15000,From old system
Maria Santos,8500,Legacy balance
ABC Corporation,125000,Previous outstanding`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'opening_balance_template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Import Opening Balances</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Bulk import customer opening balances from CSV file
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => router.push('/dashboard/customers/opening-balance')}
            variant="outline"
          >
            Back to Opening Balance
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <strong>How it works:</strong> Upload a CSV with customer names and amounts.
          Customers are matched by name (case-insensitive). If no match is found, the row is skipped and reported.
        </AlertDescription>
      </Alert>

      {/* CSV Format Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            CSV Format
            <Button onClick={downloadTemplate} variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              Download Template
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  <TableCell className="font-medium">CustomerName</TableCell>
                  <TableCell>Customer name (must match existing customer exactly, case-insensitive)</TableCell>
                  <TableCell className="text-red-600 font-medium">Yes</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">OpeningBalance</TableCell>
                  <TableCell>Amount in PHP (e.g., 15000 or 15,000.00)</TableCell>
                  <TableCell className="text-red-600 font-medium">Yes</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Notes</TableCell>
                  <TableCell>Optional notes for the opening balance entry</TableCell>
                  <TableCell className="text-gray-500">No</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Example CSV:</h4>
            <pre className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto">
{`CustomerName,OpeningBalance,Notes
Juan Dela Cruz,15000,From old system
Maria Santos,8500,Legacy balance
ABC Corporation,125000,Previous outstanding`}
            </pre>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">Important Notes:</h4>
            <ul className="list-disc list-inside text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
              <li><strong>Customer names must already exist</strong> in the system - no new customers will be created</li>
              <li>Matching is <strong>case-insensitive</strong> (e.g., &quot;JUAN DELA CRUZ&quot; matches &quot;Juan Dela Cruz&quot;)</li>
              <li>If customer already has an OB invoice, the amount will be <strong>added</strong> to it</li>
              <li>Rows with unmatched customer names will be skipped and reported</li>
              <li>Today&apos;s date will be used for all imported opening balances</li>
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
              variant="success"
            >
              {uploading ? 'Importing...' : 'Import Opening Balances'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Card */}
      {previewData.length > 0 && !result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview (First 10 rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead className="text-right">Opening Balance</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-gray-500">{index + 1}</TableCell>
                      <TableCell className="font-medium">{row.CustomerName || '-'}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.OpeningBalance ? `₱${parseFloat(row.OpeningBalance.toString().replace(/[₱,\s]/g, '')).toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-gray-500">{row.Notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {previewData.length === 10 && (
              <p className="text-sm text-gray-500 mt-2 text-center">
                Showing first 10 rows only. Full file will be processed on import.
              </p>
            )}
          </CardContent>
        </Card>
      )}

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
                <FileSpreadsheet className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total Imported</p>
                  <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{formatCurrency(result.totalAmountImported)}</p>
                </div>
              </div>
            </div>

            {/* Success Details */}
            {result.successDetails.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Successfully Imported:</h3>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Customer Name</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.successDetails.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.row}</TableCell>
                          <TableCell className="font-medium">{item.customerName}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(item.amount)}</TableCell>
                          <TableCell className="font-mono text-blue-600">{item.invoiceNumber}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              item.action === 'created'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }`}>
                              {item.action === 'created' ? 'New OB' : 'Added to OB'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Error Details */}
            {result.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Errors & Failed Items:</h3>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Customer Name</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((error, index) => (
                        <TableRow key={index}>
                          <TableCell>{error.row}</TableCell>
                          <TableCell className="font-mono">{error.customerName}</TableCell>
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
                  Successfully imported {result.success} opening balance{result.success > 1 ? 's' : ''} totaling {formatCurrency(result.totalAmountImported)}.
                  You can view them in the <a href="/dashboard/reports/accounts-receivable" className="underline font-medium">Accounts Receivable Report</a>.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
