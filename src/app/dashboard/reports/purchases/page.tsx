'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import DataGrid, {
  Column,
  Export,
  FilterRow,
  Paging,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  GroupItem,
  Toolbar,
  Item,
  SearchPanel,
  HeaderFilter
} from 'devextreme-react/data-grid'
import {
  FileText,
  TrendingUp,
  Users,
  Package,
  DollarSign,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  CreditCard
} from 'lucide-react'

interface ReportCard {
  id: string
  title: string
  description: string
  icon: any
  route: string
}

const quickAccessReports: ReportCard[] = [
  {
    id: 'item-summary',
    title: 'Item Purchase Summary',
    description: 'Product-wise purchase analysis',
    icon: Package,
    route: '/dashboard/reports/purchases/item-summary',
  },
  {
    id: 'supplier-summary',
    title: 'Supplier Purchase Summary',
    description: 'Supplier rankings and volumes',
    icon: Users,
    route: '/dashboard/reports/purchases/supplier-summary',
  },
  {
    id: 'analytics',
    title: 'Purchase Analytics',
    description: 'Comprehensive purchase analysis',
    icon: BarChart3,
    route: '/dashboard/reports/purchases/analytics',
  },
  {
    id: 'trends',
    title: 'Purchase Trends',
    description: 'Purchase patterns over time',
    icon: TrendingUp,
    route: '/dashboard/reports/purchase-trends',
  },
  {
    id: 'items',
    title: 'Purchase Items Report',
    description: 'Detailed item-wise breakdown',
    icon: FileText,
    route: '/dashboard/reports/purchases-items',
  },
  {
    id: 'suppliers',
    title: 'Products-Suppliers Report',
    description: 'Product and supplier relationships',
    icon: Activity,
    route: '/dashboard/reports/products-suppliers',
  },
]

