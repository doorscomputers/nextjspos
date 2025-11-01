'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { PlusIcon, ArrowPathIcon, EyeIcon, PencilIcon, PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
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

interface Customer {
    id: number
    name: string
    email: string | null
    phoneNumber: string | null
    address: string | null
    city: string | null
    state: string | null
    postalCode: string | null
    country: string | null
    customerType: string
    isActive: boolean
    creditLimit: number | null
    notes: string | null
    createdAt: string
    updatedAt: string
    location: {
        id: number
        name: string
    } | null
    createdByUser: {
        id: number
        username: string
        firstName: string | null
        lastName: string | null
    }
    // Calculated fields
    totalSales: number
    salesCount: number
    totalPaid: number
    paymentsCount: number
    balance: number
    locationName: string
    creatorName: string
}

export default function CustomersOptimizedPage() {
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
                                } else if (field === 'isActive' && value !== undefined) {
                                    params.append('isActive', value.toString())
                                } else if (field === 'customerType' && value) {
                                    params.append('customerType', value.toString())
                                } else if (field === 'location.name' && value) {
                                    params.append('locationId', value.toString())
                                }
                            }
                        })
                    }
                }

                const response = await fetch(`/api/customers/route-optimized?${params.toString()}`)

                if (!response.ok) {
                    throw new Error('Failed to fetch customers')
                }

                const data = await response.json()

                return {
                    data: data.data,
                    totalCount: data.totalCount
                }
            } catch (error) {
                console.error('Error loading customers:', error)
                toast.error('Failed to load customers')
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

    const getCustomerTypeBadge = (type: string) => {
        const variants: Record<string, string> = {
            individual: 'bg-blue-100 text-blue-800',
            business: 'bg-green-100 text-green-800',
            wholesale: 'bg-purple-100 text-purple-800'
        }
        return (
            <Badge className={variants[type] || 'bg-gray-100 text-gray-800'}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
            </Badge>
        )
    }

    const getStatusBadge = (isActive: boolean) => {
        return (
            <Badge className={isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                {isActive ? 'Active' : 'Inactive'}
            </Badge>
        )
    }

    const MasterDetailTemplate = ({ data }: { data: Customer }) => (
        <div className="p-4 bg-gray-50 dark:bg-gray-800">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Customer Details</h4>

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                    <span className="font-medium">Name:</span> {data.name}
                </div>
                <div>
                    <span className="font-medium">Type:</span> {getCustomerTypeBadge(data.customerType)}
                </div>
                <div>
                    <span className="font-medium">Status:</span> {getStatusBadge(data.isActive)}
                </div>
                <div>
                    <span className="font-medium">Location:</span> {data.locationName}
                </div>
                <div>
                    <span className="font-medium">Email:</span> {data.email || 'N/A'}
                </div>
                <div>
                    <span className="font-medium">Phone:</span> {data.phoneNumber || 'N/A'}
                </div>
                <div>
                    <span className="font-medium">Credit Limit:</span> {data.creditLimit ? formatCurrency(data.creditLimit) : 'N/A'}
                </div>
                <div>
                    <span className="font-medium">Created By:</span> {data.creatorName}
                </div>
            </div>

            {/* Address */}
            {data.address && (
                <div className="text-sm mb-4">
                    <span className="font-medium">Address:</span> {data.address}
                    {data.city && `, ${data.city}`}
                    {data.state && `, ${data.state}`}
                    {data.postalCode && ` ${data.postalCode}`}
                    {data.country && `, ${data.country}`}
                </div>
            )}

            {/* Financial Summary */}
            <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                <div>
                    <span className="font-medium">Total Sales:</span> {formatCurrency(data.totalSales)}
                </div>
                <div>
                    <span className="font-medium">Sales Count:</span> {data.salesCount}
                </div>
                <div>
                    <span className="font-medium">Total Paid:</span> {formatCurrency(data.totalPaid)}
                </div>
                <div>
                    <span className="font-medium">Balance:</span> {formatCurrency(data.balance)}
                </div>
            </div>

            {data.notes && (
                <div className="mt-2 text-sm">
                    <span className="font-medium">Notes:</span> {data.notes}
                </div>
            )}
        </div>
    )

    if (!can(PERMISSIONS.CUSTOMER_VIEW)) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Access Denied
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        You don't have permission to view customers.
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
                        Customers (Optimized)
                    </h1>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Server-side pagination, filtering, and sorting for optimal performance
                    </p>
                </div>

                <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-2">
                    {can(PERMISSIONS.CUSTOMER_CREATE) && (
                        <Link href="/dashboard/customers/add">
                            <Button className="w-full sm:w-auto">
                                <PlusIcon className="h-4 w-4 mr-2" />
                                Add Customer
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
                    Customers Grid (Server-Side Optimized)
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
                            console.log('Optimized customers grid initialized and ready')
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

                    <StateStoring enabled={true} type="localStorage" storageKey="customersOptimizedState" />
                    <LoadPanel enabled={true} />
                    <Scrolling mode="virtual" />
                    <Selection mode="multiple" showCheckBoxesMode="always" />
                    <Export enabled={true} formats={['xlsx', 'pdf']} allowExportSelectedData={true} />
                    <ColumnChooser enabled={true} mode="select" />
                    <ColumnFixing enabled={true} />
                    <SearchPanel visible={true} width={300} placeholder="Search customers..." />
                    <FilterRow visible={true} />
                    <HeaderFilter visible={true} />
                    <Paging defaultPageSize={50} />
                    <Grouping autoExpandAll={false} />
                    <GroupPanel visible={true} emptyPanelText="Drag column headers here to group by type, status, or location" />
                    <Sorting mode="multiple" />

                    {/* Master-Detail for customer details */}
                    <MasterDetail enabled={true} component={MasterDetailTemplate} />

                    {/* Fixed Columns */}
                    <Column
                        dataField="name"
                        caption="Name"
                        width={200}
                        fixed={true}
                        fixedPosition="left"
                        cellRender={(data) => (
                            <Link href={`/dashboard/customers/${data.data.id}`}>
                                <span className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline cursor-pointer">
                                    {data.text}
                                </span>
                            </Link>
                        )}
                    />
                    <Column
                        dataField="email"
                        caption="Email"
                        width={200}
                        cellRender={(data) => (
                            <div className="flex items-center space-x-1">
                                <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-700 dark:text-gray-300">{data.text || 'N/A'}</span>
                            </div>
                        )}
                    />
                    <Column
                        dataField="phoneNumber"
                        caption="Phone"
                        width={150}
                        cellRender={(data) => (
                            <div className="flex items-center space-x-1">
                                <PhoneIcon className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-700 dark:text-gray-300">{data.text || 'N/A'}</span>
                            </div>
                        )}
                    />
                    <Column
                        dataField="customerType"
                        caption="Type"
                        width={120}
                        cellRender={(data) => getCustomerTypeBadge(data.text)}
                    />
                    <Column
                        dataField="isActive"
                        caption="Status"
                        width={100}
                        cellRender={(data) => getStatusBadge(data.text)}
                    />
                    <Column
                        dataField="locationName"
                        caption="Location"
                        width={120}
                        cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text}</span>}
                    />
                    <Column
                        dataField="totalSales"
                        caption="Total Sales"
                        width={120}
                        dataType="number"
                        format="currency"
                        cellRender={(data) => <span className="font-mono text-gray-900 dark:text-gray-100">{formatCurrency(data.text)}</span>}
                    />
                    <Column
                        dataField="salesCount"
                        caption="Sales"
                        width={80}
                        alignment="center"
                        cellRender={(data) => <span className="text-gray-700 dark:text-gray-300">{data.text}</span>}
                    />
                    <Column
                        dataField="balance"
                        caption="Balance"
                        width={120}
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
                        dataField="creditLimit"
                        caption="Credit Limit"
                        width={120}
                        dataType="number"
                        format="currency"
                        cellRender={(data) => <span className="font-mono text-gray-900 dark:text-gray-100">{data.text ? formatCurrency(data.text) : 'N/A'}</span>}
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
                        width={120}
                        allowSorting={false}
                        allowFiltering={false}
                        cellRender={(data) => (
                            <div className="flex space-x-1">
                                <Link href={`/dashboard/customers/${data.data.id}`}>
                                    <Button size="sm" variant="outline">
                                        <EyeIcon className="h-3 w-3" />
                                    </Button>
                                </Link>
                                <Link href={`/dashboard/customers/${data.data.id}/edit`}>
                                    <Button size="sm" variant="outline">
                                        <PencilIcon className="h-3 w-3" />
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
