"use client"

import { useSession } from "next-auth/react"
import { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole, Permission } from "@/lib/rbac"

export function usePermissions() {
  const { data: session } = useSession()
  const user = session?.user as any

  return {
    can: (permission: Permission) => hasPermission(user, permission),
    canAny: (permissions: Permission[]) => hasAnyPermission(user, permissions),
    canAll: (permissions: Permission[]) => hasAllPermissions(user, permissions),
    hasRole: (role: string) => hasRole(user, role),
    hasAnyRole: (roles: string[]) => hasAnyRole(user, roles),
    user,
  }
}
