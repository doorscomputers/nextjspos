"use client"

import { useState, useEffect } from 'react'

export default function InvoiceSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    invoiceScheme: '',
    invoiceLayoutForPOS: '',
    invoiceLayoutForSale: '',
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
          invoiceScheme: data.business.invoiceScheme || '',
          invoiceLayoutForPOS: data.business.invoiceLayoutForPOS || '',
          invoiceLayoutForSale: data.business.invoiceLayoutForSale || '',
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
        alert('Invoice settings saved successfully')
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
        <h1 className="text-3xl font-bold text-gray-900">Invoice Settings</h1>
        <p className="text-gray-600 mt-1">Configure invoice numbering and layouts</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invoice Scheme
            </label>
            <select
              value={settings.invoiceScheme}
              onChange={(e) => setSettings({ ...settings, invoiceScheme: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            >
              <option value="">Blank (Sequential numbers only)</option>
              <option value="year">Year (e.g., 2025-0001)</option>
              <option value="business_location_id">Business Location ID (e.g., BL1-0001)</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Choose how invoice numbers should be formatted
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invoice Layout for POS
            </label>
            <select
              value={settings.invoiceLayoutForPOS}
              onChange={(e) => setSettings({ ...settings, invoiceLayoutForPOS: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            >
              <option value="">Default Layout</option>
              <option value="compact">Compact Layout</option>
              <option value="detailed">Detailed Layout</option>
              <option value="thermal">Thermal Printer (58mm)</option>
              <option value="thermal_80">Thermal Printer (80mm)</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Template used for POS invoices
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invoice Layout for Sale
            </label>
            <select
              value={settings.invoiceLayoutForSale}
              onChange={(e) => setSettings({ ...settings, invoiceLayoutForSale: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            >
              <option value="">Default Layout</option>
              <option value="compact">Compact Layout</option>
              <option value="detailed">Detailed Layout</option>
              <option value="professional">Professional Layout</option>
              <option value="classic">Classic Layout</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Template used for regular sales invoices
            </p>
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
