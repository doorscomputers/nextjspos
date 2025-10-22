"use client"

import { useState, useEffect } from "react"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
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
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import {
  ArrowPathIcon,
  SparklesIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline"

interface Product {
  id: number
  name: string
  sku: string
  category: string
  enableAutoReorder: boolean
  reorderPoint: number | null
  reorderQuantity: number | null
  leadTimeDays: number | null
  safetyStockDays: number | null
}

export default function BulkReorderUpdatePage() {
  const { can } = usePermissions()
  const { toast } = useToast()
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set())
  const [updating, setUpdating] = useState(false)

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [autoReorderFilter, setAutoReorderFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  // Bulk settings
  const [bulkEnableAutoReorder, setBulkEnableAutoReorder] = useState("enable") // "enable" or "disable"
  const [bulkReorderPoint, setBulkReorderPoint] = useState("")
  const [bulkReorderQuantity, setBulkReorderQuantity] = useState("")
  const [bulkLeadTimeDays, setBulkLeadTimeDays] = useState("")
  const [bulkSafetyStockDays, setBulkSafetyStockDays] = useState("")

  const [applyEnableAutoReorder, setApplyEnableAutoReorder] = useState(false)
  const [applyReorderPoint, setApplyReorderPoint] = useState(false)
  const [applyReorderQuantity, setApplyReorderQuantity] = useState(false)
  const [applyLeadTimeDays, setApplyLeadTimeDays] = useState(false)
  const [applySafetyStockDays, setApplySafetyStockDays] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [])

  // Filter products whenever filters change
  useEffect(() => {
    let filtered = [...products]

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(p => p.category === categoryFilter)
    }

    // Auto-reorder status filter
    if (autoReorderFilter === "enabled") {
      filtered = filtered.filter(p => p.enableAutoReorder)
    } else if (autoReorderFilter === "disabled") {
      filtered = filtered.filter(p => !p.enableAutoReorder)
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term)
      )
    }

    setFilteredProducts(filtered)
  }, [products, categoryFilter, autoReorderFilter, searchTerm])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      // Only fetch products with stock tracking enabled (exclude services, etc.)
      const response = await fetch("/api/products?stockEnabled=true")

      if (!response.ok) {
        throw new Error("Failed to fetch products")
      }

      const result = await response.json()
      const productsData = result.products.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category?.name || "Uncategorized",
        enableAutoReorder: p.enableAutoReorder || false,
        reorderPoint: p.reorderPoint,
        reorderQuantity: p.reorderQuantity,
        leadTimeDays: p.leadTimeDays,
        safetyStockDays: p.safetyStockDays,
      }))

      setProducts(productsData)
    } catch (error) {
      console.error("Error fetching products:", error)
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleProduct = (productId: number) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
  }

  const toggleAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(filteredProducts.map((p) => p.id)))
    }
  }

  // Get unique categories from products
  const categories = Array.from(new Set(products.map(p => p.category))).sort()

  const handleBulkUpdate = async () => {
    if (selectedProducts.size === 0) {
      toast({
        title: "No Products Selected",
        description: "Please select at least one product to update.",
        variant: "destructive",
      })
      return
    }

    // Check if at least one setting is selected to apply
    if (
      !applyEnableAutoReorder &&
      !applyReorderPoint &&
      !applyReorderQuantity &&
      !applyLeadTimeDays &&
      !applySafetyStockDays
    ) {
      toast({
        title: "No Settings Selected",
        description: "Please select at least one setting to apply.",
        variant: "destructive",
      })
      return
    }

    setUpdating(true)

    try {
      const settings: any = {}

      if (applyEnableAutoReorder) {
        settings.enableAutoReorder = bulkEnableAutoReorder === "enable"
      }

      if (applyReorderPoint && bulkReorderPoint) {
        settings.reorderPoint = bulkReorderPoint
      }

      if (applyReorderQuantity && bulkReorderQuantity) {
        settings.reorderQuantity = bulkReorderQuantity
      }

      if (applyLeadTimeDays && bulkLeadTimeDays) {
        settings.leadTimeDays = bulkLeadTimeDays
      }

      if (applySafetyStockDays && bulkSafetyStockDays) {
        settings.safetyStockDays = bulkSafetyStockDays
      }

      const response = await fetch("/api/products/bulk-update-reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productIds: Array.from(selectedProducts),
          settings,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to update products")
      }

      toast({
        title: "Update Successful",
        description: `Updated ${result.data.updatedCount} product(s) successfully.`,
      })

      // Clear selections and refresh
      setSelectedProducts(new Set())
      fetchProducts()

      // Reset settings
      setApplyEnableAutoReorder(false)
      setApplyReorderPoint(false)
      setApplyReorderQuantity(false)
      setApplyLeadTimeDays(false)
      setApplySafetyStockDays(false)
    } catch (error) {
      console.error("Error updating products:", error)
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update products",
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  // Permission check
  if (!can(PERMISSIONS.PRODUCT_UPDATE)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">
              You do not have permission to update product reorder settings.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <SparklesIcon className="h-8 w-8 text-blue-600" />
            Bulk Update Reorder Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Update reorder settings for multiple products at once
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5" />
            Filter Products
          </CardTitle>
          <CardDescription>
            Filter products to find the ones you want to update
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <Label htmlFor="search">Search by Name or SKU</Label>
              <Input
                id="search"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Category Filter */}
            <div>
              <Label htmlFor="categoryFilter">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="categoryFilter" className="mt-1">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auto-Reorder Status Filter */}
            <div>
              <Label htmlFor="autoReorderFilter">Auto-Reorder Status</Label>
              <Select value={autoReorderFilter} onValueChange={setAutoReorderFilter}>
                <SelectTrigger id="autoReorderFilter" className="mt-1">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="enabled">Enabled Only</SelectItem>
                  <SelectItem value="disabled">Disabled Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredProducts.length} of {products.length} products
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("")
                setCategoryFilter("all")
                setAutoReorderFilter("all")
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Settings Form */}
      <Card>
        <CardHeader>
          <CardTitle>Apply Settings to Selected Products</CardTitle>
          <CardDescription>
            Choose which settings to apply and their values. Only selected settings will be updated.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Enable/Disable Auto Reorder */}
            <div className="flex items-start space-x-2 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
              <Checkbox
                id="applyEnableAutoReorder"
                checked={applyEnableAutoReorder}
                onCheckedChange={(checked) => setApplyEnableAutoReorder(checked === true)}
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="applyEnableAutoReorder" className="cursor-pointer font-semibold text-base">
                  Auto Reorder Status
                </Label>
                {applyEnableAutoReorder && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={bulkEnableAutoReorder === "enable" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setBulkEnableAutoReorder("enable")}
                        className="flex-1"
                      >
                        ✓ Enable
                      </Button>
                      <Button
                        type="button"
                        variant={bulkEnableAutoReorder === "disable" ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => setBulkEnableAutoReorder("disable")}
                        className="flex-1"
                      >
                        ✗ Disable
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {bulkEnableAutoReorder === "enable"
                        ? "Selected products will be monitored for auto-reorder"
                        : "Selected products will NOT be included in purchase suggestions"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Reorder Point */}
            <div className="flex items-start space-x-2 p-3 border rounded-lg">
              <Checkbox
                id="applyReorderPoint"
                checked={applyReorderPoint}
                onCheckedChange={(checked) => setApplyReorderPoint(checked === true)}
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="applyReorderPoint" className="cursor-pointer font-semibold">
                  Reorder Point
                </Label>
                {applyReorderPoint && (
                  <Input
                    type="number"
                    placeholder="e.g., 100"
                    value={bulkReorderPoint}
                    onChange={(e) => setBulkReorderPoint(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
            </div>

            {/* Reorder Quantity */}
            <div className="flex items-start space-x-2 p-3 border rounded-lg">
              <Checkbox
                id="applyReorderQuantity"
                checked={applyReorderQuantity}
                onCheckedChange={(checked) => setApplyReorderQuantity(checked === true)}
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="applyReorderQuantity" className="cursor-pointer font-semibold">
                  Reorder Quantity
                </Label>
                {applyReorderQuantity && (
                  <Input
                    type="number"
                    placeholder="e.g., 200"
                    value={bulkReorderQuantity}
                    onChange={(e) => setBulkReorderQuantity(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
            </div>

            {/* Lead Time Days */}
            <div className="flex items-start space-x-2 p-3 border rounded-lg">
              <Checkbox
                id="applyLeadTimeDays"
                checked={applyLeadTimeDays}
                onCheckedChange={(checked) => setApplyLeadTimeDays(checked === true)}
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="applyLeadTimeDays" className="cursor-pointer font-semibold">
                  Lead Time (Days)
                </Label>
                {applyLeadTimeDays && (
                  <Input
                    type="number"
                    placeholder="e.g., 7"
                    value={bulkLeadTimeDays}
                    onChange={(e) => setBulkLeadTimeDays(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
            </div>

            {/* Safety Stock Days */}
            <div className="flex items-start space-x-2 p-3 border rounded-lg col-span-1 md:col-span-2">
              <Checkbox
                id="applySafetyStockDays"
                checked={applySafetyStockDays}
                onCheckedChange={(checked) => setApplySafetyStockDays(checked === true)}
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="applySafetyStockDays" className="cursor-pointer font-semibold">
                  Safety Stock (Days)
                </Label>
                {applySafetyStockDays && (
                  <Input
                    type="number"
                    placeholder="e.g., 3"
                    value={bulkSafetyStockDays}
                    onChange={(e) => setBulkSafetyStockDays(e.target.value)}
                    className="mt-2 max-w-xs"
                  />
                )}
              </div>
            </div>
          </div>

          {selectedProducts.size > 0 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedProducts.size} product(s) selected
              </p>
              <Button onClick={handleBulkUpdate} disabled={updating}>
                {updating ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                    Apply to Selected Products
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Select Products</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-normal text-gray-600 dark:text-gray-400">
                {filteredProducts.length} products
              </span>
              {selectedProducts.size > 0 && (
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {selectedProducts.size} selected
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading products...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Auto Reorder</TableHead>
                    <TableHead className="text-right">Reorder Point</TableHead>
                    <TableHead className="text-right">Reorder Qty</TableHead>
                    <TableHead className="text-right">Lead Time</TableHead>
                    <TableHead className="text-right">Safety Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                        No products found matching your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedProducts.has(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.sku}</div>
                        </div>
                      </TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>
                        {product.enableAutoReorder ? (
                          <Badge className="bg-green-100 text-green-800 border-green-300">
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.reorderPoint ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.reorderQuantity ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.leadTimeDays ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.safetyStockDays ?? "-"}
                      </TableCell>
                    </TableRow>
                  )))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
