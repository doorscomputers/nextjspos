import { useState, useCallback } from 'react'

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback(
    ({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).substr(2, 9)
      const newToast: Toast = { id, title, description, variant }

      setToasts((prev) => [...prev, newToast])

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 5000)

      // For now, just use window.alert as a fallback
      // In production, you'd render actual toast components
      if (variant === 'destructive') {
        window.alert(`❌ ${title || 'Error'}\n${description || ''}`)
      } else {
        window.alert(`✅ ${title || 'Success'}\n${description || ''}`)
      }
    },
    []
  )

  return {
    toast,
    toasts,
  }
}
