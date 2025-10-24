'use client'

import { useEffect, useState } from 'react'
import { ShieldCheckIcon, ShieldExclamationIcon, InformationCircleIcon, UserGroupIcon } from '@heroicons/react/24/outline'

interface SODSettings {
  // Transfer SOD
  enforceTransferSOD: boolean
  allowCreatorToCheck: boolean
  allowCreatorToSend: boolean
  allowCheckerToSend: boolean
  // allowSenderToCheck: boolean // TEMPORARILY DISABLED - Need Prisma regeneration
  allowCreatorToReceive: boolean
  allowSenderToComplete: boolean
  allowCreatorToComplete: boolean
  allowReceiverToComplete: boolean

  // Purchase SOD
  enforcePurchaseSOD: boolean
  allowAmendmentCreatorToApprove: boolean
  allowPOCreatorToApprove: boolean
  allowGRNCreatorToApprove: boolean

  // Return SOD
  enforceReturnSOD: boolean
  allowCustomerReturnCreatorToApprove: boolean
  allowSupplierReturnCreatorToApprove: boolean

  // General
  exemptRoles: string
  minStaffWarningThreshold: number
}

export default function SODRulesPage() {
  const [settings, setSettings] = useState<SODSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings/sod-rules')
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
      } else {
        setMessage({ type: 'error', text: 'Failed to load SOD settings' })
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
      const res = await fetch('/api/settings/sod-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: '✅ SOD rules saved successfully!' })
        setSettings(data.settings)
      } else {
        setMessage({ type: 'error', text: `❌ ${data.error || 'Failed to save'}` })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Error saving settings' })
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key: keyof SODSettings, value: any) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300">Loading SOD settings...</p>
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
          <ShieldCheckIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Separation of Duties (SOD) Rules
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-300">
          Configure business rules for who can perform approval actions. These settings help prevent fraud by requiring different people for different steps.
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
            <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">When to adjust these settings?</h3>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>🏢 <strong>Small locations</strong> with 1-2 staff: Enable exceptions to avoid workflow blocks</li>
              <li>🏛️ <strong>Large locations</strong> with many staff: Keep strict separation for security and compliance</li>
              <li>⚖️ <strong>Regulatory requirements</strong>: Some industries require strict SOD (finance, pharma)</li>
              <li>🔄 <strong>Temporary shortages</strong>: Temporarily enable exceptions when staff is on leave</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* TRANSFER SOD RULES */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-2 rounded-lg ${
              settings.enforceTransferSOD
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-yellow-100 dark:bg-yellow-900/30'
            }`}>
              {settings.enforceTransferSOD ? (
                <ShieldCheckIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : (
                <ShieldExclamationIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Stock Transfer Rules
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Control who can perform transfer actions (Create → Check → Send → Receive → Complete)
              </p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enforce Transfer SOD</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings.enforceTransferSOD}
                  onChange={(e) => updateSetting('enforceTransferSOD', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToggleSetting
              label="Allow Creator to Check"
              description="Creator can check/approve their own transfer"
              checked={settings.allowCreatorToCheck}
              onChange={(val) => updateSetting('allowCreatorToCheck', val)}
              disabled={!settings.enforceTransferSOD}
            />
            <ToggleSetting
              label="Allow Creator to Send"
              description="Creator can send their own transfer"
              checked={settings.allowCreatorToSend}
              onChange={(val) => updateSetting('allowCreatorToSend', val)}
              disabled={!settings.enforceTransferSOD}
            />
            <ToggleSetting
              label="Allow Checker to Send"
              description="Person who checked can also send"
              checked={settings.allowCheckerToSend}
              onChange={(val) => updateSetting('allowCheckerToSend', val)}
              disabled={!settings.enforceTransferSOD}
            />
            {/* TEMPORARILY HIDDEN - Need to regenerate Prisma client first
            <ToggleSetting
              label="Allow Sender to Approve"
              description="Person who sent can check/approve (for small teams)"
              checked={settings.allowSenderToCheck}
              onChange={(val) => updateSetting('allowSenderToCheck', val)}
              disabled={!settings.enforceTransferSOD}
            />
            */}
            <ToggleSetting
              label="Allow Creator to Receive"
              description="Creator can receive their own transfer"
              checked={settings.allowCreatorToReceive}
              onChange={(val) => updateSetting('allowCreatorToReceive', val)}
              disabled={!settings.enforceTransferSOD}
            />
            <ToggleSetting
              label="Allow Sender to Complete"
              description="Person who sent can complete"
              checked={settings.allowSenderToComplete}
              onChange={(val) => updateSetting('allowSenderToComplete', val)}
              disabled={!settings.enforceTransferSOD}
            />
            <ToggleSetting
              label="Allow Creator to Complete"
              description="Creator can complete their own transfer"
              checked={settings.allowCreatorToComplete}
              onChange={(val) => updateSetting('allowCreatorToComplete', val)}
              disabled={!settings.enforceTransferSOD}
            />
            <ToggleSetting
              label="Allow Receiver to Complete"
              description="Person who received can complete (usually allowed)"
              checked={settings.allowReceiverToComplete}
              onChange={(val) => updateSetting('allowReceiverToComplete', val)}
              disabled={!settings.enforceTransferSOD}
            />
          </div>
        </div>

        {/* PURCHASE SOD RULES */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-2 rounded-lg ${
              settings.enforcePurchaseSOD
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-yellow-100 dark:bg-yellow-900/30'
            }`}>
              {settings.enforcePurchaseSOD ? (
                <ShieldCheckIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : (
                <ShieldExclamationIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Purchase & Procurement Rules
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Control approval rights for purchase orders, amendments, and goods receipts
              </p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enforce Purchase SOD</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings.enforcePurchaseSOD}
                  onChange={(e) => updateSetting('enforcePurchaseSOD', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToggleSetting
              label="Allow Amendment Creator to Approve"
              description="Person who requested amendment can approve it"
              checked={settings.allowAmendmentCreatorToApprove}
              onChange={(val) => updateSetting('allowAmendmentCreatorToApprove', val)}
              disabled={!settings.enforcePurchaseSOD}
            />
            <ToggleSetting
              label="Allow PO Creator to Approve"
              description="Person who created PO can approve it"
              checked={settings.allowPOCreatorToApprove}
              onChange={(val) => updateSetting('allowPOCreatorToApprove', val)}
              disabled={!settings.enforcePurchaseSOD}
            />
            <ToggleSetting
              label="Allow GRN Creator to Approve"
              description="Person who created goods receipt can approve it"
              checked={settings.allowGRNCreatorToApprove}
              onChange={(val) => updateSetting('allowGRNCreatorToApprove', val)}
              disabled={!settings.enforcePurchaseSOD}
            />
          </div>
        </div>

        {/* RETURN SOD RULES */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-2 rounded-lg ${
              settings.enforceReturnSOD
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-yellow-100 dark:bg-yellow-900/30'
            }`}>
              {settings.enforceReturnSOD ? (
                <ShieldCheckIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : (
                <ShieldExclamationIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Return Processing Rules
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Control approval rights for customer and supplier returns
              </p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enforce Return SOD</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings.enforceReturnSOD}
                  onChange={(e) => updateSetting('enforceReturnSOD', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToggleSetting
              label="Allow Customer Return Creator to Approve"
              description="Person who created customer return can approve it"
              checked={settings.allowCustomerReturnCreatorToApprove}
              onChange={(val) => updateSetting('allowCustomerReturnCreatorToApprove', val)}
              disabled={!settings.enforceReturnSOD}
            />
            <ToggleSetting
              label="Allow Supplier Return Creator to Approve"
              description="Person who created supplier return can approve it"
              checked={settings.allowSupplierReturnCreatorToApprove}
              onChange={(val) => updateSetting('allowSupplierReturnCreatorToApprove', val)}
              disabled={!settings.enforceReturnSOD}
            />
          </div>
        </div>

        {/* GENERAL SETTINGS */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <UserGroupIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                General SOD Settings
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Role exemptions and warning thresholds
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Exempt Roles (bypass all SOD checks)
              </label>
              <input
                type="text"
                value={settings.exemptRoles}
                onChange={(e) => updateSetting('exemptRoles', e.target.value)}
                placeholder="e.g., Super Admin,System Administrator,Owner"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Comma-separated role names that can perform any action regardless of SOD rules
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Minimum Staff Warning Threshold
              </label>
              <input
                type="number"
                value={settings.minStaffWarningThreshold}
                onChange={(e) => updateSetting('minStaffWarningThreshold', parseInt(e.target.value) || 3)}
                min="1"
                max="10"
                className="w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Show warning if a location has fewer than this many active users (suggests enabling SOD exceptions)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <ShieldCheckIcon className="w-5 h-5" />
              Save SOD Rules
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// Toggle Setting Component
function ToggleSetting({
  label,
  description,
  checked,
  onChange,
  disabled
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className={`p-4 rounded-lg border ${
      disabled
        ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
    }`}>
      <label className="flex items-start gap-3 cursor-pointer">
        <div className="relative mt-1">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900 dark:text-gray-100">{label}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{description}</div>
        </div>
      </label>
    </div>
  )
}
