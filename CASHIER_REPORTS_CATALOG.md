# Cashier & Management Reports Catalog

**Purpose**: Comprehensive reporting system for cashiers, managers, and company owners
**Access Control**: All reports filtered by user's location access (cashiers see their location, admins see all/selected locations)

---

## 📋 Report Categories

### 1. SALES REPORTS (For Cashiers & Management)

#### 1.1 Sales Today ✅ (Already Implemented)
**Description**: Real-time sales summary for current day
**Filters**: Date (today), Location, Cashier
**Includes**:
- Gross Sales
- Total Discounts
- Net Sales
- Transaction Count
- Payment Method Breakdown
- Cashier Performance

---

#### 1.2 Sales per Customer
**Description**: Sales breakdown by customer with transaction history
**Filters**: Date Range, Location, Cashier, Customer
**Includes**:
- Customer Name
- Total Purchases (Amount)
- Number of Transactions
- Average Transaction Value
- Last Purchase Date
- Payment Methods Used
- Outstanding Credit (if applicable)

**Use Case**: Identify top customers, analyze customer purchasing patterns, manage credit customers

---

#### 1.3 Sales per Item / Product
**Description**: Product sales performance and inventory movement
**Filters**: Date Range, Location, Cashier, Category, Product
**Includes**:
- Product Name & SKU
- Quantity Sold
- Total Revenue
- Average Selling Price
- Gross Profit (Revenue - Cost)
- Profit Margin %
- Number of Transactions
- Stock Remaining

**Use Case**: Identify best-sellers, slow-moving items, pricing analysis

---

#### 1.4 Item Quantity Sold Report
**Description**: Simple quantity-focused report for inventory planning
**Filters**: Date Range, Location, Category, Product
**Includes**:
- Product Name
- Total Quantity Sold
- Daily Average
- Peak Sales Day
- Stock Level Alert (if below reorder point)

**Use Case**: Restocking decisions, inventory planning

---

#### 1.5 Sales by Category
**Description**: Performance analysis by product category
**Filters**: Date Range, Location, Cashier
**Includes**:
- Category Name
- Total Sales Amount
- Quantity Sold
- % of Total Sales
- Number of Transactions
- Average Transaction Value

**Use Case**: Category performance, merchandising decisions

---

#### 1.6 Sales by Time Period (Hourly/Daily/Weekly/Monthly)
**Description**: Sales trends over time with peak hour analysis
**Filters**: Date Range, Location, Cashier, Time Grouping
**Includes**:
- Time Period
- Sales Amount
- Transaction Count
- Average Transaction Value
- Peak Hours/Days
- Comparison vs Previous Period

**Use Case**: Staffing optimization, promotional timing

---

### 2. PAYMENT & CASH REPORTS (For Cashiers & Management)

#### 2.1 Payment Method Summary
**Description**: Breakdown of all payment methods used
**Filters**: Date Range, Location, Cashier
**Includes**:
- Payment Method (Cash, Card, GCash, PayMaya, etc.)
- Number of Transactions
- Total Amount
- % of Total Sales
- Average Transaction Value

**Use Case**: Cash flow analysis, reconciliation

---

#### 2.2 Cash In / Cash Out Report
**Description**: All cash movements outside of sales
**Filters**: Date Range, Location, Cashier
**Includes**:
- Date & Time
- Type (Cash In / Cash Out)
- Amount
- Reason/Description
- Recorded By
- Running Balance

**Use Case**: Petty cash tracking, expense monitoring

---

#### 2.3 Cash Drawer Reconciliation
**Description**: Detailed cash counting and variance analysis
**Filters**: Date Range, Location, Cashier
**Includes**:
- Beginning Cash
- Total Cash Sales
- Cash In
- Cash Out
- Expected Cash
- Actual Cash (from denominations)
- Variance (Over/Short)
- Denomination Breakdown

**Use Case**: Cash accountability, theft detection

---

### 3. DISCOUNT & PROMOTION REPORTS (For Management)

