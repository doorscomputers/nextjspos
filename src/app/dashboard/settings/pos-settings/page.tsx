"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'

export default function POSSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    enableSeniorPwdDiscount: false,
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
          enableSeniorPwdDiscount: data.business.enableSeniorPwdDiscount || false,
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
        alert('POS settings saved successfully')
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">POS Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Configure Point of Sale settings and discount options</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-2xl">
        <div className="space-y-6">
          <div className="border-b dark:border-gray-700 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Discount Settings</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Configure discount options available in the POS
            </p>
          </div>

          {/* Senior/PWD Discount Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-900 dark:text-white">
                Enable Senior Citizen / PWD Discount
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                When enabled, cashiers can apply Senior Citizen or PWD discounts at checkout.
                This is a sale-level discount that applies on top of any per-item discounts.
              </p>
            </div>
            <Switch
              checked={settings.enableSeniorPwdDiscount}
              onCheckedChange={(checked) => setSettings({ ...settings, enableSeniorPwdDiscount: checked })}
              className="ml-4"
            />
          </div>

          {settings.enableSeniorPwdDiscount && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>How it works:</strong> When this is enabled, the "Discount Type" dropdown will appear
                in the POS payment panel. Cashiers can select Senior Citizen or PWD discount, which will be
                applied to the total <strong>after</strong> any per-item discounts are deducted.
              </p>
            </div>
          )}

          {/* Save Button */}
          <div className="pt-4 border-t dark:border-gray-700">
            <Button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
