"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { usePermissions } from "@/hooks/usePermissions"
import { useBusiness } from "@/hooks/useBusiness"
import { PERMISSIONS } from "@/lib/rbac"
import { useState, useEffect, useMemo, useCallback, memo } from "react"
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
  DocumentPlusIcon,
  UserCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  XMarkIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  SpeakerWaveIcon,
  CalendarIcon,
  BellAlertIcon,
  PrinterIcon,
  WrenchScrewdriverIcon,
  DocumentMagnifyingGlassIcon,
  QuestionMarkCircleIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline"

interface MenuItem {
  name: string
  href: string
  icon: any
  key?: string
  permission?: string
  children?: MenuItem[]
}

function SidebarComponent({ isOpen }: { isOpen: boolean }) {
  const pathname = usePathname()
  const { can, user } = usePermissions()
  const { companyName } = useBusiness()
  const [accessibleMenuKeys, setAccessibleMenuKeys] = useState<Set<string>>(new Set())
  const [menuPermissionsLoaded, setMenuPermissionsLoaded] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    Products: false,
    Purchases: false,
    Reports: false,
    "POS & Sales": false,
    "Pricing Management": false,
    "Sales Reports": false,
    "Cashier Reports": false,
    "Purchase Reports": false,
    "Transfer Reports": false,
    "Financial Reports": false,
    "Inventory Reports": false,
    "Compliance Reports": false,
    "Security & Audit": false,
    "HR & Attendance": false,
    "Returns Management": false,
    "Technical Services": false,
    "Accounting": false,
    "Administration": false,
    "Expenses": false,
    "Expense Reports": false,
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

  // Auto-expand menus based on current pathname
  useEffect(() => {
    if (!pathname) return

    // Helper function to check if a menu item or its children match the current pathname
    const findAndExpandMenus = (items: MenuItem[], menusToExpand: Record<string, boolean> = {}) => {
      items.forEach(item => {
        // Check if current item matches pathname
        if (pathname === item.href || pathname.startsWith(item.href + '/')) {
          menusToExpand[item.name] = true
        }

        // Check children
        if (item.children) {
          item.children.forEach(child => {
            if (pathname === child.href || pathname.startsWith(child.href + '/')) {
              menusToExpand[item.name] = true // Expand parent
              if (child.children) {
                menusToExpand[child.name] = true // Expand child if it has grandchildren
              }
            }

            // Check grandchildren
            if (child.children) {
              child.children.forEach(grandchild => {
                if (pathname === grandchild.href || pathname.startsWith(grandchild.href + '/')) {
                  menusToExpand[item.name] = true // Expand parent
                  menusToExpand[child.name] = true // Expand child
                }
              })
            }
          })
        }
      })
      return menusToExpand
    }

    const newExpandedMenus = findAndExpandMenus(menuItems)
    if (Object.keys(newExpandedMenus).length > 0) {
      setExpandedMenus((prev) => ({ ...prev, ...newExpandedMenus }))
    }
  }, [pathname])

  // Fetch menu permissions for current user
  useEffect(() => {
    async function fetchMenuPermissions() {
      if (!user?.id) return

      try {
        const res = await fetch(`/api/settings/menu-permissions/user/${user.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data.accessibleMenuKeys) {
            setAccessibleMenuKeys(new Set(data.data.accessibleMenuKeys))
          }
        }
        // If API fails or returns empty, fail-open (show all menus)
        setMenuPermissionsLoaded(true)
      } catch (error) {
        console.error('Failed to load menu permissions:', error)
        // Fail-open: on error, allow all menus to be visible
        setMenuPermissionsLoaded(true)
      }
    }

    fetchMenuPermissions()
  }, [user?.id])

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

  // Check if menu item has access based on menu permissions (optimized with useCallback)
  const hasMenuPermissionAccess = useCallback((menuKey: string | undefined): boolean => {
    // If no key, allow access (for backward compatibility)
    if (!menuKey) return true

    // If permissions not loaded yet, show all menus (fail-open during loading)
    if (!menuPermissionsLoaded) return true

    // ONLY Super Admin bypasses menu permissions and gets access to ALL menus
    const isSuperAdmin = user?.roles?.some((role: string) => role === 'Super Admin')
    if (isSuperAdmin) return true

    // For all other roles (Admin, All Branch Admin, etc.): if no menu permissions assigned, hide all menus
    if (accessibleMenuKeys.size === 0) return false

    // Check if the menu key is in the accessible list
    return accessibleMenuKeys.has(menuKey)
  }, [accessibleMenuKeys, menuPermissionsLoaded, user?.roles])

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

  const menuItems: MenuItem[] = [
    // ========== CORE OPERATIONS ==========
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: HomeIcon,
      key: "dashboard",
      permission: PERMISSIONS.DASHBOARD_VIEW,
    },

    // ========== CASHIER REPORTS ==========
    {
      key: "cashier_reports_root",
      name: "Cashier Reports",
      href: "/dashboard/cashier-reports",
      icon: ChartBarIcon,
      // Use an existing permission cashiers already have so this appears immediately
      permission: PERMISSIONS.REPORT_SALES_TODAY,
      children: [
        {
          key: "cashier_sales_today",
          name: "Sales Today",
          href: "/dashboard/cashier-reports/sales-today",
          icon: DocumentTextIcon,
          permission: PERMISSIONS.REPORT_SALES_TODAY,
        },
        // Other cashier reports will be added here as we implement them
      ],
    },
    {
      name: "Analytics Dashboard V1",
      href: "/dashboard/dashboard-v2",
      icon: ChartBarIcon,
      key: "analytics_dashboard_v1",
      permission: PERMISSIONS.DASHBOARD_VIEW,
    },
    {
      name: "Analytics Dashboard V2",
      href: "/dashboard/analytics-devextreme",
      icon: SparklesIcon,
      key: "analytics_dashboard_v2",
      permission: PERMISSIONS.DASHBOARD_VIEW,
    },
    {
      name: "Analytics Dashboard V3",
      href: "/dashboard/dashboard-v3",
      icon: ChartBarIcon,
      key: "analytics_dashboard_v3",
      permission: PERMISSIONS.DASHBOARD_VIEW,
    },
    {
      name: "Dashboard V4",
      href: "/dashboard/dashboard-v4",
      icon: DocumentMagnifyingGlassIcon,
      key: "dashboard_v4",
      permission: PERMISSIONS.DASHBOARD_VIEW,
    },
    {
      name: "POS & Sales",
      href: "/dashboard/pos",
      icon: ShoppingCartIcon,
      key: "pos_sales",
      permission: PERMISSIONS.SELL_CREATE,
      children: [
        {
          name: "Point of Sale",
          href: "/dashboard/pos",
          icon: ShoppingCartIcon,
          key: "point_of_sale",
          permission: PERMISSIONS.SELL_CREATE,
        },
        {
          name: "Begin Shift",
          href: "/dashboard/shifts/begin",
          icon: ShoppingCartIcon,
          key: "begin_shift",
          permission: PERMISSIONS.SHIFT_OPEN,
        },
        {
          name: "Close Shift",
          href: "/dashboard/shifts/close",
          icon: ShoppingCartIcon,
          key: "close_shift",
          permission: PERMISSIONS.SHIFT_CLOSE,
        },
        {
          name: "X Reading",
          href: "/dashboard/readings/x-reading",
          icon: DocumentTextIcon,
          key: "x_reading",
          permission: PERMISSIONS.X_READING,
        },
        {
          name: "Z Reading",
          href: "/dashboard/readings/z-reading",
          icon: DocumentTextIcon,
          key: "z_reading",
          permission: PERMISSIONS.Z_READING,
        },
        {
          name: "Readings History",
          href: "/dashboard/readings/history",
          icon: ClockIcon,
          key: "readings_history",
          permission: PERMISSIONS.X_READING,
        },
        {
          name: "Sales List",
          href: "/dashboard/sales",
          icon: ShoppingCartIcon,
          key: "sales_list",
          permission: PERMISSIONS.SELL_VIEW_OWN,
        },
      ],
    },

    // ========== PRODUCTS ==========
    {
      name: "Products",
      href: "/dashboard/products",
      icon: CubeIcon,
      key: "inventory_management",
      permission: PERMISSIONS.PRODUCT_VIEW,
      children: [
        {
          name: "List Products",
          href: "/dashboard/products",
          icon: CubeIcon,
          key: "list_products",
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "List Products V2",
          href: "/dashboard/products/list-v2",
          icon: ChartBarIcon,
          key: "list_products_v2",
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "Add Product",
          href: "/dashboard/products/add",
          icon: CubeIcon,
          key: "add_product",
          permission: PERMISSIONS.PRODUCT_CREATE,
        },
        {
          name: "Add Product V2",
          href: "/dashboard/products/add-v2",
          icon: SparklesIcon,
          key: "add_product_v2",
          permission: PERMISSIONS.PRODUCT_CREATE,
        },
        {
          name: "All Branch Stock",
          href: "/dashboard/products/stock",
          icon: CubeIcon,
          key: "all_branch_stock",
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "Branch Stock Pivot",
          href: "/dashboard/products/branch-stock-pivot",
          icon: CubeIcon,
          key: "branch_stock_pivot",
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "Branch Stock Pivot V2",
          href: "/dashboard/products/branch-stock-pivot-v2",
          icon: ChartBarIcon,
          key: "branch_stock_pivot_v2",
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "Inventory Corrections",
          href: "/dashboard/inventory-corrections",
          icon: ClipboardDocumentListIcon,
          key: "inventory_corrections",
          permission: PERMISSIONS.INVENTORY_CORRECTION_VIEW,
        },
        {
          name: "Physical Inventory",
          href: "/dashboard/physical-inventory",
          icon: ClipboardDocumentListIcon,
          key: "physical_inventory",
          permission: PERMISSIONS.PHYSICAL_INVENTORY_EXPORT,
        },
        {
          name: "Print Labels",
          href: "/dashboard/products/print-labels",
          icon: CubeIcon,
          key: "print_labels",
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "Import Products",
          href: "/dashboard/products/import",
          icon: CubeIcon,
          key: "import_products",
          permission: PERMISSIONS.PRODUCT_CREATE,
        },
        {
          name: "Import Branch Stock",
          href: "/dashboard/products/import-branch-stock",
          icon: CubeIcon,
          key: "import_branch_stock",
          permission: PERMISSIONS.SUPERADMIN_ALL,
        },
        {
          name: "CSV ID Mapper",
          href: "/dashboard/products/csv-id-mapper",
          icon: CubeIcon,
          key: "csv_id_mapper",
          permission: PERMISSIONS.SUPERADMIN_ALL,
        },
        {
          name: "Categories",
          href: "/dashboard/products/categories",
          icon: CubeIcon,
          key: "categories",
          permission: PERMISSIONS.PRODUCT_CATEGORY_VIEW,
        },
        {
          name: "Import Categories",
          href: "/dashboard/products/categories/import",
          icon: CubeIcon,
          key: "import_categories",
          permission: PERMISSIONS.SUPERADMIN_ALL,
        },
        {
          name: "Brands",
          href: "/dashboard/products/brands",
          icon: CubeIcon,
          key: "brands",
          permission: PERMISSIONS.PRODUCT_BRAND_VIEW,
        },
        {
          name: "Import Brands",
          href: "/dashboard/products/brands/import",
          icon: CubeIcon,
          key: "import_brands",
          permission: PERMISSIONS.SUPERADMIN_ALL,
        },
        {
          name: "Units",
          href: "/dashboard/products/units",
          icon: CubeIcon,
          key: "units",
          permission: PERMISSIONS.PRODUCT_UNIT_VIEW,
        },
        {
          name: "Warranties",
          href: "/dashboard/products/warranties",
          icon: CubeIcon,
          key: "warranties",
          permission: PERMISSIONS.PRODUCT_WARRANTY_VIEW,
        },
        {
          name: "Bulk Reorder Settings",
          href: "/dashboard/products/bulk-reorder-update",
          icon: CubeIcon,
          key: "bulk_reorder_settings",
          permission: PERMISSIONS.PRODUCT_UPDATE,
        },
      ],
    },

    // ========== PRICING MANAGEMENT ==========
    {
      key: "pricing_management",
      name: "Price Editor",
      href: "/dashboard/products/simple-price-editor",
      icon: CurrencyDollarIcon,
      permission: PERMISSIONS.PRODUCT_PRICE_EDIT,
      children: [
        {
          key: "simple_price_editor",
          name: "Price Editor",
          href: "/dashboard/products/simple-price-editor",
          icon: CurrencyDollarIcon,
          permission: PERMISSIONS.PRODUCT_PRICE_EDIT,
        },
        {
          key: "bulk_price_editor",
          name: "Legacy Bulk Editor",
          href: "/dashboard/products/bulk-price-editor",
          icon: CurrencyDollarIcon,
          permission: PERMISSIONS.PRODUCT_PRICE_BULK_EDIT,
        },
        {
          key: "pricing_settings",
          name: "Pricing Settings",
          href: "/dashboard/settings/pricing",
          icon: CogIcon,
          permission: PERMISSIONS.PRICING_SETTINGS_VIEW,
        },
        {
          key: "location_pricing",
          name: "Location Pricing (Admin)",
          href: "/dashboard/products/location-pricing",
          icon: BuildingStorefrontIcon,
          permission: PERMISSIONS.PRODUCT_PRICE_EDIT_ALL,
        },
        {
          key: "my_location_pricing",
          name: "My Location Pricing",
          href: "/dashboard/products/my-location-pricing",
          icon: BuildingStorefrontIcon,
          permission: PERMISSIONS.PRODUCT_PRICE_EDIT_ALL,
        },
        {
          key: "price_comparison",
          name: "Price Comparison",
          href: "/dashboard/reports/price-comparison",
          icon: ChartBarIcon,
          permission: PERMISSIONS.PRODUCT_PRICE_COMPARISON_VIEW,
        },
        {
          key: "cost_audit",
          name: "Cost Audit",
          href: "/dashboard/reports/cost-audit",
          icon: ShieldCheckIcon,
          permission: PERMISSIONS.PRODUCT_COST_AUDIT_VIEW,
        },
      ],
    },

    // ========== PROCUREMENT ==========
    {
      key: "purchases",
      name: "Purchases",
      href: "/dashboard/purchases",
      icon: TruckIcon,
      permission: PERMISSIONS.PURCHASE_VIEW,
      children: [
        {
          key: "purchase_orders",
          name: "Purchase Orders",
          href: "/dashboard/purchases",
          icon: TruckIcon,
          permission: PERMISSIONS.PURCHASE_VIEW,
        },
        {
          key: "goods_received",
          name: "Goods Received (GRN)",
          href: "/dashboard/purchases/receipts",
          icon: ClipboardDocumentListIcon,
          permission: PERMISSIONS.PURCHASE_RECEIPT_VIEW,
        },
        {
          key: "serial_number_lookup",
          name: "Serial Number Lookup",
          href: "/dashboard/serial-lookup",
          icon: DocumentTextIcon,
          permission: PERMISSIONS.PURCHASE_RECEIPT_VIEW,
        },
        {
          key: "serial_number_import",
          name: "Import Serial Numbers",
          href: "/dashboard/serial-numbers/bulk-import",
          icon: DocumentPlusIcon,
          permission: PERMISSIONS.PURCHASE_CREATE,
        },
        {
          key: "reorder_suggestions",
          name: "Reorder Suggestions",
          href: "/dashboard/purchases/suggestions",
          icon: ExclamationTriangleIcon,
          permission: PERMISSIONS.PURCHASE_VIEW,
        },
        {
          key: "accounts_payable",
          name: "Accounts Payable",
          href: "/dashboard/accounts-payable",
          icon: DocumentTextIcon,
          permission: PERMISSIONS.ACCOUNTS_PAYABLE_VIEW,
        },
        {
          key: "payments",
          name: "Payments",
          href: "/dashboard/payments",
          icon: CurrencyDollarIcon,
          permission: PERMISSIONS.PAYMENT_VIEW,
        },
        {
          key: "banks",
          name: "Banks",
          href: "/dashboard/banks",
          icon: CurrencyDollarIcon,
          permission: PERMISSIONS.BANK_VIEW,
        },
        {
          key: "bank_transactions",
          name: "Bank Transactions",
          href: "/dashboard/bank-transactions",
          icon: CurrencyDollarIcon,
          permission: PERMISSIONS.BANK_TRANSACTION_VIEW,
        },
        {
          key: "post_dated_cheques",
          name: "Post-Dated Cheques",
          href: "/dashboard/post-dated-cheques",
          icon: DocumentTextIcon,
          permission: PERMISSIONS.PAYMENT_VIEW,
        },
      ],
    },
    {
      key: "stock_transfers",
      name: "Stock Transfers",
      href: "/dashboard/transfers",
      icon: TruckIcon,
      permission: PERMISSIONS.STOCK_TRANSFER_VIEW,
      children: [
        {
          key: "all_transfers",
          name: "All Transfers",
          href: "/dashboard/transfers",
          icon: TruckIcon,
          permission: PERMISSIONS.STOCK_TRANSFER_VIEW,
        },
        {
          key: "create_transfer",
          name: "Create Transfer",
          href: "/dashboard/transfers/create",
          icon: TruckIcon,
          permission: PERMISSIONS.STOCK_TRANSFER_CREATE,
        },
        {
          key: "my_transfers_report",
          name: "My Transfers",
          href: "/dashboard/reports/my-transfers",
          icon: ChartBarIcon,
          permission: PERMISSIONS.STOCK_TRANSFER_VIEW,
        },
        {
          key: "my_received_transfers_report",
          name: "My Received Transfers",
          href: "/dashboard/reports/my-received-transfers",
          icon: ChartBarIcon,
          permission: PERMISSIONS.STOCK_TRANSFER_VIEW,
        },
      ],
    },

    // ========== RETURNS MANAGEMENT ==========
    {
      key: "returns_management",
      name: "Returns Management",
      href: "/dashboard/customer-returns",
      icon: ArrowUturnLeftIcon,
      // No permission check - controlled by menu permissions only
      children: [
        {
          key: "customer_returns",
          name: "Customer Returns",
          href: "/dashboard/customer-returns",
          icon: ArrowUturnLeftIcon,
          permission: PERMISSIONS.CUSTOMER_RETURN_VIEW,
        },
        {
          key: "purchase_returns",
          name: "Purchase Returns",
          href: "/dashboard/purchases/returns",
          icon: ArrowUturnLeftIcon,
          permission: PERMISSIONS.PURCHASE_RETURN_VIEW,
        },
        {
          key: "supplier_returns",
          name: "Supplier Returns",
          href: "/dashboard/supplier-returns",
          icon: ArrowUturnLeftIcon,
          permission: PERMISSIONS.PURCHASE_RETURN_VIEW,
        },
      ],
    },

    // ========== CONTACTS ==========
    {
      key: "customers",
      name: "Customers",
      href: "/dashboard/customers",
      icon: UserGroupIcon,
      permission: PERMISSIONS.CUSTOMER_VIEW,
      children: [
        {
          key: "all_customers",
          name: "All Customers",
          href: "/dashboard/customers",
          icon: UserGroupIcon,
          permission: PERMISSIONS.CUSTOMER_VIEW,
        },
        {
          key: "import_customers",
          name: "Import Customers",
          href: "/dashboard/customers/import",
          icon: UserGroupIcon,
          permission: PERMISSIONS.SUPERADMIN_ALL,
        },
      ],
    },
    {
      key: "suppliers",
      name: "Suppliers",
      href: "/dashboard/suppliers",
      icon: BuildingStorefrontIcon,
      permission: PERMISSIONS.SUPPLIER_VIEW,
      children: [
        {
          key: "all_suppliers",
          name: "All Suppliers",
          href: "/dashboard/suppliers",
          icon: BuildingStorefrontIcon,
          permission: PERMISSIONS.SUPPLIER_VIEW,
        },
        {
          key: "import_suppliers",
          name: "Import Suppliers",
          href: "/dashboard/suppliers/import",
          icon: BuildingStorefrontIcon,
          permission: PERMISSIONS.SUPERADMIN_ALL,
        },
      ],
    },

    // ========== EXPENSES ==========
    {
      key: "expenses",
      name: "Expenses",
      href: "/dashboard/expenses",
      icon: CreditCardIcon,
      permission: PERMISSIONS.EXPENSE_VIEW,
      children: [
        {
          key: "all_expenses",
          name: "All Expenses",
          href: "/dashboard/expenses",
          icon: CreditCardIcon,
          permission: PERMISSIONS.EXPENSE_VIEW,
        },
        {
          key: "expense_categories",
          name: "Expense Categories",
          href: "/dashboard/expenses/categories",
          icon: CreditCardIcon,
          permission: PERMISSIONS.EXPENSE_VIEW,
        },
      ],
    },

    // ========== REPORTS ==========
    {
      key: "reports",
      name: "Reports",
      href: "/dashboard/reports",
      icon: ChartBarIcon,
      permission: PERMISSIONS.REPORT_VIEW,
      children: [
        {
          key: "all_reports_hub",
          name: "All Reports Hub",
          href: "/dashboard/reports",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_VIEW,
        },
        {
          key: "sales_reports",
          name: "Sales Reports",
          href: "#",
          icon: ShoppingCartIcon,
          permission: PERMISSIONS.SALES_REPORT_VIEW,
          children: [
            {
              key: "sales_today",
              name: "Sales Today",
              href: "/dashboard/reports/sales-today",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_SALES_TODAY,
            },
            {
              key: "sales_history",
              name: "Sales History",
              href: "/dashboard/reports/sales-history",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_SALES_HISTORY,
            },
            {
              key: "sales_report",
              name: "Sales Invoice Details",
              href: "/dashboard/reports/sales-report",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_SALES_VIEW,
            },
            {
              key: "sales_journal",
              name: "Sales Journal",
              href: "/dashboard/reports/sales-journal",
              icon: ChartBarIcon,
              permission: PERMISSIONS.SALES_REPORT_JOURNAL,
            },
            {
              key: "sales_per_item",
              name: "Sales Per Item",
              href: "/dashboard/reports/sales-per-item",
              icon: ChartBarIcon,
              permission: PERMISSIONS.SALES_REPORT_PER_ITEM,
            },
            {
              key: "sales_per_cashier",
              name: "Sales Per Cashier",
              href: "/dashboard/reports/sales-per-cashier",
              icon: ChartBarIcon,
              permission: PERMISSIONS.SALES_REPORT_PER_CASHIER,
            },
            {
              key: "hourly_sales_breakdown",
              name: "Hourly Sales Breakdown",
              href: "/dashboard/reports/sales-by-hour",
              icon: ClockIcon,
              permission: PERMISSIONS.REPORT_SALES_BY_HOUR,
            },
            {
              key: "discount_analysis",
              name: "Discount Analysis",
              href: "/dashboard/reports/discount-analysis",
              icon: ChartBarIcon,
              permission: PERMISSIONS.SALES_REPORT_DISCOUNT_ANALYSIS,
            },
            {
              key: "void_refund_analysis",
              name: "Void & Refund Analysis",
              href: "/dashboard/reports/void-refund-analysis",
              icon: ExclamationTriangleIcon,
              permission: PERMISSIONS.REPORT_VOID_REFUND_ANALYSIS,
            },
          ],
        },
        {
          key: "cashier_reports",
          name: "Cashier Reports",
          href: "#",
          icon: ShoppingCartIcon,
          // Cashiers already have this permission; admins will also pass but can ignore
          permission: PERMISSIONS.REPORT_SALES_TODAY,
          children: [
            {
              key: "cashier_sales_today_report",
              name: "Sales Today (Cashier)",
              href: "/dashboard/reports/cashier/sales-today",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_SALES_TODAY,
            },
            {
              key: "cashier_sales_history",
              name: "Sales History (Cashier)",
              href: "/dashboard/reports/cashier/history",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_SALES_HISTORY,
            },
            {
              key: "cashier_invoice_details",
              name: "Sales Invoice Details (Cashier)",
              href: "/dashboard/reports/cashier/invoice-details",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_SALES_VIEW,
            },
            {
              key: "cashier_sales_journal",
              name: "Sales Journal (Cashier)",
              href: "/dashboard/reports/cashier/journal",
              icon: ChartBarIcon,
              permission: PERMISSIONS.SALES_REPORT_JOURNAL,
            },
            {
              key: "cashier_sales_per_item",
              name: "Sales Per Item (Cashier)",
              href: "/dashboard/reports/cashier/per-item",
              icon: ChartBarIcon,
              permission: PERMISSIONS.SALES_REPORT_PER_ITEM,
            },
            // ========== AR / CUSTOMER PAYMENT REPORTS ==========
            {
              key: "cashier_accounts_receivable",
              name: "Accounts Receivable",
              href: "/dashboard/reports/accounts-receivable",
              icon: CurrencyDollarIcon,
              permission: PERMISSIONS.REPORT_UNPAID_INVOICES,
            },
            {
              key: "cashier_payment_collections",
              name: "Payment Collections",
              href: "/dashboard/reports/payment-collections",
              icon: BanknotesIcon,
              permission: PERMISSIONS.REPORT_CUSTOMER_PAYMENTS,
            },
            {
              key: "cashier_receivable_payments",
              name: "Receivable Payments",
              href: "/dashboard/reports/receivable-payments",
              icon: CreditCardIcon,
              permission: PERMISSIONS.REPORT_CUSTOMER_PAYMENTS,
            },
          ],
        },
        {
          key: "purchase_reports",
          name: "Purchase Reports",
          href: "#",
          icon: TruckIcon,
          permission: PERMISSIONS.REPORT_PURCHASE_VIEW,
          children: [
            {
              key: "purchase_reports_hub",
              name: "Purchase Reports Hub",
              href: "/dashboard/reports/purchases",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_PURCHASE_VIEW,
            },
            {
              key: "purchase_analytics",
              name: "Purchase Analytics",
              href: "/dashboard/reports/purchases/analytics",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_PURCHASE_ANALYTICS,
            },
            {
              key: "purchase_trends",
              name: "Purchase Trends",
              href: "/dashboard/reports/purchase-trends",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_PURCHASE_TRENDS,
            },
            {
              key: "purchase_items_report",
              name: "Purchase Items Report",
              href: "/dashboard/reports/purchases-items",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_PURCHASE_ITEMS,
            },
            {
              key: "products_suppliers_report",
              name: "Products-Suppliers Report",
              href: "/dashboard/reports/products-suppliers",
              icon: TruckIcon,
              permission: PERMISSIONS.REPORT_PURCHASE_VIEW,
            },
          ],
        },
        {
          key: "inventory_reports",
          name: "Inventory Reports",
          href: "#",
          icon: CubeIcon,
          permission: PERMISSIONS.REPORT_VIEW,
          children: [
            {
              key: "stock_alert_report",
              name: "Stock Alert Report",
              href: "/dashboard/reports/stock-alert",
              icon: ExclamationTriangleIcon,
              permission: PERMISSIONS.REPORT_STOCK_ALERT,
            },
            {
              key: "historical_inventory",
              name: "Historical Inventory",
              href: "/dashboard/reports/historical-inventory",
              icon: ClipboardDocumentListIcon,
              permission: PERMISSIONS.VIEW_INVENTORY_REPORTS,
            },
            {
              key: "inventory_valuation",
              name: "Inventory Valuation",
              href: "/dashboard/reports/inventory-valuation",
              icon: CurrencyDollarIcon,
              permission: PERMISSIONS.PRODUCT_VIEW,
            },
            {
              key: "inventory_valuation_history",
              name: "Inventory Valuation History",
              href: "/dashboard/reports/inventory-valuation-history",
              icon: CurrencyDollarIcon,
              permission: PERMISSIONS.ACCESS_ALL_LOCATIONS, // Admin, Super Admin, and All Branch Admin only
            },
            {
              key: "stock_history_v2",
              name: "Stock History V2",
              href: "/dashboard/reports/stock-history-v2",
              icon: ClipboardDocumentListIcon,
              permission: PERMISSIONS.PRODUCT_VIEW,
            },
            {
              key: "stock_history_v3",
              name: "Stock History V3 (Admin)",
              href: "/dashboard/reports/stock-history-v3",
              icon: ClipboardDocumentListIcon,
              permission: PERMISSIONS.STOCK_HISTORY_V3_VIEW,
            },
            {
              key: "stock_reconciliation",
              name: "Stock Reconciliation",
              href: "/dashboard/reports/reconciliation",
              icon: MagnifyingGlassIcon,
              permission: PERMISSIONS.REPORT_VIEW,
            },
          ],
        },
        {
          key: "transfer_reports",
          name: "Transfer Reports",
          href: "#",
          icon: TruckIcon,
          permission: PERMISSIONS.REPORT_TRANSFER_VIEW,
          children: [
            {
              key: "transfers_report",
              name: "Transfers Report",
              href: "/dashboard/reports/transfers-report",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_TRANSFER_VIEW,
            },
            {
              key: "transfer_trends",
              name: "Transfer Trends",
              href: "/dashboard/reports/transfer-trends",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_TRANSFER_VIEW,
            },
            {
              key: "transfers_per_item",
              name: "Transfers per Item",
              href: "/dashboard/reports/transfers-per-item",
              icon: ChartBarIcon,
              permission: PERMISSIONS.STOCK_TRANSFER_VIEW,
            },
          ],
        },
        {
          key: "financial_reports",
          name: "Financial Reports",
          href: "#",
          icon: CurrencyDollarIcon,
          permission: PERMISSIONS.REPORT_VIEW,
          children: [
            {
              key: "profit_loss_report",
              name: "Profit / Loss Report",
              href: "/dashboard/reports/profit-loss",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_PROFIT_LOSS,
            },
            {
              key: "purchase_sale_report",
              name: "Purchase & Sale Report",
              href: "/dashboard/reports/purchase-sale",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_VIEW,
            },
            {
              key: "profitability_cogs",
              name: "Profitability & COGS",
              href: "/dashboard/reports/profitability",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_PROFITABILITY,
            },
            {
              key: "net_profit_report",
              name: "Net Profit Report",
              href: "/dashboard/reports/profit",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_PROFIT_LOSS,
            },
            {
              key: "cash_in_out_report",
              name: "Cash In/Out Report",
              href: "/dashboard/reports/cash-in-out",
              icon: CurrencyDollarIcon,
              permission: PERMISSIONS.REPORT_CASH_IN_OUT,
            },
            {
              key: "unpaid_invoices",
              name: "Unpaid Invoices",
              href: "/dashboard/reports/unpaid-invoices",
              icon: DocumentTextIcon,
              permission: PERMISSIONS.REPORT_UNPAID_INVOICES,
            },
            {
              key: "customer_payments",
              name: "Customer Payments",
              href: "/dashboard/reports/customer-payments",
              icon: CreditCardIcon,
              permission: PERMISSIONS.REPORT_CUSTOMER_PAYMENTS,
            },
            {
              key: "payment_collections",
              name: "Payment Collections",
              href: "/dashboard/reports/payment-collections",
              icon: ArrowsRightLeftIcon,
              permission: PERMISSIONS.REPORT_CUSTOMER_PAYMENTS,
            },
            {
              key: "accounts_receivable",
              name: "Accounts Receivable",
              href: "/dashboard/reports/accounts-receivable",
              icon: DocumentTextIcon,
              permission: PERMISSIONS.REPORT_CUSTOMER_PAYMENTS,
            },
            {
              key: "receivable_payments",
              name: "Receivable Payments",
              href: "/dashboard/reports/receivable-payments",
              icon: CreditCardIcon,
              permission: PERMISSIONS.REPORT_CUSTOMER_PAYMENTS,
            },
            {
              key: "product_purchase_history",
              name: "Product Purchase History",
              href: "/dashboard/reports/product-purchase-history",
              icon: ChartBarIcon,
              permission: PERMISSIONS.REPORT_PRODUCT_PURCHASE_HISTORY,
            },
            {
              key: "purchase_returns_report",
              name: "Purchase Returns Report",
              href: "/dashboard/reports/purchase-returns",
              icon: ChartBarIcon,
              permission: PERMISSIONS.PURCHASE_RETURN_VIEW,
            },
            {
              key: "returns_analysis",
              name: "Returns Analysis",
              href: "/dashboard/reports/returns-analysis",
              icon: ChartBarIcon,
              permission: PERMISSIONS.PURCHASE_RETURN_VIEW,
            },
            {
              key: "expense_reports_parent",
              name: "Expense Reports",
              href: "#",
              icon: CreditCardIcon,
              permission: PERMISSIONS.EXPENSE_VIEW,
              children: [
                {
                  key: "expense_analytics",
                  name: "Expense Analytics",
                  href: "/dashboard/reports/expenses-analytics",
                  icon: SparklesIcon,
                  permission: PERMISSIONS.EXPENSE_VIEW,
                },
                {
                  key: "all_expenses_report",
                  name: "All Expenses Report",
                  href: "/dashboard/reports/expenses",
                  icon: ChartBarIcon,
                  permission: PERMISSIONS.EXPENSE_VIEW,
                },
              ],
            },
            {
              key: "gl_journal_entries",
              name: "GL Journal Entries",
              href: "/dashboard/reports/gl-entries",
              icon: DocumentTextIcon,
              permission: PERMISSIONS.REPORT_VIEW,
            },
          ],
        },
        {
          key: "compliance_reports",
          name: "Compliance Reports",
          href: "#",
          icon: DocumentTextIcon,
          permission: PERMISSIONS.REPORT_VIEW,
          children: [
            {
              key: "bir_daily_sales_summary",
              name: "BIR Daily Sales Summary",
              href: "/dashboard/reports/bir/daily-sales-summary",
              icon: DocumentTextIcon,
              permission: PERMISSIONS.REPORT_VIEW,
            },
            {
              key: "tax_report",
              name: "Tax Report",
              href: "/dashboard/reports/tax",
              icon: DocumentTextIcon,
              permission: PERMISSIONS.REPORT_VIEW,
            },
          ],
        },
        {
          key: "security_audit",
          name: "Security & Audit",
          href: "#",
          icon: ShieldCheckIcon,
          permission: PERMISSIONS.AUDIT_LOG_VIEW,
          children: [
            {
              key: "audit_trail_report",
              name: "Audit Trail Report",
              href: "/dashboard/reports/audit-trail",
              icon: ShieldCheckIcon,
              permission: PERMISSIONS.AUDIT_LOG_VIEW,
            },
          ],
        },
        {
          key: "hr_reports",
          name: "HR Reports",
          href: "#",
          icon: ClockIcon,
          permission: PERMISSIONS.ATTENDANCE_REPORT,
          children: [
            {
              key: "attendance_report",
              name: "Attendance Report",
              href: "/dashboard/reports/attendance",
              icon: ClockIcon,
              permission: PERMISSIONS.ATTENDANCE_REPORT,
            },
          ],
        },
      ],
    },

    // ========== HR & ATTENDANCE ==========
    {
      key: "hr_attendance",
      name: "HR & Attendance",
      href: "/dashboard/schedules",
      icon: CalendarIcon,
      permission: PERMISSIONS.SCHEDULE_VIEW,
      children: [
        {
          key: "clock_in_out",
          name: "Clock In/Out",
          href: "/dashboard/clock",
          icon: ClockIcon,
          permission: PERMISSIONS.ATTENDANCE_CLOCK_IN,
        },
        {
          key: "employee_schedules",
          name: "Employee Schedules",
          href: "/dashboard/schedules",
          icon: CalendarIcon,
          permission: PERMISSIONS.SCHEDULE_VIEW,
        },
        {
          key: "attendance_records",
          name: "Attendance Records",
          href: "/dashboard/attendance",
          icon: ClockIcon,
          permission: PERMISSIONS.ATTENDANCE_VIEW,
        },
        {
          key: "leave_requests",
          name: "Leave Requests",
          href: "/dashboard/leave-requests",
          icon: CalendarIcon,
          permission: PERMISSIONS.LEAVE_REQUEST_VIEW_OWN,
        },
        {
          key: "location_change_requests",
          name: "Location Change Requests",
          href: "/dashboard/location-changes",
          icon: TruckIcon,
          permission: PERMISSIONS.LOCATION_CHANGE_REQUEST_VIEW,
        },
      ],
    },

    // ========== TECHNICAL SERVICES ==========
    {
      key: "technical_services",
      name: "Technical Services",
      href: "/dashboard/technical",
      icon: WrenchScrewdriverIcon,
      permission: PERMISSIONS.WARRANTY_CLAIM_VIEW,
      children: [
        {
          key: "technical_dashboard",
          name: "Dashboard",
          href: "/dashboard/technical",
          icon: ChartBarIcon,
          permission: PERMISSIONS.WARRANTY_CLAIM_VIEW,
        },
        {
          key: "warranty_claims",
          name: "Warranty Claims",
          href: "/dashboard/technical/warranty-claims",
          icon: ShieldCheckIcon,
          permission: PERMISSIONS.WARRANTY_CLAIM_VIEW,
        },
        {
          key: "job_orders",
          name: "Job Orders",
          href: "/dashboard/technical/job-orders",
          icon: ClipboardDocumentListIcon,
          permission: PERMISSIONS.JOB_ORDER_VIEW,
        },
        {
          key: "technical_serial_lookup",
          name: "Serial Number Lookup",
          href: "/dashboard/technical/serial-lookup",
          icon: DocumentMagnifyingGlassIcon,
          permission: PERMISSIONS.SERIAL_NUMBER_VIEW,
        },
        {
          key: "technicians",
          name: "Technicians",
          href: "/dashboard/technical/technicians",
          icon: UserGroupIcon,
          permission: PERMISSIONS.TECHNICIAN_VIEW,
        },
        {
          key: "service_types",
          name: "Service Types",
          href: "/dashboard/technical/service-types",
          icon: CogIcon,
          permission: PERMISSIONS.WARRANTY_CLAIM_VIEW,
        },
        {
          key: "service_payments",
          name: "Service Payments",
          href: "/dashboard/technical/payments",
          icon: CurrencyDollarIcon,
          permission: PERMISSIONS.WARRANTY_CLAIM_VIEW,
        },
        {
          key: "technical_reports",
          name: "Reports",
          href: "#",
          icon: ChartBarIcon,
          permission: PERMISSIONS.WARRANTY_CLAIM_VIEW,
          children: [
            {
              key: "technician_performance",
              name: "Technician Performance",
              href: "/dashboard/technical/reports/technician-performance",
              icon: ChartBarIcon,
              permission: PERMISSIONS.TECHNICIAN_PERFORMANCE_VIEW,
            },
            {
              key: "service_analytics",
              name: "Service Analytics",
              href: "/dashboard/technical/reports/analytics",
              icon: ChartBarIcon,
              permission: PERMISSIONS.WARRANTY_CLAIM_VIEW,
            },
            {
              key: "warranty_claims_report",
              name: "Warranty Claims Report",
              href: "/dashboard/technical/reports/warranty-claims",
              icon: DocumentTextIcon,
              permission: PERMISSIONS.WARRANTY_CLAIM_VIEW,
            },
          ],
        },
      ],
    },

    // ========== ACCOUNTING ==========
    {
      key: "accounting",
      name: "Accounting",
      href: "/dashboard/accounting/balance-sheet",
      icon: CurrencyDollarIcon,
      permission: PERMISSIONS.ACCOUNTING_ACCESS,
      children: [
        {
          key: "balance_sheet",
          name: "Balance Sheet",
          href: "/dashboard/accounting/balance-sheet",
          icon: DocumentTextIcon,
          permission: PERMISSIONS.ACCOUNTING_BALANCE_SHEET_VIEW,
        },
        {
          key: "income_statement",
          name: "Income Statement",
          href: "/dashboard/accounting/income-statement",
          icon: ChartBarIcon,
          permission: PERMISSIONS.ACCOUNTING_INCOME_STATEMENT_VIEW,
        },
        {
          key: "trial_balance",
          name: "Trial Balance",
          href: "/dashboard/accounting/trial-balance",
          icon: ShieldCheckIcon,
          permission: PERMISSIONS.ACCOUNTING_TRIAL_BALANCE_VIEW,
        },
        {
          key: "general_ledger",
          name: "General Ledger",
          href: "/dashboard/accounting/general-ledger",
          icon: ClipboardDocumentListIcon,
          permission: PERMISSIONS.ACCOUNTING_GENERAL_LEDGER_VIEW,
        },
      ],
    },

    // ========== ADMINISTRATION ==========
    {
      name: "Administration",
      href: "/dashboard/users",
      icon: UsersIcon,
      key: "administration",
      permission: PERMISSIONS.USER_VIEW,
      children: [
        {
          name: "Users",
          href: "/dashboard/users",
          icon: UsersIcon,
          key: "users",
          permission: PERMISSIONS.USER_VIEW,
        },
        {
          name: "Roles & Permissions",
          href: "/dashboard/roles",
          icon: UsersIcon,
          key: "roles_permissions",
          permission: PERMISSIONS.ROLE_VIEW,
        },
        {
          name: "Business Locations",
          href: "/dashboard/locations",
          icon: BuildingStorefrontIcon,
          key: "business_locations",
          permission: PERMISSIONS.LOCATION_VIEW,
        },
        {
          name: "Announcements",
          href: "/dashboard/announcements",
          icon: SpeakerWaveIcon,
          key: "announcements",
          permission: PERMISSIONS.ANNOUNCEMENT_VIEW,
        },
        {
          name: "Login History",
          href: "/dashboard/admin/login-history",
          icon: ClockIcon,
          key: "login_history",
          permission: PERMISSIONS.AUDIT_LOG_VIEW,
        },
        {
          name: "Active Users Monitor",
          href: "/dashboard/admin/active-users",
          icon: UsersIcon,
          key: "active_users",
          permission: PERMISSIONS.USER_VIEW_ACTIVE_SESSIONS,
        },
        {
          name: "Open Shifts Monitor",
          href: "/dashboard/admin/open-shifts",
          icon: ClockIcon,
          key: "open_shifts",
          permission: PERMISSIONS.USER_VIEW_ACTIVE_SESSIONS,
        },
        {
          name: "Fix Soft-Deleted Variations",
          href: "/dashboard/admin/fix-soft-deleted-variations",
          icon: ShieldCheckIcon,
          key: "fix_soft_deleted_variations",
          permission: PERMISSIONS.SUPER_ADMIN,
        },
      ],
    },

    // ========== SETTINGS ==========
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: CogIcon,
      key: "settings",
      permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
      children: [
        {
          name: "Business Settings",
          href: "/dashboard/business-settings",
          icon: CogIcon,
          key: "business_settings",
          permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
        },
        {
          name: "Printers",
          href: "/dashboard/printers",
          icon: PrinterIcon,
          key: "printers",
          permission: PERMISSIONS.PRINTER_VIEW,
        },
        {
          name: "Invoice Settings",
          href: "/dashboard/settings/invoice-settings",
          icon: CogIcon,
          key: "invoice_settings",
          permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
        },
        {
          name: "Barcode Settings",
          href: "/dashboard/settings/barcode-settings",
          icon: CogIcon,
          key: "barcode_settings",
          permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
        },
        {
          name: "Schedule Login Security",
          href: "/dashboard/settings/schedule-login",
          icon: CogIcon,
          key: "schedule_login_security",
          permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
        },
        {
          name: "SOD Rules (Separation of Duties)",
          href: "/dashboard/settings/sod-rules",
          icon: ShieldCheckIcon,
          key: "sod_rules",
          permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
        },
        {
          name: "Inactivity Timeout",
          href: "/dashboard/settings/inactivity",
          icon: ClockIcon,
          key: "inactivity_timeout",
          permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
        },
        {
          name: "Tax Rates",
          href: "/dashboard/settings/tax-rates",
          icon: CogIcon,
          key: "tax_rates",
          permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
        },
        {
          name: "Menu Permissions",
          href: "/dashboard/settings/menu-permissions",
          icon: ShieldCheckIcon,
          key: "menu_permissions",
          permission: PERMISSIONS.ROLE_VIEW,
        },
        {
          name: "Menu Management",
          href: "/dashboard/settings/menu-management",
          icon: CogIcon,
          key: "menu_management",
          permission: PERMISSIONS.ROLE_UPDATE,
        },
      ],
    },

    // ========== USER SECTION (BOTTOM) ==========
    {
      name: "AI Assistant",
      href: "/dashboard/ai-assistant",
      icon: SparklesIcon,
      key: "ai_assistant",
      // No permission check - visibility controlled by menu permissions
    },
    {
      name: "Help Center",
      href: "/dashboard/help",
      icon: QuestionMarkCircleIcon,
      key: "help_center",
      // No permission check - all users can access help
    },
    {
      name: "Notifications",
      href: "/dashboard/notifications",
      icon: BellAlertIcon,
      key: "notifications",
      permission: PERMISSIONS.LEAVE_REQUEST_APPROVE,
    },
    {
      name: "My Profile",
      href: "/dashboard/profile",
      icon: UserCircleIcon,
      key: "my_profile",
      // No permission check - all users can access their profile
    },
  ]

  // Memoized menu filtering logic (major performance optimization)
  const filteredMenuItems = useMemo(() => {
    const filterMenuItems = (items: MenuItem[], query: string): MenuItem[] => {
      if (!query) return items

      const lowercaseQuery = query.toLowerCase()

      return items.reduce<MenuItem[]>((acc, item) => {
        const matchesItem = item.name.toLowerCase().includes(lowercaseQuery)

        // Filter children first and check their permissions AND menu permissions
        let filteredChildren: MenuItem[] | undefined = undefined
        if (item.children) {
          filteredChildren = item.children
            .filter(child => child.name.toLowerCase().includes(lowercaseQuery))
            .filter(child => !child.permission || can(child.permission))
            .filter(child => hasMenuPermissionAccess(child.key))
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

    // Filter by search query first, then by parent permissions AND menu permissions
    return filterMenuItems(menuItems, searchQuery)
      .filter(item => !item.permission || can(item.permission))
      .filter(item => hasMenuPermissionAccess(item.key))
  }, [menuItems, searchQuery, can, hasMenuPermissionAccess])

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
              <div className="w-full bg-white rounded-md overflow-hidden shadow-md">
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
                        (!child.permission || can(child.permission)) &&
                        hasMenuPermissionAccess(child.key)
                      ).length
                    }
                    return count + itemCount
                  }, 0)
                } menu item{filteredMenuItems.reduce((count, item) => {
                  let itemCount = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ? 1 : 0
                  if (item.children) {
                    itemCount += item.children.filter(child =>
                      child.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                      (!child.permission || can(child.permission)) &&
                      hasMenuPermissionAccess(child.key)
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
                        ${hasActiveChild
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-2 before:h-8 before:bg-white before:rounded-r-md'
                          : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-indigo-600 shadow-md hover:shadow-lg'
                        }
                      `}
                    >
                      <div className="flex items-center">
                        <Icon className={`${isIconOnly ? 'w-6 h-6' : 'w-5 h-5'} ${isIconOnly ? '' : 'mr-3'}`} />
                        {!isIconOnly && <span className="font-medium">{highlightText(item.name, searchQuery, true)}</span>}
                      </div>
                      {!isIconOnly && (
                        <div className={`transform transition-all duration-300 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>
                          <ChevronRightIcon className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </button>
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="ml-6 mt-1 space-y-0.5">
                        {item.children
                          .filter(child => !child.permission || can(child.permission))
                          .filter(child => hasMenuPermissionAccess(child.key))
                          .map((child) => {
                            const isChildActive = pathname === child.href
                            const isChildExpanded = expandedMenus[child.name]
                            const hasGrandchildren = child.children && child.children.length > 0

                            // If child has its own children (grandchildren), render as nested submenu
                            if (hasGrandchildren) {
                              const hasActiveGrandchild = child.children?.some(gc => pathname === gc.href)

                              return (
                                <div key={child.name}>
                                  <button
                                    onClick={() => toggleMenu(child.name)}
                                    className={`
                                      w-full flex items-center justify-between px-4 ${isCompact ? 'py-2' : 'py-2.5'} text-sm font-normal rounded-lg transition-all duration-200 relative pl-8
                                      ${hasActiveGrandchild
                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 font-medium'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                                      }
                                    `}
                                  >
                                    <span className="relative">
                                      {highlightText(child.name, searchQuery)}
                                    </span>
                                    <ChevronRightIcon
                                      className={`w-4 h-4 transition-transform duration-200 ${isChildExpanded ? 'rotate-90' : ''}`}
                                    />
                                  </button>

                                  {/* Grandchildren (nested submenu items) */}
                                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isChildExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <div className="ml-4 mt-1 space-y-0.5">
                                      {child.children
                                        .filter(gc => !gc.permission || can(gc.permission))
                                        .filter(gc => hasMenuPermissionAccess(gc.key))
                                        .map((grandchild) => {
                                          const isGrandchildActive = pathname === grandchild.href
                                          return (
                                            <Link
                                              key={grandchild.name}
                                              href={grandchild.href}
                                              className={`
                                                group flex items-center px-4 ${isCompact ? 'py-1.5' : 'py-2'} text-sm font-normal rounded-lg transition-all duration-200 relative pl-12
                                                ${isGrandchildActive
                                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-5 before:bg-blue-600 before:rounded-r-md'
                                                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                                                }
                                              `}
                                            >
                                              <span className="relative text-xs">
                                                {highlightText(grandchild.name, searchQuery)}
                                              </span>
                                            </Link>
                                          )
                                        })}
                                    </div>
                                  </div>
                                </div>
                              )
                            }

                            // Regular child without grandchildren - render as link
                            return (
                              <Link
                                key={child.name}
                                href={child.href}
                                className={`
                                  group flex items-center px-4 ${isCompact ? 'py-2' : 'py-2.5'} text-sm font-normal rounded-lg transition-all duration-200 relative pl-8
                                  ${isChildActive
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
                      flex items-center ${isIconOnly ? 'justify-center px-2' : 'px-4'} ${isCompact ? 'py-2.5' : 'py-3'} text-sm font-semibold rounded-lg transition-all duration-300 relative shadow-sm
                      ${isActive
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-2 before:h-8 before:bg-white before:rounded-r-md'
                        : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-indigo-600 shadow-md hover:shadow-lg'
                      }
                    `}
                  >
                    <Icon className={`${isIconOnly ? 'w-6 h-6' : 'w-5 h-5'} ${isIconOnly ? '' : 'mr-3'}`} />
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

// Wrap with React.memo to prevent unnecessary re-renders
const Sidebar = memo(SidebarComponent)
export default Sidebar
