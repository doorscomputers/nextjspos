'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { PlusIcon, ArrowPathIcon, EyeIcon, PencilIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import DataGrid, {
    Column,
    Export,
    FilterRow,
    Grouping,
    GroupPanel,
    Pager,
    Paging,
    SearchPanel,
    Summary,
    TotalItem,
    Sorting,
    HeaderFilter,
    ColumnChooser,
    ColumnFixing,
    StateStoring,
    LoadPanel,
    Scrolling,
    Selection,
    MasterDetail,
    RemoteOperations,
} from 'devextreme-react/data-grid'
import CustomStore from 'devextreme/data/custom_store'
import { formatCurrency } from '@/lib/currencyUtils'

interface Sale {
    id: number
    invoiceNumber: string
    saleDate: string
    status: string
    subtotal: number
    taxAmount: number
    discountAmount: number
    totalAmount: number
    paymentStatus: string
    notes: string | null
    createdAt: string
    updatedAt: string
    customer: {
        id: number
        name: string
        mobile: string | null
        email: string | null
    } | null
    location: {
        id: number
        name: string
    }
    createdByUser: {
        id: number
        username: string
        firstName: string | null
        lastName: string | null
    }
    items: Array<{
        id: number
        quantity: number
        unitPrice: number
        lineTotal: number
        product: {
            name: string
            sku: string
        }
        productVariation: {
            name: string
            sku: string | null
        }
    }>
    payments: Array<{
        id: number
        amount: number
        paymentMethod: string
        paymentDate: string
    }>
    // Calculated fields
    totalItems: number
    totalQuantity: number
    totalPaid: number
    balance: number
    isFullyPaid: boolean
    isPartiallyPaid: boolean
    isUnpaid: boolean
    customerName: string
    locationName: string
    creatorName: string
}

