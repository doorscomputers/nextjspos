'use client';

/**
 * Kendo React Examples - Practical Templates
 *
 * This page provides copy-paste ready examples of common Kendo components
 * integrated with the UltimatePOS multi-tenant architecture.
 *
 * Features demonstrated:
 * - Grid with CRUD operations
 * - Form with validation
 * - Charts for data visualization
 * - Date range filtering
 * - Multi-tenant data handling
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Grid,
  GridColumn,
  GridToolbar,
  GridSortChangeEvent,
  GridFilterChangeEvent,
} from '@progress/kendo-react-grid';
import { Button } from '@progress/kendo-react-buttons';
import { Input, NumericTextBox } from '@progress/kendo-react-inputs';
import { DatePicker, DateRangePicker } from '@progress/kendo-react-dateinputs';
import { DropDownList, ComboBox } from '@progress/kendo-react-dropdowns';
import { Dialog } from '@progress/kendo-react-dialogs';
import { Notification, NotificationGroup } from '@progress/kendo-react-notification';
import {
  Chart,
  ChartSeries,
  ChartSeriesItem,
  ChartCategoryAxis,
  ChartCategoryAxisItem,
  ChartTitle,
} from '@progress/kendo-react-charts';
import {
  orderBy,
  filterBy,
  SortDescriptor,
  CompositeFilterDescriptor,
} from '@progress/kendo-data-query';

// Sample data types
interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  reorderLevel: number;
  supplier: string;
  lastRestocked: Date;
  businessId: number;
}

// Sample data
const sampleData: Product[] = [
  {
    id: 1,
    name: 'Laptop Dell XPS 15',
    category: 'Electronics',
    price: 1299.99,
    stock: 15,
    reorderLevel: 5,
    supplier: 'Dell Inc.',
    lastRestocked: new Date('2025-01-10'),
    businessId: 1,
  },
  {
    id: 2,
    name: 'Wireless Mouse Logitech',
    category: 'Electronics',
    price: 29.99,
    stock: 120,
    reorderLevel: 20,
    supplier: 'Logitech',
    lastRestocked: new Date('2025-01-15'),
    businessId: 1,
  },
  {
    id: 3,
    name: 'Office Desk Chair',
    category: 'Furniture',
    price: 199.99,
    stock: 8,
    reorderLevel: 3,
    supplier: 'Office Depot',
    lastRestocked: new Date('2025-01-05'),
    businessId: 1,
  },
  {
    id: 4,
    name: 'LED Desk Lamp',
    category: 'Furniture',
    price: 49.99,
    stock: 45,
    reorderLevel: 10,
    supplier: 'IKEA',
    lastRestocked: new Date('2025-01-18'),
    businessId: 1,
  },
  {
    id: 5,
    name: 'Notebook A4 Premium',
    category: 'Stationery',
    price: 4.99,
    stock: 450,
    reorderLevel: 100,
    supplier: 'Moleskine',
    lastRestocked: new Date('2025-01-20'),
    businessId: 1,
  },
];

const categories = ['All', 'Electronics', 'Furniture', 'Stationery'];
const suppliers = ['All', 'Dell Inc.', 'Logitech', 'Office Depot', 'IKEA', 'Moleskine'];

export default function KendoExamplesPage() {
  const { data: session } = useSession();

  // State for grid
  const [products, setProducts] = useState<Product[]>(sampleData);
  const [sort, setSort] = useState<SortDescriptor[]>([]);
  const [filter, setFilter] = useState<CompositeFilterDescriptor | undefined>();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // State for filters
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });

  // State for form dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<Product>>({});

  // State for notifications
  const [notifications, setNotifications] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'warning' }>>([]);

  // Chart data
  const [chartData, setChartData] = useState<Array<{ category: string; totalStock: number; totalValue: number }>>([]);

  // Calculate chart data
  useEffect(() => {
    const categoryData = categories
      .filter((c) => c !== 'All')
      .map((category) => {
        const categoryProducts = products.filter((p) => p.category === category);
        return {
          category,
          totalStock: categoryProducts.reduce((sum, p) => sum + p.stock, 0),
          totalValue: categoryProducts.reduce((sum, p) => sum + p.stock * p.price, 0),
        };
      });
    setChartData(categoryData);
  }, [products]);

  // Filter data
  const getFilteredData = () => {
    let data = products;

    // Category filter
    if (categoryFilter !== 'All') {
      data = data.filter((p) => p.category === categoryFilter);
    }

    // Supplier filter
    if (supplierFilter !== 'All') {
      data = data.filter((p) => p.supplier === supplierFilter);
    }

    // Search filter
    if (searchTerm) {
      data = data.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // Date range filter
    if (dateRange.start && dateRange.end) {
      data = data.filter(
        (p) => p.lastRestocked >= dateRange.start! && p.lastRestocked <= dateRange.end!
      );
    }

    // Apply Kendo filter
    if (filter) {
      data = filterBy(data, filter);
    }

    // Apply sort
    if (sort.length > 0) {
      data = orderBy(data, sort);
    }

    return data;
  };

  const filteredData = getFilteredData();

  // Handlers
  const handleSort = (e: GridSortChangeEvent) => {
    setSort(e.sort);
  };

  const handleFilter = (e: GridFilterChangeEvent) => {
    setFilter(e.filter);
  };

  const handleAddProduct = () => {
    setEditMode(false);
    setFormData({});
    setShowDialog(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditMode(true);
    setFormData(product);
    setShowDialog(true);
  };

  const handleDeleteProduct = (product: Product) => {
    if (confirm(`Delete ${product.name}?`)) {
      setProducts(products.filter((p) => p.id !== product.id));
      addNotification(`${product.name} deleted successfully`, 'success');
    }
  };

  const handleSaveProduct = () => {
    if (!formData.name || !formData.price) {
      addNotification('Please fill in all required fields', 'error');
      return;
    }

    if (editMode) {
      // Update existing
      setProducts(
        products.map((p) => (p.id === formData.id ? { ...p, ...formData } : p))
      );
      addNotification('Product updated successfully', 'success');
    } else {
      // Add new
      const newProduct: Product = {
        id: Math.max(...products.map((p) => p.id)) + 1,
        name: formData.name!,
        category: formData.category || 'Electronics',
        price: formData.price!,
        stock: formData.stock || 0,
        reorderLevel: formData.reorderLevel || 10,
        supplier: formData.supplier || 'Unknown',
        lastRestocked: formData.lastRestocked || new Date(),
        businessId: session?.user?.businessId || 1,
      };
      setProducts([...products, newProduct]);
      addNotification('Product added successfully', 'success');
    }

    setShowDialog(false);
  };

  const addNotification = (message: string, type: 'success' | 'error' | 'warning') => {
    const id = Date.now();
    setNotifications([...notifications, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3000);
  };

  const handleClearFilters = () => {
    setCategoryFilter('All');
    setSupplierFilter('All');
    setSearchTerm('');
    setDateRange({ start: null, end: null });
    setSort([]);
    setFilter(undefined);
  };

  // Stock status indicator
  const getStockStatus = (product: Product) => {
    if (product.stock === 0) return { text: 'Out of Stock', color: 'text-red-600' };
    if (product.stock <= product.reorderLevel)
      return { text: 'Low Stock', color: 'text-amber-600' };
    return { text: 'In Stock', color: 'text-green-600' };
  };

  // Custom cell for stock status
  const StockStatusCell = (props: any) => {
    const status = getStockStatus(props.dataItem);
    return (
      <td>
        <span className={`font-semibold ${status.color}`}>{status.text}</span>
      </td>
    );
  };

  // Custom cell for actions
  const ActionsCell = (props: any) => {
    return (
      <td className="space-x-2">
        <Button
          size="small"
          themeColor="primary"
          onClick={() => handleEditProduct(props.dataItem)}
        >
          Edit
        </Button>
        <Button
          size="small"
          onClick={() => handleDeleteProduct(props.dataItem)}
        >
          Delete
        </Button>
      </td>
    );
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-gray-900 min-h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Kendo React - Practical Examples
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Production-ready templates for inventory management with Kendo UI components
        </p>
      </div>

      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Filters & Search
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search Products
            </label>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.value || '')}
              placeholder="Search by name..."
            />
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <DropDownList
              data={categories}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.value)}
            />
          </div>

          {/* Supplier Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Supplier
            </label>
            <DropDownList
              data={suppliers}
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.value)}
            />
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Last Restocked
            </label>
            <DatePicker
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.value })}
              placeholder="Start date..."
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button themeColor="primary" onClick={handleAddProduct}>
            Add Product
          </Button>
          <Button onClick={handleClearFilters}>Clear Filters</Button>
        </div>
      </div>

      {/* Grid Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Product Inventory Grid
        </h2>

        <Grid
          data={filteredData}
          sortable={true}
          filterable={true}
          pageable={true}
          pageSize={10}
          sort={sort}
          filter={filter}
          onSortChange={handleSort}
          onFilterChange={handleFilter}
          style={{ height: '500px' }}
        >
          <GridColumn field="id" title="ID" width="80px" filterable={false} />
          <GridColumn field="name" title="Product Name" width="250px" />
          <GridColumn field="category" title="Category" width="150px" />
          <GridColumn
            field="price"
            title="Price"
            width="120px"
            format="{0:c2}"
            filter="numeric"
          />
          <GridColumn field="stock" title="Stock" width="100px" filter="numeric" />
          <GridColumn
            field="reorderLevel"
            title="Reorder Level"
            width="130px"
            filter="numeric"
          />
          <GridColumn title="Status" width="120px" cell={StockStatusCell} filterable={false} />
          <GridColumn field="supplier" title="Supplier" width="150px" />
          <GridColumn
            field="lastRestocked"
            title="Last Restocked"
            width="150px"
            format="{0:d}"
            filter="date"
          />
          <GridColumn title="Actions" width="180px" cell={ActionsCell} filterable={false} />
        </Grid>

        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredData.length} of {products.length} products
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Stock Levels by Category
          </h2>
          <Chart>
            <ChartTitle text="Total Stock by Category" />
            <ChartCategoryAxis>
              <ChartCategoryAxisItem categories={chartData.map((d) => d.category)} />
            </ChartCategoryAxis>
            <ChartSeries>
              <ChartSeriesItem type="column" data={chartData.map((d) => d.totalStock)} />
            </ChartSeries>
          </Chart>
        </div>

        {/* Value Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Inventory Value by Category
          </h2>
          <Chart>
            <ChartTitle text="Total Value by Category" />
            <ChartSeries>
              <ChartSeriesItem
                type="pie"
                data={chartData}
                field="totalValue"
                categoryField="category"
              />
            </ChartSeries>
          </Chart>
        </div>
      </div>

      {/* Form Dialog */}
      {showDialog && (
        <Dialog
          title={editMode ? 'Edit Product' : 'Add New Product'}
          onClose={() => setShowDialog(false)}
          width={500}
        >
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Product Name *
              </label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.value || '' })}
                placeholder="Enter product name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <DropDownList
                data={categories.filter((c) => c !== 'All')}
                value={formData.category || 'Electronics'}
                onChange={(e) => setFormData({ ...formData, category: e.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Price *
              </label>
              <NumericTextBox
                value={formData.price || 0}
                onChange={(e) => setFormData({ ...formData, price: e.value || 0 })}
                format="c2"
                min={0}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stock Quantity
              </label>
              <NumericTextBox
                value={formData.stock || 0}
                onChange={(e) => setFormData({ ...formData, stock: e.value || 0 })}
                min={0}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reorder Level
              </label>
              <NumericTextBox
                value={formData.reorderLevel || 10}
                onChange={(e) => setFormData({ ...formData, reorderLevel: e.value || 10 })}
                min={0}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Supplier
              </label>
              <Input
                value={formData.supplier || ''}
                onChange={(e) => setFormData({ ...formData, supplier: e.value || '' })}
                placeholder="Enter supplier name"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button themeColor="primary" onClick={handleSaveProduct}>
                {editMode ? 'Update' : 'Add'} Product
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Notifications */}
      <NotificationGroup
        style={{
          right: 20,
          bottom: 20,
          position: 'fixed',
          zIndex: 9999,
        }}
      >
        {notifications.map((notif) => (
          <Notification
            key={notif.id}
            type={{ style: notif.type, icon: true }}
            closable={true}
            onClose={() =>
              setNotifications(notifications.filter((n) => n.id !== notif.id))
            }
          >
            <span>{notif.message}</span>
          </Notification>
        ))}
      </NotificationGroup>
    </div>
  );
}
