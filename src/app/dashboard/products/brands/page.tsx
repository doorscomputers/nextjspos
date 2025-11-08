"use client"

import { useEffect, useMemo, useState } from "react"
import {
  DocumentArrowDownIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  PrinterIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { useTableSort } from "@/hooks/useTableSort"
import { exportToCSV, exportToExcel, exportToPDF, printTable } from "@/lib/exportUtils"
import { getPageDisplayRange, getPageNumbers } from "@/utils/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Brand {
  id: number
  name: string
  description: string | null
  createdAt: string
  createdAtTimestamp: number
}

interface BrandForm {
  name: string
  description: string
}

type BrandApiResponse = {
  id: number
  name: string
  description: string | null
  createdAt: string
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showWithDescriptionOnly, setShowWithDescriptionOnly] = useState(false)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [formData, setFormData] = useState<BrandForm>({
    name: "",
    description: "",
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchBrands()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, showWithDescriptionOnly, itemsPerPage])

  const fetchBrands = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/brands")
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch brands")
      }

      const source: BrandApiResponse[] = Array.isArray(data.brands) ? data.brands : []
      const normalized: Brand[] = source.map((brand) => ({
        id: brand.id,
        name: brand.name,
        description: brand.description,
        createdAt: brand.createdAt,
        createdAtTimestamp: new Date(brand.createdAt).getTime(),
      }))

      setBrands(normalized)
    } catch (error) {
      console.error("Error fetching brands:", error)
      toast.error("Failed to load brands")
    } finally {
      setLoading(false)
    }
  }

  const filteredBrands = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return brands.filter((brand) => {
      const matchesSearch =
        term.length === 0 ||
        [brand.name, brand.description]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(term))

      const matchesDescriptionFilter = !showWithDescriptionOnly || Boolean(brand.description)

      return matchesSearch && matchesDescriptionFilter
    })
  }, [brands, searchTerm, showWithDescriptionOnly])

  const { sortedData, sortConfig, requestSort } = useTableSort<Brand>(filteredBrands, {
    key: "name",
    direction: "asc",
  })

  const totalItems = sortedData.length
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedBrands = sortedData.slice(startIndex, endIndex)
  const pageNumbers = useMemo(
    () => getPageNumbers(totalPages, safeCurrentPage),
    [totalPages, safeCurrentPage]
  )
  const { start: pageStart, end: pageEnd } = useMemo(
    () => getPageDisplayRange(totalItems, safeCurrentPage, itemsPerPage),
    [totalItems, safeCurrentPage, itemsPerPage]
  )

  const openCreateDialog = () => {
    setEditingBrand(null)
    setFormData({ name: "", description: "" })
    setDialogOpen(true)
  }

  const openEditDialog = (brand: Brand) => {
    setEditingBrand(brand)
    setFormData({
      name: brand.name,
      description: brand.description || "",
    })
    setDialogOpen(true)
  }

  const handleDelete = async (brand: Brand) => {
    const confirmed = window.confirm(`Delete ${brand.name}? This action cannot be undone.`)
    if (!confirmed) return

    try {
      const response = await fetch(`/api/brands/${brand.id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete brand")
      }
      toast.success("Brand deleted")
      fetchBrands()
    } catch (error) {
      console.error("Error deleting brand:", error)
      toast.error("Failed to delete brand")
    }
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Brand name is required")
      return
    }

    setSubmitting(true)
    try {
      const url = editingBrand ? `/api/brands/${editingBrand.id}` : "/api/brands"
      const method = editingBrand ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to save brand")
      }

      toast.success(editingBrand ? "Brand updated" : "Brand created")
      setDialogOpen(false)
      setEditingBrand(null)
      setFormData({ name: "", description: "" })
      fetchBrands()
    } catch (error) {
      console.error("Error saving brand:", error)
      toast.error("Failed to save brand")
    } finally {
      setSubmitting(false)
    }
  }

  const handleExport = (type: "csv" | "excel" | "pdf" | "print") => {
    const rows = sortedData.map((brand) => ({
      Name: brand.name,
      Description: brand.description ?? "-",
      "Created At": new Date(brand.createdAt).toLocaleString(),
    }))

    const columns = [
      { id: "name", label: "Name", getValue: (row: typeof rows[number]) => row.Name },
      { id: "description", label: "Description", getValue: (row: typeof rows[number]) => row.Description },
      { id: "createdAt", label: "Created At", getValue: (row: typeof rows[number]) => row["Created At"] },
    ]

    const payload = {
      filename: "brands",
      columns,
      data: rows,
      title: "Brand Directory",
    }

    if (type === "csv") exportToCSV(payload)
    if (type === "excel") exportToExcel(payload)
    if (type === "pdf") exportToPDF(payload)
    if (type === "print") printTable(payload)
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold text-foreground">Brands</h1>
        <p className="text-muted-foreground">
          Maintain a clean list of product brands for easy discovery and reporting across the platform.
        </p>
      </div>

      <Card className="shadow-sm border border-border">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative w-full lg:w-80">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, description..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="description-filter"
                  checked={showWithDescriptionOnly}
                  onCheckedChange={setShowWithDescriptionOnly}
                />
                <Label htmlFor="description-filter" className="text-sm text-muted-foreground">
                  With description only
                </Label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport("csv")} className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400">
                <DocumentArrowDownIcon className="h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("excel")} className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400">
                <DocumentArrowDownIcon className="h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} className="gap-2 hover:border-red-500 hover:text-red-700 dark:hover:text-red-400">
                <DocumentTextIcon className="h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("print")} className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400">
                <PrinterIcon className="h-4 w-4" />
                Print
              </Button>
              <Button onClick={openCreateDialog} variant="success" size="sm" className="gap-2">
                <PlusIcon className="h-4 w-4" />
                Add Brand
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-muted-foreground">
              {totalItems === 0 ? "No brands to display" : `Showing ${pageStart}-${pageEnd} of ${totalItems} brands`}
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="itemsPerPage" className="text-sm text-muted-foreground">
                Rows per page
              </Label>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                <SelectTrigger id="itemsPerPage" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {loading ? (
              <div className="py-16 text-center text-muted-foreground">Loading brands…</div>
            ) : paginatedBrands.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                {searchTerm || showWithDescriptionOnly
                  ? "No brands match the current filters."
                  : 'No brands yet. Click "Add Brand" to create one.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <SortableTableHead
                      sortKey="name"
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="min-w-[200px]"
                    >
                      Name
                    </SortableTableHead>
                    <TableHead>Description</TableHead>
                    <SortableTableHead
                      sortKey="createdAtTimestamp"
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="w-48"
                    >
                      Created
                    </SortableTableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBrands.map((brand) => (
                    <TableRow key={brand.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="text-foreground">{brand.name}</span>
                          {brand.description && (
                            <span className="text-xs text-muted-foreground truncate">{brand.description}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {brand.description ? (
                          brand.description
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            No description
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(brand.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon-sm"
                            variant="outline"
                            onClick={() => openEditDialog(brand)}
                            className="hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950"
                            title="Edit brand"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            className="hover:border-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950"
                            onClick={() => handleDelete(brand)}
                            title="Delete brand"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {pageNumbers.map((page, index) =>
                  page === "..." ? (
                    <span key={`ellipsis-${index}`} className="px-3 py-1 text-muted-foreground">
                      …
                    </span>
                  ) : (
                    <Button
                      key={page}
                      size="sm"
                      variant={page === safeCurrentPage ? "default" : "outline"}
                      onClick={() => setCurrentPage(page as number)}
                    >
                      {page}
                    </Button>
                  )
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBrand ? "Edit Brand" : "Add Brand"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brand-name">
                Brand Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="brand-name"
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="E.g. Dell, Samsung, Nike"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand-description">Description</Label>
              <Textarea
                id="brand-description"
                value={formData.description}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                rows={4}
                placeholder="Optional description to help your team recognise this brand."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="default"
              onClick={() => {
                setDialogOpen(false)
                setEditingBrand(null)
                setFormData({ name: "", description: "" })
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} variant="success" size="default" className="gap-2 min-w-32">
              {submitting && <span className="animate-spin">⏳</span>}
              {editingBrand ? "Update Brand" : "Create Brand"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
