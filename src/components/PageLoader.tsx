"use client"

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export function PageLoader() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Show loading immediately
    setLoading(true)
    setProgress(20) // Start at 20% for instant feedback

    // Fast progress simulation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval)
          return 90
        }
        return prev + 15 // Faster increments
      })
    }, 50) // Faster intervals (50ms instead of 100ms)

    // Complete quickly
    const timeout = setTimeout(() => {
      setProgress(100)
      setTimeout(() => setLoading(false), 150) // Faster hide
    }, 400) // Much faster completion (400ms instead of 800ms)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [pathname])

  if (!loading) return null

  return (
    <>
      {/* Top progress bar - shows immediately */}
      <div className="fixed top-0 left-0 right-0 z-[9999]">
        <div
          className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-100 ease-out shadow-lg"
          style={{ width: `${progress}%` }}
        />
      </div>
    </>
  )
}
