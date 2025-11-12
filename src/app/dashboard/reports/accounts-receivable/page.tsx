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
  UserGroupIcon,
  ClockIcon,
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
  MasterDetail,
  SearchPanel,
  ColumnChooser,
  StateStoring,
  Grouping,
  GroupPanel,
} from "devextreme-react/data-grid";
import { Workbook } from "exceljs";
import { saveAs } from "file-saver-es";
import { exportDataGrid } from "devextreme/excel_exporter";
import jsPDF from "jspdf";
import "jspdf-autotable";
import toast from "react-hot-toast";

// Import DevExtreme theme dynamically
import "devextreme/dist/css/dx.light.css";

interface Customer {
  customerId: number;
  customerName: string;
  email: string | null;
  mobile: string | null;
  creditLimit: number | null;
  totalInvoices: number;
  totalAmount: number;
  totalPaid: number;
  outstandingBalance: number;
  oldestInvoiceDays: number;
  aging: {
    current: number;
    days31_60: number;
    days61_90: number;
    over90: number;
  };
  invoices: Array<{
    id: number;
    invoiceNumber: string;
    saleDate: Date;
    locationName: string;
    totalAmount: number;
    totalPaid: number;
    balance: number;
    daysOverdue: number;
  }>;
}

interface Summary {
  totalCustomers: number;
  totalOutstanding: number;
  totalInvoices: number;
  aging: {
    current: number;
    days31_60: number;
    days61_90: number;
    over90: number;
  };
}

