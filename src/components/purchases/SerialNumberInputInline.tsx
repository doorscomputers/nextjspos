'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { XMarkIcon, QrCodeIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'

export interface SerialNumberData {
  serialNumber: string
  imei?: string
  condition: 'new' | 'used' | 'refurbished' | 'damaged' | 'defective'
}

interface SerialNumberInputInlineProps {
  requiredCount: number
  productName: string
  onSerialNumbersChange: (serialNumbers: SerialNumberData[]) => void
  initialSerialNumbers?: SerialNumberData[]
}

export function SerialNumberInputInline({
  requiredCount,
  productName,
  onSerialNumbersChange,
  initialSerialNumbers = [],
}: SerialNumberInputInlineProps) {
  const [serialNumbers, setSerialNumbers] = useState<SerialNumberData[]>(initialSerialNumbers)
  const [serialNumber, setSerialNumber] = useState('')

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
      condition: 'new'
    }

    const updated = [...serialNumbers, newSerialNumber]
    setSerialNumbers(updated)
    onSerialNumbersChange(updated)

    // Reset form
    setSerialNumber('')

    // Show brief success
    const remaining = requiredCount - updated.length
    if (remaining > 0) {
      toast.success(`Serial added! ${remaining} remaining.`)
    } else {
      toast.success(`All ${requiredCount} serial numbers entered!`)
    }
  }

  const removeSerialNumber = (index: number) => {
    const updated = serialNumbers.filter((_, i) => i !== index)
    setSerialNumbers(updated)
    onSerialNumbersChange(updated)
    toast.success('Serial number removed')
  }

  const progressPercentage = requiredCount > 0 ? (serialNumbers.length / requiredCount) * 100 : 0
  const isComplete = serialNumbers.length === requiredCount
  const isMissing = serialNumbers.length < requiredCount

  return (
    <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
      {/* Header with Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <QrCodeIcon className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold text-gray-900">Serial Numbers Required</h4>
          </div>
          <Badge variant={isComplete ? "default" : isMissing ? "destructive" : "secondary"}>
            {serialNumbers.length} / {requiredCount}
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all ${
              isComplete ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          />
        </div>
        <p className="text-sm text-gray-600">
          {isMissing ? `${requiredCount - serialNumbers.length} serial numbers remaining` : '✅ All serial numbers entered'}
        </p>
      </div>

      {/* Input Area */}
      {isMissing && (
        <div className="bg-white border border-blue-300 rounded-lg p-3">
          <div className="flex gap-2">
            <Input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Scan barcode or type serial number..."
              className="flex-1 font-mono"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSerialNumber()
                }
              }}
            />
            <Button
              type="button"
              onClick={addSerialNumber}
              disabled={!serialNumber.trim()}
            >
              Add
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Tip: Press Enter after scanning or typing each serial number
          </p>
        </div>
      )}

      {/* Serial Numbers List */}
      {serialNumbers.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700">Entered Serial Numbers:</h5>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {serialNumbers.map((sn, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
              >
                <span className="text-sm font-mono font-semibold text-gray-900">
                  {sn.serialNumber}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSerialNumber(index)}
                  className="h-6 w-6 p-0"
                >
                  <XMarkIcon className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning if missing */}
      {isMissing && serialNumbers.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2">
          <p className="text-xs text-yellow-800 font-medium">
            ⚠️ Still need {requiredCount - serialNumbers.length} more serial number(s)
          </p>
        </div>
      )}
    </div>
  )
}
