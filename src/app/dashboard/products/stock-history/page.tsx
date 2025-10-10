"use client"

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

interface StockTransaction {
  id: number
  type: string
  quantity: number
  unitCost: number | null
  balanceQty: number
  notes: string | null
  createdAt: string
  product: {
    name: string
    sku: string
  }
  productVariation: {
    name: string
    sku: string
  }
  createdByUser: {
    firstName: string
    lastName: string | null
  }
}

interface BusinessLocation {
  id: number
  name: string
}

export default function StockHistoryPage() {
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<StockTransaction[]>([])
  const [locations, setLocations] = useState<BusinessLocation[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')

  useEffect(() => {
    fetchData()
  }, [selectedLocation, selectedType])

  const fetchData = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedLocation) params.append('locationId', selectedLocation)
      if (selectedType) params.append('type', selectedType)

      const [transactionsRes, locationsRes] = await Promise.all([
        fetch(`/api/stock-transactions?${params.toString()}`),
        fetch('/api/locations')
      ])

      const [transactionsData, locationsData] = await Promise.all([
        transactionsRes.json(),
        locationsRes.json()
      ])

      if (transactionsRes.ok) {
        setTransactions(transactionsData.transactions || [])
      }

      if (locationsRes.ok) {
        setLocations(locationsData.locations || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'opening_stock':
        return 'bg-blue-100 text-blue-800'
      case 'sale':
        return 'bg-red-100 text-red-800'
      case 'purchase':
        return 'bg-green-100 text-green-800'
      case 'transfer_in':
        return 'bg-purple-100 text-purple-800'
      case 'transfer_out':
        return 'bg-orange-100 text-orange-800'
      case 'adjustment':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatType = (type: string) => {
    return type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const filteredTransactions = transactions.filter(transaction => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      transaction.product.name.toLowerCase().includes(query) ||
      transaction.product.sku.toLowerCase().includes(query) ||
      transaction.productVariation.name.toLowerCase().includes(query) ||
      transaction.productVariation.sku.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <Link
          href="/dashboard/products"
          className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800 mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Products
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Stock Transaction History</h1>
        <p className="text-gray-600 mt-1">
          View all inventory movements including opening stock, sales, purchases, transfers, and adjustments
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
            >
              <option value="">All Locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transaction Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
            >
              <option value="">All Types</option>
              <option value="opening_stock">Opening Stock</option>
              <option value="sale">Sale</option>
              <option value="purchase">Purchase</option>
              <option value="transfer_in">Transfer In</option>
              <option value="transfer_out">Transfer Out</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Product
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by product name or SKU..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Variation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Unit Cost
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    No stock transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(transaction.createdAt), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium">{transaction.product.name}</div>
                      <div className="text-gray-500">{transaction.product.sku}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>{transaction.productVariation.name}</div>
                      <div className="text-gray-500">{transaction.productVariation.sku}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(transaction.type)}`}>
                        {formatType(transaction.type)}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      transaction.quantity >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.quantity >= 0 ? '+' : ''}{transaction.quantity.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {transaction.unitCost ? `$${transaction.unitCost.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      {transaction.balanceQty.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.createdByUser.firstName} {transaction.createdByUser.lastName || ''}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {transaction.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      {filteredTransactions.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-600 font-medium">Total Transactions</div>
              <div className="text-2xl font-bold text-blue-900">{filteredTransactions.length}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium">Total Additions</div>
              <div className="text-2xl font-bold text-green-900">
                {filteredTransactions
                  .filter(t => t.quantity > 0)
                  .reduce((sum, t) => sum + t.quantity, 0)
                  .toFixed(2)}
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-sm text-red-600 font-medium">Total Deductions</div>
              <div className="text-2xl font-bold text-red-900">
                {Math.abs(filteredTransactions
                  .filter(t => t.quantity < 0)
                  .reduce((sum, t) => sum + t.quantity, 0))
                  .toFixed(2)}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-purple-600 font-medium">Current Balance</div>
              <div className="text-2xl font-bold text-purple-900">
                {filteredTransactions.length > 0
                  ? filteredTransactions[0].balanceQty.toFixed(2)
                  : '0.00'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
