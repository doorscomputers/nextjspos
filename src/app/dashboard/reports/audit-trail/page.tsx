'use client'

import { useState, useEffect, useMemo } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  UserIcon,
  GlobeAltIcon,
  EyeIcon,
  DocumentArrowDownIcon,
  ChartBarIcon,
  LockClosedIcon,
  ServerIcon,
  ChevronRightIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import ReportFilterPanel from '@/components/reports/ReportFilterPanel'

interface AuditLog {
  id: number
  businessId: number
  userId: number
  username: string
  action: string
  entityType: string
  entityIds: string[]
  description: string
  metadata: any
  requiresPassword: boolean
  passwordVerified: boolean
  ipAddress: string
  userAgent: string
  createdAt: string
}

interface AuditSummary {
  summary: {
    totalActivities: number
    uniqueUsers: number
    uniqueBusinesses: number
    periodRange: {
      start: string
      end: string
    }
    comparison?: {
      totalActivities: {
        current: number
        previous: number
        change: number
        changePercent: number | null
      }
      uniqueUsers: {
        current: number
        previous: number
        change: number
        changePercent: number | null
      }
      uniqueBusinesses: {
        current: number
        previous: number
        change: number
        changePercent: number | null
      }
    }
  }
  distributions: {
    actionTypes: Array<{
      action: string
      count: number
      percentage: number
    }>
    entityTypes: Array<{
      entityType: string
      count: number
      percentage: number
    }>
  }
  topUsers: Array<{
    userId: number
    username: string
    count: number
    percentage: number
  }>
  topBusinesses: Array<{
    businessId: number
    businessName: string
    count: number
  }>
  passwordProtected: {
    total: number
    verified: number
    unverified: number
  }
  recentActivities: AuditLog[]
  analytics: {
    dailyActivities: Array<{
      date: string
      count: number
      uniqueUsers: number
      uniqueBusinesses: number
      passwordProtected: number
      passwordVerified: number
    }>
    groupBy: string
  }
}

interface SecurityAnalysis {
  summary: {
    analysisPeriod: {
      start: string
      end: string
    }
    totalAuditLogs: number
    suspiciousIPCount: number
    highRiskUserCount: number
    bulkOperationCount: number
    failedPasswordAttempts: number
    offHoursActivity: number
    analysisType: string
  }
  riskIndicators: {
    suspiciousIPActivity: Array<{
      ipAddress: string
      uniqueUsers: number
      totalActivities: number
      usernames: string[]
      riskLevel: 'high' | 'medium' | 'low'
    }>
    highRiskUsers: Array<{
      userId: number
      username: string
      totalActivities: number
      activeDays: number
      uniqueActionTypes: number
      uniqueEntityTypes: number
      activitySpan: {
        start: string
        end: string
      }
      riskLevel: 'high' | 'medium' | 'low'
    }>
    bulkOperations: Array<{
      userId: number
      username: string
      action: string
      entityType: string
      count: number
      riskLevel: 'high' | 'medium' | 'low'
    }>
    failedPasswordAttempts: Array<{
      userId: number
      username: string
      ipAddress: string
      failedCount: number
      riskLevel: 'high' | 'medium' | 'low'
    }>
    riskScores: Array<{
      userId: number
      username: string
      ipAddress: string
      riskScore: number
      riskLevel: 'high' | 'medium' | 'low'
      totalActivities: number
      highRiskActions: number
      offHoursActivity: number
      passwordProtected: number
      lastActivity: string
    }>
    privilegedOperations: Array<{
      id: number
      userId: number
      username: string
      action: string
      entityType: string
      description: string
      requiresPassword: boolean
      passwordVerified: boolean
      ipAddress: string
      createdAt: string
      riskLevel: 'high' | 'medium' | 'low'
    }>
  }
  timePatterns: {
    hourlyActivity: Array<{
      hour: number
      activityCount: number
      uniqueUsers: number
      isOffHours: boolean
    }>
    offHoursActivityPercent: number
  }
  recommendations: string[]
}

