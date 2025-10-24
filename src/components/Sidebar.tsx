"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { usePermissions } from "@/hooks/usePermissions"
import { useBusiness } from "@/hooks/useBusiness"
import { PERMISSIONS } from "@/lib/rbac"
import { useState, useEffect } from "react"
import {
  HomeIcon,
  UsersIcon,
  ShoppingCartIcon,
  CubeIcon,
  CreditCardIcon,
  TruckIcon,
  UserGroupIcon,
  ChartBarIcon,
  CogIcon,
  BuildingStorefrontIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  ArrowUturnLeftIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  UserCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  SpeakerWaveIcon,
  CalendarIcon,
  ClockIcon,
  BellAlertIcon,
} from "@heroicons/react/24/outline"

interface MenuItem {
  name: string
  href: string
  icon: any
  permission?: string
  children?: MenuItem[]
}

export default function Sidebar({ isOpen }: { isOpen: boolean }) {
  const pathname = usePathname()
  const { can, user } = usePermissions()
  const { companyName } = useBusiness()
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    Products: true, // Products menu expanded by default
    Purchases: true, // Purchases menu expanded by default
    Reports: true, // Reports menu expanded by default
    "POS & Sales": true, // POS menu expanded by default
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Load collapse state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCollapsed')
    if (savedState !== null) {
      setIsCollapsed(savedState === 'true')
    }
  }, [])

  // Dynamic sidebar style based on collapse state
  const isIconOnly = isCollapsed
  const isCompact = false
  const sidebarWidth = isCollapsed ? '4.5rem' : '16rem'

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }))
  }

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('sidebarCollapsed', String(newState))
  }

  const clearSearch = () => {
    setSearchQuery('')
  }

  const highlightText = (text: string, query: string, isBlueBackground: boolean = false) => {
    if (!query || !text) return text
    try {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${escapedQuery})`, 'gi')
      const parts = text.split(regex)
      return parts.map((part, index) => {
        if (regex.test(part)) {
          if (isBlueBackground) {
            // For blue backgrounds, use orange highlight with white text
            return <span key={`${index}-${part}`} className="bg-orange-400 text-white font-bold px-1 rounded">{part}</span>
          } else {
            // For light/dark backgrounds, use yellow highlight with dark text that works in both modes
            return <span key={`${index}-${part}`} className="bg-yellow-400 text-gray-900 dark:text-gray-900 font-bold px-1 rounded">{part}</span>
          }
        }
        return part
      })
    } catch (error) {
      return text
    }
  }

  // Auto-expand menus when search changes
  useEffect(() => {
    if (searchQuery) {
      const menusToExpand: string[] = []
      menuItems.forEach(item => {
        const lowercaseQuery = searchQuery.toLowerCase()
        const hasMatchingChild = item.children?.some(child =>
          child.name.toLowerCase().includes(lowercaseQuery)
        )
        if (hasMatchingChild) {
          menusToExpand.push(item.name)
        }
      })
      if (menusToExpand.length > 0) {
        setExpandedMenus(prev => {
          const updated = { ...prev }
          menusToExpand.forEach(menuName => {
            updated[menuName] = true
          })
          return updated
        })
      }
    }
  }, [searchQuery])

  const filterMenuItems = (items: MenuItem[], query: string): MenuItem[] => {
    if (!query) return items

    const lowercaseQuery = query.toLowerCase()

    return items.reduce<MenuItem[]>((acc, item) => {
      const matchesItem = item.name.toLowerCase().includes(lowercaseQuery)

      // Filter children first and check their permissions
      let filteredChildren: MenuItem[] | undefined = undefined
      if (item.children) {
        filteredChildren = item.children
          .filter(child => child.name.toLowerCase().includes(lowercaseQuery))
          .filter(child => !child.permission || can(child.permission))
      }

      if (matchesItem || (filteredChildren && filteredChildren.length > 0)) {
        acc.push({
          ...item,
          children: matchesItem ? item.children : filteredChildren,
        })
      }

      return acc
    }, [])
  }

  const menuItems: MenuItem[] = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: HomeIcon,
      permission: PERMISSIONS.DASHBOARD_VIEW,
    },
    {
      name: "Analytics Dashboard",
      href: "/dashboard/dashboard-v2",
      icon: ChartBarIcon,
      permission: PERMISSIONS.DASHBOARD_VIEW,
    },
    {
      name: "Clock In/Out",
      href: "/dashboard/clock",
      icon: ClockIcon,
      permission: PERMISSIONS.ATTENDANCE_CLOCK_IN,
    },
    {
      name: "Notifications",
      href: "/dashboard/notifications",
      icon: BellAlertIcon,
      permission: PERMISSIONS.LEAVE_REQUEST_APPROVE,
    },
    // {
    //   name: "AI Assistant",
    //   href: "/dashboard/ai-assistant",
    //   icon: SparklesIcon,
    //   permission: PERMISSIONS.DASHBOARD_VIEW,
    // },
    {
      name: "POS & Sales",
      href: "/dashboard/pos",
      icon: ShoppingCartIcon,
      permission: PERMISSIONS.SELL_CREATE,
      children: [
        {
          name: "Point of Sale",
          href: "/dashboard/pos",
          icon: ShoppingCartIcon,
          permission: PERMISSIONS.SELL_CREATE,
        },
        {
          name: "Begin Shift",
          href: "/dashboard/shifts/begin",
          icon: ShoppingCartIcon,
          permission: PERMISSIONS.SHIFT_OPEN,
        },
        {
          name: "Close Shift",
          href: "/dashboard/shifts/close",
          icon: ShoppingCartIcon,
          permission: PERMISSIONS.SHIFT_CLOSE,
        },
        {
          name: "X Reading",
          href: "/dashboard/readings/x-reading",
          icon: DocumentTextIcon,
          permission: PERMISSIONS.X_READING,
        },
        {
          name: "Sales List",
          href: "/dashboard/sales",
          icon: ShoppingCartIcon,
          permission: PERMISSIONS.SELL_VIEW_OWN, // Changed to allow cashiers to see their sales
        },
      ],
    },
    {
      name: "Products",
      href: "/dashboard/products",
      icon: CubeIcon,
      permission: PERMISSIONS.PRODUCT_VIEW,
      children: [
        {
          name: "List Products",
          href: "/dashboard/products",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "List Products V2",
          href: "/dashboard/products/list-v2",
          icon: ChartBarIcon,
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "All Branch Stock",
          href: "/dashboard/products/stock",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "Branch Stock Pivot",
          href: "/dashboard/products/branch-stock-pivot",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "Branch Stock Pivot V2",
          href: "/dashboard/products/branch-stock-pivot-v2",
          icon: ChartBarIcon,
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "Add Product",
          href: "/dashboard/products/add",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_CREATE,
        },
        {
          name: "Add Product V2",
          href: "/dashboard/products/add-v2",
          icon: SparklesIcon,
          permission: PERMISSIONS.PRODUCT_CREATE,
        },
        {
          name: "Print Labels",
          href: "/dashboard/products/print-labels",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "Import Products",
          href: "/dashboard/products/import",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_CREATE,
        },
        {
          name: "Import Branch Stock",
          href: "/dashboard/products/import-branch-stock",
          icon: CubeIcon,
          permission: PERMISSIONS.SUPERADMIN_ALL,
        },
        {
          name: "CSV ID Mapper",
          href: "/dashboard/products/csv-id-mapper",
          icon: CubeIcon,
          permission: PERMISSIONS.SUPERADMIN_ALL,
        },
        {
          name: "Categories",
          href: "/dashboard/products/categories",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_CATEGORY_VIEW,
        },
        {
          name: "Import Categories",
          href: "/dashboard/products/categories/import",
          icon: CubeIcon,
          permission: PERMISSIONS.SUPERADMIN_ALL,
        },
        {
          name: "Brands",
          href: "/dashboard/products/brands",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_BRAND_VIEW,
        },
        {
          name: "Import Brands",
          href: "/dashboard/products/brands/import",
          icon: CubeIcon,
          permission: PERMISSIONS.SUPERADMIN_ALL,
        },
        {
          name: "Units",
          href: "/dashboard/products/units",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_UNIT_VIEW,
        },
        {
          name: "Warranties",
          href: "/dashboard/products/warranties",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_WARRANTY_VIEW,
        },
        {
          name: "Bulk Reorder Settings",
          href: "/dashboard/products/bulk-reorder-update",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_UPDATE,
        },
      ],
    },
    {
      name: "Inventory Corrections",
      href: "/dashboard/inventory-corrections",
      icon: ClipboardDocumentListIcon,
      permission: PERMISSIONS.INVENTORY_CORRECTION_VIEW,
    },
    {
      name: "Physical Inventory",
      href: "/dashboard/physical-inventory",
      icon: ClipboardDocumentListIcon,
      permission: PERMISSIONS.PHYSICAL_INVENTORY_EXPORT,
    },
    {
      name: "Purchases",
      href: "/dashboard/purchases",
      icon: TruckIcon,
      permission: PERMISSIONS.PURCHASE_VIEW,
      children: [
        {
          name: "Purchase Orders",
          href: "/dashboard/purchases",
          icon: TruckIcon,
          permission: PERMISSIONS.PURCHASE_VIEW,
        },
        {
          name: "Goods Received (GRN)",
          href: "/dashboard/purchases/receipts",
          icon: ClipboardDocumentListIcon,
          permission: PERMISSIONS.PURCHASE_RECEIPT_VIEW,
        },
        {
          name: "Serial Number Lookup",
          href: "/dashboard/serial-lookup",
          icon: DocumentTextIcon,
          permission: PERMISSIONS.PURCHASE_RECEIPT_VIEW,
        },
        {
          name: "Reorder Suggestions",
          href: "/dashboard/purchases/suggestions",
          icon: ExclamationTriangleIcon,
          permission: PERMISSIONS.PURCHASE_VIEW,
        },
        {
          name: "Accounts Payable",
          href: "/dashboard/accounts-payable",
          icon: DocumentTextIcon,
          permission: PERMISSIONS.ACCOUNTS_PAYABLE_VIEW,
        },
        {
          name: "Payments",
          href: "/dashboard/payments",
          icon: CurrencyDollarIcon,
          permission: PERMISSIONS.PAYMENT_VIEW,
        },
        {
          name: "Banks",
          href: "/dashboard/banks",
          icon: CurrencyDollarIcon,
          permission: PERMISSIONS.BANK_VIEW,
        },
        {
          name: "Bank Transactions",
          href: "/dashboard/bank-transactions",
          icon: CurrencyDollarIcon,
          permission: PERMISSIONS.BANK_TRANSACTION_VIEW,
        },
        {
          name: "Post-Dated Cheques",
          href: "/dashboard/post-dated-cheques",
          icon: DocumentTextIcon,
          permission: PERMISSIONS.PAYMENT_VIEW,
        },
      ],
    },
    {
      name: "Stock Transfers",
      href: "/dashboard/transfers",
      icon: TruckIcon,
      permission: PERMISSIONS.STOCK_TRANSFER_VIEW,
      children: [
        {
          name: "All Transfers",
          href: "/dashboard/transfers",
          icon: TruckIcon,
          permission: PERMISSIONS.STOCK_TRANSFER_VIEW,
        },
        {
          name: "Create Transfer",
          href: "/dashboard/transfers/create",
          icon: TruckIcon,
          permission: PERMISSIONS.STOCK_TRANSFER_CREATE,
        },
      ],
    },
    {
      name: "Customer Returns",
      href: "/dashboard/customer-returns",
      icon: ArrowUturnLeftIcon,
      permission: PERMISSIONS.CUSTOMER_RETURN_VIEW,
    },
    {
      name: "Purchase Returns",
      href: "/dashboard/purchases/returns",
      icon: ArrowUturnLeftIcon,
      permission: PERMISSIONS.PURCHASE_RETURN_VIEW,
    },
    {
      name: "Supplier Returns",
      href: "/dashboard/supplier-returns",
      icon: ArrowUturnLeftIcon,
      permission: PERMISSIONS.PURCHASE_RETURN_VIEW,
    },
    {
      name: "Expenses",
      href: "/dashboard/expenses",
      icon: CreditCardIcon,
      permission: PERMISSIONS.EXPENSE_VIEW,
    },
    {
      name: "Customers",
      href: "/dashboard/customers",
      icon: UserGroupIcon,
      permission: PERMISSIONS.CUSTOMER_VIEW,
    },
    {
      name: "Suppliers",
      href: "/dashboard/suppliers",
      icon: BuildingStorefrontIcon,
      permission: PERMISSIONS.SUPPLIER_VIEW,
      children: [
        {
          name: "All Suppliers",
          href: "/dashboard/suppliers",
          icon: BuildingStorefrontIcon,
          permission: PERMISSIONS.SUPPLIER_VIEW,
        },
        {
          name: "Import Suppliers",
          href: "/dashboard/suppliers/import",
          icon: BuildingStorefrontIcon,
          permission: PERMISSIONS.SUPERADMIN_ALL,
        },
      ],
    },
    {
      name: "My Profile",
      href: "/dashboard/profile",
      icon: UserCircleIcon,
      // No permission check - all users can access their profile
    },
    {
      name: "User Management",
      href: "/dashboard/users",
      icon: UsersIcon,
      permission: PERMISSIONS.USER_VIEW,
      children: [
        {
          name: "Users",
          href: "/dashboard/users",
          icon: UsersIcon,
          permission: PERMISSIONS.USER_VIEW,
        },
        {
          name: "Roles & Permissions",
          href: "/dashboard/roles",
          icon: UsersIcon,
          permission: PERMISSIONS.ROLE_VIEW,
        },
      ],
    },
    {
      name: "Schedules & Attendance",
      href: "/dashboard/schedules",
      icon: CalendarIcon,
      permission: PERMISSIONS.SCHEDULE_VIEW,
      children: [
        {
          name: "Employee Schedules",
          href: "/dashboard/schedules",
          icon: CalendarIcon,
          permission: PERMISSIONS.SCHEDULE_VIEW,
        },
        {
          name: "Attendance Records",
          href: "/dashboard/attendance",
          icon: ClockIcon,
          permission: PERMISSIONS.ATTENDANCE_VIEW,
        },
        {
          name: "Location Change Requests",
          href: "/dashboard/location-changes",
          icon: TruckIcon,
          permission: PERMISSIONS.LOCATION_CHANGE_REQUEST_VIEW,
        },
        {
          name: "Leave Requests",
          href: "/dashboard/leave-requests",
          icon: CalendarIcon,
          permission: PERMISSIONS.LEAVE_REQUEST_VIEW_OWN,
        },
      ],
    },
    {
      name: "Reports",
      href: "/dashboard/reports",
      icon: ChartBarIcon,
      permission: PERMISSIONS.REPORT_VIEW,
      children: [
        {
          name: "All Reports Hub",
          href: "/dashboard/reports",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_VIEW,
        },
        {
          name: "--- INVENTORY REPORTS ---",
          href: "#",
          icon: ClipboardDocumentListIcon,
          permission: PERMISSIONS.REPORT_VIEW,
        },
        {
          name: "Stock Alert Report",
          href: "/dashboard/reports/stock-alert",
          icon: ExclamationTriangleIcon,
          permission: PERMISSIONS.REPORT_STOCK_ALERT,
        },
        {
          name: "Historical Inventory",
          href: "/dashboard/reports/historical-inventory",
          icon: ClipboardDocumentListIcon,
          permission: PERMISSIONS.VIEW_INVENTORY_REPORTS,
        },
        {
          name: "Inventory Ledger",
          href: "/dashboard/reports/inventory-ledger",
          icon: ClipboardDocumentListIcon,
          permission: PERMISSIONS.INVENTORY_LEDGER_VIEW,
        },
        {
          name: "Stock History V2",
          href: "/dashboard/reports/stock-history-v2",
          icon: ClipboardDocumentListIcon,
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "--- SALES REPORTS ---",
          href: "#",
          icon: ChartBarIcon,
          permission: PERMISSIONS.SALES_REPORT_VIEW,
        },
        {
          name: "Sales Today",
          href: "/dashboard/reports/sales-today",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_SALES_TODAY,
        },
        {
          name: "Sales History",
          href: "/dashboard/reports/sales-history",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_SALES_HISTORY,
        },
        {
          name: "Sales Report",
          href: "/dashboard/reports/sales-report",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_SALES_VIEW,
        },
        {
          name: "Sales Journal",
          href: "/dashboard/reports/sales-journal",
          icon: ChartBarIcon,
          permission: PERMISSIONS.SALES_REPORT_JOURNAL,
        },
        {
          name: "Sales Per Item",
          href: "/dashboard/reports/sales-per-item",
          icon: ChartBarIcon,
          permission: PERMISSIONS.SALES_REPORT_PER_ITEM,
        },
        {
          name: "Sales Per Cashier",
          href: "/dashboard/reports/sales-per-cashier",
          icon: ChartBarIcon,
          permission: PERMISSIONS.SALES_REPORT_PER_CASHIER,
        },
        {
          name: "--- PURCHASE REPORTS ---",
          href: "#",
          icon: TruckIcon,
          permission: PERMISSIONS.REPORT_PURCHASE_VIEW,
        },
        {
          name: "Purchase Reports",
          href: "/dashboard/reports/purchases",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_PURCHASE_VIEW,
        },
        {
          name: "Purchases Report",
          href: "/dashboard/reports/purchases-report",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_PURCHASE_VIEW,
        },
        {
          name: "Purchase Analytics",
          href: "/dashboard/reports/purchases/analytics",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_PURCHASE_ANALYTICS,
        },
        {
          name: "Purchase Trends",
          href: "/dashboard/reports/purchase-trends",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_PURCHASE_TRENDS,
        },
        {
          name: "Purchase Items Report",
          href: "/dashboard/reports/purchases-items",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_PURCHASE_ITEMS,
        },
        {
          name: "Products-Suppliers Report",
          href: "/dashboard/reports/products-suppliers",
          icon: TruckIcon,
          permission: PERMISSIONS.REPORT_PURCHASE_VIEW,
        },
        {
          name: "--- TRANSFER REPORTS ---",
          href: "#",
          icon: TruckIcon,
          permission: PERMISSIONS.REPORT_TRANSFER_VIEW,
        },
        {
          name: "Transfers Report",
          href: "/dashboard/reports/transfers-report",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_TRANSFER_VIEW,
        },
        {
          name: "Transfer Trends",
          href: "/dashboard/reports/transfer-trends",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_TRANSFER_VIEW,
        },
        {
          name: "Transfers per Item",
          href: "/dashboard/reports/transfers-per-item",
          icon: ChartBarIcon,
          permission: PERMISSIONS.STOCK_TRANSFER_VIEW,
        },
        // Hidden: Pivot version available at /dashboard/reports/transfers-per-item-pivot
        // {
        //   name: "Transfers per Item (Pivot)",
        //   href: "/dashboard/reports/transfers-per-item-pivot",
        //   icon: ChartBarIcon,
        //   permission: PERMISSIONS.REPORT_TRANSFER_TRENDS,
        // },
        {
          name: "--- FINANCIAL REPORTS ---",
          href: "#",
          icon: CurrencyDollarIcon,
          permission: PERMISSIONS.REPORT_PROFIT_LOSS,
        },
        {
          name: "Profitability & COGS",
          href: "/dashboard/reports/profitability",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_PROFITABILITY,
        },
        {
          name: "Net Profit Report",
          href: "/dashboard/reports/profit",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_PROFIT_LOSS,
        },
        {
          name: "Product Purchase History",
          href: "/dashboard/reports/product-purchase-history",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_PRODUCT_PURCHASE_HISTORY,
        },
        {
          name: "Purchase Returns Report",
          href: "/dashboard/reports/purchase-returns",
          icon: ChartBarIcon,
          permission: PERMISSIONS.PURCHASE_RETURN_VIEW,
        },
        {
          name: "Returns Analysis",
          href: "/dashboard/reports/returns-analysis",
          icon: ChartBarIcon,
          permission: PERMISSIONS.PURCHASE_RETURN_VIEW,
        },
        {
          name: "--- SECURITY REPORTS ---",
          href: "#",
          icon: ShieldCheckIcon,
          permission: PERMISSIONS.AUDIT_LOG_VIEW,
        },
        {
          name: "Audit Trail Report",
          href: "/dashboard/reports/audit-trail",
          icon: ShieldCheckIcon,
          permission: PERMISSIONS.AUDIT_LOG_VIEW,
        },
        {
          name: "--- ATTENDANCE REPORTS ---",
          href: "#",
          icon: ClockIcon,
          permission: PERMISSIONS.ATTENDANCE_REPORT,
        },
        {
          name: "Attendance Report",
          href: "/dashboard/reports/attendance",
          icon: ClockIcon,
          permission: PERMISSIONS.ATTENDANCE_REPORT,
        },
      ],
    },
    {
      name: "Announcements",
      href: "/dashboard/announcements",
      icon: SpeakerWaveIcon,
      permission: PERMISSIONS.ANNOUNCEMENT_VIEW,
    },
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: CogIcon,
      permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
      children: [
        {
          name: "Business Settings",
          href: "/dashboard/business-settings",
          icon: CogIcon,
          permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
        },
        {
          name: "Business Locations",
          href: "/dashboard/locations",
          icon: BuildingStorefrontIcon,
          permission: PERMISSIONS.LOCATION_VIEW,
        },
        {
          name: "Invoice Settings",
          href: "/dashboard/settings/invoice-settings",
          icon: CogIcon,
          permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
        },
        {
          name: "Barcode Settings",
          href: "/dashboard/settings/barcode-settings",
          icon: CogIcon,
          permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
        },
        {
          name: "Schedule Login Security",
          href: "/dashboard/settings/schedule-login",
          icon: CogIcon,
          permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
        },
        {
          name: "SOD Rules (Separation of Duties)",
          href: "/dashboard/settings/sod-rules",
          icon: ShieldCheckIcon,
          permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
        },
        {
          name: "Inactivity Timeout",
          href: "/dashboard/settings/inactivity",
          icon: ClockIcon,
          permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
        },
        {
          name: "Tax Rates",
          href: "/dashboard/settings/tax-rates",
          icon: CogIcon,
          permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
        },
      ],
    },
    ]

  // Filter by search query first, then by parent permissions
  const filteredMenuItems = filterMenuItems(menuItems, searchQuery).filter(item => !item.permission || can(item.permission))

  return (
    <aside
      style={{ width: sidebarWidth }}
      className={`
        fixed inset-y-0 left-0 z-50 transform bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-2xl border-r border-gray-200 dark:border-gray-800
        transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      <div className="flex flex-col h-full">
        {/* Logo and Company Name */}
        <div className={`${isIconOnly ? 'h-16' : 'h-auto'} px-3 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 shadow-lg relative`}>
          {!isIconOnly && (
            <div className="flex flex-col items-start gap-2">
              {/* Company Logo */}
              <div className="w-full bg-white rounded-md overflow-hidden shadow-md" style={{ height: '60px' }}>
                <img
                  src="/logo.svg"
                  alt="Company Logo"
                  className="w-full h-full object-contain p-2"
                  onError={(e) => {
                    // Try PNG fallback
                    const target = e.target as HTMLImageElement;
                    if (target.src.endsWith('.svg')) {
                      target.src = '/logo.png';
                    } else {
                      // Final fallback to initials
                      target.style.display = 'none';
                      target.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-blue-600 font-bold text-2xl">${companyName.substring(0, 2).toUpperCase()}</div>`;
                    }
                  }}
                />
              </div>

              {/* Company Name and Collapse Button */}
              <div className="w-full flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h1
                    className="text-sm font-bold text-white drop-shadow-sm leading-tight break-words"
                    title={companyName}
                  >
                    {companyName}
                  </h1>
                </div>
                <button
                  onClick={toggleCollapse}
                  className="flex-shrink-0 ml-2 p-1.5 rounded-lg hover:bg-white/20 transition-colors duration-200 text-white"
                  title="Collapse sidebar"
                >
                  <ChevronDoubleLeftIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {isIconOnly && (
            <>
              <div className="flex items-center justify-center h-full">
                <div className="w-10 h-10 bg-white rounded-lg overflow-hidden shadow-md">
                  <img
                    src="/logo.svg"
                    alt="Company Logo"
                    className="w-full h-full object-contain p-1"
                    onError={(e) => {
                      // Try PNG fallback
                      const target = e.target as HTMLImageElement;
                      if (target.src.endsWith('.svg')) {
                        target.src = '/logo.png';
                      } else {
                        // Final fallback to initials
                        target.style.display = 'none';
                        target.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-blue-600 font-bold text-sm">${companyName.substring(0, 2).toUpperCase()}</div>`;
                      }
                    }}
                  />
                </div>
              </div>
              <button
                onClick={toggleCollapse}
                className="absolute top-4 -right-3 p-1 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white shadow-lg border-2 border-white dark:border-gray-800 z-50"
                title="Expand sidebar"
              >
                <ChevronDoubleRightIcon className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* User Info */}
        {!isIconOnly && (
          <div className={`px-4 ${isCompact ? 'py-3' : 'py-4'} bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700`}>
            <p className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold text-gray-900 dark:text-white truncate`}>{user?.name}</p>
            <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{user?.businessName}</p>
          </div>
        )}

        {/* Search Field */}
        {!isIconOnly && (
          <div className="px-4 pb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search menus..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 text-sm bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {searchQuery ? (
                  <button
                    onClick={clearSearch}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
                    title="Clear search"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                ) : (
                  <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>
            {searchQuery && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-300">
                Found {
                  filteredMenuItems.reduce((count, item) => {
                    // Count parent items that match
                    let itemCount = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ? 1 : 0
                    // Count matching children
                    if (item.children) {
                      itemCount += item.children.filter(child =>
                        child.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                        (!child.permission || can(child.permission))
                      ).length
                    }
                    return count + itemCount
                  }, 0)
                } menu item{filteredMenuItems.reduce((count, item) => {
                  let itemCount = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ? 1 : 0
                  if (item.children) {
                    itemCount += item.children.filter(child =>
                      child.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                      (!child.permission || can(child.permission))
                    ).length
                  }
                  return count + itemCount
                }, 0) !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {filteredMenuItems.map((item) => {
            const isActive = pathname === item.href
            const isExpanded = expandedMenus[item.name]
            const Icon = item.icon

            // Check if any child is active
            const hasActiveChild = item.children?.some(child => pathname === child.href)

            return (
              <div key={item.name}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleMenu(item.name)}
                      title={isIconOnly ? item.name : undefined}
                      className={`
                        w-full flex items-center ${isIconOnly ? 'justify-center' : 'justify-between'} ${isIconOnly ? 'px-2' : 'px-4'} ${isCompact ? 'py-2.5' : 'py-3'} text-sm font-semibold rounded-lg transition-all duration-300 relative group shadow-sm
                        ${
                          hasActiveChild
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-2 before:h-8 before:bg-white before:rounded-r-md transform hover:scale-[1.02] hover:shadow-xl after:absolute after:top-1 after:right-12 after:w-2 after:h-2 after:bg-yellow-400 after:rounded-full'
                            : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-indigo-600 shadow-md hover:shadow-lg transform hover:scale-[1.01] after:absolute after:top-1 after:right-12 after:w-2 after:h-2 after:bg-yellow-400 after:rounded-full animate-pulse'
                        }
                      `}
                    >
                      <div className="flex items-center">
                        <Icon className={`${isIconOnly ? 'w-6 h-6' : 'w-5 h-5'} ${isIconOnly ? '' : 'mr-3'} transition-transform group-hover:scale-110`} />
                        {!isIconOnly && <span className="font-medium">{highlightText(item.name, searchQuery, true)}</span>}
                      </div>
                      {!isIconOnly && (
                        <div className={`transform transition-all duration-300 ${isExpanded ? 'rotate-90' : 'rotate-0'} group-hover:scale-110 animate-pulse`}>
                          <div className="bg-white/20 rounded-full p-1 group-hover:bg-white/30 transition-all duration-200 ring-2 ring-white/40 group-hover:ring-white/60 shadow-lg">
                            <ChevronRightIcon className="w-4 h-4 text-white drop-shadow-sm" />
                          </div>
                        </div>
                      )}
                    </button>
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="ml-6 mt-1 space-y-0.5">
                        {item.children
                          .filter(child => !child.permission || can(child.permission))
                          .map((child) => {
                            const isChildActive = pathname === child.href
                            return (
                              <Link
                                key={child.name}
                                href={child.href}
                                className={`
                                  group flex items-center px-4 ${isCompact ? 'py-2' : 'py-2.5'} text-sm font-normal rounded-lg transition-all duration-200 relative pl-8
                                  ${
                                    isChildActive
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-6 before:bg-blue-600 before:rounded-r-md'
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white hover:before:absolute hover:before:left-0 hover:before:top-1/2 hover:before:-translate-y-1/2 hover:before:w-0.5 hover:before:h-4 hover:before:bg-gray-400 dark:hover:before:bg-gray-500 hover:before:rounded-r-md'
                                  }
                                `}
                              >
                                <span className="relative">
                                  {highlightText(child.name, searchQuery)}
                                </span>
                              </Link>
                            )
                          })}
                      </div>
                    </div>
                  </>
                ) : (
                  <Link
                    href={item.href}
                    title={isIconOnly ? item.name : undefined}
                    className={`
                      flex items-center ${isIconOnly ? 'justify-center px-2' : 'px-4'} ${isCompact ? 'py-2.5' : 'py-3'} text-sm font-semibold rounded-lg transition-all duration-300 relative group shadow-sm hover:scale-[1.01]
                      ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-2 before:h-8 before:bg-white before:rounded-r-md transform hover:shadow-xl'
                          : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-indigo-600 shadow-md hover:shadow-lg transform'
                      }
                    `}
                  >
                    <Icon className={`${isIconOnly ? 'w-6 h-6' : 'w-5 h-5'} ${isIconOnly ? '' : 'mr-3'} transition-transform group-hover:scale-110`} />
                    {!isIconOnly && <span className="font-medium">{highlightText(item.name, searchQuery, true)}</span>}
                  </Link>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        {!isIconOnly && (
          <div className={`px-4 ${isCompact ? 'py-3' : 'py-4'} border-t border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900`}>
            <p className="text-xs text-gray-600 dark:text-gray-300 text-center font-medium">
              © 2025 IgoroTech
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
