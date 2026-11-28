'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeftIcon, ArrowPathIcon, EnvelopeIcon, ScaleIcon } from '@heroicons/react/24/outline'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CountGrid } from '@/components/physical-count/CountGrid'
import { CountStatusBadge, COUNT_STATUS_LABEL } from '@/components/physical-count/CountStatusBadge'

type Row = {
  key: string
  sessionId: number
  status: string
  locationName: string
  productName: string
  variationName: string
  sku: string
  countedAt: Date
  systemAtCount: number
  counted: number
  difference: number
  unitCost: number
  value: number
  item: string
}

/** Today as YYYY-MM-DD in Philippine time. */
const todayPH = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 })
const peso = (n: number) => '₱' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const EMAIL_KEY = 'countMismatchEmails'

const TABS = [
  { key: 'mismatch', label: 'Mismatches only' },
  { key: 'all', label: 'All counted items' },
  { key: 'branches', label: 'Summary per branch' },
] as const

export default function CountMismatchReportPage() {
  const router = useRouter()
  const { can } = usePermissions()
  const allowed = can(PERMISSIONS.PHYSICAL_COUNT_VIEW) || can(PERMISSIONS.INVENTORY_CORRECTION_APPROVE)

  const [from, setFrom] = useState(todayPH)
  const [to, setTo] = useState(todayPH)
  const [locationId, setLocationId] = useState('')
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('mismatch')
  const [emailOpen, setEmailOpen] = useState(false)
  const [emails, setEmails] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ from, to, ...(locationId ? { locationId } : {}) })
      const res = await fetch(`/api/count-sessions/mismatch?${q}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setLocations(json.locations)
      setRows(
        json.rows.map((r: Row) => ({
          ...r,
          countedAt: new Date(r.countedAt),
          item: r.productName + (r.variationName ? ` - ${r.variationName}` : ''),
        }))
      )
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [from, to, locationId])

  useEffect(() => {
    if (!allowed) {
      router.push('/dashboard')
      return
    }
    load()
  }, [allowed, load, router])

  useEffect(() => setEmails(localStorage.getItem(EMAIL_KEY) ?? ''), [])

  const mismatches = useMemo(() => rows.filter(r => r.difference !== 0), [rows])
  const totals = useMemo(
    () => ({
      short: rows.reduce((s, r) => s + (r.difference < 0 ? -r.difference : 0), 0),
      over: rows.reduce((s, r) => s + (r.difference > 0 ? r.difference : 0), 0),
      value: rows.reduce((s, r) => s + r.value, 0),
    }),
    [rows]
  )
  const branches = useMemo(() => {
    const m = new Map<string, { locationName: string; counted: number; mismatched: number; short: number; over: number; value: number }>()
    for (const r of rows) {
      const b = m.get(r.locationName) ?? { locationName: r.locationName, counted: 0, mismatched: 0, short: 0, over: 0, value: 0 }
      b.counted++
      if (r.difference !== 0) b.mismatched++
      if (r.difference < 0) b.short += -r.difference
      if (r.difference > 0) b.over += r.difference
      b.value += r.value
      m.set(r.locationName, b)
    }
    return [...m.values()].sort((a, b) => a.locationName.localeCompare(b.locationName))
  }, [rows])

  const branchLabel = locationId ? (locations.find(l => String(l.id) === locationId)?.name ?? '') : 'All branches'
  const period = from === to ? from : `${from} to ${to}`
  const fileDate = from === to ? from : `${from}_${to}`

  const sendEmail = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/count-sessions/mismatch/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, locationId: locationId || null, emails, onlyMismatches: tab !== 'all' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to send')
      localStorage.setItem(EMAIL_KEY, emails)
      toast.success(`Report sent to ${json.to.join(', ')}`)
      setEmailOpen(false)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const diffCell = ({ value }: { value: number }) => (
    <span className={`font-bold ${value < 0 ? 'text-red-700 dark:text-red-400' : value > 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}`}>
      {value > 0 ? '+' : ''}
      {qty(value)}
    </span>
  )

  const itemColumns = [
    { dataField: 'locationName', caption: 'Branch' },
    {
      dataField: 'sessionId',
      caption: 'Session',
      width: 95,
      cellRender: ({ value }: { value: number }) => (
        <Link href={`/dashboard/physical-count-sessions/${value}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">
          #{value}
        </Link>
      ),
    },
    {
      dataField: 'status',
      caption: 'Status',
      width: 160,
      cellRender: ({ value }: { value: string }) => <CountStatusBadge status={value} />,
      printValue: (r: Row) => COUNT_STATUS_LABEL[r.status] ?? r.status,
    },
    { dataField: 'item', caption: 'Item' },
    { dataField: 'sku', caption: 'SKU' },
    { dataField: 'countedAt', caption: 'Last counted', dataType: 'datetime' as const, format: 'MM/dd/yyyy hh:mm a' },
    { dataField: 'systemAtCount', caption: 'System qty', dataType: 'number' as const, alignment: 'right' as const },
    { dataField: 'counted', caption: 'Counted qty', dataType: 'number' as const, alignment: 'right' as const },
    { dataField: 'difference', caption: 'Difference', dataType: 'number' as const, alignment: 'right' as const, cellRender: diffCell },
    { dataField: 'unitCost', caption: 'Unit cost', dataType: 'number' as const, format: '#,##0.00', alignment: 'right' as const },
    { dataField: 'value', caption: 'Value (cost)', dataType: 'number' as const, format: '#,##0.00', alignment: 'right' as const },
  ]
  const itemTotals = [
    { column: 'item', summaryType: 'count' as const, displayFormat: '{0} items' },
    { column: 'systemAtCount' },
    { column: 'counted' },
    { column: 'difference' },
    { column: 'value', valueFormat: '#,##0.00' },
  ]

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/physical-count-sessions" className="mb-2 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline dark:text-blue-400">
            <ArrowLeftIcon className="h-4 w-4" /> Physical Count Sessions
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-teal-900 dark:text-teal-200 flex items-center gap-3">
            <ScaleIcon className="h-8 w-8 text-teal-600 dark:text-teal-400" />
            Count Mismatch Report
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            System qty vs counted qty for every count made with the app, per branch. Live — includes counts still in progress.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="success" size="sm" onClick={() => setEmailOpen(true)} disabled={loading || rows.length === 0} className="gap-2">
            <EnvelopeIcon className="h-4 w-4" /> Send by email
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div>
          <Label htmlFor="branch">Branch</Label>
          <select
            id="branch"
            value={locationId}
            onChange={e => setLocationId(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="">All branches</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="from">Date counted — from</Label>
          <Input id="from" type="date" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="to">Date counted — to</Label>
          <Input id="to" type="date" value={to} min={from} onChange={e => e.target.value && setTo(e.target.value)} className="mt-1" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Items counted', value: rows.length.toLocaleString(), tone: 'text-gray-900 dark:text-gray-100' },
          { label: 'With mismatch', value: mismatches.length.toLocaleString(), tone: mismatches.length ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400' },
          { label: 'Units short', value: totals.short ? `−${qty(totals.short)}` : '0', tone: 'text-red-700 dark:text-red-400' },
          { label: 'Units over', value: totals.over ? `+${qty(totals.over)}` : '0', tone: 'text-green-700 dark:text-green-400' },
          { label: 'Value impact (cost)', value: peso(totals.value), tone: totals.value < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">{c.label}</div>
            <div className={`mt-1 text-lg sm:text-xl font-bold ${c.tone}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Folder tabs */}
      <div className="flex flex-wrap gap-1 border-b-2 border-teal-700 dark:border-teal-500" role="tablist">
        {TABS.map(t => {
          const active = tab === t.key
          const n = t.key === 'mismatch' ? mismatches.length : t.key === 'all' ? rows.length : branches.length
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={
                'px-4 py-2 rounded-t-lg border border-b-0 text-sm font-medium transition-colors ' +
                (active
                  ? 'bg-teal-700 border-teal-700 text-white dark:bg-teal-600 dark:border-teal-600'
                  : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700')
              }
            >
              {t.label} <span className="ml-1 opacity-90">({n})</span>
            </button>
          )
        })}
      </div>

      {tab === 'branches' ? (
        <CountGrid
          key="branches"
          title={`Count Mismatch Summary per Branch - ${period}`}
          fileName={`count_mismatch_branches_${fileDate}`}
          data={branches}
          keyExpr="locationName"
          loading={loading}
          emptyText="No counts in this period."
          columns={[
            { dataField: 'locationName', caption: 'Branch' },
            { dataField: 'counted', caption: 'Items counted', dataType: 'number', alignment: 'right' },
            { dataField: 'mismatched', caption: 'With mismatch', dataType: 'number', alignment: 'right' },
            { dataField: 'short', caption: 'Units short', dataType: 'number', alignment: 'right' },
            { dataField: 'over', caption: 'Units over', dataType: 'number', alignment: 'right' },
            { dataField: 'value', caption: 'Value impact (cost)', dataType: 'number', format: '#,##0.00', alignment: 'right' },
          ]}
          totals={[
            { column: 'locationName', summaryType: 'count', displayFormat: '{0} branches' },
            { column: 'counted' },
            { column: 'mismatched' },
            { column: 'short' },
            { column: 'over' },
            { column: 'value', valueFormat: '#,##0.00' },
          ]}
        />
      ) : (
        <CountGrid
          key={tab}
          title={`Count Mismatch Report - ${branchLabel} - ${period}${tab === 'all' ? ' (all counted items)' : ''}`}
          fileName={`count_mismatch_${fileDate}`}
          data={tab === 'mismatch' ? mismatches : rows}
          keyExpr="key"
          loading={loading}
          emptyText={tab === 'mismatch' ? 'No mismatches — every counted item matches the system. 🎉' : 'No counts in this period.'}
          columns={itemColumns}
          totals={itemTotals}
        />
      )}

      <Dialog open={emailOpen} onOpenChange={o => !sending && setEmailOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send report by email</DialogTitle>
            <DialogDescription>
              {branchLabel} · {period} · {tab === 'all' ? `all ${rows.length} counted items` : `${mismatches.length} items with a mismatch`}.
              The email has a summary per branch and the full list as an Excel file.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="emails">Send to (separate several with commas)</Label>
            <Input id="emails" type="text" value={emails} onChange={e => setEmails(e.target.value)} placeholder="owner@example.com, manager@example.com" className="mt-1" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEmailOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button variant="success" className="gap-2 min-w-32" onClick={sendEmail} disabled={sending || !emails.trim()}>
              {sending ? <span className="animate-spin">⏳</span> : <EnvelopeIcon className="h-4 w-4" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
