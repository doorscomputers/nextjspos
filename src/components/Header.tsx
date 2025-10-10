"use client"

import { signOut } from "next-auth/react"
import { Bars3Icon, BellIcon, UserCircleIcon } from "@heroicons/react/24/outline"
import { useState } from "react"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { useRouter } from "next/navigation"

interface HeaderProps {
  toggleSidebar: () => void
}

export default function Header({ toggleSidebar }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const router = useRouter()

  return (
    <header className="bg-white dark:bg-gray-900 shadow-md z-10 border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Mobile menu button */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Right side actions */}
        <div className="flex items-center space-x-2">
          {/* Theme Switcher */}
          <ThemeSwitcher />

          {/* Notifications */}
          <button className="relative p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200">
            <BellIcon className="h-6 w-6" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900"></span>
          </button>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
            >
              <UserCircleIcon className="h-8 w-8" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={async () => {
                    if (isLoggingOut) return
                    setIsLoggingOut(true)

                    // Redirect immediately for instant logout feel
                    router.push("/login")

                    // Clean up session in background (don't wait)
                    signOut({ redirect: false }).catch(err => {
                      console.error("Signout error:", err)
                    })
                  }}
                  disabled={isLoggingOut}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 disabled:opacity-50"
                >
                  {isLoggingOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
