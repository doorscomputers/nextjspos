"use client"

import { useEffect, useState } from "react"
import SalesTodayPage from "@/app/dashboard/reports/sales-today/page"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"

export default function CashierSalesTodayWrapper() {
  const { can } = usePermissions()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    // Use a permission that cashier roles already have by default
    setAllowed(can(PERMISSIONS.REPORT_SALES_TODAY))
  }, [can])

  if (!allowed) {
    return (
      <div className="p-6">
        <p className="text-red-600">You do not have permission to view Cashier Reports.</p>
      </div>
    )
  }

  // Reuse the existing Sales Today page which already enforces role-aware locations
  return <SalesTodayPage />
}


