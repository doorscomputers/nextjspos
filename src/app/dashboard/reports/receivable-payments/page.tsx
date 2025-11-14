"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DocumentArrowDownIcon,
  DocumentTextIcon,
  PrinterIcon,
  XMarkIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import DataGrid, {
  Column,
  FilterRow,
  HeaderFilter,
  Paging,
  Sorting,
  Export,
  Summary,
  TotalItem,
  SearchPanel,
  ColumnChooser,
  StateStoring,
  Grouping,
  GroupPanel,
  GroupItem,
} from "devextreme-react/data-grid";
import { Workbook } from "exceljs";
import { saveAs } from "file-saver-es";
import { exportDataGrid } from "devextreme/excel_exporter";
import jsPDF from "jspdf";
import "jspdf-autotable";
import toast from "react-hot-toast";

// Import DevExtreme theme dynamically
import "devextreme/dist/css/dx.light.css";

interface Payment {
  id: number;
  paymentDate: Date;
  invoiceNumber: string;
  invoiceDate: Date;
  customerId: number | null;
  customerName: string;
  saleLocation: string;
  saleLocationId: number;
  collectionLocation: string;
  collectionLocationId: number | null;
  paymentMethod: string;
  amount: number;
  referenceNumber: string | null;
  shiftNumber: string | null;
  collectedBy: string;
  collectedById: number | null;
}

interface Summary {
  totalPayments: number;
  totalAmount: number;
  byPaymentMethod: Record<string, { count: number; amount: number }>;
  byLocation: Record<string, { count: number; amount: number }>;
}

