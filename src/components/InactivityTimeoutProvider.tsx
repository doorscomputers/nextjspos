"use client"

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useIdleTimer } from '@/hooks/useIdleTimer'
import { InactivityWarningModal } from '@/components/InactivityWarningModal'

interface InactivitySettings {
  enabled: boolean
  superAdminTimeout: number
  adminTimeout: number
  managerTimeout: number
  cashierTimeout: number
  defaultTimeout: number
  warningTime: number
  warningMessage: string | null
}

export function InactivityTimeoutProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [settings, setSettings] = useState<InactivitySettings | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch inactivity settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings/inactivity')
        if (response.ok) {
          const data = await response.json()
          console.log('✅ Inactivity settings loaded:', data.settings)
          setSettings(data.settings)
        } else {
          console.warn('⚠️ Using default inactivity settings (API failed)')
          // If settings don't exist or error, use defaults
          setSettings({
            enabled: true,
            superAdminTimeout: 60,
            adminTimeout: 45,
            managerTimeout: 30,
            cashierTimeout: 15,
            defaultTimeout: 30,
            warningTime: 2,
            warningMessage: null
          })
        }
      } catch (error) {
        console.error('Error fetching inactivity settings:', error)
        // Use defaults on error
        setSettings({
          enabled: true,
          superAdminTimeout: 60,
          adminTimeout: 45,
          managerTimeout: 30,
          cashierTimeout: 15,
          defaultTimeout: 30,
          warningTime: 2,
          warningMessage: null
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (status === 'authenticated') {
      fetchSettings()
    } else {
      setIsLoading(false)
    }
  }, [status])

  // Determine timeout based on user role
  const getTimeoutForUser = (): number => {
    if (!session?.user || !settings) {
      return settings?.defaultTimeout || 30
    }

    const user = session.user as any
    const roles = user.roles || []

    // Check roles in priority order
    if (roles.some((role: string) =>
      role.toLowerCase().includes('super admin') ||
      role.toLowerCase() === 'system administrator'
    )) {
      return settings.superAdminTimeout
    }

    if (roles.some((role: string) => role.toLowerCase().includes('admin'))) {
      return settings.adminTimeout
    }

    if (roles.some((role: string) => role.toLowerCase().includes('manager'))) {
      return settings.managerTimeout
    }

    if (roles.some((role: string) => role.toLowerCase().includes('cashier'))) {
      return settings.cashierTimeout
    }

    return settings.defaultTimeout
  }

  const handleIdle = () => {
    // User has been idle for too long, logout
    signOut({ callbackUrl: '/login?reason=inactivity' })
  }

  const handleWarning = () => {
    setShowWarning(true)
  }

  const handleActive = () => {
    setShowWarning(false)
  }

  const handleStayActive = () => {
    setShowWarning(false)
    reset()
  }

  const handleLogout = () => {
    signOut({ callbackUrl: '/login?reason=manual' })
  }

  const timeoutMinutes = getTimeoutForUser()
  const warningMinutes = settings?.warningTime || 2

  // Debug logging
  useEffect(() => {
    if (settings && status === 'authenticated' && !isLoading) {
      console.log('🔒 Inactivity Timeout Configuration:', {
        enabled: settings.enabled,
        userRoles: (session?.user as any)?.roles,
        timeoutMinutes,
        warningMinutes,
        timerEnabled: settings.enabled && status === 'authenticated' && !isLoading
      })
    }
  }, [settings, timeoutMinutes, warningMinutes, status, isLoading, session])

  const { isWarning, remainingTime, reset } = useIdleTimer({
    timeoutMinutes,
    warningMinutes,
    onIdle: handleIdle,
    onActive: handleActive,
    onWarning: handleWarning,
    enabled: settings?.enabled && status === 'authenticated' && !isLoading
  })

  // Don't render provider until settings are loaded
  if (isLoading || status === 'loading') {
    return <>{children}</>
  }

  // If not authenticated or settings disabled, just render children
  if (status !== 'authenticated' || !settings?.enabled) {
    return <>{children}</>
  }

  return (
    <>
      {children}
      <InactivityWarningModal
        open={showWarning && isWarning}
        onStayActive={handleStayActive}
        onLogout={handleLogout}
        remainingSeconds={remainingTime}
        customMessage={settings.warningMessage || undefined}
      />
    </>
  )
}
