'use client'

import { useRouter } from 'next/navigation'
import {
  FileText,
  TrendingUp,
  Users,
  CreditCard,
  Package,
  Calendar,
  DollarSign,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react'

interface ReportCard {
  id: string
  title: string
  description: string
  icon: any
  category: string
  route: string
  status: 'available' | 'coming-soon'
  phase: number
}

const reports: ReportCard[] = [
  // Phase 1 - Core Reports (Available Now)
  {
    id: 'item-summary',
    title: 'Item Purchase Summary',
    description: 'Product-wise purchase analysis with quantity, cost variance, and trends',
    icon: Package,
    category: 'Item-Wise Reports',
    route: '/dashboard/reports/purchases/item-summary',
    status: 'available',
    phase: 1
  },
  {
    id: 'supplier-summary',
    title: 'Supplier Purchase Summary',
    description: 'Supplier rankings, purchase volumes, and outstanding payables',
    icon: Users,
    category: 'Supplier-Wise Reports',
    route: '/dashboard/reports/purchases/supplier-summary',
    status: 'available',
    phase: 1
  },
  {
    id: 'trend-analysis',
    title: 'Purchase Trend Analysis',
    description: 'Time-based purchasing patterns with monthly, quarterly, and yearly trends',
    icon: TrendingUp,
    category: 'Time-Based Analysis',
    route: '/dashboard/reports/purchases/trend-analysis',
    status: 'available',
    phase: 1
  },
  {
    id: 'payment-status',
    title: 'Payment Status Report',
    description: 'Purchase payment tracking with aging analysis and payment method breakdown',
    icon: CreditCard,
    category: 'Payment & Financial',
    route: '/dashboard/reports/purchases/payment-status',
    status: 'available',
    phase: 1
  },

  // Phase 2 - Detailed Reports
  {
    id: 'item-detail',
    title: 'Item Purchase Detail',
    description: 'Detailed transaction history for every purchase line item',
    icon: FileText,
    category: 'Item-Wise Reports',
    route: '/dashboard/reports/purchases/item-detail',
    status: 'available',
    phase: 2
  },
  {
    id: 'supplier-performance',
    title: 'Supplier Performance',
    description: 'On-time delivery, quality metrics, and reliability scores',
    icon: Activity,
    category: 'Supplier-Wise Reports',
    route: '/dashboard/reports/purchases/supplier-performance',
    status: 'available',
    phase: 2
  },
  {
    id: 'category-summary',
    title: 'Category Summary',
    description: 'Purchase analysis grouped by product categories',
    icon: PieChart,
    category: 'Category-Wise Reports',
    route: '/dashboard/reports/purchases/category-summary',
    status: 'available',
    phase: 2
  },
  {
    id: 'daily-summary',
    title: 'Daily Summary',
    description: 'Day-to-day purchase operations overview',
    icon: Calendar,
    category: 'Operational Reports',
    route: '/dashboard/reports/purchases/daily-summary',
    status: 'available',
    phase: 2
  },

  // Phase 3 - Advanced Reports
  {
    id: 'cost-trend',
    title: 'Item Cost Trend',
    description: 'Visual charts showing price changes over time',
    icon: BarChart3,
    category: 'Item-Wise Reports',
    route: '/dashboard/reports/purchases/cost-trend',
    status: 'available',
    phase: 3
  },
  {
    id: 'budget-vs-actual',
    title: 'Budget vs Actual',
    description: 'Compare planned spending against actual purchases',
    icon: DollarSign,
    category: 'Time-Based Analysis',
    route: '/dashboard/reports/purchases/budget-vs-actual',
    status: 'available',
    phase: 3
  },
]

export default function PurchaseReportsPage() {
  const router = useRouter()

  const categories = Array.from(new Set(reports.map(r => r.category)))
  const availableReports = reports.filter(r => r.status === 'available')
  const comingSoonReports = reports.filter(r => r.status === 'coming-soon')

  const handleReportClick = (report: ReportCard) => {
    if (report.status === 'available') {
      router.push(report.route)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Purchase Reports
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Comprehensive purchase analysis and financial decision support
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Available Reports
              </p>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-2">
                {availableReports.length}
              </p>
            </div>
            <FileText className="h-12 w-12 text-blue-500 dark:text-blue-400 opacity-50" />
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Categories
              </p>
              <p className="text-3xl font-bold text-green-700 dark:text-green-300 mt-2">
                {categories.length}
              </p>
            </div>
            <PieChart className="h-12 w-12 text-green-500 dark:text-green-400 opacity-50" />
          </div>
        </div>
      </div>

      {/* Available Reports */}
      <div className="mb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {availableReports.map((report) => {
            const Icon = report.icon
            return (
              <button
                key={report.id}
                onClick={() => handleReportClick(report)}
                className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition-all duration-200 text-left group"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-colors">
                      <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400 group-hover:text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {report.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {report.category}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                      {report.description}
                    </p>
                    <div className="mt-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                        Ready to use
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
              Report Features
            </h3>
            <ul className="mt-2 space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex items-center space-x-2">
                <span className="text-blue-500 dark:text-blue-400">✓</span>
                <span>Flexible date range filters (Year, Quarter, Month, Custom)</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-blue-500 dark:text-blue-400">✓</span>
                <span>Multi-location and supplier filtering</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-blue-500 dark:text-blue-400">✓</span>
                <span>Export to PDF, Excel, and CSV (coming soon)</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-blue-500 dark:text-blue-400">✓</span>
                <span>Visual charts and trend indicators</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-blue-500 dark:text-blue-400">✓</span>
                <span>Print-friendly layouts</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
