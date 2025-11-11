'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ExclamationTriangleIcon, ClockIcon, CalendarIcon, BanknotesIcon } from '@heroicons/react/24/outline'

interface UnclosedShift {
  id: number
  shiftNumber: string
  openedAt: string
  locationName: string
  locationId: number
  beginningCash: number
  systemCash: number
  transactionCount: number
  hoursSinceOpen: number
  daysSinceOpen: number
  isOverdue: boolean
  openingNotes?: string
}

export default function UnclosedShiftWarning() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState<UnclosedShift | null>(null)
  const [loading, setLoading] = useState(true)
  const [navigating, setNavigating] = useState(false)
  const [forceClosing, setForceClosing] = useState(false)
  const [forceCloseError, setForceCloseError] = useState('')

  useEffect(() => {
    checkUnclosedShift()
  }, [])

  const checkUnclosedShift = async () => {
    try {
      const response = await fetch('/api/shifts/check-unclosed')
      const data = await response.json()

      // Only show warning if:
      // 1. There is an unclosed shift AND
      // 2. The API says we should show a warning (different day OR 9+ hours)
      if (data.hasUnclosedShift && data.shouldShowWarning) {
        setShift(data.shift)
        setOpen(true)
      }
    } catch (error) {
      console.error('Error checking unclosed shift:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCloseShift = () => {
    // DON'T close the modal - keep it open so user can't escape back to dashboard
    // The modal will disappear only when the shift is actually closed
    // setOpen(false) // REMOVED: This was causing the modal to disappear

    // Show loading state
    setNavigating(true)

    // Navigate to close shift page
    // The modal will remain visible as a "barrier" until shift is properly closed
    router.push(`/dashboard/shifts/close?shiftId=${shift?.id}`)
  }

  const handleForceClose = async () => {
    if (!shift) return

    setForceClosing(true)
    setForceCloseError('')

    try {
      const response = await fetch('/api/shifts/force-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: shift.id,
          reason: `Shift too old (${shift.daysSinceOpen} days) - readings would timeout`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to force-close shift')
      }

      // Success - reload the page to clear the warning
      window.location.reload()
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to force-close shift'
      console.error('[Force-Close Error]:', errorMsg)

      // Show user-friendly error
      if (errorMsg.includes('Forbidden')) {
        setForceCloseError('Permission denied. Please contact your manager/admin.')
      } else {
        setForceCloseError(`${errorMsg}. Please try normal close instead.`)
      }
      setForceClosing(false)
    }
  }

  // REMOVED: These handlers allowed users to bypass closing the old shift
  // const handleContinueShift = () => {
  //   setOpen(false)
  //   router.push('/dashboard/pos')
  // }

  // const handleDismiss = () => {
  //   setOpen(false)
  // }

  if (!shift) return null

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <Dialog open={open} onOpenChange={() => {}} modal>
      <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-3 rounded-full ${shift.isOverdue ? 'bg-red-100' : 'bg-orange-100'}`}>
              <ExclamationTriangleIcon className={`h-8 w-8 ${shift.isOverdue ? 'text-red-600' : 'text-orange-600'}`} />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold">
                {shift.isOverdue ? 'CRITICAL: Unclosed Shift from Previous Day!' : 'Unclosed Shift Warning'}
              </DialogTitle>
              <DialogDescription className="text-base mt-1">
                {shift.isOverdue
                  ? 'This shift was opened yesterday or earlier and must be closed immediately'
                  : `This shift has been open for ${shift.hoursSinceOpen} hours`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {shift.isOverdue && (
          <Alert variant="destructive" className="mb-4">
            <ExclamationTriangleIcon className="h-5 w-5" />
            <AlertDescription className="font-semibold">
              This shift was opened yesterday or earlier. BIR compliance requires daily Z readings!
            </AlertDescription>
          </Alert>
        )}

        {!shift.isOverdue && shift.hoursSinceOpen >= 12 && (
          <Alert className="mb-4 bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700">
            <ClockIcon className="h-5 w-5 text-orange-600" />
            <AlertDescription className="font-semibold text-orange-800 dark:text-orange-200">
              This shift has been open for {shift.hoursSinceOpen} hours. Consider closing it soon.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {/* Shift Details Card */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100 mb-3">Shift Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <div className="font-semibold text-blue-700 dark:text-blue-300 min-w-[120px]">Shift Number:</div>
                <div className="font-mono font-bold text-blue-900 dark:text-blue-100">{shift.shiftNumber}</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="font-semibold text-blue-700 dark:text-blue-300 min-w-[120px]">Location:</div>
                <div className="font-bold text-blue-900 dark:text-blue-100">{shift.locationName}</div>
              </div>
              <div className="flex items-start gap-2">
                <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-blue-700 dark:text-blue-300">Opened At:</div>
                  <div className="font-medium text-blue-900 dark:text-blue-100">{formatDateTime(shift.openedAt)}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ClockIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-blue-700 dark:text-blue-300">Duration:</div>
                  <div className={`font-bold ${shift.isOverdue ? 'text-red-600' : 'text-blue-900 dark:text-blue-100'}`}>
                    {shift.daysSinceOpen > 0
                      ? `${shift.daysSinceOpen} day(s), ${shift.hoursSinceOpen % 24} hour(s)`
                      : `${shift.hoursSinceOpen} hour(s)`
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 rounded-lg p-4">
            <h3 className="font-bold text-lg text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
              <BanknotesIcon className="h-6 w-6" />
              Financial Summary
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm font-semibold text-green-700 dark:text-green-300">Beginning Cash:</div>
                <div className="text-xl font-bold text-green-900 dark:text-green-100">{formatCurrency(shift.beginningCash)}</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-green-700 dark:text-green-300">Current System Cash:</div>
                <div className="text-xl font-bold text-green-900 dark:text-green-100">{formatCurrency(shift.systemCash)}</div>
              </div>
              <div className="col-span-2">
                <div className="text-sm font-semibold text-green-700 dark:text-green-300">Transactions Processed:</div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">{shift.transactionCount}</div>
              </div>
            </div>
          </div>

          {shift.openingNotes && (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Opening Notes:</div>
              <div className="text-sm text-gray-900 dark:text-gray-100 italic">{shift.openingNotes}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">
              You must close this shift to continue. This is required for BIR compliance and proper cash accountability.
            </h3>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-3 mb-3">
              <p className="text-xs text-green-800 dark:text-green-200 font-semibold">
                ✓ Normal close generates X-Reading and Z-Reading for BIR compliance
              </p>
            </div>

            <Button
              onClick={handleCloseShift}
              disabled={navigating || forceClosing}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              size="lg"
            >
              {navigating ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-3 inline-block" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Opening Close Shift Page...
                </>
              ) : (
                <>🔒 Close Shift with BIR Readings</>
              )}
            </Button>

            {/* Force-Close Option ONLY for EXTREMELY Old Shifts (2+ days) */}
            {/* BIR compliance requires readings for all shifts - only use for impossible cases */}
            {shift.daysSinceOpen >= 2 && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">
                      OR (if closing times out)
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleForceClose}
                  disabled={navigating || forceClosing}
                  variant="outline"
                  className="w-full border-2 border-orange-500 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950 font-bold py-5 text-base shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  size="lg"
                >
                  {forceClosing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-3 inline-block" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Force-Closing Shift...
                    </>
                  ) : (
                    <>⚡ Force-Close Shift (Skip Readings)</>
                  )}
                </Button>

                <p className="text-xs text-center text-red-600 dark:text-red-400 italic font-semibold">
                  ⚠️ WARNING: Force-close skips BIR-required readings. Only use if normal close fails repeatedly after multiple attempts.
                </p>
              </>
            )}

            {forceCloseError && (
              <Alert variant="destructive">
                <ExclamationTriangleIcon className="h-4 w-4" />
                <AlertDescription>{forceCloseError}</AlertDescription>
              </Alert>
            )}

            <p className="text-xs text-center text-gray-600 dark:text-gray-400 mt-2">
              Contact your manager if you need assistance closing this shift.
            </p>
          </div>

          {shift.isOverdue && (
            <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700">
              <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Important:</strong> This shift must be closed to generate the required Z reading for BIR compliance.
                Contact your manager/admin if you need assistance with force-closing this shift.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
