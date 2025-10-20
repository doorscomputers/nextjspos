"use client"

import { useEffect, useMemo, useState } from "react"
import {
  DocumentArrowDownIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  MapPinIcon,
  PhoneIcon,
  UserCircleIcon,
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

interface Supplier {
  id: number
  name: string
  contactPerson: string | null
  email: string | null
  mobile: string | null
  alternateNumber: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  zipCode: string | null
  taxNumber: string | null
  paymentTerms: number | null
  creditLimit: number | null
  isActive: boolean
  createdAt: string
  createdAtTimestamp: number
}

interface SupplierForm {
  name: string
  contactPerson: string
  email: string
  mobile: string
  alternateNumber: string
  address: string
  city: string
  state: string
  country: string
  zipCode: string
  taxNumber: string
  paymentTerms: string
  creditLimit: string
  isActive: boolean
}

type SupplierApiResponse = {
  id: number
  name: string
  contactPerson: string | null
  email: string | null
  mobile: string | null
  alternateNumber: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  zipCode: string | null
  taxNumber: string | null
  paymentTerms: number | null
  creditLimit: number | null
  isActive: boolean
  createdAt: string
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState("")
  const [activeOnly, setActiveOnly] = useState(false)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [formData, setFormData] = useState<SupplierForm>({
    name: "",
    contactPerson: "",
    email: "",
    mobile: "",
    alternateNumber: "",
    address: "",
    city: "",
    state: "",
    country: "",
    zipCode: "",
    taxNumber: "",
    paymentTerms: "",
    creditLimit: "",
    isActive: true,
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchSuppliers()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, activeOnly, itemsPerPage])

  const fetchSuppliers = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/suppliers")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch suppliers")
      }

      const source: SupplierApiResponse[] = Array.isArray(data.suppliers) ? data.suppliers : []
      const normalized: Supplier[] = source.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        email: supplier.email,
        mobile: supplier.mobile,
        alternateNumber: supplier.alternateNumber,
        address: supplier.address,
        city: supplier.city,
        state: supplier.state,
        country: supplier.country,
        zipCode: supplier.zipCode,
        taxNumber: supplier.taxNumber,
        paymentTerms: supplier.paymentTerms,
        creditLimit: supplier.creditLimit,
        isActive: supplier.isActive,
        createdAt: supplier.createdAt,
        createdAtTimestamp: new Date(supplier.createdAt).getTime(),
      }))

      setSuppliers(normalized)
    } catch (error) {
      console.error("Error fetching suppliers:", error)
      toast.error("Failed to load suppliers")
    } finally {
      setLoading(false)
    }
  }

  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return suppliers.filter((supplier) => {
      const matchesSearch =
        term.length === 0 ||
        [supplier.name, supplier.contactPerson, supplier.email, supplier.mobile, supplier.alternateNumber]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(term))

      const matchesStatus = !activeOnly || supplier.isActive

      return matchesSearch && matchesStatus
    })
  }, [suppliers, searchTerm, activeOnly])

  const { sortedData, sortConfig, requestSort } = useTableSort<Supplier>(filteredSuppliers, {
    key: "name",
    direction: "asc",
  })

  const totalItems = sortedData.length
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedSuppliers = sortedData.slice(startIndex, endIndex)

  const pageNumbers = useMemo(
    () => getPageNumbers(totalPages, safeCurrentPage),
    [totalPages, safeCurrentPage]
  )
  const { start: pageStart, end: pageEnd } = useMemo(
    () => getPageDisplayRange(totalItems, safeCurrentPage, itemsPerPage),
    [totalItems, safeCurrentPage, itemsPerPage]
  )

  const openCreateDialog = () => {
    setEditingSupplier(null)
    setFormData({
      name: "",
      contactPerson: "",
      email: "",
      mobile: "",
      alternateNumber: "",
      address: "",
      city: "",
      state: "",
      country: "",
      zipCode: "",
      taxNumber: "",
      paymentTerms: "",
      creditLimit: "",
      isActive: true,
    })
    setDialogOpen(true)
  }

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      name: supplier.name ?? "",
      contactPerson: supplier.contactPerson ?? "",
      email: supplier.email ?? "",
      mobile: supplier.mobile ?? "",
      alternateNumber: supplier.alternateNumber ?? "",
      address: supplier.address ?? "",
      city: supplier.city ?? "",
      state: supplier.state ?? "",
      country: supplier.country ?? "",
      zipCode: supplier.zipCode ?? "",
      taxNumber: supplier.taxNumber ?? "",
      paymentTerms: supplier.paymentTerms != null ? supplier.paymentTerms.toString() : "",
      creditLimit: supplier.creditLimit != null ? supplier.creditLimit.toString() : "",
      isActive: supplier.isActive,
    })
    setDialogOpen(true)
  }

  const handleDelete = async (supplier: Supplier) => {
    const confirmed = window.confirm(`Delete ${supplier.name}? This action cannot be undone.`)
    if (!confirmed) return

    try {
      const response = await fetch(`/api/suppliers/${supplier.id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete supplier")
      }
      toast.success("Supplier deleted")
      fetchSuppliers()
    } catch (error) {
      console.error("Error deleting supplier:", error)
      toast.error("Failed to delete supplier")
    }
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Supplier name is required")
      return
    }
    if (!formData.mobile.trim() && !formData.email.trim()) {
      toast.error("Provide at least a mobile number or email")
      return
    }

    setSubmitting(true)
    try {
      const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : "/api/suppliers"
      const method = editingSupplier ? "PUT" : "POST"

      const payload = {
        name: formData.name,
        contactPerson: formData.contactPerson || null,
        email: formData.email || null,
        mobile: formData.mobile || null,
        alternateNumber: formData.alternateNumber || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        country: formData.country || null,
        zipCode: formData.zipCode || null,
        taxNumber: formData.taxNumber || null,
        paymentTerms: formData.paymentTerms ? parseInt(formData.paymentTerms, 10) : null,
        creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : null,
        isActive: formData.isActive,
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to save supplier")
      }

      toast.success(editingSupplier ? "Supplier updated" : "Supplier created")
      setDialogOpen(false)
      setEditingSupplier(null)
      setFormData({
        name: "",
        contactPerson: "",
        email: "",
        mobile: "",
        alternateNumber: "",
        address: "",
        city: "",
        state: "",
        country: "",
        zipCode: "",
        taxNumber: "",
        paymentTerms: "",
        creditLimit: "",
        isActive: true,
      })
      fetchSuppliers()
    } catch (error) {
      console.error("Error saving supplier:", error)
      toast.error("Failed to save supplier")
    } finally {
      setSubmitting(false)
    }
  }

  const handleExport = (type: "csv" | "excel" | "pdf" | "print") => {
    const rows = sortedData.map((supplier) => ({
      Name: supplier.name,
      "Contact Person": supplier.contactPerson ?? "-",
      Email: supplier.email ?? "-",
      Mobile: supplier.mobile ?? "-",
      City: supplier.city ?? "-",
      State: supplier.state ?? "-",
      Country: supplier.country ?? "-",
      Status: supplier.isActive ? "Active" : "Inactive",
      "Created At": new Date(supplier.createdAt).toLocaleString(),
    }))

    const columns = [
      { id: "name", label: "Name", getValue: (row: typeof rows[number]) => row.Name },
      { id: "contactPerson", label: "Contact Person", getValue: (row: typeof rows[number]) => row["Contact Person"] },
      { id: "email", label: "Email", getValue: (row: typeof rows[number]) => row.Email },
      { id: "mobile", label: "Mobile", getValue: (row: typeof rows[number]) => row.Mobile },
      { id: "location", label: "Location", getValue: (row: typeof rows[number]) => `${row.City}, ${row.Country}` },
      { id: "status", label: "Status", getValue: (row: typeof rows[number]) => row.Status },
      { id: "createdAt", label: "Created At", getValue: (row: typeof rows[number]) => row["Created At"] },
    ]

    const payload = {
      filename: "suppliers",
      columns,
      data: rows,
      title: "Suppliers Directory",
    }

    if (type === "csv") exportToCSV(payload)
    if (type === "excel") exportToExcel(payload)
    if (type === "pdf") exportToPDF(payload)
    if (type === "print") printTable(payload)
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold text-foreground">Suppliers</h1>
        <p className="text-muted-foreground">
          Maintain supplier records with contact information, payment terms, and credit limits.
        </p>
      </div>

      <Card className="shadow-sm border border-border">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative w-full lg:w-96">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search suppliers by name, contact, email, or mobile..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="supplier-active-filter" checked={activeOnly} onCheckedChange={setActiveOnly} />
                <Label htmlFor="supplier-active-filter" className="text-sm text-muted-foreground">
                  Active suppliers only
                </Label>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport("csv")} className="gap-2">
                <DocumentArrowDownIcon className="h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("excel")} className="gap-2">
                <DocumentArrowDownIcon className="h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} className="gap-2">
                <DocumentTextIcon className="h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("print")} className="gap-2">
                <PrinterIcon className="h-4 w-4" />
                Print
              </Button>
              <Button onClick={openCreateDialog} className="gap-2 bg-primary text-primary-foreground">
                <PlusIcon className="h-4 w-4" />
                Add Supplier
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-muted-foreground">
              {totalItems === 0 ? "No suppliers to display" : `Showing ${pageStart}-${pageEnd} of ${totalItems} suppliers`}
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="suppliers-rows" className="text-sm text-muted-foreground">
                Rows per page
              </Label>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                <SelectTrigger id="suppliers-rows" className="w-24">
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
              <div className="py-16 text-center text-muted-foreground">Loading suppliers…</div>
            ) : paginatedSuppliers.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                {searchTerm || activeOnly
                  ? "No suppliers match the current filters."
                  : 'No suppliers yet. Click "Add Supplier" to create one.'}
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
                      className="min-w-[220px]"
                    >
                      Supplier
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="email"
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="min-w-[200px]"
                    >
                      Contact Details
                    </SortableTableHead>
                    <TableHead className="min-w-[220px]">Address</TableHead>
                    <SortableTableHead
                      sortKey="isActive"
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="w-32"
                    >
                      Status
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
                  {paginatedSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-foreground">{supplier.name}</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <UserCircleIcon className="h-3.5 w-3.5" />
                            {supplier.contactPerson || "No contact person"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <EnvelopeIcon className="h-3.5 w-3.5" />
                            {supplier.email || "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <PhoneIcon className="h-3.5 w-3.5" />
                            {supplier.mobile || supplier.alternateNumber || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPinIcon className="h-3.5 w-3.5" />
                            {supplier.address || "No address"}
                          </span>
                          <span className="text-xs">
                            {[supplier.city, supplier.state, supplier.country].filter(Boolean).join(", ") ||
                              "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={supplier.isActive ? "success" : "secondary"}
                          className={supplier.isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}
                        >
                          {supplier.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(supplier.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => openEditDialog(supplier)}
                            className="h-8 w-8"
                            title="Edit supplier"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(supplier)}
                            title="Delete supplier"
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier-name">
                Supplier Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="supplier-name"
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="ABC Distribution"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-contact">Contact Person</Label>
              <Input
                id="supplier-contact"
                value={formData.contactPerson}
                onChange={(event) => setFormData((prev) => ({ ...prev, contactPerson: event.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-email">Email</Label>
              <Input
                id="supplier-email"
                type="email"
                value={formData.email}
                onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="supplier@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-mobile">Mobile</Label>
              <Input
                id="supplier-mobile"
                value={formData.mobile}
                onChange={(event) => setFormData((prev) => ({ ...prev, mobile: event.target.value }))}
                placeholder="+63 900 000 0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-alt-mobile">Alternate Number</Label>
              <Input
                id="supplier-alt-mobile"
                value={formData.alternateNumber}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, alternateNumber: event.target.value }))
                }
                placeholder="+63 900 000 0001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-tax">Tax Number</Label>
              <Input
                id="supplier-tax"
                value={formData.taxNumber}
                onChange={(event) => setFormData((prev) => ({ ...prev, taxNumber: event.target.value }))}
                placeholder="VAT/TIN number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-payment-terms">Payment Terms (days)</Label>
              <Input
                id="supplier-payment-terms"
                value={formData.paymentTerms}
                onChange={(event) => setFormData((prev) => ({ ...prev, paymentTerms: event.target.value }))}
                placeholder="30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-credit-limit">Credit Limit</Label>
              <Input
                id="supplier-credit-limit"
                value={formData.creditLimit}
                onChange={(event) => setFormData((prev) => ({ ...prev, creditLimit: event.target.value }))}
                placeholder="10000"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="supplier-address">Address</Label>
              <Textarea
                id="supplier-address"
                value={formData.address}
                onChange={(event) => setFormData((prev) => ({ ...prev, address: event.target.value }))}
                rows={3}
                placeholder="Street, Barangay"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-city">City</Label>
              <Input
                id="supplier-city"
                value={formData.city}
                onChange={(event) => setFormData((prev) => ({ ...prev, city: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-state">State/Province</Label>
              <Input
                id="supplier-state"
                value={formData.state}
                onChange={(event) => setFormData((prev) => ({ ...prev, state: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-country">Country</Label>
              <Input
                id="supplier-country"
                value={formData.country}
                onChange={(event) => setFormData((prev) => ({ ...prev, country: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-zip">ZIP / Postal Code</Label>
              <Input
                id="supplier-zip"
                value={formData.zipCode}
                onChange={(event) => setFormData((prev) => ({ ...prev, zipCode: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div className="space-y-1">
                <Label htmlFor="supplier-active" className="text-sm">
                  Supplier Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inactive suppliers are hidden from purchasing workflows but kept for historical reference.
                </p>
              </div>
              <Switch
                id="supplier-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false)
                setEditingSupplier(null)
                setFormData({
                  name: "",
                  contactPerson: "",
                  email: "",
                  mobile: "",
                  alternateNumber: "",
                  address: "",
                  city: "",
                  state: "",
                  country: "",
                  zipCode: "",
                  taxNumber: "",
                  paymentTerms: "",
                  creditLimit: "",
                  isActive: true,
                })
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting && <span className="animate-spin">⏳</span>}
              {editingSupplier ? "Update Supplier" : "Create Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
