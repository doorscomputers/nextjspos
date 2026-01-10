"use client"

import { useState, useRef } from "react"
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
import { toast } from "sonner"

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

export default function ImportOpeningBalancePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string>("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const fileName = selectedFile.name.toLowerCase()
      if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        setError("Please select a CSV or Excel (.xlsx/.xls) file")
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
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/customers/opening-balance/import', {
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
        throw new Error(data.error || 'Failed to import opening balances')
      }

      setResult(data.results)
      setFile(null)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      if (data.results.success > 0) {
        toast.success(`Successfully imported ${data.results.success} opening balances!`)
      }
      if (data.results.failed > 0) {
        toast.error(`${data.results.failed} rows failed to import`)
      }

    } catch (error: any) {
      setError(error.message || 'Failed to import opening balances')
      toast.error(error.message || 'Failed to import opening balances')
    } finally {
      setUploading(false)
    }
  }

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/customers/opening-balance/import')
      if (!response.ok) throw new Error('Failed to download template')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'opening-balance-import-template.xlsx'
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  const handleStartOver = () => {
    setResult(null)
    setFile(null)
    setError("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Import Opening Balances</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Bulk import customer opening balances from CSV or Excel file
          </p>
        </div>
        <Button
          onClick={() => router.push('/dashboard/customers/opening-balance')}
          variant="outline"
        >
          Back to Opening Balance
        </Button>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <strong>How it works:</strong> Upload a CSV or Excel file with customer names and amounts.
          Customers are matched by name (case-insensitive). If no match is found, the row is skipped and reported.
        </AlertDescription>
      </Alert>

      {/* File Format Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            File Format
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
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Example:</h4>
            <pre className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto">
{`CustomerName          | OpeningBalance | Notes
Juan Dela Cruz        | 15000          | From old system
Maria Santos          | 8500           | Legacy balance
ABC Corporation       | 125000         | Previous outstanding`}
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
      {!result && (
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
                  'No file selected (.csv, .xlsx, or .xls)'
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
                    Import Opening Balances
                  </>
                )}
              </Button>
            </div>
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
          <CardHeader className="bg-green-50 dark:bg-green-950 border-b border-green-200 dark:border-green-800">
            <CardTitle className="text-lg flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle className="w-5 h-5" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Successfully Imported ({result.successDetails.length}):</h3>
                <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-gray-50 dark:bg-gray-800">
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
                <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">Errors ({result.errors.length}):</h3>
                <div className="overflow-x-auto max-h-48 overflow-y-auto border border-red-200 dark:border-red-800 rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-red-50 dark:bg-red-950">
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Customer Name</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((err, index) => (
                        <TableRow key={index}>
                          <TableCell>{err.row}</TableCell>
                          <TableCell className="font-mono">{err.customerName}</TableCell>
                          <TableCell className="text-red-600 dark:text-red-400">{err.error}</TableCell>
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
