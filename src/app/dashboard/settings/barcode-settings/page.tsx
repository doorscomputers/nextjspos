"use client"

import { useState, useEffect } from 'react'

export default function BarcodeSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    barcodeProductSKU: true,
    barcodeProductName: false,
    barcodeBusinessName: true,
    barcodeProductVariation: false,
    barcodeProductPrice: true,
    barcodePackingDate: false,
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/business/settings')
      const data = await response.json()
      if (response.ok && data.business) {
        setSettings({
          barcodeProductSKU: data.business.barcodeProductSKU ?? true,
          barcodeProductName: data.business.barcodeProductName ?? false,
          barcodeBusinessName: data.business.barcodeBusinessName ?? true,
          barcodeProductVariation: data.business.barcodeProductVariation ?? false,
          barcodeProductPrice: data.business.barcodeProductPrice ?? true,
          barcodePackingDate: data.business.barcodePackingDate ?? false,
        })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/business/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        alert('Barcode settings saved successfully')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-center">Loading settings...</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Barcode Settings</h1>
        <p className="text-gray-600 mt-1">Configure what information to display on barcodes</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <div className="space-y-4">
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Barcode Information</h3>
            <p className="text-sm text-gray-600 mb-4">
              Select which information should be displayed on product barcodes
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.barcodeProductSKU}
                onChange={(e) => setSettings({ ...settings, barcodeProductSKU: e.target.checked })}
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">Product SKU</div>
                <div className="text-xs text-gray-500">Display the product SKU code on barcode</div>
              </div>
            </label>

            <label className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.barcodeProductName}
                onChange={(e) => setSettings({ ...settings, barcodeProductName: e.target.checked })}
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">Product Name</div>
                <div className="text-xs text-gray-500">Display the product name on barcode</div>
              </div>
            </label>

            <label className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.barcodeBusinessName}
                onChange={(e) => setSettings({ ...settings, barcodeBusinessName: e.target.checked })}
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">Business Name</div>
                <div className="text-xs text-gray-500">Display the business name on barcode</div>
              </div>
            </label>

            <label className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.barcodeProductVariation}
                onChange={(e) => setSettings({ ...settings, barcodeProductVariation: e.target.checked })}
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">Product Variation</div>
                <div className="text-xs text-gray-500">Display product variation details (e.g., size, color)</div>
              </div>
            </label>

            <label className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.barcodeProductPrice}
                onChange={(e) => setSettings({ ...settings, barcodeProductPrice: e.target.checked })}
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">Product Price</div>
                <div className="text-xs text-gray-500">Display the selling price on barcode</div>
              </div>
            </label>

            <label className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.barcodePackingDate}
                onChange={(e) => setSettings({ ...settings, barcodePackingDate: e.target.checked })}
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">Packing Date</div>
                <div className="text-xs text-gray-500">Display the packing/manufacturing date</div>
              </div>
            </label>
          </div>

          <div className="pt-6 border-t">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
