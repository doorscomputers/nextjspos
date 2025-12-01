'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { Search, Package, ShieldCheck, ShieldX, Calendar, User, FileText, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import DataGrid, {
  Column,
  Paging,
  Scrolling,
} from 'devextreme-react/data-grid'
import 'devextreme/dist/css/dx.light.css'

interface SerialNumberInfo {
  serialNumber: string
  product: {
    id: number
    name: string
    sku: string
    category: string | null
    brand: string | null
  }
  warranty: {
    isUnderWarranty: boolean
    warrantyPeriodDays: number
    saleDate: string | null
    warrantyExpiryDate: string | null
    daysRemaining: number | null
  }
  customer: {
    id: number | null
    name: string | null
    mobile: string | null
    email: string | null
  }
  sale: {
    id: number | null
    invoiceNumber: string | null
    saleDate: string | null
    soldBy: string | null
    location: string | null
  }
  claimHistory: any[]
  repairHistory: any[]
}

export default function SerialLookupPage() {
  const { can } = usePermissions()
  const [searchTerm, setSearchTerm] = useState('')
  const [searching, setSearching] = useState(false)
  const [serialInfo, setSerialInfo] = useState<SerialNumberInfo | null>(null)
  const [notFound, setNotFound] = useState(false)

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error('Please enter a serial number')
      return
    }

    setSearching(true)
    setNotFound(false)
    setSerialInfo(null)

    try {
      const response = await fetch(`/api/serial-numbers/lookup?serialNumber=${encodeURIComponent(searchTerm.trim())}`)
      const data = await response.json()

      if (response.ok) {
        setSerialInfo(data)
        toast.success('Serial number found')
      } else if (response.status === 404) {
        setNotFound(true)
        toast.error('Serial number not found')
      } else {
        toast.error(data.error || 'Failed to search serial number')
      }
    } catch (error) {
      console.error('Error searching serial number:', error)
      toast.error('Failed to search serial number')
    } finally {
      setSearching(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  if (!can(PERMISSIONS.WARRANTY_CLAIM_VIEW)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 font-medium dark:text-red-400">Access denied. You do not have permission to view serial number information.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Search className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-blue-400 dark:to-white">
            Serial Number Lookup
          </h1>
        </div>
        <p className="text-slate-600 text-sm sm:text-base dark:text-gray-400 mb-6">
          Search for product warranty and service history by serial number
        </p>

        {/* Search Bar */}
        <Card className="shadow-lg border-slate-200 dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Enter serial number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={searching}
                  className="h-12 text-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={searching || !searchTerm.trim()}
                size="lg"
                className="h-12 px-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {searching ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Not Found Message */}
      {notFound && (
        <Card className="shadow-lg border-slate-200 dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Serial Number Not Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              The serial number "{searchTerm}" does not exist in the system.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Serial Number Information */}
      {serialInfo && (
        <div className="space-y-6">
          {/* Product Information */}
          <Card className="shadow-lg border-slate-200 dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="border-b border-gray-200 dark:border-gray-700">
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Product Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Product Name</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{serialInfo.product.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">SKU</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{serialInfo.product.sku}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Serial Number</p>
                  <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">{serialInfo.serialNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Brand</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{serialInfo.product.brand || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warranty Status */}
          <Card className={`shadow-lg border-2 ${serialInfo.warranty.isUnderWarranty ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20' : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'}`}>
            <CardHeader className="border-b border-gray-200 dark:border-gray-700">
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                {serialInfo.warranty.isUnderWarranty ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ShieldX className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
                Warranty Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${serialInfo.warranty.isUnderWarranty ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {serialInfo.warranty.isUnderWarranty ? 'Active' : 'Expired'}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Warranty Period</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{serialInfo.warranty.warrantyPeriodDays} days</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sale Date</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {serialInfo.warranty.saleDate ? new Date(serialInfo.warranty.saleDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {serialInfo.warranty.isUnderWarranty ? 'Days Remaining' : 'Expired On'}
                  </p>
                  <p className={`text-lg font-semibold ${serialInfo.warranty.isUnderWarranty ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {serialInfo.warranty.isUnderWarranty && serialInfo.warranty.daysRemaining !== null
                      ? `${serialInfo.warranty.daysRemaining} days`
                      : serialInfo.warranty.warrantyExpiryDate
                      ? new Date(serialInfo.warranty.warrantyExpiryDate).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
              </div>

              {serialInfo.warranty.isUnderWarranty && can(PERMISSIONS.WARRANTY_CLAIM_CREATE) && (
                <div className="mt-6">
                  <Button
                    onClick={() => window.location.href = `/dashboard/technical/warranty-claims/create?serialNumber=${serialInfo.serialNumber}`}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Create Warranty Claim
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer & Sale Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Info */}
            <Card className="shadow-lg border-slate-200 dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="border-b border-gray-200 dark:border-gray-700">
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Name</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{serialInfo.customer.name || 'Walk-in Customer'}</p>
                </div>
                {serialInfo.customer.mobile && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Mobile</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{serialInfo.customer.mobile}</p>
                  </div>
                )}
                {serialInfo.customer.email && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Email</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{serialInfo.customer.email}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sale Info */}
            <Card className="shadow-lg border-slate-200 dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="border-b border-gray-200 dark:border-gray-700">
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Sale Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Invoice Number</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{serialInfo.sale.invoiceNumber || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sale Date</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {serialInfo.sale.saleDate ? new Date(serialInfo.sale.saleDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sold By</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{serialInfo.sale.soldBy || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Location</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{serialInfo.sale.location || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Claim History */}
          {serialInfo.claimHistory && serialInfo.claimHistory.length > 0 && (
            <Card className="shadow-lg border-slate-200 dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="border-b border-gray-200 dark:border-gray-700">
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Warranty Claim History ({serialInfo.claimHistory.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <DataGrid
                  dataSource={serialInfo.claimHistory}
                  showBorders={true}
                  showRowLines={true}
                  rowAlternationEnabled={true}
                  columnAutoWidth={true}
                  keyExpr="id"
                >
                  <Scrolling mode="standard" />
                  <Paging enabled={false} />

                  <Column dataField="claimNumber" caption="Claim #" minWidth={120} />
                  <Column dataField="claimDate" caption="Date" minWidth={110} dataType="date" format="dd/MM/yyyy" />
                  <Column dataField="issueDescription" caption="Issue" minWidth={250} />
                  <Column
                    dataField="status"
                    caption="Status"
                    minWidth={120}
                    alignment="center"
                    cellRender={(data) => (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {data.value.replace('_', ' ').toUpperCase()}
                      </span>
                    )}
                  />
                </DataGrid>
              </CardContent>
            </Card>
          )}

          {/* Repair History */}
          {serialInfo.repairHistory && serialInfo.repairHistory.length > 0 && (
            <Card className="shadow-lg border-slate-200 dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="border-b border-gray-200 dark:border-gray-700">
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Repair History ({serialInfo.repairHistory.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <DataGrid
                  dataSource={serialInfo.repairHistory}
                  showBorders={true}
                  showRowLines={true}
                  rowAlternationEnabled={true}
                  columnAutoWidth={true}
                  keyExpr="id"
                >
                  <Scrolling mode="standard" />
                  <Paging enabled={false} />

                  <Column dataField="jobNumber" caption="Job #" minWidth={120} />
                  <Column dataField="jobDate" caption="Date" minWidth={110} dataType="date" format="dd/MM/yyyy" />
                  <Column dataField="serviceType" caption="Service Type" minWidth={180} />
                  <Column dataField="technician" caption="Technician" minWidth={150} />
                  <Column
                    dataField="status"
                    caption="Status"
                    minWidth={120}
                    alignment="center"
                    cellRender={(data) => (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        {data.value.replace('_', ' ').toUpperCase()}
                      </span>
                    )}
                  />
                  <Column
                    dataField="totalCost"
                    caption="Cost"
                    minWidth={100}
                    alignment="right"
                    format={{ type: 'currency', currency: 'PHP' }}
                  />
                </DataGrid>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
