"use client"

import { SessionProvider } from "next-auth/react"
import { useState } from "react"
import Sidebar from "@/components/Sidebar"
import Header from "@/components/Header"
import { redirect } from "next/navigation"
import { useSession } from "next-auth/react"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    redirect("/login")
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-gray-900">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} />

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-transparent via-white/30 to-transparent dark:from-transparent dark:via-gray-900/30 dark:to-transparent pattern-bg">
          <div className="page-enter">
            {children}
          </div>
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster />
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider defaultTheme="light" defaultMode="light" defaultSidebarStyle="default">
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
      </ThemeProvider>
    </SessionProvider>
  )
}
