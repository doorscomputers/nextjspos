"use client"

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function LoadingBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const timeout = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(timeout)
  }, [pathname, searchParams])

  if (!loading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999]">
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-progress shadow-lg shadow-indigo-500/50" />
    </div>
  )
}
