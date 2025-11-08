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

interface Unit {
  id: number
  name: string
  shortName: string
  allowDecimal: boolean
  baseUnitId: number | null
  baseUnitMultiplier: string | null
  baseUnit?: {
    id: number
    name: string
    shortName: string
  } | null
  createdAt: string
  createdAtTimestamp: number
}

interface UnitForm {
  name: string
  shortName: string
  allowDecimal: boolean
  baseUnitId: number | null
  baseUnitMultiplier: string
}

type AllowDecimalFilter = "all" | "decimal" | "whole"

type UnitApiResponse = {
  id: number
  name: string
  shortName: string
  allowDecimal: boolean
  baseUnitId: number | null
  baseUnitMultiplier: any | null
  baseUnit?: {
    id: number
    name: string
    shortName: string
  } | null
  createdAt: string
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState("")
  const [allowDecimalFilter, setAllowDecimalFilter] = useState<AllowDecimalFilter>("all")
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [formData, setFormData] = useState<UnitForm>({
    name: "",
    shortName: "",
    allowDecimal: false,
    baseUnitId: null,
    baseUnitMultiplier: "",
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchUnits()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, allowDecimalFilter, itemsPerPage])

  const fetchUnits = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/units")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch units")
      }

      const source: UnitApiResponse[] = Array.isArray(data.units) ? data.units : []
      const normalized: Unit[] = source.map((unit) => ({
        id: unit.id,
        name: unit.name,
        shortName: unit.shortName,
        allowDecimal: unit.allowDecimal,
        baseUnitId: unit.baseUnitId,
        baseUnitMultiplier: unit.baseUnitMultiplier ? String(unit.baseUnitMultiplier) : null,
        baseUnit: unit.baseUnit,
        createdAt: unit.createdAt,
        createdAtTimestamp: new Date(unit.createdAt).getTime(),
      }))

      setUnits(normalized)
    } catch (error) {
      console.error("Error fetching units:", error)
      toast.error("Failed to load units")
    } finally {
      setLoading(false)
    }
  }

  const filteredUnits = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return units.filter((unit) => {
      const matchesSearch =
        term.length === 0 ||
        [unit.name, unit.shortName].some((value) => value.toLowerCase().includes(term))

      const matchesAllowDecimalFilter =
        allowDecimalFilter === "all" ||
        (allowDecimalFilter === "decimal" && unit.allowDecimal) ||
        (allowDecimalFilter === "whole" && !unit.allowDecimal)

      return matchesSearch && matchesAllowDecimalFilter
    })
  }, [units, searchTerm, allowDecimalFilter])

  const { sortedData, sortConfig, requestSort } = useTableSort<Unit>(filteredUnits, {
    key: "name",
    direction: "asc",
  })

  const totalItems = sortedData.length
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedUnits = sortedData.slice(startIndex, endIndex)

  const pageNumbers = useMemo(
    () => getPageNumbers(totalPages, safeCurrentPage),
    [totalPages, safeCurrentPage]
  )
  const { start: pageStart, end: pageEnd } = useMemo(
    () => getPageDisplayRange(totalItems, safeCurrentPage, itemsPerPage),
    [totalItems, safeCurrentPage, itemsPerPage]
  )

  const openCreateDialog = () => {
    setEditingUnit(null)
    setFormData({
      name: "",
      shortName: "",
      allowDecimal: false,
      baseUnitId: null,
      baseUnitMultiplier: "",
    })
    setDialogOpen(true)
  }

  const openEditDialog = (unit: Unit) => {
    setEditingUnit(unit)
    setFormData({
      name: unit.name,
      shortName: unit.shortName,
      allowDecimal: unit.allowDecimal,
      baseUnitId: unit.baseUnitId,
      baseUnitMultiplier: unit.baseUnitMultiplier || "",
    })
    setDialogOpen(true)
  }

  const handleDelete = async (unit: Unit) => {
    const confirmed = window.confirm(`Delete ${unit.name}? This action cannot be undone.`)
    if (!confirmed) return

    try {
      const response = await fetch(`/api/units/${unit.id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete unit")
      }
      toast.success("Unit deleted")
      fetchUnits()
    } catch (error) {
      console.error("Error deleting unit:", error)
      toast.error("Failed to delete unit")
    }
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Unit name is required")
      return
    }
    if (!formData.shortName.trim()) {
      toast.error("Short name is required")
      return
    }

    // Validate UOM conversion fields
    if (formData.baseUnitId) {
      if (!formData.baseUnitMultiplier || parseFloat(formData.baseUnitMultiplier) <= 0) {
        toast.error("Conversion multiplier is required and must be greater than 0")
        return
      }
    }

    setSubmitting(true)
    try {
      const url = editingUnit ? `/api/units/${editingUnit.id}` : "/api/units"
      const method = editingUnit ? "PUT" : "POST"

      // Prepare payload
      const payload = {
        name: formData.name,
        shortName: formData.shortName,
        allowDecimal: formData.allowDecimal,
        baseUnitId: formData.baseUnitId || null,
        baseUnitMultiplier: formData.baseUnitId && formData.baseUnitMultiplier
          ? parseFloat(formData.baseUnitMultiplier)
          : null,
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to save unit")
      }

      toast.success(editingUnit ? "Unit updated" : "Unit created")
      setDialogOpen(false)
      setEditingUnit(null)
      setFormData({ name: "", shortName: "", allowDecimal: false })
      fetchUnits()
    } catch (error) {
      console.error("Error saving unit:", error)
      toast.error("Failed to save unit")
    } finally {
      setSubmitting(false)
    }
  }

  const handleExport = (type: "csv" | "excel" | "pdf" | "print") => {
    const rows = sortedData.map((unit) => ({
      Name: unit.name,
      "Short Name": unit.shortName,
      "Allow Decimal": unit.allowDecimal ? "Yes" : "No",
      "Created At": new Date(unit.createdAt).toLocaleString(),
    }))

    const columns = [
      { id: "name", label: "Name", getValue: (row: typeof rows[number]) => row.Name },
      { id: "shortName", label: "Short Name", getValue: (row: typeof rows[number]) => row["Short Name"] },
      { id: "allowDecimal", label: "Allow Decimal", getValue: (row: typeof rows[number]) => row["Allow Decimal"] },
      { id: "createdAt", label: "Created At", getValue: (row: typeof rows[number]) => row["Created At"] },
    ]

    const payload = {
      filename: "units",
      columns,
      data: rows,
      title: "Measurement Units",
    }

    if (type === "csv") exportToCSV(payload)
    if (type === "excel") exportToExcel(payload)
    if (type === "pdf") exportToPDF(payload)
    if (type === "print") printTable(payload)
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold text-foreground">Units</h1>
        <p className="text-muted-foreground">
          Define measurement units for products, including whether decimals are allowed.
        </p>
      </div>

      <Card className="shadow-sm border border-border">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative w-full lg:w-80">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or short name..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="allow-decimal-filter" className="text-sm text-muted-foreground">
                  Allow decimal
                </Label>
                <Select
                  value={allowDecimalFilter}
                  onValueChange={(value: AllowDecimalFilter) => setAllowDecimalFilter(value)}
                >
                  <SelectTrigger id="allow-decimal-filter" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="decimal">Decimals allowed</SelectItem>
                    <SelectItem value="whole">Whole numbers only</SelectItem>
                  </SelectContent>
                </Select>
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
                Add Unit
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-muted-foreground">
              {totalItems === 0 ? "No units to display" : `Showing ${pageStart}-${pageEnd} of ${totalItems} units`}
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="units-rows" className="text-sm text-muted-foreground">
                Rows per page
              </Label>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                <SelectTrigger id="units-rows" className="w-24">
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
              <div className="py-16 text-center text-muted-foreground">Loading units…</div>
            ) : paginatedUnits.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                {searchTerm || allowDecimalFilter !== "all"
                  ? "No units match the current filters."
                  : 'No units yet. Click "Add Unit" to create one.'}
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
                      sortKey="shortName"
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="w-40"
                    >
                      Short Name
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="allowDecimal"
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="w-32"
                    >
                      Allow Decimal
                    </SortableTableHead>
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
                  {paginatedUnits.map((unit) => (
                    <TableRow key={unit.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium text-foreground">{unit.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs font-semibold">
                          {unit.shortName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={unit.allowDecimal ? "success" : "secondary"}
                          className={unit.allowDecimal ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}
                        >
                          {unit.allowDecimal ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(unit.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon-sm"
                            variant="outline"
                            onClick={() => openEditDialog(unit)}
                            className="hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950"
                            title="Edit unit"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            className="hover:border-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950"
                            onClick={() => handleDelete(unit)}
                            title="Delete unit"
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
            <DialogTitle>{editingUnit ? "Edit Unit" : "Add Unit"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unit-name">
                Unit Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="unit-name"
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Pieces, Kilograms, Liters..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-shortName">
                Short Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="unit-shortName"
                value={formData.shortName}
                onChange={(event) => setFormData((prev) => ({ ...prev, shortName: event.target.value }))}
                placeholder="Pc(s), Kg, L..."
                required
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="unit-allowDecimal" className="text-sm font-medium">
                  Allow Decimal Quantities
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enable if this unit can be sold or purchased in decimal values (e.g., 1.5 kg).
                </p>
              </div>
              <div className="flex-shrink-0">
                <Switch
                  id="unit-allowDecimal"
                  checked={formData.allowDecimal}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, allowDecimal: checked }))}
                />
              </div>
            </div>

            {/* UOM Conversion Section */}
            <div className="space-y-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔄</span>
                <div>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    Unit Conversion Setup (Optional)
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Configure this unit as a sub-unit of another unit for multi-unit inventory tracking
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit-baseUnit" className="text-sm">
                  Base Unit (Parent Unit)
                </Label>
                <Select
                  value={formData.baseUnitId?.toString() || "none"}
                  onValueChange={(value) => {
                    if (value === "none") {
                      setFormData((prev) => ({ ...prev, baseUnitId: null, baseUnitMultiplier: "" }))
                    } else {
                      setFormData((prev) => ({ ...prev, baseUnitId: parseInt(value) }))
                    }
                  }}
                >
                  <SelectTrigger id="unit-baseUnit">
                    <SelectValue placeholder="Select base unit (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No conversion (standalone unit)</SelectItem>
                    {units
                      .filter((u) => u.id !== editingUnit?.id)
                      .map((unit) => (
                        <SelectItem key={unit.id} value={unit.id.toString()}>
                          {unit.name} ({unit.shortName})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  💡 Example: If creating "Meter" as sub-unit of "Box", select "Box" here
                </p>
              </div>

              {formData.baseUnitId && (
                <div className="space-y-2">
                  <Label htmlFor="unit-multiplier" className="text-sm">
                    Conversion Multiplier <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="unit-multiplier"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={formData.baseUnitMultiplier}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, baseUnitMultiplier: e.target.value }))
                    }
                    placeholder="0.01"
                    required={formData.baseUnitId !== null}
                  />
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      💡 Formula: <strong>1 {formData.shortName || "this unit"} = multiplier × {units.find(u => u.id === formData.baseUnitId)?.shortName || "base unit"}</strong>
                    </p>
                    {formData.baseUnitMultiplier && (
                      <div className="rounded bg-green-50 dark:bg-green-900/20 p-2 border border-green-200 dark:border-green-800">
                        <p className="text-xs font-semibold text-green-800 dark:text-green-200">
                          ✓ Example: 1 {formData.shortName || "unit"} = {formData.baseUnitMultiplier} {units.find(u => u.id === formData.baseUnitId)?.shortName}
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                          {formData.baseUnitMultiplier && parseFloat(formData.baseUnitMultiplier) > 0
                            ? `Or: 1 ${units.find(u => u.id === formData.baseUnitId)?.shortName} = ${(1 / parseFloat(formData.baseUnitMultiplier)).toFixed(4)} ${formData.shortName || "units"}`
                            : ""}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                      ⚠️ Common examples:
                      <br />• 1 Box = 100 meters → multiplier = 0.01
                      <br />• 1 Carton = 24 pieces → multiplier = 0.04167
                      <br />• 1 Kg = 1000 grams → multiplier = 0.001
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="default"
              onClick={() => {
                setDialogOpen(false)
                setEditingUnit(null)
                setFormData({
                  name: "",
                  shortName: "",
                  allowDecimal: false,
                  baseUnitId: null,
                  baseUnitMultiplier: "",
                })
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} variant="success" size="default" className="gap-2 min-w-32">
              {submitting && <span className="animate-spin">⏳</span>}
              {editingUnit ? "Update Unit" : "Create Unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
