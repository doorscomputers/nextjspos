'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { ArrowLeft, Wrench, Save } from 'lucide-react'
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

interface Location {
  id: number
  name: string
}

interface ServiceType {
  id: number
  name: string
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
}

interface Customer {
  id: number
  name: string
  mobile: string
  email: string
}

export default function CreateJobOrderPage() {
  const router = useRouter()
  const { status } = useSession()
  const { can } = usePermissions()

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Dropdown data
  const [locations, setLocations] = useState<Location[]>([])
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [variations, setVariations] = useState<ProductVariation[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

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
        fetch('/api/service-types'),
        fetch('/api/products?limit=1000'),
        fetch('/api/technicians'),
        fetch('/api/customers?limit=1000'),
      ])

      if (locRes.ok) {
        const data = await locRes.json()
        // Handle different response formats: { data: [...] }, { locations: [...] }, or [...]
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

    // Auto-fill customer details when customer is selected
    if (field === 'customerId' && value) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.locationId || !formData.serviceTypeId || !formData.productId ||
        !formData.productVariationId || !formData.customerName || !formData.problemDescription) {
      toast.error('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
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
          customerId: formData.customerId ? parseInt(formData.customerId) : null,
          customerName: formData.customerName,
          customerPhone: formData.customerPhone || null,
          customerEmail: formData.customerEmail || null,
          technicianId: formData.technicianId ? parseInt(formData.technicianId) : null,
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

  if (status === 'loading' || loading) {
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
          {/* Left Column */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="dark:text-white">Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="locationId" className="dark:text-gray-200">Location *</Label>
                  <Select value={formData.locationId} onValueChange={(v) => handleInputChange('locationId', v)}>
                    <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id.toString()}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

              <div>
                <Label htmlFor="serviceTypeId" className="dark:text-gray-200">Service Type *</Label>
                <Select value={formData.serviceTypeId} onValueChange={(v) => handleInputChange('serviceTypeId', v)}>
                  <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((st) => (
                      <SelectItem key={st.id} value={st.id.toString()}>
                        {st.name} - ₱{st.standardPrice?.toLocaleString() || 0}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="productId" className="dark:text-gray-200">Product *</Label>
                <Select value={formData.productId} onValueChange={(v) => handleInputChange('productId', v)}>
                  <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((prod) => (
                      <SelectItem key={prod.id} value={prod.id.toString()}>
                        {prod.name} ({prod.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

              <div className="grid grid-cols-2 gap-4">
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

          {/* Right Column */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="dark:text-white">Customer & Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="customerId" className="dark:text-gray-200">Existing Customer</Label>
                <Select value={formData.customerId} onValueChange={(v) => handleInputChange('customerId', v)}>
                  <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder="Select customer (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Walk-in Customer</SelectItem>
                    {customers.map((cust) => (
                      <SelectItem key={cust.id} value={cust.id.toString()}>
                        {cust.name} - {cust.mobile || 'No phone'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

              <div className="grid grid-cols-2 gap-4">
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

              <div>
                <Label htmlFor="technicianId" className="dark:text-gray-200">Assign Technician</Label>
                <Select value={formData.technicianId} onValueChange={(v) => handleInputChange('technicianId', v)}>
                  <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder="Select technician (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id.toString()}>
                        {tech.firstName} {tech.lastName} ({tech.employeeCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
    </div>
  )
}
