"use client"

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { isSuperAdmin } from '@/lib/rbac'

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    const user = session.user as any
    if (!isSuperAdmin({ id: user.id, permissions: user.permissions || [], roles: user.roles || [] })) {
      router.push('/dashboard')
    }
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const user = session.user as any
  if (!isSuperAdmin({ id: user.id, permissions: user.permissions || [], roles: user.roles || [] })) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Super Admin Header */}
      <header className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Super Admin Panel</h1>
              <p className="text-purple-100 text-sm">Platform Management & Control</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-purple-100">{user.name}</span>
              <a href="/dashboard" className="bg-white text-purple-600 px-4 py-2 rounded-lg hover:bg-purple-50 transition-colors">
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex space-x-8">
            <a
              href="/superadmin"
              className="py-4 px-2 border-b-2 border-transparent hover:border-purple-600 text-gray-700 hover:text-purple-600 transition-colors"
            >
              Overview
            </a>
            <a
              href="/superadmin/businesses"
              className="py-4 px-2 border-b-2 border-transparent hover:border-purple-600 text-gray-700 hover:text-purple-600 transition-colors"
            >
              Businesses
            </a>
            <a
              href="/superadmin/packages"
              className="py-4 px-2 border-b-2 border-transparent hover:border-purple-600 text-gray-700 hover:text-purple-600 transition-colors"
            >
              Packages
            </a>
            <a
              href="/superadmin/subscriptions"
              className="py-4 px-2 border-b-2 border-transparent hover:border-purple-600 text-gray-700 hover:text-purple-600 transition-colors"
            >
              Subscriptions
            </a>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
