'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Lock } from 'lucide-react'

interface PasswordConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (password: string) => Promise<void>
  title?: string
  description?: string
  actionLabel?: string
}

export function PasswordConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'Confirm Action',
  description = 'Please enter your password to confirm this action',
  actionLabel = 'Confirm'
}: PasswordConfirmDialogProps) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password) {
      setError('Password is required')
      return
    }

    try {
      setLoading(true)
      setError('')
      await onConfirm(password)
      setPassword('')
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || 'Invalid password')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setPassword('')
    setError('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-yellow-600" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Password <span className="text-red-500">*</span>
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              placeholder="Enter your password"
              className={error ? 'border-red-500' : ''}
              disabled={loading}
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !password}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Verifying...
                </>
              ) : (
                actionLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
