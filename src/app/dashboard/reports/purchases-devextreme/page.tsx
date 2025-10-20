"use client"

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import DataGrid, { Column, Export, FilterRow, Paging, Grouping, GroupPanel, Summary, TotalItem, GroupItem } from 'devextreme-react/data-grid'

export default function PurchaseReportDevExtreme() {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/purchases')
      .then(res => res.json())
      .then(data => {
        if (data.purchases) {
          const transformed = data.purchases.map((p: any) => ({
            id: p.id,
            purchaseNumber: p.purchaseNumber,
            purchaseDate: p.purchaseDate,
            supplierName: p.supplier?.name || 'N/A',
            locationName: p.location?.name || 'N/A',
            status: p.status,
            totalAmount: parseFloat(p.totalAmount) || 0,
            paidAmount: parseFloat(p.paidAmount) || 0,
            dueAmount: (parseFloat(p.totalAmount) || 0) - (parseFloat(p.paidAmount) || 0),
          }))
          setPurchases(transformed)
        }
        setLoading(false)
      })
      .catch(() => {
        toast.error('Failed to load purchases')
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Purchase Report - Supplier Analysis</h1>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-500 text-white p-4 rounded-lg">
          <div className="text-sm opacity-90">Total Purchases</div>
          <div className="text-2xl font-bold">₱{purchases.reduce((sum: number, p: any) => sum + p.totalAmount, 0).toLocaleString()}</div>
        </div>
        <div className="bg-green-500 text-white p-4 rounded-lg">
          <div className="text-sm opacity-90">Total Paid</div>
          <div className="text-2xl font-bold">₱{purchases.reduce((sum: number, p: any) => sum + p.paidAmount, 0).toLocaleString()}</div>
        </div>
        <div className="bg-red-500 text-white p-4 rounded-lg">
          <div className="text-sm opacity-90">Total Due</div>
          <div className="text-2xl font-bold">₱{purchases.reduce((sum: number, p: any) => sum + p.dueAmount, 0).toLocaleString()}</div>
        </div>
        <div className="bg-purple-500 text-white p-4 rounded-lg">
          <div className="text-sm opacity-90">Suppliers</div>
          <div className="text-2xl font-bold">{new Set(purchases.map((p: any) => p.supplierName)).size}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <DataGrid dataSource={purchases} showBorders={true} columnAutoWidth={true} rowAlternationEnabled={true} height={600}>
          <Export enabled={true} formats={['xlsx', 'pdf']} />
          <FilterRow visible={true} />
          <Paging defaultPageSize={20} />
          <Grouping autoExpandAll={false} />
          <GroupPanel visible={true} emptyPanelText="Drag column headers here to group" />

          <Column dataField="purchaseNumber" caption="Purchase #" width={120} />
          <Column dataField="purchaseDate" caption="Date" dataType="date" format="MMM dd, yyyy" width={110} />
          <Column dataField="supplierName" caption="Supplier" minWidth={150} groupIndex={0} />
          <Column dataField="locationName" caption="Location" width={130} />
          <Column dataField="status" caption="Status" width={100} />
          <Column dataField="totalAmount" caption="Total" width={130} format="₱#,##0.00" alignment="right" />
          <Column dataField="paidAmount" caption="Paid" width={120} format="₱#,##0.00" alignment="right" />
          <Column dataField="dueAmount" caption="Due" width={120} format="₱#,##0.00" alignment="right" />

          <Summary>
            <GroupItem column="totalAmount" summaryType="sum" displayFormat="Total: ₱{0}" valueFormat="₱#,##0.00" alignByColumn={true} />
            <GroupItem column="paidAmount" summaryType="sum" displayFormat="₱{0}" valueFormat="₱#,##0.00" alignByColumn={true} />
            <GroupItem column="dueAmount" summaryType="sum" displayFormat="₱{0}" valueFormat="₱#,##0.00" alignByColumn={true} />
            <TotalItem column="totalAmount" summaryType="sum" displayFormat="Grand Total: ₱{0}" valueFormat="₱#,##0.00" />
            <TotalItem column="paidAmount" summaryType="sum" displayFormat="₱{0}" valueFormat="₱#,##0.00" />
            <TotalItem column="dueAmount" summaryType="sum" displayFormat="₱{0}" valueFormat="₱#,##0.00" />
          </Summary>
        </DataGrid>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <strong>Features:</strong> Drag columns to group panel • Click headers to sort • Export to Excel/PDF
        </div>
      </div>
    </div>
  )
}
