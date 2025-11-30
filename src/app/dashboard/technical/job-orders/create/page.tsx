'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { usePermissions } from '@/hooks/usePermissions'
import { useUserPrimaryLocation } from '@/hooks/useUserPrimaryLocation'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { ArrowLeft, Wrench, Save, Plus, Search, Check, ChevronsUpDown, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Location {
  id: number
  name: string
}

interface ServiceType {
  id: number
  code: string
  name: string
  category: string
  standardPrice: number
}

interface Product {
  id: number
  name: string
  sku: string
}

interface ProductVariation {
  id: number
  name: string
  sku: string
}

interface Technician {
  id: number
  firstName: string
  lastName: string
  employeeCode: string
  specialization?: string
}

interface Customer {
  id: number
  name: string
  mobile: string
  email: string
}

export default function CreateJobOrderPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { can } = usePermissions()
  const { locationId: userLocationId, location: userLocation, loading: locationLoading } = useUserPrimaryLocation()

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Dropdown data
  const [locations, setLocations] = useState<Location[]>([])
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [variations, setVariations] = useState<ProductVariation[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  // Combobox open states
  const [serviceTypeOpen, setServiceTypeOpen] = useState(false)
  const [productOpen, setProductOpen] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [technicianOpen, setTechnicianOpen] = useState(false)

  // Search states
  const [serviceTypeSearch, setServiceTypeSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [technicianSearch, setTechnicianSearch] = useState('')

  // Quick add dialogs
  const [showServiceTypeDialog, setShowServiceTypeDialog] = useState(false)
  const [showTechnicianDialog, setShowTechnicianDialog] = useState(false)
  const [addingServiceType, setAddingServiceType] = useState(false)
  const [addingTechnician, setAddingTechnician] = useState(false)

  // Quick add form data
  const [newServiceType, setNewServiceType] = useState({
    code: '',
    name: '',
    category: 'Repair',
    standardPrice: '',
  })
  const [newTechnician, setNewTechnician] = useState({
    employeeCode: '',
    firstName: '',
    lastName: '',
    position: 'Technician',
    primarySpecialization: 'General Repair',
  })

  // Form data
  const [formData, setFormData] = useState({
    locationId: '',
    jobOrderDate: new Date().toISOString().split('T')[0],
    serviceTypeId: '',
    productId: '',
    productVariationId: '',
    serialNumber: '',
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    technicianId: '',
    problemDescription: '',
    priority: 'normal',
    estimatedEndDate: '',
    laborCost: '',
  })

  // Set location from user's primary location
  useEffect(() => {
    if (userLocationId && !formData.locationId) {
      setFormData(prev => ({ ...prev, locationId: userLocationId.toString() }))
    }
  }, [userLocationId, formData.locationId])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchDropdownData()
    }
  }, [status])

  useEffect(() => {
    // Fetch variations when product changes
    if (formData.productId) {
      fetchVariations(formData.productId)
    } else {
      setVariations([])
      setFormData(prev => ({ ...prev, productVariationId: '' }))
    }
  }, [formData.productId])

  const fetchDropdownData = async () => {
    setLoading(true)
    try {
      const [locRes, stRes, prodRes, techRes, custRes] = await Promise.all([
        fetch('/api/locations'),
        fetch('/api/service-types?limit=500'),
        fetch('/api/products?limit=2000'),
        fetch('/api/technicians?limit=500'),
        fetch('/api/customers?limit=2000'),
      ])

      if (locRes.ok) {
        const data = await locRes.json()
        const locs = data.data || data.locations || (Array.isArray(data) ? data : [])
        setLocations(Array.isArray(locs) ? locs : [])
      }
      if (stRes.ok) {
        const data = await stRes.json()
        const types = data.serviceTypes || data.data || (Array.isArray(data) ? data : [])
        setServiceTypes(Array.isArray(types) ? types : [])
      }
      if (prodRes.ok) {
        const data = await prodRes.json()
        const prods = data.products || data.data || (Array.isArray(data) ? data : [])
        setProducts(Array.isArray(prods) ? prods : [])
      }
      if (techRes.ok) {
        const data = await techRes.json()
        const techs = data.technicians || data.data || (Array.isArray(data) ? data : [])
        setTechnicians(Array.isArray(techs) ? techs : [])
      }
      if (custRes.ok) {
        const data = await custRes.json()
        const custs = data.customers || data.data || (Array.isArray(data) ? data : [])
        setCustomers(Array.isArray(custs) ? custs : [])
      }
    } catch (error) {
      console.error('Error fetching dropdown data:', error)
      toast.error('Failed to load form data')
    } finally {
      setLoading(false)
    }
  }

  const fetchVariations = async (productId: string) => {
    try {
      const response = await fetch(`/api/products/${productId}/variations`)
      if (response.ok) {
        const data = await response.json()
        const vars = data.variations || data.data || (Array.isArray(data) ? data : [])
        setVariations(Array.isArray(vars) ? vars : [])
      }
    } catch (error) {
      console.error('Error fetching variations:', error)
    }
  }

  // Filtered lists for searchable dropdowns
  const filteredServiceTypes = useMemo(() => {
    if (!serviceTypeSearch) return serviceTypes
    const search = serviceTypeSearch.toLowerCase()
    return serviceTypes.filter(st =>
      st.name.toLowerCase().includes(search) ||
      st.code?.toLowerCase().includes(search) ||
      st.category?.toLowerCase().includes(search)
    )
  }, [serviceTypes, serviceTypeSearch])

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 100) // Limit initial display
    const search = productSearch.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.sku?.toLowerCase().includes(search)
    ).slice(0, 100)
  }, [products, productSearch])

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 100)
    const search = customerSearch.toLowerCase()
    return customers.filter(c =>
      c.name.toLowerCase().includes(search) ||
      c.mobile?.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search)
    ).slice(0, 100)
  }, [customers, customerSearch])

  const filteredTechnicians = useMemo(() => {
    if (!technicianSearch) return technicians
    const search = technicianSearch.toLowerCase()
    return technicians.filter(t =>
      t.firstName.toLowerCase().includes(search) ||
      t.lastName.toLowerCase().includes(search) ||
      t.employeeCode?.toLowerCase().includes(search) ||
      `${t.firstName} ${t.lastName}`.toLowerCase().includes(search)
    )
  }, [technicians, technicianSearch])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // Auto-fill customer details when customer is selected
    if (field === 'customerId' && value && value !== 'walk-in') {
      const customer = customers.find(c => c.id === parseInt(value))
      if (customer) {
        setFormData(prev => ({
          ...prev,
          customerId: value,
          customerName: customer.name,
          customerPhone: customer.mobile || '',
          customerEmail: customer.email || '',
        }))
      }
    } else if (field === 'customerId' && value === 'walk-in') {
      setFormData(prev => ({
        ...prev,
        customerId: 'walk-in',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
      }))
    }

    // Auto-fill labor cost when service type is selected
    if (field === 'serviceTypeId' && value) {
      const serviceType = serviceTypes.find(st => st.id === parseInt(value))
      if (serviceType) {
        setFormData(prev => ({
          ...prev,
          serviceTypeId: value,
          laborCost: serviceType.standardPrice?.toString() || '',
        }))
      }
    }
  }

  // Quick add handlers
  const handleAddServiceType = async () => {
    if (!newServiceType.code || !newServiceType.name) {
      toast.error('Please fill in code and name')
      return
    }

    setAddingServiceType(true)
    try {
      const response = await fetch('/api/service-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newServiceType.code,
          name: newServiceType.name,
          category: newServiceType.category,
          standardPrice: newServiceType.standardPrice ? parseFloat(newServiceType.standardPrice) : 0,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Service type added successfully')
        // Add to list and select it
        const newST = data.serviceType
        setServiceTypes(prev => [...prev, newST])
        handleInputChange('serviceTypeId', newST.id.toString())
        setShowServiceTypeDialog(false)
        setNewServiceType({ code: '', name: '', category: 'Repair', standardPrice: '' })
      } else {
        toast.error(data.error || 'Failed to add service type')
      }
    } catch (error) {
      console.error('Error adding service type:', error)
      toast.error('Failed to add service type')
    } finally {
      setAddingServiceType(false)
    }
  }

  const handleAddTechnician = async () => {
    if (!newTechnician.employeeCode || !newTechnician.firstName || !newTechnician.lastName) {
      toast.error('Please fill in employee code, first name, and last name')
      return
    }

    setAddingTechnician(true)
    try {
      const response = await fetch('/api/technicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeCode: newTechnician.employeeCode,
          firstName: newTechnician.firstName,
          lastName: newTechnician.lastName,
          position: newTechnician.position,
          primarySpecialization: newTechnician.primarySpecialization,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Technician added successfully')
        // Add to list and select
        const newTech = data.technician?.employee || data.technician
        if (newTech) {
          setTechnicians(prev => [...prev, {
            id: newTech.id,
            firstName: newTech.firstName,
            lastName: newTech.lastName,
            employeeCode: newTech.employeeCode,
          }])
          handleInputChange('technicianId', newTech.id.toString())
        }
        setShowTechnicianDialog(false)
        setNewTechnician({ employeeCode: '', firstName: '', lastName: '', position: 'Technician', primarySpecialization: 'General Repair' })
      } else {
        toast.error(data.error || 'Failed to add technician')
      }
    } catch (error) {
      console.error('Error adding technician:', error)
      toast.error('Failed to add technician')
    } finally {
      setAddingTechnician(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.locationId || !formData.serviceTypeId || !formData.productId ||
        !formData.productVariationId || !formData.customerName || !formData.problemDescription) {
      toast.error('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      const customerId = formData.customerId && formData.customerId !== 'walk-in'
        ? parseInt(formData.customerId)
        : null
      const technicianId = formData.technicianId && formData.technicianId !== 'unassigned'
        ? parseInt(formData.technicianId)
        : null

      const response = await fetch('/api/job-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: parseInt(formData.locationId),
          jobOrderDate: formData.jobOrderDate,
          serviceTypeId: parseInt(formData.serviceTypeId),
          productId: parseInt(formData.productId),
          productVariationId: parseInt(formData.productVariationId),
          serialNumber: formData.serialNumber || null,
          customerId,
          customerName: formData.customerName,
          customerPhone: formData.customerPhone || null,
          customerEmail: formData.customerEmail || null,
          technicianId,
          problemDescription: formData.problemDescription,
          priority: formData.priority,
          estimatedEndDate: formData.estimatedEndDate || null,
          laborCost: formData.laborCost ? parseFloat(formData.laborCost) : null,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Job order created successfully')
        router.push('/dashboard/technical/job-orders')
      } else {
        toast.error(data.error || 'Failed to create job order')
      }
    } catch (error) {
      console.error('Error creating job order:', error)
      toast.error('Failed to create job order')
    } finally {
      setSubmitting(false)
    }
  }

  // Get selected display values
  const selectedServiceType = serviceTypes.find(st => st.id.toString() === formData.serviceTypeId)
  const selectedProduct = products.find(p => p.id.toString() === formData.productId)
  const selectedCustomer = customers.find(c => c.id.toString() === formData.customerId)
  const selectedTechnician = technicians.find(t => t.id.toString() === formData.technicianId)

  if (status === 'loading' || loading || locationLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin dark:border-blue-900 dark:border-t-blue-400"></div>
          <p className="mt-4 text-slate-600 font-medium dark:text-gray-300">Loading...</p>
        </div>
      </div>
    )
  }

  if (status === 'authenticated' && !can(PERMISSIONS.JOB_ORDER_CREATE)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 font-medium dark:text-red-400">Access denied. You do not have permission to create job orders.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="dark:border-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Wrench className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Create Job Order
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Create a new repair or service job order
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Job Details */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="dark:text-white">Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Location - Auto-set from user */}
                <div>
                  <Label htmlFor="locationId" className="dark:text-gray-200">Location *</Label>
                  <div className="mt-1 p-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-gray-100">
                    {userLocation?.name || locations.find(l => l.id.toString() === formData.locationId)?.name || 'Loading...'}
                  </div>
                  <input type="hidden" value={formData.locationId} />
                </div>
                <div>
                  <Label htmlFor="jobOrderDate" className="dark:text-gray-200">Date *</Label>
                  <Input
                    type="date"
                    id="jobOrderDate"
                    value={formData.jobOrderDate}
                    onChange={(e) => handleInputChange('jobOrderDate', e.target.value)}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>

              {/* Service Type with Search and Quick Add */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="dark:text-gray-200">Service Type *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowServiceTypeDialog(true)}
                    className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Quick Add
                  </Button>
                </div>
                <Popover open={serviceTypeOpen} onOpenChange={setServiceTypeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={serviceTypeOpen}
                      className="w-full justify-between dark:bg-gray-700 dark:border-gray-600 dark:text-white font-normal"
                    >
                      {selectedServiceType
                        ? `${selectedServiceType.name} - ₱${selectedServiceType.standardPrice?.toLocaleString() || 0}`
                        : "Search service type..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search by name, code, category..."
                        value={serviceTypeSearch}
                        onValueChange={setServiceTypeSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No service type found.</CommandEmpty>
                        <CommandGroup>
                          {filteredServiceTypes.map((st) => (
                            <CommandItem
                              key={st.id}
                              value={st.id.toString()}
                              onSelect={() => {
                                handleInputChange('serviceTypeId', st.id.toString())
                                setServiceTypeOpen(false)
                                setServiceTypeSearch('')
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.serviceTypeId === st.id.toString() ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{st.name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {st.code} | {st.category} | ₱{st.standardPrice?.toLocaleString() || 0}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Product with Search */}
              <div>
                <Label className="dark:text-gray-200">Product *</Label>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productOpen}
                      className="w-full justify-between dark:bg-gray-700 dark:border-gray-600 dark:text-white font-normal mt-1"
                    >
                      {selectedProduct
                        ? `${selectedProduct.name} (${selectedProduct.sku})`
                        : "Search product..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search by name or SKU..."
                        value={productSearch}
                        onValueChange={setProductSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No product found. Try a different search.</CommandEmpty>
                        <CommandGroup>
                          {filteredProducts.map((prod) => (
                            <CommandItem
                              key={prod.id}
                              value={prod.id.toString()}
                              onSelect={() => {
                                handleInputChange('productId', prod.id.toString())
                                setProductOpen(false)
                                setProductSearch('')
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.productId === prod.id.toString() ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{prod.name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{prod.sku}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Variation */}
              <div>
                <Label htmlFor="productVariationId" className="dark:text-gray-200">Variation *</Label>
                <Select
                  value={formData.productVariationId}
                  onValueChange={(v) => handleInputChange('productVariationId', v)}
                  disabled={!formData.productId}
                >
                  <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder={formData.productId ? "Select variation" : "Select product first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {variations.map((v) => (
                      <SelectItem key={v.id} value={v.id.toString()}>
                        {v.name} ({v.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Serial Number */}
              <div>
                <Label htmlFor="serialNumber" className="dark:text-gray-200">Serial Number</Label>
                <Input
                  id="serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) => handleInputChange('serialNumber', e.target.value)}
                  placeholder="Enter serial number (optional)"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              {/* Priority and Est. Completion */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority" className="dark:text-gray-200">Priority</Label>
                  <Select value={formData.priority} onValueChange={(v) => handleInputChange('priority', v)}>
                    <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="estimatedEndDate" className="dark:text-gray-200">Est. Completion</Label>
                  <Input
                    type="date"
                    id="estimatedEndDate"
                    value={formData.estimatedEndDate}
                    onChange={(e) => handleInputChange('estimatedEndDate', e.target.value)}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Column - Customer & Assignment */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="dark:text-white">Customer & Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer with Search */}
              <div>
                <Label className="dark:text-gray-200">Existing Customer</Label>
                <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerOpen}
                      className="w-full justify-between dark:bg-gray-700 dark:border-gray-600 dark:text-white font-normal mt-1"
                    >
                      {formData.customerId === 'walk-in'
                        ? 'Walk-in Customer'
                        : selectedCustomer
                        ? `${selectedCustomer.name} - ${selectedCustomer.mobile || 'No phone'}`
                        : "Search customer..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search by name, phone, email..."
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="walk-in"
                            onSelect={() => {
                              handleInputChange('customerId', 'walk-in')
                              setCustomerOpen(false)
                              setCustomerSearch('')
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.customerId === 'walk-in' ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Walk-in Customer
                          </CommandItem>
                          {filteredCustomers.map((cust) => (
                            <CommandItem
                              key={cust.id}
                              value={cust.id.toString()}
                              onSelect={() => {
                                handleInputChange('customerId', cust.id.toString())
                                setCustomerOpen(false)
                                setCustomerSearch('')
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.customerId === cust.id.toString() ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{cust.name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {cust.mobile || 'No phone'} | {cust.email || 'No email'}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Customer Name */}
              <div>
                <Label htmlFor="customerName" className="dark:text-gray-200">Customer Name *</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
                  placeholder="Enter customer name"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              {/* Phone and Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerPhone" className="dark:text-gray-200">Phone</Label>
                  <Input
                    id="customerPhone"
                    value={formData.customerPhone}
                    onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                    placeholder="Phone number"
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="customerEmail" className="dark:text-gray-200">Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                    placeholder="Email address"
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>

              {/* Technician with Search and Quick Add */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="dark:text-gray-200">Assign Technician</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTechnicianDialog(true)}
                    className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Quick Add
                  </Button>
                </div>
                <Popover open={technicianOpen} onOpenChange={setTechnicianOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={technicianOpen}
                      className="w-full justify-between dark:bg-gray-700 dark:border-gray-600 dark:text-white font-normal"
                    >
                      {formData.technicianId === 'unassigned'
                        ? 'Unassigned'
                        : selectedTechnician
                        ? `${selectedTechnician.firstName} ${selectedTechnician.lastName} (${selectedTechnician.employeeCode})`
                        : "Search technician..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search by name or code..."
                        value={technicianSearch}
                        onValueChange={setTechnicianSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No technician found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="unassigned"
                            onSelect={() => {
                              handleInputChange('technicianId', 'unassigned')
                              setTechnicianOpen(false)
                              setTechnicianSearch('')
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.technicianId === 'unassigned' ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Unassigned
                          </CommandItem>
                          {filteredTechnicians.map((tech) => (
                            <CommandItem
                              key={tech.id}
                              value={tech.id.toString()}
                              onSelect={() => {
                                handleInputChange('technicianId', tech.id.toString())
                                setTechnicianOpen(false)
                                setTechnicianSearch('')
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.technicianId === tech.id.toString() ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{tech.firstName} {tech.lastName}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{tech.employeeCode}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Labor Cost */}
              <div>
                <Label htmlFor="laborCost" className="dark:text-gray-200">Labor Cost (₱)</Label>
                <Input
                  id="laborCost"
                  type="number"
                  step="0.01"
                  value={formData.laborCost}
                  onChange={(e) => handleInputChange('laborCost', e.target.value)}
                  placeholder="0.00"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              {/* Problem Description */}
              <div>
                <Label htmlFor="problemDescription" className="dark:text-gray-200">Problem Description *</Label>
                <Textarea
                  id="problemDescription"
                  value={formData.problemDescription}
                  onChange={(e) => handleInputChange('problemDescription', e.target.value)}
                  placeholder="Describe the issue or problem..."
                  rows={4}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Button */}
        <div className="mt-6 flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="dark:border-gray-700"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-32"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Create Job Order
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Quick Add Service Type Dialog */}
      <Dialog open={showServiceTypeDialog} onOpenChange={setShowServiceTypeDialog}>
        <DialogContent className="sm:max-w-md dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Quick Add Service Type</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Add a new service type quickly
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="dark:text-gray-200">Code *</Label>
                <Input
                  value={newServiceType.code}
                  onChange={(e) => setNewServiceType(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g., SVC001"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <Label className="dark:text-gray-200">Category</Label>
                <Select
                  value={newServiceType.category}
                  onValueChange={(v) => setNewServiceType(prev => ({ ...prev, category: v }))}
                >
                  <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Repair">Repair</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Installation">Installation</SelectItem>
                    <SelectItem value="Inspection">Inspection</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="dark:text-gray-200">Name *</Label>
              <Input
                value={newServiceType.name}
                onChange={(e) => setNewServiceType(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Screen Replacement"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div>
              <Label className="dark:text-gray-200">Standard Price (₱)</Label>
              <Input
                type="number"
                step="0.01"
                value={newServiceType.standardPrice}
                onChange={(e) => setNewServiceType(prev => ({ ...prev, standardPrice: e.target.value }))}
                placeholder="0.00"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowServiceTypeDialog(false)}
              className="dark:border-gray-600"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddServiceType}
              disabled={addingServiceType}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {addingServiceType ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Service Type
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Technician Dialog */}
      <Dialog open={showTechnicianDialog} onOpenChange={setShowTechnicianDialog}>
        <DialogContent className="sm:max-w-md dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Quick Add Technician</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Add a new technician quickly
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="dark:text-gray-200">Employee Code *</Label>
              <Input
                value={newTechnician.employeeCode}
                onChange={(e) => setNewTechnician(prev => ({ ...prev, employeeCode: e.target.value }))}
                placeholder="e.g., TECH001"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="dark:text-gray-200">First Name *</Label>
                <Input
                  value={newTechnician.firstName}
                  onChange={(e) => setNewTechnician(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="Juan"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <Label className="dark:text-gray-200">Last Name *</Label>
                <Input
                  value={newTechnician.lastName}
                  onChange={(e) => setNewTechnician(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Dela Cruz"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="dark:text-gray-200">Position</Label>
                <Input
                  value={newTechnician.position}
                  onChange={(e) => setNewTechnician(prev => ({ ...prev, position: e.target.value }))}
                  placeholder="Technician"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <Label className="dark:text-gray-200">Specialization</Label>
                <Select
                  value={newTechnician.primarySpecialization}
                  onValueChange={(v) => setNewTechnician(prev => ({ ...prev, primarySpecialization: v }))}
                >
                  <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General Repair">General Repair</SelectItem>
                    <SelectItem value="Electronics">Electronics</SelectItem>
                    <SelectItem value="Mechanical">Mechanical</SelectItem>
                    <SelectItem value="Electrical">Electrical</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTechnicianDialog(false)}
              className="dark:border-gray-600"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddTechnician}
              disabled={addingTechnician}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {addingTechnician ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Technician
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
