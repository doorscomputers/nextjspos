"use client"

import { useState, useEffect, useCallback } from "react"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ShoppingCartIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline"

interface PurchaseSuggestion {
  productId: number
  productName: string
  variationId: number
  variationName: string
  sku: string
  category: string
  supplierId: number | null
  supplierName: string
  hasSupplier: boolean
  currentStock: number
  reorderPoint: number
  suggestedOrderQty: number
  avgDailySales: number
  daysUntilStockout: number
  leadTimeDays: number
  safetyStockDays: number
  unitCost: number
  estimatedOrderValue: number
  urgency: "critical" | "high" | "medium" | "low"
  locations: Array<{
    locationId: number
    locationName: string
    currentStock: number
    avgDailySales: number
  }>
}

interface SuggestionsData {
  summary: {
    totalProductsAnalyzed: number
    productsNeedingReorder: number
    totalSuggestedOrderValue: number
    criticalItems: number
    highPriorityItems: number
    mediumPriorityItems: number
    lowPriorityItems: number
    productsWithoutSuppliers?: number
  }
  suggestions: PurchaseSuggestion[]
}

export default function PurchaseSuggestionsPage() {
  const { can, user } = usePermissions()
  const { toast } = useToast()
  const router = useRouter()
  const [data, setData] = useState<SuggestionsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())

  // Filters
  const [locationFilter, setLocationFilter] = useState("all")
  const [supplierFilter, setSupplierFilter] = useState("all")
  const [urgencyFilter, setUrgencyFilter] = useState("all")
  const [onlyEnabled, setOnlyEnabled] = useState(false)

  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [suppliers, setSuppliers] = useState<Array<{ id: number; name: string }>>([])

  // Generate PO Dialog
  const [showGeneratePODialog, setShowGeneratePODialog] = useState(false)
  const [selectedLocationForPO, setSelectedLocationForPO] = useState("")
  const [expectedDeliveryDays, setExpectedDeliveryDays] = useState("7")
  const [generatingPO, setGeneratingPO] = useState(false)

  // Assign Supplier Dialog
  const [showAssignSupplierDialog, setShowAssignSupplierDialog] = useState(false)
  const [assigningSupplier, setAssigningSupplier] = useState(false)
  const [selectedVariationForAssign, setSelectedVariationForAssign] = useState<number | null>(null)
  const [selectedSupplierForAssign, setSelectedSupplierForAssign] = useState("")

  // Fetch locations and suppliers for filters
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [locationsRes, suppliersRes] = await Promise.all([
          fetch("/api/locations"),
          fetch("/api/suppliers"),
        ])

        if (locationsRes.ok) {
          const locationsData = await locationsRes.json()
          setLocations(locationsData.data || [])
        }

        if (suppliersRes.ok) {
          const suppliersData = await suppliersRes.json()
          setSuppliers(suppliersData.data || [])
        }
      } catch (error) {
        console.error("Failed to fetch filters:", error)
      }
    }

    fetchFilters()
  }, [])

  // Fetch suggestions data
  const fetchSuggestions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (locationFilter !== "all") params.append("locationId", locationFilter)
      if (supplierFilter !== "all") params.append("supplierId", supplierFilter)
      if (urgencyFilter !== "all") params.append("urgency", urgencyFilter)
      if (onlyEnabled) params.append("onlyEnabled", "true")

      const response = await fetch(`/api/purchases/suggestions?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Failed to fetch suggestions")
      }

      const result = await response.json()
      setData(result.data)
    } catch (error) {
      console.error("Error fetching suggestions:", error)
    } finally {
      setLoading(false)
    }
  }, [locationFilter, supplierFilter, urgencyFilter, onlyEnabled])

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  // Permission check
  if (!can(PERMISSIONS.PURCHASE_VIEW)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">You do not have permission to view purchase suggestions.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const toggleItem = (variationId: number) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(variationId)) {
      newSelected.delete(variationId)
    } else {
      newSelected.add(variationId)
    }
    setSelectedItems(newSelected)
  }

  const toggleAll = () => {
    if (selectedItems.size === data?.suggestions.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(data?.suggestions.map(s => s.variationId) || []))
    }
  }

  const getUrgencyBadge = (urgency: string) => {
    const variants: Record<string, { color: string; text: string }> = {
      critical: { color: "bg-red-100 text-red-800 border-red-300", text: "CRITICAL" },
      high: { color: "bg-orange-100 text-orange-800 border-orange-300", text: "HIGH" },
      medium: { color: "bg-yellow-100 text-yellow-800 border-yellow-300", text: "MEDIUM" },
      low: { color: "bg-blue-100 text-blue-800 border-blue-300", text: "LOW" },
    }
    const variant = variants[urgency] || variants.low
    return (
      <Badge className={`${variant.color} border font-semibold`}>
        {variant.text}
      </Badge>
    )
  }

  const handlePrint = () => {
    window.print()
  }

  const handleGeneratePO = async () => {
    if (!selectedLocationForPO) {
      toast({
        title: "Location Required",
        description: "Please select a delivery location for the purchase orders.",
        variant: "destructive",
      })
      return
    }

    setGeneratingPO(true)

    try {
      // Get full suggestion data for selected items
      const selectedSuggestions = data?.suggestions.filter(s =>
        selectedItems.has(s.variationId)
      ) || []

      const response = await fetch("/api/purchases/generate-from-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          suggestions: selectedSuggestions,
          locationId: parseInt(selectedLocationForPO),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate purchase orders")
      }

      toast({
        title: "Purchase Orders Created",
        description: `Successfully created ${result.data.purchaseOrders.length} purchase order(s). Redirecting to purchase orders page...`,
      })

      // Clear selection and close dialog
      setSelectedItems(new Set())
      setShowGeneratePODialog(false)

      // Refresh suggestions
      fetchSuggestions()

      // Redirect to purchase orders page after a short delay
      setTimeout(() => {
        router.push("/dashboard/purchases")
      }, 2000)
    } catch (error) {
      console.error("Error generating PO:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate purchase orders",
        variant: "destructive",
      })
    } finally {
      setGeneratingPO(false)
    }
  }

  const openGeneratePODialog = () => {
    // Pre-select the first location if available
    if (locations.length > 0) {
      setSelectedLocationForPO(locations[0].id.toString())
    }
    setShowGeneratePODialog(true)
  }

  const openAssignSupplierDialog = (variationId: number) => {
    setSelectedVariationForAssign(variationId)
    setSelectedSupplierForAssign("")
    setShowAssignSupplierDialog(true)
  }

  const handleAssignSupplier = async () => {
    if (!selectedVariationForAssign || !selectedSupplierForAssign) {
      toast({
        title: "Missing Information",
        description: "Please select a supplier",
        variant: "destructive",
      })
      return
    }

    setAssigningSupplier(true)

    try {
      const response = await fetch(`/api/products/variations/${selectedVariationForAssign}/assign-supplier`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          supplierId: parseInt(selectedSupplierForAssign),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to assign supplier")
      }

      toast({
        title: "Supplier Assigned",
        description: `Supplier has been successfully assigned to this product.`,
      })

      // Close dialog and refresh suggestions
      setShowAssignSupplierDialog(false)
      setSelectedVariationForAssign(null)
      setSelectedSupplierForAssign("")
      fetchSuggestions()
    } catch (error) {
      console.error("Error assigning supplier:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign supplier",
        variant: "destructive",
      })
    } finally {
      setAssigningSupplier(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Print Header - Hidden on screen */}
      <div className="hidden print:block mb-6">
        <div className="text-center border-b-2 border-gray-300 pb-4">
          <h1 className="text-3xl font-bold">Purchase Order Suggestions</h1>
          <p className="text-lg">{user?.businessName}</p>
          <p className="text-sm">Generated: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
          <p className="text-sm">Generated by: {user?.name}</p>
        </div>
      </div>

      {/* Page Header - Hidden when printing */}
      <div className="print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Purchase Order Suggestions
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Smart inventory replenishment based on sales velocity
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => fetchSuggestions()}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              className="flex items-center gap-2"
            >
              <PrinterIcon className="h-4 w-4" />
              Print Report
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Critical Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {data.summary.criticalItems}
                </div>
                <p className="text-xs text-gray-500 mt-1">&lt; 3 days stock</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  High Priority
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {data.summary.highPriorityItems}
                </div>
                <p className="text-xs text-gray-500 mt-1">3-7 days stock</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Items Needing Reorder
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {data.summary.productsNeedingReorder}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  of {data.summary.totalProductsAnalyzed} analyzed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Estimated Order Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  ₱{data.summary.totalSuggestedOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-gray-500 mt-1">Total suggested orders</p>
              </CardContent>
            </Card>
          </div>

          {/* Warning Card for Products Without Suppliers */}
          {data.suggestions.filter(s => !s.hasSupplier).length > 0 && (
            <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                      ⚠️ Products Without Suppliers ({data.suggestions.filter(s => !s.hasSupplier).length})
                    </h3>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Some products needing reorder do not have suppliers assigned.
                      These products are highlighted in yellow in the table below.
                      You'll need to manually assign suppliers before generating purchase orders for these items.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Filters - Hidden when printing */}
      <Card className="print:hidden">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Location</label>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Supplier</label>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Urgency</label>
              <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Urgency Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Urgency Levels</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox
                  checked={onlyEnabled}
                  onCheckedChange={(checked) => setOnlyEnabled(checked === true)}
                />
                <span className="text-sm font-medium">Auto-reorder enabled only</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggestions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Purchase Suggestions</span>
            {selectedItems.size > 0 && (
              <span className="text-sm font-normal text-gray-600 dark:text-gray-400">
                {selectedItems.size} item(s) selected
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">
                Analyzing sales data and calculating reorder needs...
              </span>
            </div>
          ) : data?.suggestions.length === 0 ? (
            <div className="text-center py-12">
              <ExclamationTriangleIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                No products need reordering at this time.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                All inventory levels are above reorder points.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 print:hidden">
                      <Checkbox
                        checked={selectedItems.size === data?.suggestions.length && data?.suggestions.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Reorder Point</TableHead>
                    <TableHead className="text-right">Suggested Qty</TableHead>
                    <TableHead className="text-right">Avg Daily Sales</TableHead>
                    <TableHead className="text-right">Days Left</TableHead>
                    <TableHead className="text-right">Est. Value</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead className="print:hidden">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.suggestions.map((suggestion) => (
                    <TableRow
                      key={suggestion.variationId}
                      className={!suggestion.hasSupplier ? "bg-yellow-50 dark:bg-yellow-900/10 hover:bg-yellow-100 dark:hover:bg-yellow-900/20" : ""}
                    >
                      <TableCell className="print:hidden">
                        <Checkbox
                          checked={selectedItems.has(suggestion.variationId)}
                          onCheckedChange={() => toggleItem(suggestion.variationId)}
                          disabled={!suggestion.hasSupplier}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {suggestion.productName}
                            {!suggestion.hasSupplier && (
                              <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">
                                No Supplier
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{suggestion.sku}</div>
                        </div>
                      </TableCell>
                      <TableCell>{suggestion.category}</TableCell>
                      <TableCell>
                        <span className={!suggestion.hasSupplier ? "text-yellow-700 font-semibold" : ""}>
                          {suggestion.supplierName}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{suggestion.currentStock}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{suggestion.reorderPoint}</TableCell>
                      <TableCell className="text-right font-semibold text-blue-600">
                        {suggestion.suggestedOrderQty}
                      </TableCell>
                      <TableCell className="text-right">{suggestion.avgDailySales}</TableCell>
                      <TableCell className="text-right">
                        <span className={suggestion.daysUntilStockout < 3 ? "text-red-600 font-semibold" : ""}>
                          {suggestion.daysUntilStockout.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        ₱{suggestion.estimatedOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{getUrgencyBadge(suggestion.urgency)}</TableCell>
                      <TableCell className="print:hidden">
                        {!suggestion.hasSupplier && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAssignSupplierDialog(suggestion.variationId)}
                            className="text-xs border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                          >
                            Assign Supplier
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons - Hidden when printing */}
      {selectedItems.size > 0 && (
        <Card className="print:hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedItems.size} item(s) selected • Estimated total value: ₱
                {data?.suggestions
                  .filter(s => selectedItems.has(s.variationId))
                  .reduce((sum, s) => sum + s.estimatedOrderValue, 0)
                  .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedItems(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  className="flex items-center gap-2"
                  disabled={!can(PERMISSIONS.PURCHASE_CREATE)}
                  onClick={openGeneratePODialog}
                >
                  <ShoppingCartIcon className="h-4 w-4" />
                  Generate Purchase Orders
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Print Footer - Hidden on screen */}
      <div className="hidden print:block mt-8 pt-4 border-t border-gray-300">
        <p className="text-xs text-gray-500 text-center">
          Report ID: SUGG-{new Date().getTime()} • Generated by {user?.businessName} POS System
        </p>
      </div>

      {/* Generate PO Dialog */}
      <Dialog open={showGeneratePODialog} onOpenChange={setShowGeneratePODialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Purchase Orders</DialogTitle>
            <DialogDescription>
              Create purchase orders for {selectedItems.size} selected product(s).
              Items will be grouped by supplier automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Delivery Location <span className="text-red-500">*</span>
              </label>
              <Select value={selectedLocationForPO} onValueChange={setSelectedLocationForPO}>
                <SelectTrigger>
                  <SelectValue placeholder="Select delivery location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Where should the ordered products be delivered?
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Expected Delivery (Days)
              </label>
              <Select value={expectedDeliveryDays} onValueChange={setExpectedDeliveryDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="5">5 days</SelectItem>
                  <SelectItem value="7">7 days (Default)</SelectItem>
                  <SelectItem value="10">10 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Expected time until delivery from supplier
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Summary
              </p>
              <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1">
                <li>• {selectedItems.size} product(s) selected</li>
                <li>
                  • Estimated total value: ₱
                  {data?.suggestions
                    .filter((s) => selectedItems.has(s.variationId))
                    .reduce((sum, s) => sum + s.estimatedOrderValue, 0)
                    .toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                </li>
                <li>
                  • Unique suppliers:{" "}
                  {
                    new Set(
                      data?.suggestions
                        .filter((s) => selectedItems.has(s.variationId))
                        .map((s) => s.supplierId)
                    ).size
                  }
                </li>
              </ul>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                One purchase order will be created per supplier
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowGeneratePODialog(false)}
              disabled={generatingPO}
            >
              Cancel
            </Button>
            <Button onClick={handleGeneratePO} disabled={generatingPO || !selectedLocationForPO}>
              {generatingPO ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <ShoppingCartIcon className="h-4 w-4 mr-2" />
                  Generate Purchase Orders
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Supplier Dialog */}
      <Dialog open={showAssignSupplierDialog} onOpenChange={setShowAssignSupplierDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Supplier to Product</DialogTitle>
            <DialogDescription>
              Select a supplier for this product to enable purchase order generation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ℹ️ This product currently has no supplier assigned. Assigning a supplier will allow
                you to include this product in automatic purchase order generation.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Select Supplier <span className="text-red-500">*</span>
              </label>
              <Select value={selectedSupplierForAssign} onValueChange={setSelectedSupplierForAssign}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                The supplier you assign will be the default for this product
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAssignSupplierDialog(false)}
              disabled={assigningSupplier}
            >
              Cancel
            </Button>
            <Button onClick={handleAssignSupplier} disabled={assigningSupplier || !selectedSupplierForAssign}>
              {assigningSupplier ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign Supplier"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