export default function SalesOptimizedPage() {
    const { can } = usePermissions()
    const [loading, setLoading] = useState(true)
    const [gridInitialized, setGridInitialized] = useState(false)

    // Create custom store for server-side operations
    const dataSource = new CustomStore({
        key: 'id',
        load: async (loadOptions) => {
            try {
                setLoading(true)

                const params = new URLSearchParams()

                // Pagination
                if (loadOptions.skip) params.append('skip', loadOptions.skip.toString())
                if (loadOptions.take) params.append('take', loadOptions.take.toString())

                // Sorting
                if (loadOptions.sort && Array.isArray(loadOptions.sort) && loadOptions.sort.length > 0) {
                    const sort = loadOptions.sort[0] as any
                    params.append('sortBy', sort.selector || sort)
                    params.append('sortOrder', sort.desc ? 'desc' : 'asc')
                }

                // Filtering
                if (loadOptions.filter) {
                    const filters = loadOptions.filter
                    if (Array.isArray(filters)) {
                        filters.forEach(filter => {
                            if (filter[0] && filter[1] && filter[2] !== undefined) {
                                const [field, operator, value] = filter
                                if (field === 'search' && value) {
                                    params.append('search', value.toString())
                                } else if (field === 'status' && value) {
                                    params.append('status', value.toString())
                                } else if (field === 'customer.name' && value) {
                                    params.append('customerId', value.toString())
                                } else if (field === 'location.name' && value) {
                                    params.append('locationId', value.toString())
                                } else if (field === 'paymentStatus' && value) {
                                    params.append('paymentStatus', value.toString())
                                } else if (field === 'saleDate' && value) {
                                    if (operator === '>=') {
                                        params.append('startDate', value.toString())
                                    } else if (operator === '<=') {
                                        params.append('endDate', value.toString())
                                    }
                                }
                            }
                        })
                    }
                }

                const response = await fetch(`/api/sales/route-optimized?${params.toString()}`)

                if (!response.ok) {
                    throw new Error('Failed to fetch sales')
                }

                const data = await response.json()

                return {
                    data: data.data,
                    totalCount: data.totalCount
                }
            } catch (error) {
                console.error('Error loading sales:', error)
                toast.error('Failed to load sales')
                return { data: [], totalCount: 0 }
            } finally {
                setLoading(false)
            }
        }
    })

    const dataGridRef = useRef<any>(null)

    const handleRefresh = useCallback(() => {
        if (dataGridRef.current) {
            dataGridRef.current.instance.refresh()
        }
    }, [])

    const getStatusBadge = (status: string) => {
        const variants: Record<string, string> = {
            draft: 'bg-gray-100 text-gray-800',
            pending: 'bg-yellow-100 text-yellow-800',
            completed: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800',
            voided: 'bg-red-100 text-red-800'
        }
        return (
            <Badge className={variants[status] || 'bg-gray-100 text-gray-800'}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
        )
    }

    const getPaymentStatusBadge = (sale: Sale) => {
        if (sale.isFullyPaid) {
            return <Badge className="bg-green-100 text-green-800">Paid</Badge>
        } else if (sale.isPartiallyPaid) {
            return <Badge className="bg-yellow-100 text-yellow-800">Partial</Badge>
        } else {
            return <Badge className="bg-red-100 text-red-800">Unpaid</Badge>
        }
    }

    const MasterDetailTemplate = ({ data }: { data: Sale }) => (
        <div className="p-4 bg-gray-50 dark:bg-gray-800">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Sale Details</h4>

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                    <span className="font-medium">Invoice:</span> {data.invoiceNumber}
                </div>
                <div>
                    <span className="font-medium">Status:</span> {getStatusBadge(data.status)}
                </div>
                <div>
                    <span className="font-medium">Customer:</span> {data.customerName}
                </div>
                <div>
                    <span className="font-medium">Location:</span> {data.locationName}
                </div>
                <div>
                    <span className="font-medium">Sale Date:</span> {new Date(data.saleDate).toLocaleDateString()}
                </div>
                <div>
                    <span className="font-medium">Payment Status:</span> {getPaymentStatusBadge(data)}
                </div>
                <div>
                    <span className="font-medium">Created By:</span> {data.creatorName}
                </div>
                <div>
                    <span className="font-medium">Items:</span> {data.totalItems} items, {data.totalQuantity} qty
                </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                <div>
                    <span className="font-medium">Subtotal:</span> {formatCurrency(data.subtotal)}
                </div>
                <div>
                    <span className="font-medium">Tax:</span> {formatCurrency(data.taxAmount)}
                </div>
                <div>
                    <span className="font-medium">Discount:</span> {formatCurrency(data.discountAmount)}
                </div>
                <div>
                    <span className="font-medium">Total:</span> {formatCurrency(data.totalAmount)}
                </div>
            </div>

            {/* Payment Summary */}
            <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                <div>
                    <span className="font-medium">Paid:</span> {formatCurrency(data.totalPaid)}
                </div>
                <div>
                    <span className="font-medium">Balance:</span> {formatCurrency(data.balance)}
                </div>
                <div>
                    <span className="font-medium">Payments:</span> {data.payments.length} transactions
                </div>
            </div>

            {data.notes && (
                <div className="mt-2 text-sm">
                    <span className="font-medium">Notes:</span> {data.notes}
                </div>
            )}
        </div>
    )

    if (!can(PERMISSIONS.SELL_VIEW)) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Access Denied
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        You don't have permission to view sales.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Sales (Optimized)
                    </h1>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Server-side pagination, filtering, and sorting for optimal performance
                    </p>
                </div>

                <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-2">
                    {can(PERMISSIONS.SELL_CREATE) && (
                        <Link href="/dashboard/sales/pos">
                            <Button className="w-full sm:w-auto">
                                <PlusIcon className="h-4 w-4 mr-2" />
                                New Sale
                            </Button>
                        </Link>
                    )}

                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        className="w-full sm:w-auto"
                    >
                        <ArrowPathIcon className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Optimized DataGrid with Server-Side Operations */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Sales Grid (Server-Side Optimized)
                </h2>

                <DataGrid
                    ref={dataGridRef}
                    dataSource={dataSource}
                    showBorders={true}
                    columnAutoWidth={true}
                    rowAlternationEnabled={true}
                    height={700}
                    keyExpr="id"
                    onContentReady={() => {
                        if (!gridInitialized) {
                            setGridInitialized(true)
                            console.log('Optimized sales grid initialized and ready')
                        }
                    }}
                    wordWrapEnabled={false}
                    allowColumnReordering={true}
                    allowColumnResizing={true}
                >
                    <RemoteOperations
                        filtering={true}
                        sorting={true}
                        paging={true}
                        grouping={false}
                    />

                    <StateStoring enabled={true} type="localStorage" storageKey="salesOptimizedState" />
                    <LoadPanel enabled={true} />
                    <Scrolling mode="virtual" />
                    <Selection mode="multiple" showCheckBoxesMode="always" />
                    <Export enabled={true} formats={['xlsx', 'pdf']} allowExportSelectedData={true} />
                    <ColumnChooser enabled={true} mode="select" />
                    <ColumnFixing enabled={true} />
                    <SearchPanel visible={true} width={300} placeholder="Search sales..." />
                    <FilterRow visible={true} />
                    <HeaderFilter visible={true} />
                    <Paging defaultPageSize={50} />
                    <Grouping autoExpandAll={false} />
                    <GroupPanel visible={true} emptyPanelText="Drag column headers here to group by status, customer, or location" />
                    <Sorting mode="multiple" />

                    {/* Master-Detail for sale details */}
                    <MasterDetail enabled={true} component={MasterDetailTemplate} />

                    {/* Fixed Columns */}
                    <Column
                        dataField="invoiceNumber"
                        caption="Invoice #"
                        width={150}
                        fixed={true}
                        fixedPosition="left"
                        cellRender={(data) => (
                            <Link href={`/dashboard/sales/${data.data.id}`}>
                                <span className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline cursor-pointer">
                                    {data.text}
                                </span>
                            </Link>
                        )}
                    />
                    <Column
                        dataField="saleDate"
                        caption="Sale Date"
                        width={120}
                        dataType="date"
                        format="MMM dd, yyyy"
                        cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text}</span>}
                    />
                    <Column
                        dataField="customerName"
                        caption="Customer"
                        minWidth={150}
                        cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text}</span>}
                    />
                    <Column
                        dataField="locationName"
                        caption="Location"
                        width={120}
                        cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text}</span>}
                    />
                    <Column
                        dataField="status"
                        caption="Status"
                        width={120}
                        cellRender={(data) => getStatusBadge(data.text)}
                    />
                    <Column
                        dataField="totalAmount"
                        caption="Total Amount"
                        width={120}
                        dataType="number"
                        format="currency"
                        cellRender={(data) => <span className="font-mono text-gray-900 dark:text-gray-100">{formatCurrency(data.text)}</span>}
                    />
                    <Column
                        dataField="totalPaid"
                        caption="Paid"
                        width={100}
                        dataType="number"
                        format="currency"
                        cellRender={(data) => <span className="font-mono text-gray-900 dark:text-gray-100">{formatCurrency(data.text)}</span>}
                    />
                    <Column
                        dataField="balance"
                        caption="Balance"
                        width={100}
                        dataType="number"
                        format="currency"
                        cellRender={(data) => {
                            const balance = Number(data.text)
                            return (
                                <span className={`font-mono ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatCurrency(balance)}
                                </span>
                            )
                        }}
                    />
                    <Column
                        caption="Payment Status"
                        width={120}
                        cellRender={(data) => getPaymentStatusBadge(data.data)}
                    />
                    <Column
                        dataField="totalItems"
                        caption="Items"
                        width={80}
                        alignment="center"
                        cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text}</span>}
                    />
                    <Column
                        dataField="creatorName"
                        caption="Created By"
                        width={120}
                        cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text}</span>}
                    />
                    <Column
                        dataField="createdAt"
                        caption="Created"
                        width={120}
                        dataType="datetime"
                        format="MMM dd, yyyy"
                        cellRender={(data) => <span className="text-gray-600 dark:text-gray-400">{data.text}</span>}
                    />
                    <Column
                        caption="Actions"
                        width={150}
                        allowSorting={false}
                        allowFiltering={false}
                        cellRender={(data) => (
                            <div className="flex space-x-1">
                                <Link href={`/dashboard/sales/${data.data.id}`}>
                                    <Button size="sm" variant="outline">
                                        <EyeIcon className="h-3 w-3" />
                                    </Button>
                                </Link>
                                <Link href={`/dashboard/sales/${data.data.id}/edit`}>
                                    <Button size="sm" variant="outline">
                                        <PencilIcon className="h-3 w-3" />
                                    </Button>
                                </Link>
                                <Link href={`/dashboard/sales/${data.data.id}/reprint`}>
                                    <Button size="sm" variant="outline">
                                        <PrinterIcon className="h-3 w-3" />
                                    </Button>
                                </Link>
                            </div>
                        )}
                    />
                </DataGrid>
            </div>
        </div>
    )
}
