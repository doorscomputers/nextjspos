"use client"

import { useState, useEffect } from 'react'
import {
  BuildingOfficeIcon,
  CubeIcon,
  CreditCardIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

interface Stats {
  totalBusinesses: number
  activeBusinesses: number
  inactiveBusinesses: number
  totalSubscriptions: number
  activeSubscriptions: number
  trialSubscriptions: number
  expiredSubscriptions: number
  totalRevenue: number
  monthlyRevenue: number
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/superadmin/stats')
      const data = await response.json()
      if (response.ok) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-xl text-gray-600">Loading dashboard...</div>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Businesses',
      value: stats?.totalBusinesses || 0,
      icon: BuildingOfficeIcon,
      color: 'bg-blue-500',
      subStats: [
        { label: 'Active', value: stats?.activeBusinesses || 0, color: 'text-green-600' },
        { label: 'Inactive', value: stats?.inactiveBusinesses || 0, color: 'text-gray-600' },
      ]
    },
    {
      title: 'Subscriptions',
      value: stats?.totalSubscriptions || 0,
      icon: CreditCardIcon,
      color: 'bg-green-500',
      subStats: [
        { label: 'Active', value: stats?.activeSubscriptions || 0, color: 'text-green-600' },
        { label: 'Trial', value: stats?.trialSubscriptions || 0, color: 'text-yellow-600' },
        { label: 'Expired', value: stats?.expiredSubscriptions || 0, color: 'text-red-600' },
      ]
    },
    {
      title: 'Monthly Revenue',
      value: `$${(stats?.monthlyRevenue || 0).toLocaleString()}`,
      icon: ArrowTrendingUpIcon,
      color: 'bg-purple-500',
      subStats: [
        { label: 'Total Revenue', value: `$${(stats?.totalRevenue || 0).toLocaleString()}`, color: 'text-purple-600' },
      ]
    },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg p-8 text-white">
        <h2 className="text-3xl font-bold mb-2">Welcome to Super Admin Dashboard</h2>
        <p className="text-purple-100">Manage your entire POS platform from here. Monitor businesses, subscriptions, and revenue.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((card, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-600 text-sm font-medium">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`${card.color} p-3 rounded-lg`}>
                <card.icon className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="border-t pt-4 space-y-2">
              {card.subStats.map((subStat, subIndex) => (
                <div key={subIndex} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{subStat.label}</span>
                  <span className={`font-semibold ${subStat.color}`}>{subStat.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/superadmin/businesses?action=create"
            className="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-600 hover:bg-purple-50 transition-colors group"
          >
            <BuildingOfficeIcon className="w-8 h-8 text-gray-400 group-hover:text-purple-600 mr-3" />
            <div>
              <p className="font-semibold text-gray-900">Add Business</p>
              <p className="text-sm text-gray-600">Create new business</p>
            </div>
          </a>

          <a
            href="/superadmin/packages?action=create"
            className="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-600 hover:bg-green-50 transition-colors group"
          >
            <CubeIcon className="w-8 h-8 text-gray-400 group-hover:text-green-600 mr-3" />
            <div>
              <p className="font-semibold text-gray-900">Add Package</p>
              <p className="text-sm text-gray-600">Create subscription plan</p>
            </div>
          </a>

          <a
            href="/superadmin/businesses"
            className="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition-colors group"
          >
            <UsersIcon className="w-8 h-8 text-gray-400 group-hover:text-blue-600 mr-3" />
            <div>
              <p className="font-semibold text-gray-900">Manage Businesses</p>
              <p className="text-sm text-gray-600">View all businesses</p>
            </div>
          </a>

          <a
            href="/superadmin/subscriptions"
            className="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-yellow-600 hover:bg-yellow-50 transition-colors group"
          >
            <ClockIcon className="w-8 h-8 text-gray-400 group-hover:text-yellow-600 mr-3" />
            <div>
              <p className="font-semibold text-gray-900">Subscriptions</p>
              <p className="text-sm text-gray-600">Manage subscriptions</p>
            </div>
          </a>
        </div>
      </div>

      {/* Recent Activity (Placeholder) */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h3>
        <div className="text-gray-600 text-center py-8">
          Recent business registrations and subscription changes will appear here
        </div>
      </div>
    </div>
  )
}
