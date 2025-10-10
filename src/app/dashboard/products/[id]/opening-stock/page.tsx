"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface BusinessLocation {
  id: number
  name: string
}

interface ProductVariation {
  id: number
  name: string
  sku: string
}

interface Product {
  id: number
  name: string
  sku: string
  type: string
  variations: ProductVariation[]
}

interface StockEntry {
  locationId: string
  variationId?: number
  quantity: string
  purchasePrice: string
  sellingPrice: string
}

export default function OpeningStockPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)
  const [locations, setLocations] = useState<BusinessLocation[]>([])
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([])
  const [autoFilledIndices, setAutoFilledIndices] = useState<Set<number>>(new Set())
  const [autoFilledSellingPriceIndices, setAutoFilledSellingPriceIndices] = useState<Set<number>>(new Set())

  useEffect(() => {
    params.then(p => {
      setResolvedParams(p)
    })
  }, [params])

  useEffect(() => {
    if (resolvedParams) {
      fetchData()
    }
  }, [resolvedParams])

  const fetchData = async () => {
    if (!resolvedParams) return

    try {
      const [productRes, locationsRes] = await Promise.all([
        fetch(`/api/products/${resolvedParams.id}`),
        fetch('/api/locations')
      ])

      const [productData, locationsData] = await Promise.all([
        productRes.json(),
        locationsRes.json()
      ])

      if (productRes.ok && productData.product) {
        setProduct(productData.product)

        // Initialize stock entries based on product type
        if (productData.product.type === 'variable' && productData.product.variations?.length > 0) {
          // For variable products, create entries for each variation
          const entries: StockEntry[] = []
          locationsData.locations?.forEach((location: BusinessLocation) => {
            productData.product.variations.forEach((variation: ProductVariation) => {
              entries.push({
                locationId: location.id.toString(),
                variationId: variation.id,
                quantity: '',
                purchasePrice: '',
                sellingPrice: ''
              })
            })
          })
          setStockEntries(entries)
        } else {
          // For single products, create entries for each location
          const entries: StockEntry[] = locationsData.locations?.map((location: BusinessLocation) => ({
            locationId: location.id.toString(),
            quantity: '',
            purchasePrice: '',
            sellingPrice: ''
          })) || []
          setStockEntries(entries)
        }
      }

      setLocations(locationsData.locations || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateStockEntry = (index: number, field: 'quantity' | 'purchasePrice' | 'sellingPrice', value: string) => {
    const updated = [...stockEntries]
    updated[index] = { ...updated[index], [field]: value }
    const newAutoFilledIndices = new Set(autoFilledIndices)
    const newAutoFilledSellingPriceIndices = new Set(autoFilledSellingPriceIndices)

    // Auto-fill unit cost from first location to all others
    if (field === 'purchasePrice' && index === 0 && value) {
      console.log('Auto-filling unit cost from first location:', value)
      // For single products, auto-fill all locations
      if (product?.type !== 'variable') {
        updated.forEach((entry, i) => {
          if (i > 0) {
            updated[i] = { ...entry, purchasePrice: value }
            newAutoFilledIndices.add(i)
          }
        })
      } else {
        // For variable products, auto-fill within the same variation
        const firstEntry = updated[0]
        if (firstEntry.variationId) {
          updated.forEach((entry, i) => {
            if (i > 0 && entry.variationId === firstEntry.variationId) {
              updated[i] = { ...entry, purchasePrice: value }
              newAutoFilledIndices.add(i)
            }
          })
        }
      }
      setAutoFilledIndices(newAutoFilledIndices)
    } else if (field === 'purchasePrice' && index > 0) {
      // User manually changed a value, remove from auto-filled set
      newAutoFilledIndices.delete(index)
      setAutoFilledIndices(newAutoFilledIndices)
    }

    // Auto-fill selling price from first location to all others
    if (field === 'sellingPrice' && index === 0 && value) {
      console.log('Auto-filling selling price from first location:', value)
      // For single products, auto-fill all locations
      if (product?.type !== 'variable') {
        updated.forEach((entry, i) => {
          if (i > 0) {
            updated[i] = { ...entry, sellingPrice: value }
            newAutoFilledSellingPriceIndices.add(i)
          }
        })
      } else {
        // For variable products, auto-fill within the same variation
        const firstEntry = updated[0]
        if (firstEntry.variationId) {
          updated.forEach((entry, i) => {
            if (i > 0 && entry.variationId === firstEntry.variationId) {
              updated[i] = { ...entry, sellingPrice: value }
              newAutoFilledSellingPriceIndices.add(i)
            }
          })
        }
      }
      setAutoFilledSellingPriceIndices(newAutoFilledSellingPriceIndices)
    } else if (field === 'sellingPrice' && index > 0) {
      // User manually changed a value, remove from auto-filled set
      newAutoFilledSellingPriceIndices.delete(index)
      setAutoFilledSellingPriceIndices(newAutoFilledSellingPriceIndices)
    }

    setStockEntries(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolvedParams || !product) return

    setSaving(true)

    try {
      // Filter out entries with no quantity
      const validEntries = stockEntries.filter(entry => entry.quantity && parseFloat(entry.quantity) > 0)

      if (validEntries.length === 0) {
        toast.error('Please enter at least one stock quantity')
        setSaving(false)
        return
      }

      const response = await fetch(`/api/products/${resolvedParams.id}/opening-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockEntries: validEntries }),
      })

      if (response.ok) {
        toast.success('Opening stock added successfully')
        router.push('/dashboard/products')
      } else {
        const data = await response.json()
        const errorMessage = data.details
          ? `${data.error}: ${data.details}`
          : data.error || 'Failed to add opening stock'
        console.error('API Error:', data)
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Error saving opening stock:', error)
      toast.error('An error occurred while saving opening stock')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-6xl py-8">
        <Card>
          <CardContent className="flex items-center justify-center min-h-[400px]">
            <div className="text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container max-w-6xl py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="text-destructive">Product not found</div>
            <Button asChild variant="outline">
              <Link href="/dashboard/products">Back to Products</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-6 space-y-4">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link href="/dashboard/products">
            <ArrowLeft className="w-4 h-4" />
            Back to Products
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Add Opening Stock</CardTitle>
            <CardDescription>
              Product: <span className="font-semibold">{product.name}</span> ({product.sku})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <h3 className="text-sm font-medium">Stock by Location</h3>

          {product.type === 'variable' ? (
            // Variable Product Stock Entry
            <div className="space-y-6">
              {product.variations?.map((variation) => (
                <Card key={variation.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {variation.name} ({variation.sku})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Location</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit Cost (Exc. Tax)</TableHead>
                          <TableHead>Selling Price (Per Branch)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {locations.map((location) => {
                          const entryIndex = stockEntries.findIndex(
                            e => e.locationId === location.id.toString() && e.variationId === variation.id
                          )
                          if (entryIndex === -1) return null

                          return (
                            <TableRow key={`${location.id}-${variation.id}`}>
                              <TableCell className="font-medium">
                                {location.name}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={stockEntries[entryIndex].quantity}
                                  onChange={(e) => updateStockEntry(entryIndex, 'quantity', e.target.value)}
                                  placeholder="0.00"
                                  className="max-w-[140px]"
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={stockEntries[entryIndex].purchasePrice}
                                    onChange={(e) => updateStockEntry(entryIndex, 'purchasePrice', e.target.value)}
                                    placeholder="0.00"
                                    className={`max-w-[140px] ${autoFilledIndices.has(entryIndex) ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20' : ''}`}
                                  />
                                  {autoFilledIndices.has(entryIndex) && (
                                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                      <Sparkles className="w-3 h-3" />
                                      Auto
                                    </Badge>
                                  )}
                                  {entryIndex === 0 && (
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      (Auto-fills below)
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={stockEntries[entryIndex].sellingPrice}
                                    onChange={(e) => updateStockEntry(entryIndex, 'sellingPrice', e.target.value)}
                                    placeholder="0.00"
                                    className={`max-w-[140px] ${autoFilledSellingPriceIndices.has(entryIndex) ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20' : ''}`}
                                  />
                                  {autoFilledSellingPriceIndices.has(entryIndex) && (
                                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                      <Sparkles className="w-3 h-3" />
                                      Auto
                                    </Badge>
                                  )}
                                  {entryIndex === 0 && (
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      (Auto-fills below)
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // Single Product Stock Entry
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Cost (Exc. Tax)</TableHead>
                  <TableHead>Selling Price (Per Branch)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location, index) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">
                      {location.name}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={stockEntries[index]?.quantity || ''}
                        onChange={(e) => updateStockEntry(index, 'quantity', e.target.value)}
                        placeholder="0.00"
                        className="max-w-[140px]"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={stockEntries[index]?.purchasePrice || ''}
                          onChange={(e) => updateStockEntry(index, 'purchasePrice', e.target.value)}
                          placeholder="0.00"
                          className={`max-w-[140px] ${autoFilledIndices.has(index) ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20' : ''}`}
                        />
                        {autoFilledIndices.has(index) && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Auto
                          </Badge>
                        )}
                        {index === 0 && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            (Auto-fills below)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={stockEntries[index]?.sellingPrice || ''}
                          onChange={(e) => updateStockEntry(index, 'sellingPrice', e.target.value)}
                          placeholder="0.00"
                          className={`max-w-[140px] ${autoFilledSellingPriceIndices.has(index) ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20' : ''}`}
                        />
                        {autoFilledSellingPriceIndices.has(index) && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Auto
                          </Badge>
                        )}
                        {index === 0 && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            (Auto-fills below)
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          </CardContent>
          <CardFooter className="flex gap-3 border-t pt-6">
            <Button asChild variant="outline" className="flex-1" type="button">
              <Link href="/dashboard/products">
                Cancel
              </Link>
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? 'Saving...' : 'Save Opening Stock'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
