"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { format } from "date-fns"
import {
  CalendarIcon,
  PrinterIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon,
  MapPinIcon,
  BanknotesIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  BuildingLibraryIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { useReactToPrint } from "react-to-print"

interface DenominationData {
  denomination: number
  count: number
  amount: number
}

interface PaymentDetail {
  id: number
  referenceNumber: string | null
  amount: number
  paidAt: string
  saleInvoice: string | null
  customerName: string | null
}

interface PaymentTypeData {
  paymentMethod: string
  total: number
  details: PaymentDetail[]
}

interface ReportData {
  date: string
  businessName: string
  businessAddress: string
  locationName: string
  denominations: DenominationData[]
  totalDenominationCount: number
  totalDenominationAmount: number
  paymentTypes: PaymentTypeData[]
  grandTotal: number
  generatedAt: string
  generatedBy: string
}

interface Location {
  id: number
  name: string
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const getPaymentMethodLabel = (method: string) => {
  const labels: Record<string, string> = {
    cash: "Cash",
    check: "Check",
    gcash: "GCash",
    paymaya: "PayMaya",
    card: "Card",
    nfc: "NFC",
    bank_transfer: "Bank Transfer",
    other: "Other",
  }
  return labels[method] || method
}

const getPaymentMethodIcon = (method: string) => {
  switch (method) {
    case "cash":
      return <BanknotesIcon className="h-5 w-5" />
    case "check":
      return <DocumentTextIcon className="h-5 w-5" />
    case "gcash":
    case "paymaya":
    case "nfc":
      return <DevicePhoneMobileIcon className="h-5 w-5" />
    case "card":
      return <CreditCardIcon className="h-5 w-5" />
    case "bank_transfer":
      return <BuildingLibraryIcon className="h-5 w-5" />
    default:
      return <BanknotesIcon className="h-5 w-5" />
  }
}

export default function DailyCashCollectionPage() {
  const { data: session } = useSession()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [locations, setLocations] = useState<Location[]>([])
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchLocations()
  }, [])

  useEffect(() => {
    if (selectedLocation) {
      fetchReport()
    }
  }, [selectedDate, selectedLocation])

  const fetchLocations = async () => {
    try {
      // Use user-locations API for better access control
      const response = await fetch("/api/user-locations")
      if (response.ok) {
        const data = await response.json()
        const userLocations = Array.isArray(data.locations) ? data.locations : []
        // Filter out warehouse locations
        const filteredLocations = userLocations.filter((loc: Location) =>
          loc?.name && !loc.name.toLowerCase().includes('warehouse')
        )
        setLocations(filteredLocations)
        // Auto-select first location if none selected
        if (filteredLocations.length > 0 && !selectedLocation) {
          setSelectedLocation(filteredLocations[0].id.toString())
        }
      }
    } catch (error) {
      console.error("Error fetching locations:", error)
    }
  }

  const fetchReport = async () => {
    if (!selectedLocation) return

    try {
      setLoading(true)
      const params = new URLSearchParams({ date: selectedDate })
      params.append("locationId", selectedLocation)

      const response = await fetch(`/api/reports/daily-cash-collection?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch report")

      const result = await response.json()
      setReportData(result.data)
    } catch (error) {
      console.error("Error fetching report:", error)
      toast.error("Failed to load daily cash collection report")
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Daily_Cash_Collection_${selectedDate}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 10mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .no-print {
          display: none !important;
        }
      }
    `,
  })

  const exportToExcel = () => {
    if (!reportData) return

    // Create CSV content
    let csv = "Daily Cash Collection Report\n"
    csv += `Date: ${format(new Date(reportData.date), "MMMM dd, yyyy")}\n`
    csv += `Location: ${reportData.locationName}\n`
    csv += `Generated: ${format(new Date(reportData.generatedAt), "MMM dd, yyyy hh:mm a")}\n\n`

    // Denominations
    csv += "CASH DENOMINATIONS\n"
    csv += "Denomination,Quantity,Amount\n"
    reportData.denominations.forEach((d) => {
      csv += `${d.denomination},${d.count},${d.amount}\n`
    })
    csv += `Total,${reportData.totalDenominationCount},${reportData.totalDenominationAmount}\n\n`

    // Payment Types
    reportData.paymentTypes.forEach((pt) => {
      if (pt.details.length > 0 || pt.total > 0) {
        csv += `${getPaymentMethodLabel(pt.paymentMethod).toUpperCase()} PAYMENTS\n`
        csv += "Reference/Payer,Amount,Time\n"
        pt.details.forEach((detail) => {
          csv += `"${detail.referenceNumber || detail.customerName || "-"}",${detail.amount},"${format(new Date(detail.paidAt), "hh:mm a")}"\n`
        })
        csv += `Total,,${pt.total}\n\n`
      }
    })

    csv += `GRAND TOTAL,,${reportData.grandTotal}\n`

    // Download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `Daily_Cash_Collection_${selectedDate}.csv`
    link.click()
    toast.success("Report exported to CSV")
  }

  // Payment section component
  const PaymentSection = ({
    paymentType,
    showIfEmpty = false,
  }: {
    paymentType: PaymentTypeData
    showIfEmpty?: boolean
  }) => {
    if (!showIfEmpty && paymentType.details.length === 0 && paymentType.total === 0) {
      return null
    }

    return (
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        <div className="bg-gray-100 dark:bg-gray-700 px-3 py-2 border-b border-gray-300 dark:border-gray-600">
          <div className="flex items-center gap-2 font-semibold text-sm">
            {getPaymentMethodIcon(paymentType.paymentMethod)}
            {getPaymentMethodLabel(paymentType.paymentMethod).toUpperCase()}
          </div>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-600">
          {/* Header */}
          <div className="grid grid-cols-3 gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400">
            <span>REF/PAYER</span>
            <span className="text-center">
              {paymentType.paymentMethod === "check" ? "CHECK NO." : "REF NO."}
            </span>
            <span className="text-right">AMOUNT</span>
          </div>
          {/* Details */}
          {paymentType.details.length > 0 ? (
            paymentType.details.map((detail, idx) => (
              <div
                key={detail.id}
                className="grid grid-cols-3 gap-2 px-3 py-1.5 text-sm"
              >
                <span className="truncate">
                  {detail.customerName || "-"}
                </span>
                <span className="text-center truncate">
                  {detail.referenceNumber || "-"}
                </span>
                <span className="text-right font-medium">
                  {formatCurrency(detail.amount)}
                </span>
              </div>
            ))
          ) : (
            <div className="px-3 py-3 text-center text-sm text-gray-400">
              No transactions
            </div>
          )}
          {/* Total */}
          <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 font-semibold text-sm">
            <span>TOTAL</span>
            <span></span>
            <span className="text-right">{formatCurrency(paymentType.total)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Daily Cash Collection Report</h1>
        <p className="text-gray-600 dark:text-gray-400">
          View daily collection breakdown by denomination and payment type
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6 no-print">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            {/* Date Picker */}
            <div className="w-full md:w-48">
              <label className="block text-sm font-medium mb-1.5">Report Date</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Location Filter */}
            <div className="w-full md:w-56">
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <MapPinIcon className="h-4 w-4 mr-2 text-gray-400" />
                  <SelectValue placeholder="Select Location" />
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

            {/* Action Buttons */}
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchReport}
                disabled={loading}
                className="gap-2"
              >
                <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                disabled={!reportData}
                className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePrint()}
                disabled={!reportData}
                className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
              >
                <PrinterIcon className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : reportData ? (
        <div ref={printRef} className="bg-white dark:bg-gray-900 p-4 md:p-6 rounded-lg">
          {/* Print Header */}
          <div className="text-center mb-6 print:block hidden">
            <h2 className="text-xl font-bold">{reportData.businessName}</h2>
            <p className="text-sm text-gray-600">{reportData.businessAddress}</p>
            <h3 className="text-lg font-semibold mt-2">DAILY CASH COLLECTION REPORT</h3>
            <p className="text-sm">
              Date: {format(new Date(reportData.date), "MMMM dd, yyyy")} | Location: {reportData.locationName}
            </p>
          </div>

          {/* Main Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Column - Cash Denominations */}
            <div className="lg:col-span-3">
              <Card className="h-full">
                <CardHeader className="py-3 px-4 bg-green-50 dark:bg-green-900/20">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BanknotesIcon className="h-5 w-5 text-green-600" />
                    CASH DENOMINATIONS
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        <th className="text-left py-2 px-3 font-medium">DENOM</th>
                        <th className="text-center py-2 px-3 font-medium">QTY</th>
                        <th className="text-right py-2 px-3 font-medium">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.denominations.map((d) => (
                        <tr key={d.denomination} className="border-b dark:border-gray-700">
                          <td className="py-1.5 px-3">
                            {d.denomination >= 1 ? d.denomination.toLocaleString() : d.denomination}
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            {d.count > 0 ? d.count : "-"}
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            {d.amount > 0 ? formatCurrency(d.amount) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-green-50 dark:bg-green-900/20 font-semibold">
                        <td className="py-2 px-3">TOTAL</td>
                        <td className="py-2 px-3 text-center">{reportData.totalDenominationCount}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(reportData.totalDenominationAmount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>

              {/* Collection Summary */}
              <Card className="mt-4">
                <CardContent className="p-4 bg-blue-50 dark:bg-blue-900/20">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    TOTAL COLLECTION
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ₱{formatCurrency(reportData.grandTotal)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Payment Types Grid */}
            <div className="lg:col-span-9">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {reportData.paymentTypes.map((pt) => (
                  <PaymentSection key={pt.paymentMethod} paymentType={pt} showIfEmpty={pt.paymentMethod === "cash"} />
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
            <span>Generated by: {reportData.generatedBy}</span>
            <span>Generated at: {format(new Date(reportData.generatedAt), "MMM dd, yyyy hh:mm a")}</span>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500 dark:text-gray-400">
            No data available. Select a date and location to view the report.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
