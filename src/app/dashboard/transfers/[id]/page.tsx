"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { toast } from 'sonner'
import { ArrowLeftIcon, CheckIcon, XMarkIcon, TruckIcon, CheckCircleIcon, ClipboardDocumentCheckIcon, ArrowDownTrayIcon, TableCellsIcon, PencilIcon, ExclamationTriangleIcon, PrinterIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface Transfer {
  id: number
  transferNumber: string
  transferDate: string
  fromLocationId: number
  toLocationId: number
  fromLocationName?: string
  toLocationName?: string
  status: string
  stockDeducted: boolean
  notes: string | null
  createdAt: string
  items: TransferItem[]
  createdBy: number | null
  checkedBy: number | null
  sentBy: number | null
  arrivedBy: number | null
  verifiedBy: number | null
  completedBy: number | null
  checkedAt: string | null
  sentAt: string | null
  arrivedAt: string | null
  verifiedAt: string | null
  completedAt: string | null
  creator?: { id: number; username: string } | null
  checker?: { id: number; username: string } | null
  sender?: { id: number; username: string } | null
  arrivalMarker?: { id: number; username: string } | null
  verifier?: { id: number; username: string } | null
  completer?: { id: number; username: string } | null
  sodSettings?: {
    enforceTransferSOD: boolean
    allowCreatorToCheck: boolean
    allowCreatorToSend: boolean
    allowCheckerToSend: boolean
    allowCreatorToReceive: boolean
    allowSenderToComplete: boolean
    allowCreatorToComplete: boolean
    allowReceiverToComplete: boolean
  }
}

interface TransferItem {
  id: number
  productId: number
  productVariationId: number
  quantity: string
  receivedQuantity: string | null
  verified: boolean
  product: {
    id: number
    name: string
    sku: string
  }
  productVariation: {
    id: number
    name: string
    sku: string | null
  }
}

export default function TransferDetailPage() {
  const { can, user } = usePermissions()
  const params = useParams()
  const router = useRouter()
  const transferId = params.id as string
  const currentUserId = parseInt(user?.id || '0')

  const [transfer, setTransfer] = useState<Transfer | null>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [userLocations, setUserLocations] = useState<any[]>([]) // User's assigned locations
  const [primaryLocationId, setPrimaryLocationId] = useState<number | null>(null) // User's primary/home location
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // For verification
  const [verifying, setVerifying] = useState(false)
  const [verificationQuantities, setVerificationQuantities] = useState<{ [key: number]: number }>({})

  // For rejection
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)

  // Confirmation dialogs for critical actions
  const [showSendConfirm, setShowSendConfirm] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showVerifyAllConfirm, setShowVerifyAllConfirm] = useState(false)
  const [itemToUnverify, setItemToUnverify] = useState<number | null>(null)

  // Inventory Impact Modal
  const [showInventoryImpact, setShowInventoryImpact] = useState(false)
  const [inventoryImpactData, setInventoryImpactData] = useState<any>(null)
  const [transferJustCompleted, setTransferJustCompleted] = useState(false)

  // Progress indicators for Send and Receive operations
  const [showSendProgress, setShowSendProgress] = useState(false)
  const [sendProgressStep, setSendProgressStep] = useState(0)
  const [showReceiveProgress, setShowReceiveProgress] = useState(false)
  const [receiveProgressStep, setReceiveProgressStep] = useState(0)

  // Job tracking for async operations
  const [sendJobId, setSendJobId] = useState<number | null>(null)
  const [sendJobProgress, setSendJobProgress] = useState(0)
  const [sendJobTotal, setSendJobTotal] = useState(0)
  const [receiveJobId, setReceiveJobId] = useState<number | null>(null)
  const [receiveJobProgress, setReceiveJobProgress] = useState(0)
  const [receiveJobTotal, setReceiveJobTotal] = useState(0)

  // Edit mode for draft transfers
  const [isEditMode, setIsEditMode] = useState(false)
  const [editItems, setEditItems] = useState<any[]>([])
  const [editLoading, setEditLoading] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    fetchLocations()
    fetchUserLocations()
    fetchTransfer()
  }, [transferId])

  // Update page title dynamically
  useEffect(() => {
    if (transfer) {
      document.title = `Transfer ${transfer.transferNumber} - PciNet Computer Trading and Services`
    }
    return () => {
      document.title = 'PciNet Computer Trading and Services'
    }
  }, [transfer])

  // Prevent browser close during critical operations
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (showSendProgress || showReceiveProgress) {
        e.preventDefault()
        e.returnValue = 'Inventory update in progress! Are you sure you want to leave?'
        return 'Inventory update in progress! Are you sure you want to leave?'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [showSendProgress, showReceiveProgress])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      if (response.ok) {
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchUserLocations = async () => {
    try {
      const response = await fetch('/api/user-locations')
      const data = await response.json()
      if (response.ok) {
        setUserLocations(data.locations || [])
        // CRITICAL: Set primary location for workflow operations
        if (data.primaryLocationId) {
          setPrimaryLocationId(data.primaryLocationId)
        }
      }
    } catch (error) {
      console.error('Error fetching user locations:', error)
    }
  }

  const fetchTransfer = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/transfers/${transferId}`)
      const data = await response.json()

      if (response.ok) {
        setTransfer(data)

        // Initialize verification quantities
        const quantities: { [key: number]: number } = {}
        data.items?.forEach((item: TransferItem) => {
          quantities[item.id] = parseFloat(item.quantity)
        })
        setVerificationQuantities(quantities)
      } else {
        toast.error(data.error || 'Failed to fetch transfer')
      }
    } catch (error) {
      console.error('Error fetching transfer:', error)
      toast.error('Failed to fetch transfer')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (endpoint: string, successMessage: string, data?: any) => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/transfers/${transferId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {})
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(successMessage)

        // OPTIMIZED: Inventory Impact disabled - always redirect for major actions
        const redirectActions = ['submit-for-check', 'check-approve', 'check-reject', 'send', 'complete']

        if (redirectActions.includes(endpoint)) {
          // Mark if transfer was just completed (for cleanup)
          if (endpoint === 'complete') {
            setTransferJustCompleted(true)
          }

          setTimeout(() => {
            router.push('/dashboard/transfers')
          }, 1000) // Short delay to show success message
        } else {
          fetchTransfer()
        }
      } else {
        // CRITICAL FIX: For send/complete operations, verify if it actually succeeded
        // Even if API returns error, the transaction might have completed
        if (endpoint === 'send' || endpoint === 'complete') {
          console.log(`${endpoint} returned error, verifying if operation actually succeeded...`)

          // Wait 2 seconds for transaction to fully commit
          await new Promise(resolve => setTimeout(resolve, 2000))

          // Refetch transfer to check actual status
          try {
            const verifyResponse = await fetch(`/api/transfers/${transferId}`)
            if (verifyResponse.ok) {
              const verifyData = await verifyResponse.json()
              const expectedStatus = endpoint === 'send' ? 'in_transit' : 'completed'

              if (verifyData.status === expectedStatus) {
                // SUCCESS! Transaction actually worked despite error response
                console.log(`✅ ${endpoint} verification: Status is ${verifyData.status} - operation succeeded!`)
                toast.success(successMessage + ' (verified)', { duration: 3000 })

                if (endpoint === 'complete') {
                  setTransferJustCompleted(true)
                }

                setTimeout(() => {
                  router.push('/dashboard/transfers')
                }, 1000)
                return // Exit early - operation succeeded
              } else {
                console.log(`❌ ${endpoint} verification: Status is ${verifyData.status}, expected ${expectedStatus}`)
              }
            }
          } catch (verifyError) {
            console.error('Verification check failed:', verifyError)
          }
        }

        // Show error only if verification failed or not applicable
        const errorMessage = result.error || result.details || `Failed to ${successMessage.toLowerCase()}`
        toast.error(errorMessage)

        // Log detailed error for debugging
        console.error(`API Error (${endpoint}):`, {
          status: response.status,
          statusText: response.statusText,
          error: result.error,
          details: result.details,
          code: result.code
        })
      }
    } catch (error) {
      console.error(`Error with ${endpoint}:`, error)
      toast.error(`Failed to ${successMessage.toLowerCase()}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSubmitForCheck = () => {
    handleAction('submit-for-check', 'Transfer submitted for checking')
  }

  // Edit Mode Handlers for Draft Transfers
  const handleEnterEditMode = () => {
    if (!transfer) return
    // Copy current items to edit state with stock info
    const itemsCopy = transfer.items.map(item => ({
      productId: item.productId,
      productVariationId: item.productVariationId,
      quantity: parseFloat(item.quantity),
      product: item.product,
      productVariation: item.productVariation,
    }))
    setEditItems(itemsCopy)
    setIsEditMode(true)
  }

  const handleExitEditMode = () => {
    setIsEditMode(false)
    setEditItems([])
    setShowAddItemDialog(false)
    setProductSearch('')
    setSearchResults([])
  }

  const handleEditQuantityChange = (index: number, newQuantity: number) => {
    const updated = [...editItems]
    updated[index].quantity = Math.max(1, newQuantity)
    setEditItems(updated)
  }

  const handleRemoveEditItem = (index: number) => {
    if (editItems.length <= 1) {
      toast.error('Transfer must have at least one item')
      return
    }
    const updated = editItems.filter((_, i) => i !== index)
    setEditItems(updated)
  }

  const handleSearchProducts = async (query: string) => {
    if (!transfer || query.length < 2) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(query)}&locationId=${transfer.fromLocationId}&includeStock=true`)
      if (res.ok) {
        const data = await res.json()
        // Filter out products already in edit items
        const existingVariationIds = editItems.map(item => item.productVariationId)
        const filtered = (data.products || data || []).filter((p: any) =>
          p.variations?.some((v: any) => !existingVariationIds.includes(v.id) && (v.stockAtLocation || 0) > 0)
        )
        setSearchResults(filtered)
      }
    } catch (error) {
      console.error('Error searching products:', error)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleAddEditItem = (product: any, variation: any) => {
    // Check if already added
    if (editItems.some(item => item.productVariationId === variation.id)) {
      toast.error('This item is already in the transfer')
      return
    }
    const newItem = {
      productId: product.id,
      productVariationId: variation.id,
      quantity: 1,
      product: { id: product.id, name: product.name, sku: product.sku },
      productVariation: { id: variation.id, name: variation.name, sku: variation.sku },
      availableStock: variation.stockAtLocation || 0,
    }
    setEditItems([...editItems, newItem])
    setShowAddItemDialog(false)
    setProductSearch('')
    setSearchResults([])
    toast.success(`Added ${product.name} - ${variation.name}`)
  }

  const handleSaveEditItems = async () => {
    if (editItems.length === 0) {
      toast.error('Transfer must have at least one item')
      return
    }
    setEditLoading(true)
    try {
      const res = await fetch(`/api/transfers/${transferId}/update-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: editItems.map(item => ({
            productId: item.productId,
            productVariationId: item.productVariationId,
            quantity: item.quantity,
          })),
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Transfer items updated successfully')
        handleExitEditMode()
        fetchTransfer() // Refresh transfer data
      } else {
        toast.error(data.error || 'Failed to update items')
        if (data.details) {
          data.details.forEach((msg: string) => toast.error(msg))
        }
      }
    } catch (error: any) {
      console.error('Error saving edit items:', error)
      toast.error('Failed to save changes')
    } finally {
      setEditLoading(false)
    }
  }

  const handleApprove = () => {
    handleAction('check-approve', 'Transfer approved')
  }

  const handleRejectClick = () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    setShowRejectConfirm(true)
  }

  const handleRejectConfirmed = async () => {
    setShowRejectConfirm(false)
    setShowRejectDialog(false)
    await handleAction('check-reject', 'Transfer rejected', { reason: rejectionReason })
    setRejectionReason('')
  }

  const handleSendClick = () => {
    setShowSendConfirm(true)
  }

  const handleSendConfirmed = async () => {
    setShowSendConfirm(false)
    setShowSendProgress(true)
    setSendProgressStep(1) // Step 1: Creating job
    setSendJobProgress(0)
    setSendJobTotal(transfer?.items.length || 0)

    try {
      // Step 1: Create async job
      const response = await fetch(`/api/transfers/${transferId}/send-async`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create send job')
      }

      const { jobId, itemCount } = await response.json()
      setSendJobId(jobId)
      setSendJobTotal(itemCount)
      setSendProgressStep(2) // Step 2: Processing

      console.log(`✅ Send job created: ${jobId} for ${itemCount} items`)

      // Step 2: Poll for job status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/jobs/${jobId}`)
          if (!statusRes.ok) {
            clearInterval(pollInterval)
            throw new Error('Failed to fetch job status')
          }

          const job = await statusRes.json()
          setSendJobProgress(job.progress)
          setSendJobTotal(job.total)

          console.log(`Job ${jobId} progress: ${job.progress}/${job.total} (${job.progressPercent}%)`)

          if (job.status === 'completed') {
            clearInterval(pollInterval)
            setSendProgressStep(3) // Step 3: Complete
            toast.success('Transfer sent successfully - stock deducted!')

            // Wait a moment to show completion
            await new Promise(resolve => setTimeout(resolve, 1000))
            setShowSendProgress(false)

            // Redirect to transfers list
            setTimeout(() => {
              router.push('/dashboard/transfers')
            }, 500)
          } else if (job.status === 'failed') {
            clearInterval(pollInterval)
            setShowSendProgress(false)
            toast.error(`Transfer send failed: ${job.error || 'Unknown error'}`)
          }
        } catch (pollError) {
          clearInterval(pollInterval)
          setShowSendProgress(false)
          console.error('Error polling job status:', pollError)
          toast.error('Lost connection to background job')
        }
      }, 1000) // Poll every second

    } catch (error: any) {
      setShowSendProgress(false)
      console.error('Error creating send job:', error)
      toast.error(error.message || 'Failed to send transfer')
    }
  }

  const handleReceiveTransfer = () => {
    setShowCompleteConfirm(true)
  }

  const handleMarkArrived = () => {
    handleAction('mark-arrived', 'Transfer marked as arrived')
  }

  const handleStartVerification = () => {
    handleAction('start-verification', 'Verification started')
  }

  const handleVerifyAllClick = () => {
    // Count unverified items
    const unverifiedCount = transfer?.items.filter(item => !item.verified).length || 0

    if (unverifiedCount === 0) {
      toast.info('All items are already verified')
      return
    }

    setShowVerifyAllConfirm(true)
  }

  const handleVerifyAllConfirmed = async () => {
    setShowVerifyAllConfirm(false)
    await handleAction('verify-all', 'All items verified - transfer ready to complete')
  }

  const handleVerifyItem = async (itemId: number) => {
    const quantity = verificationQuantities[itemId]
    if (!quantity || quantity <= 0) {
      toast.error('Please enter a valid received quantity')
      return
    }

    await handleAction('verify-item', 'Item verified', {
      itemId,
      receivedQuantity: quantity
    })
  }

  const handleUnverifyItemClick = (itemId: number) => {
    setItemToUnverify(itemId)
  }

  const handleUnverifyItemConfirmed = async () => {
    if (itemToUnverify) {
      await handleAction('unverify-item', 'Item unverified - you can now edit', {
        itemId: itemToUnverify
      })
    }
    setItemToUnverify(null)
  }

  const handleCompleteClick = () => {
    setShowCompleteConfirm(true)
  }

  const handleCompleteConfirmed = async () => {
    setShowCompleteConfirm(false)
    setShowReceiveProgress(true)
    setReceiveProgressStep(1) // Single step: Auto-verify and add stock
    setReceiveJobProgress(0)
    setReceiveJobTotal(transfer?.items.length || 0)

    try {
      // OPTIMIZED: Create async job for completing (auto-verification happens in the job)
      // This eliminates 1-2 minutes of sequential verification API calls
      console.log('Creating async job for transfer completion (with auto-verification)...')

      const response = await fetch(`/api/transfers/${transferId}/complete-async`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create complete job')
      }

      const { jobId, itemCount } = await response.json()
      setReceiveJobId(jobId)
      setReceiveJobTotal(itemCount)

      console.log(`✅ Receive job created: ${jobId} for ${itemCount} items (includes auto-verification)`)

      // Step 2: Poll for job status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/jobs/${jobId}`)
          if (!statusRes.ok) {
            clearInterval(pollInterval)
            throw new Error('Failed to fetch job status')
          }

          const job = await statusRes.json()
          setReceiveJobProgress(job.progress)
          setReceiveJobTotal(job.total)

          console.log(`Job ${jobId} progress: ${job.progress}/${job.total} (${job.progressPercent}%)`)

          if (job.status === 'completed') {
            clearInterval(pollInterval)
            setReceiveProgressStep(3) // Step 3: Complete
            toast.success('Transfer completed successfully - stock added to destination!')

            // Wait a moment to show completion
            await new Promise(resolve => setTimeout(resolve, 1000))
            setShowReceiveProgress(false)

            // Redirect to transfers list
            setTimeout(() => {
              router.push('/dashboard/transfers')
            }, 500)
          } else if (job.status === 'failed') {
            clearInterval(pollInterval)
            setShowReceiveProgress(false)
            toast.error(`Transfer complete failed: ${job.error || 'Unknown error'}`)
          }
        } catch (pollError) {
          clearInterval(pollInterval)
          setShowReceiveProgress(false)
          console.error('Error polling job status:', pollError)
          toast.error('Lost connection to background job')
        }
      }, 1000) // Poll every second

    } catch (error: any) {
      setShowReceiveProgress(false)
      console.error('Error creating complete job:', error)
      toast.error(error.message || 'Failed to complete transfer')
    }
  }

  const handleCloseInventoryImpact = () => {
    setShowInventoryImpact(false)

    // If transfer was just completed, redirect to transfers list
    if (transferJustCompleted) {
      router.push('/dashboard/transfers')
    }
  }

  const handleQuickReceive = async () => {
    if (!confirm('Receive this transfer? All items will be accepted with sent quantities and stock will be added to destination location.')) return

    try {
      setActionLoading(true)

      // Build items array with all transfer items using sent quantities
      const receiveItems = transfer.items.map(item => {
        // Parse serial numbers from JSON field
        const serialNumbersSent = item.serialNumbersSent
          ? (Array.isArray(item.serialNumbersSent)
            ? item.serialNumbersSent
            : JSON.parse(item.serialNumbersSent as string))
          : []

        return {
          transferItemId: item.id,
          quantityReceived: parseFloat(item.quantity?.toString() || '0'),
          serialNumberIds: serialNumbersSent // Array of serial number IDs
        }
      })

      console.log('🔍 Quick Receive - Payload:', {
        receivedDate: new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString(), // Manila is UTC+8
        items: receiveItems,
        notes: 'Quick receive - all items accepted'
      })

      const response = await fetch(`/api/transfers/${transferId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedDate: new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString(), // Manila is UTC+8
          items: receiveItems,
          notes: 'Quick receive - all items accepted'
        })
      })

      const data = await response.json()
      console.log('📡 API Response:', response.status, data)

      if (response.ok) {
        toast.success('Transfer received - stock added to destination location')
        router.refresh() // This reloads the page data from server
        window.location.reload() // Force full page reload to show updated transfer
      } else {
        console.error('❌ API Error:', data)
        toast.error(data.error || data.details || 'Failed to receive transfer')
      }
    } catch (error) {
      console.error('❌ Exception:', error)
      toast.error('Failed to receive transfer')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelClick = () => {
    setShowCancelConfirm(true)
  }

  const handleCancelConfirmed = async () => {
    setShowCancelConfirm(false)

    try {
      setActionLoading(true)
      const response = await fetch(`/api/transfers/${transferId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Transfer cancelled')
        router.push('/dashboard/transfers')
      } else {
        toast.error(data.error || 'Failed to cancel transfer')
      }
    } catch (error) {
      console.error('Error cancelling transfer:', error)
      toast.error('Failed to cancel transfer')
    } finally {
      setActionLoading(false)
    }
  }

  const handleExportExcel = () => {
    try {
      if (!transfer) return

      // Create CSV content (Excel compatible)
      let csv = 'Stock Transfer Report\n\n'
      csv += `Transfer Number:,${transfer.transferNumber}\n`
      csv += `From Location:,${getLocationName(transfer.fromLocationId)}\n`
      csv += `To Location:,${getLocationName(transfer.toLocationId)}\n`
      csv += `Transfer Date:,${new Date(transfer.transferDate).toLocaleDateString()}\n`
      csv += `Status:,${transfer.status}\n`
      csv += `Created At:,${new Date(transfer.createdAt).toLocaleString()}\n`
      if (transfer.notes) {
        csv += `Notes:,${transfer.notes}\n`
      }
      csv += '\n'
      csv += 'Product Name,Variation,SKU,Quantity,Received,Verified\n'

      transfer.items.forEach(item => {
        csv += `"${item.product.name}","${item.productVariation.name}","${item.productVariation.sku || ''}",${item.quantity},${item.receivedQuantity || 'N/A'},${item.verified ? 'Yes' : 'No'}\n`
      })

      // Create download link
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `transfer_${transfer.transferNumber}_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Excel file downloaded successfully')
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      toast.error('Failed to export to Excel')
    }
  }

  const getLocationName = (locationId: number) => {
    // Prefer location name from transfer API response
    if (transfer) {
      if (locationId === transfer.fromLocationId && transfer.fromLocationName) {
        return transfer.fromLocationName
      }
      if (locationId === transfer.toLocationId && transfer.toLocationName) {
        return transfer.toLocationName
      }
    }
    // Fallback to user's location list
    const location = locations.find(loc => loc.id === locationId)
    return location?.name || `Location ${locationId}`
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { bgColor: string, textColor: string, label: string } } = {
      'draft': {
        bgColor: 'bg-slate-100',
        textColor: 'text-slate-700',
        label: 'Draft'
      },
      'pending_check': {
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        label: 'Pending Check'
      },
      'checked': {
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        label: 'Checked'
      },
      'in_transit': {
        bgColor: 'bg-purple-100',
        textColor: 'text-purple-800',
        label: 'In Transit'
      },
      'arrived': {
        bgColor: 'bg-indigo-100',
        textColor: 'text-indigo-800',
        label: 'Arrived'
      },
      'verifying': {
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        label: 'Verifying'
      },
      'verified': {
        bgColor: 'bg-cyan-100',
        textColor: 'text-cyan-800',
        label: 'Verified'
      },
      'completed': {
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        label: 'Completed'
      },
      'cancelled': {
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        label: 'Cancelled'
      },
    }

    const config = statusConfig[status] || {
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800',
      label: status
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
        {config.label}
      </span>
    )
  }

  // Helper: Check if user is at FROM location (sender)
  const isUserAtFromLocation = () => {
    return primaryLocationId === transfer?.fromLocationId || can(PERMISSIONS.ACCESS_ALL_LOCATIONS)
  }

  // Helper: Check if user is at TO location (receiver)
  const isUserAtToLocation = () => {
    return primaryLocationId === transfer?.toLocationId || can(PERMISSIONS.ACCESS_ALL_LOCATIONS)
  }

  // Helper: Get location-aware status display text
  const getLocationAwareStatusText = () => {
    if (!transfer) return transfer?.status || ''

    const status = transfer.status

    // "In Transit" status - show different text based on location
    if (status === 'in_transit') {
      if (isUserAtFromLocation()) {
        return 'In Transit (Stock Deducted)'
      } else if (isUserAtToLocation()) {
        return 'In Transit'
      }
      return 'In Transit'
    }

    // "Completed" status - show different text based on location
    if (status === 'completed') {
      if (isUserAtFromLocation()) {
        return 'Completed (Stock Deducted)'
      } else if (isUserAtToLocation()) {
        return 'Completed (Stock Added)'
      }
      return 'Completed'
    }

    // All other statuses - return standard text
    return status === 'draft' ? 'Draft' :
      status === 'pending_check' ? 'Pending Check' :
        status === 'checked' ? 'Checked' :
          status === 'arrived' ? 'Arrived' :
            status === 'verifying' ? 'Verifying' :
              status === 'verified' ? 'Verified' :
                status === 'cancelled' ? 'Cancelled' :
                  status.toUpperCase()
  }

  // Helper: Get location-aware stock status message
  const getLocationAwareStockMessage = () => {
    if (!transfer) return ''

    if (transfer.stockDeducted) {
      if (isUserAtFromLocation()) {
        return 'Stock has been deducted from your location'
      } else if (isUserAtToLocation()) {
        return 'Stock has been deducted from origin (awaiting receipt)'
      }
      return 'Stock has been deducted from origin'
    } else {
      return 'Stock not yet deducted'
    }
  }

  // Helper: Get location-aware badge text for completed transfers
  const getLocationAwareStockBadge = () => {
    if (!transfer) return { show: false, text: '', variant: 'default' as const }

    if (transfer.stockDeducted) {
      if (transfer.status === 'completed') {
        if (isUserAtFromLocation()) {
          return { show: true, text: 'Stock Deducted', variant: 'default' as const }
        } else if (isUserAtToLocation()) {
          return { show: true, text: 'Stock Added', variant: 'default' as const }
        }
        return { show: true, text: 'Stock Deducted', variant: 'default' as const }
      } else {
        return { show: true, text: 'Stock Deducted', variant: 'default' as const }
      }
    } else {
      return { show: true, text: 'Stock not yet deducted', variant: 'secondary' as const }
    }
  }

  const getAvailableActions = () => {
    if (!transfer) return []

    // CRITICAL: Wait for userLocations to load before showing action buttons
    // This prevents showing incorrect buttons before location data is fetched
    if (userLocations.length === 0) return []

    const actions = []
    const status = transfer.status

    // ============================================================================
    // ⚠️  CRITICAL WORKFLOW LOGIC - DO NOT MODIFY WITHOUT FULL TESTING ⚠️
    // ============================================================================
    //
    // These button visibility rules maintain workflow separation and prevent fraud.
    // Rules were carefully designed and tested. Changes can break business processes.
    //
    // KEY PRINCIPLES:
    // 1. SENDER cannot mark their own transfer as arrived (prevents fraud)
    // 2. RECEIVER cannot approve/send transfers they will receive (SOD)
    // 3. ACCESS_ALL_LOCATIONS users can manage workflows BUT respect separation
    //
    // TESTING REQUIRED:
    // - Run: npx tsx scripts/test-transfer-workflow-rules.ts
    // - Test with Jheiron (sender at Main Warehouse with ACCESS_ALL_LOCATIONS)
    // - Test with Jay (no location, ACCESS_ALL_LOCATIONS)
    // - Test with regular location users
    //
    // DOCUMENTATION: See docs/TRANSFER_WORKFLOW_RULES.md
    //
    // Last Verified Working: 2025-11-11 by Jay and Jheiron
    // ============================================================================

    // Draft → Edit Transfer or Submit for Check
    // CRITICAL WORKFLOW: Only show to users ASSIGNED to ORIGIN location (FROM location)
    // Users at destination should NOT see this button - even with ACCESS_ALL_LOCATIONS
    // This enforces workflow ownership: only the origin location can submit transfers
    if (status === 'draft' && can(PERMISSIONS.STOCK_TRANSFER_CREATE)) {
      // Check if user has access to origin location:
      // 1. Primary location matches FROM location, OR
      // 2. User has ACCESS_ALL_LOCATIONS permission (cross-location approvers)
      const isAssignedToOrigin = primaryLocationId === transfer.fromLocationId || can(PERMISSIONS.ACCESS_ALL_LOCATIONS)

      if (isAssignedToOrigin) {
        // Edit Transfer button - only in draft status, before submission
        if (!isEditMode) {
          actions.push({
            label: 'Edit Transfer',
            icon: PencilIcon,
            onClick: handleEnterEditMode,
            variant: 'outline' as const
          })
        }
        actions.push({
          label: 'Submit for Checking',
          icon: ClipboardDocumentCheckIcon,
          onClick: handleSubmitForCheck,
          variant: 'default' as const
        })
      }
    }

    // Pending Check → Approve or Reject
    // CRITICAL WORKFLOW: Show to users ASSIGNED to ORIGIN location OR users with ACCESS_ALL_LOCATIONS
    if (status === 'pending_check' && can(PERMISSIONS.STOCK_TRANSFER_CHECK)) {
      // Check if user has access to origin location:
      // 1. Primary location matches FROM location, OR
      // 2. User has ACCESS_ALL_LOCATIONS permission (cross-location approvers)
      const isAssignedToOrigin = primaryLocationId === transfer.fromLocationId || can(PERMISSIONS.ACCESS_ALL_LOCATIONS)
      const isCreator = transfer.createdBy === currentUserId

      // Determine if SOD allows creator to approve
      const sodSettings = transfer.sodSettings
      const enforceSOD = sodSettings?.enforceTransferSOD ?? true
      const allowCreatorToCheck = sodSettings?.allowCreatorToCheck ?? false

      // Show approve button if:
      // 1. User has access to origin location (assigned or ACCESS_ALL_LOCATIONS) AND
      // 2. Either not the creator OR (is creator AND allowed by SOD settings)
      const canApprove = isAssignedToOrigin && (!isCreator || (!enforceSOD || allowCreatorToCheck))

      if (canApprove) {
        actions.push({
          label: 'Approve',
          icon: CheckIcon,
          onClick: handleApprove,
          variant: 'default' as const
        })
        actions.push({
          label: 'Reject',
          icon: XMarkIcon,
          onClick: () => setShowRejectDialog(true),
          variant: 'destructive' as const
        })
      }
    }

    // Checked → Send
    // CRITICAL WORKFLOW: Show to users ASSIGNED to ORIGIN location OR users with ACCESS_ALL_LOCATIONS
    if (status === 'checked' && can(PERMISSIONS.STOCK_TRANSFER_SEND)) {
      // Check if user has access to origin location:
      // 1. Primary location matches FROM location, OR
      // 2. User has ACCESS_ALL_LOCATIONS permission (cross-location approvers)
      const isAssignedToOrigin = primaryLocationId === transfer.fromLocationId || can(PERMISSIONS.ACCESS_ALL_LOCATIONS)

      if (isAssignedToOrigin) {
        actions.push({
          label: 'Send Transfer',
          icon: TruckIcon,
          onClick: handleSendClick,
          variant: 'default' as const
        })
      }
    }

    // In Transit → Receive Transfer (SIMPLIFIED WORKFLOW - Skip verification)
    // ⚠️  CRITICAL: This button was previously broken - DO NOT SIMPLIFY THIS LOGIC!
    //
    // WORKFLOW RULE: Only show to users at DESTINATION location
    // SECURITY: NEVER show to sender (prevents fraud - sender marking own delivery)
    //
    // SIMPLIFIED FLOW: Auto-verify all items and complete in one step
    //   - No manual verification required
    //   - All items automatically verified with sent quantities
    //   - Stock immediately added to destination
    //
    // CORRECT LOGIC:
    //   Show if: (user at destination) OR (ACCESS_ALL_LOCATIONS AND user NOT at sender location)
    //
    // TEST CASE: Jheiron at Main Warehouse sending to Tuguegarao
    //   - Result: isAtDestination = false (CORRECT - sender cannot receive)
    //
    if (status === 'in_transit' && can(PERMISSIONS.STOCK_TRANSFER_RECEIVE)) {
      // The "&& primaryLocationId !== transfer.fromLocationId" is MANDATORY!
      const isAtDestination = primaryLocationId === transfer.toLocationId ||
                              (can(PERMISSIONS.ACCESS_ALL_LOCATIONS) && primaryLocationId !== transfer.fromLocationId)

      if (isAtDestination) {
        actions.push({
          label: 'Receive Transfer',
          icon: CheckCircleIcon,
          onClick: handleReceiveTransfer,
          variant: 'success' as const
        })
      }
    }

    // REMOVED: Arrived, Start Verification, Verifying, Verify All steps
    // REASON: User requested simplified workflow - skip verification entirely
    // All items are now auto-verified when receiving transfer

    // Cancel - available for draft, pending_check, checked, in_transit
    if (['draft', 'pending_check', 'checked', 'in_transit'].includes(status) &&
      can(PERMISSIONS.STOCK_TRANSFER_CANCEL)) {
      actions.push({
        label: status === 'draft' ? 'Delete Draft' : 'Cancel Transfer',
        icon: XMarkIcon,
        onClick: handleCancelClick,
        variant: 'destructive' as const
      })
    }

    return actions
  }

  if (!can(PERMISSIONS.STOCK_TRANSFER_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view stock transfers.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="text-gray-500">Loading transfer details...</div>
      </div>
    )
  }

  if (!transfer) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Transfer not found
        </div>
      </div>
    )
  }

  const availableActions = getAvailableActions()

  const parseQuantity = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') {
      return 0
    }
    const numericValue = typeof value === 'number' ? value : parseFloat(value)
    return Number.isFinite(numericValue) ? numericValue : 0
  }

  const formatQuantity = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') {
      return 'N/A'
    }
    const numericValue = typeof value === 'number' ? value : parseFloat(value)
    if (!Number.isFinite(numericValue)) {
      return typeof value === 'string' && value.trim() !== '' ? value : 'N/A'
    }
    const isWholeNumber = Math.abs(numericValue - Math.round(numericValue)) < 1e-6
    return numericValue.toLocaleString(undefined, {
      minimumFractionDigits: isWholeNumber ? 0 : 2,
      maximumFractionDigits: 4
    })
  }

  const formatUserName = (
    userRecord: { username: string } | null | undefined,
    fallbackId: number | null | undefined
  ) => {
    if (userRecord?.username) {
      return userRecord.username
    }
    if (fallbackId) {
      return `User ${fallbackId}`
    }
    return 'N/A'
  }

  const totalOrdered = transfer.items.reduce(
    (sum, item) => sum + parseQuantity(item.quantity),
    0
  )

  const transferDateFormatted = new Date(transfer.transferDate).toLocaleDateString()
  const printedAt = new Date().toLocaleString()

  const preparedName = formatUserName(transfer.creator, transfer.createdBy)
  const preparedSignatureName = preparedName === 'N/A' ? '' : preparedName
  const preparedTimestamp = transfer.createdAt ? new Date(transfer.createdAt).toLocaleString() : ''

  const approvedName = formatUserName(transfer.checker, transfer.checkedBy)
  const approvedSignatureName = approvedName === 'N/A' ? '' : approvedName
  const approvedTimestamp = transfer.checkedAt ? new Date(transfer.checkedAt).toLocaleString() : ''

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/transfers" className="no-print">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{transfer.transferNumber}</h1>
            <p className="text-gray-500 mt-1">Transfer Details</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`px-4 py-2 rounded-lg text-base font-semibold shadow-sm ${transfer.status === 'draft' ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100' :
            transfer.status === 'pending_check' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200' :
              transfer.status === 'checked' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200' :
                transfer.status === 'in_transit' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200' :
                  transfer.status === 'arrived' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200' :
                    transfer.status === 'verifying' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200' :
                      transfer.status === 'verified' ? 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200' :
                        transfer.status === 'completed' ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200' :
                          transfer.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200' :
                            'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}>
            {getLocationAwareStatusText()}
          </div>
          {(() => {
            const badge = getLocationAwareStockBadge()
            return badge.show ? (
              <Badge variant={badge.variant} className="text-sm">{badge.text}</Badge>
            ) : null
          })()}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
        {/* Workflow Actions */}
        {availableActions.length > 0 ? (
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Workflow Actions</h3>
            <div className="flex flex-wrap gap-2">
              {availableActions.map((action, index) => {
                const Icon = action.icon
                return (
                  <Button
                    key={index}
                    variant={action.variant}
                    onClick={action.onClick}
                    disabled={actionLoading}
                    className={
                      action.variant === 'default'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : action.variant === 'destructive'
                        ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 dark:bg-red-700 dark:hover:bg-red-800 dark:border-red-700'
                        : ''
                    }
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {action.label}
                  </Button>
                )
              })}
            </div>
          </div>
        ) : (
          // Show helpful message when no actions are available
          transfer && ['pending_check', 'checked', 'in_transit', 'arrived', 'verifying', 'verified'].includes(transfer.status) && (
            <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded-lg shadow">
              <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                No Actions Available
              </h3>
              <div className="text-sm text-blue-800 space-y-2">
                {transfer.status === 'pending_check' && transfer.createdBy === currentUserId && (() => {
                  const sodSettings = transfer.sodSettings
                  const enforceSOD = sodSettings?.enforceTransferSOD ?? true
                  const allowCreatorToCheck = sodSettings?.allowCreatorToCheck ?? false
                  const isBlocked = enforceSOD && !allowCreatorToCheck

                  return isBlocked ? (
                    <>
                      <p className="font-semibold">⚠️ You cannot approve your own transfer</p>
                      <p>This transfer needs to be approved by a <strong>different user at {getLocationName(transfer.fromLocationId)}</strong> with checker/approver permissions.</p>
                      <p className="text-xs mt-2 bg-blue-100 p-2 rounded">
                        <strong>Separation of Duties:</strong> The creator cannot approve their own transfer to prevent fraud and ensure proper control.
                      </p>
                    </>
                  ) : null
                })()}
                {transfer.status === 'pending_check' && transfer.createdBy !== currentUserId && (
                  <>
                    <p>This transfer is awaiting approval from an authorized checker at <strong>{getLocationName(transfer.fromLocationId)}</strong>.</p>
                  </>
                )}
                {transfer.status === 'checked' && !isUserAtFromLocation() && (
                  <>
                    <p>This transfer is ready to be sent from <strong>{getLocationName(transfer.fromLocationId)}</strong>.</p>
                    <p className="text-xs mt-2">Only users at the origin location can send the transfer.</p>
                  </>
                )}
                {transfer.status === 'in_transit' && !isUserAtToLocation() && (
                  <>
                    <p>This transfer is in transit to <strong>{getLocationName(transfer.toLocationId)}</strong>.</p>
                    <p className="text-xs mt-2">Only users at the destination location can mark it as arrived.</p>
                  </>
                )}
                {transfer.status === 'arrived' && !isUserAtToLocation() && (
                  <>
                    <p>This transfer has arrived at <strong>{getLocationName(transfer.toLocationId)}</strong> and is awaiting verification.</p>
                  </>
                )}
                {transfer.status === 'verifying' && (
                  <>
                    <p>Items are being verified at <strong>{getLocationName(transfer.toLocationId)}</strong>.</p>
                  </>
                )}
                {transfer.status === 'verified' && !isUserAtToLocation() && (
                  <>
                    <p>This transfer has been verified and is ready to be completed at <strong>{getLocationName(transfer.toLocationId)}</strong>.</p>
                  </>
                )}
              </div>
            </div>
          )
        )}

        {/* Export Actions */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Export</h3>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/transfers/${transferId}/ExportTransfers`}>
              <Button
                variant="outline"
                className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
              >
                <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                Export
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
            >
              <TableCellsIcon className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Rejection Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Reject Transfer</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Please provide a reason for rejecting this transfer. This will be recorded in the audit trail.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectDialog(false)
                  setRejectionReason('')
                }}
                className="min-w-24"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectClick}
                disabled={actionLoading || !rejectionReason.trim()}
                className="min-w-24 bg-red-600 hover:bg-red-700 text-white"
              >
                {actionLoading ? 'Processing...' : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Transfer Confirmation Dialog */}
      <AlertDialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
        <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">Confirm Rejection</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-gray-600 dark:text-gray-400">
                <div className="text-base">
                  Are you sure you want to reject this transfer?
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <div className="font-semibold text-red-900 dark:text-red-200 mb-2">
                    ⚠️ This action will reject the transfer
                  </div>
                  <div className="text-sm text-red-800 dark:text-red-300">
                    The transfer will be returned to draft status and the creator will need to make corrections and resubmit.
                  </div>
                </div>
                {rejectionReason && (
                  <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">Rejection Reason:</div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">{rejectionReason}</div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="shadow-md hover:shadow-lg transition-all duration-200" onClick={() => setShowRejectConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirmed}
              className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 font-semibold"
            >
              Yes, Reject Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transfer Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Transfer Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">From Location</label>
                <div className="font-medium">{getLocationName(transfer.fromLocationId)}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">To Location</label>
                <div className="font-medium">{getLocationName(transfer.toLocationId)}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Transfer Date</label>
                <div className="font-medium">
                  {new Date(transfer.transferDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Created At</label>
                <div className="font-medium">
                  {new Date(transfer.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
            {transfer.notes && (
              <div>
                <label className="text-sm text-gray-500">Notes</label>
                <div className="font-medium">{transfer.notes}</div>
              </div>
            )}
          </div>

          {/* Verification Summary - Shows when items are being verified or ready for completion */}
          {(transfer.status === 'verifying' || transfer.status === 'verified') && (
            <div className={`p-6 rounded-lg shadow space-y-4 ${transfer.status === 'verified'
              ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-400 dark:border-green-700'
              : 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 dark:border-blue-700'
              }`}>
              <div className="flex items-center gap-3">
                <ClipboardDocumentCheckIcon className={`w-7 h-7 ${transfer.status === 'verified' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'
                  }`} />
                <h2 className={`text-xl font-bold ${transfer.status === 'verified' ? 'text-green-900 dark:text-green-200' : 'text-blue-900 dark:text-blue-200'
                  }`}>
                  {transfer.status === 'verified' ? '✓ All Items Verified - Ready to Complete' : 'Verification In Progress'}
                </h2>
              </div>

              {/* Progress Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Items</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {transfer.items.length}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Verified</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {transfer.items.filter(item => item.verified).length}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Remaining</div>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {transfer.items.filter(item => !item.verified).length}
                  </div>
                </div>
              </div>

              {/* Verified Items Summary */}
              {transfer.items.some(item => item.verified) && (
                <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Verified Quantities Summary</h3>
                  <div className="space-y-2 text-sm">
                    {transfer.items.filter(item => item.verified).map(item => {
                      const sent = parseFloat(item.quantity)
                      const received = item.receivedQuantity ? parseFloat(item.receivedQuantity) : sent
                      const hasDiscrepancy = sent !== received

                      return (
                        <div key={item.id} className={`flex justify-between items-center p-2 rounded ${hasDiscrepancy ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700' : 'bg-gray-50 dark:bg-gray-700/50'
                          }`}>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{item.product.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{item.productVariation.name}</div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-xs text-gray-500 dark:text-gray-400">Sent</div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">{sent}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500 dark:text-gray-400">Received</div>
                              <div className={`font-bold ${hasDiscrepancy ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'
                                }`}>
                                {received}
                              </div>
                            </div>
                            {hasDiscrepancy && (
                              <div className="text-right">
                                <div className="text-xs text-gray-500 dark:text-gray-400">Difference</div>
                                <div className="font-bold text-red-600 dark:text-red-400">
                                  {received > sent ? '+' : ''}{(received - sent).toFixed(2)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Final Warning for Verified Status */}
              {transfer.status === 'verified' && (
                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-amber-900 dark:text-amber-200 mb-2">
                        ⚠️ Review Before Final Completion
                      </div>
                      <div className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
                        <p>• Check all verified quantities above are correct</p>
                        <p>• Click "Edit" next to any item if you need to make changes</p>
                        <p>• Once you click "Receive Transfer" below, inventory will be updated</p>
                        <p className="font-semibold mt-2">⚠️ This action is PERMANENT and cannot be undone!</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Items */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Transfer Items ({isEditMode ? editItems.length : transfer.items.length})
              </h2>
              {/* Edit Mode Action Buttons */}
              {isEditMode && transfer.status === 'draft' && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddItemDialog(true)}
                    className="gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Item
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExitEditMode}
                    disabled={editLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveEditItems}
                    disabled={editLoading || editItems.length === 0}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {editLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </div>

            {/* Edit Mode Items */}
            {isEditMode && transfer.status === 'draft' ? (
              <div className="space-y-3">
                {editItems.map((item, index) => (
                  <div key={`edit-${item.productVariationId}-${index}`} className="p-4 border-2 border-blue-200 bg-blue-50 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-medium text-gray-900">{item.product.name}</div>
                        <div className="text-sm text-gray-500">
                          {item.productVariation.name}
                          {item.productVariation.sku && ` • SKU: ${item.productVariation.sku}`}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveEditItem(index)}
                        className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                        disabled={editItems.length <= 1}
                        title={editItems.length <= 1 ? 'Transfer must have at least one item' : 'Remove item'}
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="text-sm text-gray-600">Quantity:</label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditQuantityChange(index, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="h-8 w-8 p-0"
                        >
                          -
                        </Button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleEditQuantityChange(index, parseInt(e.target.value) || 1)}
                          className="w-20 h-8 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditQuantityChange(index, item.quantity + 1)}
                          className="h-8 w-8 p-0"
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {editItems.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No items in transfer. Add items using the button above.
                  </div>
                )}
              </div>
            ) : (
              /* Read-Only Items Display */
              <div className="space-y-3">
                {transfer.items.map((item) => (
                  <div key={item.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{item.product.name}</div>
                        <div className="text-sm text-gray-500">
                          {item.productVariation.name}
                          {item.productVariation.sku && ` • SKU: ${item.productVariation.sku}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.verified && (
                          <>
                            <Badge variant="default">
                              <CheckIcon className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                            {/* SECURITY: Edit button HIDDEN to prevent theft
                                - Users could unverify, change quantity to lower amount, re-verify
                                - Example: Verify 10 units, edit, change to 5, steal 5 units
                                - Once verified, quantity is LOCKED until transfer completion
                            */}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Quantity:</span>
                        <span className="ml-2 font-medium">{item.quantity}</span>
                      </div>
                      {item.receivedQuantity !== null && (
                        <div>
                          <span className="text-gray-500">Received:</span>
                          <span className="ml-2 font-medium">{item.receivedQuantity}</span>
                        </div>
                      )}
                    </div>

                  {/* Verification Input */}
                  {transfer.status === 'verifying' && !item.verified && can(PERMISSIONS.STOCK_TRANSFER_VERIFY) && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg space-y-3">
                      <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-semibold">
                        <ClipboardDocumentCheckIcon className="w-5 h-5" />
                        <span>Verify This Item</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                          <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Quantity Sent</div>
                          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{item.quantity}</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border-2 border-green-400 dark:border-green-600">
                          <div className="text-green-700 dark:text-green-300 text-xs mb-1 font-semibold">
                            ✓ Quantity To Verify (Locked)
                          </div>
                          <div className="text-xl font-bold text-green-900 dark:text-green-100">
                            {item.quantity}
                          </div>
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Full quantity will be verified
                          </div>
                        </div>
                      </div>

                      {/* SECURITY: Quantity input REMOVED to prevent theft
                          - Users were able to change received quantity to lower amount
                          - Example: Sent 10, verify as 5, steal 5 units
                          - Now users must verify FULL quantity or reject entire transfer
                      */}

                      {/* SECURITY WARNING */}
                      <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-600 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div className="text-sm text-amber-900 dark:text-amber-200">
                            <div className="font-bold mb-1">⚠️ Security Notice</div>
                            <p>You must verify the <strong>FULL quantity of {item.quantity} units</strong>. If any items are missing or damaged, reject the entire transfer and contact the sender.</p>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleVerifyItem(item.id)}
                        disabled={actionLoading || verificationQuantities[item.id] === undefined}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 text-lg"
                        size="lg"
                      >
                        <CheckCircleIcon className="w-6 h-6 mr-2" />
                        ✓ Verify Full Quantity ({item.quantity} units)
                      </Button>

                      <p className="text-xs text-gray-600 dark:text-gray-400 text-center font-semibold">
                        🔒 Quantity locked - verify only after physically counting ALL items
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>
        </div>

        {/* Status Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Status</h2>
            <div className="space-y-2">
              {getStatusBadge(transfer.status)}
              <div className="text-sm text-gray-500">
                {getLocationAwareStockMessage()}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Workflow Status</h3>
            <div className="space-y-1 text-sm text-blue-800">
              <div className={transfer.status === 'draft' ? 'font-bold' : ''}>
                1. Draft
              </div>
              <div className={transfer.status === 'pending_check' ? 'font-bold' : ''}>
                2. Pending Check
              </div>
              <div className={transfer.status === 'checked' ? 'font-bold' : ''}>
                3. Checked
              </div>
              <div className={transfer.status === 'in_transit' ? 'font-bold' : ''}>
                4. {isUserAtFromLocation() ? 'In Transit (Stock Deducted)' : 'In Transit'}
              </div>
              <div className={transfer.status === 'arrived' ? 'font-bold' : ''}>
                5. Arrived
              </div>
              <div className={transfer.status === 'verifying' ? 'font-bold' : ''}>
                6. Verifying
              </div>
              <div className={transfer.status === 'verified' ? 'font-bold' : ''}>
                7. Verified
              </div>
              <div className={transfer.status === 'completed' ? 'font-bold' : ''}>
                8. {isUserAtFromLocation() ? 'Completed (Stock Deducted)' : isUserAtToLocation() ? 'Completed (Stock Added)' : 'Completed'}
              </div>
            </div>
          </div>

          {/* Workflow Participants */}
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold">Workflow Audit Trail</h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-gray-500 block mb-1">Created By</label>
                <div className="font-medium">
                  {transfer.creator?.username || `User ID: ${transfer.createdBy || 'N/A'}`}
                </div>
                <div className="text-gray-500 text-xs">{new Date(transfer.createdAt).toLocaleString()}</div>
              </div>

              {transfer.checkedBy && (
                <div className="border-t pt-3">
                  <label className="text-gray-500 block mb-1">Checked/Approved By</label>
                  <div className="font-medium">
                    {transfer.checker?.username || `User ID: ${transfer.checkedBy}`}
                  </div>
                  {transfer.checkedAt && (
                    <div className="text-gray-500 text-xs">{new Date(transfer.checkedAt).toLocaleString()}</div>
                  )}
                  <div className="text-xs text-blue-600 mt-1">✓ Different user verified transfer</div>
                </div>
              )}

              {transfer.sentBy && (
                <div className="border-t pt-3">
                  <label className="text-gray-500 block mb-1">Sent By</label>
                  <div className="font-medium">
                    {transfer.sender?.username || `User ID: ${transfer.sentBy}`}
                  </div>
                  {transfer.sentAt && (
                    <div className="text-gray-500 text-xs">{new Date(transfer.sentAt).toLocaleString()}</div>
                  )}
                  <div className="text-xs text-blue-600 mt-1">
                    ✓ {isUserAtFromLocation() ? 'Stock deducted from your location' : 'Stock deducted from origin'}
                  </div>
                </div>
              )}

              {transfer.arrivedBy && (
                <div className="border-t pt-3">
                  <label className="text-gray-500 block mb-1">Marked Arrived By</label>
                  <div className="font-medium">
                    {transfer.arrivalMarker?.username || `User ID: ${transfer.arrivedBy}`}
                  </div>
                  {transfer.arrivedAt && (
                    <div className="text-gray-500 text-xs">{new Date(transfer.arrivedAt).toLocaleString()}</div>
                  )}
                  <div className="text-xs text-blue-600 mt-1">
                    ✓ {isUserAtToLocation() ? 'Package arrived at your location' : 'Destination confirmed receipt'}
                  </div>
                </div>
              )}

              {transfer.verifiedBy && (
                <div className="border-t pt-3">
                  <label className="text-gray-500 block mb-1">Verified By</label>
                  <div className="font-medium">
                    {transfer.verifier?.username || `User ID: ${transfer.verifiedBy}`}
                  </div>
                  {transfer.verifiedAt && (
                    <div className="text-gray-500 text-xs">{new Date(transfer.verifiedAt).toLocaleString()}</div>
                  )}
                  <div className="text-xs text-blue-600 mt-1">✓ Items physically verified</div>
                </div>
              )}

              {transfer.completedBy && (
                <div className="border-t pt-3">
                  <label className="text-gray-500 block mb-1">Completed By</label>
                  <div className="font-medium">
                    {transfer.completer?.username || `User ID: ${transfer.completedBy}`}
                  </div>
                  {transfer.completedAt && (
                    <div className="text-gray-500 text-xs">{new Date(transfer.completedAt).toLocaleString()}</div>
                  )}
                  <div className="text-xs text-green-600 mt-1">
                    ✓ {isUserAtFromLocation() ? 'Transfer complete - stock deducted from your location' : isUserAtToLocation() ? 'Transfer complete - stock added to your location' : 'Transfer complete'}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t">
              <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
                <strong>Separation of Duties:</strong> Each workflow stage must be performed by a different user to ensure proper control and prevent fraud. This audit trail tracks all participants.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Send Transfer Confirmation Dialog */}
      <AlertDialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white text-xl">
              ⚠️ FINAL CONFIRMATION - Send Transfer
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-gray-600 dark:text-gray-400">
                <div className="text-base font-semibold text-gray-900 dark:text-white">
                  You are about to SEND this transfer and DEDUCT INVENTORY from the origin location.
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Total items:</strong> {transfer?.items.length || 0}
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-4">
                  <div className="font-bold text-amber-900 dark:text-amber-200 mb-3">
                    This action will:
                  </div>
                  <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-2">
                    <li>✓ Deduct stock from origin location{transfer?.fromLocationName ? ` (${transfer.fromLocationName})` : ''}</li>
                    <li>✓ Update inventory ledgers permanently</li>
                    <li>✓ Change transfer status to &quot;In Transit&quot;</li>
                  </ul>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-4">
                  <div className="font-bold text-red-900 dark:text-red-200 mb-2">
                    ⚠️ WARNING
                  </div>
                  <div className="text-sm text-red-800 dark:text-red-300">
                    Stock will be IMMEDIATELY deducted from your inventory. Make sure all quantities are correct before proceeding. This action cannot be undone easily.
                  </div>
                </div>

                <div className="text-base font-semibold text-gray-900 dark:text-white mt-4">
                  Are you absolutely sure you want to send this transfer?
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="shadow-md hover:shadow-lg transition-all duration-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSendConfirmed}
              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 font-semibold"
            >
              Yes, Send Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Transfer Confirmation Dialog */}
      <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white text-xl">
              ⚠️ FINAL CONFIRMATION - Complete Transfer
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-gray-600 dark:text-gray-400">
                <div className="text-base font-semibold text-gray-900 dark:text-white">
                  You are about to COMPLETE this transfer and UPDATE INVENTORY.
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Items verified:</strong> {transfer?.items.filter(item => item.verified).length} / {transfer?.items.length}
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-4">
                  <div className="font-bold text-amber-900 dark:text-amber-200 mb-3">
                    This action will:
                  </div>
                  <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-2">
                    <li>✓ Add stock to destination location</li>
                    <li>✓ Update inventory ledgers permanently</li>
                    <li>✓ Make this transfer IMMUTABLE (cannot be edited)</li>
                  </ul>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-4">
                  <div className="font-bold text-red-900 dark:text-red-200 mb-2">
                    ⚠️ WARNING
                  </div>
                  <div className="text-sm text-red-800 dark:text-red-300">
                    Once completed, you CANNOT change verified quantities! Review all verified quantities carefully before proceeding.
                  </div>
                </div>

                <div className="text-base font-semibold text-gray-900 dark:text-white mt-4">
                  Are you absolutely sure all quantities are correct?
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="shadow-md hover:shadow-lg transition-all duration-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCompleteConfirmed}
              className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 font-semibold"
            >
              Yes, Complete Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verify All Items Confirmation Dialog */}
      <AlertDialog open={showVerifyAllConfirm} onOpenChange={setShowVerifyAllConfirm}>
        <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white text-xl">
              Verify All Items
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-gray-600 dark:text-gray-400">
                <div className="text-base">
                  This will mark all {transfer?.items.filter(item => !item.verified).length} unverified items as verified at once.
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <div className="font-semibold text-blue-900 dark:text-blue-200 mb-3">
                    📋 Before you proceed:
                  </div>
                  <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
                    <li>✓ You have physically checked all items against the printed transfer document</li>
                    <li>✓ All quantities are correct as sent</li>
                    <li>✓ No discrepancies found</li>
                  </ul>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                  <div className="font-semibold text-green-900 dark:text-green-200 mb-2">
                    What happens next:
                  </div>
                  <div className="text-sm text-green-800 dark:text-green-300">
                    • All items will be marked as verified with received quantity = sent quantity
                    <br />
                    • Transfer status will change to "Verified"
                    <br />
                    • You can then click "Receive Transfer" to add inventory
                  </div>
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400 italic mt-3">
                  💡 Tip: If you find any discrepancies, verify items individually instead to record the correct received quantities.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="shadow-md hover:shadow-lg transition-all duration-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVerifyAllConfirmed}
              className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 font-semibold"
            >
              Yes, Verify All Items
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Transfer Confirmation Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">Cancel Transfer</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-gray-600 dark:text-gray-400">
                <div className="text-base">
                  Are you sure you want to cancel this transfer?
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <div className="font-semibold text-red-900 dark:text-red-200 mb-2">
                    ⚠️ This action cannot be undone
                  </div>
                  <div className="text-sm text-red-800 dark:text-red-300">
                    The transfer will be permanently cancelled and cannot be recovered.
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="shadow-md hover:shadow-lg transition-all duration-200">
              No, Keep Transfer
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirmed}
              className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 font-semibold"
            >
              Yes, Cancel Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unverify Item Confirmation Dialog */}
      <AlertDialog open={itemToUnverify !== null} onOpenChange={(open) => !open && setItemToUnverify(null)}>
        <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">Edit Verified Item</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-gray-600 dark:text-gray-400">
                <div className="text-base">
                  Do you want to edit this verified item?
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    You can change the quantity and verify it again. This will unmark the item as verified.
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="shadow-md hover:shadow-lg transition-all duration-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnverifyItemConfirmed}
              className="bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 font-semibold"
            >
              Yes, Edit Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Inventory Impact Modal - Shows From/To Quantities */}
      <AlertDialog open={showInventoryImpact} onOpenChange={(open) => !open && handleCloseInventoryImpact()}>
        <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 max-w-4xl max-h-[80vh] overflow-y-auto print:max-w-full print:max-h-full print:overflow-visible print:border-0 print:shadow-none">
          <AlertDialogHeader className="print:hidden">
            <AlertDialogTitle className="text-gray-900 dark:text-white text-2xl flex items-center gap-2">
              <CheckCircleIcon className="w-8 h-8 text-green-600" />
              Transfer Impact Report
            </AlertDialogTitle>
          </AlertDialogHeader>

          {/* Print-only header */}
          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-bold text-center mb-2">Transfer Impact Report</h1>
            <div className="text-center text-sm text-gray-600 mb-4">
              {inventoryImpactData && (
                <>
                  <p><strong>Transfer #:</strong> {inventoryImpactData.referenceNumber}</p>
                  <p><strong>Executed By:</strong> {inventoryImpactData.performedBy || 'N/A'}</p>
                  <p><strong>Date:</strong> {new Date(inventoryImpactData.transactionDate).toLocaleString()}</p>
                </>
              )}
            </div>
          </div>

          <AlertDialogDescription asChild>
            <div className="space-y-4 text-gray-600 dark:text-gray-400 print:text-black">
              {inventoryImpactData && (
                <>
                  {/* Summary - Screen only */}
                  <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg p-4 print:hidden">
                    <div className="text-lg font-bold text-green-900 dark:text-green-200 mb-2">
                      ✓ Transfer Completed Successfully
                    </div>
                    <div className="text-sm text-green-800 dark:text-green-300">
                      <p><strong>Transfer:</strong> {inventoryImpactData.referenceNumber}</p>
                      <p><strong>Executed By:</strong> {inventoryImpactData.performedBy || 'N/A'}</p>
                      <p><strong>Date:</strong> {new Date(inventoryImpactData.transactionDate).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Inventory Impact by Product */}
                  <div className="space-y-3 print:space-y-0">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg print:text-base print:mb-3 print:pb-2 print:border-b-2 print:border-gray-800">
                      Inventory Changes:
                    </h3>

                    {/* Print: Simple Table Layout */}
                    <div className="hidden print:block">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b-2 border-gray-800">
                            <th className="text-left py-2 font-bold">Product</th>
                            <th className="text-left py-2 font-bold">Location</th>
                            <th className="text-right py-2 font-bold">Before</th>
                            <th className="text-right py-2 font-bold">After</th>
                            <th className="text-right py-2 font-bold">Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryImpactData.locations && Array.isArray(inventoryImpactData.locations) && (() => {
                            const rows: any[] = [];
                            inventoryImpactData.locations.forEach((location: any) => {
                              if (location.products && Array.isArray(location.products)) {
                                location.products.forEach((product: any) => {
                                  rows.push({
                                    productName: product.productName,
                                    variationName: product.variationName,
                                    locationName: location.locationName,
                                    locationType: location.type,
                                    previousQty: product.previousQty,
                                    newQty: product.newQty,
                                    changeQty: product.changeQty,
                                  });
                                });
                              }
                            });
                            return rows.map((row: any, index: number) => (
                              <tr key={index} className="border-b border-gray-300">
                                <td className="py-2">
                                  <div className="font-medium">{row.productName}</div>
                                  {row.variationName && row.variationName !== 'Default' && row.variationName !== 'DUMMY' && (
                                    <div className="text-xs text-gray-600">{row.variationName}</div>
                                  )}
                                </td>
                                <td className="py-2">
                                  {row.locationName} <span className="text-xs">({row.locationType === 'source' ? 'From' : 'To'})</span>
                                </td>
                                <td className="text-right py-2 font-medium">
                                  {row.previousQty !== null ? parseFloat(row.previousQty).toLocaleString() : 'N/A'}
                                </td>
                                <td className="text-right py-2 font-medium">
                                  {row.newQty !== null ? parseFloat(row.newQty).toLocaleString() : 'N/A'}
                                </td>
                                <td className="text-right py-2 font-bold">
                                  {row.changeQty > 0 ? '+' : ''}{parseFloat(row.changeQty).toLocaleString()}
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>

                    {/* Screen: Grouped Card Layout */}
                    <div className="print:hidden">
                      {inventoryImpactData.locations && Array.isArray(inventoryImpactData.locations) && (() => {
                        // Group products by product variation ID to show both source and destination together
                        const productGroups = new Map<number, any[]>();
                        inventoryImpactData.locations.forEach((location: any) => {
                          if (location.products && Array.isArray(location.products)) {
                            location.products.forEach((product: any) => {
                              if (!productGroups.has(product.variationId)) {
                                productGroups.set(product.variationId, []);
                              }
                              productGroups.get(product.variationId)!.push({ ...product, locationType: location.type, fullLocationName: location.locationName });
                            });
                          }
                        });

                        return Array.from(productGroups.values()).map((productGroup: any[], index: number) => {
                          const firstProduct = productGroup[0];
                          return (
                            <div key={index} className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                              <div className="font-semibold text-gray-900 dark:text-white mb-3">
                                {firstProduct.productName}
                                {firstProduct.variationName && firstProduct.variationName !== 'Default' && firstProduct.variationName !== 'DUMMY' && (
                                  <span className="text-gray-600 dark:text-gray-400"> - {firstProduct.variationName}</span>
                                )}
                              </div>

                              {/* Location Changes */}
                              {productGroup.map((product: any, locIndex: number) => (
                                <div key={locIndex} className="mb-3 last:mb-0">
                                  <div className="flex items-center justify-between bg-white dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
                                    <div className="flex-1">
                                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        📍 {product.fullLocationName} ({product.locationType === 'source' ? 'From' : 'To'})
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400">Before</div>
                                          <div className="text-xl font-bold text-gray-900 dark:text-white">
                                            {product.previousQty !== null ? parseFloat(product.previousQty).toLocaleString() : 'N/A'}
                                          </div>
                                        </div>
                                        <div className="text-2xl text-gray-400">→</div>
                                        <div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400">After</div>
                                          <div className={`text-xl font-bold ${product.locationType === 'source'
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-green-600 dark:text-green-400'
                                            }`}>
                                            {product.newQty !== null ? parseFloat(product.newQty).toLocaleString() : 'N/A'}
                                          </div>
                                        </div>
                                        <div className="ml-4">
                                          <div className="text-xs text-gray-500 dark:text-gray-400">Change</div>
                                          <div className={`text-lg font-bold ${product.changeQty < 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-green-600 dark:text-green-400'
                                            }`}>
                                            {product.changeQty > 0 ? '+' : ''}{parseFloat(product.changeQty).toLocaleString()}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Export PDF Button - Screen only */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 print:hidden">
                    <div className="text-sm text-blue-800 dark:text-blue-300 mb-3">
                      💡 <strong>Tip:</strong> Download this report as PDF for your records.
                    </div>
                    <Button
                      onClick={() => {
                        import('jspdf').then(({ default: jsPDF }) => {
                          import('jspdf-autotable').then(() => {
                            const doc = new jsPDF()

                            // Title
                            doc.setFontSize(16)
                            doc.setFont('helvetica', 'bold')
                            doc.text('Transfer Impact Report', 105, 15, { align: 'center' })

                            // Summary info
                            doc.setFontSize(10)
                            doc.setFont('helvetica', 'normal')
                            doc.text(`Transfer #: ${inventoryImpactData.referenceNumber}`, 14, 25)
                            doc.text(`Executed By: ${inventoryImpactData.performedBy || 'N/A'}`, 14, 31)
                            doc.text(`Date: ${new Date(inventoryImpactData.transactionDate).toLocaleString()}`, 14, 37)

                            // Prepare table data
                            const tableData: any[] = []
                            if (inventoryImpactData.locations && Array.isArray(inventoryImpactData.locations)) {
                              inventoryImpactData.locations.forEach((location: any) => {
                                if (location.products && Array.isArray(location.products)) {
                                  location.products.forEach((product: any) => {
                                    tableData.push([
                                      product.productName + (product.variationName && product.variationName !== 'Default' && product.variationName !== 'DUMMY' ? `\n${product.variationName}` : ''),
                                      `${location.locationName}\n(${location.type === 'source' ? 'From' : 'To'})`,
                                      product.previousQty !== null ? parseFloat(product.previousQty).toLocaleString() : 'N/A',
                                      product.newQty !== null ? parseFloat(product.newQty).toLocaleString() : 'N/A',
                                      (product.changeQty > 0 ? '+' : '') + parseFloat(product.changeQty).toLocaleString()
                                    ])
                                  })
                                }
                              })
                            }

                            // Add table
                            ; (doc as any).autoTable({
                              startY: 45,
                              head: [['Product', 'Location', 'Before', 'After', 'Change']],
                              body: tableData,
                              theme: 'grid',
                              headStyles: {
                                fillColor: [59, 130, 246],
                                textColor: 255,
                                fontStyle: 'bold',
                                halign: 'left'
                              },
                              columnStyles: {
                                0: { cellWidth: 60 },
                                1: { cellWidth: 50 },
                                2: { halign: 'right', cellWidth: 25 },
                                3: { halign: 'right', cellWidth: 25 },
                                4: { halign: 'right', cellWidth: 25, fontStyle: 'bold' }
                              },
                              styles: {
                                fontSize: 9,
                                cellPadding: 3
                              }
                            })

                            // Save PDF
                            doc.save(`Transfer_Impact_${inventoryImpactData.referenceNumber}.pdf`)
                          })
                        })
                      }}
                      variant="outline"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                      Download PDF Report
                    </Button>
                  </div>
                </>
              )}
            </div>
          </AlertDialogDescription>

          <AlertDialogFooter className="print:hidden">
            <AlertDialogAction
              onClick={handleCloseInventoryImpact}
              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 font-semibold"
            >
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Transfer Progress Modal */}
      {showSendProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-75 dark:bg-opacity-90 flex items-center justify-center z-[60] backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border-4 border-blue-500">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                <TruckIcon className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Sending Transfer</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Processing inventory updates...</p>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="space-y-4 mb-6">
              {/* Step 1: Creating Job */}
              <div className={`flex items-start gap-3 transition-all duration-300 ${sendProgressStep >= 1 ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  sendProgressStep > 1 ? 'bg-green-500' : sendProgressStep === 1 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  {sendProgressStep > 1 ? (
                    <CheckIcon className="w-5 h-5 text-white" />
                  ) : sendProgressStep === 1 ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-white font-bold">1</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white">Creating Background Job</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Setting up async processing...</div>
                </div>
              </div>

              {/* Step 2: Processing Items */}
              <div className={`flex items-start gap-3 transition-all duration-300 ${sendProgressStep >= 2 ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  sendProgressStep > 2 ? 'bg-green-500' : sendProgressStep === 2 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  {sendProgressStep > 2 ? (
                    <CheckIcon className="w-5 h-5 text-white" />
                  ) : sendProgressStep === 2 ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-white font-bold">2</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    Deducting Stock from {getLocationName(transfer?.fromLocationId || 0)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {sendProgressStep === 2 && sendJobTotal > 0 ? (
                      <span className="font-mono">
                        Processing {sendJobProgress}/{sendJobTotal} items... {Math.round((sendJobProgress / sendJobTotal) * 100)}%
                      </span>
                    ) : (
                      'Updating inventory at origin location'
                    )}
                  </div>
                  {sendProgressStep === 2 && sendJobTotal > 0 && (
                    <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full transition-all duration-500 ease-out"
                        style={{ width: `${(sendJobProgress / sendJobTotal) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Complete */}
              <div className={`flex items-start gap-3 transition-all duration-300 ${sendProgressStep >= 3 ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  sendProgressStep >= 3 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  {sendProgressStep >= 3 ? (
                    <CheckIcon className="w-5 h-5 text-white" />
                  ) : (
                    <span className="text-white font-bold">3</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white">Transfer Sent Successfully</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Stock deducted, ready for shipment</div>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-600 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-amber-900 dark:text-amber-200 font-semibold">
                  ⚠️ Do not close this window! Inventory updates in progress...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receive Transfer Progress Modal */}
      {showReceiveProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-75 dark:bg-opacity-90 flex items-center justify-center z-[60] backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border-4 border-green-500">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                <CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Receiving Transfer</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Processing inventory updates...</p>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="space-y-4 mb-6">
              {/* Step 1: Creating Job */}
              <div className={`flex items-start gap-3 transition-all duration-300 ${receiveProgressStep >= 1 ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  receiveProgressStep > 1 ? 'bg-green-500' : receiveProgressStep === 1 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  {receiveProgressStep > 1 ? (
                    <CheckIcon className="w-5 h-5 text-white" />
                  ) : receiveProgressStep === 1 ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-white font-bold">1</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white">Creating Background Job</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Setting up async processing...</div>
                </div>
              </div>

              {/* Step 2: Processing Items */}
              <div className={`flex items-start gap-3 transition-all duration-300 ${receiveProgressStep >= 2 ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  receiveProgressStep > 2 ? 'bg-green-500' : receiveProgressStep === 2 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  {receiveProgressStep > 2 ? (
                    <CheckIcon className="w-5 h-5 text-white" />
                  ) : receiveProgressStep === 2 ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-white font-bold">2</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    Adding Stock to {getLocationName(transfer?.toLocationId || 0)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {receiveProgressStep === 2 && receiveJobTotal > 0 ? (
                      <span className="font-mono">
                        Processing {receiveJobProgress}/{receiveJobTotal} items... {Math.round((receiveJobProgress / receiveJobTotal) * 100)}%
                      </span>
                    ) : (
                      'Updating inventory at destination location'
                    )}
                  </div>
                  {receiveProgressStep === 2 && receiveJobTotal > 0 && (
                    <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-green-500 h-full transition-all duration-500 ease-out"
                        style={{ width: `${(receiveJobProgress / receiveJobTotal) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Complete */}
              <div className={`flex items-start gap-3 transition-all duration-300 ${receiveProgressStep >= 3 ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  receiveProgressStep >= 3 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  {receiveProgressStep >= 3 ? (
                    <CheckIcon className="w-5 h-5 text-white" />
                  ) : (
                    <span className="text-white font-bold">3</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white">Transfer Received Successfully</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Inventory updated at destination</div>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-600 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-amber-900 dark:text-amber-200 font-semibold">
                  ⚠️ Do not close this window! Inventory updates in progress...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Dialog for Edit Mode */}
      <AlertDialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">Add Item to Transfer</AlertDialogTitle>
            <AlertDialogDescription>
              Search for products with available stock at {transfer?.fromLocationName || 'source location'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value)
                  handleSearchProducts(e.target.value)
                }}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Search Results */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {searchResults.length === 0 && productSearch.length >= 2 && !searchLoading && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No products found with available stock
                </div>
              )}
              {searchResults.map((product: any) => (
                <div key={product.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="font-medium text-gray-900 dark:text-white mb-2">{product.name}</div>
                  <div className="space-y-2">
                    {product.variations?.filter((v: any) =>
                      !editItems.some(item => item.productVariationId === v.id) && (v.stockAtLocation || 0) > 0
                    ).map((variation: any) => (
                      <div
                        key={variation.id}
                        className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded"
                      >
                        <div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            {variation.name}
                            {variation.sku && <span className="text-gray-500 ml-2">SKU: {variation.sku}</span>}
                          </div>
                          <div className="text-xs text-green-600 dark:text-green-400">
                            Available: {variation.stockAtLocation || 0}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddEditItem(product, variation)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowAddItemDialog(false)
              setProductSearch('')
              setSearchResults([])
            }}>
              Close
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
