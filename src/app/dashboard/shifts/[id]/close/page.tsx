'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Dynamic Route: /dashboard/shifts/[id]/close
 * Redirects to /dashboard/shifts/close?shiftId=[id]
 * This maintains backward compatibility with old links
 */
export default function DynamicShiftClosePage() {
  const params = useParams()
  const router = useRouter()
  const shiftId = params.id as string

  useEffect(() => {
    // Redirect to the actual close page with shiftId as query param
    if (shiftId) {
      router.replace(`/dashboard/shifts/close?shiftId=${shiftId}`)
    } else {
      router.replace('/dashboard/shifts/close')
    }
  }, [shiftId, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Redirecting to shift close page...</p>
      </div>
    </div>
  )
}
