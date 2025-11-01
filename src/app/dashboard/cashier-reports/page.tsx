"use client"

import Link from "next/link"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"

export default function CashierReportsIndex() {
  const { can } = usePermissions()
  const allowed = can(PERMISSIONS.REPORT_SALES_TODAY)

  if (!allowed) {
    return (
      <div className="p-6">
        <p className="text-red-600">You do not have permission to view Cashier Reports.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Cashier Reports</h1>
      <div className="bg-white rounded border p-4">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <Link href="/dashboard/cashier-reports/sales-today" className="text-blue-600 hover:underline">
              Sales Today
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}


