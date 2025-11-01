"use client"

import SalesJournalReport from "@/app/dashboard/reports/sales-journal/page"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"

export default function CashierSalesJournalWrapper() {
  const { can } = usePermissions()
  const allowed = can(PERMISSIONS.SALES_REPORT_JOURNAL)

  if (!allowed) {
    return (
      <div className="p-6">
        <p className="text-red-600">You do not have permission to view this report.</p>
      </div>
    )
  }

  return <SalesJournalReport />
}


