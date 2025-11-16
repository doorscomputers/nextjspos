"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChartBarIcon
} from "@heroicons/react/24/outline"
import Link from "next/link"

interface ReconciliationSummary {
  totalVariances: number
  requiresInvestigation: number
  autoFixable: number
  totalVarianceValue: number
  healthPercentage: number
  lastCheckTime?: string
}

/**
 * Stock Health Widget Component
 *
 * Displays inventory reconciliation status on the main dashboard.
 * Shows quick summary of stock health and variance alerts.
 *
 * Features:
 * - Real-time health percentage indicator
 * - Variance count and value display
 * - Color-coded status (green/yellow/red)
 * - Quick link to full reconciliation report
 * - Refresh button for manual check
 *
 * Usage:
 * ```tsx
 * <StockHealthWidget />
 * ```
 */
export function StockHealthWidget() {
  const { data: session } = useSession()
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = async (showRefreshing = false) => {
    if (!session?.user?.businessId) return

    if (showRefreshing) setRefreshing(true)
    setError(null)

    try {
      const response = await fetch("/api/reports/reconciliation?summary=true", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch reconciliation summary")
      }

      const data = await response.json()

      // Calculate health percentage from data
      const totalProducts = data.totalProducts || 0
      const varianceCount = data.summary?.totalVariances || 0
      const healthPercentage = totalProducts > 0
        ? ((totalProducts - varianceCount) / totalProducts) * 100
        : 100

      setSummary({
        totalVariances: data.summary?.totalVariances || 0,
        requiresInvestigation: data.summary?.requiresInvestigation || 0,
        autoFixable: data.summary?.autoFixable || 0,
        totalVarianceValue: data.summary?.totalVarianceValue || 0,
        healthPercentage: healthPercentage,
        lastCheckTime: new Date().toISOString(),
      })
    } catch (err: any) {
      console.error("Failed to fetch reconciliation summary:", err)
      setError(err.message)
    } finally {
      setLoading(false)
      if (showRefreshing) setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchSummary()

    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      fetchSummary()
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [session])

  // Get status color based on health percentage
  const getHealthStatus = () => {
    if (!summary) return { color: "gray", label: "Unknown", variant: "secondary" as const }

    if (summary.healthPercentage >= 95) {
      return { color: "green", label: "Excellent", variant: "success" as const }
    } else if (summary.healthPercentage >= 85) {
      return { color: "yellow", label: "Good", variant: "default" as const }
    } else if (summary.healthPercentage >= 70) {
      return { color: "orange", label: "Fair", variant: "default" as const }
    } else {
      return { color: "red", label: "Critical", variant: "destructive" as const }
    }
  }

  const status = getHealthStatus()

  // Loading State
  if (loading) {
    return (
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error State
  if (error) {
    return (
      <Card className="border-2 border-red-200 dark:border-red-900">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
            <CardTitle className="text-base">Stock Health</CardTitle>
          </div>
          <CardDescription>Failed to load reconciliation data</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSummary(true)}
            className="w-full"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`border-2 transition-all ${
      status.color === "green"
        ? "border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20"
        : status.color === "yellow"
        ? "border-yellow-200 dark:border-yellow-900 bg-yellow-50/50 dark:bg-yellow-950/20"
        : status.color === "red"
        ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20"
        : "border-gray-200 dark:border-gray-800"
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status.color === "green" ? (
              <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <ExclamationTriangleIcon className={`h-5 w-5 ${
                status.color === "red"
                  ? "text-red-600 dark:text-red-400"
                  : "text-yellow-600 dark:text-yellow-400"
              }`} />
            )}
            <CardTitle className="text-base">Stock Health</CardTitle>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <CardDescription className="text-xs">
          {summary?.lastCheckTime && (
            <>Last checked: {new Date(summary.lastCheckTime).toLocaleTimeString()}</>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Health Percentage */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-muted-foreground">System Health</span>
            <span className={`text-3xl font-bold ${
              status.color === "green"
                ? "text-green-600 dark:text-green-400"
                : status.color === "yellow"
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              {summary?.healthPercentage.toFixed(1)}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                status.color === "green"
                  ? "bg-green-500"
                  : status.color === "yellow"
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${summary?.healthPercentage || 0}%` }}
            />
          </div>
        </div>

        {/* Variance Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background rounded-lg p-3 border">
            <div className="text-xs text-muted-foreground mb-1">Total Variances</div>
            <div className={`text-2xl font-bold ${
              (summary?.totalVariances || 0) > 0
                ? "text-red-600 dark:text-red-400"
                : "text-green-600 dark:text-green-400"
            }`}>
              {summary?.totalVariances || 0}
            </div>
          </div>

          <div className="bg-background rounded-lg p-3 border">
            <div className="text-xs text-muted-foreground mb-1">Needs Review</div>
            <div className={`text-2xl font-bold ${
              (summary?.requiresInvestigation || 0) > 0
                ? "text-orange-600 dark:text-orange-400"
                : "text-green-600 dark:text-green-400"
            }`}>
              {summary?.requiresInvestigation || 0}
            </div>
          </div>
        </div>

        {/* Variance Value */}
        {summary && summary.totalVarianceValue !== 0 && (
          <div className="bg-background rounded-lg p-3 border border-red-200 dark:border-red-900">
            <div className="text-xs text-muted-foreground mb-1">Total Variance Value</div>
            <div className="text-xl font-bold text-red-600 dark:text-red-400">
              ₱{Math.abs(summary.totalVarianceValue).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Link href="/dashboard/reports/reconciliation" className="flex-1">
            <Button variant="default" size="sm" className="w-full gap-2">
              <ChartBarIcon className="h-4 w-4" />
              View Report
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSummary(true)}
            disabled={refreshing}
          >
            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Alert Message */}
        {summary && summary.requiresInvestigation > 0 && (
          <div className="bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-900 rounded-lg p-3">
            <p className="text-xs text-orange-800 dark:text-orange-200 font-medium">
              ⚠️ {summary.requiresInvestigation} variance{summary.requiresInvestigation !== 1 ? "s" : ""} require{summary.requiresInvestigation === 1 ? "s" : ""} immediate investigation
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
