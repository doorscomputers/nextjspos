'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Save } from 'lucide-react'

interface InventoryCorrection {
  id: number
  systemCount: number
  physicalCount: number
  difference: number
  reason: string
  remarks: string | null
  status: string
  product: {
    id: number
    name: string
    sku: string
  }
  productVariation: {
    id: number
    name: string
    sku: string
  }
  location: {
    id: number
    name: string
  }
}

export default function EditInventoryCorrectionPage() {
  const router = useRouter()
  const params = useParams()
  const { can } = usePermissions()
  const [correction, setCorrection] = useState<InventoryCorrection | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    physicalCount: '',
    reason: '',
    remarks: ''
  })

  const correctionId = params.id as string

  // Check permission
  if (!can(PERMISSIONS.INVENTORY_CORRECTION_UPDATE)) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">You do not have permission to edit inventory corrections.</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (correctionId) {
      fetchCorrection()
    }
  }, [correctionId])

  const fetchCorrection = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/inventory-corrections/${correctionId}`)

      if (res.ok) {
        const data = await res.json()
        const corr = data.correction

        if (corr.status !== 'pending') {
          toast.error('Cannot edit an approved inventory correction')
          router.push(`/dashboard/inventory-corrections/${correctionId}`)
          return
        }

        setCorrection(corr)
        setFormData({
          physicalCount: corr.physicalCount.toString(),
          reason: corr.reason,
          remarks: corr.remarks || ''
        })
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to fetch inventory correction')
        router.push('/dashboard/inventory-corrections')
      }
    } catch (error) {
      console.error('Error fetching correction:', error)
      toast.error('Failed to fetch inventory correction')
      router.push('/dashboard/inventory-corrections')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.physicalCount || !formData.reason) {
      toast.error('Please fill in all required fields')
      return
    }

    const physicalCount = parseFloat(formData.physicalCount)
    if (isNaN(physicalCount) || physicalCount < 0) {
      toast.error('Physical count must be a valid positive number')
      return
    }

    try {
      setSaving(true)

      const res = await fetch(`/api/inventory-corrections/${correctionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          physicalCount,
          reason: formData.reason,
          remarks: formData.remarks || null
        })
      })

      if (res.ok) {
        toast.success('Inventory correction updated successfully')
        router.push(`/dashboard/inventory-corrections/${correctionId}`)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to update inventory correction')
      }
    } catch (error) {
      console.error('Error updating correction:', error)
      toast.error('Failed to update inventory correction')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading correction...</p>
        </div>
      </div>
    )
  }

  if (!correction) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Inventory Correction Not Found</h1>
          <Button onClick={() => router.push('/dashboard/inventory-corrections')} className="mt-4">
            Back to List
          </Button>
        </div>
      </div>
    )
  }

  const calculatedDifference = formData.physicalCount
    ? parseFloat(formData.physicalCount) - correction.systemCount
    : 0

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(`/dashboard/inventory-corrections/${correctionId}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Details
        </Button>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Inventory Correction</h1>
          <p className="text-gray-600 mt-1">Correction #{correction.id}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Info (Read-only) */}
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
            <CardDescription>This information cannot be changed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Product</label>
                <p className="text-gray-900 font-semibold mt-1">{correction.product.name}</p>
                <p className="text-sm text-gray-500">{correction.product.sku}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Location</label>
                <p className="text-gray-900 font-semibold mt-1">{correction.location.name}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">System Count</label>
              <p className="text-2xl font-bold text-gray-900 mt-1">{correction.systemCount}</p>
            </div>
          </CardContent>
        </Card>

        {/* Editable Fields */}
        <Card>
          <CardHeader>
            <CardTitle>Correction Details</CardTitle>
            <CardDescription>Update the physical count and reason</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Physical Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Physical Count <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formData.physicalCount}
                onChange={(e) => setFormData({ ...formData, physicalCount: e.target.value })}
                placeholder="Enter actual counted quantity"
                className="text-lg"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter the actual quantity counted during physical inventory
              </p>
            </div>

            {/* Calculated Difference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calculated Difference
              </label>
              <div className={`p-4 rounded-lg border-2 ${calculatedDifference > 0 ? 'bg-green-50 border-green-200' : calculatedDifference < 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <p className={`text-2xl font-bold ${calculatedDifference > 0 ? 'text-green-600' : calculatedDifference < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {calculatedDifference > 0 ? '+' : ''}{calculatedDifference}
                </p>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {calculatedDifference > 0 && 'Stock will be increased (surplus found)'}
                {calculatedDifference < 0 && 'Stock will be decreased (shortage detected)'}
                {calculatedDifference === 0 && 'No change to stock levels'}
              </p>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason <span className="text-red-500">*</span>
              </label>
              <Select value={formData.reason} onValueChange={(value) => setFormData({ ...formData, reason: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical_inventory_count">Physical Inventory Count</SelectItem>
                  <SelectItem value="expired">Expired Items</SelectItem>
                  <SelectItem value="damaged">Damaged Items</SelectItem>
                  <SelectItem value="missing">Missing / Lost Items</SelectItem>
                  <SelectItem value="found">Found Items</SelectItem>
                  <SelectItem value="count_error">Counting Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remarks (Optional)
              </label>
              <Textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Add any additional notes or explanations"
                rows={4}
                className="resize-none"
              />
              <p className="text-sm text-gray-500 mt-1">
                Provide additional context or explanation for this correction
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/dashboard/inventory-corrections/${correctionId}`)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
