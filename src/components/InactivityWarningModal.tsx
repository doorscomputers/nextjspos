"use client"

import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ExclamationTriangleIcon, ClockIcon } from '@heroicons/react/24/outline'

interface InactivityWarningModalProps {
  open: boolean
  onStayActive: () => void
  onLogout: () => void
  remainingSeconds: number
  customMessage?: string
}

export function InactivityWarningModal({
  open,
  onStayActive,
  onLogout,
  remainingSeconds,
  customMessage
}: InactivityWarningModalProps) {
  const [countdown, setCountdown] = useState(remainingSeconds)

  useEffect(() => {
    setCountdown(remainingSeconds)
  }, [remainingSeconds])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="bg-white dark:bg-gray-800 max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Session Timeout Warning
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-gray-600 dark:text-gray-300 space-y-3">
            <p className="text-base">
              {customMessage || 'You have been inactive. You will be logged out soon for security reasons.'}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-6">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-200 dark:border-amber-700 rounded-xl p-6 text-center">
            <div className="flex justify-center mb-3">
              <ClockIcon className="w-10 h-10 text-amber-600 dark:text-amber-400 animate-pulse" />
            </div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-2">
              Time Remaining
            </p>
            <p className="text-5xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {formatTime(countdown)}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-3">
              Click &quot;Stay Active&quot; to continue your session
            </p>
          </div>
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel
            onClick={onLogout}
            className="bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
          >
            Logout Now
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onStayActive}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold shadow-lg"
          >
            Stay Active
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
