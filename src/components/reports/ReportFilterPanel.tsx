"use client"

import { ReactNode } from "react"
import { FunnelIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ReportFilterPanelProps {
  title?: string
  description?: string
  isOpen: boolean
  onToggle: () => void
  activeCount?: number
  onClearAll?: () => void
  clearLabel?: string
  children: ReactNode
  className?: string
  contentClassName?: string
  actions?: ReactNode
}

/**
 * Provides a consistent collapsible filter experience across report pages.
 * Mirrors the styling and interaction patterns used on the product and stock pages.
 */
export function ReportFilterPanel({
  title = "Search & Filter",
  description = "Refine the report data with advanced filters",
  isOpen,
  onToggle,
  activeCount = 0,
  onClearAll,
  clearLabel = "Reset Filters",
  children,
  className,
  contentClassName,
  actions,
}: ReportFilterPanelProps) {
  const hasActiveFilters = activeCount > 0

  return (
    <Card className={cn("border-slate-200 shadow-md hover:shadow-lg transition-shadow duration-300", className)}>
      <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/30">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold text-slate-800">
            <FunnelIcon className="h-5 w-5 text-blue-600" />
            {title}
            {hasActiveFilters && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                {activeCount} active
              </Badge>
            )}
          </CardTitle>
          {description && <p className="text-sm text-slate-600">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {hasActiveFilters && onClearAll && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              onClick={onClearAll}
            >
              <XMarkIcon className="h-4 w-4 mr-1" />
              {clearLabel}
            </Button>
          )}
          <Button
            type="button"
            variant={isOpen ? "default" : "secondary"}
            onClick={onToggle}
            className={cn(
              "shadow-sm hover:shadow-md transition-all",
              isOpen ? "bg-blue-600 hover:bg-blue-700" : "bg-white border border-slate-200 text-slate-700"
            )}
          >
            {isOpen ? "Hide Filters" : "Show Filters"}
          </Button>
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className={cn("pt-6 space-y-6 bg-white", contentClassName)}>
          {children}
        </CardContent>
      )}
    </Card>
  )
}

export default ReportFilterPanel
