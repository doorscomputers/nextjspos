"use client"

import { SessionProvider } from "next-auth/react"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/ThemeProvider"
import "@/devextreme-license" // DevExtreme commercial license configuration

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <Toaster
          position="top-right"
          expand={true}
          richColors
          closeButton
          toastOptions={{
            style: {
              padding: '16px',
              fontSize: '14px',
              borderRadius: '8px',
            },
            className: 'toast-custom',
          }}
        />
        {children}
      </ThemeProvider>
    </SessionProvider>
  )
}
