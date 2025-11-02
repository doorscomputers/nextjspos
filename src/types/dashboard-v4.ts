// Type definitions for Dashboard V4

export interface DashboardV4Data {
  receivables: ReceivablesData
  payables: PayablesData
  inventory: InventoryData
  salesByLocation: SalesByLocationData[]
  locationNames: string[]
  incomeExpenses: IncomeExpensesData[]
  topProducts: TopProductsData
  dateRange: {
    start: string
    end: string
  }
}

export interface ReceivablesData {
  paid: number
  unpaid: number
  total: number
  aging: AgingBreakdown
}

export interface PayablesData {
  paid: number
  unpaid: number
  total: number
  aging: AgingBreakdown
}

export interface AgingBreakdown {
  '0-30': number
  '31-60': number
  '61-90': number
  '90+': number
}

export interface InventoryData {
  sold: number
  available: number
  total: number
  aging: InventoryAgingBreakdown
}

export interface InventoryAgingBreakdown {
  '0-3': number
  '4-5': number
  '7-9': number
  '9+': number
}

export interface SalesByLocationData {
  month: string
  total: number
  [locationName: string]: string | number // Dynamic location names
}

export interface IncomeExpensesData {
  month: string
  grossIncome: number
  expenses: number
  netIncome: number
}

export interface TopProductsData {
  byQuantity: TopSellingProduct[]
  byProfit: TopGrossingProduct[]
  lowestProfit: LowestGrossingProduct[]
}

export interface TopSellingProduct {
  rank: number
  productName: string
  sku: string
  quantity: number
  avgPrice: number
  totalSales: number
}

export interface TopGrossingProduct {
  rank: number
  productName: string
  sku: string
  quantity: number
  margin: number
  profit: number
}

export interface LowestGrossingProduct {
  rank: number
  productName: string
  sku: string
  quantity: number
  margin: number
  profit: number
}

// Chart data types for DevExtreme
export interface PieChartDataPoint {
  name: string
  value: number
}

export interface BarChartDataPoint {
  argument: string
  [key: string]: string | number
}