export default function AccountsReceivablePage() {
  const { data: session } = useSession();
  const dataGridRef = useRef<DataGrid>(null);

  // Filter states
  const [customerId, setCustomerId] = useState<string>("all");
  const [locationId, setLocationId] = useState<string>("all");
  const [minBalance, setMinBalance] = useState<string>("");
  const [showZeroBalances, setShowZeroBalances] = useState(false);

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [customerList, setCustomerList] = useState<any[]>([]);
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

  // Fetch customers for filter dropdown
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await fetch("/api/customers");
        const data = await response.json();
        if (data.success) {
          setCustomerList(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch customers:", error);
      }
    };
    fetchCustomers();
  }, []);

  // Fetch AR report
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (customerId !== "all") params.append("customerId", customerId);
      if (locationId !== "all") params.append("locationId", locationId);
      if (minBalance) params.append("minBalance", minBalance);
      if (showZeroBalances) params.append("showZeroBalances", "true");

      const response = await fetch(`/api/reports/accounts-receivable?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setCustomers(data.data.customers);
        setSummary(data.data.summary);
        toast.success("Report loaded successfully");
      } else {
        toast.error(data.error || "Failed to load report");
      }
    } catch (error) {
      console.error("Failed to fetch AR report:", error);
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchReport();
  }, []);

  // Clear filters
  const clearFilters = () => {
    setCustomerId("all");
    setLocationId("all");
    setMinBalance("");
    setShowZeroBalances(false);
    fetchReport();
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return `₱${value.toFixed(2)}`;
  };

  // Cell render for credit limit
  const renderCreditLimit = (cellData: any) => {
    if (cellData.value === null) {
      return <span className="text-gray-500 italic">Unlimited</span>;
    }
    return formatCurrency(cellData.value);
  };

  // Cell render for aging buckets with color coding
  const renderAgingCell = (cellData: any, bucketType: string) => {
    const value = cellData.value;
    let colorClass = "text-gray-900 dark:text-white";

    if (value > 0) {
      switch (bucketType) {
        case "current":
          colorClass = "text-green-700 dark:text-green-400 font-semibold";
          break;
        case "days31_60":
          colorClass = "text-yellow-700 dark:text-yellow-400 font-semibold";
          break;
        case "days61_90":
          colorClass = "text-orange-700 dark:text-orange-400 font-semibold";
          break;
        case "over90":
          colorClass = "text-red-700 dark:text-red-400 font-semibold";
          break;
      }
    }

    return <span className={colorClass}>{formatCurrency(value)}</span>;
  };

  // Master detail template - shows invoices for each customer
  const MasterDetailTemplate = (props: any) => {
    const customer = props.data;

    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Invoice Details for {customer.customerName}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 dark:border-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Invoice #
                </th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Date
                </th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Location
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                  Total Amount
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                  Paid
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                  Balance
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                  Days Overdue
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {customer.invoices.map((invoice: any) => (
                <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    {new Date(invoice.saleDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    {invoice.locationName}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-white">
                    {formatCurrency(invoice.totalAmount)}
                  </td>
                  <td className="px-4 py-2 text-right text-green-700 dark:text-green-400">
                    {formatCurrency(invoice.totalPaid)}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-red-700 dark:text-red-400">
                    {formatCurrency(invoice.balance)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                    {invoice.daysOverdue} days
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-600">
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300"
                >
                  Total:
                </td>
                <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-white">
                  {formatCurrency(customer.totalAmount)}
                </td>
                <td className="px-4 py-2 text-right font-bold text-green-700 dark:text-green-400">
                  {formatCurrency(customer.totalPaid)}
                </td>
                <td className="px-4 py-2 text-right font-bold text-red-700 dark:text-red-400">
                  {formatCurrency(customer.outstandingBalance)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // Export to Excel
  const handleExportExcel = useCallback(() => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet("Accounts Receivable");

    exportDataGrid({
      component: dataGridRef.current?.instance,
      worksheet: worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell.rowType === "data") {
          // Format currency cells
          if (
            gridCell.column.dataField === "totalAmount" ||
            gridCell.column.dataField === "totalPaid" ||
            gridCell.column.dataField === "outstandingBalance" ||
            gridCell.column.dataField === "creditLimit" ||
            gridCell.column.dataField?.startsWith("aging.")
          ) {
            excelCell.numFmt = "₱#,##0.00";
          }
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: "application/octet-stream" }),
          `Accounts_Receivable_${new Date().toLocaleDateString()}.xlsx`
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
    doc.text("Accounts Receivable Report", pageWidth / 2, 15, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 22, {
      align: "center",
    });

    // Summary
    if (summary) {
      doc.setFontSize(9);
      doc.text(`Total Outstanding: ₱${summary.totalOutstanding.toFixed(2)}`, 14, 30);
      doc.text(`Total Customers: ${summary.totalCustomers}`, 14, 35);
    }

    // Table data
    const tableData = customers.map((c) => [
      c.customerName,
      c.email || "-",
      c.mobile || "-",
      c.creditLimit ? c.creditLimit.toFixed(2) : "Unlimited",
      c.totalInvoices.toString(),
      c.totalAmount.toFixed(2),
      c.totalPaid.toFixed(2),
      c.outstandingBalance.toFixed(2),
      c.oldestInvoiceDays.toString(),
      c.aging.current.toFixed(2),
      c.aging.days31_60.toFixed(2),
      c.aging.days61_90.toFixed(2),
      c.aging.over90.toFixed(2),
    ]);

    (doc as any).autoTable({
      startY: 42,
      head: [
        [
          "Customer",
          "Email",
          "Mobile",
          "Credit Limit",
          "Invoices",
          "Total",
          "Paid",
          "Balance",
          "Oldest",
          "0-30",
          "31-60",
          "61-90",
          "90+",
        ],
      ],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [34, 197, 94], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontSize: 8 },
      foot: summary
        ? [
            [
              "Total:",
              "",
              "",
              "",
              summary.totalInvoices.toString(),
              "",
              "",
              summary.totalOutstanding.toFixed(2),
              "",
              summary.aging.current.toFixed(2),
              summary.aging.days31_60.toFixed(2),
              summary.aging.days61_90.toFixed(2),
              summary.aging.over90.toFixed(2),
            ],
          ]
        : [],
    });

    doc.save(`Accounts_Receivable_${new Date().toLocaleDateString()}.pdf`);
    toast.success("Exported to PDF");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Accounts Receivable Report
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Customer outstanding balances with aging analysis. Shows who owes money and for how
          long.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              {customerList.map((cust) => (
                <option key={cust.id} value={cust.id}>
                  {cust.firstName} {cust.lastName}
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

          {/* Minimum Balance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Minimum Balance
            </label>
            <input
              type="number"
              value={minBalance}
              onChange={(e) => setMinBalance(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Show Zero Balances */}
          <div className="flex items-end">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showZeroBalances}
                onChange={(e) => setShowZeroBalances(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Show Zero Balances
              </span>
            </label>
          </div>
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
              <UserGroupIcon className="h-5 w-5" />
              Total Customers
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {summary.totalCustomers}
            </div>
            <div className="text-xs text-gray-500 mt-1">{summary.totalInvoices} invoices</div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <CurrencyDollarIcon className="h-5 w-5" />
              Total Outstanding
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
              {formatCurrency(summary.totalOutstanding)}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <ClockIcon className="h-5 w-5" />
              Current (0-30 days)
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {formatCurrency(summary.aging.current)}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Over 90 Days
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
              {formatCurrency(summary.aging.over90)}
            </div>
          </div>
        </div>
      )}

      {/* DataGrid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <DataGrid
          ref={dataGridRef}
          dataSource={customers}
          keyExpr="customerId"
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
          <StateStoring enabled={true} type="localStorage" storageKey="ar-report-grid" />
          <Grouping autoExpandAll={false} />
          <GroupPanel visible={true} />
          <SearchPanel visible={true} width={240} placeholder="Search customers..." />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <ColumnChooser enabled={true} mode="select" />
          <Paging defaultPageSize={20} />
          <Sorting mode="multiple" />
          <Export enabled={true} allowExportSelectedData={true} />

          <Column
            dataField="customerName"
            caption="Customer Name"
            width={200}
            fixed={true}
            sortOrder="asc"
          />
          <Column dataField="email" caption="Email" width={180} />
          <Column dataField="mobile" caption="Mobile" width={120} />
          <Column
            dataField="creditLimit"
            caption="Credit Limit"
            dataType="number"
            format="currency"
            width={130}
            cellRender={renderCreditLimit}
          />
          <Column
            dataField="totalInvoices"
            caption="Total Invoices"
            dataType="number"
            width={120}
            alignment="center"
          />
          <Column
            dataField="totalAmount"
            caption="Total Amount"
            dataType="number"
            format="currency"
            width={140}
          />
          <Column
            dataField="totalPaid"
            caption="Total Paid"
            dataType="number"
            format="currency"
            width={140}
          />
          <Column
            dataField="outstandingBalance"
            caption="Outstanding Balance"
            dataType="number"
            format="currency"
            width={160}
            cssClass="font-bold"
          />
          <Column
            dataField="oldestInvoiceDays"
            caption="Oldest Invoice (Days)"
            dataType="number"
            width={150}
            alignment="center"
          />
          <Column
            dataField="aging.current"
            caption="0-30 Days"
            dataType="number"
            format="currency"
            width={120}
            cellRender={(cellData) => renderAgingCell(cellData, "current")}
          />
          <Column
            dataField="aging.days31_60"
            caption="31-60 Days"
            dataType="number"
            format="currency"
            width={120}
            cellRender={(cellData) => renderAgingCell(cellData, "days31_60")}
          />
          <Column
            dataField="aging.days61_90"
            caption="61-90 Days"
            dataType="number"
            format="currency"
            width={120}
            cellRender={(cellData) => renderAgingCell(cellData, "days61_90")}
          />
          <Column
            dataField="aging.over90"
            caption="Over 90 Days"
            dataType="number"
            format="currency"
            width={120}
            cellRender={(cellData) => renderAgingCell(cellData, "over90")}
          />

          <Summary>
            <TotalItem column="customerName" summaryType="count" displayFormat="Total: {0}" />
            <TotalItem column="totalInvoices" summaryType="sum" valueFormat="decimal" />
            <TotalItem column="totalAmount" summaryType="sum" valueFormat="currency" />
            <TotalItem column="totalPaid" summaryType="sum" valueFormat="currency" />
            <TotalItem column="outstandingBalance" summaryType="sum" valueFormat="currency" />
            <TotalItem column="aging.current" summaryType="sum" valueFormat="currency" />
            <TotalItem column="aging.days31_60" summaryType="sum" valueFormat="currency" />
            <TotalItem column="aging.days61_90" summaryType="sum" valueFormat="currency" />
            <TotalItem column="aging.over90" summaryType="sum" valueFormat="currency" />
          </Summary>

          <MasterDetail enabled={true} component={MasterDetailTemplate} />
        </DataGrid>
      </div>

      {/* Aging Analysis Summary */}
      {summary && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Aging Analysis Breakdown
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
              <div className="text-sm font-medium text-green-800 dark:text-green-300">
                0-30 Days (Current)
              </div>
              <div className="text-xl font-bold text-green-900 dark:text-green-200 mt-1">
                {formatCurrency(summary.aging.current)}
              </div>
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800">
              <div className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                31-60 Days
              </div>
              <div className="text-xl font-bold text-yellow-900 dark:text-yellow-200 mt-1">
                {formatCurrency(summary.aging.days31_60)}
              </div>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-md border border-orange-200 dark:border-orange-800">
              <div className="text-sm font-medium text-orange-800 dark:text-orange-300">
                61-90 Days
              </div>
              <div className="text-xl font-bold text-orange-900 dark:text-orange-200 mt-1">
                {formatCurrency(summary.aging.days61_90)}
              </div>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950 rounded-md border border-red-200 dark:border-red-800">
              <div className="text-sm font-medium text-red-800 dark:text-red-300">
                Over 90 Days
              </div>
              <div className="text-xl font-bold text-red-900 dark:text-red-200 mt-1">
                {formatCurrency(summary.aging.over90)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
