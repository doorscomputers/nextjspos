'use client'

import { useEffect, useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { SelectBox, Switch, NumberBox, TextBox, Button, ValidationGroup } from 'devextreme-react'
import { Validator, RequiredRule, RangeRule } from 'devextreme-react/validator'
import notify from 'devextreme/ui/notify'
import 'devextreme/dist/css/dx.material.blue.light.css'

interface PricingSettings {
  id: number
  name: string
  pricingStrategy: string
  bulkPriceSync: boolean
  priceRoundingRule: string
  telegramBotToken: string | null
  telegramChatId: string | null
  enablePricingAlerts: boolean
  belowCostThreshold: number
  belowRetailThreshold: number
}

const pricingStrategyOptions = [
  { value: 'fallback', text: 'Fallback (Use base price if location price not set)' },
  { value: 'required', text: 'Required (Location price must be set)' },
  { value: 'percentage', text: 'Percentage (Calculate from base price + percentage)' },
]

const roundingRuleOptions = [
  { value: 'none', text: 'None (No rounding)' },
  { value: 'round_up', text: 'Round Up (e.g., ₱100.25 → ₱101.00)' },
  { value: 'round_down', text: 'Round Down (e.g., ₱100.75 → ₱100.00)' },
  { value: 'nearest', text: 'Nearest Peso (e.g., ₱100.49 → ₱100.00, ₱100.50 → ₱101.00)' },
]

export default function PricingSettingsPage() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<PricingSettings | null>(null)

  const hasViewAccess = can(PERMISSIONS.PRICING_SETTINGS_VIEW)
  const hasEditAccess = can(PERMISSIONS.PRICING_SETTINGS_EDIT)

  useEffect(() => {
    if (hasViewAccess) {
      fetchSettings()
    } else {
      setLoading(false)
    }
  }, [hasViewAccess])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/pricing')
      const result = await response.json()

      if (response.ok && result.success) {
        setSettings(result.data)
      } else {
        notify(result.error || 'Failed to fetch pricing settings', 'error', 3000)
      }
    } catch (error) {
      console.error('Fetch settings error:', error)
      notify('Failed to fetch pricing settings', 'error', 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings || !hasEditAccess) return

    try {
      setSaving(true)
      const response = await fetch('/api/settings/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pricingStrategy: settings.pricingStrategy,
          bulkPriceSync: settings.bulkPriceSync,
          priceRoundingRule: settings.priceRoundingRule,
          telegramBotToken: settings.telegramBotToken,
          telegramChatId: settings.telegramChatId,
          enablePricingAlerts: settings.enablePricingAlerts,
          belowCostThreshold: settings.belowCostThreshold,
          belowRetailThreshold: settings.belowRetailThreshold,
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        notify('Pricing settings updated successfully', 'success', 3000)
        setSettings(result.data)
      } else {
        notify(result.error || 'Failed to update pricing settings', 'error', 3000)
      }
    } catch (error) {
      console.error('Save settings error:', error)
      notify('Failed to update pricing settings', 'error', 3000)
    } finally {
      setSaving(false)
    }
  }

  if (!hasViewAccess) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to view pricing settings.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading pricing settings...</p>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">Settings Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400">Unable to load pricing settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Pricing Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure multi-location pricing strategy, rounding rules, and security alerts
          </p>
        </div>

        <ValidationGroup>
          {/* Pricing Strategy Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <span className="mr-2">💰</span>
              Pricing Strategy
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Strategy Type
                </label>
                <SelectBox
                  items={pricingStrategyOptions}
                  displayExpr="text"
                  valueExpr="value"
                  value={settings.pricingStrategy}
                  onValueChanged={(e) => setSettings({ ...settings, pricingStrategy: e.value })}
                  stylingMode="outlined"
                  className="dx-theme-material-typography"
                  disabled={!hasEditAccess}
                >
                  <Validator>
                    <RequiredRule message="Pricing strategy is required" />
                  </Validator>
                </SelectBox>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {settings.pricingStrategy === 'fallback' && (
                    <p>✅ Locations can optionally set their own prices. If not set, base product price is used.</p>
                  )}
                  {settings.pricingStrategy === 'required' && (
                    <p>⚠️ Every location MUST have a price set. Sales blocked without location-specific pricing.</p>
                  )}
                  {settings.pricingStrategy === 'percentage' && (
                    <p>📊 Location prices calculated as: Base Price × (1 + Location Percentage / 100)</p>
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <span className="mr-2">Bulk Price Synchronization</span>
                </label>
                <Switch
                  value={settings.bulkPriceSync}
                  onValueChanged={(e) => setSettings({ ...settings, bulkPriceSync: e.value })}
                  switchedOnText="ON"
                  switchedOffText="OFF"
                  stylingMode="outlined"
                  className="dx-theme-material-typography"
                  disabled={!hasEditAccess}
                />
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {settings.bulkPriceSync ? (
                    <p className="text-green-600 dark:text-green-400">
                      ✅ Enabled: Bulk price updates apply to ALL locations automatically
                    </p>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">
                      ❌ Disabled: Bulk price updates prompt user to select locations
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Price Rounding Rule
                </label>
                <SelectBox
                  items={roundingRuleOptions}
                  displayExpr="text"
                  valueExpr="value"
                  value={settings.priceRoundingRule}
                  onValueChanged={(e) => setSettings({ ...settings, priceRoundingRule: e.value })}
                  stylingMode="outlined"
                  className="dx-theme-material-typography"
                  disabled={!hasEditAccess}
                >
                  <Validator>
                    <RequiredRule message="Rounding rule is required" />
                  </Validator>
                </SelectBox>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Applied to all price calculations and displays
                </div>
              </div>
            </div>
          </div>

          {/* Telegram Alerts Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <span className="mr-2">🔔</span>
              Telegram Security Alerts
            </h2>

            <div className="space-y-4">
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <span className="mr-2">Enable Pricing Alerts</span>
                </label>
                <Switch
                  value={settings.enablePricingAlerts}
                  onValueChanged={(e) => setSettings({ ...settings, enablePricingAlerts: e.value })}
                  switchedOnText="ON"
                  switchedOffText="OFF"
                  stylingMode="outlined"
                  className="dx-theme-material-typography"
                  disabled={!hasEditAccess}
                />
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {settings.enablePricingAlerts ? (
                    <p className="text-green-600 dark:text-green-400">
                      ✅ Enabled: Alerts sent when selling below cost or retail thresholds
                    </p>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">
                      ❌ Disabled: No alerts will be sent (not recommended for security)
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Telegram Bot Token
                </label>
                <TextBox
                  value={settings.telegramBotToken || ''}
                  onValueChanged={(e) => setSettings({ ...settings, telegramBotToken: e.value })}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  mode="password"
                  stylingMode="outlined"
                  className="dx-theme-material-typography"
                  disabled={!hasEditAccess}
                />
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Get from <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">@BotFather</a> on Telegram
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Telegram Chat ID
                </label>
                <TextBox
                  value={settings.telegramChatId || ''}
                  onValueChanged={(e) => setSettings({ ...settings, telegramChatId: e.value })}
                  placeholder="-1001234567890 or 1234567890"
                  stylingMode="outlined"
                  className="dx-theme-material-typography"
                  disabled={!hasEditAccess}
                />
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Your user ID or group chat ID where alerts will be sent
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Below Cost Threshold (%)
                </label>
                <NumberBox
                  value={Number(settings.belowCostThreshold)}
                  onValueChanged={(e) => setSettings({ ...settings, belowCostThreshold: e.value })}
                  min={0}
                  max={100}
                  format="#0.00"
                  showSpinButtons={true}
                  stylingMode="outlined"
                  className="dx-theme-material-typography"
                  disabled={!hasEditAccess}
                >
                  <Validator>
                    <RequiredRule message="Below cost threshold is required" />
                    <RangeRule min={0} max={100} message="Threshold must be between 0 and 100" />
                  </Validator>
                </NumberBox>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Alert when selling below: Cost Price × (1 + {settings.belowCostThreshold}%)
                  <br />
                  Example: Cost ₱100, Threshold 0% = Alert if selling below ₱100.00
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Below Retail Threshold (%)
                </label>
                <NumberBox
                  value={Number(settings.belowRetailThreshold)}
                  onValueChanged={(e) => setSettings({ ...settings, belowRetailThreshold: e.value })}
                  min={0}
                  max={100}
                  format="#0.00"
                  showSpinButtons={true}
                  stylingMode="outlined"
                  className="dx-theme-material-typography"
                  disabled={!hasEditAccess}
                >
                  <Validator>
                    <RequiredRule message="Below retail threshold is required" />
                    <RangeRule min={0} max={100} message="Threshold must be between 0 and 100" />
                  </Validator>
                </NumberBox>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Alert when selling below: Retail Price × (1 - {settings.belowRetailThreshold}%)
                  <br />
                  Example: Retail ₱150, Threshold 20% = Alert if selling below ₱120.00
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {hasEditAccess && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex justify-end space-x-4">
                <Button
                  text="Reset"
                  type="normal"
                  stylingMode="outlined"
                  onClick={fetchSettings}
                  disabled={saving}
                  className="dx-theme-material-typography"
                />
                <Button
                  text={saving ? 'Saving...' : 'Save Settings'}
                  type="default"
                  stylingMode="contained"
                  onClick={handleSave}
                  disabled={saving}
                  className="dx-theme-material-typography"
                />
              </div>
            </div>
          )}
        </ValidationGroup>
      </div>
    </div>
  )
}
