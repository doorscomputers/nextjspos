"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

interface Currency {
  id: number
  country: string
  currency: string
  code: string
  symbol: string
  thousandSeparator: string
  decimalSeparator: string
}

interface Business {
  id: number
  name: string
  currencyId: number
  currency: Currency
  startDate: string | null
  taxNumber1: string
  taxLabel1: string
  taxNumber2: string | null
  taxLabel2: string | null
  defaultProfitPercent: string
  timeZone: string
  fyStartMonth: number
  accountingMethod: string
  defaultSalesDiscount: string | null
  sellPriceTax: string
  skuPrefix: string | null
  enableTooltip: boolean
}

export default function BusinessSettingsPage() {
  const { data: session } = useSession()
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [business, setBusiness] = useState<Business | null>(null)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    currencyId: '',
    startDate: '',
    taxNumber1: '',
    taxLabel1: '',
    taxNumber2: '',
    taxLabel2: '',
    defaultProfitPercent: '',
    timeZone: 'Asia/Manila', // Fixed to Philippine timezone
    fyStartMonth: '',
    accountingMethod: '',
    defaultSalesDiscount: '',
    sellPriceTax: '',
    skuPrefix: '',
    enableTooltip: true,
  })

  useEffect(() => {
    fetchBusinessSettings()
    fetchCurrencies()
  }, [])

  const fetchBusinessSettings = async () => {
    try {
      const response = await fetch('/api/business/settings')
      const data = await response.json()

      if (response.ok && data.business) {
        setBusiness(data.business)
        setFormData({
          name: data.business.name || '',
          currencyId: data.business.currencyId?.toString() || '',
          startDate: data.business.startDate ? data.business.startDate.split('T')[0] : '',
          taxNumber1: data.business.taxNumber1 || '',
          taxLabel1: data.business.taxLabel1 || '',
          taxNumber2: data.business.taxNumber2 || '',
          taxLabel2: data.business.taxLabel2 || '',
          defaultProfitPercent: data.business.defaultProfitPercent || '',
          timeZone: 'Asia/Manila', // Always set to Philippine timezone
          fyStartMonth: data.business.fyStartMonth?.toString() || '1',
          accountingMethod: data.business.accountingMethod || 'fifo',
          defaultSalesDiscount: data.business.defaultSalesDiscount || '',
          sellPriceTax: data.business.sellPriceTax || 'includes',
          skuPrefix: data.business.skuPrefix || '',
          enableTooltip: data.business.enableTooltip ?? true,
        })
      }
    } catch (error) {
      console.error('Error fetching business settings:', error)
      setMessage({ type: 'error', text: 'Failed to load business settings' })
    } finally {
      setLoading(false)
    }
  }

  const fetchCurrencies = async () => {
    try {
      const response = await fetch('/api/currencies')
      const data = await response.json()
      if (response.ok) {
        setCurrencies(data.currencies || [])

        // Find Philippine Peso and set it as the currency
        const phpCurrency = data.currencies?.find((c: Currency) => c.code === 'PHP')
        if (phpCurrency) {
          setFormData(prev => ({ ...prev, currencyId: phpCurrency.id.toString() }))
        }
      }
    } catch (error) {
      console.error('Error fetching currencies:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!can(PERMISSIONS.BUSINESS_SETTINGS_EDIT)) {
      setMessage({ type: 'error', text: 'You do not have permission to edit business settings' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      // Always ensure timezone is Asia/Manila before submitting
      const submitData = {
        ...formData,
        timeZone: 'Asia/Manila'
      }

      const response = await fetch('/api/business/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Business settings updated successfully' })
        setBusiness(data.business)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update business settings' })
      }
    } catch (error) {
      console.error('Error updating business settings:', error)
      setMessage({ type: 'error', text: 'An error occurred while updating settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading business settings...</div>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-600">Business not found</div>
      </div>
    )
  }

  const canEdit = can(PERMISSIONS.BUSINESS_SETTINGS_EDIT)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Business Settings</h1>
        <p className="text-gray-600 mt-2">Manage your business information and preferences</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Basic Information */}
        <div className="border-b pb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value="PHP - Philippine Peso (₱)"
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed text-gray-900"
                />
                <div className="mt-1 text-xs text-blue-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Fixed to Philippine Peso for all operations
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Start Date
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Zone
              </label>
              <div className="relative">
                <input
                  type="text"
                  value="Asia/Manila (Philippine Time)"
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed text-gray-900"
                />
                <div className="mt-1 text-xs text-blue-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Fixed to Philippine Time Zone (GMT+8)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tax Information */}
        <div className="border-b pb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Tax Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tax Number 1 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="taxNumber1"
                value={formData.taxNumber1}
                onChange={handleChange}
                required
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tax Label 1 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="taxLabel1"
                value={formData.taxLabel1}
                onChange={handleChange}
                required
                maxLength={10}
                disabled={!canEdit}
                placeholder="e.g., VAT"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tax Number 2 (Optional)
              </label>
              <input
                type="text"
                name="taxNumber2"
                value={formData.taxNumber2}
                onChange={handleChange}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tax Label 2 (Optional)
              </label>
              <input
                type="text"
                name="taxLabel2"
                value={formData.taxLabel2}
                onChange={handleChange}
                maxLength={10}
                disabled={!canEdit}
                placeholder="e.g., GST"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Business Preferences */}
        <div className="border-b pb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Business Preferences</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Profit Percent (%)
              </label>
              <input
                type="number"
                name="defaultProfitPercent"
                value={formData.defaultProfitPercent}
                onChange={handleChange}
                step="0.01"
                min="0"
                max="100"
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Sales Discount (%)
              </label>
              <input
                type="number"
                name="defaultSalesDiscount"
                value={formData.defaultSalesDiscount}
                onChange={handleChange}
                step="0.01"
                min="0"
                max="100"
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Financial Year Start Month
              </label>
              <select
                name="fyStartMonth"
                value={formData.fyStartMonth}
                onChange={handleChange}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>
                    {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Accounting Method
              </label>
              <select
                name="accountingMethod"
                value={formData.accountingMethod}
                onChange={handleChange}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
              >
                <option value="fifo">FIFO (First In, First Out)</option>
                <option value="lifo">LIFO (Last In, First Out)</option>
                <option value="avco">AVCO (Average Cost)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sell Price Tax
              </label>
              <select
                name="sellPriceTax"
                value={formData.sellPriceTax}
                onChange={handleChange}
                disabled={!canEdit}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
              >
                <option value="includes">Includes Tax</option>
                <option value="excludes">Excludes Tax</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SKU Prefix
              </label>
              <input
                type="text"
                name="skuPrefix"
                value={formData.skuPrefix}
                onChange={handleChange}
                disabled={!canEdit}
                placeholder="e.g., PRD"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="enableTooltip"
                checked={formData.enableTooltip}
                onChange={handleChange}
                disabled={!canEdit}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
              />
              <span className="ml-2 text-sm text-gray-700">Enable tooltips throughout the application</span>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        {canEdit && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}

        {!canEdit && (
          <div className="text-center text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            You do not have permission to edit business settings. Contact your administrator for access.
          </div>
        )}
      </form>
    </div>
  )
}
