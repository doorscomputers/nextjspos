"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { MagnifyingGlassIcon, PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'

interface Customer {
  id: number
  name: string
  email: string | null
  mobile: string | null
  address: string | null
  isActive: boolean
  createdAt: string
}

export default function CustomersPage() {
  const { can } = usePermissions()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Dialog states
  const [showDialog, setShowDialog] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    address: ''
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/customers')
      const data = await response.json()
      if (response.ok) {
        setCustomers(Array.isArray(data) ? data : data.customers || [])
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast.error('Failed to fetch customers')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer)
      setFormData({
        name: customer.name,
        email: customer.email || '',
        mobile: customer.mobile || '',
        address: customer.address || ''
      })
    } else {
      setEditingCustomer(null)
      setFormData({
        name: '',
        email: '',
        mobile: '',
        address: ''
      })
    }
    setShowDialog(true)
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setEditingCustomer(null)
    setFormData({
      name: '',
      email: '',
      mobile: '',
      address: ''
    })
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Customer name is required')
      return
    }

    try {
      const url = editingCustomer
        ? `/api/customers/${editingCustomer.id}`
        : '/api/customers'

      const method = editingCustomer ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(editingCustomer ? 'Customer updated successfully' : 'Customer created successfully')
        handleCloseDialog()
        fetchCustomers()
      } else {
        toast.error(data.error || 'Failed to save customer')
      }
    } catch (error) {
      console.error('Error saving customer:', error)
      toast.error('Failed to save customer')
    }
  }

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`Are you sure you want to delete "${customer.name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Customer deleted successfully')
        fetchCustomers()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete customer')
      }
    } catch (error) {
      console.error('Error deleting customer:', error)
      toast.error('Failed to delete customer')
    }
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.mobile?.includes(searchTerm)
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-4 sm:p-6 lg:p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 bg-clip-text text-transparent">
              Customers
            </h1>
            <p className="text-slate-600 text-sm sm:text-base">Manage your customer database</p>
          </div>
          {can(PERMISSIONS.CUSTOMER_CREATE) && (
            <Button onClick={() => handleOpenDialog()} size="lg" className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <PlusIcon className="w-5 h-5" />
              Add Customer
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <Card className="mb-6 border-slate-200 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardContent className="pt-6">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, or mobile..."
              className="pl-10 h-11 bg-white border-slate-200 focus:border-blue-400 focus:ring-blue-400/20"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <Card className="shadow-lg">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-slate-600 font-medium">Loading customers...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-xl border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-slate-50 to-blue-50/50">
                <TableHead className="font-semibold text-slate-700">Name</TableHead>
                <TableHead className="font-semibold text-slate-700">Email</TableHead>
                <TableHead className="font-semibold text-slate-700">Mobile</TableHead>
                <TableHead className="font-semibold text-slate-700">Address</TableHead>
                <TableHead className="font-semibold text-slate-700">Status</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <p className="text-slate-500 font-medium">No customers found</p>
                      {can(PERMISSIONS.CUSTOMER_CREATE) && (
                        <p className="text-slate-400 text-sm">Click "Add Customer" to create one</p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-blue-50/30 transition-all">
                    <TableCell className="font-medium text-slate-900">{customer.name}</TableCell>
                    <TableCell className="text-slate-700">{customer.email || <span className="text-slate-400">-</span>}</TableCell>
                    <TableCell className="text-slate-700">{customer.mobile || <span className="text-slate-400">-</span>}</TableCell>
                    <TableCell className="text-slate-700 max-w-xs truncate">{customer.address || <span className="text-slate-400">-</span>}</TableCell>
                    <TableCell>
                      {customer.isActive ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-200 text-slate-600 border-slate-300">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {can(PERMISSIONS.CUSTOMER_UPDATE) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDialog(customer)}
                            className="shadow-sm hover:shadow-md transition-all"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </Button>
                        )}
                        {can(PERMISSIONS.CUSTOMER_DELETE) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(customer)}
                            className="shadow-sm hover:shadow-md transition-all text-red-600 hover:text-red-700 hover:border-red-300"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add/Edit Customer Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Customer Name *</Label>
              <Input
                placeholder="Enter customer name..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Email (Optional)</Label>
              <Input
                type="email"
                placeholder="Enter email..."
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Mobile (Optional)</Label>
              <Input
                placeholder="Enter mobile number..."
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              />
            </div>
            <div>
              <Label>Address (Optional)</Label>
              <Textarea
                placeholder="Enter address..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
              {editingCustomer ? 'Update Customer' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
