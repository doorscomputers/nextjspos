"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { usePermissions } from "@/hooks/usePermissions"
import { useBusiness } from "@/hooks/useBusiness"
import { PERMISSIONS } from "@/lib/rbac"
import { useState } from "react"
import { useTheme } from "@/components/theme-provider"
import { sidebarStyles } from "@/lib/themes"
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
  const { sidebarStyle } = useTheme()
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    Products: true, // Products menu expanded by default
    Purchases: true, // Purchases menu expanded by default
  })

  const styleConfig = sidebarStyles[sidebarStyle]
  const isIconOnly = styleConfig.iconOnly
  const isCompact = styleConfig.compact
  const sidebarWidth = styleConfig.width

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }))
  }

  const menuItems: MenuItem[] = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: HomeIcon,
      permission: PERMISSIONS.DASHBOARD_VIEW,
    },
    {
      name: "AI Assistant",
      href: "/dashboard/ai-assistant",
      icon: SparklesIcon,
      permission: PERMISSIONS.DASHBOARD_VIEW,
    },
    {
      name: "Sales",
      href: "/dashboard/sales",
      icon: ShoppingCartIcon,
      permission: PERMISSIONS.SELL_VIEW,
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
          name: "All Branch Stock",
          href: "/dashboard/products/stock",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "Add Product",
          href: "/dashboard/products/add",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_CREATE,
        },
        {
          name: "Print Labels",
          href: "/dashboard/products/print-labels",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "Categories",
          href: "/dashboard/products/categories",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "Brands",
          href: "/dashboard/products/brands",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "Units",
          href: "/dashboard/products/units",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "Warranties",
          href: "/dashboard/products/warranties",
          icon: CubeIcon,
          permission: PERMISSIONS.PRODUCT_VIEW,
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
    },
    {
      name: "Customer Returns",
      href: "/dashboard/customer-returns",
      icon: ArrowUturnLeftIcon,
      permission: PERMISSIONS.CUSTOMER_RETURN_VIEW,
    },
    {
      name: "Supplier Returns",
      href: "/dashboard/supplier-returns",
      icon: BuildingStorefrontIcon,
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
      name: "Reports",
      href: "/dashboard/reports",
      icon: ChartBarIcon,
      permission: PERMISSIONS.REPORT_VIEW,
      children: [
        {
          name: "Stock Alert Report",
          href: "/dashboard/reports/stock-alert",
          icon: ExclamationTriangleIcon,
          permission: PERMISSIONS.PRODUCT_VIEW,
        },
        {
          name: "Sales Report",
          href: "/dashboard/reports/sales-report",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_VIEW,
        },
        {
          name: "Purchases Report",
          href: "/dashboard/reports/purchases-report",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_VIEW,
        },
        {
          name: "Transfers Report",
          href: "/dashboard/reports/transfers-report",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_VIEW,
        },
        {
          name: "Profitability & COGS",
          href: "/dashboard/reports/profitability",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_VIEW,
        },
        {
          name: "Net Profit Report",
          href: "/dashboard/reports/profit",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_VIEW,
        },
        {
          name: "Product Purchase History",
          href: "/dashboard/reports/product-purchase-history",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_VIEW,
        },
      ],
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
          name: "Tax Rates",
          href: "/dashboard/settings/tax-rates",
          icon: CogIcon,
          permission: PERMISSIONS.BUSINESS_SETTINGS_VIEW,
        },
      ],
    },
  ]

  const filteredMenuItems = menuItems.filter(item =>
    !item.permission || can(item.permission)
  )

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
        {/* Logo */}
        <div className={`flex items-center ${isIconOnly ? 'justify-center' : 'justify-center'} h-16 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 shadow-lg`}>
          <h1 className={`${isIconOnly ? 'text-lg' : isCompact ? 'text-lg' : 'text-xl'} font-bold text-white drop-shadow-sm`}>
            {isIconOnly ? companyName.substring(0, 2).toUpperCase() : companyName}
          </h1>
        </div>

        {/* User Info */}
        {!isIconOnly && (
          <div className={`px-4 ${isCompact ? 'py-3' : 'py-4'} bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700`}>
            <p className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold text-gray-900 dark:text-gray-100 truncate`}>{user?.name}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{user?.businessName}</p>
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-1 truncate">{user?.roles?.[0]}</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
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
                        w-full flex items-center ${isIconOnly ? 'justify-center' : 'justify-between'} ${isIconOnly ? 'px-2' : 'px-4'} ${isCompact ? 'py-2' : 'py-3'} text-sm font-semibold rounded-lg transition-all duration-200
                        ${
                          hasActiveChild
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shadow-sm'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                        }
                      `}
                    >
                      <div className="flex items-center">
                        <Icon className={`${isIconOnly ? 'w-6 h-6' : 'w-5 h-5'} ${isIconOnly ? '' : 'mr-3'}`} />
                        {!isIconOnly && item.name}
                      </div>
                      {!isIconOnly && (
                        isExpanded ? (
                          <ChevronDownIcon className="w-4 h-4" />
                        ) : (
                          <ChevronRightIcon className="w-4 h-4" />
                        )
                      )}
                    </button>
                    {isExpanded && !isIconOnly && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.children
                          .filter(child => !child.permission || can(child.permission))
                          .map((child) => {
                            const isChildActive = pathname === child.href
                            return (
                              <Link
                                key={child.name}
                                href={child.href}
                                className={`
                                  flex items-center px-4 ${isCompact ? 'py-1.5' : 'py-2'} text-sm font-medium rounded-lg transition-all duration-200
                                  ${
                                    isChildActive
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold'
                                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                                  }
                                `}
                              >
                                {child.name}
                              </Link>
                            )
                          })}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    title={isIconOnly ? item.name : undefined}
                    className={`
                      flex items-center ${isIconOnly ? 'justify-center px-2' : 'px-4'} ${isCompact ? 'py-2' : 'py-3'} text-sm font-semibold rounded-lg transition-all duration-200
                      ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shadow-sm'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                      }
                    `}
                  >
                    <Icon className={`${isIconOnly ? 'w-6 h-6' : 'w-5 h-5'} ${isIconOnly ? '' : 'mr-3'}`} />
                    {!isIconOnly && item.name}
                  </Link>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        {!isIconOnly && (
          <div className={`px-4 ${isCompact ? 'py-3' : 'py-4'} border-t border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900`}>
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center font-medium">
              © 2025 IgoroTech
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
