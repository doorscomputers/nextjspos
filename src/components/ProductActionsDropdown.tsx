"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import {
  MoreVertical,
  Tag,
  Eye,
  Pencil,
  Trash2,
  Database,
  History,
  Copy
} from 'lucide-react'

interface ProductActionsDropdownProps {
  product: {
    id: number
    name: string
    enableStock: boolean
  }
  onDelete?: () => void
}

export default function ProductActionsDropdown({ product, onDelete }: ProductActionsDropdownProps) {
  const router = useRouter()
  const { can } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

  const handleViewProduct = () => {
    router.push(`/dashboard/products/${product.id}`)
  }

  const handleEditProduct = () => {
    router.push(`/dashboard/products/${product.id}/edit`)
  }

  const confirmDeleteProduct = async () => {
    setLoading(true)
    setShowDeleteDialog(false)

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Product deleted successfully')
        if (onDelete) onDelete()
      } else {
        // Show validation errors if product cannot be deleted
        if (data.errors && data.errors.length > 0) {
          toast.error(`Cannot delete product: ${data.errors.join(', ')}`)
        } else {
          toast.error(data.error || 'Failed to delete product')
        }
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('An error occurred while deleting the product')
    } finally {
      setLoading(false)
    }
  }

  const handleOpeningStock = () => {
    router.push(`/dashboard/products/${product.id}/opening-stock`)
  }

  const handleStockHistory = () => {
    router.push(`/dashboard/reports/stock-history-v2?productId=${product.id}`)
  }

  const confirmDuplicateProduct = async () => {
    setLoading(true)
    setShowDuplicateDialog(false)

    try {
      const response = await fetch(`/api/products/${product.id}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nameSuffix: ' (Copy)' })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Product duplicated successfully')
        // Redirect to the new product edit page
        router.push(`/dashboard/products/${data.productId}/edit`)
      } else {
        toast.error(data.error || 'Failed to duplicate product')
      }
    } catch (error) {
      console.error('Error duplicating product:', error)
      toast.error('An error occurred while duplicating the product')
    } finally {
      setLoading(false)
    }
  }

  const handlePrintLabels = () => {
    // Navigate to print labels page with this product pre-selected
    router.push(`/dashboard/products/print-labels?productId=${product.id}`)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={loading}
            className="h-8 w-8"
          >
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Open actions menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={handlePrintLabels}>
            <Tag className="mr-2 h-4 w-4" />
            Labels
          </DropdownMenuItem>

          {can(PERMISSIONS.PRODUCT_VIEW) && (
            <DropdownMenuItem onClick={handleViewProduct}>
              <Eye className="mr-2 h-4 w-4" />
              View
            </DropdownMenuItem>
          )}

          {can(PERMISSIONS.PRODUCT_UPDATE) && (
            <DropdownMenuItem onClick={handleEditProduct}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          )}

          {can(PERMISSIONS.PRODUCT_DELETE) && (
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              disabled={loading}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          )}

          {/* Stock-related actions */}
          {product.enableStock && (
            <>
              <DropdownMenuSeparator />
              {can(PERMISSIONS.PRODUCT_OPENING_STOCK) && (
                <DropdownMenuItem onClick={handleOpeningStock}>
                  <Database className="mr-2 h-4 w-4" />
                  Add/Edit Opening Stock
                </DropdownMenuItem>
              )}

              {can(PERMISSIONS.PRODUCT_VIEW) && (
                <DropdownMenuItem onClick={handleStockHistory}>
                  <History className="mr-2 h-4 w-4" />
                  Product Stock History
                </DropdownMenuItem>
              )}
            </>
          )}

          {/* Duplicate action */}
          <DropdownMenuSeparator />
          {can(PERMISSIONS.PRODUCT_CREATE) && (
            <DropdownMenuItem
              onClick={() => setShowDuplicateDialog(true)}
              disabled={loading}
            >
              <Copy className="mr-2 h-4 w-4" />
              Duplicate Product
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Product"
        description={`Are you sure you want to delete "${product.name}"? This action cannot be undone if the product has no transaction history.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteProduct}
      />

      {/* Duplicate Confirmation Dialog */}
      <ConfirmDialog
        open={showDuplicateDialog}
        onOpenChange={setShowDuplicateDialog}
        title="Duplicate Product"
        description={`This will create a copy of "${product.name}" with all its variations. Stock will not be copied.`}
        confirmLabel="Duplicate"
        onConfirm={confirmDuplicateProduct}
      />
    </>
  )
}
