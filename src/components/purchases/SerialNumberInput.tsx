'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { PlusIcon, TrashIcon, QrCodeIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'

export interface SerialNumberData {
  serialNumber: string
  imei?: string
  condition: 'new' | 'used' | 'refurbished' | 'damaged' | 'defective'
}

interface SerialNumberInputProps {
  requiredCount: number
  productName: string
  onSerialNumbersChange: (serialNumbers: SerialNumberData[]) => void
  initialSerialNumbers?: SerialNumberData[]
  supplierName?: string
  dateReceived?: string
  userName?: string
}

export function SerialNumberInput({
  requiredCount,
  productName,
  onSerialNumbersChange,
  initialSerialNumbers = [],
  supplierName = '',
  dateReceived = '',
  userName = ''
}: SerialNumberInputProps) {
  const [serialNumbers, setSerialNumbers] = useState<SerialNumberData[]>(initialSerialNumbers)
  const [isOpen, setIsOpen] = useState(false)

  // Single entry form
  const [serialNumber, setSerialNumber] = useState('')
  const [imei, setImei] = useState('')
  const [condition, setCondition] = useState<SerialNumberData['condition']>('new')

  // Bulk entry
  const [bulkText, setBulkText] = useState('')
  const [entryMode, setEntryMode] = useState<'single' | 'bulk' | 'scan' | 'csv'>('single')

  const addSerialNumber = () => {
    if (!serialNumber.trim()) {
      toast.error('Serial number is required')
      return
    }

    // Check duplicate
    if (serialNumbers.some(sn => sn.serialNumber === serialNumber.trim())) {
      toast.error('This serial number already exists')
      return
    }

    const newSerialNumber: SerialNumberData = {
      serialNumber: serialNumber.trim(),
      imei: imei.trim() || undefined,
      condition
    }

    const updated = [...serialNumbers, newSerialNumber]
    setSerialNumbers(updated)
    onSerialNumbersChange(updated)

    // Reset form
    setSerialNumber('')
    setImei('')

    // Show brief success without intrusive toast for fast scanning
    const remaining = requiredCount - updated.length
    if (remaining > 0) {
      // Just a quick feedback, don't interrupt scanning flow
      console.log(`✓ Serial added. ${remaining} remaining.`)
    }

    // Auto-close if all serial numbers are entered
    if (updated.length === requiredCount) {
      setIsOpen(false)
      toast.success(`All ${requiredCount} serial numbers entered!`)
    }
  }

  const processBulkEntry = () => {
    if (!bulkText.trim()) {
      toast.error('Please enter serial numbers')
      return
    }

    // Split by newline, comma, or semicolon
    const lines = bulkText
      .split(/[\n,;]/)
      .map(line => line.trim())
      .filter(line => line.length > 0)

    const newSerialNumbers: SerialNumberData[] = []
    const duplicates: string[] = []

    for (const line of lines) {
      // Parse format: "SerialNumber" or "SerialNumber|IMEI"
      const parts = line.split('|').map(p => p.trim())
      const sn = parts[0]
      const imeiValue = parts[1] || undefined

      // Check if already exists
      if (serialNumbers.some(existing => existing.serialNumber === sn) ||
          newSerialNumbers.some(existing => existing.serialNumber === sn)) {
        duplicates.push(sn)
        continue
      }

      newSerialNumbers.push({
        serialNumber: sn,
        imei: imeiValue,
        condition
      })
    }

    if (duplicates.length > 0) {
      toast.error(`Skipped ${duplicates.length} duplicate serial numbers`)
    }

    if (newSerialNumbers.length > 0) {
      const updated = [...serialNumbers, ...newSerialNumbers]
      setSerialNumbers(updated)
      onSerialNumbersChange(updated)

      setBulkText('')
      toast.success(`Added ${newSerialNumbers.length} serial numbers`)

      // Auto-close if all entered
      if (updated.length >= requiredCount) {
        setIsOpen(false)
        toast.success(`All ${requiredCount} serial numbers entered!`)
      }
    }
  }

  const removeSerialNumber = (index: number) => {
    const updated = serialNumbers.filter((_, i) => i !== index)
    setSerialNumbers(updated)
    onSerialNumbersChange(updated)
    toast.success('Serial number removed')
  }

  const clearAll = () => {
    setSerialNumbers([])
    onSerialNumbersChange([])
    toast.success('All serial numbers cleared')
  }

  const downloadTemplate = () => {
    // Create CSV template with supplier info in header
    const csvContent = [
      '# Serial Number Import Template',
      `# Product: ${productName}`,
      `# Supplier: ${supplierName || 'N/A'}`,
      `# Date Received: ${dateReceived || new Date().toISOString().split('T')[0]}`,
      `# Imported By: ${userName || 'Current User'}`,
      `# Required Quantity: ${requiredCount}`,
      '',
      'Serial Number,IMEI (Optional),Condition',
      ...Array(requiredCount).fill(',,new')
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `serial_numbers_${productName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.csv`)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success('Template downloaded!')
  }

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n')

      // Skip comment lines (starting with #) and header
      const dataLines = lines
        .filter(line => !line.trim().startsWith('#') && line.trim().length > 0)
        .slice(1) // Skip header row

      const newSerialNumbers: SerialNumberData[] = []
      const duplicates: string[] = []
      const emptyLines: number[] = []

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i]
        const parts = line.split(',').map(p => p.trim())

        // Try to find the first non-empty column (serial number could be in any column)
        let sn = ''
        let imeiValue: string | undefined = undefined
        let cond: SerialNumberData['condition'] = 'new'

        // Find first non-empty value as serial number
        for (let j = 0; j < parts.length; j++) {
          if (parts[j] && parts[j].length > 0) {
            sn = parts[j]
            // Next non-empty value is IMEI
            if (j + 1 < parts.length && parts[j + 1]) {
              imeiValue = parts[j + 1]
            }
            // Next value after that is condition
            if (j + 2 < parts.length && parts[j + 2]) {
              const condValue = parts[j + 2].toLowerCase()
              if (['new', 'used', 'refurbished', 'damaged', 'defective'].includes(condValue)) {
                cond = condValue as SerialNumberData['condition']
              }
            }
            break
          }
        }

        if (!sn) {
          emptyLines.push(i + 1)
          continue
        }

        // Check duplicates
        if (serialNumbers.some(existing => existing.serialNumber === sn) ||
            newSerialNumbers.some(existing => existing.serialNumber === sn)) {
          duplicates.push(sn)
          continue
        }

        // Check if we're exceeding the required count
        const totalAfterAdding = serialNumbers.length + newSerialNumbers.length + 1
        if (totalAfterAdding > requiredCount) {
          toast.warning(`Stopped importing: You need ${requiredCount} serial numbers, but CSV has more. Only importing first ${requiredCount}.`)
          break // Stop processing more lines
        }

        newSerialNumbers.push({
          serialNumber: sn,
          imei: imeiValue,
          condition: cond
        })
      }

      // Show detailed feedback
      if (emptyLines.length > 0) {
        console.log(`ℹ️ Skipped ${emptyLines.length} empty lines`)
      }

      if (duplicates.length > 0) {
        toast.error(`Skipped ${duplicates.length} duplicate serial numbers`)
      }

      if (newSerialNumbers.length > 0) {
        const updated = [...serialNumbers, ...newSerialNumbers]
        setSerialNumbers(updated)
        onSerialNumbersChange(updated)
        toast.success(`Imported ${newSerialNumbers.length} serial numbers from CSV`)

        if (updated.length >= requiredCount) {
          setIsOpen(false)
          toast.success(`All ${requiredCount} serial numbers entered!`)
        }
      } else {
        toast.error(`No valid serial numbers found in CSV. Found ${dataLines.length} data lines, ${emptyLines.length} empty, ${duplicates.length} duplicates.`)
      }
    }

    reader.readAsText(file)
    // Reset input
    event.target.value = ''
  }

  const progressPercentage = requiredCount > 0 ? (serialNumbers.length / requiredCount) * 100 : 0
  const isComplete = serialNumbers.length === requiredCount
  const isMissing = serialNumbers.length < requiredCount

  return (
    <div className="space-y-2">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant={isComplete ? "default" : isMissing ? "destructive" : "outline"}
            size="sm"
            className="gap-2"
          >
            <QrCodeIcon className="w-4 h-4" />
            <span>
              Serial Numbers ({serialNumbers.length}/{requiredCount})
            </span>
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-gray-900">
          <DialogHeader className="flex-shrink-0 bg-white dark:bg-gray-900">
            <DialogTitle className="text-gray-900 dark:text-white">
              Enter Serial Numbers - {productName}
            </DialogTitle>
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Progress: {serialNumbers.length} / {requiredCount}
                </span>
                <span className="text-sm font-medium">
                  {progressPercentage.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    isComplete ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                />
              </div>
            </div>
          </DialogHeader>

          <div className="mt-6 space-y-6 overflow-y-auto flex-1 pr-2 bg-white dark:bg-gray-900">
            {/* Entry Mode Selector */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Entry Method:
              </div>
              <div className="flex gap-2 border-b border-gray-300 dark:border-gray-700 pb-4 flex-wrap">
                <Button
                  type="button"
                  variant={entryMode === 'single' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEntryMode('single')}
                  className={`transition-all ${
                    entryMode === 'single'
                      ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-600 hover:bg-blue-700 shadow-lg scale-105'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {entryMode === 'single' && <span className="mr-1">✓</span>}
                  Single Entry
                </Button>
                <Button
                  type="button"
                  variant={entryMode === 'bulk' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEntryMode('bulk')}
                  className={`transition-all ${
                    entryMode === 'bulk'
                      ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-600 hover:bg-blue-700 shadow-lg scale-105'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {entryMode === 'bulk' && <span className="mr-1">✓</span>}
                  Bulk Entry
                </Button>
                <Button
                  type="button"
                  variant={entryMode === 'scan' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEntryMode('scan')}
                  className={`transition-all ${
                    entryMode === 'scan'
                      ? 'ring-2 ring-green-500 ring-offset-2 bg-green-600 hover:bg-green-700 shadow-lg scale-105'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <QrCodeIcon className="w-4 h-4 mr-1" />
                  {entryMode === 'scan' && <span className="mr-1">✓</span>}
                  Scan Barcode
                </Button>
                <Button
                  type="button"
                  variant={entryMode === 'csv' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEntryMode('csv')}
                  className={`gap-1 transition-all ${
                    entryMode === 'csv'
                      ? 'ring-2 ring-purple-500 ring-offset-2 bg-purple-600 hover:bg-purple-700 shadow-lg scale-105'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <ArrowUpTrayIcon className="w-4 h-4" />
                  {entryMode === 'csv' && <span className="mr-1">✓</span>}
                  CSV Import
                </Button>
              </div>

              {/* Active Mode Indicator */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mr-2 animate-pulse"></span>
                  Active Mode: {' '}
                  <span className="font-bold">
                    {entryMode === 'single' && 'Single Entry'}
                    {entryMode === 'bulk' && 'Bulk Entry'}
                    {entryMode === 'scan' && 'Scan Barcode'}
                    {entryMode === 'csv' && 'CSV Import'}
                  </span>
                </p>
              </div>
            </div>

            {/* Single Entry Mode */}
            {entryMode === 'single' && (
              <div className="space-y-6 bg-white dark:bg-gray-900">
                {/* Scanner-optimized input area */}
                <div className="bg-blue-50 dark:bg-blue-950 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-6">
                  <div className="text-center mb-4">
                    <QrCodeIcon className="w-12 h-12 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      Scan or Enter Serial Number
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {serialNumbers.length} of {requiredCount} entered • {requiredCount - serialNumbers.length} remaining
                    </p>
                  </div>

                  <div className="max-w-2xl mx-auto">
                    <Input
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      placeholder="Scan barcode or type serial number..."
                      className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-blue-400 dark:border-blue-600 text-center text-xl font-mono h-14 focus:ring-4 focus:ring-blue-300"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addSerialNumber()
                        }
                      }}
                    />
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
                      💡 Press Enter after each scan or manually typing
                    </p>
                  </div>
                </div>

                {/* Optional IMEI and Condition - collapsed by default for faster workflow */}
                <details className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <summary className="cursor-pointer font-medium text-gray-900 dark:text-white mb-4">
                    Optional: Set IMEI and Condition
                  </summary>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label className="text-gray-900 dark:text-gray-100">IMEI (Optional)</Label>
                      <Input
                        value={imei}
                        onChange={(e) => setImei(e.target.value)}
                        placeholder="IMEI number"
                        className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-900 dark:text-gray-100">Default Condition</Label>
                      <Select value={condition} onValueChange={(v) => setCondition(v as any)}>
                        <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="used">Used</SelectItem>
                          <SelectItem value="refurbished">Refurbished</SelectItem>
                          <SelectItem value="damaged">Damaged</SelectItem>
                          <SelectItem value="defective">Defective</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </details>
              </div>
            )}

            {/* Bulk Entry Mode */}
            {entryMode === 'bulk' && (
              <div className="space-y-4">
                <div>
                  <Label>Bulk Serial Numbers</Label>
                  <Textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder="Enter serial numbers (one per line or comma-separated)&#10;Format: SerialNumber or SerialNumber|IMEI&#10;&#10;Example:&#10;SN12345|123456789&#10;SN12346|123456790&#10;SN12347|123456791"
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    💡 Tip: Copy from Excel/CSV. Format: SerialNumber|IMEI (pipe separator)
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Default Condition for All</Label>
                    <Select value={condition} onValueChange={(v) => setCondition(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="used">Used</SelectItem>
                        <SelectItem value="refurbished">Refurbished</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                        <SelectItem value="defective">Defective</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="button" onClick={processBulkEntry} size="sm">
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Process Bulk Entry
                </Button>
              </div>
            )}

            {/* Scan Mode */}
            {entryMode === 'scan' && (
              <div className="bg-white dark:bg-gray-900">
                {/* Scanner-optimized input area */}
                <div className="bg-green-50 dark:bg-green-950 border-2 border-green-300 dark:border-green-700 rounded-lg p-8">
                  <div className="text-center mb-6">
                    <QrCodeIcon className="w-16 h-16 mx-auto mb-3 text-green-600 dark:text-green-400 animate-pulse" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      Barcode Scanner Mode
                    </h3>
                    <p className="text-lg font-semibold text-green-700 dark:text-green-300 mb-2">
                      {serialNumbers.length} / {requiredCount} Scanned
                    </p>
                    <div className="w-full max-w-md mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4">
                      <div
                        className="bg-green-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${(serialNumbers.length / requiredCount) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {requiredCount - serialNumbers.length} remaining
                    </p>
                  </div>

                  <div className="max-w-2xl mx-auto">
                    <Input
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      placeholder="Ready to scan..."
                      className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-3 border-green-500 dark:border-green-600 text-center text-2xl font-mono h-16 focus:ring-4 focus:ring-green-300 font-bold"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (serialNumber.trim()) {
                            // Check duplicate
                            if (serialNumbers.some(sn => sn.serialNumber === serialNumber.trim())) {
                              toast.error('Duplicate serial number!')
                              setSerialNumber('')
                              return
                            }

                            const sn: SerialNumberData = {
                              serialNumber: serialNumber.trim(),
                              condition: 'new'
                            }
                            const updated = [...serialNumbers, sn]
                            setSerialNumbers(updated)
                            onSerialNumbersChange(updated)
                            setSerialNumber('')

                            // Auto-close when done
                            if (updated.length === requiredCount) {
                              setIsOpen(false)
                              toast.success(`All ${requiredCount} serial numbers scanned!`)
                            }
                          }
                        }
                      }}
                    />
                    <p className="text-sm text-center text-gray-600 dark:text-gray-400 mt-3">
                      🎯 Scan barcode → Scanner sends Enter → Auto-added → Ready for next scan
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* CSV Import Mode */}
            {entryMode === 'csv' && (
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                    📋 CSV Import with Product & Supplier Information
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
                    Download the template CSV file pre-filled with product, supplier, and date information.
                    Fill in the serial numbers and upload it back.
                  </p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-white dark:bg-gray-800 p-2 rounded">
                        <span className="text-gray-600 dark:text-gray-400">Product:</span>
                        <span className="ml-2 font-medium">{productName}</span>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-2 rounded">
                        <span className="text-gray-600 dark:text-gray-400">Supplier:</span>
                        <span className="ml-2 font-medium">{supplierName || 'N/A'}</span>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-2 rounded">
                        <span className="text-gray-600 dark:text-gray-400">Date Received:</span>
                        <span className="ml-2 font-medium">{dateReceived || 'Today'}</span>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-2 rounded">
                        <span className="text-gray-600 dark:text-gray-400">Imported By:</span>
                        <span className="ml-2 font-medium">{userName || 'Current User'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Download Template */}
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                  <ArrowDownTrayIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <h4 className="font-semibold mb-2">Step 1: Download Template</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Download the CSV template with {requiredCount} empty rows
                  </p>
                  <Button
                    type="button"
                    onClick={downloadTemplate}
                    variant="outline"
                    className="gap-2"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    Download CSV Template
                  </Button>
                </div>

                {/* Upload Filled CSV */}
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                  <ArrowUpTrayIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <h4 className="font-semibold mb-2">Step 2: Upload Filled Template</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Fill in the serial numbers in Excel/Google Sheets and upload the CSV
                  </p>
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Button
                      type="button"
                      variant="default"
                      className="gap-2"
                      onClick={() => document.getElementById('csv-upload')?.click()}
                    >
                      <ArrowUpTrayIcon className="w-4 h-4" />
                      Upload CSV File
                    </Button>
                  </label>
                  <input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                </div>

                {/* Template Format Info */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm">
                  <h5 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">CSV Format:</h5>
                  <pre className="bg-white dark:bg-gray-900 p-3 rounded border text-xs overflow-x-auto text-gray-900 dark:text-gray-100">
{`# Lines starting with # are comments (ignored)
Serial Number,IMEI (Optional),Condition
SN123456789,,new
SN123456790,123456789012345,used
SN123456791,,refurbished`}
                  </pre>
                  <div className="mt-3 space-y-2 text-gray-700 dark:text-gray-300">
                    <p className="font-medium">✓ Important Tips:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Serial numbers can be in ANY column (A, B, C, D, etc.)</li>
                      <li>Put each serial number in its own row</li>
                      <li>Delete the placeholder numbers (15, 16, 17...) and replace with actual serial numbers</li>
                      <li>Leave IMEI empty if not applicable (use blank or empty cell)</li>
                      <li>Conditions: new, used, refurbished, damaged, defective</li>
                      <li>Save as CSV format before uploading</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Serial Numbers List */}
            <div className="border-t border-gray-300 dark:border-gray-700 pt-4 bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-gray-900 dark:text-gray-100">Entered Serial Numbers ({serialNumbers.length})</Label>
                {serialNumbers.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearAll}
                  >
                    Clear All
                  </Button>
                )}
              </div>

              {serialNumbers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No serial numbers entered yet
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {serialNumbers.map((sn, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-sm font-mono font-semibold">
                          {sn.serialNumber}
                        </span>
                        {sn.imei && (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            IMEI: {sn.imei}
                          </span>
                        )}
                        <Badge variant={sn.condition === 'new' ? 'default' : 'secondary'}>
                          {sn.condition}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSerialNumber(index)}
                      >
                        <TrashIcon className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Warning if missing */}
            {serialNumbers.length < requiredCount && (
              <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3">
                <p className="text-sm text-yellow-900 dark:text-yellow-100 font-medium">
                  ⚠️ Missing {requiredCount - serialNumbers.length} serial number(s).
                  Please enter all serial numbers before approving GRN.
                </p>
              </div>
            )}

            {/* Complete message */}
            {isComplete && (
              <div className="bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-lg p-3">
                <p className="text-sm text-green-900 dark:text-green-100 font-medium">
                  ✅ All {requiredCount} serial numbers entered successfully!
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Show entered count below button */}
      {serialNumbers.length > 0 && (
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {serialNumbers.map(sn => sn.serialNumber).join(', ').slice(0, 50)}
          {serialNumbers.map(sn => sn.serialNumber).join(', ').length > 50 && '...'}
        </div>
      )}
    </div>
  )
}
