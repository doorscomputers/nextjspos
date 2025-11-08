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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { useTableSort } from "@/hooks/useTableSort"
import { exportToCSV, exportToExcel, exportToPDF, printTable } from "@/lib/exportUtils"
import { getPageDisplayRange, getPageNumbers } from "@/utils/pagination"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Category {
  id: number
  name: string
  shortCode: string | null
  description: string | null
  createdAt: string
  createdAtTimestamp: number
}

interface CategoryForm {
  name: string
  shortCode: string
  description: string
}

type CategoryApiResponse = {
  id: number
  name: string
  shortCode: string | null
  description: string | null
  createdAt: string
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState("")
  const [showWithShortCodeOnly, setShowWithShortCodeOnly] = useState(false)
  const [showWithDescriptionOnly, setShowWithDescriptionOnly] = useState(false)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState<CategoryForm>({
    name: "",
    shortCode: "",
    description: "",
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, showWithShortCodeOnly, showWithDescriptionOnly, itemsPerPage])

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/categories")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch categories")
      }

      const source: CategoryApiResponse[] = Array.isArray(data.categories) ? data.categories : []
      const normalized: Category[] = source.map((category) => ({
        id: category.id,
        name: category.name,
        shortCode: category.shortCode,
        description: category.description,
        createdAt: category.createdAt,
        createdAtTimestamp: new Date(category.createdAt).getTime(),
      }))

      setCategories(normalized)
    } catch (error) {
      console.error("Error fetching categories:", error)
      toast.error("Failed to load categories")
    } finally {
      setLoading(false)
    }
  }

  const filteredCategories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return categories.filter((category) => {
      const matchesSearch =
        term.length === 0 ||
        [category.name, category.shortCode, category.description]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(term))

      const matchesShortCodeFilter = !showWithShortCodeOnly || Boolean(category.shortCode)
      const matchesDescriptionFilter = !showWithDescriptionOnly || Boolean(category.description)

      return matchesSearch && matchesShortCodeFilter && matchesDescriptionFilter
    })
  }, [categories, searchTerm, showWithShortCodeOnly, showWithDescriptionOnly])

  const { sortedData, sortConfig, requestSort } = useTableSort<Category>(filteredCategories, {
    key: "name",
    direction: "asc",
  })

  const totalItems = sortedData.length
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCategories = sortedData.slice(startIndex, endIndex)

  const pageNumbers = useMemo(
    () => getPageNumbers(totalPages, safeCurrentPage),
    [totalPages, safeCurrentPage]
  )
  const { start: pageStart, end: pageEnd } = useMemo(
    () => getPageDisplayRange(totalItems, safeCurrentPage, itemsPerPage),
    [totalItems, safeCurrentPage, itemsPerPage]
  )

  const openCreateDialog = () => {
    setEditingCategory(null)
    setFormData({ name: "", shortCode: "", description: "" })
    setDialogOpen(true)
  }

  const openEditDialog = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      shortCode: category.shortCode || "",
      description: category.description || "",
    })
    setDialogOpen(true)
  }

  const handleDelete = async (category: Category) => {
    const confirmed = window.confirm(`Delete ${category.name}? This action cannot be undone.`)
    if (!confirmed) return

    try {
      const response = await fetch(`/api/categories/${category.id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete category")
      }
      toast.success("Category deleted")
      fetchCategories()
    } catch (error) {
      console.error("Error deleting category:", error)
      toast.error("Failed to delete category")
    }
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Category name is required")
      return
    }

    setSubmitting(true)
    try {
      const url = editingCategory ? `/api/categories/${editingCategory.id}` : "/api/categories"
      const method = editingCategory ? "PUT" : "POST"
      const payload = {
        name: formData.name,
        shortCode: formData.shortCode || null,
        description: formData.description || null,
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to save category")
      }

      toast.success(editingCategory ? "Category updated" : "Category created")
      setDialogOpen(false)
      setEditingCategory(null)
      setFormData({ name: "", shortCode: "", description: "" })
      fetchCategories()
    } catch (error) {
      console.error("Error saving category:", error)
      toast.error("Failed to save category")
    } finally {
      setSubmitting(false)
    }
  }

  const handleExport = (type: "csv" | "excel" | "pdf" | "print") => {
    const rows = sortedData.map((category) => ({
      Name: category.name,
      "Short Code": category.shortCode ?? "-",
      Description: category.description ?? "-",
      "Created At": new Date(category.createdAt).toLocaleString(),
    }))

    const columns = [
      { id: "name", label: "Name", getValue: (row: typeof rows[number]) => row.Name },
      { id: "shortCode", label: "Short Code", getValue: (row: typeof rows[number]) => row["Short Code"] },
      { id: "description", label: "Description", getValue: (row: typeof rows[number]) => row.Description },
      { id: "createdAt", label: "Created At", getValue: (row: typeof rows[number]) => row["Created At"] },
    ]

    const payload = {
      filename: "categories",
      columns,
      data: rows,
      title: "Category Directory",
    }

    if (type === "csv") exportToCSV(payload)
    if (type === "excel") exportToExcel(payload)
    if (type === "pdf") exportToPDF(payload)
    if (type === "print") printTable(payload)
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold text-foreground">Categories</h1>
        <p className="text-muted-foreground">
          Group products into organised categories with optional short codes for quicker lookups and reporting.
        </p>
      </div>

      <Card className="shadow-sm border border-border">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative w-full lg:w-80">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, short code, description..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="filter-shortcode"
                    checked={showWithShortCodeOnly}
                    onCheckedChange={setShowWithShortCodeOnly}
                  />
                  <Label htmlFor="filter-shortcode" className="text-sm text-muted-foreground">
                    With short code
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="filter-description"
                    checked={showWithDescriptionOnly}
                    onCheckedChange={setShowWithDescriptionOnly}
                  />
                  <Label htmlFor="filter-description" className="text-sm text-muted-foreground">
                    With description
                  </Label>
                </div>
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
                Add Category
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-muted-foreground">
              {totalItems === 0
                ? "No categories to display"
                : `Showing ${pageStart}-${pageEnd} of ${totalItems} categories`}
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="categories-rows" className="text-sm text-muted-foreground">
                Rows per page
              </Label>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                <SelectTrigger id="categories-rows" className="w-24">
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
              <div className="py-16 text-center text-muted-foreground">Loading categories…</div>
            ) : paginatedCategories.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                {searchTerm || showWithShortCodeOnly || showWithDescriptionOnly
                  ? "No categories match the current filters."
                  : 'No categories yet. Click "Add Category" to create one.'}
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
                    <SortableTableHead
                      sortKey="shortCode"
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="w-36"
                    >
                      Short Code
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
                  {paginatedCategories.map((category) => (
                    <TableRow key={category.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1 text-foreground">
                          <span>{category.name}</span>
                          {category.description && (
                            <span className="text-xs text-muted-foreground truncate">
                              {category.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {category.shortCode ? (
                          <Badge variant="secondary" className="text-xs font-semibold">
                            {category.shortCode}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Not set
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {category.description ? (
                          category.description
                        ) : (
                          <span className="text-sm text-muted-foreground">No description</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(category.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon-sm"
                            variant="outline"
                            onClick={() => openEditDialog(category)}
                            className="hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950"
                            title="Edit category"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            className="hover:border-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950"
                            onClick={() => handleDelete(category)}
                            title="Delete category"
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
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">
                Category Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="category-name"
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Electronics, Clothing, Accessories..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-shortcode">Short Code</Label>
              <Input
                id="category-shortcode"
                value={formData.shortCode}
                onChange={(event) => setFormData((prev) => ({ ...prev, shortCode: event.target.value }))}
                placeholder="ELEC, CLTH, ACC..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-description">Description</Label>
              <Textarea
                id="category-description"
                value={formData.description}
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                rows={4}
                placeholder="Optional description to help your team recognise this category."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="default"
              onClick={() => {
                setDialogOpen(false)
                setEditingCategory(null)
                setFormData({ name: "", shortCode: "", description: "" })
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} variant="success" size="default" className="gap-2 min-w-36">
              {submitting && <span className="animate-spin">⏳</span>}
              {editingCategory ? "Update Category" : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
