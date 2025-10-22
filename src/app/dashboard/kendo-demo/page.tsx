'use client';

import { useState } from 'react';
import {
  Grid,
  GridColumn as Column,
} from '@progress/kendo-react-grid';
import { Button } from '@progress/kendo-react-buttons';
import { Input } from '@progress/kendo-react-inputs';
import { DatePicker } from '@progress/kendo-react-dateinputs';
import { DropDownList } from '@progress/kendo-react-dropdowns';
import { Dialog } from '@progress/kendo-react-dialogs';
import { orderBy, SortDescriptor } from '@progress/kendo-data-query';

// Sample data for the grid
const sampleProducts = [
  { id: 1, name: 'Laptop', category: 'Electronics', price: 999.99, stock: 25, lastUpdated: new Date('2025-01-15') },
  { id: 2, name: 'Mouse', category: 'Electronics', price: 29.99, stock: 150, lastUpdated: new Date('2025-01-18') },
  { id: 3, name: 'Keyboard', category: 'Electronics', price: 79.99, stock: 85, lastUpdated: new Date('2025-01-10') },
  { id: 4, name: 'Monitor', category: 'Electronics', price: 299.99, stock: 45, lastUpdated: new Date('2025-01-20') },
  { id: 5, name: 'Desk Chair', category: 'Furniture', price: 199.99, stock: 30, lastUpdated: new Date('2025-01-12') },
  { id: 6, name: 'Desk Lamp', category: 'Furniture', price: 49.99, stock: 60, lastUpdated: new Date('2025-01-16') },
  { id: 7, name: 'Notebook', category: 'Stationery', price: 4.99, stock: 500, lastUpdated: new Date('2025-01-19') },
  { id: 8, name: 'Pen', category: 'Stationery', price: 1.99, stock: 1000, lastUpdated: new Date('2025-01-17') },
];

const categories = ['Electronics', 'Furniture', 'Stationery', 'All'];

export default function KendoDemoPage() {
  const [data, setData] = useState(sampleProducts);
  const [sort, setSort] = useState<SortDescriptor[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');

  // Check license status
  useState(() => {
    fetch('/api/kendo-license')
      .then(res => res.json())
      .then(data => {
        if (data.license) {
          setLicenseStatus('valid');
        } else {
          setLicenseStatus('invalid');
        }
      })
      .catch(() => setLicenseStatus('invalid'));
  });

  // Filter data based on category and search
  const filteredData = data.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Sort data
  const sortedData = orderBy(filteredData, sort);

  const handleRefresh = () => {
    setDialogVisible(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Kendo UI for React - Integration Demo
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          This page demonstrates various Kendo UI components integrated into the UltimatePOS system.
        </p>

        {/* License Status */}
        <div className="mt-4 p-4 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-blue-900 dark:text-blue-100">License Status:</span>
            {licenseStatus === 'checking' && (
              <span className="text-blue-700 dark:text-blue-300">Checking...</span>
            )}
            {licenseStatus === 'valid' && (
              <span className="text-green-600 dark:text-green-400 font-medium">✓ Valid License Activated</span>
            )}
            {licenseStatus === 'invalid' && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                ⚠ No License Found - Create kendo-license.txt in project root
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Component Examples
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search Products (Kendo Input)
            </label>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.value || '')}
              placeholder="Search by name..."
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category (Kendo DropDownList)
            </label>
            <DropDownList
              data={categories}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.value)}
            />
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by Date (Kendo DatePicker)
            </label>
            <DatePicker
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.value)}
              placeholder="Select date..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button themeColor="primary" onClick={handleRefresh}>
            Refresh Data
          </Button>
          <Button onClick={() => setSearchTerm('')}>
            Clear Search
          </Button>
          <Button themeColor="info" onClick={() => setSort([])}>
            Clear Sort
          </Button>
        </div>
      </div>

      {/* Kendo Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Kendo React Grid (Sortable, Filterable)
        </h2>

        <Grid
          data={sortedData}
          sortable={true}
          sort={sort}
          onSortChange={(e) => setSort(e.sort)}
          style={{ height: '400px' }}
        >
          <Column field="id" title="ID" width="80px" />
          <Column field="name" title="Product Name" width="200px" />
          <Column field="category" title="Category" width="150px" />
          <Column
            field="price"
            title="Price"
            width="120px"
            format="{0:c2}"
          />
          <Column field="stock" title="Stock" width="100px" />
          <Column
            field="lastUpdated"
            title="Last Updated"
            width="150px"
            format="{0:d}"
          />
        </Grid>

        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {sortedData.length} of {data.length} products
        </div>
      </div>

      {/* Dialog */}
      {dialogVisible && (
        <Dialog
          title="Refresh Data"
          onClose={() => setDialogVisible(false)}
        >
          <div className="p-4">
            <p className="mb-4">
              This is a Kendo React Dialog component. Data has been refreshed successfully!
            </p>
            <div className="flex justify-end gap-2">
              <Button themeColor="primary" onClick={() => setDialogVisible(false)}>
                OK
              </Button>
              <Button onClick={() => setDialogVisible(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Integration Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Integration Details
        </h2>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <p><strong>Packages Installed:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>@progress/kendo-react-all - Complete Kendo UI suite</li>
            <li>@progress/kendo-theme-default - Default theme</li>
            <li>@progress/kendo-licensing - License management</li>
          </ul>

          <p className="mt-4"><strong>Components Demonstrated:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Grid - Data table with sorting</li>
            <li>Button - Action buttons</li>
            <li>Input - Text input field</li>
            <li>DropDownList - Category selector</li>
            <li>DatePicker - Date selection</li>
            <li>Dialog - Modal dialog</li>
          </ul>

          <p className="mt-4"><strong>License Setup:</strong></p>
          <ol className="list-decimal list-inside ml-4 space-y-1">
            <li>Create a file named <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">kendo-license.txt</code> in the project root</li>
            <li>Paste your Kendo UI license key into the file</li>
            <li>Restart the development server</li>
            <li>The license will be automatically loaded and validated</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