#### 3.1 Discount Analysis Report
**Description**: Breakdown of all discounts given
**Filters**: Date Range, Location, Cashier, Discount Type
**Includes**:
- Discount Type (Senior, PWD, Regular, Promotional)
- Number of Transactions
- Total Discount Amount
- % of Sales
- Average Discount per Transaction
- Items Most Discounted

**Use Case**: BIR compliance, promotion effectiveness, fraud detection

---

#### 3.2 Senior Citizen & PWD Report (BIR Compliance)
**Description**: Detailed report for BIR tax exemption compliance
**Filters**: Date Range, Location
**Includes**:
- Transaction Date & Time
- OR/Invoice Number
- Customer Name & ID Number
- Items Purchased
- Gross Amount
- Discount Amount (20%)
- VAT Exempt Amount
- Net Amount
- Cashier Name

**Use Case**: BIR reporting, compliance audit

---

### 4. CUSTOMER & CREDIT REPORTS (For Cashiers & Management)

#### 4.1 Unpaid Charge Invoices
**Description**: Outstanding customer credit/receivables
**Filters**: Date Range, Location, Customer, Cashier
**Includes**:
- Invoice Number & Date
- Customer Name
- Total Amount
- Amount Paid
- Balance Due
- Days Overdue
- Payment Terms
- Status (Partially Paid / Unpaid)

**Use Case**: Collections, credit management

---

#### 4.2 Customer Payment History
**Description**: Payment tracking for credit customers
**Filters**: Date Range, Location, Customer
**Includes**:
- Payment Date
- Invoice Number
- Amount Paid
- Payment Method
- Balance After Payment
- Received By (Cashier)
- Receipt Number

**Use Case**: Customer account reconciliation

---

#### 4.3 Aging Receivables Report
**Description**: Credit accounts grouped by aging periods
**Filters**: Location, Customer
**Includes**:
- Customer Name
- Current (0-30 days)
- 31-60 days
- 61-90 days
- Over 90 days
- Total Outstanding
- Credit Limit

**Use Case**: Collections priority, credit risk management

---

### 5. CASHIER PERFORMANCE REPORTS (For Management)

#### 5.1 Cashier Sales Performance
**Description**: Individual cashier productivity and accuracy
**Filters**: Date Range, Location, Cashier
**Includes**:
- Cashier Name
- Number of Transactions
- Total Sales Amount
- Average Transaction Value
- Discounts Given
- Voids/Refunds
- Cash Variance (Over/Short)
- Hours Worked (if attendance tracked)
- Sales per Hour

**Use Case**: Performance evaluation, training needs

---

#### 5.2 Cashier Shift Summary
**Description**: Detailed shift-by-shift breakdown
**Filters**: Date Range, Location, Cashier
**Includes**:
- Shift Date & Time (Open - Close)
- Beginning Cash
- Total Sales
- Cash In/Out
- Expected vs Actual Cash
- Variance
- X Reading Count
- Number of Transactions

**Use Case**: Shift accountability, Z-reading verification

---

#### 5.3 Void & Refund Analysis
**Description**: All voided transactions and refunds by cashier
**Filters**: Date Range, Location, Cashier
**Includes**:
- Transaction Date & Time
- Original Invoice Number
- Items Voided/Refunded
- Amount
- Reason
- Approved By
- Cashier Name

**Use Case**: Fraud detection, training needs, policy compliance

---

### 6. INVENTORY & STOCK REPORTS (For Management)

#### 6.1 Stock Movement Report
**Description**: All inventory transactions (sales, purchases, transfers, adjustments)
**Filters**: Date Range, Location, Product
**Includes**:
- Date
- Transaction Type (Sale/Purchase/Transfer/Adjustment)
- Product Name
- Quantity In
- Quantity Out
- Balance
- Reference (Invoice/PO/Transfer Number)

**Use Case**: Inventory audit, discrepancy investigation

---

#### 6.2 Low Stock Alert Report
**Description**: Items below reorder point
**Filters**: Location, Category
**Includes**:
- Product Name & SKU
- Current Stock
- Reorder Point
- Days Until Stock Out (based on avg daily sales)
- Last Purchase Date
- Suggested Order Quantity

**Use Case**: Automated restocking, prevent stockouts

---

