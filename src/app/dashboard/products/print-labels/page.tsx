"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  MagnifyingGlassIcon,
  InformationCircleIcon,
  Cog6ToothIcon,
  XMarkIcon,
  PrinterIcon
} from "@heroicons/react/24/outline"

interface Product {
  id: number
  name: string
  sku: string
  type: string
  sellingPrice: number
  tax?: { amount: number } | null
  variations?: Array<{
    id: number
    name: string
    sku: string
    sellingPrice: number
    isDefault?: boolean
  }>
}

interface SearchResultItem {
  productId: number
  variationId: number | null
  productName: string
  variationName: string
  sku: string
  sellingPrice: number
  taxRate: number | null
}

interface LabelProduct {
  id: string
  productId: number
  variationId: number | null
  name: string
  variation: string
  sku: string
  price: number
  taxRate: number | null
  quantity: number
  packingDate: string
  priceGroup: string
}

export default function PrintLabelsPage() {
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<LabelProduct[]>([])
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Label settings state
  const [settings, setSettings] = useState({
    productName: true,
    productNameSize: 15,
    productVariation: true,
    productVariationSize: 17,
    productPrice: true,
    productPriceSize: 17,
    businessName: true,
    businessNameSize: 20,
    packingDate: true,
    packingDateSize: 12,
    showPrice: "inc_tax",
    barcodeFormat: "20_labels_4x1"
  })

  const barcodeFormats = [
    { value: "20_labels_4x1", label: "20 Labels per Sheet, Sheet Size: 8.5\" x 11\", Label Size: 4\" x 1\", Labels per sheet: 20" },
    { value: "30_labels_2.625x1", label: "30 Labels per Sheet, Sheet Size: 8.5\" x 11\", Label Size: 2.625\" x 1\", Labels per sheet: 30" },
    { value: "32_labels_2x1.25", label: "32 Labels per Sheet, Sheet Size: 8.5\" x 11\", Label Size: 2\" x 1.25\", Labels per sheet: 32" },
    { value: "40_labels_2x1", label: "40 Labels per Sheet, Sheet Size: 8.5\" x 11\", Label Size: 2\" x 1\", Labels per sheet: 40" },
    { value: "50_labels_1.5x1", label: "50 Labels per Sheet, Sheet Size: 8.5\" x 11\", Label Size: 1.5\" x 1\", Labels per sheet: 50" },
    { value: "continuous", label: "Continuous Rolls - 31.75mm x 25.4mm, Label Size: 31.75mm x 25.4mm, Gap: 3.18mm" }
  ]

  // Fetch products with variations
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch("/api/products?includeVariations=true")
        if (response.ok) {
          const data = await response.json()
          setProducts(data.products || data)
        }
      } catch (error) {
        console.error("Failed to fetch products:", error)
      }
    }
    fetchProducts()
  }, [])

  // Auto-add product from URL parameter
  useEffect(() => {
    const productId = searchParams.get('productId')
    if (productId && products.length > 0) {
      const product = products.find(p => p.id === parseInt(productId))
      if (product) {
        // Add the product's variations or the product itself
        if (product.type === 'variable' && product.variations && product.variations.length > 0) {
          // Add all variations of the product
          product.variations.forEach(variation => {
            const newProduct: LabelProduct = {
              id: `${variation.id}-${Date.now()}-${Math.random()}`,
              productId: product.id,
              variationId: variation.id,
              name: product.name,
              variation: variation.name,
              sku: variation.sku,
              price: variation.sellingPrice,
              taxRate: product.tax?.amount ?? null,
              quantity: 1,
              packingDate: new Date().toISOString().split('T')[0],
              priceGroup: 'default'
            }
            setSelectedProducts(prev => [...prev, newProduct])
          })
        } else {
          // Add single product
          const newProduct: LabelProduct = {
            id: `${product.id}-${Date.now()}`,
            productId: product.id,
            variationId: null,
            name: product.name,
            variation: 'Default',
            sku: product.sku,
            price: product.sellingPrice || 0,
            taxRate: product.tax?.amount ?? null,
            quantity: 1,
            packingDate: new Date().toISOString().split('T')[0],
            priceGroup: 'default'
          }
          setSelectedProducts([newProduct])
        }
      }
    }
  }, [searchParams, products])

  // Search products
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    const results: SearchResultItem[] = []
    const query = searchQuery.toLowerCase()

    products.forEach((product) => {
      if (product.type === 'variable' && product.variations) {
        // For variable products, show variations
        product.variations.forEach((variation) => {
          if (
            product.name.toLowerCase().includes(query) ||
            variation.name.toLowerCase().includes(query) ||
            variation.sku.toLowerCase().includes(query)
          ) {
            results.push({
              productId: product.id,
              variationId: variation.id,
              productName: product.name,
              variationName: variation.name,
              sku: variation.sku,
              sellingPrice: variation.sellingPrice,
              taxRate: product.tax?.amount ?? null
            })
          }
        })
      } else {
        // For single products
        if (
          product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query)
        ) {
          results.push({
            productId: product.id,
            variationId: null,
            productName: product.name,
            variationName: 'Default',
            sku: product.sku,
            sellingPrice: product.sellingPrice || 0,
            taxRate: product.tax?.amount ?? null
          })
        }
      }
    })

    setSearchResults(results)
    setShowSearchResults(results.length > 0)
  }, [searchQuery, products])

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addProduct = (result: SearchResultItem) => {
    const newProduct: LabelProduct = {
      id: `${result.productId}-${result.variationId ?? 'default'}-${Date.now()}`,
      productId: result.productId,
      variationId: result.variationId,
      name: result.productName,
      variation: result.variationName,
      sku: result.sku,
      price: result.sellingPrice,
      taxRate: result.taxRate,
      quantity: 1,
      packingDate: new Date().toISOString().split('T')[0],
      priceGroup: 'default'
    }
    setSelectedProducts([...selectedProducts, newProduct])
    setSearchQuery("")
    setShowSearchResults(false)
  }

  const removeProduct = (id: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== id))
  }

  const updateQuantity = (id: string, quantity: number) => {
    setSelectedProducts(selectedProducts.map(p =>
      p.id === id ? { ...p, quantity: Math.max(1, quantity) } : p
    ))
  }

  const updatePackingDate = (id: string, date: string) => {
    setSelectedProducts(selectedProducts.map(p =>
      p.id === id ? { ...p, packingDate: date } : p
    ))
  }

  const updatePriceGroup = (id: string, group: string) => {
    setSelectedProducts(selectedProducts.map(p =>
      p.id === id ? { ...p, priceGroup: group } : p
    ))
  }

  const generateLabels = async () => {
    if (selectedProducts.length === 0) {
      alert("Please add at least one product to generate labels")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/products/labels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: selectedProducts,
          settings
        })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        window.open(url, '_blank')
        window.URL.revokeObjectURL(url)
      } else {
        alert("Failed to generate labels")
      }
    } catch (error) {
      console.error("Failed to generate labels:", error)
      alert("Error generating labels")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-bold text-foreground">Print Labels</h1>
        <InformationCircleIcon className="w-5 h-5 text-blue-500" />
      </div>

      {/* Add Products Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add products to generate Labels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search Input with Autocomplete */}
            <div className="relative" ref={searchRef}>
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter product's name to print labels"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                className="pl-10"
              />

              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.id}-${index}`}
                      onClick={() => addProduct(result)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b last:border-b-0 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-medium">{result.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          {result.variationName} - {result.sku}
                        </p>
                      </div>
                      <p className="font-medium">{result.sellingPrice.toFixed(2)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Products Table */}
            <div className="border rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Products</th>
                    <th className="text-left p-3 font-medium">No. of labels</th>
                    <th className="text-left p-3 font-medium">Packing Date</th>
                    <th className="text-left p-3 font-medium">Selling Price Group</th>
                    <th className="text-center p-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center p-8 text-muted-foreground">
                        No products selected. Search and add products above.
                      </td>
                    </tr>
                  ) : (
                    selectedProducts.map((product) => (
                      <tr key={product.id} className="border-b">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {product.variation} - {product.sku}
                            </p>
                          </div>
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={product.quantity}
                            onChange={(e) => updateQuantity(product.id, parseInt(e.target.value))}
                            className="w-24"
                            min={1}
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="date"
                            value={product.packingDate}
                            onChange={(e) => updatePackingDate(product.id, e.target.value)}
                            className="w-40"
                          />
                        </td>
                        <td className="p-3">
                          <Select
                            value={product.priceGroup}
                            onValueChange={(value) => updatePriceGroup(product.id, value)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-2 border-gray-300 shadow-xl z-[100]">
                              <SelectItem value="default" className="cursor-pointer hover:bg-gray-100 py-2 px-4">Default</SelectItem>
                              <SelectItem value="wholesale" className="cursor-pointer hover:bg-gray-100 py-2 px-4">Wholesale</SelectItem>
                              <SelectItem value="retail" className="cursor-pointer hover:bg-gray-100 py-2 px-4">Retail</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeProduct(product.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <XMarkIcon className="w-5 h-5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Information to show in Labels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Information to show in Labels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Product Name */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="productName"
                  checked={settings.productName}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, productName: checked as boolean })
                  }
                />
                <Label htmlFor="productName" className="font-medium">Product Name</Label>
              </div>
              <div className="flex items-center gap-2 ml-6">
                <Label className="text-sm text-muted-foreground">Size</Label>
                <Input
                  type="number"
                  value={settings.productNameSize}
                  onChange={(e) => setSettings({ ...settings, productNameSize: parseInt(e.target.value) })}
                  className="w-20"
                  min={8}
                  max={32}
                />
              </div>
            </div>

            {/* Product Variation */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="productVariation"
                  checked={settings.productVariation}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, productVariation: checked as boolean })
                  }
                />
                <Label htmlFor="productVariation" className="font-medium">
                  Product Variation <span className="text-blue-500">(recommended)</span>
                </Label>
              </div>
              <div className="flex items-center gap-2 ml-6">
                <Label className="text-sm text-muted-foreground">Size</Label>
                <Input
                  type="number"
                  value={settings.productVariationSize}
                  onChange={(e) => setSettings({ ...settings, productVariationSize: parseInt(e.target.value) })}
                  className="w-20"
                  min={8}
                  max={32}
                />
              </div>
            </div>

            {/* Product Price */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="productPrice"
                  checked={settings.productPrice}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, productPrice: checked as boolean })
                  }
                />
                <Label htmlFor="productPrice" className="font-medium">Product Price</Label>
              </div>
              <div className="flex items-center gap-2 ml-6">
                <Label className="text-sm text-muted-foreground">Size</Label>
                <Input
                  type="number"
                  value={settings.productPriceSize}
                  onChange={(e) => setSettings({ ...settings, productPriceSize: parseInt(e.target.value) })}
                  className="w-20"
                  min={8}
                  max={32}
                />
              </div>
            </div>

            {/* Business Name */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="businessName"
                  checked={settings.businessName}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, businessName: checked as boolean })
                  }
                />
                <Label htmlFor="businessName" className="font-medium">Business name</Label>
              </div>
              <div className="flex items-center gap-2 ml-6">
                <Label className="text-sm text-muted-foreground">Size</Label>
                <Input
                  type="number"
                  value={settings.businessNameSize}
                  onChange={(e) => setSettings({ ...settings, businessNameSize: parseInt(e.target.value) })}
                  className="w-20"
                  min={8}
                  max={32}
                />
              </div>
            </div>

            {/* Print Packing Date */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="packingDate"
                  checked={settings.packingDate}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, packingDate: checked as boolean })
                  }
                />
                <Label htmlFor="packingDate" className="font-medium">Print packing date</Label>
              </div>
              <div className="flex items-center gap-2 ml-6">
                <Label className="text-sm text-muted-foreground">Size</Label>
                <Input
                  type="number"
                  value={settings.packingDateSize}
                  onChange={(e) => setSettings({ ...settings, packingDateSize: parseInt(e.target.value) })}
                  className="w-20"
                  min={8}
                  max={32}
                />
              </div>
            </div>

            {/* Show Price */}
            <div className="space-y-2">
              <Label className="font-medium">Show Price:</Label>
              <Select
                value={settings.showPrice}
                onValueChange={(value) => setSettings({ ...settings, showPrice: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-2 border-gray-300 shadow-xl z-[100]">
                  <SelectItem value="inc_tax" className="cursor-pointer hover:bg-gray-100 py-2 px-4">Inc. tax</SelectItem>
                  <SelectItem value="exc_tax" className="cursor-pointer hover:bg-gray-100 py-2 px-4">Exc. tax</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barcode Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cog6ToothIcon className="w-5 h-5" />
            <CardTitle className="text-lg">Barcode setting:</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={settings.barcodeFormat}
            onValueChange={(value) => setSettings({ ...settings, barcodeFormat: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-2 border-gray-300 shadow-xl z-[100] max-h-80">
              {barcodeFormats.map((format) => (
                <SelectItem
                  key={format.value}
                  value={format.value}
                  className="cursor-pointer hover:bg-gray-100 py-3 px-4"
                >
                  {format.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Preview Button */}
          <div className="flex justify-end gap-3">
            <Button
              onClick={generateLabels}
              disabled={selectedProducts.length === 0 || loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-400 disabled:text-white/70"
              size="lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <PrinterIcon className="w-5 h-5 mr-2" />
                  Preview & Print
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
