'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

interface ScheduleLoginConfig {
  id: number
  businessId: number
  enforceScheduleLogin: boolean
  earlyClockInGraceMinutes: number
  lateClockOutGraceMinutes: number
  exemptRoles: string | null
  tooEarlyMessage: string | null
  tooLateMessage: string | null
  createdAt: string
  updatedAt: string
}

export default function ScheduleLoginConfigPage() {
  const { data: session } = useSession()
  const { can } = usePermissions()

  const [config, setConfig] = useState<ScheduleLoginConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Form state
  const [enforceScheduleLogin, setEnforceScheduleLogin] = useState(true)
  const [earlyGrace, setEarlyGrace] = useState(30)
  const [lateGrace, setLateGrace] = useState(60)
  const [exemptRoles, setExemptRoles] = useState('Super Admin,System Administrator,Super Admin (Legacy),Admin (Legacy)')
  const [tooEarlyMessage, setTooEarlyMessage] = useState('')
  const [tooLateMessage, setTooLateMessage] = useState('')

  useEffect(() => {
    fetchConfiguration()
  }, [])

  const fetchConfiguration = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/schedule-login-config')
      if (response.ok) {
        const data = await response.json()
        setConfig(data.configuration)

        // Populate form
        setEnforceScheduleLogin(data.configuration.enforceScheduleLogin)
        setEarlyGrace(data.configuration.earlyClockInGraceMinutes)
        setLateGrace(data.configuration.lateClockOutGraceMinutes)
        setExemptRoles(data.configuration.exemptRoles || '')
        setTooEarlyMessage(data.configuration.tooEarlyMessage || '')
        setTooLateMessage(data.configuration.tooLateMessage || '')
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Failed to load configuration' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error loading configuration' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage(null)

      const response = await fetch('/api/schedule-login-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enforceScheduleLogin,
          earlyClockInGraceMinutes: earlyGrace,
          lateClockOutGraceMinutes: lateGrace,
          exemptRoles,
          tooEarlyMessage: tooEarlyMessage || null,
          tooLateMessage: tooLateMessage || null,
        })
      })

      if (response.ok) {
        const data = await response.json()
        setConfig(data.configuration)
        setMessage({ type: 'success', text: 'Configuration saved successfully!' })
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Failed to save configuration' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error saving configuration' })
    } finally {
      setSaving(false)
    }
  }

  if (!can(PERMISSIONS.BUSINESS_SETTINGS_VIEW)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    )
  }

  const canEdit = can(PERMISSIONS.BUSINESS_SETTINGS_EDIT)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Schedule-Based Login Security
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Configure login restrictions based on employee schedules
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          <p className={message.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200 font-semibold mb-2'}>
            {message.text}
          </p>
          {message.type === 'error' && message.text.includes('Failed to fetch') && (
            <div className="mt-3 text-sm text-red-700 dark:text-red-300 space-y-2">
              <p className="font-medium">This usually means the database table doesn't exist yet. To fix this:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Run the migration script: <code className="bg-red-100 dark:bg-red-900/40 px-2 py-1 rounded">add-schedule-login-config.sql</code></li>
                <li>Using psql: <code className="bg-red-100 dark:bg-red-900/40 px-2 py-1 rounded text-xs">psql -h localhost -U postgres -d ultimatepos_modern -f add-schedule-login-config.sql</code></li>
                <li>Or use phpPgAdmin, pgAdmin, or DBeaver to execute the SQL script</li>
                <li>Refresh this page after running the migration</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-4">Loading configuration...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
          {/* Feature Toggle */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Enforce Schedule-Based Login
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  When enabled, users can only login during their scheduled working hours
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enforceScheduleLogin}
                  onChange={(e) => setEnforceScheduleLogin(e.target.checked)}
                  disabled={!canEdit}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
              </label>
            </div>
          </div>

          {/* Grace Periods */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Early Clock-In Grace Period
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  value={earlyGrace}
                  onChange={(e) => setEarlyGrace(parseInt(e.target.value) || 0)}
                  disabled={!canEdit}
                  min="0"
                  max="240"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                />
                <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">minutes</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Allow login {earlyGrace} minutes before scheduled start
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Late Clock-Out Grace Period
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  value={lateGrace}
                  onChange={(e) => setLateGrace(parseInt(e.target.value) || 0)}
                  disabled={!canEdit}
                  min="0"
                  max="240"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                />
                <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">minutes</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Allow login {lateGrace} minutes after scheduled end
              </p>
            </div>
          </div>

          {/* Exempt Roles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Exempt Roles (comma-separated)
            </label>
            <input
              type="text"
              value={exemptRoles}
              onChange={(e) => setExemptRoles(e.target.value)}
              disabled={!canEdit}
              placeholder="Super Admin,System Administrator"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Users with these roles can login anytime, regardless of schedule
            </p>
          </div>

          {/* Custom Messages */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Custom Error Messages (Optional)
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Too Early Message
              </label>
              <textarea
                value={tooEarlyMessage}
                onChange={(e) => setTooEarlyMessage(e.target.value)}
                disabled={!canEdit}
                rows={3}
                placeholder="Leave empty to use default message"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Too Late Message
              </label>
              <textarea
                value={tooLateMessage}
                onChange={(e) => setTooLateMessage(e.target.value)}
                disabled={!canEdit}
                rows={3}
                placeholder="Leave empty to use default message"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
              />
            </div>
          </div>

          {/* Example Window */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Example Login Window
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              For a schedule of <strong>8:00 AM - 5:00 PM</strong>:
            </p>
            <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1 list-disc list-inside">
              <li>Login allowed from: <strong>7:{60 - earlyGrace} AM</strong> ({earlyGrace} min early)</li>
              <li>Login allowed until: <strong>5:{lateGrace < 10 ? '0' : ''}{lateGrace} PM</strong> ({lateGrace} min late)</li>
            </ul>
          </div>

          {/* Save Button */}
          {canEdit && (
            <div className="flex justify-end pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Information Panel */}
      <div className="mt-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          How It Works
        </h3>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start">
            <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
            <span>Users can only login during their scheduled working hours (plus grace periods)</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
            <span>Admin roles (configured above) are exempt and can login anytime</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
            <span>Users without schedules for the day can login freely</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
            <span>All login attempts are logged for audit purposes</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
