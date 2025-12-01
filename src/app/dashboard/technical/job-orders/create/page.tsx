'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { usePermissions } from '@/hooks/usePermissions'
import { useUserPrimaryLocation } from '@/hooks/useUserPrimaryLocation'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { ArrowLeft, Wrench, Save, Plus, Check, ChevronsUpDown } from 'lucide-react'
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

// Simple searchable select component
function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  disabled,
  renderOption,
  filterFn,
}: {
  options: any[]
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  searchPlaceholder: string
  disabled?: boolean
  renderOption: (option: any) => { label: string; sublabel?: string }
  filterFn: (option: any, search: string) => boolean
}) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const filteredOptions = useMemo(() => {
    if (!search) return options.slice(0, 100)
    return options.filter(opt => filterFn(opt, search.toLowerCase())).slice(0, 100)
  }, [options, search, filterFn])

  const selectedOption = options.find(opt => opt.id?.toString() === value || opt.value === value)
  const displayLabel = selectedOption ? renderOption(selectedOption).label : placeholder

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        )}
      >
        <span className={cn(!selectedOption && "text-muted-foreground")}>
          {displayLabel}
        </span>
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg dark:bg-gray-800 dark:border-gray-600">
            <div className="p-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-500 text-gray-900 dark:text-white"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-auto p-1 bg-white dark:bg-gray-800">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No results found
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const { label, sublabel } = renderOption(option)
                  const optionValue = option.id?.toString() || option.value
                  const isSelected = optionValue === value

                  return (
                    <button
                      key={optionValue}
                      type="button"
                      onClick={() => {
                        onValueChange(optionValue)
                        setIsOpen(false)
                        setSearch('')
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer text-gray-900 dark:text-gray-100",
                        "hover:bg-blue-50 hover:text-blue-900 dark:hover:bg-blue-900/30 dark:hover:text-blue-100",
                        isSelected && "bg-blue-100 dark:bg-blue-900/40"
                      )}
                    >
                      <Check className={cn("h-4 w-4 text-blue-600 dark:text-blue-400", isSelected ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col items-start">
                        <span className="text-gray-900 dark:text-gray-100">{label}</span>
                        {sublabel && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{sublabel}</span>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Product search component with server-side search
function ProductSearchSelect({
  value,
  onValueChange,
  placeholder,
  initialProducts,
}: {
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  initialProducts: Product[]
}) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [searching, setSearching] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Update products when initialProducts change
  useEffect(() => {
    setProducts(initialProducts)
  }, [initialProducts])

  // Find selected product
  useEffect(() => {
    if (value) {
      const found = products.find(p => p.id.toString() === value)
      if (found) {
        setSelectedProduct(found)
      } else if (!selectedProduct) {
        // If not in current list, fetch it
        fetch(`/api/products/${value}`)
          .then(res => res.json())
          .then(data => {
            if (data.product) {
              setSelectedProduct(data.product)
            }
          })
          .catch(() => {})
      }
    } else {
      setSelectedProduct(null)
    }
  }, [value, products])

  const handleSearchChange = (searchValue: string) => {
    setSearch(searchValue)

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Debounce search
    if (searchValue.length >= 2) {
      setSearching(true)
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(`/api/products/search?q=${encodeURIComponent(searchValue)}&limit=50`)
          if (response.ok) {
            const data = await response.json()
            setProducts(data.products || [])
          }
        } catch (error) {
          console.error('Error searching products:', error)
        } finally {
          setSearching(false)
        }
      }, 300)
    } else if (searchValue.length === 0) {
      setProducts(initialProducts)
    }
  }

  const displayLabel = selectedProduct ? selectedProduct.name : placeholder

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        )}
      >
        <span className={cn(!selectedProduct && "text-muted-foreground")}>
          {displayLabel}
        </span>
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg dark:bg-gray-800 dark:border-gray-600">
            <div className="p-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
              <Input
                placeholder="Type at least 2 characters to search..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-8 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-500 text-gray-900 dark:text-white"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-auto p-1 bg-white dark:bg-gray-800">
              {/* Clear selection option */}
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onValueChange('')
                    setIsOpen(false)
                    setSearch('')
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  Clear selection
                </button>
              )}
              {searching ? (
                <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-amber-600 rounded-full animate-spin mx-auto mb-2"></div>
                  Searching...
                </div>
              ) : products.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  {search.length >= 2 ? 'No products found' : 'Type to search products'}
                </div>
              ) : (
                products.slice(0, 50).map((product) => {
                  const isSelected = product.id.toString() === value

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        onValueChange(product.id.toString())
                        setSelectedProduct(product)
                        setIsOpen(false)
                        setSearch('')
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer text-gray-900 dark:text-gray-100",
                        "hover:bg-blue-50 hover:text-blue-900 dark:hover:bg-blue-900/30 dark:hover:text-blue-100",
                        isSelected && "bg-blue-100 dark:bg-blue-900/40"
                      )}
                    >
                      <Check className={cn("h-4 w-4 text-blue-600 dark:text-blue-400", isSelected ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col items-start">
                        <span className="text-gray-900 dark:text-gray-100">{product.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{product.sku}</span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
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

  // Quick add dialogs
  const [showServiceTypeDialog, setShowServiceTypeDialog] = useState(false)
  const [showTechnicianDialog, setShowTechnicianDialog] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
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
    receivedDate: new Date().toISOString().split('T')[0], // When item was received (editable)
    serviceTypeId: '',
    itemDescription: '', // Required: describes customer's item
    productId: '', // Optional: link to inventory product
    productVariationId: '', // Optional: link to product variation
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
      // Fetch with smaller initial limits for faster page load
      // SearchableSelect already limits display to 100 items and supports search
      const [locRes, stRes, prodRes, techRes, custRes] = await Promise.all([
        fetch('/api/locations'),
        fetch('/api/service-types?limit=100'),
        fetch('/api/products?limit=200'),
        fetch('/api/technicians?limit=100'),
        fetch('/api/customers?limit=200'),
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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validation: itemDescription is required, product fields are now optional
    if (!formData.locationId || !formData.serviceTypeId || !formData.itemDescription ||
        !formData.customerName || !formData.problemDescription) {
      toast.error('Please fill in all required fields: Service Type, Item Description, Customer Name, Problem Description')
      return
    }

    // Show confirmation dialog
    setShowConfirmDialog(true)
  }

  const handleConfirmCreate = async () => {
    setShowConfirmDialog(false)
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
          // jobOrderDate is auto-set by server
          receivedDate: formData.receivedDate || null, // When item was received
          serviceTypeId: parseInt(formData.serviceTypeId),
          itemDescription: formData.itemDescription, // Required: describes customer's item
          productId: formData.productId ? parseInt(formData.productId) : null, // Optional
          productVariationId: formData.productVariationId ? parseInt(formData.productVariationId) : null, // Optional
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

  if (status === 'loading' || loading || locationLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-950 dark:via-orange-900 dark:to-amber-950 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin dark:border-amber-900 dark:border-t-amber-400"></div>
          <p className="mt-4 text-amber-700 font-medium dark:text-amber-300">Loading...</p>
        </div>
      </div>
    )
  }

  if (status === 'authenticated' && !can(PERMISSIONS.JOB_ORDER_CREATE)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-950 dark:via-orange-900 dark:to-amber-950 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 font-medium dark:text-red-400">Access denied. You do not have permission to create job orders.</p>
        </div>
      </div>
    )
  }

  // Prepare customer options with walk-in
  const customerOptions = [
    { id: 'walk-in', name: 'Walk-in Customer', mobile: '', email: '' },
    ...customers
  ]

  // Prepare technician options with unassigned
  const technicianOptions = [
    { id: 'unassigned', firstName: 'Unassigned', lastName: '', employeeCode: '' },
    ...technicians
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-950 dark:via-orange-900 dark:to-amber-950 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="dark:border-amber-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Wrench className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-900 via-orange-800 to-amber-900 bg-clip-text text-transparent dark:from-amber-100 dark:via-orange-300 dark:to-amber-100">
            Create Job Order
          </h1>
        </div>
        <p className="text-amber-700 dark:text-amber-300 mt-2">
          Create a new repair or service job order
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Job Details */}
          <Card className="border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardHeader>
              <CardTitle className="text-amber-900 dark:text-amber-100">Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Location - Auto-set from user */}
                <div>
                  <Label className="dark:text-gray-200">Location *</Label>
                  <div className="mt-1 p-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-gray-100">
                    {userLocation?.name || locations.find(l => l.id.toString() === formData.locationId)?.name || 'Loading...'}
                  </div>
                </div>
                {/* Created Date - Auto-set, read-only */}
                <div>
                  <Label className="dark:text-gray-200">Created Date</Label>
                  <div className="mt-1 p-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-gray-100">
                    {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                </div>
                {/* Received Date - Editable */}
                <div>
                  <Label className="dark:text-gray-200">Received Date</Label>
                  <Input
                    type="date"
                    value={formData.receivedDate}
                    onChange={(e) => handleInputChange('receivedDate', e.target.value)}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>

              {/* Item Description - Required */}
              <div>
                <Label className="dark:text-gray-200">Item Description *</Label>
                <Textarea
                  value={formData.itemDescription}
                  onChange={(e) => handleInputChange('itemDescription', e.target.value)}
                  placeholder="Describe the item being serviced (e.g., iPhone 13 Pro Max - Black, with charger and original box. Screen has minor scratches on top left corner.)"
                  rows={4}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-y"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Include: Item name/model, color, condition, accessories received
                </p>
              </div>

              {/* Service Type */}
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
                <SearchableSelect
                  options={serviceTypes}
                  value={formData.serviceTypeId}
                  onValueChange={(v) => handleInputChange('serviceTypeId', v)}
                  placeholder="Search service type..."
                  searchPlaceholder="Type to search by name, code, category..."
                  renderOption={(st) => ({
                    label: `${st.name} - ₱${st.standardPrice?.toLocaleString() || 0}`,
                    sublabel: `${st.code || ''} | ${st.category || ''}`
                  })}
                  filterFn={(st, search) =>
                    st.name?.toLowerCase().includes(search) ||
                    st.code?.toLowerCase().includes(search) ||
                    st.category?.toLowerCase().includes(search)
                  }
                />
              </div>

              {/* Product - Optional (for items in inventory) */}
              <div>
                <Label className="dark:text-gray-200">
                  Link to Inventory Product <span className="text-gray-400 text-xs font-normal">(optional)</span>
                </Label>
                <ProductSearchSelect
                  value={formData.productId}
                  onValueChange={(v) => handleInputChange('productId', v)}
                  placeholder="Search product (optional)..."
                  initialProducts={products}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Type at least 2 characters to search all products
                </p>
              </div>

              {/* Variation - Only show if product selected */}
              {formData.productId && (
                <div>
                  <Label className="dark:text-gray-200">
                    Product Variation <span className="text-gray-400 text-xs font-normal">(optional)</span>
                  </Label>
                  <Select
                    value={formData.productVariationId}
                    onValueChange={(v) => handleInputChange('productVariationId', v)}
                  >
                    <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                      <SelectValue placeholder="Select variation (optional)" />
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
              )}

              {/* Serial Number */}
              <div>
                <Label className="dark:text-gray-200">Serial Number</Label>
                <Input
                  value={formData.serialNumber}
                  onChange={(e) => handleInputChange('serialNumber', e.target.value)}
                  placeholder="Enter serial number (optional)"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              {/* Priority and Est. Completion */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="dark:text-gray-200">Priority</Label>
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
                  <Label className="dark:text-gray-200">Est. Completion</Label>
                  <Input
                    type="date"
                    value={formData.estimatedEndDate}
                    onChange={(e) => handleInputChange('estimatedEndDate', e.target.value)}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Column - Customer & Assignment */}
          <Card className="border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardHeader>
              <CardTitle className="text-amber-900 dark:text-amber-100">Customer & Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer */}
              <div>
                <Label className="dark:text-gray-200">Existing Customer</Label>
                <SearchableSelect
                  options={customerOptions}
                  value={formData.customerId}
                  onValueChange={(v) => handleInputChange('customerId', v)}
                  placeholder="Search customer..."
                  searchPlaceholder="Type to search by name, phone, email..."
                  renderOption={(c) => ({
                    label: c.name,
                    sublabel: c.id === 'walk-in' ? undefined : `${c.mobile || 'No phone'} | ${c.email || 'No email'}`
                  })}
                  filterFn={(c, search) =>
                    c.name?.toLowerCase().includes(search) ||
                    c.mobile?.toLowerCase().includes(search) ||
                    c.email?.toLowerCase().includes(search)
                  }
                />
              </div>

              {/* Customer Name */}
              <div>
                <Label className="dark:text-gray-200">Customer Name *</Label>
                <Input
                  value={formData.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
                  placeholder="Enter customer name"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              {/* Phone and Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="dark:text-gray-200">Phone</Label>
                  <Input
                    value={formData.customerPhone}
                    onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                    placeholder="Phone number"
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <Label className="dark:text-gray-200">Email</Label>
                  <Input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                    placeholder="Email address"
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>

              {/* Technician */}
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
                <SearchableSelect
                  options={technicianOptions}
                  value={formData.technicianId}
                  onValueChange={(v) => handleInputChange('technicianId', v)}
                  placeholder="Search technician..."
                  searchPlaceholder="Type to search by name or code..."
                  renderOption={(t) => ({
                    label: t.id === 'unassigned' ? 'Unassigned' : `${t.firstName} ${t.lastName}`,
                    sublabel: t.employeeCode || undefined
                  })}
                  filterFn={(t, search) =>
                    t.firstName?.toLowerCase().includes(search) ||
                    t.lastName?.toLowerCase().includes(search) ||
                    t.employeeCode?.toLowerCase().includes(search) ||
                    `${t.firstName} ${t.lastName}`.toLowerCase().includes(search)
                  }
                />
              </div>

              {/* Labor Cost */}
              <div>
                <Label className="dark:text-gray-200">Labor Cost (₱)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.laborCost}
                  onChange={(e) => handleInputChange('laborCost', e.target.value)}
                  placeholder="0.00"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              {/* Problem Description - Made bigger */}
              <div>
                <Label className="dark:text-gray-200">Problem Description *</Label>
                <Textarea
                  value={formData.problemDescription}
                  onChange={(e) => handleInputChange('problemDescription', e.target.value)}
                  placeholder="Describe the issue or problem in detail..."
                  rows={8}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-y min-h-[150px]"
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

      {/* Confirm Create Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-lg dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Confirm Job Order Creation</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Please review the details before creating this job order.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-500 dark:text-gray-400">Location:</div>
              <div className="font-medium dark:text-white">
                {userLocation?.name || locations.find(l => l.id.toString() === formData.locationId)?.name}
              </div>

              <div className="text-gray-500 dark:text-gray-400">Service Type:</div>
              <div className="font-medium dark:text-white">
                {serviceTypes.find(st => st.id.toString() === formData.serviceTypeId)?.name || '-'}
              </div>

              <div className="text-gray-500 dark:text-gray-400">Customer:</div>
              <div className="font-medium dark:text-white">{formData.customerName || '-'}</div>

              <div className="text-gray-500 dark:text-gray-400">Priority:</div>
              <div className="font-medium dark:text-white capitalize">{formData.priority}</div>

              <div className="text-gray-500 dark:text-gray-400">Labor Cost:</div>
              <div className="font-medium dark:text-white">
                {formData.laborCost ? `₱${parseFloat(formData.laborCost).toLocaleString()}` : '-'}
              </div>

              {formData.productId && (
                <>
                  <div className="text-gray-500 dark:text-gray-400">Linked Product:</div>
                  <div className="font-medium dark:text-white">
                    {products.find(p => p.id.toString() === formData.productId)?.name || '-'}
                  </div>
                </>
              )}
            </div>

            <div className="mt-3 pt-3 border-t dark:border-gray-700">
              <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Item Description:</div>
              <div className="text-sm font-medium dark:text-white bg-gray-50 dark:bg-gray-900 p-2 rounded max-h-24 overflow-auto">
                {formData.itemDescription || '-'}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t dark:border-gray-700">
              <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Problem Description:</div>
              <div className="text-sm font-medium dark:text-white bg-gray-50 dark:bg-gray-900 p-2 rounded max-h-24 overflow-auto">
                {formData.problemDescription || '-'}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="dark:border-gray-600"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCreate}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Confirm & Create
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