export default function ReceivablePaymentsPage() {
  const { data: session } = useSession();
  const dataGridRef = useRef<DataGrid>(null);

  // Helper to format date as YYYY-MM-DD
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Default to today's date
  const today = new Date();
  const todayStr = formatDateForInput(today);

  // Filter states
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [customerId, setCustomerId] = useState("all");
  const [locationId, setLocationId] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [cashierId, setCashierId] = useState("all");
  const [groupByCustomer, setGroupByCustomer] = useState(false);

  // Data states
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [cashiers, setCashiers] = useState<any[]>([]);
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

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await fetch("/api/customers");
        const data = await response.json();
        // Customers API returns array directly (not wrapped in success/data)
        if (Array.isArray(data)) {
          setCustomers(data);
        } else if (data.success && data.data) {
          setCustomers(data.data);
        } else if (data.success === false && Array.isArray(data)) {
          setCustomers(data);
        } else {
          setCustomers(data);
        }
      } catch (error) {
        console.error("Failed to fetch customers:", error);
      }
    };
    fetchCustomers();
  }, []);

  // Fetch users (cashiers)
  useEffect(() => {
    const fetchCashiers = async () => {
      try {
        const response = await fetch("/api/users");
        const data = await response.json();
        // Handle different response formats
        if (Array.isArray(data)) {
          setCashiers(data);
        } else if (data.success && Array.isArray(data.data)) {
          setCashiers(data.data);
        } else if (data.users && Array.isArray(data.users)) {
          setCashiers(data.users);
        }
      } catch (error) {
        console.error("Failed to fetch cashiers:", error);
      }
    };
    fetchCashiers();
  }, []);

  // Fetch report
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (customerId !== "all") params.append("customerId", customerId);
      if (locationId !== "all") params.append("locationId", locationId);
      if (paymentMethod !== "all") params.append("paymentMethod", paymentMethod);
      if (cashierId !== "all") params.append("cashierId", cashierId);

      const response = await fetch(`/api/reports/receivable-payments?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setPayments(data.data.payments);
        setSummary(data.data.summary);
        toast.success("Report loaded successfully");
      } else {
        toast.error(data.error || "Failed to load report");
      }
    } catch (error) {
      console.error("Failed to fetch receivable payments report:", error);
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchReport();
  }, []);

  // Quick date filters
  const setQuickDateFilter = (range: string) => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (range) {
      case 'today':
        start = now;
        end = now;
        break;
      case 'yesterday':
        start = new Date(now);
        start.setDate(start.getDate() - 1);
        end = new Date(now);
        end.setDate(end.getDate() - 1);
        break;
      case 'thisWeek':
        start = new Date(now);
        start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
        end = now;
        break;
      case 'lastWeek':
        start = new Date(now);
        start.setDate(start.getDate() - start.getDay() - 7); // Start of last week
        end = new Date(now);
        end.setDate(end.getDate() - end.getDay() - 1); // End of last week (Saturday)
        break;
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
        break;
      case 'last7Days':
        start = new Date(now);
        start.setDate(start.getDate() - 6);
        end = now;
        break;
      case 'last30Days':
        start = new Date(now);
        start.setDate(start.getDate() - 29);
        end = now;
        break;
      default:
        start = now;
        end = now;
    }

    setStartDate(formatDateForInput(start));
    setEndDate(formatDateForInput(end));
  };

  // Clear filters
  const clearFilters = () => {
    setStartDate(todayStr);
    setEndDate(todayStr);
    setCustomerId("all");
    setLocationId("all");
    setPaymentMethod("all");
    setCashierId("all");
    setGroupByCustomer(false);
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return `₱${value.toFixed(2)}`;
  };

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

  // Cell render for payment method with badge
  const renderPaymentMethod = (cellData: any) => {
    const method = cellData.value;
    let badgeClass = "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";

    switch (method) {
      case "cash":
        badgeClass = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
        break;
      case "card":
        badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
        break;
      case "cheque":
        badgeClass = "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
        break;
      case "bank_transfer":
        badgeClass = "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200";
        break;
      case "gcash":
      case "paymaya":
        badgeClass = "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
        break;
    }

    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeClass}`}
      >
        {getPaymentMethodName(method)}
      </span>
    );
  };

  // Cell render for amount - bold
  const renderAmount = (cellData: any) => {
    return <span className="font-semibold">{formatCurrency(cellData.value)}</span>;
  };

  // Export to Excel
  const handleExportExcel = useCallback(() => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet("Receivable Payments");

    exportDataGrid({
      component: dataGridRef.current?.instance,
      worksheet: worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === "data") {
          // Format currency cells
          if (gridCell.column.dataField === "amount") {
            excelCell.numFmt = "₱#,##0.00";
          }
          // Format date cells
          if (
            gridCell.column.dataField === "paymentDate" ||
            gridCell.column.dataField === "invoiceDate"
          ) {
            excelCell.numFmt = "mm/dd/yyyy";
          }
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: "application/octet-stream" }),
          `Receivable_Payments_${new Date().toLocaleDateString()}.xlsx`
        );
      });
    });

    toast.success("Exported to Excel");
  }, []);

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF("landscape");
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(16);
    doc.text("Receivable Payments Report", pageWidth / 2, 15, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 22, {
      align: "center",
    });

    if (startDate || endDate) {
      const dateRange = `Period: ${startDate || "Start"} to ${endDate || "Today"}`;
      doc.text(dateRange, pageWidth / 2, 28, { align: "center" });
    }

    // Summary
    if (summary) {
      doc.setFontSize(9);
      doc.text(`Total Collections: ${summary.totalPayments}`, 14, 35);
      doc.text(`Total Amount: ₱${summary.totalAmount.toFixed(2)}`, 14, 40);
    }

    // Table data
    const tableData = payments.map((p) => [
      new Date(p.paymentDate).toLocaleDateString(),
      p.invoiceNumber,
      new Date(p.invoiceDate).toLocaleDateString(),
      p.customerName,
      p.saleLocation,
      p.collectionLocation,
      getPaymentMethodName(p.paymentMethod),
      p.amount.toFixed(2),
      p.referenceNumber || "-",
      p.shiftNumber || "-",
      p.collectedBy,
    ]);

    (doc as any).autoTable({
      startY: 47,
      head: [
        [
          "Payment Date",
          "Invoice #",
          "Invoice Date",
          "Customer",
          "Sale Loc",
          "Collection Loc",
          "Method",
          "Amount",
          "Ref #",
          "Shift",
          "Cashier",
        ],
      ],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [34, 197, 94], fontSize: 7 },
      bodyStyles: { fontSize: 6 },
      footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontSize: 8 },
      foot: summary
        ? [
            [
              "",
              "",
              "",
              "",
              "",
              "",
              "Total:",
              summary.totalAmount.toFixed(2),
              "",
              "",
              "",
            ],
          ]
        : [],
    });

    doc.save(`Receivable_Payments_${new Date().toLocaleDateString()}.pdf`);
    toast.success("Exported to PDF");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Receivable Payments Report
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Track all AR payment collections with detailed payment information. Shows when and how
          customers paid their outstanding invoices.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        {/* Quick Date Filters */}
        <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quick Date Filters
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter('today')}
              className="text-xs"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter('yesterday')}
              className="text-xs"
            >
              Yesterday
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter('last7Days')}
              className="text-xs"
            >
              Last 7 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter('last30Days')}
              className="text-xs"
            >
              Last 30 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter('thisWeek')}
              className="text-xs"
            >
              This Week
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter('lastWeek')}
              className="text-xs"
            >
              Last Week
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter('thisMonth')}
              className="text-xs"
            >
              This Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateFilter('lastMonth')}
              className="text-xs"
            >
              Last Month
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

          {/* Customer Filter */}
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
                  {cust.name || `${cust.firstName || ''} ${cust.lastName || ''}`.trim()}
                </option>
              ))}
            </select>
          </div>

          {/* Location Filter */}
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

          {/* Payment Method Filter */}
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

          {/* Cashier Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Collected By
            </label>
            <select
              value={cashierId}
              onChange={(e) => setCashierId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Cashiers</option>
              {cashiers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.username || 'Unknown User'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Group By Customer Toggle */}
        <div className="mt-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={groupByCustomer}
              onChange={(e) => setGroupByCustomer(e.target.checked)}
              className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Group by Customer
            </span>
          </label>
        </div>

        {/* Filter Actions */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            variant="success"
            size="sm"
            onClick={fetchReport}
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
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <BanknotesIcon className="h-5 w-5" />
              Total Collections
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {summary.totalPayments}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <CurrencyDollarIcon className="h-5 w-5" />
              Total Amount
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {formatCurrency(summary.totalAmount)}
            </div>
          </div>

          {Object.entries(summary.byPaymentMethod)
            .slice(0, 2)
            .map(([method, data]) => (
              <div
                key={method}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {getPaymentMethodName(method)}
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(data.amount)}
                </div>
                <div className="text-xs text-gray-500 mt-1">{data.count} payments</div>
              </div>
            ))}
        </div>
      )}

      {/* DataGrid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <DataGrid
          ref={dataGridRef}
          dataSource={payments}
          keyExpr="id"
          showBorders={true}
          showRowLines={true}
          showColumnLines={true}
          rowAlternationEnabled={true}
          allowColumnReordering={true}
          allowColumnResizing={true}
          columnAutoWidth={true}
          wordWrapEnabled={false}
          onExporting={handleExportExcel}
        >
          <StateStoring enabled={true} type="localStorage" storageKey="receivable-payments-grid" />
          <Grouping autoExpandAll={false} />
          <GroupPanel visible={true} />
          <SearchPanel visible={true} width={240} placeholder="Search payments..." />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <ColumnChooser enabled={true} mode="select" />
          <Paging defaultPageSize={25} />
          <Sorting mode="multiple" />
          <Export enabled={true} allowExportSelectedData={true} />

          <Column
            dataField="paymentDate"
            caption="Payment Date"
            dataType="date"
            format="MM/dd/yyyy HH:mm"
            width={160}
            sortOrder="desc"
          />
          <Column dataField="invoiceNumber" caption="Invoice #" width={130} fixed={true} />
          <Column
            dataField="invoiceDate"
            caption="Invoice Date"
            dataType="date"
            format="MM/dd/yyyy"
            width={130}
          />
          <Column
            dataField="customerName"
            caption="Customer"
            width={180}
            groupIndex={groupByCustomer ? 0 : undefined}
          />
          <Column dataField="saleLocation" caption="Sale Location" width={150} />
          <Column dataField="collectionLocation" caption="Collection Location" width={150} />
          <Column
            dataField="paymentMethod"
            caption="Payment Method"
            width={140}
            cellRender={renderPaymentMethod}
          />
          <Column
            dataField="amount"
            caption="Amount"
            dataType="number"
            format="currency"
            width={130}
            cellRender={renderAmount}
          />
          <Column dataField="referenceNumber" caption="Reference #" width={140} />
          <Column dataField="shiftNumber" caption="Shift #" width={110} />
          <Column dataField="collectedBy" caption="Collected By" width={150} />

          <Summary>
            <TotalItem column="invoiceNumber" summaryType="count" displayFormat="Total: {0}" />
            <TotalItem column="amount" summaryType="sum" valueFormat="currency" />
            <GroupItem column="amount" summaryType="sum" valueFormat="currency" alignByColumn />
            <GroupItem column="invoiceNumber" summaryType="count" displayFormat="Count: {0}" />
          </Summary>
        </DataGrid>
      </div>

      {/* Payment Method Breakdown */}
      {summary && Object.keys(summary.byPaymentMethod).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Payment Method Breakdown
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(summary.byPaymentMethod).map(([method, data]) => (
              <div
                key={method}
                className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-md"
              >
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {getPaymentMethodName(method)}
                  </div>
                  <div className="text-xs text-gray-500">{data.count} payments</div>
                </div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {formatCurrency(data.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location Breakdown */}
      {summary && Object.keys(summary.byLocation).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MapPinIcon className="h-5 w-5" />
            Location Breakdown
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(summary.byLocation).map(([location, data]) => (
              <div
                key={location}
                className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-md"
              >
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {location}
                  </div>
                  <div className="text-xs text-gray-500">{data.count} payments</div>
                </div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {formatCurrency(data.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
