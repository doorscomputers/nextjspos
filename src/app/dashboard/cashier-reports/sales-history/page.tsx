"use client"

import SalesHistoryPage from "@/app/dashboard/reports/sales-history/page"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"

export default function CashierSalesHistoryWrapper() {
  const { can } = usePermissions()
  const allowed = can(PERMISSIONS.REPORT_SALES_HISTORY)

  if (!allowed) {
    return (
      <div className="p-6">
        <p className="text-red-600">You do not have permission to view this report.</p>
      </div>
    )
  }

  return <SalesHistoryPage />
}


