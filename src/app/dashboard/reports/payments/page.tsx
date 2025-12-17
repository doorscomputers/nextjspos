"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DocumentArrowDownIcon,
  DocumentTextIcon,
  PrinterIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useReactToPrint } from "react-to-print";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface Payment {
  id: number;
  invoiceNumber: string;
  saleDate: string;
  paidAt: string;
  customerName: string;
  customerId: number | null;
  locationName: string;
  locationId: number;
  paymentMethod: string;
  amount: number;
  referenceNumber: string | null;
  shiftNumber: string | null;
  shiftId: number | null;
  collectedBy: string | null;
  collectedById: number | null;
  createdBy: string;
  saleTotal: number;
  isArPayment: boolean;
}

interface PaymentSummary {
  totalPayments: number;
  totalAmount: number;
  paymentMethodBreakdown: Record<string, number>;
}

export default function PaymentReportPage() {
  const { data: session } = useSession();
  const printRef = useRef<HTMLDivElement>(null);

  // Filter states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [locationId, setLocationId] = useState("all");
  const [customerId, setCustomerId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Data states
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch("/api/locations/all-active");
        const data = await response.json();
        if (data.success) {
          setLocations(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch locations:", error);
      }
    };
    fetchLocations();
  }, []);

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await fetch("/api/customers");
        const data = await response.json();
        // API returns array directly, not { success, data }
        if (Array.isArray(data)) {
          setCustomers(data);
        } else if (data.success && data.data) {
          setCustomers(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch customers:", error);
      }
    };
    fetchCustomers();
  }, []);

  // Fetch payment report
  const fetchPaymentReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (paymentMethod !== "all") params.append("paymentMethod", paymentMethod);
      if (locationId !== "all") params.append("locationId", locationId);
      if (customerId !== "all") params.append("customerId", customerId);

      const response = await fetch(`/api/reports/payments?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setPayments(data.data.payments);
        setSummary(data.data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch payment report:", error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchPaymentReport();
  }, []);

  // Filter payments by search query
  const filteredPayments = payments.filter((payment) => {
    const query = searchQuery.toLowerCase();
    return (
      payment.invoiceNumber.toLowerCase().includes(query) ||
      payment.customerName.toLowerCase().includes(query) ||
      payment.paymentMethod.toLowerCase().includes(query) ||
      payment.referenceNumber?.toLowerCase().includes(query) ||
      payment.shiftNumber?.toLowerCase().includes(query)
    );
  });

  // Payment method display names
  const getPaymentMethodName = (method: string) => {
    const names: Record<string, string> = {
      cash: "Cash",
      card: "Card",
      cheque: "Cheque",
      bank_transfer: "Bank Transfer",
      gcash: "GCash",
      paymaya: "PayMaya",
      credit: "AR/Credit",
      mobile_payment: "Mobile Payment",
    };
    return names[method] || method;
  };

  // Handle print
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Payment_Report_${new Date().toLocaleDateString()}`,
  });

  // Handle CSV export
  const handleExportCSV = () => {
    const csvData = filteredPayments.map((payment) => ({
      "Invoice #": payment.invoiceNumber,
      "Sale Date": new Date(payment.saleDate).toLocaleDateString(),
      "Payment Date": new Date(payment.paidAt).toLocaleString(),
      Customer: payment.customerName,
      Location: payment.locationName,
      "Payment Method": getPaymentMethodName(payment.paymentMethod),
      Amount: payment.amount.toFixed(2),
      "Reference #": payment.referenceNumber || "",
      "Shift #": payment.shiftNumber || "",
      "Collected By": payment.collectedBy || payment.createdBy,
      "AR Payment": payment.isArPayment ? "Yes" : "No",
    }));

    const ws = XLSX.utils.json_to_sheet(csvData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Payment_Report_${new Date().toLocaleDateString()}.csv`;
    a.click();
  };

  // Handle Excel export
  const handleExportExcel = () => {
    const excelData = filteredPayments.map((payment) => ({
      "Invoice #": payment.invoiceNumber,
      "Sale Date": new Date(payment.saleDate).toLocaleDateString(),
      "Payment Date": new Date(payment.paidAt).toLocaleString(),
      Customer: payment.customerName,
      Location: payment.locationName,
      "Payment Method": getPaymentMethodName(payment.paymentMethod),
      Amount: payment.amount,
      "Reference #": payment.referenceNumber || "",
      "Shift #": payment.shiftNumber || "",
      "Collected By": payment.collectedBy || payment.createdBy,
      "AR Payment": payment.isArPayment ? "Yes" : "No",
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payments");
    XLSX.writeFile(wb, `Payment_Report_${new Date().toLocaleDateString()}.xlsx`);
  };

  // Handle PDF export
  const handleExportPDF = () => {
    const doc = new jsPDF("landscape");
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(16);
    doc.text("Payment Report", pageWidth / 2, 15, { align: "center" });

    doc.setFontSize(10);
    doc.text(
      `Generated: ${new Date().toLocaleString()}`,
      pageWidth / 2,
      22,
      { align: "center" }
    );

    if (startDate || endDate) {
      const dateRange = `Period: ${startDate || "Start"} to ${endDate || "Today"}`;
      doc.text(dateRange, pageWidth / 2, 28, { align: "center" });
    }

    // Table data
    const tableData = filteredPayments.map((payment) => [
      payment.invoiceNumber,
      new Date(payment.paidAt).toLocaleDateString(),
      payment.customerName,
      getPaymentMethodName(payment.paymentMethod),
      payment.amount.toFixed(2),
      payment.referenceNumber || "",
      payment.shiftNumber || "",
      payment.isArPayment ? "AR" : "Direct",
    ]);

    (doc as any).autoTable({
      startY: 35,
      head: [
        [
          "Invoice #",
          "Payment Date",
          "Customer",
          "Method",
          "Amount",
          "Reference #",
          "Shift #",
          "Type",
        ],
      ],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [34, 197, 94] },
      footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0] },
      foot: [
        [
          "",
          "",
          "",
          "Total:",
          summary?.totalAmount.toFixed(2) || "0.00",
          "",
          "",
          "",
        ],
      ],
    });

    doc.save(`Payment_Report_${new Date().toLocaleDateString()}.pdf`);
  };

  // Clear filters
  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setPaymentMethod("all");
    setLocationId("all");
    setCustomerId("all");
    setSearchQuery("");
    fetchPaymentReport();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Payment Report
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Track all payments by method (Cash, Card, Cheque, Bank Transfer) with invoice details.
          Critical for Z Reading accuracy and cash reconciliation.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="cheque">Cheque</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="gcash">GCash</option>
              <option value="paymaya">PayMaya</option>
              <option value="credit">AR/Credit</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location
            </label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Customer
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Customers</option>
              {customers.map((cust) => (
                <option key={cust.id} value={cust.id}>
                  {cust.firstName} {cust.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Invoice, customer, reference..."
                className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Filter Actions */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            variant="success"
            size="sm"
            onClick={fetchPaymentReport}
            disabled={loading}
            className="gap-2"
          >
            {loading && <span className="animate-spin">⏳</span>}
            Apply Filters
          </Button>

          <Button variant="outline" size="sm" onClick={clearFilters} className="gap-2">
            <XMarkIcon className="h-4 w-4" />
            Clear Filters
          </Button>

          {/* Export Buttons */}
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400"
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
              CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400"
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
              Excel
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="gap-2 hover:border-red-500 hover:text-red-700 dark:hover:text-red-400"
            >
              <DocumentTextIcon className="h-4 w-4" />
              PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
            >
              <PrinterIcon className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Payments
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {summary.totalPayments}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Amount
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              ₱{summary.totalAmount.toFixed(2)}
            </div>
          </div>

          {Object.entries(summary.paymentMethodBreakdown)
            .filter(([key]) => key !== "total")
            .slice(0, 2)
            .map(([method, amount]) => (
              <div
                key={method}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {getPaymentMethodName(method)}
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  ₱{amount.toFixed(2)}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Payment Table */}
      <div
        ref={printRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Invoice #
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Payment Date
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Customer
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Location
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Method
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">
                  Amount
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Reference #
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Shift #
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Type
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    Loading payments...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No payments found
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {payment.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {new Date(payment.paidAt).toLocaleDateString()}
                      <div className="text-xs text-gray-500">
                        {new Date(payment.paidAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {payment.customerName}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {payment.locationName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          payment.paymentMethod === "cash"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : payment.paymentMethod === "card"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : payment.paymentMethod === "cheque"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                        }`}
                      >
                        {getPaymentMethodName(payment.paymentMethod)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                      ₱{payment.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {payment.referenceNumber || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {payment.shiftNumber || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          payment.isArPayment
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                        }`}
                      >
                        {payment.isArPayment ? "AR Collection" : "Direct Sale"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredPayments.length > 0 && (
              <tfoot className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Total:
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                    ₱
                    {filteredPayments
                      .reduce((sum, p) => sum + p.amount, 0)
                      .toFixed(2)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Payment Method Breakdown */}
      {summary && Object.keys(summary.paymentMethodBreakdown).length > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Payment Method Breakdown
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(summary.paymentMethodBreakdown)
              .filter(([key]) => key !== "total")
              .map(([method, amount]) => (
                <div
                  key={method}
                  className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-md"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {getPaymentMethodName(method)}
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    ₱{amount.toFixed(2)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
