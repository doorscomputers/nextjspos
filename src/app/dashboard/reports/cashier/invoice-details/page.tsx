"use client"

import { useState, useEffect } from "react"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { formatCurrency } from "@/lib/currencyUtils"
import { MapPinIcon, MagnifyingGlassIcon, PrinterIcon } from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import DataGrid, {
  Column,
  Summary,
  TotalItem,
} from 'devextreme-react/data-grid'
import 'devextreme/dist/css/dx.light.css'

interface SaleDetail {
  id: number
  invoiceNumber: string
  saleDate: string
  customer: string
  totalAmount: number
  subtotal: number
  taxAmount: number
  discountAmount: number
  discountType: string | null
  paymentStatus: string
  items: Array<{
    productName: string
    variationName: string
    sku: string
    quantity: number
    unitPrice: number
    total: number
  }>
  payments: Array<{
    method: string
    amount: number
  }>
}

export default function CashierInvoiceDetailsPage() {
  const { can } = usePermissions()

  if (!can(PERMISSIONS.REPORT_SALES_VIEW)) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">You do not have permission to view this report</p>
      </div>
    )
  }

  const [loading, setLoading] = useState(false)
  const [userLocationName, setUserLocationName] = useState<string>("Loading...")
  const [userLocationId, setUserLocationId] = useState<number | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [saleDetail, setSaleDetail] = useState<SaleDetail | null>(null)

  useEffect(() => {
    fetchUserLocation()
  }, [])

  const fetchUserLocation = async () => {
    try {
      const response = await fetch("/api/user-locations")
      if (!response.ok) throw new Error("Failed to fetch location")

      const data = await response.json()
      const locations = data.locations || []

      if (locations.length > 0) {
        setUserLocationName(locations[0].name)
        setUserLocationId(locations[0].id)
      } else {
        setUserLocationName("No Location Assigned")
      }
    } catch (error) {
      console.error("Error fetching location:", error)
    }
  }

  const handleSearch = async () => {
    if (!invoiceNumber.trim()) {
      alert("Please enter an invoice number")
      return
    }

    try {
      setLoading(true)
      const response = await fetch(
        `/api/reports/sales/invoice-detail?invoiceNumber=${encodeURIComponent(invoiceNumber)}&locationId=${userLocationId}`
      )

      if (!response.ok) {
        // Try to parse error message from API
        let errorMessage = "Failed to fetch invoice"

        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage

          // Log detailed error in console for debugging
          if (errorData.details) {
            console.error("API Error Details:", errorData.details)
          }
          if (errorData.stack) {
            console.error("API Error Stack:", errorData.stack)
          }
        } catch (parseError) {
          console.error("Could not parse error response:", parseError)
        }

        // Show specific error messages based on status code
        if (response.status === 404) {
          alert("Invoice not found or you do not have access to this location")
        } else if (response.status === 401) {
          alert("Unauthorized. Please log in again.")
        } else if (response.status === 400) {
          alert(errorMessage)
        } else {
          alert(errorMessage)
        }

        console.error("Error response status:", response.status)
        console.error("Error message:", errorMessage)
        setSaleDetail(null)
        return
      }

      const data = await response.json()
      setSaleDetail(data)
    } catch (error) {
      console.error("Error fetching invoice:", error)
      const errorMessage = error instanceof Error ? error.message : "Error fetching invoice details"
      alert(errorMessage)
      setSaleDetail(null)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Invoice Details (Cashier)</h1>
            <div className="flex items-center gap-2 mt-1">
              <MapPinIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Location: <span className="font-semibold text-gray-900 dark:text-white">{userLocationName}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle>Search Invoice</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                placeholder="e.g., INV-2024-00001"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={handleSearch}
                disabled={loading}
                variant="success"
                className="gap-2 min-w-32"
              >
                {loading ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <MagnifyingGlassIcon className="h-4 w-4" />
                )}
                Search
              </Button>
              {saleDetail && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
                >
                  <PrinterIcon className="h-4 w-4" />
                  Print
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Details */}
      {saleDetail && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Invoice: {saleDetail.invoiceNumber}</CardTitle>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  {new Date(saleDetail.saleDate).toLocaleString()}
                </p>
              </div>
              <Badge
                variant={saleDetail.paymentStatus === "paid" ? "default" : "secondary"}
                className={
                  saleDetail.paymentStatus === "paid"
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                }
              >
                {saleDetail.paymentStatus}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer Info */}
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Customer Information</h3>
              <p className="text-gray-700 dark:text-gray-300">{saleDetail.customer}</p>
            </div>

            {/* Items Table with DevExtreme DataGrid */}
            <div>
              <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Sale Items</h3>
              <DataGrid
                dataSource={saleDetail.items}
                showBorders={true}
                showRowLines={true}
                showColumnLines={true}
                rowAlternationEnabled={true}
                columnAutoWidth={true}
                wordWrapEnabled={false}
              >
                <Column
                  dataField="productName"
                  caption="Product"
                  minWidth={200}
                  cellRender={(data) => (
                    <div>
                      {data.value}
                      {data.data.variationName && (
                        <span className="text-sm text-gray-500 dark:text-gray-500">
                          {" "}({data.data.variationName})
                        </span>
                      )}
                    </div>
                  )}
                />
                <Column
                  dataField="sku"
                  caption="SKU"
                  width={120}
                  cssClass="text-sm text-gray-600 dark:text-gray-400"
                />
                <Column
                  dataField="quantity"
                  caption="Qty"
                  dataType="number"
                  format="#,##0.##"
                  alignment="right"
                  width={80}
                />
                <Column
                  dataField="unitPrice"
                  caption="Unit Price"
                  dataType="number"
                  format="₱#,##0.00"
                  alignment="right"
                  width={120}
                />
                <Column
                  dataField="total"
                  caption="Total"
                  dataType="number"
                  format="₱#,##0.00"
                  alignment="right"
                  width={120}
                  cssClass="font-semibold"
                />

                <Summary>
                  <TotalItem column="quantity" summaryType="sum" valueFormat="#,##0.##" />
                  <TotalItem column="total" summaryType="sum" valueFormat="₱#,##0.00" />
                </Summary>
              </DataGrid>
            </div>

            {/* Summary */}
            <div className="border-t pt-4">
              <div className="max-w-md ml-auto space-y-2">
                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(saleDetail.subtotal)}</span>
                </div>
                {saleDetail.discountAmount > 0 && (
                  <div className="flex justify-between text-orange-600 dark:text-orange-400">
                    <span>
                      Discount{saleDetail.discountType && ` (${saleDetail.discountType})`}:
                    </span>
                    <span>-{formatCurrency(saleDetail.discountAmount)}</span>
                  </div>
                )}
                {saleDetail.taxAmount > 0 && (
                  <div className="flex justify-between text-gray-700 dark:text-gray-300">
                    <span>Tax:</span>
                    <span>{formatCurrency(saleDetail.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(saleDetail.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Payment Methods</h3>
              <div className="space-y-2">
                {saleDetail.payments.map((payment, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <Badge variant="secondary">{payment.method}</Badge>
                    <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(payment.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!saleDetail && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500 dark:text-gray-500">
            Enter an invoice number to view details
          </CardContent>
        </Card>
      )}
    </div>
  )
}
