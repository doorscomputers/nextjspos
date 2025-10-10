'use client'

import { useState, useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

interface Product {
  id: number
  name: string
  sku: string | null
  category: { name: string } | null
  brand: { name: string } | null
  variations: Array<{
    id: number
    name: string
    sku: string | null
    sellingPrice: number
  }>
}

interface Label {
  productId: number
  productName: string | null
  variationId: number | null
  variationName: string | null
  sku: string
  barcodeValue: string
  barcodeFormat: string
  price: number | null
  category: string | null
  brand: string | null
  unit: string | null
  copies: number
}

const BARCODE_FORMATS = [
  { value: 'CODE128', label: 'Code 128 (Alphanumeric)', description: 'Most versatile, supports letters and numbers' },
  { value: 'CODE39', label: 'Code 39 (Alphanumeric)', description: 'Legacy format, widely supported' },
  { value: 'EAN13', label: 'EAN-13 (13 digits)', description: 'European Article Number, retail standard' },
  { value: 'EAN8', label: 'EAN-8 (8 digits)', description: 'Compact version of EAN-13' },
  { value: 'UPC', label: 'UPC (12 digits)', description: 'Universal Product Code, USA/Canada standard' },
  { value: 'ITF14', label: 'ITF-14 (14 digits)', description: 'Shipping containers' },
]

export default function GenerateLabelsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set())
  const [barcodeFormat, setBarcodeFormat] = useState('CODE128')
  const [autoGenerateSKU, setAutoGenerateSKU] = useState(true)
  const [includePrice, setIncludePrice] = useState(true)
  const [includeProductName, setIncludeProductName] = useState(true)
  const [copies, setCopies] = useState(1)
  const [loading, setLoading] = useState(false)
  const [generatedLabels, setGeneratedLabels] = useState<Label[]>([])
  const [showWithoutSKU, setShowWithoutSKU] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProducts()
  }, [showWithoutSKU])

  useEffect(() => {
    // Generate barcodes after labels are created
    if (generatedLabels.length > 0) {
      setTimeout(() => {
        generatedLabels.forEach((label, index) => {
          const canvas = document.getElementById(`barcode-${index}`)
          if (canvas) {
            try {
              JsBarcode(canvas, label.barcodeValue, {
                format: label.barcodeFormat,
                width: 2,
                height: 50,
                displayValue: true,
                fontSize: 12,
                margin: 5,
              })
            } catch (error) {
              console.error('Error generating barcode:', error)
            }
          }
        })
      }, 100)
    }
  }, [generatedLabels])

  const fetchProducts = async () => {
    try {
      const url = showWithoutSKU
        ? '/api/labels/generate?withoutSKU=true&limit=100'
        : '/api/labels/generate?limit=100'

      const response = await fetch(url)
      const data = await response.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const toggleProductSelection = (productId: number) => {
    const newSelection = new Set(selectedProducts)
    if (newSelection.has(productId)) {
      newSelection.delete(productId)
    } else {
      newSelection.add(productId)
    }
    setSelectedProducts(newSelection)
  }

  const selectAll = () => {
    setSelectedProducts(new Set(products.map(p => p.id)))
  }

  const deselectAll = () => {
    setSelectedProducts(new Set())
  }

  const generateLabels = async () => {
    if (selectedProducts.size === 0) {
      alert('Please select at least one product')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/labels/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: Array.from(selectedProducts),
          barcodeFormat,
          autoGenerateSKU,
          includePrice,
          includeProductName,
          copies,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate labels')
      }

      setGeneratedLabels(data.labels || [])
      alert(`✅ Generated ${data.totalLabels} labels successfully!`)

      // Refresh products if SKUs were generated
      if (data.updatedProducts && data.updatedProducts.length > 0) {
        fetchProducts()
      }
    } catch (error) {
      console.error('Error generating labels:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate labels')
    } finally {
      setLoading(false)
    }
  }

  const printLabels = () => {
    if (generatedLabels.length === 0) {
      alert('No labels to print. Generate labels first.')
      return
    }

    window.print()
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Generate Barcode Labels</h1>
          <p className="text-gray-600 mt-2">
            Create barcode labels for products. Automatically generate SKUs for products that don't have them.
          </p>
        </div>

        {/* Configuration Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Label Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Barcode Format Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Barcode Format *
              </label>
              <select
                value={barcodeFormat}
                onChange={(e) => setBarcodeFormat(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {BARCODE_FORMATS.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                {BARCODE_FORMATS.find(f => f.value === barcodeFormat)?.description}
              </p>
            </div>

            {/* Copies */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Copies per Label
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={copies}
                onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Options */}
          <div className="mt-6 space-y-3">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={autoGenerateSKU}
                onChange={(e) => setAutoGenerateSKU(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Auto-generate SKUs for products without them
              </span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={includeProductName}
                onChange={(e) => setIncludeProductName(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Include product name on label
              </span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={includePrice}
                onChange={(e) => setIncludePrice(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Include price on label
              </span>
            </label>
          </div>
        </div>

        {/* Product Selection Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Select Products ({selectedProducts.size} selected)
            </h2>

            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showWithoutSKU}
                  onChange={(e) => setShowWithoutSKU(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Without SKU only</span>
              </label>

              <button
                onClick={selectAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Deselect All
              </button>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {showWithoutSKU
                ? 'No products without SKUs found. All products have barcodes!'
                : 'No products found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Select
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Variations
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        {product.brand && (
                          <div className="text-xs text-gray-500">{product.brand.name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {product.sku ? (
                          <span className="text-sm text-gray-900">{product.sku}</span>
                        ) : (
                          <span className="text-sm text-red-500 italic">No SKU</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {product.category?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {product.variations.length} variation(s)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-4 mb-6">
          <button
            onClick={generateLabels}
            disabled={loading || selectedProducts.size === 0}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Generating...' : `Generate ${selectedProducts.size} Label(s)`}
          </button>

          {generatedLabels.length > 0 && (
            <button
              onClick={printLabels}
              className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
            >
              Print Labels
            </button>
          )}
        </div>

        {/* Generated Labels Preview (Screen Only) */}
        {generatedLabels.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 print:hidden">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Generated Labels ({generatedLabels.length})
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Preview of labels. Click "Print Labels" to print them.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {generatedLabels.map((label, index) => (
                <div key={index} className="border border-gray-300 rounded p-4 bg-gray-50">
                  {label.productName && (
                    <div className="text-sm font-medium text-gray-900 mb-2 truncate">
                      {label.productName}
                      {label.variationName && ` - ${label.variationName}`}
                    </div>
                  )}
                  <svg id={`barcode-${index}`} className="w-full"></svg>
                  {label.price && (
                    <div className="text-lg font-bold text-gray-900 mt-2 text-center">
                      ${label.price.toFixed(2)}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-1 text-center">
                    Copies: {label.copies}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Print Layout (Print Only) */}
        <div className="hidden print:block" ref={printRef}>
          <style jsx global>{`
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              .print-label {
                page-break-inside: avoid;
                width: 2.5in;
                height: 1.5in;
                padding: 0.1in;
                border: 1px solid #ccc;
                display: inline-block;
                margin: 0.1in;
                text-align: center;
              }
              .print-label-name {
                font-size: 10pt;
                font-weight: bold;
                margin-bottom: 2px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
              .print-label-price {
                font-size: 14pt;
                font-weight: bold;
                margin-top: 2px;
              }
            }
          `}</style>

          {generatedLabels.flatMap((label, index) =>
            Array.from({ length: label.copies }, (_, copyIndex) => (
              <div key={`${index}-${copyIndex}`} className="print-label">
                {label.productName && (
                  <div className="print-label-name">
                    {label.productName}
                    {label.variationName && ` - ${label.variationName}`}
                  </div>
                )}
                <svg id={`print-barcode-${index}-${copyIndex}`}></svg>
                {label.price && (
                  <div className="print-label-price">${label.price.toFixed(2)}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
