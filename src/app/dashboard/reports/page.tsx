'use client'

import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

type ReportCard = {
  title: string
  description: string
  href: string
  color: string
  icon?: string
  permission?: string
  features?: string[]
}

type ReportSection = {
  key: string
  title: string
  description: string
  permission?: string
  cards: ReportCard[]
}

const reportSections: ReportSection[] = [
  {
    key: 'sales',
    title: 'Sales Reports',
    description:
      'Comprehensive sales analytics, transaction ledgers, and advanced performance dashboards.',
    cards: [
      {
        title: 'Sales Today',
        description: 'Live summary of today’s sales, cashiers, and payment methods.',
        href: '/dashboard/reports/sales-today',
        color: 'from-sky-500 to-sky-600',
        icon: '📆',
        permission: PERMISSIONS.REPORT_SALES_TODAY,
        features: ['Real-time totals', 'Cashier performance', 'Payment breakdown'],
      },
      {
        title: 'Sales History',
        description: 'Historical ledger with advanced filters and export options.',
        href: '/dashboard/reports/sales-history',
        color: 'from-blue-500 to-blue-600',
        icon: '🗂️',
        permission: PERMISSIONS.REPORT_SALES_HISTORY,
        features: ['Invoice search', 'Date presets', 'CSV export'],
      },
      {
        title: 'Sales Journal',
        description: 'Detailed transaction log with item-level visibility.',
        href: '/dashboard/reports/sales-journal',
        color: 'from-indigo-500 to-indigo-600',
        icon: '🧾',
        permission: PERMISSIONS.SALES_REPORT_JOURNAL,
        features: ['Customer details', 'Multi-location filter', 'Sortable columns'],
      },
      {
        title: 'Sales Per Item',
        description: 'Product performance analysis with profit and margin tracking.',
        href: '/dashboard/reports/sales-per-item',
        color: 'from-green-500 to-green-600',
        icon: '📦',
        permission: PERMISSIONS.SALES_REPORT_PER_ITEM,
        features: ['Profitability', 'Category breakdown', 'Location comparison'],
      },
      {
        title: 'Sales Per Cashier',
        description: 'Cashier productivity, transactions, and trend monitoring.',
        href: '/dashboard/reports/sales-per-cashier',
        color: 'from-purple-500 to-purple-600',
        icon: '🧑‍💼',
        permission: PERMISSIONS.SALES_REPORT_PER_CASHIER,
        features: ['Transaction volume', 'Average ticket', 'Payment methods'],
      },
      {
        title: 'Sales Per Location',
        description: 'Compare performance between locations with hourly trends.',
        href: '/dashboard/reports/sales-per-location',
        color: 'from-orange-500 to-orange-600',
        icon: '📍',
        permission: PERMISSIONS.SALES_REPORT_PER_LOCATION,
        features: ['Location ranking', 'Hourly heat map', 'Cashier mix'],
      },
      {
        title: 'Sales Analytics',
        description: 'Interactive dashboards with KPIs, trends, and forecasts.',
        href: '/dashboard/reports/sales-analytics',
        color: 'from-teal-500 to-teal-600',
        icon: '📊',
        permission: PERMISSIONS.SALES_REPORT_ANALYTICS,
        features: ['Trend analysis', 'Period comparison', 'Top products'],
      },
      {
        title: 'Customer Sales Analysis',
        description: 'Identify top customers and buying behaviour.',
        href: '/dashboard/reports/customer-sales',
        color: 'from-pink-500 to-pink-600',
        icon: '🧑‍🤝‍🧑',
        permission: PERMISSIONS.SALES_REPORT_CUSTOMER_ANALYSIS,
        features: ['Customer segmentation', 'Lifetime value', 'Frequency insights'],
      },
      {
        title: 'Payment Method Analysis',
        description: 'Track payment preferences and settlement trends.',
        href: '/dashboard/reports/payment-method',
        color: 'from-violet-500 to-violet-600',
        icon: '💳',
        permission: PERMISSIONS.SALES_REPORT_PAYMENT_METHOD,
      },
      {
        title: 'Discount Analysis',
        description: 'Monitor discount usage by type, cashier, and location.',
        href: '/dashboard/reports/discount-analysis',
        color: 'from-red-500 to-red-600',
        icon: '🏷️',
        permission: PERMISSIONS.SALES_REPORT_DISCOUNT_ANALYSIS,
      },
      {
        title: 'Unpaid Invoices',
        description: 'Track outstanding customer credit and aging analysis.',
        href: '/dashboard/reports/unpaid-invoices',
        color: 'from-amber-500 to-amber-600',
        icon: '💰',
        permission: PERMISSIONS.REPORT_UNPAID_INVOICES,
        features: ['Aging breakdown', 'Top debtors', 'Overdue tracking'],
      },
      {
        title: 'Customer Payments',
        description: 'Payment history and collection tracking for credit customers.',
        href: '/dashboard/reports/customer-payments',
        color: 'from-lime-500 to-lime-600',
        icon: '💵',
        permission: PERMISSIONS.REPORT_CUSTOMER_PAYMENTS,
        features: ['Payment tracking', 'Collection summary', 'Method breakdown'],
      },
      {
        title: 'Cash In/Out Report',
        description: 'Track all cash movements, deposits, and withdrawals by location.',
        href: '/dashboard/reports/cash-in-out',
        color: 'from-emerald-500 to-emerald-600',
        icon: '💸',
        permission: PERMISSIONS.REPORT_CASH_IN_OUT,
        features: ['Cash tracking', 'Location breakdown', 'Cashier analysis'],
      },
      {
        title: 'Hourly Sales Breakdown',
        description: 'Peak hours analysis and sales patterns by time of day.',
        href: '/dashboard/reports/sales-by-hour',
        color: 'from-purple-500 to-purple-600',
        icon: '⏰',
        permission: PERMISSIONS.REPORT_SALES_BY_HOUR,
        features: ['Peak hours', 'Busy/slow periods', 'Day of week analysis'],
      },
      {
        title: 'Void & Refund Analysis',
        description: 'Track voided and refunded transactions with accountability.',
        href: '/dashboard/reports/void-refund-analysis',
        color: 'from-orange-500 to-orange-600',
        icon: '⚠️',
        permission: PERMISSIONS.REPORT_VOID_REFUND_ANALYSIS,
        features: ['Void tracking', 'Cashier accountability', 'Reason analysis'],
      },
    ],
  },
  {
    key: 'purchase',
    title: 'Purchase Reports',
    description:
      'Measure procurement volume, supplier performance, and cost trends across the business.',
    cards: [
      {
        title: 'Purchases Report',
        description: 'Comprehensive purchase order tracking with cost visibility.',
        href: '/dashboard/reports/purchases-report',
        color: 'from-emerald-500 to-emerald-600',
        icon: '🛒',
        permission: PERMISSIONS.REPORT_PURCHASE_VIEW,
      },
      {
        title: 'Purchase Analytics',
        description: 'Advanced analytics on purchasing patterns and supplier share.',
        href: '/dashboard/reports/purchases/analytics',
        color: 'from-cyan-500 to-cyan-600',
        icon: '📈',
        permission: PERMISSIONS.REPORT_PURCHASE_ANALYTICS,
      },
      {
        title: 'Purchase Trends',
        description: 'Trend analysis for purchasing volume, quantity, and spend.',
        href: '/dashboard/reports/purchase-trends',
        color: 'from-sky-500 to-sky-600',
        icon: '📉',
        permission: PERMISSIONS.REPORT_PURCHASE_TRENDS,
      },
      // Temporarily disabled - has syntax errors
      // {
      //   title: 'Purchase Items',
      //   description: 'Item-level purchase insight with quantity and cost metrics.',
      //   href: '/dashboard/reports/purchases-items',
      //   color: 'from-blue-500 to-blue-600',
      //   icon: '📦',
      //   permission: PERMISSIONS.REPORT_PURCHASE_ITEMS,
      // },
      {
        title: 'Product Purchase History',
        description: 'Supplier-by-product purchase history and receiving trail.',
        href: '/dashboard/reports/product-purchase-history',
        color: 'from-indigo-500 to-indigo-600',
        icon: '🔁',
        permission: PERMISSIONS.REPORT_PRODUCT_PURCHASE_HISTORY,
      },
      {
        title: 'Purchase Returns',
        description: 'Track supplier returns for damaged, defective, and warranty items.',
        href: '/dashboard/reports/purchase-returns',
        color: 'from-red-500 to-red-600',
        icon: '↩️',
        permission: PERMISSIONS.PURCHASE_RETURN_VIEW,
        features: ['Advanced filtering', 'Date presets', 'Export options'],
      },
    ],
  },
  {
    key: 'transfer',
    title: 'Transfer Reports',
    description:
      'Track stock movements between locations, highlighting transit times and discrepancies.',
    cards: [
      {
        title: 'Transfers Report',
        description: 'Detailed log of transfers with source, destination, and status.',
        href: '/dashboard/reports/transfers-report',
        color: 'from-amber-500 to-amber-600',
        icon: '🚚',
        permission: PERMISSIONS.REPORT_TRANSFER_VIEW,
      },
      {
        title: 'Transfer Trends',
        description: 'Trend analysis for transfer counts, value, and destinations.',
        href: '/dashboard/reports/transfer-trends',
        color: 'from-orange-500 to-orange-600',
        icon: '📦',
        permission: PERMISSIONS.REPORT_TRANSFER_TRENDS,
      },
    ],
  },
  {
    key: 'inventory',
    title: 'Inventory Reports',
    description:
      'Visibility into stock levels, inventory valuation, and transactional inventory movement.',
    cards: [
      {
        title: 'Stock Alert Report',
        description: 'Critical stock alerts across locations and products.',
        href: '/dashboard/reports/stock-alert',
        color: 'from-rose-500 to-rose-600',
        icon: '⚠️',
        permission: PERMISSIONS.REPORT_STOCK_ALERT,
      },
      {
        title: 'Historical Inventory',
        description: 'Snapshot inventory history with adjustments and corrections.',
        href: '/dashboard/reports/historical-inventory',
        color: 'from-purple-500 to-purple-600',
        icon: '🗃️',
        permission: PERMISSIONS.VIEW_INVENTORY_REPORTS,
      },
      {
        title: 'Stock History V2',
        description: 'Accurate product-level stock movement history with transaction details.',
        href: '/dashboard/reports/stock-history-v2',
        color: 'from-neutral-500 to-neutral-600',
        icon: '📒',
        permission: PERMISSIONS.PRODUCT_VIEW,
        features: ['Transaction tracking', 'Location filtering', 'Date range analysis'],
      },
      {
        title: 'Stock History V3 (Admin)',
        description: 'Advanced stock history with access to all active locations for admins.',
        href: '/dashboard/reports/stock-history-v3',
        color: 'from-purple-500 to-purple-600',
        icon: '📚',
        permission: PERMISSIONS.STOCK_HISTORY_V3_VIEW,
        features: ['All locations access', 'Admin-only access', 'Full transaction history', 'Advanced analytics'],
      },
    ],
  },
  {
    key: 'financial',
    title: 'Financial & Profitability Reports',
    description:
      'Evaluate profitability, margins, and consolidated financial performance.',
    cards: [
      {
        title: 'Profitability & COGS',
        description: 'Gross profit, COGS, and contribution analysis.',
        href: '/dashboard/reports/profitability',
        color: 'from-green-600 to-green-700',
        icon: '💹',
        permission: PERMISSIONS.REPORT_PROFITABILITY,
      },
      {
        title: 'Net Profit Report',
        description: 'Net profit view with expense and revenue breakdown.',
        href: '/dashboard/reports/profit',
        color: 'from-lime-500 to-lime-600',
        icon: '🧮',
        permission: PERMISSIONS.REPORT_PROFIT_LOSS,
      },
    ],
  },
  {
    key: 'security',
    title: 'Security & Compliance Reports',
    description:
      'Audit and compliance tooling for monitoring user activity and sensitive operations.',
    cards: [
      {
        title: 'Audit Trail',
        description: 'Detailed audit log of user actions, approvals, and security events.',
        href: '/dashboard/reports/audit-trail',
        color: 'from-slate-500 to-slate-600',
        icon: '🛡️',
        permission: PERMISSIONS.AUDIT_LOG_VIEW,
      },
    ],
  },
]

