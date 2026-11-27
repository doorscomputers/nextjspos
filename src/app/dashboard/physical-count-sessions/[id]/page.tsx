'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CountGrid } from '@/components/physical-count/CountGrid'
import { CountStatusBadge } from '@/components/physical-count/CountStatusBadge'

type Item = {
  variationId: number
  productName: string
  variationName: string
  sku: string
  lineCount: number
  counted: number
  systemAtCount: number
  difference: number
  unitCost: number
  value: number
  movedAfterCount: boolean
  result: 'pending' | 'posted' | 'matched' | 'skipped'
}

type Review = {
  session: {
    id: number
    status: string
    locationName: string
    startedByName: string
    startedAt: string
    submittedAt: string | null
    approvedAt: string | null
    sendBackNote: string | null
    counters: { userId: number; name: string; done: boolean }[]
  }
  items: Item[]
  notCounted: { variationId: number; productName: string; variationName: string; sku: string; systemQty: number; value: number }[]
  unknownItems: { id: string; scannedCode: string | null; description: string; qty: number; countedByName: string; countedAt: string }[]
  edits: { id: number; productName: string; countedByName: string; oldQty: number; newQty: number | null; editedByName: string; editedAt: string }[]
}

type Tab = 'counted' | 'notCounted' | 'unknown' | 'edits'

const peso = (n: number) =>
  `${n < 0 ? '−' : n > 0 ? '+' : ''}₱${Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 })
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${qty(Math.abs(n))}`
const when = (s: string | null) => (s ? new Date(s).toLocaleString() : '—')

const RESULT_LABEL: Record<Item['result'], string> = {
  pending: 'Waiting',
  posted: 'Posted to ledger',
  matched: 'Matched',
  skipped: 'Skipped',
}

