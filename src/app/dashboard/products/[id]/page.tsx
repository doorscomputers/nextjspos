"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  PencilIcon,
  CubeIcon,
  TagIcon,
  CurrencyDollarIcon,
  BuildingStorefrontIcon,
  ChartBarIcon,
  PrinterIcon
} from '@heroicons/react/24/outline'

interface ProductDetail {
  id: number
  name: string
  sku: string
  type: string
  description: string | null
  productDescription: string | null
  image: string | null
  enableStock: boolean
  alertQuantity: number | null
  purchasePrice: number | null
  sellingPrice: number | null
  weight: number | null
  preparationTime: number | null
  notForSelling: boolean
  category: { id: number; name: string } | null
  brand: { id: number; name: string } | null
  unit: { id: number; name: string; shortName: string } | null
  tax: { id: number; name: string; amount: number } | null
  taxType: string | null
  variations: ProductVariation[]
  comboProducts: ComboProduct[]
  createdAt: string
}

interface ProductVariation {
  id: number
  name: string
  sku: string
  purchasePrice: number
  sellingPrice: number
  isDefault: boolean
  variationLocationDetails: VariationLocationDetail[]
}

interface VariationLocationDetail {
  id: number
  locationId: number
  qtyAvailable: number
  sellingPrice: number | null
}

interface ComboProduct {
  id: number
  quantity: number
  childProduct: {
    id: number
    name: string
    sku: string
    unit: { shortName: string } | null
  }
}

interface StockDetail {
  sku: string
  productName: string
  locationId: number
  locationName: string
  unitPrice: number
  currentStock: number
  stockValue: number
  totalUnitSold: number
  totalUnitTransferred: number
  totalUnitAdjusted: number
}

