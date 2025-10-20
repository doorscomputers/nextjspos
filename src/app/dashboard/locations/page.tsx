"use client"

import { useEffect, useMemo, useState } from "react"
import {
  DocumentArrowDownIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  MapPinIcon,
  PhoneIcon,
  PencilIcon,
  PlusIcon,
  PrinterIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"
import { toast } from "sonner"

import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Location {
  id: number
  name: string
  landmark: string | null
  country: string
  state: string
  city: string
  zipCode: string
  mobile: string | null
  alternateNumber: string | null
  email: string | null
  isActive: boolean
  createdAt: string
  createdAtTimestamp: number
}

interface LocationForm {
  name: string
  landmark: string
  country: string
  state: string
  city: string
  zipCode: string
  mobile: string
  alternateNumber: string
  email: string
}

type LocationApiResponse = {
  id: number
  name: string
  landmark: string | null
  country: string
  state: string
  city: string
  zipCode: string
  mobile: string | null
  alternateNumber: string | null
  email: string | null
  isActive: boolean
  createdAt: string
}

export default function LocationsPage() {
  const { can } = usePermissions()

  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState("")
  const [countryFilter, setCountryFilter] = useState<string>("all")
  const [cityFilter, setCityFilter] = useState<string>("all")
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [formData, setFormData] = useState<LocationForm>({
    name: "",
    landmark: "",
    country: "",
    state: "",
    city: "",
    zipCode: "",
    mobile: "",
    alternateNumber: "",
    email: "",
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchLocations()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, countryFilter, cityFilter, itemsPerPage])

  const fetchLocations = async () => {
    setLoading(true)
    try {
      // Request all locations including inactive ones for admin management
      const response = await fetch("/api/locations?includeInactive=true")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch locations")
      }

      const source: LocationApiResponse[] = Array.isArray(data.locations) ? data.locations : []
      const normalized: Location[] = source.map((location) => ({
        id: location.id,
        name: location.name,
        landmark: location.landmark,
        country: location.country,
        state: location.state,
        city: location.city,
        zipCode: location.zipCode,
        mobile: location.mobile,
        alternateNumber: location.alternateNumber,
        email: location.email,
        isActive: location.isActive ?? true, // Default to true if undefined
        createdAt: location.createdAt,
        createdAtTimestamp: new Date(location.createdAt).getTime(),
      }))

      setLocations(normalized)
    } catch (error) {
      console.error("Error fetching locations:", error)
      toast.error("Failed to load locations")
    } finally {
      setLoading(false)
    }
  }

  const filteredLocations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return locations.filter((location) => {
      const matchesSearch =
        term.length === 0 ||
        [location.name, location.city, location.state, location.country, location.email, location.mobile]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(term))

      const matchesCountry = countryFilter === "all" || location.country === countryFilter
      const matchesCity = cityFilter === "all" || location.city === cityFilter

      return matchesSearch && matchesCountry && matchesCity
    })
  }, [locations, searchTerm, countryFilter, cityFilter])

  const { sortedData, sortConfig, requestSort } = useTableSort<Location>(filteredLocations, {
    key: "name",
    direction: "asc",
  })

  const totalItems = sortedData.length
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedLocations = sortedData.slice(startIndex, endIndex)

  const pageNumbers = useMemo(
    () => getPageNumbers(totalPages, safeCurrentPage),
    [totalPages, safeCurrentPage]
  )
  const { start: pageStart, end: pageEnd } = useMemo(
    () => getPageDisplayRange(totalItems, safeCurrentPage, itemsPerPage),
    [totalItems, safeCurrentPage, itemsPerPage]
  )

  const uniqueCountries = useMemo(() => {
    const countries = Array.from(new Set(locations.map((location) => location.country).filter(Boolean)))
    countries.sort()
    return countries
  }, [locations])

  const uniqueCities = useMemo(() => {
    const currentCountry = countryFilter === "all" ? null : countryFilter
    const cities = locations
      .filter((location) => !currentCountry || location.country === currentCountry)
      .map((location) => location.city)
      .filter(Boolean)
    const set = Array.from(new Set(cities))
    set.sort()
    return set
  }, [locations, countryFilter])

  const openCreateDialog = () => {
    setEditingLocation(null)
    setFormData({
      name: "",
      landmark: "",
      country: "",
      state: "",
      city: "",
      zipCode: "",
      mobile: "",
      alternateNumber: "",
      email: "",
    })
    setDialogOpen(true)
  }

  const openEditDialog = (location: Location) => {
    setEditingLocation(location)
    setFormData({
      name: location.name,
      landmark: location.landmark || "",
      country: location.country,
      state: location.state,
      city: location.city,
      zipCode: location.zipCode,
      mobile: location.mobile || "",
      alternateNumber: location.alternateNumber || "",
      email: location.email || "",
    })
    setDialogOpen(true)
  }

  const handleDelete = async (location: Location) => {
    const confirmed = window.confirm(
      `Delete ${location.name}? This action cannot be undone and will remove the location from future workflows.`
    )
    if (!confirmed) return

    try {
      const response = await fetch(`/api/locations/${location.id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete location")
      }
      toast.success("Location deleted")
      fetchLocations()
    } catch (error) {
      console.error("Error deleting location:", error)
      toast.error("Failed to delete location")
    }
  }

  const handleToggleStatus = async (location: Location) => {
    const action = location.isActive ? "disable" : "enable"
    const confirmed = window.confirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} ${location.name}? ${
        location.isActive
          ? "This location will be hidden from dropdowns, reports, and transactions."
          : "This location will become available for transactions."
      }`
    )
    if (!confirmed) return

    try {
      const response = await fetch(`/api/locations/${location.id}/toggle-status`, {
        method: "POST"
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to toggle location status")
      }

      toast.success(`Location ${action}d successfully`)
      fetchLocations()
    } catch (error) {
      console.error("Error toggling location status:", error)
      toast.error("Failed to toggle location status")
    }
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Location name is required")
      return
    }
    if (!formData.city.trim() || !formData.state.trim() || !formData.country.trim() || !formData.zipCode.trim()) {
      toast.error("Please fill in the city, state, country, and zip code fields")
      return
    }

    setSubmitting(true)
    try {
      const url = editingLocation ? `/api/locations/${editingLocation.id}` : "/api/locations"
      const method = editingLocation ? "PUT" : "POST"

      const payload = {
        name: formData.name,
        landmark: formData.landmark || null,
        country: formData.country,
        state: formData.state,
        city: formData.city,
        zipCode: formData.zipCode,
        mobile: formData.mobile || null,
        alternateNumber: formData.alternateNumber || null,
        email: formData.email || null,
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to save location")
      }

      toast.success(editingLocation ? "Location updated" : "Location created")
      setDialogOpen(false)
      setEditingLocation(null)
      setFormData({
        name: "",
        landmark: "",
        country: "",
        state: "",
        city: "",
        zipCode: "",
        mobile: "",
        alternateNumber: "",
        email: "",
      })
      fetchLocations()
    } catch (error) {
      console.error("Error saving location:", error)
      toast.error("Failed to save location")
    } finally {
      setSubmitting(false)
    }
  }

  const handleExport = (type: "csv" | "excel" | "pdf" | "print") => {
    const rows = sortedData.map((location) => ({
      Name: location.name,
      City: location.city,
      State: location.state,
      Country: location.country,
      "Zip Code": location.zipCode,
      Landmark: location.landmark ?? "-",
      Mobile: location.mobile ?? "-",
      Email: location.email ?? "-",
      "Created At": new Date(location.createdAt).toLocaleString(),
    }))

    const columns = [
      { id: "name", label: "Name", getValue: (row: typeof rows[number]) => row.Name },
      { id: "city", label: "City", getValue: (row: typeof rows[number]) => row.City },
      { id: "state", label: "State", getValue: (row: typeof rows[number]) => row.State },
      { id: "country", label: "Country", getValue: (row: typeof rows[number]) => row.Country },
      { id: "zip", label: "Zip Code", getValue: (row: typeof rows[number]) => row["Zip Code"] },
      { id: "landmark", label: "Landmark", getValue: (row: typeof rows[number]) => row.Landmark },
      { id: "mobile", label: "Mobile", getValue: (row: typeof rows[number]) => row.Mobile },
      { id: "email", label: "Email", getValue: (row: typeof rows[number]) => row.Email },
      { id: "createdAt", label: "Created At", getValue: (row: typeof rows[number]) => row["Created At"] },
    ]

    const payload = {
      filename: "locations",
      columns,
      data: rows,
      title: "Business Locations",
    }

    if (type === "csv") exportToCSV(payload)
    if (type === "excel") exportToExcel(payload)
    if (type === "pdf") exportToPDF(payload)
    if (type === "print") printTable(payload)
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold text-foreground">Locations</h1>
        <p className="text-muted-foreground">
          Manage the branches and warehouses available in your account, including contact details and addresses.
        </p>
      </div>

      <Card className="shadow-sm border border-border">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative w-full lg:w-[28rem]">
                <MapPinIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, city, state, country, or contact..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="locations-country" className="text-sm text-muted-foreground">
                    Country
                  </Label>
                  <Select
                    value={countryFilter}
                    onValueChange={(value) => {
                      setCountryFilter(value)
                      setCityFilter("all")
                    }}
                  >
                    <SelectTrigger id="locations-country" className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All countries</SelectItem>
                      {uniqueCountries.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="locations-city" className="text-sm text-muted-foreground">
                    City
                  </Label>
                  <Select
                    value={cityFilter}
                    onValueChange={setCityFilter}
                    disabled={uniqueCities.length === 0}
                  >
                    <SelectTrigger id="locations-city" className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All cities</SelectItem>
                      {uniqueCities.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
              {can(PERMISSIONS.LOCATION_CREATE) && (
                <Button onClick={openCreateDialog} className="gap-2 bg-primary text-primary-foreground">
                  <PlusIcon className="h-4 w-4" />
                  Add Location
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-muted-foreground">
              {totalItems === 0 ? "No locations to display" : `Showing ${pageStart}-${pageEnd} of ${totalItems} locations`}
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="locations-rows" className="text-sm text-muted-foreground">
                Rows per page
              </Label>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                <SelectTrigger id="locations-rows" className="w-24">
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
              <div className="py-16 text-center text-muted-foreground">Loading locations…</div>
            ) : paginatedLocations.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                {searchTerm || countryFilter !== "all" || cityFilter !== "all"
                  ? "No locations match the current filters."
                  : 'No locations yet. Click "Add Location" to create one.'}
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
                      Location
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="city"
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="min-w-[200px]"
                    >
                      Address
                    </SortableTableHead>
                    <TableHead className="min-w-[220px]">Contact</TableHead>
                    <SortableTableHead
                      sortKey="email"
                      currentSortKey={sortConfig?.key as string}
                      currentSortDirection={sortConfig?.direction}
                      onSort={requestSort}
                      className="min-w-[200px]"
                    >
                      Email
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
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-40 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLocations.map((location) => (
                    <TableRow key={location.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-foreground font-medium">
                            {location.name}
                          </span>
                          {location.landmark && (
                            <span className="text-xs text-muted-foreground">
                              Landmark: {location.landmark}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPinIcon className="h-3.5 w-3.5" />
                            {location.city}, {location.state}, {location.country}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ZIP: {location.zipCode}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <PhoneIcon className="h-3.5 w-3.5" />
                            {location.mobile || "No mobile"}
                          </span>
                          {location.alternateNumber && (
                            <span className="text-xs text-muted-foreground">
                              Alt: {location.alternateNumber}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {location.email ? (
                          <span className="flex items-center gap-1">
                            <EnvelopeIcon className="h-3.5 w-3.5" />
                            {location.email}
                          </span>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            No email
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(location.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {location.isActive ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                            <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-300">
                            <XCircleIcon className="h-3.5 w-3.5 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {can(PERMISSIONS.LOCATION_UPDATE) && (
                            <>
                              <Button
                                size="sm"
                                variant={location.isActive ? "outline" : "default"}
                                onClick={() => handleToggleStatus(location)}
                                className="h-8 text-xs"
                                title={location.isActive ? "Disable location" : "Enable location"}
                              >
                                {location.isActive ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => openEditDialog(location)}
                                className="h-8 w-8"
                                title="Edit location"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {can(PERMISSIONS.LOCATION_DELETE) && (
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(location)}
                              title="Delete location"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          )}
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
            <DialogTitle>{editingLocation ? "Edit Location" : "Add Location"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location-name">
                Location Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="location-name"
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Main Store, Downtown Branch…"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-landmark">Landmark</Label>
              <Input
                id="location-landmark"
                value={formData.landmark}
                onChange={(event) => setFormData((prev) => ({ ...prev, landmark: event.target.value }))}
                placeholder="Near City Mall"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-city">
                City <span className="text-destructive">*</span>
              </Label>
              <Input
                id="location-city"
                value={formData.city}
                onChange={(event) => setFormData((prev) => ({ ...prev, city: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-state">
                State / Province <span className="text-destructive">*</span>
              </Label>
              <Input
                id="location-state"
                value={formData.state}
                onChange={(event) => setFormData((prev) => ({ ...prev, state: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-country">
                Country <span className="text-destructive">*</span>
              </Label>
              <Input
                id="location-country"
                value={formData.country}
                onChange={(event) => setFormData((prev) => ({ ...prev, country: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-zip">
                ZIP / Postal Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="location-zip"
                value={formData.zipCode}
                onChange={(event) => setFormData((prev) => ({ ...prev, zipCode: event.target.value }))}
                required
                maxLength={7}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-mobile">Mobile</Label>
              <Input
                id="location-mobile"
                value={formData.mobile}
                onChange={(event) => setFormData((prev) => ({ ...prev, mobile: event.target.value }))}
                placeholder="+63 900 000 0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-alt-mobile">Alternate Number</Label>
              <Input
                id="location-alt-mobile"
                value={formData.alternateNumber}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    alternateNumber: event.target.value,
                  }))
                }
                placeholder="+63 900 000 0001"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="location-email">Email</Label>
              <Input
                id="location-email"
                type="email"
                value={formData.email}
                onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="branch@example.com"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false)
                setEditingLocation(null)
                setFormData({
                  name: "",
                  landmark: "",
                  country: "",
                  state: "",
                  city: "",
                  zipCode: "",
                  mobile: "",
                  alternateNumber: "",
                  email: "",
                })
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting && <span className="animate-spin">⏳</span>}
              {editingLocation ? "Update Location" : "Create Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
