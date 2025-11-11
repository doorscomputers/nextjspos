"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { usePermissions } from "@/hooks/usePermissions"
import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RouteProtectionProps {
  children: React.ReactNode
  requiredMenuKey: string
  fallbackUrl?: string
}

/**
 * Route Protection Component
 *
 * Wrap your page content with this component to enforce menu permission checks.
 * Users without the required menu permission will be redirected to the dashboard.
 *
 * Example usage:
 * ```tsx
 * export default function MyPage() {
 *   return (
 *     <RouteProtection requiredMenuKey="purchases">
 *       <div>Your page content here</div>
 *     </RouteProtection>
 *   )
 * }
 * ```
 */
export function RouteProtection({
  children,
  requiredMenuKey,
  fallbackUrl = "/dashboard",
}: RouteProtectionProps) {
  const router = useRouter()
  const { user } = usePermissions()
  const [isChecking, setIsChecking] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkAccess() {
      if (!user?.id) {
        setIsChecking(false)
        return
      }

      try {
        const response = await fetch(`/api/settings/menu-permissions/user/${user.id}`)

        if (!response.ok) {
          throw new Error("Failed to check menu permissions")
        }

        const data = await response.json()
        const accessibleKeys: string[] = data.data?.accessibleMenuKeys || []

        if (accessibleKeys.includes(requiredMenuKey)) {
          setHasAccess(true)
        } else {
          console.warn(
            `[Route Protection] User ${user.username} does not have access to menu: ${requiredMenuKey}`
          )
          setError("You do not have permission to access this page")

          // Redirect after a short delay
          setTimeout(() => {
            router.push(fallbackUrl)
          }, 2000)
        }
      } catch (err) {
        console.error("[Route Protection] Error checking access:", err)
        // Fail open: allow access if check fails
        setHasAccess(true)
      } finally {
        setIsChecking(false)
      }
    }

    checkAccess()
  }, [user, requiredMenuKey, router, fallbackUrl])

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Verifying access...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Button onClick={() => router.push(fallbackUrl)}>Go to Dashboard</Button>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return null
  }

  return <>{children}</>
}

/**
 * Higher-Order Component for Route Protection
 *
 * Use this to wrap entire page components:
 *
 * ```tsx
 * const MyProtectedPage = withRouteProtection(MyPage, 'purchases')
 * export default MyProtectedPage
 * ```
 */
export function withRouteProtection<P extends object>(
  Component: React.ComponentType<P>,
  requiredMenuKey: string,
  fallbackUrl?: string
) {
  return function ProtectedComponent(props: P) {
    return (
      <RouteProtection requiredMenuKey={requiredMenuKey} fallbackUrl={fallbackUrl}>
        <Component {...props} />
      </RouteProtection>
    )
  }
}