#### 6.3 Dead Stock / Slow-Moving Items
**Description**: Items with no sales in specified period
**Filters**: Days Without Sales, Location, Category
**Includes**:
- Product Name
- Current Stock
- Last Sale Date
- Days Since Last Sale
- Stock Value (Cost × Qty)
- Suggested Action (Discount/Return)

**Use Case**: Inventory optimization, markdown decisions

---

### 7. FINANCIAL REPORTS (For Company Owners)

#### 7.1 Daily Sales Summary (All Locations)
**Description**: Consolidated daily performance across all branches
**Filters**: Date, Location (Multi-select)
**Includes**:
- Location Name
- Gross Sales
- Discounts
- Net Sales
- Transaction Count
- Average Transaction Value
- Top-Selling Products
- Cash vs Digital Payments

**Use Case**: Multi-branch oversight, comparative analysis

---

#### 7.2 Profit & Loss Report
**Description**: Comprehensive P&L statement
**Filters**: Date Range, Location
**Includes**:
**Revenue**:
- Gross Sales
- Returns & Refunds
- Net Sales

**Cost of Goods Sold**:
- Opening Stock
- Purchases
- Closing Stock
- COGS

**Gross Profit**:
- Gross Profit Amount
- Gross Profit Margin %

**Operating Expenses**:
- Cash Out Expenses
- Other Expenses (if tracked)

**Net Profit**:
- Net Profit Amount
- Net Profit Margin %

**Use Case**: Financial analysis, business health monitoring

---

#### 7.3 Sales Comparison Report (Location vs Location)
**Description**: Side-by-side location performance comparison
**Filters**: Date Range, Locations (Multi-select)
**Includes**:
- Location Name
- Total Sales
- Transaction Count
- Average Transaction Value
- Top Products
- Cashier Count
- Sales per Cashier
- Growth vs Previous Period

**Use Case**: Branch performance benchmarking

---

#### 7.4 Product Profitability Report
**Description**: Profit analysis by product
**Filters**: Date Range, Location, Category
**Includes**:
- Product Name
- Quantity Sold
- Total Revenue
- Total Cost (COGS)
- Gross Profit
- Profit Margin %
- ROI (Return on Investment)

**Use Case**: Product mix optimization, pricing strategy

---

### 8. BIR COMPLIANCE REPORTS (For Owners & Accountants)

#### 8.1 BIR Daily Sales Summary ✅ (Already Implemented)
**Description**: Official daily sales report for BIR submission
**Filters**: Date, Location
**Includes**:
- Gross Sales
- VAT-Exempt Sales (Senior/PWD)
- VATable Sales
- VAT Amount (12%)
- Zero-Rated Sales
- Total Sales

**Use Case**: BIR compliance, quarterly tax filing

---

#### 8.2 VAT Report (Sales & Purchases)
**Description**: VAT input and output summary
**Filters**: Date Range, Location
**Includes**:
**Output VAT (Sales)**:
- VATable Sales
- VAT Amount

**Input VAT (Purchases)**:
- VATable Purchases
- VAT Amount

**Net VAT Payable/Claimable**

**Use Case**: VAT return filing

---

#### 8.3 Withholding Tax Report
**Description**: Taxes withheld from suppliers (if applicable)
**Filters**: Date Range, Supplier
**Includes**:
- Supplier Name & TIN
- Invoice Amount
- Tax Rate
- Tax Amount Withheld
- Net Payment

**Use Case**: BIR Form 2307 preparation

---

### 9. ADDITIONAL MANAGEMENT REPORTS

#### 9.1 Top Customers Report
**Description**: Highest-value customers ranking
**Filters**: Date Range, Location
**Includes**:
- Customer Name
- Total Purchases
- Number of Transactions
- Average Purchase Value
- Last Purchase Date
- Loyalty Tier (if applicable)

**Use Case**: Loyalty programs, VIP customer management

---

#### 9.2 Product Return Analysis
**Description**: Customer return patterns
**Filters**: Date Range, Location, Product
**Includes**:
- Product Name
- Quantity Returned
- Return Reason
- Return Rate (% of sales)
- Refund Amount
- Customer Names

