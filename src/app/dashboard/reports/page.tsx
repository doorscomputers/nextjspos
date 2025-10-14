'use client'

import Link from 'next/link'

export default function ReportsPage() {
  const salesReports = [
    {
      title: 'Sales Journal',
      description: 'Complete transaction log with all sales details, items, and customer information',
      icon: '📋',
      href: '/dashboard/reports/sales-journal',
      color: 'from-blue-500 to-blue-600',
      features: ['Date filtering', 'Location & cashier filter', 'Search by invoice', 'Export CSV', 'Sortable columns']
    },
    {
      title: 'Sales Per Item',
      description: 'Product performance analysis showing sales, profit, and margins by product',
      icon: '📦',
      href: '/dashboard/reports/sales-per-item',
      color: 'from-green-500 to-green-600',
      features: ['Product profitability', 'Category breakdown', 'Location analysis', 'Best sellers', 'Margin tracking']
    },
    {
      title: 'Sales Per Cashier',
      description: 'Cashier performance metrics including sales, transactions, and daily trends',
      icon: '👤',
      href: '/dashboard/reports/sales-per-cashier',
      color: 'from-purple-500 to-purple-600',
      features: ['Cashier performance', 'Transaction count', 'Daily breakdown', 'Payment methods', 'Location comparison']
    },
    {
      title: 'Sales Per Location',
      description: 'Location performance comparison with sales, trends, and hourly analysis',
      icon: '📍',
      href: '/dashboard/reports/sales-per-location',
      color: 'from-orange-500 to-orange-600',
      features: ['Location rankings', 'Hourly patterns', 'Cashier breakdown', 'Payment analysis', 'Daily trends']
    },
    {
      title: 'Sales Analytics',
      description: 'Comprehensive sales dashboard with trends, KPIs, and period comparisons',
      icon: '📊',
      href: '/dashboard/reports/sales-analytics',
      color: 'from-teal-500 to-teal-600',
      features: ['Sales trends', 'Period comparison', 'Top products', 'Category breakdown', 'Hourly patterns']
    },
    {
      title: 'Customer Sales Analysis',
      description: 'Customer buying patterns, top customers, and lifetime value analysis',
      icon: '👥',
      href: '/dashboard/reports/customer-sales',
      color: 'from-pink-500 to-pink-600',
      features: ['Top customers', 'Purchase frequency', 'Customer lifetime value', 'Segmentation', 'Purchase history']
    },
    {
      title: 'Payment Method Analysis',
      description: 'Payment method breakdown, trends, and preferences by location and cashier',
      icon: '💳',
      href: '/dashboard/reports/payment-method',
      color: 'from-indigo-500 to-indigo-600',
      features: ['Method comparison', 'Daily trends', 'Location breakdown', 'Cashier analysis', 'Transaction patterns']
    },
    {
      title: 'Discount Analysis',
      description: 'Discount impact analysis showing types, amounts, and trends over time',
      icon: '🏷️',
      href: '/dashboard/reports/discount-analysis',
      color: 'from-red-500 to-red-600',
      features: ['Discount types', 'Impact analysis', 'Location breakdown', 'Cashier trends', 'Customer patterns']
    },
  ]

  const existingReports = [
    {
      title: 'Purchase Reports',
      description: 'Comprehensive purchase order analysis and supplier performance',
      icon: '🛒',
      href: '/dashboard/reports/purchases-report',
      color: 'from-cyan-500 to-cyan-600'
    },
    {
      title: 'Transfer Reports',
      description: 'Inventory transfer analysis between locations with trends',
      icon: '🔄',
      href: '/dashboard/reports/transfers-report',
      color: 'from-amber-500 to-amber-600'
    },
  ]

  return (
    <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
      <div>
        <h1 className="text-4xl font-bold text-gray-900">Sales Reports</h1>
        <p className="text-gray-600 mt-2 text-lg">
          Comprehensive sales analytics and reporting tools to help you understand your business performance
        </p>
      </div>

      {/* Quick Stats */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-8 text-white">
        <h2 className="text-2xl font-bold mb-4">8 Sales Reports Available</h2>
        <p className="text-blue-100 mb-6">
          Access detailed sales data with advanced filtering, sorting, and export capabilities. All reports support date ranges, location filtering, and CSV export.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-3xl font-bold">📋</div>
            <div className="text-sm mt-2">Transaction Level</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-3xl font-bold">📊</div>
            <div className="text-sm mt-2">Analytics & Trends</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-3xl font-bold">💰</div>
            <div className="text-sm mt-2">Profitability</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-3xl font-bold">🎯</div>
            <div className="text-sm mt-2">Performance</div>
          </div>
        </div>
      </div>

      {/* Sales Reports Grid */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Sales Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {salesReports.map((report, idx) => (
            <Link
              key={idx}
              href={report.href}
              className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-200 hover:-translate-y-1 overflow-hidden group"
            >
              <div className={`bg-gradient-to-r ${report.color} p-6 text-white`}>
                <div className="text-5xl mb-3">{report.icon}</div>
                <h3 className="text-xl font-bold">{report.title}</h3>
              </div>
              <div className="p-6">
                <p className="text-gray-600 mb-4 text-sm leading-relaxed">{report.description}</p>
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Key Features:</div>
                  <div className="flex flex-wrap gap-2">
                    {report.features.map((feature, fIdx) => (
                      <span
                        key={fIdx}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-700">
                  View Report
                  <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Other Reports */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Other Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {existingReports.map((report, idx) => (
            <Link
              key={idx}
              href={report.href}
              className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-200 hover:-translate-y-1 overflow-hidden group"
            >
              <div className={`bg-gradient-to-r ${report.color} p-6 text-white flex items-center justify-between`}>
                <div>
                  <div className="text-3xl mb-2">{report.icon}</div>
                  <h3 className="text-xl font-bold">{report.title}</h3>
                </div>
              </div>
              <div className="p-6">
                <p className="text-gray-600 text-sm">{report.description}</p>
                <div className="mt-4 flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-700">
                  View Report
                  <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-2">📘 Report Features</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start">
            <span className="mr-2">✓</span>
            <span><strong>Date Filtering:</strong> All reports support custom date ranges for flexible analysis</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">✓</span>
            <span><strong>Location & User Filtering:</strong> Filter by specific locations or users/cashiers</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">✓</span>
            <span><strong>Sortable Columns:</strong> Click column headers to sort data ascending or descending</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">✓</span>
            <span><strong>CSV Export:</strong> Export any report to CSV for further analysis in Excel</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">✓</span>
            <span><strong>Real-time Data:</strong> All reports use live data from your database</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
