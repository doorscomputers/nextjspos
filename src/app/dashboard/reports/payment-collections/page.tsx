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
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";
import { useReactToPrint } from "react-to-print";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface PaymentCollection {
  id: number;
  invoiceNumber: string;
  saleDate: string;
  paymentDate: string;
  customerName: string;
  customerId: number | null;
  saleLocation: string;
  saleLocationId: number;
  collectionLocation: string;
  collectionLocationId: number | null;
  isCrossLocation: boolean;
  paymentMethod: string;
  amount: number;
  referenceNumber: string | null;
  shiftNumber: string | null;
  collectedBy: string;
  collectedById: number | null;
}

interface Summary {
  totalCollections: number;
  totalAmount: number;
  crossLocationCollections: number;
  crossLocationAmount: number;
  crossLocationPercentage: string;
  byCollectionLocation: Record<string, { count: number; amount: number }>;
  byPaymentMethod: Record<string, { count: number; amount: number }>;
}

export default function PaymentCollectionsPage() {
  const { data: session } = useSession();
  const printRef = useRef<HTMLDivElement>(null);

  // Filter states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [collectionLocationId, setCollectionLocationId] = useState("all");
  const [saleLocationId, setSaleLocationId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Data states
  const [collections, setCollections] = useState<PaymentCollection[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch("/api/business-locations");
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

  // Fetch report
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (paymentMethod !== "all") params.append("paymentMethod", paymentMethod);
      if (collectionLocationId !== "all")
        params.append("collectionLocationId", collectionLocationId);
      if (saleLocationId !== "all") params.append("saleLocationId", saleLocationId);

      const response = await fetch(`/api/reports/payment-collections?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setCollections(data.data.collections);
        setSummary(data.data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch report:", error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchReport();
  }, []);

  // Filter collections by search query
  const filteredCollections = collections.filter((c) => {
    const query = searchQuery.toLowerCase();
    return (
      c.invoiceNumber.toLowerCase().includes(query) ||
      c.customerName.toLowerCase().includes(query) ||
      c.saleLocation.toLowerCase().includes(query) ||
      c.collectionLocation.toLowerCase().includes(query) ||
      c.collectedBy.toLowerCase().includes(query)
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
    };
    return names[method] || method;
  };

  // Handle print
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Payment_Collections_${new Date().toLocaleDateString()}`,
  });

  // Handle CSV export
  const handleExportCSV = () => {
    const csvData = filteredCollections.map((c) => ({
      "Invoice #": c.invoiceNumber,
      "Sale Date": new Date(c.saleDate).toLocaleDateString(),
      "Payment Date": new Date(c.paymentDate).toLocaleString(),
      Customer: c.customerName,
      "Sale Location": c.saleLocation,
      "Collection Location": c.collectionLocation,
      "Cross-Location": c.isCrossLocation ? "Yes" : "No",
      "Payment Method": getPaymentMethodName(c.paymentMethod),
      Amount: c.amount.toFixed(2),
      "Reference #": c.referenceNumber || "",
      "Shift #": c.shiftNumber || "",
      "Collected By": c.collectedBy,
    }));

    const ws = XLSX.utils.json_to_sheet(csvData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Payment_Collections_${new Date().toLocaleDateString()}.csv`;
    a.click();
  };

  // Handle Excel export
  const handleExportExcel = () => {
    const excelData = filteredCollections.map((c) => ({
      "Invoice #": c.invoiceNumber,
      "Sale Date": new Date(c.saleDate).toLocaleDateString(),
      "Payment Date": new Date(c.paymentDate).toLocaleString(),
      Customer: c.customerName,
      "Sale Location": c.saleLocation,
      "Collection Location": c.collectionLocation,
      "Cross-Location": c.isCrossLocation ? "Yes" : "No",
      "Payment Method": getPaymentMethodName(c.paymentMethod),
      Amount: c.amount,
      "Reference #": c.referenceNumber || "",
      "Shift #": c.shiftNumber || "",
      "Collected By": c.collectedBy,
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payment Collections");
    XLSX.writeFile(wb, `Payment_Collections_${new Date().toLocaleDateString()}.xlsx`);
  };

  // Handle PDF export
  const handleExportPDF = () => {
    const doc = new jsPDF("landscape");
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.text("Payment Collection Report", pageWidth / 2, 15, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 22, {
      align: "center",
    });

    if (startDate || endDate) {
      const dateRange = `Period: ${startDate || "Start"} to ${endDate || "Today"}`;
      doc.text(dateRange, pageWidth / 2, 28, { align: "center" });
    }

    const tableData = filteredCollections.map((c) => [
      c.invoiceNumber,
      new Date(c.paymentDate).toLocaleDateString(),
      c.customerName,
      c.saleLocation,
      c.collectionLocation,
      c.isCrossLocation ? "✓" : "",
      c.amount.toFixed(2),
      c.collectedBy,
    ]);

    (doc as any).autoTable({
      startY: 35,
      head: [
        [
          "Invoice #",
          "Date",
          "Customer",
          "Sale Loc",
          "Collect Loc",
          "Cross",
          "Amount",
          "Cashier",
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
          "",
          "",
          "Total:",
          summary?.totalAmount.toFixed(2) || "0.00",
          "",
        ],
      ],
    });

    doc.save(`Payment_Collections_${new Date().toLocaleDateString()}.pdf`);
  };

  // Quick date filter handlers
  const setQuickDateFilter = (filter: string) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (filter) {
      case "today":
        start = new Date(today.setHours(0, 0, 0, 0));
        end = new Date(today.setHours(23, 59, 59, 999));
        break;
      case "yesterday":
        start = new Date(today.setDate(today.getDate() - 1));
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
        break;
      case "last7days":
        start = new Date(today.setDate(today.getDate() - 7));
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      case "last30days":
        start = new Date(today.setDate(today.getDate() - 30));
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      case "thisweek":
        const dayOfWeek = today.getDay();
        start = new Date(today.setDate(today.getDate() - dayOfWeek));
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      case "lastweek":
        const lastWeekStart = new Date(today.setDate(today.getDate() - today.getDay() - 7));
        lastWeekStart.setHours(0, 0, 0, 0);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
        lastWeekEnd.setHours(23, 59, 59, 999);
        start = lastWeekStart;
        end = lastWeekEnd;
        break;
      case "thismonth":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      case "lastmonth":
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        break;
    }

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  };

  // Clear filters
  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setPaymentMethod("all");
    setCollectionLocationId("all");
    setSaleLocationId("all");
    setSearchQuery("");
    fetchReport();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Payment Collection Report
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Track AR payment collections across locations. Shows which location collected payments
          for invoices created at other branches.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        {/* Quick Date Filters */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quick Date Filters
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter("today")}
              className="hover:bg-green-50 dark:hover:bg-green-950"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter("yesterday")}
              className="hover:bg-green-50 dark:hover:bg-green-950"
            >
              Yesterday
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter("last7days")}
              className="hover:bg-green-50 dark:hover:bg-green-950"
            >
              Last 7 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter("last30days")}
              className="hover:bg-green-50 dark:hover:bg-green-950"
            >
              Last 30 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter("thisweek")}
              className="hover:bg-green-50 dark:hover:bg-green-950"
            >
              This Week
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter("lastweek")}
              className="hover:bg-green-50 dark:hover:bg-green-950"
            >
              Last Week
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter("thismonth")}
              className="hover:bg-green-50 dark:hover:bg-green-950"
            >
              This Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter("lastmonth")}
              className="hover:bg-green-50 dark:hover:bg-green-950"
            >
              Last Month
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sale Location
            </label>
            <select
              value={saleLocationId}
              onChange={(e) => setSaleLocationId(e.target.value)}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Collection Location
            </label>
            <select
              value={collectionLocationId}
              onChange={(e) => setCollectionLocationId(e.target.value)}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Invoice, customer, location..."
                className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="success" size="sm" onClick={fetchReport} disabled={loading} className="gap-2">
            {loading && <span className="animate-spin">⏳</span>}
            Apply Filters
          </Button>

          <Button variant="outline" size="sm" onClick={clearFilters} className="gap-2">
            <XMarkIcon className="h-4 w-4" />
            Clear Filters
          </Button>

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
              Total Collections
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {summary.totalCollections}
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

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <ArrowsRightLeftIcon className="h-4 w-4" />
              Cross-Location
            </div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
              {summary.crossLocationCollections}
              <span className="text-sm text-gray-500 ml-2">
                ({summary.crossLocationPercentage}%)
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Cross-Location Amount
            </div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
              ₱{summary.crossLocationAmount.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Collection Table */}
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
                  Date
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Customer
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Sale Loc
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Collection Loc
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">
                  Method
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">
                  Amount
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Collected By
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Loading collections...
                  </td>
                </tr>
              ) : filteredCollections.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No payment collections found
                  </td>
                </tr>
              ) : (
                filteredCollections.map((collection) => (
                  <tr
                    key={collection.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      collection.isCrossLocation ? "bg-orange-50 dark:bg-orange-950" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {collection.invoiceNumber}
                      {collection.isCrossLocation && (
                        <ArrowsRightLeftIcon className="inline h-3 w-3 ml-1 text-orange-600" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {new Date(collection.paymentDate).toLocaleDateString()}
                      <div className="text-xs text-gray-500">
                        {new Date(collection.paymentDate).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {collection.customerName}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {collection.saleLocation}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {collection.collectionLocation}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          collection.paymentMethod === "cash"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : collection.paymentMethod === "card"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                        }`}
                      >
                        {getPaymentMethodName(collection.paymentMethod)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                      ₱{collection.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {collection.collectedBy}
                      {collection.shiftNumber && (
                        <div className="text-xs text-gray-500">
                          Shift: {collection.shiftNumber}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredCollections.length > 0 && (
              <tfoot className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Total:
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                    ₱
                    {filteredCollections
                      .reduce((sum, c) => sum + c.amount, 0)
                      .toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
