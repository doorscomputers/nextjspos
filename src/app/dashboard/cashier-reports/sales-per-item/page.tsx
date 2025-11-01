"use client"

import SalesPerItemReport from "@/app/dashboard/reports/sales-per-item/page"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"

export default function CashierSalesPerItemWrapper() {
  const { can } = usePermissions()
  const allowed = can(PERMISSIONS.SALES_REPORT_PER_ITEM)

  if (!allowed) {
    return (
      <div className="p-6">
        <p className="text-red-600">You do not have permission to view this report.</p>
      </div>
    )
  }

  return <SalesPerItemReport />
}


