'use client'

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import {
  FileText,
  Wrench,
  Users,
  CheckCircle,
  Clock,
  DollarSign,
  TrendingUp,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import PieChart, {
  Series,
  Label,
  Legend,
  Export as PieExport,
  Tooltip as PieTooltip,
} from 'devextreme-react/pie-chart'
import Chart, {
  Series as ChartSeries,
  ArgumentAxis,
  ValueAxis,
  Legend as ChartLegend,
  Export as ChartExport,
  Tooltip as ChartTooltip,
  CommonSeriesSettings,
} from 'devextreme-react/chart'
import 'devextreme/dist/css/dx.light.css'

interface DashboardStats {
  pendingClaims: number
  activeJobs: number
  availableTechnicians: number
  todayCompletions: number
  todayRevenue: number
  weekRevenue: number
  monthRevenue: number
  avgRepairTime: number
}

interface ClaimsByStatus {
  status: string
  count: number
}

interface JobsByTechnician {
  technician: string
  completed: number
  inProgress: number
}

interface RevenueByDay {
  day: string
  revenue: number
}

interface RecentActivity {
  id: number
  type: string
  description: string
  time: string
  status: string
}

export default function TechnicalDashboardPage() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState<DashboardStats>({
    pendingClaims: 0,
    activeJobs: 0,
    availableTechnicians: 0,
    todayCompletions: 0,
    todayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    avgRepairTime: 0,
  })
  const [claimsByStatus, setClaimsByStatus] = useState<ClaimsByStatus[]>([])
  const [jobsByTechnician, setJobsByTechnician] = useState<JobsByTechnician[]>([])
  const [revenueByDay, setRevenueByDay] = useState<RevenueByDay[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])

  useEffect(() => {
    if (!can(PERMISSIONS.WARRANTY_CLAIM_VIEW) && !can(PERMISSIONS.JOB_ORDER_VIEW)) {
      toast.error('You do not have permission to view the service dashboard')
      return
    }
    fetchDashboardData()
  }, [can])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/technical/dashboard')
      const data = await response.json()

      if (response.ok) {
        setStats(data.stats || stats)
        setClaimsByStatus(data.claimsByStatus || [])
        setJobsByTechnician(data.jobsByTechnician || [])
        setRevenueByDay(data.revenueByDay || [])
        setRecentActivity(data.recentActivity || [])
      } else {
        toast.error(data.error || 'Failed to fetch dashboard data')
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast.error('Failed to fetch dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchDashboardData()
    setRefreshing(false)
    toast.success('Dashboard refreshed')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin dark:border-blue-900 dark:border-t-blue-400"></div>
          <p className="mt-4 text-slate-600 font-medium dark:text-gray-300">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!can(PERMISSIONS.WARRANTY_CLAIM_VIEW) && !can(PERMISSIONS.JOB_ORDER_VIEW)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 font-medium dark:text-red-400">Access denied. You do not have permission to view the service dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-blue-400 dark:to-white">
              Service Dashboard
            </h1>
            <p className="text-slate-600 text-sm sm:text-base dark:text-gray-400">
              Technical service and warranty management overview
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            className="shadow-sm hover:shadow-md transition-all dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="shadow-md border-slate-200 dark:bg-gray-800 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-lg dark:bg-yellow-900/30">
                  <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Pending Claims</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.pendingClaims}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200 dark:bg-gray-800 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg dark:bg-blue-900/30">
                  <Wrench className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Jobs</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.activeJobs}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200 dark:bg-gray-800 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-lg dark:bg-emerald-900/30">
                  <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Available Technicians</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.availableTechnicians}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200 dark:bg-gray-800 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg dark:bg-green-900/30">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Today's Completions</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.todayCompletions}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="shadow-md border-slate-200 dark:bg-gray-800 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg dark:bg-purple-900/30">
                  <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Today's Revenue</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    ₱{stats.todayRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200 dark:bg-gray-800 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 rounded-lg dark:bg-indigo-900/30">
                  <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">This Week</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    ₱{stats.weekRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200 dark:bg-gray-800 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-pink-100 rounded-lg dark:bg-pink-900/30">
                  <DollarSign className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">This Month</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    ₱{stats.monthRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200 dark:bg-gray-800 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-lg dark:bg-orange-900/30">
                  <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Repair Time</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {stats.avgRepairTime.toFixed(1)} hrs
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Claims by Status */}
        <Card className="shadow-lg border-slate-200 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <CardTitle className="text-gray-900 dark:text-gray-100">Claims by Status</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {claimsByStatus.length > 0 ? (
              <PieChart
                dataSource={claimsByStatus}
                palette="Bright"
                height={300}
              >
                <Series argumentField="status" valueField="count">
                  <Label visible={true} customizeText={(arg: any) => `${arg.valueText} (${arg.percentText})`} />
                </Series>
                <PieExport enabled={true} />
                <PieTooltip enabled={true} />
                <Legend
                  verticalAlignment="bottom"
                  horizontalAlignment="center"
                />
              </PieChart>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Jobs by Technician */}
        <Card className="shadow-lg border-slate-200 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <CardTitle className="text-gray-900 dark:text-gray-100">Jobs by Technician</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {jobsByTechnician.length > 0 ? (
              <Chart
                dataSource={jobsByTechnician}
                palette="Harmony Light"
                height={300}
              >
                <CommonSeriesSettings argumentField="technician" type="bar" />
                <ChartSeries valueField="completed" name="Completed" />
                <ChartSeries valueField="inProgress" name="In Progress" />
                <ArgumentAxis />
                <ValueAxis />
                <ChartLegend verticalAlignment="bottom" horizontalAlignment="center" />
                <ChartExport enabled={true} />
                <ChartTooltip enabled={true} />
              </Chart>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend */}
      <Card className="shadow-lg border-slate-200 dark:bg-gray-800 dark:border-gray-700 mb-6">
        <CardHeader className="border-b border-gray-200 dark:border-gray-700">
          <CardTitle className="text-gray-900 dark:text-gray-100">Revenue Trend (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {revenueByDay.length > 0 ? (
            <Chart
              dataSource={revenueByDay}
              palette="Soft Pastel"
              height={300}
            >
              <ChartSeries valueField="revenue" argumentField="day" type="spline" color="#4F46E5" />
              <ArgumentAxis />
              <ValueAxis>
                <Label format={{ type: 'currency', currency: 'PHP' }} />
              </ValueAxis>
              <ChartExport enabled={true} />
              <ChartTooltip enabled={true} format={{ type: 'currency', currency: 'PHP' }} />
            </Chart>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="shadow-lg border-slate-200 dark:bg-gray-800 dark:border-gray-700">
        <CardHeader className="border-b border-gray-200 dark:border-gray-700">
          <CardTitle className="text-gray-900 dark:text-gray-100">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className={`p-2 rounded-lg ${
                    activity.type === 'claim' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                    activity.type === 'job' ? 'bg-blue-100 dark:bg-blue-900/30' :
                    activity.type === 'payment' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                    'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    {activity.type === 'claim' ? <FileText className="w-5 h-5 text-yellow-600 dark:text-yellow-400" /> :
                     activity.type === 'job' ? <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" /> :
                     activity.type === 'payment' ? <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> :
                     <AlertCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{activity.description}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{activity.time}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    activity.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    activity.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {activity.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              No recent activity
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {can(PERMISSIONS.WARRANTY_CLAIM_CREATE) && (
          <Button
            onClick={() => window.location.href = '/dashboard/technical/warranty-claims/create'}
            className="h-20 bg-yellow-600 hover:bg-yellow-700 text-white dark:bg-yellow-500 dark:hover:bg-yellow-600"
          >
            <FileText className="w-6 h-6 mr-2" />
            New Warranty Claim
          </Button>
        )}
        {can(PERMISSIONS.JOB_ORDER_CREATE) && (
          <Button
            onClick={() => window.location.href = '/dashboard/technical/job-orders/create'}
            className="h-20 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <Wrench className="w-6 h-6 mr-2" />
            New Job Order
          </Button>
        )}
        <Button
          onClick={() => window.location.href = '/dashboard/technical/serial-lookup'}
          className="h-20 bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-500 dark:hover:bg-purple-600"
        >
          <FileText className="w-6 h-6 mr-2" />
          Serial Lookup
        </Button>
        {can(PERMISSIONS.SERVICE_PAYMENT_VIEW) && (
          <Button
            onClick={() => window.location.href = '/dashboard/technical/payments'}
            className="h-20 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            <DollarSign className="w-6 h-6 mr-2" />
            View Payments
          </Button>
        )}
      </div>
    </div>
  )
}