**Use Case**: Quality control, supplier issues

---

#### 9.3 Peak Hours Analysis
**Description**: Busiest times for staffing optimization
**Filters**: Date Range, Location, Day of Week
**Includes**:
- Hour of Day
- Number of Transactions
- Sales Amount
- Average Wait Time (if tracked)
- Cashiers on Duty

**Use Case**: Staff scheduling, efficiency optimization

---

#### 9.4 Inventory Turnover Report
**Description**: How fast inventory sells
**Filters**: Date Range, Location, Category
**Includes**:
- Product Name
- Average Inventory
- COGS
- Inventory Turnover Ratio
- Days in Inventory
- Stock Health (Fast/Slow/Dead)

**Use Case**: Working capital management, purchasing optimization

---

#### 9.5 Expense Tracking Report
**Description**: All business expenses from Cash Out records
**Filters**: Date Range, Location, Expense Category
**Includes**:
- Date
- Expense Category (Utilities, Supplies, Maintenance, etc.)
- Description
- Amount
- Paid By
- Receipt/Reference Number

**Use Case**: Budget management, cost control

---

## 📱 Report Access Matrix (RBAC)

| Report Category | Cashier | Manager | Admin | Owner |
|----------------|---------|---------|-------|-------|
| Sales Reports | Own Location/Shift | All Cashiers in Location | All Locations | All Locations |
| Payment Reports | Own Shift | All Cashiers in Location | All Locations | All Locations |
| Discount Reports | Own Shift | All Cashiers in Location | All Locations | All Locations |
| Customer/Credit | Limited (Search only) | All in Location | All Locations | All Locations |
| Cashier Performance | Own Only | All in Location | All Locations | All Locations |
| Inventory Reports | View Only | View + Export | All Locations | All Locations |
| Financial Reports | ❌ No Access | Summary Only | All Locations | All Locations |
| BIR Reports | ❌ No Access | View Only | All Locations | All Locations |

---

## 🎯 Implementation Priority

### Phase 1 (Immediate - For Cashiers)
1. ✅ Sales Today (Already exists)
2. Sales per Customer
3. Sales per Item / Product
4. Payment Method Summary
5. Unpaid Charge Invoices
6. Customer Payment History

### Phase 2 (For Managers)
7. Cashier Sales Performance
8. Cashier Shift Summary
9. Void & Refund Analysis
10. Discount Analysis Report
11. Cash In / Cash Out Report
12. Cash Drawer Reconciliation

### Phase 3 (For Owners)
13. Daily Sales Summary (All Locations)
14. Sales Comparison Report
15. Profit & Loss Report
16. Product Profitability Report
17. Top Customers Report

### Phase 4 (Advanced Analytics)
18. Peak Hours Analysis
19. Inventory Turnover Report
20. Stock Movement Report
21. Low Stock Alert Report
22. Dead Stock Report

### Phase 5 (Compliance & Audit)
23. ✅ BIR Daily Sales Summary (Already exists)
24. Senior Citizen & PWD Report
25. VAT Report
26. Aging Receivables Report

---

## 🔧 Technical Implementation Notes

### Report Features (All Reports Should Have):
- ✅ **Date Range Filter** (Default: Today, This Week, This Month, Custom)
- ✅ **Location Filter** (Based on user access)
- ✅ **Cashier Filter** (For managers/admins)
- ✅ **Export to PDF** (Printable format)
- ✅ **Export to Excel** (For further analysis)
- ✅ **Real-time Data** (No caching for critical reports)
- ✅ **Responsive Design** (Mobile-friendly)
- ✅ **Print-Friendly Layout** (No URL bars, clean headers)

### Database Query Optimization:
- Use indexed fields (date, locationId, businessId)
- Implement pagination for large datasets
- Cache non-real-time reports (daily summaries)
- Use materialized views for complex aggregations

### Performance Targets:
- Report load time < 3 seconds
- Export generation < 10 seconds
- Support up to 10,000 transactions per report

---

**Last Updated**: 2025-10-25
**Status**: Specification Document
**Next Step**: Begin Phase 1 implementation
