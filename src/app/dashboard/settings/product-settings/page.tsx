"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function ProductSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    skuPrefix: 'PROD',
    skuFormat: 'hyphen',
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
          skuPrefix: data.business.skuPrefix || 'PROD',
          skuFormat: data.business.skuFormat || 'hyphen',
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
        alert('Product settings saved successfully')
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
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Settings
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Product Settings</h1>
        <p className="text-gray-600 mt-1">Configure product and SKU generation settings</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <div className="space-y-6">
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">SKU Generation Settings</h3>
            <p className="text-sm text-gray-600">
              Configure how product SKUs are automatically generated when left blank
            </p>
          </div>

          {/* SKU Prefix */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              SKU Prefix
            </label>
            <input
              type="text"
              value={settings.skuPrefix}
              onChange={(e) => setSettings({ ...settings, skuPrefix: e.target.value.toUpperCase() })}
              placeholder="e.g., PROD, AS, SKU"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              maxLength={10}
            />
            <p className="mt-1 text-sm text-gray-500">
              Prefix used for auto-generated SKUs. Leave empty for no prefix.
            </p>
          </div>

          {/* SKU Format */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              SKU Format
            </label>
            <div className="space-y-3">
              <label className="flex items-start p-3 rounded-lg hover:bg-gray-50 cursor-pointer border-2 transition-colors duration-150 ease-in-out"
                style={{ borderColor: settings.skuFormat === 'hyphen' ? '#3B82F6' : '#E5E7EB' }}
              >
                <input
                  type="radio"
                  name="skuFormat"
                  value="hyphen"
                  checked={settings.skuFormat === 'hyphen'}
                  onChange={(e) => setSettings({ ...settings, skuFormat: e.target.value })}
                  className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">With Hyphen</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Example: <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">PROD-0001</span>, <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">PROD-0002</span>
                  </div>
                </div>
              </label>

              <label className="flex items-start p-3 rounded-lg hover:bg-gray-50 cursor-pointer border-2 transition-colors duration-150 ease-in-out"
                style={{ borderColor: settings.skuFormat === 'no_hyphen' ? '#3B82F6' : '#E5E7EB' }}
              >
                <input
                  type="radio"
                  name="skuFormat"
                  value="no_hyphen"
                  checked={settings.skuFormat === 'no_hyphen'}
                  onChange={(e) => setSettings({ ...settings, skuFormat: e.target.value })}
                  className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">Without Hyphen</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Example: <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">PROD0001</span>, <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">PROD0002</span>
                  </div>
                </div>
              </label>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              This format will be used when SKU is left blank during product creation
            </p>
          </div>

          {/* Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Preview</h4>
            <p className="text-sm text-blue-800">
              Your next auto-generated SKU will look like:{' '}
              <span className="font-mono font-semibold bg-white px-2 py-1 rounded border border-blue-300">
                {settings.skuPrefix || 'PROD'}{settings.skuFormat === 'hyphen' ? '-' : ''}0001
              </span>
            </p>
          </div>

          <div className="pt-6 border-t">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
