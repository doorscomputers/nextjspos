"use client"

import { signOut, useSession } from "next-auth/react"
import { Bars3Icon, BellIcon, UserCircleIcon, CheckIcon } from "@heroicons/react/24/outline"
import { useState, useEffect } from "react"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { useRouter } from "next/navigation"
import Link from "next/link"
import AnnouncementTicker from "@/components/AnnouncementTicker"

interface HeaderProps {
  toggleSidebar: () => void
}

interface Notification {
  id: number
  type: string
  title: string
  message: string
  actionUrl: string | null
  isRead: boolean
  priority: string
  createdAt: string
}

export default function Header({ toggleSidebar }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user as any

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.user-menu-container') && !target.closest('.notifications-container')) {
        setShowUserMenu(false)
        setShowNotifications(false)
      }
    }

    if (showUserMenu || showNotifications) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserMenu, showNotifications])

  // Fetch notifications
  useEffect(() => {
    fetchNotifications()
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchNotifications() {
    try {
      const response = await fetch('/api/notifications?limit=10')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  async function markAsRead(notificationId: number) {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/mark-read`, {
        method: 'PUT'
      })
      if (response.ok) {
        fetchNotifications()
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  async function markAllAsRead() {
    try {
      setLoading(true)
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT'
      })
      if (response.ok) {
        fetchNotifications()
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      markAsRead(notification.id)
    }
    if (notification.actionUrl) {
      setShowNotifications(false)
      router.push(notification.actionUrl)
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'urgent': return 'text-red-600 dark:text-red-400'
      case 'high': return 'text-orange-600 dark:text-orange-400'
      case 'low': return 'text-gray-500 dark:text-gray-400'
      default: return 'text-blue-600 dark:text-blue-400'
    }
  }

  function getTimeAgo(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  return (
    <header className="bg-white dark:bg-gray-900 shadow-md z-40 relative border-b border-gray-200 dark:border-gray-800 print:hidden">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8 gap-4">
        {/* Left side: Mobile menu + Announcement Ticker */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Mobile menu button */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          {/* Announcement Ticker */}
          <AnnouncementTicker />
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          {/* Theme Switcher */}
          <ThemeSwitcher />

          {/* Notifications */}
          <div className="relative notifications-container">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
            >
              <BellIcon className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-900">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="fixed right-20 top-16 w-96 max-h-[500px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                        ({unreadCount} new)
                      </span>
                    )}
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      disabled={loading}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium disabled:opacity-50"
                    >
                      <CheckIcon className="h-5 w-5 inline mr-1" />
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Notification List */}
                <div className="overflow-y-auto max-h-[400px]">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                      <BellIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No notifications</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200 ${
                          !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`font-semibold text-sm ${getPriorityColor(notification.priority)}`}>
                                {notification.title}
                              </p>
                              {!notification.isRead && (
                                <span className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              {notification.message}
                            </p>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                            {getTimeAgo(notification.createdAt)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <button
                      onClick={() => {
                        setShowNotifications(false)
                        router.push('/dashboard/notifications')
                      }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                    >
                      View all notifications →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative user-menu-container">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
            >
              <UserCircleIcon className="h-8 w-8" />
            </button>

            {showUserMenu && (
              <div className="fixed right-4 top-16 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                {/* User Info Header */}
                <div className="px-4 py-3 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <UserCircleIcon className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {user?.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        @{user?.username}
                      </p>
                    </div>
                  </div>

                  {/* User Roles */}
                  {user?.roles && user.roles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {user.roles.map((role: string, index: number) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                  >
                    <UserCircleIcon className="h-5 w-5 mr-3 text-gray-500 dark:text-gray-400" />
                    My Details
                  </Link>

                  <button
                    onClick={async () => {
                      if (isLoggingOut) return
                      setIsLoggingOut(true)

                      try {
                        // Log logout activity before signing out
                        await fetch('/api/auth/logout', {
                          method: 'POST',
                        }).catch(err => {
                          console.error("Failed to log logout:", err)
                          // Continue with logout even if audit logging fails
                        })

                        // Sign out
                        await signOut({ redirect: false })

                        // Redirect to login
                        router.push("/login")
                      } catch (err) {
                        console.error("Logout error:", err)
                        // Redirect anyway
                        router.push("/login")
                      } finally {
                        setIsLoggingOut(false)
                      }
                    }}
                    disabled={isLoggingOut}
                    className="flex items-center w-full text-left px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 disabled:opacity-50 border-t border-gray-200 dark:border-gray-700"
                  >
                    <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {isLoggingOut ? "Signing out..." : "Sign out"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
