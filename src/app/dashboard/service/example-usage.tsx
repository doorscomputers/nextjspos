/**
 * EXAMPLE USAGE: Service Warranty Slip Component
 *
 * This file demonstrates how to integrate the ServiceWarrantySlipPrint component
 * into your service management pages.
 *
 * You can copy and adapt this code for your actual service job order pages.
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ServiceWarrantySlipPrint from '@/components/ServiceWarrantySlipPrint'
import { Printer, Download, Mail } from 'lucide-react'

export default function ServiceJobOrderDetailExample({ jobOrderId }: { jobOrderId: number }) {
  const [showWarrantySlip, setShowWarrantySlip] = useState(false)
  const [jobOrder, setJobOrder] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [copyType, setCopyType] = useState<'customer' | 'office' | 'technician'>('customer')

  /**
   * Fetch job order data and show warranty slip
   */
  const handlePrintWarrantySlip = async (type: 'customer' | 'office' | 'technician') => {
    setLoading(true)
    setCopyType(type)

    try {
      const response = await fetch(
        `/api/reports/service-warranty-slip?jobOrderId=${jobOrderId}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch job order')
      }

      const data = await response.json()

      if (data.jobOrder) {
        setJobOrder(data.jobOrder)
        setShowWarrantySlip(true)
      } else {
        alert('Job order not found')
      }
    } catch (error) {
      console.error('Error fetching warranty slip:', error)
      alert('Failed to load warranty slip. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Example: Email warranty slip (implementation needed)
   */
  const handleEmailWarrantySlip = async () => {
    // TODO: Implement email functionality
    alert('Email functionality to be implemented')
  }

  return (
    <div className="space-y-6">
      {/* Service Job Order Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Service Job Order #{jobOrderId}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Job Order Information would go here */}
            <div className="text-sm text-gray-600">
              <p>Customer: John Doe</p>
              <p>Product: Laptop HP Pavilion 15</p>
              <p>Status: Completed</p>
            </div>

            {/* Action Buttons */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Print Warranty Slip</h3>
              <div className="flex flex-wrap gap-2">
                {/* Customer Copy */}
                <Button
                  onClick={() => handlePrintWarrantySlip('customer')}
                  disabled={loading}
                  variant="default"
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Customer Copy
                </Button>

                {/* Office Copy */}
                <Button
                  onClick={() => handlePrintWarrantySlip('office')}
                  disabled={loading}
                  variant="outline"
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Office Copy
                </Button>

                {/* Technician Copy */}
                <Button
                  onClick={() => handlePrintWarrantySlip('technician')}
                  disabled={loading}
                  variant="outline"
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Technician Copy
                </Button>

                {/* Email to Customer */}
                <Button
                  onClick={handleEmailWarrantySlip}
                  disabled={loading}
                  variant="secondary"
                  className="gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Email to Customer
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warranty Slip Print Dialog */}
      {showWarrantySlip && jobOrder && (
        <ServiceWarrantySlipPrint
          jobOrder={jobOrder}
          isOpen={showWarrantySlip}
          onClose={() => setShowWarrantySlip(false)}
          copyType={copyType}
        />
      )}
    </div>
  )
}

/**
 * INTEGRATION EXAMPLE: Service Management Page
 *
 * Full page implementation with data fetching
 */
export function ServiceManagementPageExample() {
  const [jobOrders, setJobOrders] = useState<any[]>([])
  const [selectedJobOrder, setSelectedJobOrder] = useState<any>(null)
  const [showWarrantySlip, setShowWarrantySlip] = useState(false)

  /**
   * Fetch all job orders (example)
   */
  const fetchJobOrders = async () => {
    try {
      const response = await fetch('/api/service/job-orders')
      const data = await response.json()
      setJobOrders(data.jobOrders || [])
    } catch (error) {
      console.error('Error fetching job orders:', error)
    }
  }

  /**
   * Print warranty slip for specific job order
   */
  const handlePrintWarranty = async (jobOrderId: number) => {
    try {
      const response = await fetch(
        `/api/reports/service-warranty-slip?jobOrderId=${jobOrderId}`
      )
      const data = await response.json()

      if (data.jobOrder) {
        setSelectedJobOrder(data.jobOrder)
        setShowWarrantySlip(true)
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to load warranty slip')
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Service Management</h1>

        {/* Job Orders Table */}
        <Card>
          <CardContent className="p-6">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Job Order #</th>
                  <th className="text-left p-2">Customer</th>
                  <th className="text-left p-2">Product</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-right p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobOrders.map((order) => (
                  <tr key={order.id} className="border-b">
                    <td className="p-2">{order.jobOrderNumber}</td>
                    <td className="p-2">{order.customerName}</td>
                    <td className="p-2">{order.productName}</td>
                    <td className="p-2">
                      <span className="capitalize px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {order.status}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        onClick={() => handlePrintWarranty(order.id)}
                        size="sm"
                        variant="outline"
                        className="gap-2"
                      >
                        <Printer className="h-3 w-3" />
                        Print Warranty
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Warranty Slip Dialog */}
        {showWarrantySlip && selectedJobOrder && (
          <ServiceWarrantySlipPrint
            jobOrder={selectedJobOrder}
            isOpen={showWarrantySlip}
            onClose={() => setShowWarrantySlip(false)}
            copyType="customer"
          />
        )}
      </div>
    </div>
  )
}

/**
 * QUICK ACTION COMPONENT
 *
 * Minimal component for quick warranty slip printing
 */
export function QuickPrintWarrantyButton({ jobOrderId }: { jobOrderId: number }) {
  const [loading, setLoading] = useState(false)

  const handleQuickPrint = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/reports/service-warranty-slip?jobOrderId=${jobOrderId}`
      )
      const data = await response.json()

      if (data.jobOrder) {
        // Open in new component or trigger print directly
        window.open(
          `/dashboard/service/${jobOrderId}/print-warranty`,
          '_blank',
          'width=800,height=600'
        )
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleQuickPrint}
      disabled={loading}
      size="sm"
      className="gap-2"
    >
      <Printer className="h-4 w-4" />
      {loading ? 'Loading...' : 'Print Warranty'}
    </Button>
  )
}

/**
 * USAGE NOTES:
 *
 * 1. Import the ServiceWarrantySlipPrint component
 * 2. Fetch job order data using the API route
 * 3. Pass the job order data to the component
 * 4. Set copyType: 'customer', 'office', or 'technician'
 * 5. Handle the onClose callback to hide the dialog
 *
 * REQUIRED PROPS:
 * - jobOrder: Complete job order object from API
 * - isOpen: Boolean to show/hide dialog
 * - onClose: Function to close dialog
 * - copyType: Optional 'customer' | 'office' | 'technician'
 *
 * FEATURES:
 * - Multi-paper size support (80mm, A4, Letter, Legal)
 * - Professional print formatting
 * - Complete warranty information
 * - Customer, office, and technician copies
 * - BIR-compliant layout
 */
