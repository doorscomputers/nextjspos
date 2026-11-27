'use client'

import { useCallback, useRef } from 'react'
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Selection,
  Summary,
  TotalItem,
  LoadPanel,
  Scrolling,
} from 'devextreme-react/data-grid'
import type { DataGridRef } from 'devextreme-react/data-grid'
import type { ContentReadyEvent, SelectionChangedEvent } from 'devextreme/ui/data_grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver-es'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import { DocumentArrowDownIcon, DocumentTextIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { DataGridPagerBar, useDataGridPager } from '@/components/DataGridPagerBar'
import { DataGridTopScrollbar, useDataGridTopScrollbar } from '@/components/DataGridTopScrollbar'

export type CountGridColumn = {
  dataField: string
  caption: string
  dataType?: 'string' | 'number' | 'date' | 'datetime' | 'boolean'
  format?: string
  width?: number
  alignment?: 'left' | 'right' | 'center'
  cellRender?: (data: { value: any; data: any }) => React.ReactNode
  /** Plain text used for Print (defaults to the raw value) */
  printValue?: (row: any) => string
}

type Props = {
  title: string
  fileName: string
  data: any[]
  keyExpr: string
  columns: CountGridColumn[]
  totals?: { column: string; summaryType?: 'sum' | 'count'; valueFormat?: string; displayFormat?: string }[]
  loading?: boolean
  selectable?: boolean
  selectedKeys?: any[]
  onSelectionChange?: (keys: any[]) => void
  emptyText?: string
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * DevExtreme grid used by the Physical Count pages: top + bottom scrollbars,
 * Rows per page (default 25), Showing X–Y of Z, Previous/Next, totals over ALL rows,
 * and Excel / PDF / Print of all rows.
 */
export function CountGrid(props: Props) {
  const { title, fileName, data, keyExpr, columns, totals = [], loading, selectable, selectedKeys, onSelectionChange, emptyText } = props
  const gridRef = useRef<DataGridRef>(null)
  const pager = useDataGridPager(25)
  const top = useDataGridTopScrollbar()

  const onContentReady = useCallback(
    (e: ContentReadyEvent) => {
      pager.onContentReady(e)
      top.onContentReady(e)
    },
    [pager, top]
  )

  const exportExcel = () => {
    const grid = gridRef.current?.instance()
    if (!grid) return
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet(title.slice(0, 31))
    exportToExcel({ component: grid, worksheet, autoFilterEnabled: true }).then(() =>
      workbook.xlsx.writeBuffer().then(buffer =>
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `${fileName}.xlsx`)
      )
    )
  }

  const exportPdf = () => {
    const grid = gridRef.current?.instance()
    if (!grid) return
    const doc = new jsPDF('l', 'mm', 'a4')
    doc.setFontSize(12)
    doc.text(title, 10, 10)
    exportToPDF({ jsPDFDocument: doc, component: grid, topLeft: { x: 0, y: 6 } }).then(() => doc.save(`${fileName}.pdf`))
  }

  /** Prints ALL rows as a real table (fits any paper size), not the on-screen page. */
  const print = () => {
    const head = columns.map(c => `<th>${escapeHtml(c.caption)}</th>`).join('')
    const body = data
      .map(row => {
        const cells = columns.map(c => {
          const raw = c.printValue ? c.printValue(row) : row[c.dataField]
          const text = raw === null || raw === undefined ? '' : raw instanceof Date ? raw.toLocaleString() : String(raw)
          const num = c.dataType === 'number' || c.alignment === 'right'
          return `<td${num ? ' class="n"' : ''}>${escapeHtml(text)}</td>`
        })
        return `<tr>${cells.join('')}</tr>`
      })
      .join('')
    const foot = totals.length
      ? `<tr class="t">${columns
          .map(c => {
            const t = totals.find(x => x.column === c.dataField)
            if (!t) return '<td></td>'
            const v = t.summaryType === 'count' ? data.length : data.reduce((s, r) => s + (Number(r[c.dataField]) || 0), 0)
            return `<td class="n">${escapeHtml(v.toLocaleString(undefined, { maximumFractionDigits: 2 }))}</td>`
          })
          .join('')}</tr>`
      : ''
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
  h1 { font-size: 15px; margin: 0 0 4px; } p { margin: 0 0 8px; color: #444; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 3px 5px; text-align: left; }
  th { background: #e5e7eb; } td.n { text-align: right; } tr.t td { font-weight: bold; background: #f3f4f6; }
  thead { display: table-header-group; } tr { page-break-inside: avoid; }
</style></head><body>
<h1>${escapeHtml(title)}</h1><p>Printed ${escapeHtml(new Date().toLocaleString())} · ${data.length} rows</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table>
<script>window.onload = function () { window.print(); }</script></body></html>`)
    w.document.close()
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-b-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <Button variant="outline" size="sm" onClick={exportExcel} disabled={!data.length}
          className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400">
          <DocumentArrowDownIcon className="h-4 w-4" />
          Excel
        </Button>
        <Button variant="outline" size="sm" onClick={exportPdf} disabled={!data.length}
          className="gap-2 hover:border-red-500 hover:text-red-700 dark:hover:text-red-400">
          <DocumentTextIcon className="h-4 w-4" />
          PDF
        </Button>
        <Button variant="outline" size="sm" onClick={print} disabled={!data.length}
          className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400">
          <PrinterIcon className="h-4 w-4" />
          Print
        </Button>
      </div>
      <DataGridPagerBar pager={pager} />
      <DataGridTopScrollbar bar={top} />
      <DataGrid
        ref={gridRef}
        dataSource={data}
        keyExpr={keyExpr}
        showBorders={false}
        showRowLines
        rowAlternationEnabled
        hoverStateEnabled
        allowColumnResizing
        columnAutoWidth
        noDataText={emptyText ?? 'Nothing to show'}
        onContentReady={onContentReady}
        selectedRowKeys={selectable ? selectedKeys : undefined}
        onSelectionChanged={
          selectable && onSelectionChange
            ? (e: SelectionChangedEvent) => onSelectionChange(e.selectedRowKeys)
            : undefined
        }
      >
        <LoadPanel enabled={!!loading} />
        <Scrolling useNative showScrollbar="always" />
        {selectable && <Selection mode="multiple" selectAllMode="allPages" showCheckBoxesMode="always" />}
        <Paging defaultPageSize={25} />
        <Pager visible={false} />
        <FilterRow visible />
        <HeaderFilter visible />
        <SearchPanel visible width={240} placeholder="Search..." />
        {columns.map(c => (
          <Column
            key={c.dataField}
            dataField={c.dataField}
            caption={c.caption}
            dataType={c.dataType}
            format={c.format}
            width={c.width}
            alignment={c.alignment}
            cellRender={c.cellRender}
          />
        ))}
        {totals.length > 0 && (
          <Summary>
            {totals.map(t => (
              <TotalItem
                key={t.column}
                column={t.column}
                summaryType={t.summaryType ?? 'sum'}
                valueFormat={t.valueFormat}
                displayFormat={t.displayFormat ?? '{0}'}
              />
            ))}
          </Summary>
        )}
      </DataGrid>
    </div>
  )
}
