'use client'

import { useEffect, useState } from 'react'
import { ClockIcon, InformationCircleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'

interface InactivitySettings {
  enabled: boolean
  superAdminTimeout: number
  adminTimeout: number
  managerTimeout: number
  cashierTimeout: number
  defaultTimeout: number
  warningTime: number
  warningMessage: string | null
}

export default function InactivitySettingsPage() {
  const [settings, setSettings] = useState<InactivitySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings/inactivity')
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
      } else {
        setMessage({ type: 'error', text: 'Failed to load inactivity settings' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error loading settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings) return

    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings/inactivity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: '✅ Inactivity timeout settings saved successfully! Changes will apply on next page load.' })
        setSettings(data.settings)
        toast.success('Settings Saved Successfully!', {
          description: 'Inactivity timeout settings have been updated. Changes will apply on next page load.',
          duration: 5000,
        })
      } else {
        setMessage({ type: 'error', text: `❌ ${data.error || 'Failed to save'}` })
        toast.error('Failed to Save Settings', {
          description: data.error || 'An error occurred while saving your settings. Please try again.',
          duration: 5000,
        })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Error saving settings' })
      toast.error('Error Saving Settings', {
        description: 'A network error occurred. Please check your connection and try again.',
        duration: 5000,
      })
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key: keyof InactivitySettings, value: any) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300">Loading inactivity settings...</p>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="p-8">
        <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 p-4 rounded-lg">
          Failed to load settings. Please try refreshing the page.
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <ClockIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Inactivity Timeout Settings
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-300">
          Configure automatic logout settings to protect your system from unauthorized access when users leave their workstations.
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Info Card */}
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex gap-3">
          <InformationCircleIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Why use inactivity timeout?</h3>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>🔒 <strong>Security</strong>: Automatically logs out inactive users to prevent unauthorized access</li>
              <li>💰 <strong>Fraud Prevention</strong>: Reduces risk of unauthorized transactions on unattended terminals</li>
              <li>📊 <strong>Audit Compliance</strong>: Ensures actions are performed by the correct user</li>
              <li>🛒 <strong>POS Protection</strong>: Especially important for cashier terminals in public areas</li>
              <li>⚖️ <strong>Regulatory</strong>: Many industries require automatic logout for compliance</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Settings Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        {/* Master Toggle */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheckIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Enable Inactivity Timeout
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {settings.enabled
                    ? 'Automatic logout is enabled for all users'
                    : 'Automatic logout is disabled - users stay logged in indefinitely'}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => updateSetting('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
            </label>
          </div>
        </div>

        {/* Timeout Settings */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Role-Based Timeout Duration (minutes)
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            Set different timeout periods based on user roles. Higher-level roles typically get longer timeout periods.
          </p>

          <div className="space-y-4">
            {/* Super Admin */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Super Admin / System Administrator
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">Recommended: 60 minutes</p>
              </div>
              <input
                type="number"
                min="5"
                max="480"
                value={settings.superAdminTimeout}
                onChange={(e) => updateSetting('superAdminTimeout', parseInt(e.target.value))}
                disabled={!settings.enabled}
                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              />
            </div>

            {/* Admin */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Admin
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">Recommended: 45 minutes</p>
              </div>
              <input
                type="number"
                min="5"
                max="480"
                value={settings.adminTimeout}
                onChange={(e) => updateSetting('adminTimeout', parseInt(e.target.value))}
                disabled={!settings.enabled}
                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              />
            </div>

            {/* Manager */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Manager
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">Recommended: 30 minutes</p>
              </div>
              <input
                type="number"
                min="5"
                max="480"
                value={settings.managerTimeout}
                onChange={(e) => updateSetting('managerTimeout', parseInt(e.target.value))}
                disabled={!settings.enabled}
                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              />
            </div>

            {/* Cashier */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Cashier
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">Recommended: 15 minutes (for POS security)</p>
              </div>
              <input
                type="number"
                min="5"
                max="480"
                value={settings.cashierTimeout}
                onChange={(e) => updateSetting('cashierTimeout', parseInt(e.target.value))}
                disabled={!settings.enabled}
                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              />
            </div>

            {/* Default */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Default (Other Roles)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">Recommended: 30 minutes</p>
              </div>
              <input
                type="number"
                min="5"
                max="480"
                value={settings.defaultTimeout}
                onChange={(e) => updateSetting('defaultTimeout', parseInt(e.target.value))}
                disabled={!settings.enabled}
                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Warning Settings */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Warning Before Logout
          </h3>

          <div className="space-y-4">
            {/* Warning Time */}
            <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Warning Time (minutes)
                </label>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Show warning this many minutes before logout (1-10 minutes)
                </p>
              </div>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.warningTime}
                onChange={(e) => updateSetting('warningTime', parseInt(e.target.value))}
                disabled={!settings.enabled}
                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              />
            </div>

            {/* Warning Message */}
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Custom Warning Message (optional)
              </label>
              <textarea
                rows={3}
                value={settings.warningMessage || ''}
                onChange={(e) => updateSetting('warningMessage', e.target.value || null)}
                disabled={!settings.enabled}
                placeholder="You have been inactive. You will be logged out soon for security reasons."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Leave blank to use default message
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="p-6 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={saving || !settings}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Security Tips */}
      <div className="mt-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
          <ShieldCheckIcon className="w-5 h-5" />
          Security Best Practices
        </h3>
        <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
          <li>✅ Use shorter timeouts (10-15 min) for POS/cashier terminals in public areas</li>
          <li>✅ Adjust timeouts based on role sensitivity and location security</li>
          <li>✅ Test the timeout with different roles before deploying to all users</li>
          <li>✅ Train staff to manually lock their screen when stepping away</li>
          <li>✅ Consider physical security measures (screen position, camera monitoring)</li>
        </ul>
      </div>
    </div>
  )
}