export default function AuditTrailPage() {
  const { can, user } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [securityLoading, setSecurityLoading] = useState(false)

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [summary, setSummary] = useState<AuditSummary | null>(null)
  const [securityAnalysis, setSecurityAnalysis] = useState<SecurityAnalysis | null>(null)

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  })

  // Filters
  const defaultStartDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().split('T')[0]
  }, [])
  const defaultEndDate = useMemo(() => new Date().toISOString().split('T')[0], [])
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [userId, setUserId] = useState<string>('')
  const [username, setUsername] = useState<string>('')
  const [action, setAction] = useState<string>('all')
  const [entityType, setEntityType] = useState<string>('all')
  const [ipAddress, setIpAddress] = useState<string>('')
  const [requiresPassword, setRequiresPassword] = useState<string>('all')
  const [search, setSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('createdAt')
  const [sortOrder, setSortOrder] = useState<string>('desc')
  const [showFilters, setShowFilters] = useState(true)

  // Selected log for details
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const isSuperAdmin = user?.roles?.includes('Super Admin') || false

  // Fetch audit logs
  const fetchAuditLogs = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        page: page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
      })

      if (userId) params.append('userId', userId)
      if (username) params.append('username', username)
      if (action !== 'all') params.append('action', action)
      if (entityType !== 'all') params.append('entityType', entityType)
      if (ipAddress) params.append('ipAddress', ipAddress)
      if (requiresPassword !== 'all') params.append('requiresPassword', requiresPassword)
      if (search) params.append('search', search)

      const res = await fetch(`/api/reports/audit-trail?${params.toString()}`)

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch audit logs')
      }

      const data = await res.json()
      setAuditLogs(data.data)
      setPagination(data.pagination)
    } catch (error: any) {
      console.error('Error fetching audit logs:', error)
      toast.error(error.message || 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  // Fetch summary statistics
  const fetchSummary = async () => {
    setSummaryLoading(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        groupBy: 'day',
        includeComparison: 'true',
      })

      const res = await fetch(`/api/reports/audit-trail/summary?${params.toString()}`)

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch summary')
      }

      const data = await res.json()
      setSummary(data)
    } catch (error: any) {
      console.error('Error fetching summary:', error)
      toast.error(error.message || 'Failed to load summary statistics')
    } finally {
      setSummaryLoading(false)
    }
  }

  // Fetch security analysis
  const fetchSecurityAnalysis = async () => {
    setSecurityLoading(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        analysisType: 'all',
      })

      const res = await fetch(`/api/reports/audit-trail/security?${params.toString()}`)

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch security analysis')
      }

      const data = await res.json()
      setSecurityAnalysis(data)
    } catch (error: any) {
      console.error('Error fetching security analysis:', error)
      toast.error(error.message || 'Failed to load security analysis')
    } finally {
      setSecurityLoading(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchAuditLogs()
    fetchSummary()
    fetchSecurityAnalysis()
  }, [])

  // Auto-refresh for real-time updates (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSummary()
      fetchSecurityAnalysis()
    }, 30000)

    return () => clearInterval(interval)
  }, [startDate, endDate])

  const handleFilter = () => {
    fetchAuditLogs(1)
    fetchSummary()
    fetchSecurityAnalysis()
  }

  const handleReset = () => {
    setUserId('')
    setUsername('')
    setAction('all')
    setEntityType('all')
    setIpAddress('')
    setRequiresPassword('all')
    setSearch('')
    setSortBy('createdAt')
    setSortOrder('desc')
    setStartDate(defaultStartDate)
    setEndDate(defaultEndDate)
    setTimeout(() => {
      handleFilter()
    }, 0)
  }

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (startDate !== defaultStartDate || endDate !== defaultEndDate) count += 1
    if (userId) count += 1
    if (username.trim()) count += 1
    if (action !== 'all') count += 1
    if (entityType !== 'all') count += 1
    if (ipAddress.trim()) count += 1
    if (requiresPassword !== 'all') count += 1
    if (search.trim()) count += 1
    if (sortBy !== 'createdAt' || sortOrder !== 'desc') count += 1
    return count
  }, [
    action,
    defaultEndDate,
    defaultStartDate,
    endDate,
    entityType,
    ipAddress,
    requiresPassword,
    search,
    sortBy,
    sortOrder,
    startDate,
    userId,
    username,
  ])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getActionColor = (action: string) => {
    if (action.includes('delete')) return 'text-red-600'
    if (action.includes('activate')) return 'text-green-600'
    if (action.includes('deactivate')) return 'text-orange-600'
    return 'text-blue-600'
  }

  const handleExport = async (format: string) => {
    try {
      const res = await fetch('/api/reports/audit-trail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          filters: {
            startDate,
            endDate,
            userId,
            username,
            action,
            entityType,
            ipAddress,
            requiresPassword: requiresPassword === 'true' ? true : requiresPassword === 'false' ? false : undefined,
            search,
          },
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Export failed')
      }

      const data = await res.json()

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit-trail-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Export downloaded successfully')
      } else {
        toast.info(`${format.toUpperCase()} export coming soon`)
      }
    } catch (error: any) {
      console.error('Export error:', error)
      toast.error(error.message || 'Export failed')
    }
  }

  if (!can(PERMISSIONS.AUDIT_LOG_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view audit logs.
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Audit Trail Report</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive monitoring and security analysis of system activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleExport('csv')}
            disabled={loading}
          >
            <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport('json')}
            disabled={loading}
          >
            <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
              <ChartBarIcon className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.summary.totalActivities.toLocaleString()}</div>
              {summary.summary.comparison && (
                <p className="text-xs text-gray-500 mt-1">
                  {summary.summary.comparison.totalActivities.changePercent > 0 ? '+' : ''}
                  {summary.summary.comparison.totalActivities.changePercent?.toFixed(1)}% from previous period
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <UserIcon className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.summary.uniqueUsers}</div>
              {summary.summary.comparison && (
                <p className="text-xs text-gray-500 mt-1">
                  {summary.summary.comparison.uniqueUsers.changePercent > 0 ? '+' : ''}
                  {summary.summary.comparison.uniqueUsers.changePercent?.toFixed(1)}% from previous period
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Password Protected</CardTitle>
              <LockClosedIcon className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.passwordProtected.total}</div>
              <p className="text-xs text-gray-500 mt-1">
                {summary.passwordProtected.verified} verified, {summary.passwordProtected.unverified} unverified
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security Alerts</CardTitle>
              <ShieldCheckIcon className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {securityAnalysis?.summary.suspiciousIPCount || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Suspicious IP addresses detected
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <ReportFilterPanel
        isOpen={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
        activeCount={activeFilterCount}
        onClearAll={handleReset}
        clearLabel="Reset Filters"
        description="Filter audit logs by user activity, entity type, IP address, and more."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Filter by username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="action">Action</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger id="action">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="bulk_delete">Bulk Delete</SelectItem>
                  <SelectItem value="bulk_activate">Bulk Activate</SelectItem>
                  <SelectItem value="bulk_deactivate">Bulk Deactivate</SelectItem>
                  <SelectItem value="bulk_add_to_location">Add to Location</SelectItem>
                  <SelectItem value="bulk_remove_from_location">Remove from Location</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="entityType">Entity Type</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger id="entityType">
                  <SelectValue placeholder="All entity types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="brand">Brand</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="ipAddress">IP Address</Label>
              <Input
                id="ipAddress"
                placeholder="Filter by IP address"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="requiresPassword">Password Protection</Label>
              <Select value={requiresPassword} onValueChange={setRequiresPassword}>
                <SelectTrigger id="requiresPassword">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Password Required</SelectItem>
                  <SelectItem value="false">No Password Required</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleFilter} disabled={loading}>
                {loading ? 'Loading...' : 'Apply Filters'}
              </Button>
              <Button variant="outline" onClick={handleReset} disabled={loading}>
                Reset
              </Button>
            </div>
        </div>
      </ReportFilterPanel>

      {/* Main Content Tabs */}
      <Tabs defaultValue="audit-logs" className="space-y-4">
        <TabsList className="h-11 p-1.5 gap-1 shadow-sm border border-border/50">
          <TabsTrigger
            value="audit-logs"
            className="cursor-pointer hover:scale-[1.02] active:scale-[0.98] data-[state=active]:border-primary data-[state=active]:shadow-md font-semibold transition-all duration-200"
          >
            Audit Logs
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="cursor-pointer hover:scale-[1.02] active:scale-[0.98] data-[state=active]:border-primary data-[state=active]:shadow-md font-semibold transition-all duration-200"
          >
            Analytics
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="cursor-pointer hover:scale-[1.02] active:scale-[0.98] data-[state=active]:border-primary data-[state=active]:shadow-md font-semibold transition-all duration-200"
          >
            Security Analysis
          </TabsTrigger>
        </TabsList>

        {/* Audit Logs Tab */}
        <TabsContent value="audit-logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log Entries</CardTitle>
              <CardDescription>
                Showing {pagination.total} total entries ΓÇó Page {pagination.page} of {pagination.totalPages}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSortBy('createdAt')
                            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                            fetchAuditLogs(pagination.page)
                          }}
                        >
                          Date/Time
                          {sortBy === 'createdAt' && (
                            <ChevronRightIcon className={`w-4 h-4 ml-1 ${sortOrder === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                          )}
                        </Button>
                      </th>
                      <th className="text-left py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSortBy('username')
                            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                            fetchAuditLogs(pagination.page)
                          }}
                        >
                          User
                          {sortBy === 'username' && (
                            <ChevronRightIcon className={`w-4 h-4 ml-1 ${sortOrder === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                          )}
                        </Button>
                      </th>
                      <th className="text-left py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSortBy('action')
                            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                            fetchAuditLogs(pagination.page)
                          }}
                        >
                          Action
                          {sortBy === 'action' && (
                            <ChevronRightIcon className={`w-4 h-4 ml-1 ${sortOrder === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                          )}
                        </Button>
                      </th>
                      <th className="text-left py-3 px-4">Entity</th>
                      <th className="text-left py-3 px-4">Description</th>
                      <th className="text-left py-3 px-4">IP Address</th>
                      <th className="text-left py-3 px-4">Security</th>
                      <th className="text-left py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{log.username}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`font-medium ${getActionColor(log.action)}`}>
                            {log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">
                            {log.entityType}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="truncate" title={log.description}>
                            {log.description}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <GlobeAltIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">{log.ipAddress || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {log.requiresPassword && (
                              <LockClosedIcon className={`w-4 h-4 ${log.passwordVerified ? 'text-green-600' : 'text-red-600'}`} />
                            )}
                            {log.requiresPassword && (
                              <Badge variant={log.passwordVerified ? 'default' : 'destructive'}>
                                {log.passwordVerified ? 'Verified' : 'Failed'}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedLog(log)}
                              >
                                <EyeIcon className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Audit Log Details</DialogTitle>
                              </DialogHeader>
                              {selectedLog && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Date/Time</Label>
                                      <p className="text-sm">{formatDateTime(selectedLog.createdAt)}</p>
                                    </div>
                                    <div>
                                      <Label>User</Label>
                                      <p className="text-sm font-medium">{selectedLog.username}</p>
                                    </div>
                                    <div>
                                      <Label>Action</Label>
                                      <p className={`text-sm font-medium ${getActionColor(selectedLog.action)}`}>
                                        {selectedLog.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                      </p>
                                    </div>
                                    <div>
                                      <Label>Entity Type</Label>
                                      <p className="text-sm">{selectedLog.entityType}</p>
                                    </div>
                                    <div>
                                      <Label>IP Address</Label>
                                      <p className="text-sm">{selectedLog.ipAddress || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <Label>User Agent</Label>
                                      <p className="text-xs truncate">{selectedLog.userAgent || 'N/A'}</p>
                                    </div>
                                  </div>
                                  <div>
                                    <Label>Description</Label>
                                    <p className="text-sm">{selectedLog.description}</p>
                                  </div>
                                  {selectedLog.metadata && (
                                    <div>
                                      <Label className="text-base font-semibold mb-3 block">Additional Details</Label>
                                      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                                        {Object.entries(selectedLog.metadata).map(([key, value]) => (
                                          <div key={key} className="flex items-start border-b border-gray-200 pb-2 last:border-0 last:pb-0">
                                            <div className="w-1/3 text-sm font-medium text-gray-600 capitalize">
                                              {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}:
                                            </div>
                                            <div className="w-2/3 text-sm text-gray-900">
                                              {typeof value === 'object' && value !== null ? (
                                                Array.isArray(value) ? (
                                                  <span className="font-mono text-xs bg-blue-50 px-2 py-1 rounded">
                                                    {value.length} items: {value.join(', ')}
                                                  </span>
                                                ) : (
                                                  <div className="space-y-1">
                                                    {Object.entries(value).map(([k, v]) => (
                                                      <div key={k} className="text-xs">
                                                        <span className="font-medium text-gray-600">{k}:</span>{' '}
                                                        <span className="text-gray-900">{String(v)}</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )
                                              ) : (
                                                <span className="font-medium">{String(value)}</span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {selectedLog.entityIds.length > 0 && (
                                    <div>
                                      <Label>Affected Entities</Label>
                                      <p className="text-sm">{selectedLog.entityIds.join(', ')}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchAuditLogs(pagination.page - 1)}
                    disabled={!pagination.hasPrev || loading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchAuditLogs(pagination.page + 1)}
                    disabled={!pagination.hasNext || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {summary && (
            <>
              {/* Activity Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Action Distribution</CardTitle>
                    <CardDescription>Most common audit actions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {summary.distributions.actionTypes.map((action, index) => (
                        <div key={action.action} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium w-32">
                              {action.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                            <span className="text-xs text-gray-500">({action.count})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-32 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${action.percentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 w-12 text-right">
                              {action.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Active Users</CardTitle>
                    <CardDescription>Users with most audit activities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {summary.topUsers.map((user, index) => (
                        <div key={user.userId} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium w-24">{user.username}</span>
                            <span className="text-xs text-gray-500">({user.count})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-32 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-600 h-2 rounded-full"
                                style={{ width: `${user.percentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 w-12 text-right">
                              {user.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activities</CardTitle>
                  <CardDescription>Latest audit log entries</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {summary.recentActivities.slice(0, 10).map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                        <ClockIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{activity.username}</span>
                            <span className={`text-xs ${getActionColor(activity.action)}`}>
                              {activity.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                            <Badge variant="outline">{activity.entityType}</Badge>
                            {activity.requiresPassword && (
                              <LockClosedIcon className={`w-3 h-3 ${activity.passwordVerified ? 'text-green-600' : 'text-red-600'}`} />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 truncate">{activity.description}</p>
                          <p className="text-xs text-gray-500">{formatDateTime(activity.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Security Analysis Tab */}
        <TabsContent value="security" className="space-y-4">
          {securityAnalysis && (
            <>
              {/* Security Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <ExclamationTriangleIcon className="w-5 h-5" />
                      High Risk Indicators
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Suspicious IPs</span>
                        <span className="font-bold text-red-600">{securityAnalysis.summary.suspiciousIPCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">High Risk Users</span>
                        <span className="font-bold text-red-600">{securityAnalysis.summary.highRiskUserCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Failed Passwords</span>
                        <span className="font-bold text-red-600">{securityAnalysis.summary.failedPasswordAttempts}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-orange-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-600">
                      <ClockIcon className="w-5 h-5" />
                      Activity Patterns
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Off-Hours Activity</span>
                        <span className="font-bold text-orange-600">{securityAnalysis.summary.offHoursActivity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Off-Hours Percentage</span>
                        <span className="font-bold text-orange-600">
                          {(securityAnalysis.timePatterns.offHoursActivityPercent ?? 0).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Bulk Operations</span>
                        <span className="font-bold text-orange-600">{securityAnalysis.summary.bulkOperationCount}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-blue-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-600">
                      <ShieldCheckIcon className="w-5 h-5" />
                      Security Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {securityAnalysis.recommendations.slice(0, 3).map((rec, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <InformationCircleIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Risk Scores */}
              {securityAnalysis.riskIndicators.riskScores.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>User Risk Assessment</CardTitle>
                    <CardDescription>Users ranked by security risk score</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-4">User</th>
                            <th className="text-left py-2 px-4">IP Address</th>
                            <th className="text-right py-2 px-4">Risk Score</th>
                            <th className="text-center py-2 px-4">Risk Level</th>
                            <th className="text-right py-2 px-4">Activities</th>
                            <th className="text-right py-2 px-4">High Risk</th>
                            <th className="text-right py-2 px-4">Off Hours</th>
                            <th className="text-left py-2 px-4">Last Activity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {securityAnalysis.riskIndicators.riskScores.map((risk) => (
                            <tr key={`${risk.userId}-${risk.ipAddress}`} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-4 font-medium">{risk.username}</td>
                              <td className="py-2 px-4">{risk.ipAddress}</td>
                              <td className="py-2 px-4 text-right font-bold">{risk.riskScore}</td>
                              <td className="py-2 px-4 text-center">
                                <Badge className={getRiskLevelColor(risk.riskLevel)}>
                                  {risk.riskLevel.toUpperCase()}
                                </Badge>
                              </td>
                              <td className="py-2 px-4 text-right">{risk.totalActivities}</td>
                              <td className="py-2 px-4 text-right text-red-600">{risk.highRiskActions}</td>
                              <td className="py-2 px-4 text-right text-orange-600">{risk.offHoursActivity}</td>
                              <td className="py-2 px-4 text-sm">{formatDate(risk.lastActivity)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Suspicious IP Activity */}
              {securityAnalysis.riskIndicators.suspiciousIPActivity.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-red-600">Suspicious IP Activity</CardTitle>
                    <CardDescription>IP addresses showing unusual patterns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {securityAnalysis.riskIndicators.suspiciousIPActivity.map((ip, index) => (
                        <div key={ip.ipAddress} className="p-3 border border-red-200 rounded-lg bg-red-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <GlobeAltIcon className="w-4 h-4 text-red-600" />
                              <span className="font-mono font-medium">{ip.ipAddress}</span>
                              <Badge className={getRiskLevelColor(ip.riskLevel)}>
                                {ip.riskLevel.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600">
                              {ip.uniqueUsers} users ΓÇó {ip.totalActivities} activities
                            </div>
                          </div>
                          <div className="mt-2">
                            <span className="text-xs text-gray-500">Users: </span>
                            {ip.usernames.slice(0, 5).map((username: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="mr-1 text-xs">
                                {username}
                              </Badge>
                            ))}
                            {ip.usernames.length > 5 && (
                              <span className="text-xs text-gray-500">+{ip.usernames.length - 5} more</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
