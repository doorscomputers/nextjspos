"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Download, Search, Package, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

interface InventoryItem {
  id: number;
  product: {
    id: number;
    name: string;
    sku: string;
    category: string | null;
    brand: string | null;
    enableStock: boolean;
    alertQuantity: number | null;
  };
  variation: {
    id: number;
    name: string;
    sku: string;
    subSku: string | null;
    purchasePrice: number;
    sellingPrice: number;
  };
  location: {
    id: number;
    name: string;
  };
  supplier: string | null;
  currentQuantity: number;
  historicalQuantity: number;
  historicalValue: number;
  unitCost: number;
  currency: string;
  lastUpdated: string;
}

interface ReportSummary {
  totalProducts: number;
  totalQuantity: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  currency: string;
}

interface ReportData {
  inventory: InventoryItem[];
  summary: ReportSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  reportInfo: {
    targetDate: string;
    generatedAt: string;
    generatedBy: string;
    filters: {
      locationId: string | null;
      categoryId: string | null;
      search: string | null;
    };
  };
}

export default function HistoricalInventoryPage() {
  const { data: session } = useSession();
  const { can } = usePermissions();

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [locations, setLocations] = useState<Array<{id: number, name: string}>>([]);

  // Check permissions
  const canViewReports = can('view_reports') || can('view_inventory_reports');

  useEffect(() => {
    if (!canViewReports) return;

    // Fetch locations for filter dropdown
    fetchLocations();

    // Generate report for today by default
    if (selectedDate) {
      generateReport();
    }
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations/all');
      if (response.ok) {
        const data = await response.json();
        setLocations(data.locations || []);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const generateReport = async (page = 1) => {
    if (!selectedDate) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        date: selectedDate,
        page: page.toString(),
        limit: '50'
      });

      if (selectedLocation) params.append('locationId', selectedLocation);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/reports/historical-inventory?${params}`);

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const data = await response.json();
      setReportData(data.data);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error generating report:', error);
      // TODO: Show error toast
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    generateReport(1);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (!reportData) return;

    const headers = [
      'Product Name', 'SKU', 'Variation', 'Category', 'Brand', 'Location',
      'Supplier', 'Historical Quantity', 'Unit Cost', 'Historical Value'
    ];

    const csvData = reportData.inventory.map(item => [
      item.product.name,
      item.product.sku,
      item.variation.name,
      item.product.category || '',
      item.product.brand || '',
      item.location.name,
      item.supplier || '',
      item.historicalQuantity.toString(),
      item.unitCost.toFixed(2),
      item.historicalValue.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historical-inventory-${selectedDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!canViewReports) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600">You don't have permission to view inventory reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Historical Inventory Report</h1>
          <p className="text-muted-foreground">
            View inventory levels as of a specific date
          </p>
        </div>
        {reportData && (
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="date">Target Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="search">Search Products</Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  placeholder="Name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} size="icon">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-end">
              <Button
                onClick={() => generateReport(1)}
                disabled={loading || !selectedDate}
                className="w-full"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {reportData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold">{reportData.summary.totalProducts.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Quantity</p>
                  <p className="text-2xl font-bold">{reportData.summary.totalQuantity.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold">
                    {reportData.summary.currency}{reportData.summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Low Stock</p>
                  <p className="text-2xl font-bold text-yellow-600">{reportData.summary.lowStockItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-600">{reportData.summary.outOfStockItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Info */}
      {reportData && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>
                <strong>Target Date:</strong> {format(new Date(reportData.reportInfo.targetDate), 'MMM dd, yyyy')}
              </span>
              <span>
                <strong>Generated:</strong> {format(new Date(reportData.reportInfo.generatedAt), 'MMM dd, yyyy HH:mm')}
              </span>
              <span>
                <strong>By:</strong> {reportData.reportInfo.generatedBy}
              </span>
              {reportData.reportInfo.filters.locationId && (
                <span>
                  <strong>Location:</strong> {locations.find(l => l.id.toString() === reportData.reportInfo.filters.locationId)?.name}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory Table */}
      {reportData && (
        <Card>
          <CardHeader>
            <CardTitle>Inventory Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Product</th>
                    <th className="text-left p-2">SKU</th>
                    <th className="text-left p-2">Variation</th>
                    <th className="text-left p-2">Category</th>
                    <th className="text-left p-2">Location</th>
                    <th className="text-right p-2">Historical Qty</th>
                    <th className="text-right p-2">Unit Cost</th>
                    <th className="text-right p-2">Historical Value</th>
                    <th className="text-center p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.inventory.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? 'bg-muted/50' : ''}>
                      <td className="p-2 font-medium">{item.product.name}</td>
                      <td className="p-2">{item.product.sku}</td>
                      <td className="p-2">{item.variation.name}</td>
                      <td className="p-2">{item.product.category || '-'}</td>
                      <td className="p-2">{item.location.name}</td>
                      <td className="p-2 text-right">{item.historicalQuantity.toLocaleString()}</td>
                      <td className="p-2 text-right">
                        {item.currency}{item.unitCost.toFixed(2)}
                      </td>
                      <td className="p-2 text-right font-medium">
                        {item.currency}{item.historicalValue.toFixed(2)}
                      </td>
                      <td className="p-2 text-center">
                        {item.product.enableStock ? (
                          item.historicalQuantity === 0 ? (
                            <Badge variant="destructive">Out of Stock</Badge>
                          ) : item.product.alertQuantity && item.historicalQuantity <= Number(item.product.alertQuantity) ? (
                            <Badge variant="secondary">Low Stock</Badge>
                          ) : (
                            <Badge variant="default">In Stock</Badge>
                          )
                        ) : (
                          <Badge variant="outline">No Stock Tracking</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {reportData.pagination.pages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateReport(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {reportData.pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateReport(currentPage + 1)}
                  disabled={currentPage === reportData.pagination.pages}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Generating historical inventory report...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}