export default function ProductViewPage() {
  const params = useParams()
  const router = useRouter()
  const { can } = usePermissions()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<any[]>([])
  const [stockDetails, setStockDetails] = useState<StockDetail[]>([])
  const [businessName, setBusinessName] = useState<string>('Business')
  const [printFormat, setPrintFormat] = useState<'standard' | 'compact'>('standard')

  useEffect(() => {
    fetchProduct()
  }, [params.id])

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/products/${params.id}`)
      const data = await response.json()
      if (response.ok) {
        setProduct(data.product)
        setStockDetails(data.stockDetails || [])
        setLocations(data.locations || [])
        setBusinessName(data.businessName || 'Business')
      } else {
        console.error('Error fetching product:', data.error)
      }
    } catch (error) {
      console.error('Error fetching product:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const getTotalStock = () => {
    if (!product || !product.enableStock) return 0

    let total = 0
    for (const variation of product.variations) {
      for (const detail of variation.variationLocationDetails) {
        total += parseFloat(detail.qtyAvailable.toString())
      }
    }
    return total.toFixed(2)
  }

  const getLocationStock = (locationId: number) => {
    if (!product || !product.enableStock) return 0

    let total = 0
    for (const variation of product.variations) {
      for (const detail of variation.variationLocationDetails) {
        if (detail.locationId === locationId) {
          total += parseFloat(detail.qtyAvailable.toString())
        }
      }
    }
    return total.toFixed(2)
  }

  const handlePrintStandard = () => {
    setPrintFormat('standard')
    // Change page title to business name for print header
    const originalTitle = document.title
    document.title = businessName
    setTimeout(() => {
      window.print()
      // Restore original title after print dialog opens
      setTimeout(() => {
        document.title = originalTitle
      }, 100)
    }, 100)
  }

  const handlePrintCompact = () => {
    setPrintFormat('compact')
    // Change page title to business name for print header
    const originalTitle = document.title
    document.title = businessName
    setTimeout(() => {
      window.print()
      // Restore original title after print dialog opens
      setTimeout(() => {
        document.title = originalTitle
      }, 100)
    }, 100)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">Product not found</p>
          <Link href="/dashboard/products" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to Products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6" data-print-format={printFormat}>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }

          body * {
            max-height: none !important;
          }

          /* Hide all UI elements aggressively */
          button,
          input,
          textarea,
          select,
          form,
          nav,
          aside,
          header,
          a,
          .print\\:hidden,
          [type="search"],
          [placeholder*="Search"],
          [class*="search"] {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            left: -9999px !important;
            opacity: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Force hide specific elements by content */
          *:has(> button),
          .flex:has(button),
          .mb-6:has(button) {
            button {
              display: none !important;
            }
          }

          /* Clean background for print */
          body,
          html {
            background: white !important;
          }

          /* Hide all SVG icons except in content */
          svg {
            display: none !important;
          }

          /* Show only SVG icons inside h1/h2 headers - SMALL SIZE */
          h2 > svg:first-child,
          h1 > svg:first-child {
            display: inline-block !important;
            visibility: visible !important;
            opacity: 1 !important;
            position: static !important;
            width: 16px !important;
            height: 16px !important;
            max-width: 16px !important;
            max-height: 16px !important;
            min-width: 16px !important;
            min-height: 16px !important;
          }

          /* Ensure print:hidden class works */
          .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
          }

          /* Show only the product title */
          h1.text-3xl {
            display: block !important;
            margin-bottom: 10px !important;
            margin-top: 0 !important;
            page-break-after: avoid !important;
          }

          /* Hide the page header container that might be causing blank space */
          .mb-6:has(h1) {
            margin-bottom: 10px !important;
            page-break-after: avoid !important;
          }

          /* Ensure h2 headers with icons are visible and compact */
          h2.flex.items-center {
            display: flex !important;
            visibility: visible !important;
            align-items: center !important;
            gap: 4px !important;
          }

          /* Make headers more compact */
          h2 {
            font-size: 14px !important;
            margin-bottom: 8px !important;
          }

          h1 {
            font-size: 18px !important;
          }

          /* Main container adjustments */
          .p-6 {
            padding: 0 !important;
            width: 100% !important;
          }

          /* STANDARD FORMAT - Side by side layout */
          [data-print-format="standard"] .print-side-by-side {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 15px !important;
          }

          [data-print-format="standard"] .print-compact-info {
            display: none !important;
          }

          [data-print-format="standard"] .lg\\:grid-cols-3 > div:last-child {
            display: block !important;
          }

          /* COMPACT FORMAT - 3 Column Info Layout */
          [data-print-format="compact"] .print-side-by-side {
            display: none !important;
          }

          [data-print-format="compact"] .print-compact-info {
            display: grid !important;
            grid-template-columns: 1fr 1fr 1fr !important;
            gap: 8px 15px !important;
            font-size: 9px !important;
            margin-bottom: 8px !important;
            border: 1px solid #999 !important;
            padding: 8px !important;
            background: white !important;
          }

          [data-print-format="compact"] .print-compact-info > div {
            display: block !important;
            line-height: 1.3 !important;
          }

          [data-print-format="compact"] .print-compact-info label {
            font-weight: 600 !important;
            display: inline !important;
            margin-right: 4px !important;
          }

          [data-print-format="compact"] .print-compact-info p {
            display: inline !important;
            margin: 0 !important;
            font-weight: 400 !important;
          }

          /* Hide sidebar completely in compact print */
          [data-print-format="compact"] .lg\\:grid-cols-3 > div:last-child {
            display: none !important;
          }

          /* Hide Settings card in both formats */
          .print-hide-settings {
            display: none !important;
          }

          /* In compact format, hide the old card sections completely */
          [data-print-format="compact"] .print-side-by-side > div {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            overflow: hidden !important;
          }

          /* Make print:block work */
          .print\\:block {
            display: block !important;
          }

          /* Business name header in print */
          .print\\:block h1 {
            font-size: 16px !important;
            font-weight: 700 !important;
            text-align: center !important;
            margin-bottom: 3px !important;
            padding-bottom: 2px !important;
            border-bottom: 2px solid #1f2937 !important;
          }

          /* Product title in print */
          .print\\:block h2 {
            font-size: 12px !important;
            font-weight: 600 !important;
            margin-bottom: 4px !important;
            margin-top: 2px !important;
          }

          .mb-2 {
            margin-bottom: 3px !important;
          }

          .text-center {
            text-align: center !important;
          }

          .border-b-2 {
            border-bottom-width: 2px !important;
          }

          .border-gray-800 {
            border-color: #1f2937 !important;
          }

          .pb-1 {
            padding-bottom: 2px !important;
          }

          /* Standard format margins */
          [data-print-format="standard"] {
            padding: 0.5cm !important;
          }

          /* Compact format margins */
          [data-print-format="compact"] {
            padding: 0.3cm !important;
            font-size: 7px !important;
          }

          /* Grid layout - make everything single column and visible */
          .grid {
            display: block !important;
            width: 100% !important;
          }

          .lg\\:grid-cols-3,
          .lg\\:col-span-2,
          .space-y-6 {
            display: block !important;
            grid-column: auto !important;
            width: 100% !important;
            float: none !important;
            position: relative !important;
          }

          /* Card styling */
          .bg-white, .rounded-lg, .shadow {
            box-shadow: none !important;
            border: 1px solid #d1d5db;
            margin-bottom: 6px !important;
            page-break-inside: auto;
            overflow: visible !important;
            display: block !important;
            width: 100% !important;
            opacity: 1 !important;
            visibility: visible !important;
          }

          /* Standard format - cards */
          [data-print-format="standard"] .bg-white.p-6 {
            padding: 8px !important;
          }

          [data-print-format="standard"] .bg-white h2 {
            font-size: 14px !important;
            margin-bottom: 6px !important;
            padding-bottom: 2px !important;
            border-bottom: 1px solid #e5e7eb !important;
          }

          /* Compact format - cards */
          [data-print-format="compact"] .bg-white.p-6 {
            padding: 5px !important;
          }

          [data-print-format="compact"] .bg-white h2 {
            font-size: 10px !important;
            margin-bottom: 4px !important;
            padding-bottom: 2px !important;
            border-bottom: 1px solid #e5e7eb !important;
          }

          /* Hide Stock Summary and Stock by Location cards in compact format - AGGRESSIVE */
          [data-print-format="compact"] .print-compact-summary,
          [data-print-format="compact"] .print-compact-summary *,
          [data-print-format="compact"] .print-compact-location,
          [data-print-format="compact"] .print-compact-location * {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
            opacity: 0 !important;
            position: absolute !important;
            left: -9999px !important;
          }

          /* Standard format - show sidebar cards */
          [data-print-format="standard"] .print-compact-summary {
            display: block !important;
          }

          [data-print-format="standard"] .print-compact-location {
            display: block !important;
          }

          /* Hide Settings card in both formats - AGGRESSIVE */
          .print-hide-settings,
          .print-hide-settings *,
          [data-print-format="standard"] .print-hide-settings,
          [data-print-format="compact"] .print-hide-settings,
          div:has(> h2:contains("Settings")) {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
            opacity: 0 !important;
            position: absolute !important;
            left: -9999px !important;
          }

          /* Ensure all divs are visible */
          div {
            visibility: visible !important;
            opacity: 1 !important;
            max-height: none !important;
            height: auto !important;
          }

          /* Spacing adjustments - Standard Format */
          [data-print-format="standard"] .space-y-6 > *,
          [data-print-format="standard"] .space-y-6 {
            margin-bottom: 8px !important;
            display: block !important;
          }

          [data-print-format="standard"] .gap-6 {
            gap: 8px !important;
          }

          [data-print-format="standard"] .mb-6 {
            margin-bottom: 8px !important;
          }

          [data-print-format="standard"] .mb-4 {
            margin-bottom: 6px !important;
          }

          [data-print-format="standard"] .gap-4 {
            gap: 6px !important;
          }

          /* Spacing adjustments - Compact Format (ULTRA TIGHT) */
          [data-print-format="compact"] .space-y-6 > *,
          [data-print-format="compact"] .space-y-6 {
            margin-bottom: 4px !important;
            display: block !important;
          }

          [data-print-format="compact"] .gap-6 {
            gap: 4px !important;
          }

          [data-print-format="compact"] .mb-6 {
            margin-bottom: 4px !important;
          }

          [data-print-format="compact"] .mb-4 {
            margin-bottom: 3px !important;
          }

          [data-print-format="compact"] .gap-4 {
            gap: 3px !important;
          }

          /* Make sure content containers are visible */
          main, section, article {
            display: block !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            max-height: none !important;
          }

          /* Ensure product content is visible */
          [data-print-format] {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            position: relative !important;
          }

          /* Make sure all content inside is visible */
          [data-print-format] > *,
          [data-print-format] * {
            visibility: visible !important;
            opacity: 1 !important;
            max-height: none !important;
            overflow: visible !important;
          }

          /* Ensure text elements render */
          [data-print-format] p,
          [data-print-format] label,
          [data-print-format] span,
          [data-print-format] h1,
          [data-print-format] h2,
          [data-print-format] h3 {
            display: block !important;
            color: #000 !important;
          }

          [data-print-format] label {
            display: inline !important;
          }

          [data-print-format] span {
            display: inline !important;
          }

          /* Override flex layout constraints */
          .flex,
          .flex-1,
          .flex-col {
            display: block !important;
            flex: none !important;
            height: auto !important;
            max-height: none !important;
          }

          /* Override overflow constraints */
          .overflow-hidden,
          .overflow-y-auto,
          .overflow-x-auto {
            overflow: visible !important;
          }

          /* Override height constraints */
          .h-screen,
          .min-h-screen,
          .max-h-screen {
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
          }

          /* Tables - Standard Format */
          [data-print-format="standard"] table {
            page-break-inside: auto;
            width: 100% !important;
            font-size: 9px !important;
            border-collapse: collapse;
            table-layout: fixed !important;
            margin-bottom: 8px !important;
          }

          [data-print-format="standard"] th,
          [data-print-format="standard"] td {
            padding: 4px 6px !important;
            border: 1px solid #d1d5db;
            word-wrap: break-word !important;
            vertical-align: top !important;
            text-align: left !important;
            line-height: 1.3 !important;
          }

          [data-print-format="standard"] thead th {
            background-color: #10b981 !important;
            color: white !important;
            font-weight: 600 !important;
            font-size: 8px !important;
            padding: 4px 6px !important;
            white-space: normal !important;
          }

          [data-print-format="standard"] tbody td {
            font-size: 9px !important;
            padding: 4px 6px !important;
          }

          /* Tables - Compact Format */
          [data-print-format="compact"] table {
            page-break-inside: auto;
            width: 100% !important;
            font-size: 7px !important;
            border-collapse: collapse;
            table-layout: fixed !important;
            margin-bottom: 6px !important;
          }

          [data-print-format="compact"] th,
          [data-print-format="compact"] td {
            padding: 2px 3px !important;
            border: 1px solid #d1d5db;
            word-wrap: break-word !important;
            vertical-align: top !important;
            text-align: left !important;
            line-height: 1.2 !important;
          }

          [data-print-format="compact"] thead th {
            background-color: #10b981 !important;
            color: white !important;
            font-weight: 600 !important;
            font-size: 6.5px !important;
            padding: 2px 3px !important;
            white-space: normal !important;
          }

          [data-print-format="compact"] tbody td {
            font-size: 7px !important;
            padding: 2px 3px !important;
          }

          /* Common table styles */
          thead {
            display: table-header-group;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          /* Specific column widths for Product Stock Details table */
          .min-w-full th:nth-child(1),
          .min-w-full td:nth-child(1) {
            width: 12% !important;
          }

          .min-w-full th:nth-child(2),
          .min-w-full td:nth-child(2) {
            width: 10% !important;
          }

          .min-w-full th:nth-child(3),
          .min-w-full td:nth-child(3) {
            width: 11% !important;
          }

          .min-w-full th:nth-child(4),
          .min-w-full td:nth-child(4),
          .min-w-full th:nth-child(5),
          .min-w-full td:nth-child(5),
          .min-w-full th:nth-child(6),
          .min-w-full td:nth-child(6),
          .min-w-full th:nth-child(7),
          .min-w-full td:nth-child(7),
          .min-w-full th:nth-child(8),
          .min-w-full td:nth-child(8),
          .min-w-full th:nth-child(9),
          .min-w-full td:nth-child(9) {
            width: 11.5% !important;
          }

          /* Override whitespace nowrap for better wrapping */
          .whitespace-nowrap {
            white-space: normal !important;
          }

          /* Text colors */
          .text-white {
            color: white !important;
          }

          .text-gray-900 {
            color: #111827 !important;
          }

          .text-gray-600 {
            color: #4b5563 !important;
          }

          .text-blue-600 {
            color: #2563eb !important;
          }

          /* Background colors */
          .bg-emerald-500, .bg-green-600, .bg-green-500 {
            background-color: #10b981 !important;
          }

          .bg-gray-50 {
            background-color: #f9fafb !important;
          }

          .bg-blue-50 {
            background-color: #eff6ff !important;
          }

          .bg-indigo-50 {
            background-color: #eef2ff !important;
          }

          .bg-orange-50 {
            background-color: #fff7ed !important;
          }

          /* Badge colors */
          .bg-green-100 {
            background-color: #d1fae5 !important;
          }

          .text-green-800 {
            color: #065f46 !important;
          }

          .bg-purple-100 {
            background-color: #f3e8ff !important;
          }

          .text-purple-800 {
            color: #6b21a8 !important;
          }

          .bg-orange-100 {
            background-color: #ffedd5 !important;
          }

          .text-orange-800 {
            color: #9a3412 !important;
          }

          .bg-blue-100 {
            background-color: #dbeafe !important;
          }

          .text-blue-800 {
            color: #1e40af !important;
          }

          .bg-red-100 {
            background-color: #fee2e2 !important;
          }

          .text-red-800 {
            color: #991b1b !important;
          }

          .bg-gray-100 {
            background-color: #f3f4f6 !important;
          }

          .text-gray-800 {
            color: #1f2937 !important;
          }

          /* Typography - Standard Format */
          [data-print-format="standard"] h1 {
            font-size: 18px !important;
            margin-bottom: 6px !important;
            margin-top: 0 !important;
          }

          [data-print-format="standard"] h2 {
            font-size: 14px !important;
            margin-bottom: 6px !important;
            margin-top: 0 !important;
          }

          [data-print-format="standard"] .text-3xl {
            font-size: 18px !important;
          }

          [data-print-format="standard"] .text-xl {
            font-size: 14px !important;
          }

          [data-print-format="standard"] .text-lg {
            font-size: 12px !important;
          }

          [data-print-format="standard"] .text-sm {
            font-size: 9px !important;
          }

          [data-print-format="standard"] .text-xs {
            font-size: 8px !important;
          }

          /* Typography - Compact Format */
          [data-print-format="compact"] h1 {
            font-size: 14px !important;
            margin-bottom: 4px !important;
            margin-top: 0 !important;
          }

          [data-print-format="compact"] h2 {
            font-size: 10px !important;
            margin-bottom: 4px !important;
            margin-top: 0 !important;
          }

          [data-print-format="compact"] .text-3xl {
            font-size: 14px !important;
          }

          [data-print-format="compact"] .text-xl {
            font-size: 10px !important;
          }

          [data-print-format="compact"] .text-lg {
            font-size: 9px !important;
          }

          [data-print-format="compact"] .text-sm {
            font-size: 7px !important;
          }

          [data-print-format="compact"] .text-xs {
            font-size: 6.5px !important;
          }

          /* Product description box */
          .mb-3 {
            margin-bottom: 4px !important;
          }

          .border-gray-300 {
            border-color: #999 !important;
          }

          .p-2 {
            padding: 4px !important;
          }

          /* Images */
          img {
            max-width: 150px !important;
            max-height: 150px !important;
            page-break-inside: avoid;
          }

          /* Overflow handling - already covered above */

          /* Remove hover effects */
          .hover\\:bg-gray-50:hover,
          .hover\\:bg-gray-100:hover,
          .hover\\:bg-blue-700:hover {
            background-color: transparent !important;
          }

          /* Ensure content is visible - but keep intentionally hidden items hidden */
          .hidden:not(.print\\:block) {
            display: none !important;
          }

          /* Force visibility of key content sections */
          .rounded-lg,
          .bg-white,
          .shadow,
          .p-6,
          .p-4,
          .mb-6,
          .space-y-6 {
            display: block !important;
            visibility: visible !important;
          }

          /* Ensure tables and their containers are visible */
          .min-w-full,
          .divide-y,
          .divide-gray-200 {
            display: table !important;
            width: 100% !important;
            visibility: visible !important;
          }

          /* Padding resets */
          .p-6, .p-4, .p-3 {
            padding: 8px !important;
          }

          .px-6 {
            padding-left: 6px !important;
            padding-right: 6px !important;
          }

          .py-4, .py-3 {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
          }

          /* Grid adjustments */
          .grid-cols-1,
          .md\\:grid-cols-2 {
            grid-template-columns: 1fr 1fr !important;
          }

          .md\\:col-span-2 {
            grid-column: span 2 !important;
          }

          /* Hide specific sections using custom classes */
          .print-hide-settings {
            display: none !important;
          }

          /* Make Stock by Location more compact - 2 columns */
          .print-compact-location .space-y-3 {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            column-gap: 15px !important;
          }

          .print-compact-location .space-y-3 > div {
            margin-bottom: 0 !important;
          }

          /* Stock Summary - make more compact */
          .print-compact-summary {
            display: inline-block !important;
            width: auto !important;
            min-width: 300px !important;
            max-width: 400px !important;
          }

          /* Clean up product title area */
          .mb-6 .flex.items-center.justify-between {
            margin-bottom: 10px !important;
          }

          .mb-6 .flex.items-center.justify-between .text-gray-600 {
            display: none !important;
          }

          /* SUPER AGGRESSIVE - Hide by class patterns */
          .mb-6.print\\:hidden,
          div.mb-6:has(button),
          .flex.space-x-3,
          .flex.items-center.space-x-4,
          .bg-green-600,
          .bg-emerald-600,
          .bg-blue-600 {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            overflow: hidden !important;
            opacity: 0 !important;
            position: absolute !important;
          }

          /* Hide specific text content */
          div:has(> .flex > button),
          div:has(> div > button) {
            display: none !important;
          }
        }
      `}</style>

      {/* Print Header - Business Name (only visible in print) */}
      <div className="hidden print:block mb-2">
        <h1 className="text-xl font-bold text-gray-900 text-center border-b-2 border-gray-800 pb-1">
          {businessName}
        </h1>
      </div>

      {/* Print Product Title (only visible in print) */}
      <div className="hidden print:block mb-2">
        <h2 className="text-lg font-semibold text-gray-800">
          {product.name}
        </h2>
      </div>

      {/* Header */}
      <div className="mb-6 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors print:hidden"
            >
              <ArrowLeftIcon className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
              <p className="text-gray-600 mt-1">Product Details</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handlePrintStandard}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors print:hidden"
            >
              <PrinterIcon className="w-5 h-5 mr-2" />
              Print Standard
            </button>
            <button
              onClick={handlePrintCompact}
              className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors print:hidden"
            >
              <PrinterIcon className="w-5 h-5 mr-2" />
              Print Compact
            </button>
            {can(PERMISSIONS.PRODUCT_UPDATE) && (
              <Link
                href={`/dashboard/products/${product.id}/edit`}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors print:hidden"
              >
                <PencilIcon className="w-5 h-5 mr-2" />
                Edit Product
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Compact Print Layout - Only visible in print */}
      <div className="hidden print-compact-info">
        <div>
          <label>SKU:</label> <p>{product.sku}</p>
        </div>
        <div>
          <label>Brand:</label> <p>{product.brand?.name || '--'}</p>
        </div>
        <div>
          <label>Unit:</label> <p>{product.unit ? `${product.unit.name} (${product.unit.shortName})` : '--'}</p>
        </div>
        <div>
          <label>Barcode type:</label> <p>--</p>
        </div>
        <div>
          <label>Category:</label> <p>{product.category?.name || '--'}</p>
        </div>
        <div>
          <label>Sub category:</label> <p>--</p>
        </div>
        <div>
          <label>Manage Stock:</label> <p>{product.enableStock ? 'Yes' : 'No'}</p>
        </div>
        <div>
          <label>Alert Quantity:</label> <p>{product.alertQuantity || '--'}</p>
        </div>
        <div>
          <label>Expires in:</label> <p>--</p>
        </div>
        <div>
          <label>Applicable Tax:</label> <p>{product.tax ? `${product.tax.name} (${product.tax.amount}%)` : '--'}</p>
        </div>
        <div>
          <label>Selling Price Tax Type:</label> <p>{product.taxType || '--'}</p>
        </div>
        <div>
          <label>Product Type:</label> <p>{product.type}</p>
        </div>
      </div>

      {/* Product Description for Print */}
      {product.productDescription && (
        <div className="hidden print:block mb-3">
          <div className="border border-gray-300 p-2">
            <label className="font-semibold text-xs">Product Description:</label>
            <p className="text-xs mt-1">{product.productDescription}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Product Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info & Pricing side by side for print */}
          <div className="print-side-by-side space-y-6">
            {/* Basic Information Card */}
            <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <CubeIcon className="w-6 h-6 mr-2 text-blue-600" />
              Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {product.image && (
                <div className="md:col-span-2">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-48 w-48 object-cover rounded-lg border border-gray-200"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-600">SKU</label>
                <p className="mt-1 text-gray-900 font-mono">{product.sku}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Product Type</label>
                <p className="mt-1">
                  <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${
                    product.type === 'single' ? 'bg-green-100 text-green-800' :
                    product.type === 'variable' ? 'bg-purple-100 text-purple-800' :
                    'bg-orange-100 text-orange-800'
                  }`}>
                    {product.type}
                  </span>
                </p>
              </div>
              {product.category && (
                <div>
                  <label className="block text-sm font-medium text-gray-600">Category</label>
                  <p className="mt-1 text-gray-900">{product.category.name}</p>
                </div>
              )}
              {product.brand && (
                <div>
                  <label className="block text-sm font-medium text-gray-600">Brand</label>
                  <p className="mt-1 text-gray-900">{product.brand.name}</p>
                </div>
              )}
              {product.unit && (
                <div>
                  <label className="block text-sm font-medium text-gray-600">Unit</label>
                  <p className="mt-1 text-gray-900">{product.unit.name} ({product.unit.shortName})</p>
                </div>
              )}
              {product.weight && (
                <div>
                  <label className="block text-sm font-medium text-gray-600">Weight</label>
                  <p className="mt-1 text-gray-900">{product.weight}</p>
                </div>
              )}
              {product.description && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-600">Description</label>
                  <p className="mt-1 text-gray-900">{product.description}</p>
                </div>
              )}
              {product.productDescription && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-600">Product Description</label>
                  <p className="mt-1 text-gray-900">{product.productDescription}</p>
                </div>
              )}
            </div>
          </div>

          {/* Pricing & Tax Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <CurrencyDollarIcon className="w-6 h-6 mr-2 text-green-600" />
              Pricing & Tax
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {can(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE) && product.purchasePrice && (
                <div>
                  <label className="block text-sm font-medium text-gray-600">Purchase Price</label>
                  <p className="mt-1 text-gray-900 text-lg font-semibold">
                    ${parseFloat(product.purchasePrice.toString()).toFixed(2)}
                  </p>
                </div>
              )}
              {product.sellingPrice && (
                <div>
                  <label className="block text-sm font-medium text-gray-600">Selling Price</label>
                  <p className="mt-1 text-gray-900 text-lg font-semibold">
                    ${parseFloat(product.sellingPrice.toString()).toFixed(2)}
                  </p>
                </div>
              )}
              {product.tax && (
                <div>
                  <label className="block text-sm font-medium text-gray-600">Tax</label>
                  <p className="mt-1 text-gray-900">
                    {product.tax.name} ({product.tax.amount}%)
                  </p>
                </div>
              )}
              {product.taxType && (
                <div>
                  <label className="block text-sm font-medium text-gray-600">Tax Type</label>
                  <p className="mt-1 text-gray-900 capitalize">{product.taxType}</p>
                </div>
              )}
            </div>
          </div>
          </div>

          {/* Pricing Table */}
          {product.type === 'single' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-emerald-500">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Default Purchase Price (Exc. tax)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Default Purchase Price (Inc. tax)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        x Margin(%)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Default Selling Price (Exc. tax)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Default Selling Price (Inc. tax)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Variation Images
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {can(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE) && product.purchasePrice ? (
                          `Php ${parseFloat(product.purchasePrice.toString()).toFixed(2)}`
                        ) : '--'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {can(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE) && product.purchasePrice && product.tax ? (
                          `Php ${(parseFloat(product.purchasePrice.toString()) * (1 + parseFloat(product.tax.amount.toString()) / 100)).toFixed(2)}`
                        ) : '--'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.purchasePrice && product.sellingPrice ? (
                          `${(((parseFloat(product.sellingPrice.toString()) - parseFloat(product.purchasePrice.toString())) / parseFloat(product.purchasePrice.toString())) * 100).toFixed(2)}`
                        ) : '--'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.sellingPrice ? `Php ${parseFloat(product.sellingPrice.toString()).toFixed(2)}` : '--'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.sellingPrice && product.tax ? (
                          `Php ${(parseFloat(product.sellingPrice.toString()) * (1 + parseFloat(product.tax.amount.toString()) / 100)).toFixed(2)}`
                        ) : product.sellingPrice ? `Php ${parseFloat(product.sellingPrice.toString()).toFixed(2)}` : '--'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        --
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Product Stock Details Table */}
          {product.enableStock && stockDetails.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <h2 className="text-xl font-semibold text-gray-900 p-6 pb-4">Product Stock Details</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-emerald-500">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Current stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Current Stock Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Total unit sold
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Total Unit Transferred
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Total Unit Adjusted
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stockDetails.map((detail, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {detail.sku}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {detail.productName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {detail.locationName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          Php {detail.unitPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {detail.currentStock.toFixed(2)}Pc(s)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          Php {detail.stockValue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {detail.totalUnitSold.toFixed(2)}Pc(s)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {detail.totalUnitTransferred.toFixed(2)}Pc(s)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {detail.totalUnitAdjusted.toFixed(2)}Pc(s)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Variations Card */}
          {product.type === 'variable' && product.variations.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <TagIcon className="w-6 h-6 mr-2 text-purple-600" />
                Variations
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                      {can(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE) && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Price</th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Selling Price</th>
                      {product.enableStock && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {product.variations.map(variation => (
                      <tr key={variation.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{variation.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-mono">{variation.sku}</td>
                        {can(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE) && (
                          <td className="px-4 py-3 text-sm text-gray-900">
                            ${parseFloat(variation.purchasePrice.toString()).toFixed(2)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm text-gray-900">
                          ${parseFloat(variation.sellingPrice.toString()).toFixed(2)}
                        </td>
                        {product.enableStock && (
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {variation.variationLocationDetails.reduce(
                              (sum, detail) => sum + parseFloat(detail.qtyAvailable.toString()),
                              0
                            ).toFixed(2)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm">
                          {variation.isDefault && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              Default
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Combo Products Card */}
          {product.type === 'combo' && product.comboProducts.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Combo Items</h2>
              <div className="space-y-3">
                {product.comboProducts.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{item.childProduct.name}</p>
                      <p className="text-sm text-gray-600 font-mono">{item.childProduct.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Quantity</p>
                      <p className="font-semibold text-gray-900">
                        {parseFloat(item.quantity.toString())} {item.childProduct.unit?.shortName || ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stock Summary Card */}
          {product.enableStock && (
            <div className="bg-white rounded-lg shadow p-6 print-compact-summary">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <ChartBarIcon className="w-6 h-6 mr-2 text-indigo-600" />
                Stock Summary
              </h2>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Stock</p>
                  <p className="text-3xl font-bold text-gray-900">{getTotalStock()}</p>
                  {product.unit && (
                    <p className="text-sm text-gray-600">{product.unit.shortName}</p>
                  )}
                </div>
                {product.alertQuantity && (
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-gray-600">Alert Quantity</p>
                    <p className="text-xl font-bold text-orange-600">
                      {parseFloat(product.alertQuantity.toString())}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stock by Location Card */}
          {product.enableStock && locations.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 print-compact-location">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <BuildingStorefrontIcon className="w-6 h-6 mr-2 text-green-600" />
                Stock by Location
              </h2>
              <div className="space-y-3">
                {locations.map(location => {
                  const stock = getLocationStock(location.id)
                  return (
                    <div key={location.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-900">{location.name}</p>
                      <p className="text-sm font-bold text-gray-900">{stock}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Settings Card */}
          <div className="bg-white rounded-lg shadow p-6 print-hide-settings">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Settings</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Stock Enabled</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  product.enableStock ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {product.enableStock ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Not for Selling</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  product.notForSelling ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}>
                  {product.notForSelling ? 'Yes' : 'No'}
                </span>
              </div>
              {product.preparationTime && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Preparation Time</span>
                  <span className="text-sm font-medium text-gray-900">{product.preparationTime} min</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
