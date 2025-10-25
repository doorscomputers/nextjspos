'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ClockIcon,
  BanknotesIcon,
  ShoppingCartIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

interface CurrentShift {
  id: number
  shiftNumber: string
  openedAt: string
  locationName: string
  beginningCash: number
  systemCash: number
  transactionCount: number
  hoursSinceOpen: number
  daysSinceOpen: number
  isOverdue: boolean
}

export default function CurrentShiftWidget() {
  const router = useRouter()
  const [shift, setShift] = useState<CurrentShift | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkCurrentShift()
    // Refresh every 5 minutes
    const interval = setInterval(checkCurrentShift, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const checkCurrentShift = async () => {
    try {
      const response = await fetch('/api/shifts/check-unclosed')
      const data = await response.json()

      if (data.hasUnclosedShift) {
        setShift(data.shift)
      } else {
        setShift(null)
      }
    } catch (error) {
      console.error('Error checking current shift:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  if (loading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Current Shift</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!shift) {
    return (
      <Card className="shadow-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center justify-between">
            <span>Current Shift</span>
            <Badge variant="outline" className="text-gray-500">No Active Shift</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8">
            <ClockIcon className="h-16 w-16 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">No shift is currently active</p>
            <Button
              onClick={() => router.push('/dashboard/shifts/begin')}
              className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg"
            >
              Start New Shift
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`shadow-lg border-2 ${shift.isOverdue ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-green-500 bg-green-50 dark:bg-green-900/10'}`}>
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center justify-between">
          <span>Current Shift</span>
          <Badge className={shift.isOverdue ? 'bg-red-600' : 'bg-green-600'}>
            {shift.isOverdue ? '⚠️ OVERDUE' : '✓ Active'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Shift Number & Location */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Shift Number</div>
          <div className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">{shift.shiftNumber}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{shift.locationName}</div>
        </div>

        {/* Duration */}
        <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
          <div className={`p-2 rounded-full ${shift.isOverdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
            <ClockIcon className={`h-5 w-5 ${shift.isOverdue ? 'text-red-600' : 'text-blue-600'}`} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Duration</div>
            <div className={`font-bold ${shift.isOverdue ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
              {shift.daysSinceOpen > 0
                ? `${shift.daysSinceOpen}d ${shift.hoursSinceOpen % 24}h`
                : `${shift.hoursSinceOpen}h`
              }
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Started: {formatTime(shift.openedAt)}</div>
          </div>
        </div>

        {/* Financial Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <BanknotesIcon className="h-4 w-4 text-green-600" />
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">System Cash</div>
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(shift.systemCash)}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCartIcon className="h-4 w-4 text-blue-600" />
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Transactions</div>
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{shift.transactionCount}</div>
          </div>
        </div>

        {shift.isOverdue && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-3">
            <p className="text-xs font-semibold text-red-800 dark:text-red-200">
              ⚠️ This shift is overdue! Please close it immediately for BIR compliance.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => router.push('/dashboard/pos')}
            variant="outline"
            className="flex-1 border-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            size="sm"
          >
            Continue
          </Button>
          <Button
            onClick={() => router.push('/dashboard/shifts/close')}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg"
            size="sm"
          >
            Close Shift
            <ArrowRightIcon className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
