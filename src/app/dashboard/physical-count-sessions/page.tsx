'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowPathIcon, DevicePhoneMobileIcon, EyeIcon } from '@heroicons/react/24/outline'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { CountGrid } from '@/components/physical-count/CountGrid'
import { CountStatusBadge, COUNT_STATUS_LABEL } from '@/components/physical-count/CountStatusBadge'

type SessionRow = {
  id: number
  status: string
  locationName: string
  counters: string
  startedByName: string
  startedAt: string
  submittedAt: string | null
  approvedAt: string | null
  lineCount: number
  unknownCount: number
}

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'submitted', label: 'Waiting for approval' },
  { key: 'open', label: 'Counting' },
  { key: 'sent_back', label: 'Sent back' },
  { key: 'approved', label: 'Approved' },
]

export default function PhysicalCountSessionsPage() {
  const router = useRouter()
  const { can } = usePermissions()
  const allowed = can(PERMISSIONS.PHYSICAL_COUNT_VIEW) || can(PERMISSIONS.INVENTORY_CORRECTION_APPROVE)
  const [rows, setRows] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/count-sessions')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setRows(
        json.sessions.map((s: SessionRow) => ({
          ...s,
          startedAt: new Date(s.startedAt),
          submittedAt: s.submittedAt ? new Date(s.submittedAt) : null,
          approvedAt: s.approvedAt ? new Date(s.approvedAt) : null,
        }))
      )
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!allowed) {
      router.push('/dashboard')
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed])

  const shown = useMemo(() => (filter ? rows.filter(r => r.status === filter) : rows), [rows, filter])
  const countOf = (key: string) => (key ? rows.filter(r => r.status === key).length : rows.length)

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-teal-900 dark:text-teal-200 flex items-center gap-3">
            <DevicePhoneMobileIcon className="h-8 w-8 text-teal-600 dark:text-teal-400" />
            Physical Count Sessions
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Counts done with the mobile app. Open a submitted count to review and approve it.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Folder tabs */}
      <div className="flex flex-wrap gap-1 border-b-2 border-teal-700 dark:border-teal-500" role="tablist">
        {FILTERS.map(f => {
          const active = filter === f.key
          return (
            <button
              key={f.key || 'all'}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              className={
                'px-4 py-2 rounded-t-lg border border-b-0 text-sm font-medium transition-colors ' +
                (active
                  ? 'bg-teal-700 border-teal-700 text-white dark:bg-teal-600 dark:border-teal-600'
                  : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700')
              }
            >
              {f.label} <span className="ml-1 opacity-90">({countOf(f.key)})</span>
            </button>
          )
        })}
      </div>

      <CountGrid
        title={`Physical Count Sessions${filter ? ' - ' + COUNT_STATUS_LABEL[filter] : ''}`}
        fileName="physical_count_sessions"
        data={shown}
        keyExpr="id"
        loading={loading}
        emptyText="No count sessions yet. Counts appear here when staff start counting with the mobile app."
        columns={[
          {
            dataField: 'id',
            caption: 'Session',
            width: 110,
            cellRender: ({ value }) => (
              <Link href={`/dashboard/physical-count-sessions/${value}`} className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline dark:text-blue-400">
                <EyeIcon className="h-4 w-4" />#{value}
              </Link>
            ),
          },
          {
            dataField: 'status',
            caption: 'Status',
            width: 170,
            cellRender: ({ value }) => <CountStatusBadge status={value} />,
            printValue: r => COUNT_STATUS_LABEL[r.status] ?? r.status,
          },
          { dataField: 'locationName', caption: 'Location' },
          { dataField: 'counters', caption: 'Counted by' },
          { dataField: 'startedAt', caption: 'Started', dataType: 'datetime', format: 'MM/dd/yyyy hh:mm a' },
          { dataField: 'submittedAt', caption: 'Submitted', dataType: 'datetime', format: 'MM/dd/yyyy hh:mm a' },
          { dataField: 'approvedAt', caption: 'Approved', dataType: 'datetime', format: 'MM/dd/yyyy hh:mm a' },
          { dataField: 'lineCount', caption: 'Count lines', dataType: 'number', alignment: 'right' },
          { dataField: 'unknownCount', caption: 'Unknown items', dataType: 'number', alignment: 'right' },
        ]}
        totals={[
          { column: 'id', summaryType: 'count', displayFormat: '{0} sessions' },
          { column: 'lineCount', displayFormat: '{0}' },
          { column: 'unknownCount', displayFormat: '{0}' },
        ]}
      />
    </div>
  )
}