export default function ReportsPage() {
  const { can } = usePermissions()
  const [freshPermissions, setFreshPermissions] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch fresh permissions from server to bypass JWT cache
  useEffect(() => {
    const fetchFreshPermissions = async () => {
      try {
        const response = await fetch('/api/users/me/permissions')
        const data = await response.json()
        if (data.success) {
          setFreshPermissions(data.permissions)
        }
      } catch (error) {
        console.error('Error fetching fresh permissions:', error)
        // Fall back to session permissions if fetch fails
        setFreshPermissions(null)
      } finally {
        setLoading(false)
      }
    }

    fetchFreshPermissions()
  }, [])

  // Use fresh permissions if available, otherwise fall back to session permissions
  const canView = (permission: string) => {
    if (freshPermissions !== null) {
      return freshPermissions.includes(permission)
    }
    return can(permission)
  }

  const accessibleSections = useMemo(() => {
    if (loading) return []

    return reportSections
      .map((section) => {
        if (section.permission && !canView(section.permission)) {
          return { ...section, cards: [] }
        }
        const cards = section.cards.filter((card) => !card.permission || canView(card.permission))
        return { ...section, cards }
      })
      .filter((section) => section.cards.length > 0)
  }, [freshPermissions, loading, can])

  const salesSection = accessibleSections.find((section) => section.key === 'sales')
  const totalAccessibleSales = salesSection?.cards.length ?? 0

  // Show loading state while fetching fresh permissions
  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-10">
        <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 sm:p-8 text-center shadow-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            Loading reports...
          </p>
        </div>
      </div>
    )
  }

  if (accessibleSections.length === 0) {
    return (
      <div className="p-4 sm:p-6 md:p-10">
        <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 sm:p-8 text-center shadow-sm">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Reports Hub</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            Your role does not currently include access to any reports. Contact an administrator
            if you believe this is an error.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-10 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">Reports Hub</h1>
        <p className="text-gray-600 dark:text-gray-300 text-base sm:text-lg">
          Explore the reports you are authorised to view. Sections and links are tailored to the
          permissions granted to your role.
        </p>
      </header>

      {salesSection && (
        <section className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 rounded-xl shadow-lg p-6 sm:p-8 text-white">
          <h2 className="text-xl sm:text-2xl font-semibold mb-3">Sales Insights Summary</h2>
          <p className="text-blue-100 dark:text-blue-50 mb-6 text-sm sm:text-base">
            Gain visibility into transactions, trends, customer performance, and payment behaviour
            with dedicated sales intelligence reports.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 dark:bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <div className="text-3xl mb-1">📊</div>
              <div className="text-xs sm:text-sm uppercase tracking-wide text-blue-100 dark:text-blue-50">Reports Available</div>
              <div className="text-xl sm:text-2xl font-bold">{totalAccessibleSales}</div>
            </div>
            <div className="bg-white/10 dark:bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <div className="text-3xl mb-1">🧾</div>
              <div className="text-xs sm:text-sm uppercase tracking-wide text-blue-100 dark:text-blue-50">Transaction Focus</div>
              <div className="text-xs sm:text-sm font-semibold">Journal & History</div>
            </div>
            <div className="bg-white/10 dark:bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <div className="text-3xl mb-1">📍</div>
              <div className="text-xs sm:text-sm uppercase tracking-wide text-blue-100 dark:text-blue-50">Location Insights</div>
              <div className="text-xs sm:text-sm font-semibold">Comparative dashboards</div>
            </div>
            <div className="bg-white/10 dark:bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <div className="text-3xl mb-1">🧑‍🤝‍🧑</div>
              <div className="text-xs sm:text-sm uppercase tracking-wide text-blue-100 dark:text-blue-50">Customer Analytics</div>
              <div className="text-xs sm:text-sm font-semibold">Behaviour & loyalty</div>
            </div>
          </div>
        </section>
      )}

      {accessibleSections.map((section) => (
        <section key={section.key} className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{section.title}</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">{section.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {section.cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg dark:hover:shadow-2xl transition-all duration-200 hover:-translate-y-1 overflow-hidden group"
              >
                <div className={`bg-gradient-to-r ${card.color} p-6 text-white`}>
                  <div className="text-3xl sm:text-4xl mb-3">{card.icon ?? '📄'}</div>
                  <h3 className="text-lg sm:text-xl font-semibold">{card.title}</h3>
                </div>
                <div className="p-4 sm:p-6 space-y-4">
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{card.description}</p>
                  {card.features && card.features.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                        Highlights
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {card.features.map((feature) => (
                          <span
                            key={feature}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-2 flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                    View Report
                    <svg
                      className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
