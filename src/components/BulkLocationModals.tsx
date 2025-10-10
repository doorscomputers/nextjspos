"use client"

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface AddToLocationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locationName: string
  productCount: number
  onConfirm: () => void
  loading: boolean
}

export function AddToLocationModal({
  open,
  onOpenChange,
  locationName,
  productCount,
  onConfirm,
  loading,
}: AddToLocationModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-gray-900">
            Add Products to Location
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-600">
            You are about to add <strong className="text-gray-900">{productCount} product(s)</strong> to{' '}
            <strong className="text-blue-600">{locationName}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">What will happen:</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Products will be added to this location with <strong>zero inventory</strong></li>
              <li>You can set opening stock after adding the products</li>
              <li>Products already at this location will be skipped</li>
              <li>This action will be logged in the audit trail</li>
            </ul>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} className="bg-white text-gray-700 hover:bg-gray-50">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {loading ? 'Adding...' : 'Add to Location'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface RemoveFromLocationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locationName: string
  productCount: number
  onConfirm: (password: string) => void
  loading: boolean
}

export function RemoveFromLocationModal({
  open,
  onOpenChange,
  locationName,
  productCount,
  onConfirm,
  loading,
}: RemoveFromLocationModalProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleConfirm = () => {
    if (!password.trim()) {
      setError('Password is required for this destructive operation')
      return
    }
    setError('')
    onConfirm(password)
  }

  const handleCancel = () => {
    setPassword('')
    setError('')
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <AlertDialogTitle className="text-gray-900">
                Remove Products from Location
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600">
                This is a destructive operation that requires password verification
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-900 mb-2 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5" />
              Warning: Data Loss
            </h4>
            <p className="text-sm text-red-800 mb-3">
              You are about to remove <strong>{productCount} product(s)</strong> from{' '}
              <strong>{locationName}</strong>. This will:
            </p>
            <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
              <li><strong>Delete all inventory records</strong> at this location</li>
              <li><strong>Delete all stock transaction history</strong> for these products</li>
              <li>Remove product availability from this location</li>
              <li><strong>This action cannot be undone</strong></li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-900 mb-2">Audit Trail</h4>
            <p className="text-sm text-yellow-800">
              This action will be logged with:
            </p>
            <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside mt-2">
              <li>All affected product details</li>
              <li>Inventory quantities before deletion</li>
              <li>Your username and timestamp</li>
              <li>IP address and user agent</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-900">
              Enter your password to confirm <span className="text-red-600">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              placeholder="Enter your password"
              className={`bg-white text-gray-900 ${error ? 'border-red-500' : ''}`}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirm()
                }
              }}
            />
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={loading} className="bg-white text-gray-700 hover:bg-gray-50">
            Cancel
          </AlertDialogCancel>
          <button
            onClick={handleConfirm}
            disabled={loading || !password.trim()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Removing...' : 'Confirm Removal'}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
