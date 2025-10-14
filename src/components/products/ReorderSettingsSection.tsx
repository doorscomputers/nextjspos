"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ArrowPathIcon, SparklesIcon, InformationCircleIcon } from "@heroicons/react/24/outline"
import { useToast } from "@/hooks/use-toast"

interface ReorderSettingsSectionProps {
  productId?: number // Optional for add form (will be null)
  enableAutoReorder: boolean
  reorderPoint: string
  reorderQuantity: string
  leadTimeDays: string
  safetyStockDays: string
  onEnableAutoReorderChange: (enabled: boolean) => void
  onReorderPointChange: (value: string) => void
  onReorderQuantityChange: (value: string) => void
  onLeadTimeDaysChange: (value: string) => void
  onSafetyStockDaysChange: (value: string) => void
}

interface CalculatedSuggestions {
  hasSalesData: boolean
  totalSalesLast30Days?: number
  avgDailySales: number
  suggestedReorderPoint: number
  suggestedReorderQuantity: number
  suggestedLeadTimeDays: number
  suggestedSafetyStockDays: number
  message?: string
}

export default function ReorderSettingsSection({
  productId,
  enableAutoReorder,
  reorderPoint,
  reorderQuantity,
  leadTimeDays,
  safetyStockDays,
  onEnableAutoReorderChange,
  onReorderPointChange,
  onReorderQuantityChange,
  onLeadTimeDaysChange,
  onSafetyStockDaysChange,
}: ReorderSettingsSectionProps) {
  const { toast } = useToast()
  const [calculating, setCalculating] = useState(false)
  const [suggestions, setSuggestions] = useState<CalculatedSuggestions | null>(null)

  const handleCalculateFromSales = async () => {
    if (!productId) {
      toast({
        title: "Save Product First",
        description: "Please save the product before calculating reorder settings from sales data.",
        variant: "destructive",
      })
      return
    }

    setCalculating(true)

    try {
      const response = await fetch(`/api/products/${productId}/calculate-reorder`)

      if (!response.ok) {
        throw new Error("Failed to calculate reorder settings")
      }

      const result = await response.json()
      setSuggestions(result.data)

      if (result.data.hasSalesData) {
        toast({
          title: "Calculations Complete",
          description: `Based on ${result.data.totalSalesLast30Days} units sold in the last 30 days.`,
        })
      } else {
        toast({
          title: "No Sales Data",
          description: result.data.message || "No sales data found for this product.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error calculating reorder settings:", error)
      toast({
        title: "Calculation Failed",
        description: error instanceof Error ? error.message : "Failed to calculate reorder settings",
        variant: "destructive",
      })
    } finally {
      setCalculating(false)
    }
  }

  const applySuggestions = () => {
    if (!suggestions || !suggestions.hasSalesData) return

    onReorderPointChange(suggestions.suggestedReorderPoint.toString())
    onReorderQuantityChange(suggestions.suggestedReorderQuantity.toString())
    onLeadTimeDaysChange(suggestions.suggestedLeadTimeDays.toString())
    onSafetyStockDaysChange(suggestions.suggestedSafetyStockDays.toString())

    toast({
      title: "Suggestions Applied",
      description: "AI-calculated values have been applied to the form.",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-blue-600" />
          Automatic Reorder Settings
        </CardTitle>
        <CardDescription>
          Enable smart inventory replenishment based on sales velocity and stock levels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable Auto Reorder */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="enableAutoReorder"
            checked={enableAutoReorder}
            onCheckedChange={(checked) => onEnableAutoReorderChange(checked === true)}
          />
          <Label htmlFor="enableAutoReorder" className="font-semibold cursor-pointer">
            Enable automatic reorder suggestions for this product
          </Label>
        </div>

        {enableAutoReorder && (
          <>
            {/* Calculate from Sales Button */}
            {productId && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <InformationCircleIcon className="h-5 w-5 text-blue-600" />
                      <p className="font-semibold text-blue-900 dark:text-blue-100">
                        AI-Powered Calculation
                      </p>
                    </div>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Let our AI analyze your sales data from the last 30 days and suggest optimal
                      reorder settings.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCalculateFromSales}
                    disabled={calculating}
                    className="ml-4"
                  >
                    {calculating ? (
                      <>
                        <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                        Calculating...
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="h-4 w-4 mr-2" />
                        Calculate from Sales
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Suggestions Display */}
            {suggestions && suggestions.hasSalesData && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-green-900 dark:text-green-100">
                    AI Suggestions (Based on {suggestions.avgDailySales} units/day)
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={applySuggestions}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Apply Suggestions
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-green-700 dark:text-green-300 font-medium">Reorder Point</p>
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      {suggestions.suggestedReorderPoint} units
                    </Badge>
                  </div>
                  <div>
                    <p className="text-green-700 dark:text-green-300 font-medium">Order Quantity</p>
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      {suggestions.suggestedReorderQuantity} units
                    </Badge>
                  </div>
                  <div>
                    <p className="text-green-700 dark:text-green-300 font-medium">Lead Time</p>
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      {suggestions.suggestedLeadTimeDays} days
                    </Badge>
                  </div>
                  <div>
                    <p className="text-green-700 dark:text-green-300 font-medium">Safety Stock</p>
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      {suggestions.suggestedSafetyStockDays} days
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Input Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reorderPoint">
                  Reorder Point <span className="text-xs text-gray-500">(units)</span>
                </Label>
                <Input
                  id="reorderPoint"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g., 100"
                  value={reorderPoint}
                  onChange={(e) => onReorderPointChange(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Alert when stock falls below this level
                </p>
              </div>

              <div>
                <Label htmlFor="reorderQuantity">
                  Reorder Quantity <span className="text-xs text-gray-500">(units)</span>
                </Label>
                <Input
                  id="reorderQuantity"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g., 200"
                  value={reorderQuantity}
                  onChange={(e) => onReorderQuantityChange(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">How many units to order</p>
              </div>

              <div>
                <Label htmlFor="leadTimeDays">
                  Lead Time <span className="text-xs text-gray-500">(days)</span>
                </Label>
                <Input
                  id="leadTimeDays"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g., 7"
                  value={leadTimeDays}
                  onChange={(e) => onLeadTimeDaysChange(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Supplier delivery time</p>
              </div>

              <div>
                <Label htmlFor="safetyStockDays">
                  Safety Stock <span className="text-xs text-gray-500">(days)</span>
                </Label>
                <Input
                  id="safetyStockDays"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g., 3"
                  value={safetyStockDays}
                  onChange={(e) => onSafetyStockDaysChange(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Buffer stock in days</p>
              </div>
            </div>

            {/* Formula Information */}
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Reorder Point Formula:
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                (Avg Daily Sales × Lead Time) + (Avg Daily Sales × Safety Stock Days)
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
