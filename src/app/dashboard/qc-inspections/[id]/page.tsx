'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeftIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

interface QCItem {
  id: number
  purchaseReceiptItemId: number
  productId: number
  productVariationId: number
  product: {
    name: string
    sku: string
  }
  productVariation: {
    name: string
  }
  quantityOrdered: number
  quantityReceived: number
  quantityInspected: number
  quantityPassed: number
  quantityFailed: number
  inspectionResult: string
  defectType: string | null
  defectDescription: string | null
  defectSeverity: string | null
  actionTaken: string | null
  notes: string | null
}

interface QCCheckItem {
  id?: number
  checkName: string
  checkCategory: string
  checkResult: string
  checkValue: string | null
  expectedValue: string | null
  isCritical: boolean
  notes: string | null
}

interface QCInspection {
  id: number
  inspectionNumber: string
  inspectionDate: string
  status: string
  overallResult: string | null
  inspectorNotes: string | null
  purchaseReceipt: {
    grnNumber: string
    receiptDate: string
    purchase: {
      purchaseOrderNumber: string
      supplier: {
        name: string
      }
    }
  }
  items: QCItem[]
  checkItems: QCCheckItem[]
}

export default function QCInspectionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { can } = usePermissions()
  const inspectionId = params?.id as string

  const [inspection, setInspection] = useState<QCInspection | null>(null)
  const [loading, setLoading] = useState(true)
  const [conducting, setConducting] = useState(false)
  const [approving, setApproving] = useState(false)

  // Form state
  const [items, setItems] = useState<QCItem[]>([])
  const [checkItems, setCheckItems] = useState<QCCheckItem[]>([])
  const [inspectorNotes, setInspectorNotes] = useState('')
  const [overallResult, setOverallResult] = useState<string>('passed')
  const [approvalNotes, setApprovalNotes] = useState('')

  useEffect(() => {
    if (inspectionId) {
      fetchInspection()
    }
  }, [inspectionId])

  const fetchInspection = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/qc-inspections/${inspectionId}`)
      if (!res.ok) throw new Error('Failed to fetch inspection')

      const data = await res.json()
      setInspection(data.data)
      setItems(data.data.items)
      setCheckItems(data.data.checkItems.length > 0 ? data.data.checkItems : getDefaultCheckItems())
      setInspectorNotes(data.data.inspectorNotes || '')
      setOverallResult(data.data.overallResult || 'passed')
    } catch (error: any) {
      console.error('Error fetching inspection:', error)
      toast.error('Failed to load QC inspection')
    } finally {
      setLoading(false)
    }
  }

  const getDefaultCheckItems = (): QCCheckItem[] => {
    return [
      // Packaging checks
      { checkName: 'Packaging Integrity', checkCategory: 'Packaging', checkResult: 'pass', checkValue: null, expectedValue: 'Intact', isCritical: true, notes: null },
      { checkName: 'Proper Sealing', checkCategory: 'Packaging', checkResult: 'pass', checkValue: null, expectedValue: 'Sealed', isCritical: false, notes: null },
      { checkName: 'Damage Check', checkCategory: 'Packaging', checkResult: 'pass', checkValue: null, expectedValue: 'No damage', isCritical: true, notes: null },

      // Labeling checks
      { checkName: 'Product Labels Present', checkCategory: 'Labeling', checkResult: 'pass', checkValue: null, expectedValue: 'Present', isCritical: true, notes: null },
      { checkName: 'Batch/Lot Number', checkCategory: 'Labeling', checkResult: 'pass', checkValue: null, expectedValue: 'Present', isCritical: true, notes: null },
      { checkName: 'Manufacturing Date', checkCategory: 'Labeling', checkResult: 'pass', checkValue: null, expectedValue: 'Present', isCritical: false, notes: null },

      // Physical condition
      { checkName: 'Color/Appearance', checkCategory: 'Physical Condition', checkResult: 'pass', checkValue: null, expectedValue: 'Normal', isCritical: false, notes: null },
      { checkName: 'Odor Check', checkCategory: 'Physical Condition', checkResult: 'pass', checkValue: null, expectedValue: 'Normal', isCritical: false, notes: null },
      { checkName: 'Temperature Check', checkCategory: 'Physical Condition', checkResult: 'pass', checkValue: null, expectedValue: 'Acceptable', isCritical: true, notes: null },

      // Documentation
      { checkName: 'Certificate of Analysis', checkCategory: 'Documentation', checkResult: 'pass', checkValue: null, expectedValue: 'Present', isCritical: false, notes: null },
      { checkName: 'Material Safety Data Sheet', checkCategory: 'Documentation', checkResult: 'pass', checkValue: null, expectedValue: 'Present', isCritical: false, notes: null },
    ]
  }

  const updateItemField = (itemId: number, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const updated = { ...item, [field]: value }

        // Auto-calculate if inspected quantity changes
        if (field === 'quantityInspected') {
          const inspected = parseFloat(value) || 0
          // Set passed = inspected by default, user can adjust
          updated.quantityPassed = inspected
          updated.quantityFailed = 0
        }

        // Recalculate failed quantity
        if (field === 'quantityPassed' || field === 'quantityInspected') {
          const inspected = parseFloat(updated.quantityInspected) || 0
          const passed = parseFloat(updated.quantityPassed) || 0
          updated.quantityFailed = Math.max(0, inspected - passed)
        }

        return updated
      }
      return item
    }))
  }

  const updateCheckItem = (index: number, field: string, value: any) => {
    setCheckItems(checkItems.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  const addCheckItem = () => {
    setCheckItems([
      ...checkItems,
      {
        checkName: '',
        checkCategory: 'Other',
        checkResult: 'pass',
        checkValue: null,
        expectedValue: null,
        isCritical: false,
        notes: null,
      }
    ])
  }

  const removeCheckItem = (index: number) => {
    setCheckItems(checkItems.filter((_, i) => i !== index))
  }

  const handleConduct = async () => {
    // Validation
    for (const item of items) {
      if (parseFloat(String(item.quantityInspected)) <= 0) {
        toast.error(`Please inspect all items. Item ${item.product.name} has no quantity inspected.`)
        return
      }

      if (!item.inspectionResult || item.inspectionResult === 'pending') {
        toast.error(`Please set inspection result for ${item.product.name}`)
        return
      }
    }

    for (const checkItem of checkItems) {
      if (!checkItem.checkName || !checkItem.checkCategory) {
        toast.error('Please fill in all check item names and categories')
        return
      }
    }

    setConducting(true)
    try {
      const res = await fetch(`/api/qc-inspections/${inspectionId}/conduct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            id: item.id,
            quantityInspected: item.quantityInspected,
            quantityPassed: item.quantityPassed,
            quantityFailed: item.quantityFailed,
            inspectionResult: item.inspectionResult,
            defectType: item.defectType || null,
            defectDescription: item.defectDescription || null,
            defectSeverity: item.defectSeverity || null,
            actionTaken: item.actionTaken || null,
            notes: item.notes || null,
          })),
          checkItems: checkItems.map(item => ({
            checkName: item.checkName,
            checkCategory: item.checkCategory,
            checkResult: item.checkResult,
            checkValue: item.checkValue || null,
            expectedValue: item.expectedValue || null,
            isCritical: item.isCritical,
            notes: item.notes || null,
          })),
          inspectorNotes,
          overallResult,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to conduct inspection')
      }

      toast.success('QC inspection conducted successfully')
      fetchInspection()
    } catch (error: any) {
      console.error('Error conducting inspection:', error)
      toast.error(error.message || 'Failed to conduct inspection')
    } finally {
      setConducting(false)
    }
  }

  const handleApprove = async () => {
    setApproving(true)
    try {
      const res = await fetch(`/api/qc-inspections/${inspectionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to approve inspection')
      }

      toast.success('QC inspection approved successfully')
      fetchInspection()
    } catch (error: any) {
      console.error('Error approving inspection:', error)
      toast.error(error.message || 'Failed to approve inspection')
    } finally {
      setApproving(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">Pending</Badge>
      case 'inspected':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Inspected</Badge>
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Approved</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-gray-500">Loading QC inspection...</div>
      </div>
    )
  }

  if (!inspection) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">QC inspection not found</p>
        </div>
      </div>
    )
  }

  if (!can(PERMISSIONS.QC_INSPECTION_VIEW)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            You do not have permission to view QC inspections.
          </p>
        </div>
      </div>
    )
  }

  const canConduct = can(PERMISSIONS.QC_INSPECTION_CONDUCT) && inspection.status === 'pending'
  const canApprove = can(PERMISSIONS.QC_INSPECTION_APPROVE) && inspection.status === 'inspected'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ClipboardDocumentCheckIcon className="w-8 h-8" />
              QC Inspection {inspection.inspectionNumber}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              GRN: {inspection.purchaseReceipt.grnNumber} | PO: {inspection.purchaseReceipt.purchase.purchaseOrderNumber}
            </p>
          </div>
        </div>
        <div>
          {getStatusBadge(inspection.status)}
        </div>
      </div>

      {/* Inspection Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Inspection Information</h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Inspection Date</p>
            <p className="text-gray-900 dark:text-white font-medium">
              {new Date(inspection.inspectionDate).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Supplier</p>
            <p className="text-gray-900 dark:text-white font-medium">
              {inspection.purchaseReceipt.purchase.supplier.name}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Receipt Date</p>
            <p className="text-gray-900 dark:text-white font-medium">
              {new Date(inspection.purchaseReceipt.receiptDate).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Item Inspection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Item Inspection</h2>
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{item.product.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    SKU: {item.product.sku} | Variation: {item.productVariation.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Ordered: {item.quantityOrdered} | Received: {item.quantityReceived}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label className="text-gray-900 dark:text-white">Qty Inspected *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.quantityInspected}
                    onChange={(e) => updateItemField(item.id, 'quantityInspected', e.target.value)}
                    disabled={!canConduct}
                    className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                  />
                </div>
                <div>
                  <Label className="text-gray-900 dark:text-white">Qty Passed</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.quantityPassed}
                    onChange={(e) => updateItemField(item.id, 'quantityPassed', e.target.value)}
                    disabled={!canConduct}
                    className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                  />
                </div>
                <div>
                  <Label className="text-gray-900 dark:text-white">Qty Failed</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.quantityFailed}
                    disabled
                    className="bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                  />
                </div>
                <div>
                  <Label className="text-gray-900 dark:text-white">Result *</Label>
                  <Select
                    value={item.inspectionResult}
                    onValueChange={(value) => updateItemField(item.id, 'inspectionResult', value)}
                    disabled={!canConduct}
                  >
                    <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                      <SelectItem value="pending" className="text-gray-900 dark:text-white">Pending</SelectItem>
                      <SelectItem value="passed" className="text-gray-900 dark:text-white">Passed</SelectItem>
                      <SelectItem value="failed" className="text-gray-900 dark:text-white">Failed</SelectItem>
                      <SelectItem value="conditional" className="text-gray-900 dark:text-white">Conditional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {item.inspectionResult !== 'passed' && canConduct && (
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <Label className="text-gray-900 dark:text-white">Defect Type</Label>
                    <Input
                      type="text"
                      value={item.defectType || ''}
                      onChange={(e) => updateItemField(item.id, 'defectType', e.target.value)}
                      placeholder="e.g., Damaged, Expired, Wrong item"
                      className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-900 dark:text-white">Severity</Label>
                    <Select
                      value={item.defectSeverity || 'minor'}
                      onValueChange={(value) => updateItemField(item.id, 'defectSeverity', value)}
                    >
                      <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                        <SelectItem value="minor" className="text-gray-900 dark:text-white">Minor</SelectItem>
                        <SelectItem value="major" className="text-gray-900 dark:text-white">Major</SelectItem>
                        <SelectItem value="critical" className="text-gray-900 dark:text-white">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-900 dark:text-white">Action Taken</Label>
                    <Input
                      type="text"
                      value={item.actionTaken || ''}
                      onChange={(e) => updateItemField(item.id, 'actionTaken', e.target.value)}
                      placeholder="e.g., Return to supplier, Accept with discount"
                      className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4">
                <Label className="text-gray-900 dark:text-white">Notes</Label>
                <Textarea
                  value={item.notes || ''}
                  onChange={(e) => updateItemField(item.id, 'notes', e.target.value)}
                  disabled={!canConduct}
                  rows={2}
                  className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quality Checks */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quality Checklist</h2>
          {canConduct && (
            <Button onClick={addCheckItem} variant="outline" size="sm">
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Check
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {checkItems.map((checkItem, index) => (
            <div key={index} className="border border-gray-300 dark:border-gray-600 rounded p-3">
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs text-gray-900 dark:text-white">Check Name *</Label>
                  <Input
                    type="text"
                    value={checkItem.checkName}
                    onChange={(e) => updateCheckItem(index, 'checkName', e.target.value)}
                    disabled={!canConduct}
                    className="text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-900 dark:text-white">Category *</Label>
                  <Select
                    value={checkItem.checkCategory}
                    onValueChange={(value) => updateCheckItem(index, 'checkCategory', value)}
                    disabled={!canConduct}
                  >
                    <SelectTrigger className="text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                      <SelectItem value="Packaging" className="text-gray-900 dark:text-white">Packaging</SelectItem>
                      <SelectItem value="Labeling" className="text-gray-900 dark:text-white">Labeling</SelectItem>
                      <SelectItem value="Physical Condition" className="text-gray-900 dark:text-white">Physical Condition</SelectItem>
                      <SelectItem value="Documentation" className="text-gray-900 dark:text-white">Documentation</SelectItem>
                      <SelectItem value="Quantity" className="text-gray-900 dark:text-white">Quantity</SelectItem>
                      <SelectItem value="Expiry/Date" className="text-gray-900 dark:text-white">Expiry/Date</SelectItem>
                      <SelectItem value="Other" className="text-gray-900 dark:text-white">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-900 dark:text-white">Result *</Label>
                  <Select
                    value={checkItem.checkResult}
                    onValueChange={(value) => updateCheckItem(index, 'checkResult', value)}
                    disabled={!canConduct}
                  >
                    <SelectTrigger className="text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                      <SelectItem value="pass" className="text-gray-900 dark:text-white">Pass</SelectItem>
                      <SelectItem value="fail" className="text-gray-900 dark:text-white">Fail</SelectItem>
                      <SelectItem value="na" className="text-gray-900 dark:text-white">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-gray-900 dark:text-white flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checkItem.isCritical}
                        onChange={(e) => updateCheckItem(index, 'isCritical', e.target.checked)}
                        disabled={!canConduct}
                        className="rounded"
                      />
                      Critical
                    </Label>
                    <Input
                      type="text"
                      value={checkItem.notes || ''}
                      onChange={(e) => updateCheckItem(index, 'notes', e.target.value)}
                      placeholder="Notes..."
                      disabled={!canConduct}
                      className="text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                    />
                  </div>
                  {canConduct && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeCheckItem(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <XCircleIcon className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overall Result & Notes */}
      {canConduct && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Overall Assessment</h2>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-900 dark:text-white">Overall Result</Label>
              <Select value={overallResult} onValueChange={setOverallResult}>
                <SelectTrigger className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectItem value="passed" className="text-gray-900 dark:text-white">Passed</SelectItem>
                  <SelectItem value="failed" className="text-gray-900 dark:text-white">Failed</SelectItem>
                  <SelectItem value="conditional" className="text-gray-900 dark:text-white">Conditional (Passed with Conditions)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-900 dark:text-white">Inspector Notes</Label>
              <Textarea
                value={inspectorNotes}
                onChange={(e) => setInspectorNotes(e.target.value)}
                rows={4}
                placeholder="Overall findings, recommendations, and any additional notes..."
                className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* Approval Section */}
      {canApprove && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Approval</h2>
          <div>
            <Label className="text-gray-900 dark:text-white">Approval Notes (Optional)</Label>
            <Textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              rows={3}
              placeholder="Add any approval notes or conditions..."
              className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {canConduct && (
          <Button
            onClick={handleConduct}
            disabled={conducting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <CheckCircleIcon className="w-4 h-4 mr-2" />
            {conducting ? 'Conducting...' : 'Complete Inspection'}
          </Button>
        )}

        {canApprove && (
          <Button
            onClick={handleApprove}
            disabled={approving}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircleIcon className="w-4 h-4 mr-2" />
            {approving ? 'Approving...' : 'Approve Inspection'}
          </Button>
        )}
      </div>
    </div>
  )
}