export default function PhysicalCountSessionPage() {
  const id = useParams<{ id: string }>()?.id ?? ''
  const router = useRouter()
  const { can, user } = usePermissions()
  const canView = can(PERMISSIONS.PHYSICAL_COUNT_VIEW) || can(PERMISSIONS.INVENTORY_CORRECTION_APPROVE)
  const canApprove = can(PERMISSIONS.INVENTORY_CORRECTION_APPROVE)

  const [data, setData] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('counted')
  const [selected, setSelected] = useState<number[]>([])
  const [confirm, setConfirm] = useState<null | 'all' | 'selected'>(null)
  const [sendBackOpen, setSendBackOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/count-sessions/${id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setData(json)
      setSelected(json.items.filter((i: Item) => i.difference !== 0 && i.result === 'pending').map((i: Item) => i.variationId))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!canView) {
      router.push('/dashboard')
      return
    }
    load()
  }, [canView, load, router])

  const s = data?.session
  const items = data?.items ?? []
  const withDiff = useMemo(() => items.filter(i => i.difference !== 0), [items])
  const myId = Number((user as any)?.id)
  const iCounted = !!s?.counters.some(c => c.userId === myId)
  const reviewable = s && (s.status === 'submitted' || s.status === 'approving')

  const impact = (list: Item[]) => ({
    count: list.length,
    added: list.filter(i => i.difference > 0).reduce((a, i) => a + i.difference, 0),
    removed: list.filter(i => i.difference < 0).reduce((a, i) => a - i.difference, 0),
    value: list.reduce((a, i) => a + i.value, 0),
  })
  const toPost = confirm === 'selected' ? withDiff.filter(i => selected.includes(i.variationId)) : withDiff
  const toPostImpact = impact(toPost)
  const allImpact = impact(withDiff)

  const approve = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      const res = await fetch(`/api/count-sessions/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirm === 'selected' ? { variationIds: selected } : {}),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Approval failed')
      toast.success(json.message || 'Count approved')
      setConfirm(null)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const sendBack = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/count-sessions/${id}/send-back`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      toast.success(json.message)
      setSendBackOpen(false)
      setNote('')
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'counted', label: 'Counted', count: items.length },
    { key: 'notCounted', label: 'Not counted', count: data?.notCounted.length ?? 0 },
    { key: 'unknown', label: 'Unknown items', count: data?.unknownItems.length ?? 0 },
    { key: 'edits', label: 'Edit history', count: data?.edits.length ?? 0 },
  ]

  const productLabel = (r: { productName: string; variationName: string }) =>
    r.variationName ? `${r.productName} - ${r.variationName}` : r.productName

  return (
    <div className="p-4 sm:p-8">
      <Link href="/dashboard/physical-count-sessions" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline dark:text-blue-400 mb-3">
        <ArrowLeftIcon className="h-4 w-4" /> All count sessions
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/40 p-4 sm:p-5 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-teal-900 dark:text-teal-100">
              Count Session #{id}{s ? ` — ${s.locationName}` : ''}
            </h1>
            {s && (
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                Counted by <strong>{s.counters.map(c => c.name).join(', ') || s.startedByName}</strong> · Started {when(s.startedAt)} ·
                Submitted {when(s.submittedAt)}
                {s.approvedAt ? ` · Approved ${when(s.approvedAt)}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {s && <CountStatusBadge status={s.status} />}
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>
        {s?.sendBackNote && (
          <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            <strong>Sent back note:</strong> {s.sendBackNote}
          </div>
        )}
        {s?.status === 'approving' && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            Approval did not finish for every item. Press Approve again: items already posted will not be posted twice.
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Items counted', value: items.length.toLocaleString(), tone: 'text-gray-900 dark:text-gray-100' },
          { label: 'Items with a difference', value: withDiff.length.toLocaleString(), tone: 'text-amber-700 dark:text-amber-400' },
          { label: 'Units +/−', value: `+${qty(allImpact.added)} / −${qty(allImpact.removed)}`, tone: 'text-gray-900 dark:text-gray-100' },
          { label: 'Value impact (at cost)', value: peso(allImpact.value), tone: allImpact.value < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">{c.label}</div>
            <div className={`mt-1 text-lg sm:text-xl font-bold ${c.tone}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      {reviewable && canApprove && (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          {iCounted ? (
            <p className="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5" /> You counted in this session, so another approver must approve it.
            </p>
          ) : (
            <>
              {s?.status === 'submitted' && (
                <Button variant="outline" size="sm" onClick={() => setSendBackOpen(true)} disabled={busy}
                  className="gap-2 border-red-300 text-red-700 hover:border-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
                  <ArrowUturnLeftIcon className="h-4 w-4" /> Send back
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setConfirm('selected')} disabled={busy || selected.length === 0}
                className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400">
                Approve selected ({selected.length})
              </Button>
              <Button variant="success" size="sm" onClick={() => setConfirm('all')} disabled={busy} className="gap-2">
                <CheckCircleIcon className="h-4 w-4" /> Approve all with differences ({withDiff.length})
              </Button>
            </>
          )}
        </div>
      )}

      {/* Folder tabs */}
      <div className="flex flex-wrap gap-1 border-b-2 border-teal-700 dark:border-teal-500" role="tablist">
        {tabs.map(t => {
          const active = tab === t.key
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
              {t.label} <span className="ml-1 opacity-90">({t.count})</span>
            </button>
          )
        })}
      </div>

      {tab === 'counted' && (
        <CountGrid
          title={`Count Session #${id} - ${s?.locationName ?? ''} - Counted`}
          fileName={`count_session_${id}_counted`}
          data={items}
          keyExpr="variationId"
          loading={loading}
          selectable={!!reviewable && canApprove && !iCounted}
          selectedKeys={selected}
          onSelectionChange={keys => setSelected(keys.filter(k => withDiff.some(i => i.variationId === k)))}
          emptyText="No items counted."
          columns={[
            { dataField: 'productName', caption: 'Product', cellRender: ({ data: r }) => productLabel(r), printValue: productLabel },
            { dataField: 'sku', caption: 'SKU', width: 130 },
            { dataField: 'systemAtCount', caption: 'System at count', dataType: 'number', alignment: 'right', width: 130 },
            { dataField: 'counted', caption: 'Counted', dataType: 'number', alignment: 'right', width: 100,
              cellRender: ({ value }) => <strong>{qty(value)}</strong> },
            { dataField: 'difference', caption: 'Difference', dataType: 'number', alignment: 'right', width: 110,
              cellRender: ({ value }) => (
                <span className={value > 0 ? 'font-bold text-green-700 dark:text-green-400' : value < 0 ? 'font-bold text-red-700 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}>
                  {signed(value)}
                </span>
              ),
              printValue: r => signed(r.difference) },
            { dataField: 'value', caption: 'Value (₱)', dataType: 'number', alignment: 'right', width: 130,
              cellRender: ({ value }) => (
                <span className={value > 0 ? 'text-green-700 dark:text-green-400' : value < 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}>
                  {peso(value)}
                </span>
              ),
              printValue: r => peso(r.value) },
            { dataField: 'lineCount', caption: 'Lines', dataType: 'number', alignment: 'right', width: 80 },
            { dataField: 'result', caption: 'Result', width: 150,
              cellRender: ({ data: r }) => (
                <span className="flex items-center gap-1">
                  <span className={r.result === 'posted' ? 'text-green-700 dark:text-green-400' : r.result === 'skipped' ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'}>
                    {RESULT_LABEL[r.result as Item['result']]}
                  </span>
                  {r.movedAfterCount && (
                    <span title="Stock moved after this item was counted (sale, transfer, receipt). The posted difference still uses the count-time snapshot."
                      className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                      <ExclamationTriangleIcon className="h-3.5 w-3.5" /> moved
                    </span>
                  )}
                </span>
              ),
              printValue: r => RESULT_LABEL[r.result as Item['result']] + (r.movedAfterCount ? ' (stock moved after count)' : '') },
          ]}
          totals={[
            { column: 'productName', summaryType: 'count', displayFormat: '{0} items' },
            { column: 'counted', valueFormat: '#,##0.####' },
            { column: 'difference', valueFormat: '+#,##0.####;−#,##0.####' },
            { column: 'value', valueFormat: '₱#,##0.00;−₱#,##0.00' },
            { column: 'lineCount' },
          ]}
        />
      )}

      {tab === 'notCounted' && (
        <>
          <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-x border-gray-200 dark:border-gray-700 px-4 py-2">
            Items with stock at this branch that nobody scanned. <strong>Approving does not change these.</strong> Send the count back if they should be counted.
          </p>
          <CountGrid
            title={`Count Session #${id} - ${s?.locationName ?? ''} - Not counted`}
            fileName={`count_session_${id}_not_counted`}
            data={data?.notCounted ?? []}
            keyExpr="variationId"
            loading={loading}
            emptyText="Every item with stock was counted."
            columns={[
              { dataField: 'productName', caption: 'Product', cellRender: ({ data: r }) => productLabel(r), printValue: productLabel },
              { dataField: 'sku', caption: 'SKU', width: 130 },
              { dataField: 'systemQty', caption: 'System qty now', dataType: 'number', alignment: 'right', width: 140 },
              { dataField: 'value', caption: 'Value (₱)', dataType: 'number', alignment: 'right', width: 140, format: '₱#,##0.00' },
            ]}
            totals={[
              { column: 'productName', summaryType: 'count', displayFormat: '{0} items' },
              { column: 'systemQty', valueFormat: '#,##0.####' },
              { column: 'value', valueFormat: '₱#,##0.00' },
            ]}
          />
        </>
      )}

      {tab === 'unknown' && (
        <>
          <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-x border-gray-200 dark:border-gray-700 px-4 py-2">
            Items the counters could not find in the system. <strong>These never change stock.</strong> Create the product or correct its barcode, then count it.
          </p>
          <CountGrid
            title={`Count Session #${id} - ${s?.locationName ?? ''} - Unknown items`}
            fileName={`count_session_${id}_unknown`}
            data={data?.unknownItems.map(u => ({ ...u, countedAt: new Date(u.countedAt) })) ?? []}
            keyExpr="id"
            loading={loading}
            emptyText="No unknown items."
            columns={[
              { dataField: 'description', caption: 'Description' },
              { dataField: 'scannedCode', caption: 'Scanned barcode', width: 170 },
              { dataField: 'qty', caption: 'Qty', dataType: 'number', alignment: 'right', width: 90 },
              { dataField: 'countedByName', caption: 'Counted by', width: 150 },
              { dataField: 'countedAt', caption: 'When', dataType: 'datetime', format: 'MM/dd/yyyy hh:mm a', width: 170 },
            ]}
            totals={[
              { column: 'description', summaryType: 'count', displayFormat: '{0} items' },
              { column: 'qty', valueFormat: '#,##0.####' },
            ]}
          />
        </>
      )}

      {tab === 'edits' && (
        <CountGrid
          title={`Count Session #${id} - ${s?.locationName ?? ''} - Edit history`}
          fileName={`count_session_${id}_edits`}
          data={data?.edits.map(e => ({ ...e, editedAt: new Date(e.editedAt), change: e.newQty === null ? 'Deleted' : 'Changed' })) ?? []}
          keyExpr="id"
          loading={loading}
          emptyText="No counts were edited."
          columns={[
            { dataField: 'editedAt', caption: 'When', dataType: 'datetime', format: 'MM/dd/yyyy hh:mm a', width: 170 },
            { dataField: 'productName', caption: 'Product' },
            { dataField: 'change', caption: 'Change', width: 100 },
            { dataField: 'oldQty', caption: 'Old qty', dataType: 'number', alignment: 'right', width: 100 },
            { dataField: 'newQty', caption: 'New qty', dataType: 'number', alignment: 'right', width: 100,
              cellRender: ({ value }) => (value === null ? <span className="text-red-700 dark:text-red-400">deleted</span> : qty(value)),
              printValue: r => (r.newQty === null ? 'deleted' : String(r.newQty)) },
            { dataField: 'editedByName', caption: 'Edited by', width: 150 },
          ]}
          totals={[{ column: 'editedAt', summaryType: 'count', displayFormat: '{0} edits' }]}
        />
      )}

      {/* Approve confirmation */}
      <Dialog open={confirm !== null} onOpenChange={o => !o && !busy && setConfirm(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve {confirm === 'selected' ? 'selected items' : 'all items with differences'}?</DialogTitle>
            <DialogDescription>
              Each item&apos;s ledger gets an adjustment of <strong>counted − system qty at count time</strong>, so sales made after the count stay correct.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="text-gray-700 dark:text-gray-300">Items to adjust</div>
            <div className="text-right font-bold text-gray-900 dark:text-gray-100">{toPostImpact.count}</div>
            <div className="text-gray-700 dark:text-gray-300">Units added</div>
            <div className="text-right font-bold text-green-700 dark:text-green-400">+{qty(toPostImpact.added)}</div>
            <div className="text-gray-700 dark:text-gray-300">Units removed</div>
            <div className="text-right font-bold text-red-700 dark:text-red-400">−{qty(toPostImpact.removed)}</div>
            <div className="text-gray-700 dark:text-gray-300">Value impact (at cost)</div>
            <div className={`text-right font-bold ${toPostImpact.value < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
              {peso(toPostImpact.value)}
            </div>
          </div>
          {confirm === 'selected' && withDiff.length > toPostImpact.count && (
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {withDiff.length - toPostImpact.count} item(s) with a difference are not selected and will be marked <strong>Skipped</strong> (no change).
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="success" onClick={approve} disabled={busy} className="gap-2 min-w-36">
              {busy && <span className="animate-spin">⏳</span>}
              Approve & post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send back */}
      <Dialog open={sendBackOpen} onOpenChange={o => !busy && setSendBackOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send back for recount</DialogTitle>
            <DialogDescription>
              The counters see this note in the app and can edit or add counts, then submit again. Nothing is posted.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={4}
            placeholder="e.g. Recount Mouse Logitech M90 and the HDMI cables in the stockroom."
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSendBackOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={sendBack} disabled={busy || !note.trim()} variant="destructive" className="gap-2 min-w-36">
              {busy && <span className="animate-spin">⏳</span>}
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