export default function UnifiedPurchaseReportsPage() {
  const router = useRouter()
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showQuickAccess, setShowQuickAccess] = useState(true)

  useEffect(() => {
    fetchPurchases()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchPurchases = async () => {
    try {
      const res = await fetch('/api/purchases')
      const data = await res.json()

      if (data.purchases) {
        const transformed = data.purchases.map((p: any) => ({
          id: p.id,
          purchaseNumber: p.purchaseNumber,
          purchaseDate: new Date(p.purchaseDate),
          supplierName: p.supplier?.name || 'N/A',
          locationName: p.location?.name || 'N/A',
          status: p.status,
          paymentStatus: p.paymentStatus || 'Pending',
          totalAmount: parseFloat(p.totalAmount) || 0,
          paidAmount: parseFloat(p.paidAmount) || 0,
          dueAmount: (parseFloat(p.totalAmount) || 0) - (parseFloat(p.paidAmount) || 0),
          itemsCount: p._count?.items || p.items?.length || 0,
          createdBy: p.createdBy?.username || 'System',
        }))
        setPurchases(transformed)
      }
      setLoading(false)
    } catch (error) {
      toast.error('Failed to load purchases')
      setLoading(false)
    }
  }

  const totalPurchases = purchases.reduce((sum: number, p: any) => sum + p.totalAmount, 0)
  const totalPaid = purchases.reduce((sum: number, p: any) => sum + p.paidAmount, 0)
  const totalDue = purchases.reduce((sum: number, p: any) => sum + p.dueAmount, 0)
  const suppliersCount = new Set(purchases.map((p: any) => p.supplierName)).size

  const handlePurchaseClick = (purchaseId: number) => {
    router.push(`/dashboard/purchases/${purchaseId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Purchase Reports</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive purchase analysis and transaction history
          </p>
        </div>
        <button
          onClick={() => setShowQuickAccess(!showQuickAccess)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showQuickAccess ? 'Hide' : 'Show'} Quick Access
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-90 font-medium">Total Purchases</div>
              <div className="text-3xl font-bold mt-2">₱{totalPurchases.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
              <div className="text-xs opacity-75 mt-1">{purchases.length} transactions</div>
            </div>
            <DollarSign className="h-12 w-12 opacity-20" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-90 font-medium">Total Paid</div>
              <div className="text-3xl font-bold mt-2">₱{totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
              <div className="text-xs opacity-75 mt-1">{((totalPaid / totalPurchases) * 100).toFixed(1)}% of total</div>
            </div>
            <CreditCard className="h-12 w-12 opacity-20" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-90 font-medium">Total Due</div>
              <div className="text-3xl font-bold mt-2">₱{totalDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
              <div className="text-xs opacity-75 mt-1">{((totalDue / totalPurchases) * 100).toFixed(1)}% unpaid</div>
            </div>
            <Calendar className="h-12 w-12 opacity-20" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-90 font-medium">Active Suppliers</div>
              <div className="text-3xl font-bold mt-2">{suppliersCount}</div>
              <div className="text-xs opacity-75 mt-1">Unique suppliers</div>
            </div>
            <Users className="h-12 w-12 opacity-20" />
          </div>
        </div>
      </div>

      {/* Quick Access Reports */}
      {showQuickAccess && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Access Reports</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickAccessReports.map((report) => (
              <button
                key={report.id}
                onClick={() => router.push(report.route)}
                className="flex items-start p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 border-2 border-transparent transition-all group"
              >
                <div className="flex-shrink-0 mr-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                    <report.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {report.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{report.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Purchase Transactions DataGrid */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">All Purchase Transactions</h2>

        <DataGrid
          dataSource={purchases}
          showBorders={true}
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          height={650}
          allowColumnReordering={true}
          allowColumnResizing={true}
          columnResizingMode="widget"
          showColumnLines={true}
          showRowLines={true}
          hoverStateEnabled={true}
          onRowClick={(e: any) => handlePurchaseClick(e.data.id)}
        >
          <Export enabled={true} formats={['xlsx', 'pdf']} allowExportSelectedData={true} />
          <FilterRow visible={true} applyFilter="auto" />
          <HeaderFilter visible={true} />
          <SearchPanel visible={true} width={240} placeholder="Search purchases..." />
          <Paging defaultPageSize={25} />
          <Grouping autoExpandAll={false} />
          <GroupPanel visible={true} emptyPanelText="Drag column headers here to group by that column" />

          <Toolbar>
            <Item name="groupPanel" />
            <Item name="exportButton" />
            <Item name="searchPanel" />
          </Toolbar>

          <Column
            dataField="purchaseNumber"
            caption="Purchase #"
            width={140}
            fixed={true}
          />
          <Column
            dataField="purchaseDate"
            caption="Date"
            dataType="date"
            format="MMM dd, yyyy"
            width={120}
            sortOrder="desc"
          />
          <Column dataField="supplierName" caption="Supplier" minWidth={150} />
          <Column dataField="locationName" caption="Location" width={140} />
          <Column dataField="status" caption="Status" width={110} alignment="center" />
          <Column dataField="paymentStatus" caption="Payment" width={110} alignment="center" />
          <Column dataField="itemsCount" caption="Items" width={80} alignment="center" />
          <Column dataField="totalAmount" caption="Total Amount" width={140} format="₱#,##0.00" alignment="right" />
          <Column dataField="paidAmount" caption="Paid" width={130} format="₱#,##0.00" alignment="right" />
          <Column dataField="dueAmount" caption="Due" width={130} format="₱#,##0.00" alignment="right" />
          <Column dataField="createdBy" caption="Created By" width={120} />

          <Summary>
            <TotalItem column="purchaseNumber" summaryType="count" displayFormat="Total: {0} purchases" />
            <TotalItem column="totalAmount" summaryType="sum" displayFormat="₱{0}" valueFormat="#,##0.00" />
            <TotalItem column="paidAmount" summaryType="sum" displayFormat="₱{0}" valueFormat="#,##0.00" />
            <TotalItem column="dueAmount" summaryType="sum" displayFormat="₱{0}" valueFormat="#,##0.00" />

            <GroupItem column="totalAmount" summaryType="sum" displayFormat="Subtotal: ₱{0}" valueFormat="#,##0.00" alignByColumn={true} />
            <GroupItem column="paidAmount" summaryType="sum" displayFormat="₱{0}" valueFormat="#,##0.00" alignByColumn={true} />
            <GroupItem column="dueAmount" summaryType="sum" displayFormat="₱{0}" valueFormat="#,##0.00" alignByColumn={true} />
          </Summary>
        </DataGrid>
      </div>
    </div>
  )
}
