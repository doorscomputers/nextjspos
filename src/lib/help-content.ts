/**
 * Help Tutorial Content
 * Comprehensive tutorials organized by category and role
 */

import { PERMISSIONS } from './rbac'

export interface TutorialStep {
  stepNumber: number
  title: string
  description: string
  imagePlaceholder?: string
  codeSnippet?: string
  notes?: string[]
  warnings?: string[]
  tips?: string[]
}

export interface Tutorial {
  id: string
  title: string
  description: string
  category: string
  subcategory?: string
  requiredPermissions?: string[]
  requiredRoles?: string[]
  estimatedTime?: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  steps: TutorialStep[]
  relatedTutorials?: string[]
  videoUrl?: string
}

export interface TutorialCategory {
  id: string
  name: string
  icon: string
  description: string
  subcategories?: {
    id: string
    name: string
    description: string
  }[]
}

// Tutorial Categories
export const TUTORIAL_CATEGORIES: TutorialCategory[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    icon: 'rocket',
    description: 'Introduction to the system, navigation, and basic concepts',
  },
  {
    id: 'products',
    name: 'Product Management',
    icon: 'box',
    description: 'Managing products, categories, brands, units, and pricing',
    subcategories: [
      { id: 'products-basic', name: 'Basic Operations', description: 'Create, edit, and manage products' },
      { id: 'products-advanced', name: 'Advanced Features', description: 'Variants, serial numbers, and bulk operations' },
      { id: 'products-pricing', name: 'Pricing Management', description: 'Multi-location pricing and price strategies' },
    ],
  },
  {
    id: 'inventory',
    name: 'Inventory Management',
    icon: 'warehouse',
    description: 'Stock tracking, adjustments, and physical inventory',
    subcategories: [
      { id: 'inventory-tracking', name: 'Stock Tracking', description: 'Monitor and track inventory levels' },
      { id: 'inventory-adjustments', name: 'Adjustments', description: 'Corrections and physical counts' },
      { id: 'inventory-transfers', name: 'Stock Transfers', description: 'Transfer between locations' },
    ],
  },
  {
    id: 'sales',
    name: 'Sales Operations',
    icon: 'shopping-cart',
    description: 'Point of Sale, invoicing, and sales management',
    subcategories: [
      { id: 'sales-pos', name: 'POS Operations', description: 'Processing sales transactions' },
      { id: 'sales-returns', name: 'Returns & Refunds', description: 'Handle customer returns' },
      { id: 'sales-payments', name: 'Payment Processing', description: 'Multiple payment methods' },
    ],
  },
  {
    id: 'purchases',
    name: 'Purchase Management',
    icon: 'shopping-bag',
    description: 'Purchase orders, receiving, and supplier management',
    subcategories: [
      { id: 'purchases-orders', name: 'Purchase Orders', description: 'Create and manage POs' },
      { id: 'purchases-receiving', name: 'Receiving', description: 'Goods Receipt Notes (GRN)' },
      { id: 'purchases-suppliers', name: 'Suppliers', description: 'Supplier management' },
    ],
  },
  {
    id: 'reports',
    name: 'Reports & Analytics',
    icon: 'chart-bar',
    description: 'Business intelligence, reports, and analytics',
    subcategories: [
      { id: 'reports-sales', name: 'Sales Reports', description: 'Sales analytics and trends' },
      { id: 'reports-inventory', name: 'Inventory Reports', description: 'Stock reports and alerts' },
      { id: 'reports-financial', name: 'Financial Reports', description: 'Profit/loss and financial analysis' },
    ],
  },
  {
    id: 'users-rbac',
    name: 'Users & Permissions',
    icon: 'users',
    description: 'User management, roles, and access control',
  },
  {
    id: 'settings',
    name: 'Settings & Configuration',
    icon: 'settings',
    description: 'Business settings, locations, and system configuration',
  },
  {
    id: 'advanced',
    name: 'Advanced Features',
    icon: 'star',
    description: 'Multi-location, AI assistant, and advanced workflows',
  },
  {
    id: 'troubleshooting',
    name: 'Troubleshooting & FAQ',
    icon: 'help-circle',
    description: 'Common issues, solutions, and frequently asked questions',
  },
]

// All Tutorials
export const TUTORIALS: Tutorial[] = [
  // ==================== GETTING STARTED ====================
  {
    id: 'system-overview',
    title: 'System Overview and Navigation',
    description: 'Learn the basics of navigating the Igoro Tech(IT) Inventory Management System',
    category: 'getting-started',
    difficulty: 'beginner',
    estimatedTime: '10 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'Understanding the Dashboard Layout',
        description: 'The dashboard is your command center. It provides quick access to all major features and real-time business metrics.',
        imagePlaceholder: 'dashboard-overview.png',
        notes: [
          'The top navigation bar contains your profile, notifications, and quick actions',
          'The left sidebar provides access to all system modules based on your permissions',
          'The main content area displays relevant information and forms',
        ],
        tips: [
          'Use keyboard shortcut Ctrl+K (Cmd+K on Mac) to quickly search for features',
          'Click on your profile icon to access settings and logout',
        ],
      },
      {
        stepNumber: 2,
        title: 'Navigating the Sidebar Menu',
        description: 'The sidebar menu is dynamically generated based on your role and permissions. You will only see menu items you have access to.',
        imagePlaceholder: 'sidebar-navigation.png',
        notes: [
          'Menu items are grouped by category (Products, Sales, Inventory, etc.)',
          'Expandable menus show sub-items when clicked',
          'Active menu items are highlighted',
          'On mobile devices, the sidebar can be toggled using the hamburger icon',
        ],
      },
      {
        stepNumber: 3,
        title: 'Understanding Dashboard Widgets',
        description: 'Dashboard widgets provide real-time insights into your business operations.',
        imagePlaceholder: 'dashboard-widgets.png',
        notes: [
          'Sales Today: Shows current day sales performance',
          'Low Stock Alerts: Products below reorder level',
          'Recent Transactions: Latest sales and purchases',
          'Top Selling Products: Best performers by revenue or quantity',
        ],
        tips: [
          'Click on any widget to view detailed reports',
          'Widgets refresh automatically every 5 minutes',
        ],
      },
      {
        stepNumber: 4,
        title: 'Using the Search Functionality',
        description: 'Quickly find products, customers, transactions, and features using the global search.',
        imagePlaceholder: 'global-search.png',
        notes: [
          'Press Ctrl+K (Cmd+K on Mac) to open quick search',
          'Type keywords to search across products, customers, and invoices',
          'Use filters to narrow down search results',
        ],
      },
      {
        stepNumber: 5,
        title: 'Customizing Your Profile',
        description: 'Update your personal information and preferences.',
        imagePlaceholder: 'profile-settings.png',
        steps: [
          {
            stepNumber: 1,
            title: '',
            description: 'Click on your profile icon in the top-right corner',
          },
          {
            stepNumber: 2,
            title: '',
            description: 'Select "Profile Settings"',
          },
          {
            stepNumber: 3,
            title: '',
            description: 'Update your name, email, password, or preferences',
          },
          {
            stepNumber: 4,
            title: '',
            description: 'Click "Save Changes" to apply',
          },
        ] as any,
      },
    ],
    relatedTutorials: ['user-roles-overview', 'keyboard-shortcuts'],
  },
  {
    id: 'user-roles-overview',
    title: 'Understanding User Roles',
    description: 'Learn about different user roles and their capabilities in the system',
    category: 'getting-started',
    difficulty: 'beginner',
    estimatedTime: '8 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'Role-Based Access Control (RBAC)',
        description: 'The system uses a sophisticated permission system where users are assigned roles, and each role has specific permissions.',
        notes: [
          'Users can have multiple roles',
          'Users can also have direct permissions in addition to role-based permissions',
          'Super Admin has all permissions by default',
        ],
      },
      {
        stepNumber: 2,
        title: 'Super Admin Role',
        description: 'The Super Admin is the platform owner with unrestricted access to all features and settings.',
        notes: [
          'Can manage all businesses (multi-tenant)',
          'Can create and configure businesses',
          'Has access to system-wide settings',
          'Can manage all users across all businesses',
        ],
        warnings: [
          'This role should be restricted to system administrators only',
        ],
      },
      {
        stepNumber: 3,
        title: 'Admin Role',
        description: 'Business administrators with full access to their business operations.',
        notes: [
          'Can manage all business settings',
          'Can create and manage users within their business',
          'Can configure roles and permissions',
          'Has access to all reports and analytics',
          'Can manage all products, sales, purchases, and inventory',
        ],
      },
      {
        stepNumber: 4,
        title: 'Manager Role',
        description: 'Operations managers with access to most features except sensitive settings.',
        notes: [
          'Can manage products and inventory',
          'Can process purchases and sales',
          'Can view most reports',
          'Cannot modify business settings or manage users',
          'Can approve transfers and corrections',
        ],
      },
      {
        stepNumber: 5,
        title: 'Cashier Role',
        description: 'Front-line staff focused on sales transactions.',
        notes: [
          'Can process sales transactions (POS)',
          'Can open and close shifts',
          'Can manage cash drawer',
          'Can view products and stock',
          'Limited access to reports (usually own sales only)',
        ],
      },
      {
        stepNumber: 6,
        title: 'Custom Roles',
        description: 'Businesses can create custom roles tailored to their specific needs.',
        notes: [
          'Combine permissions from different areas',
          'Examples: Warehouse Manager, Purchase Officer, Sales Representative',
          'Can be as restrictive or permissive as needed',
        ],
        tips: [
          'Start with a default role and modify permissions as needed',
          'Test new roles with a test user before assigning to staff',
        ],
      },
    ],
    relatedTutorials: ['system-overview', 'manage-users', 'create-custom-roles'],
  },

  // ==================== PRODUCT MANAGEMENT ====================
  {
    id: 'create-product-basic',
    title: 'Creating a New Product',
    description: 'Step-by-step guide to adding a new product to your inventory',
    category: 'products',
    subcategory: 'products-basic',
    requiredPermissions: [PERMISSIONS.PRODUCT_CREATE],
    difficulty: 'beginner',
    estimatedTime: '5 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'Navigate to Products',
        description: 'From the dashboard, click on "Products" in the left sidebar menu, then select "All Products".',
        imagePlaceholder: 'navigate-to-products.png',
      },
      {
        stepNumber: 2,
        title: 'Click "Add Product" Button',
        description: 'On the products page, click the "Add Product" or "+ New Product" button in the top-right corner.',
        imagePlaceholder: 'add-product-button.png',
      },
      {
        stepNumber: 3,
        title: 'Fill in Basic Information',
        description: 'Enter the essential product details in the form.',
        imagePlaceholder: 'product-form-basic.png',
        notes: [
          'Product Name: The display name for your product (required)',
          'SKU: Stock Keeping Unit - unique identifier (auto-generated if left blank)',
          'Barcode: Scan or enter barcode number (optional)',
          'Category: Select from existing categories or create new',
          'Brand: Select brand (optional)',
          'Unit: Base unit of measurement (pieces, kg, liters, etc.)',
        ],
        tips: [
          'Use descriptive names that customers will understand',
          'SKU should be unique and follow your business naming convention',
          'If you have a barcode scanner, use it to ensure accuracy',
        ],
      },
      {
        stepNumber: 4,
        title: 'Set Pricing Information',
        description: 'Enter cost and selling prices for the product.',
        imagePlaceholder: 'product-pricing.png',
        notes: [
          'Purchase Price (Cost): What you pay to acquire the product',
          'Selling Price: Default retail price',
          'Profit Margin: Automatically calculated based on cost and price',
        ],
        tips: [
          'Include all costs (product cost, shipping, handling) in purchase price',
          'Consider market research when setting selling price',
        ],
        warnings: [
          'Ensure selling price covers costs and desired profit margin',
        ],
      },
      {
        stepNumber: 5,
        title: 'Set Stock Information (Optional)',
        description: 'If adding opening stock, specify quantity and location.',
        imagePlaceholder: 'product-stock.png',
        notes: [
          'Opening Stock: Initial quantity when adding product',
          'Location: Which business location has this stock',
          'Alert Quantity: Minimum stock level before low-stock warning',
        ],
        tips: [
          'You can add stock later through inventory corrections',
          'Set realistic alert quantities based on sales velocity',
        ],
      },
      {
        stepNumber: 6,
        title: 'Add Product Description and Images (Optional)',
        description: 'Enhance your product listing with descriptions and images.',
        imagePlaceholder: 'product-media.png',
        notes: [
          'Description: Detailed product information for customers',
          'Product Images: Upload up to 5 images',
          'Image guidelines: JPG or PNG, max 2MB per image',
        ],
      },
      {
        stepNumber: 7,
        title: 'Save the Product',
        description: 'Review all information and click "Save Product" or "Create Product" button.',
        imagePlaceholder: 'save-product.png',
        tips: [
          'Double-check all information before saving',
          'You can edit product details anytime after creation',
        ],
      },
      {
        stepNumber: 8,
        title: 'Verify Product Creation',
        description: 'After saving, you should see a success message and the product should appear in your products list.',
        imagePlaceholder: 'product-created.png',
        notes: [
          'The product is now available for sales and purchases',
          'Stock levels will be tracked automatically',
        ],
      },
    ],
    relatedTutorials: ['edit-product', 'manage-categories', 'bulk-import-products', 'product-variants'],
  },
  {
    id: 'edit-product',
    title: 'Editing Product Information',
    description: 'How to update existing product details',
    category: 'products',
    subcategory: 'products-basic',
    requiredPermissions: [PERMISSIONS.PRODUCT_UPDATE],
    difficulty: 'beginner',
    estimatedTime: '3 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'Find the Product',
        description: 'Navigate to Products > All Products and use the search box or filters to locate the product you want to edit.',
        imagePlaceholder: 'search-product.png',
        tips: [
          'Use SKU or barcode for faster search',
          'Filter by category or brand to narrow results',
        ],
      },
      {
        stepNumber: 2,
        title: 'Open Product for Editing',
        description: 'Click on the product name or click the "Edit" button (pencil icon) next to the product.',
        imagePlaceholder: 'edit-product-button.png',
      },
      {
        stepNumber: 3,
        title: 'Make Your Changes',
        description: 'Update any fields you need to modify. All fields from the creation form are editable.',
        notes: [
          'You can change name, SKU, pricing, category, etc.',
          'Some changes may require additional permissions (e.g., changing cost price)',
        ],
        warnings: [
          'Changing SKU may affect integrations and reports',
          'Price changes do not affect existing transactions',
        ],
      },
      {
        stepNumber: 4,
        title: 'Save Changes',
        description: 'Click "Update Product" or "Save Changes" button at the bottom of the form.',
        imagePlaceholder: 'update-product.png',
      },
      {
        stepNumber: 5,
        title: 'Verify Updates',
        description: 'Confirm your changes were saved by checking the product details or the products list.',
        tips: [
          'Changes take effect immediately',
          'Check Product History tab to see audit trail of changes',
        ],
      },
    ],
    relatedTutorials: ['create-product-basic', 'delete-product', 'product-history'],
  },
  {
    id: 'manage-categories',
    title: 'Managing Product Categories',
    description: 'Create and organize product categories for better inventory organization',
    category: 'products',
    subcategory: 'products-basic',
    requiredPermissions: [PERMISSIONS.PRODUCT_CATEGORY_VIEW],
    difficulty: 'beginner',
    estimatedTime: '5 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'Navigate to Categories',
        description: 'Go to Products > Categories from the sidebar menu.',
        imagePlaceholder: 'navigate-categories.png',
      },
      {
        stepNumber: 2,
        title: 'View Existing Categories',
        description: 'Review the list of current categories. Categories help organize products and simplify reporting.',
        notes: [
          'Categories can be hierarchical (parent-child relationships)',
          'Products can belong to one category',
        ],
      },
      {
        stepNumber: 3,
        title: 'Create a New Category',
        description: 'Click "Add Category" button and fill in the category details.',
        imagePlaceholder: 'create-category.png',
        notes: [
          'Category Name: Clear, descriptive name (e.g., "Electronics", "Beverages")',
          'Parent Category: Select if this is a subcategory (optional)',
          'Description: Additional information about the category',
          'Category Code: Short code for reports (optional)',
        ],
        tips: [
          'Use broad categories for main groups',
          'Create subcategories for detailed classification',
          'Example: Electronics > Mobile Phones > Smartphones',
        ],
      },
      {
        stepNumber: 4,
        title: 'Edit or Delete Categories',
        description: 'Click edit icon to modify category details or delete icon to remove (if no products assigned).',
        warnings: [
          'Cannot delete categories with products assigned',
          'Reassign products to another category before deleting',
        ],
      },
    ],
    relatedTutorials: ['create-product-basic', 'manage-brands', 'bulk-import-products'],
  },

  // ==================== INVENTORY MANAGEMENT ====================
  {
    id: 'inventory-correction',
    title: 'Making Inventory Corrections',
    description: 'Adjust stock levels to match physical counts or correct errors',
    category: 'inventory',
    subcategory: 'inventory-adjustments',
    requiredPermissions: [PERMISSIONS.INVENTORY_CORRECTION_CREATE],
    difficulty: 'intermediate',
    estimatedTime: '7 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'When to Use Inventory Corrections',
        description: 'Inventory corrections are used to adjust stock levels when there are discrepancies between system records and physical counts.',
        notes: [
          'Physical count reveals differences',
          'Damaged or expired goods need to be written off',
          'Theft or loss occurred',
          'Data entry errors need correction',
        ],
        warnings: [
          'All corrections create audit trails',
          'Some corrections may require approval based on business rules',
        ],
      },
      {
        stepNumber: 2,
        title: 'Navigate to Inventory Corrections',
        description: 'Go to Inventory > Corrections from the sidebar menu.',
        imagePlaceholder: 'navigate-corrections.png',
      },
      {
        stepNumber: 3,
        title: 'Create New Correction',
        description: 'Click "New Correction" or "+ Add Correction" button.',
        imagePlaceholder: 'new-correction.png',
      },
      {
        stepNumber: 4,
        title: 'Select Products to Adjust',
        description: 'Search and select the products that need stock adjustments.',
        imagePlaceholder: 'select-products-correction.png',
        tips: [
          'Use barcode scanner for faster product selection',
          'You can adjust multiple products in one correction',
        ],
      },
      {
        stepNumber: 5,
        title: 'Enter Adjustment Details',
        description: 'For each product, specify the adjustment type and quantity.',
        imagePlaceholder: 'correction-details.png',
        notes: [
          'Adjustment Type: Add Stock or Remove Stock',
          'Quantity: Amount to add or remove',
          'Reason: Select reason (damage, loss, found, count error, etc.)',
          'Notes: Additional explanation (optional but recommended)',
        ],
        tips: [
          'Be specific in notes for audit purposes',
          'Attach photos of damaged goods if applicable',
        ],
      },
      {
        stepNumber: 6,
        title: 'Review and Submit',
        description: 'Review all adjustments before submitting.',
        imagePlaceholder: 'review-correction.png',
        warnings: [
          'Stock levels will change immediately upon approval',
          'Ensure all quantities and reasons are correct',
        ],
      },
      {
        stepNumber: 7,
        title: 'Approval Process (If Required)',
        description: 'Depending on your role and business settings, corrections may require approval from a manager or admin.',
        notes: [
          'Pending corrections are marked as "Pending Approval"',
          'Approvers receive notifications',
          'You can track status in the Corrections list',
        ],
      },
    ],
    relatedTutorials: ['physical-inventory-count', 'stock-alerts', 'product-history'],
  },
  {
    id: 'stock-transfer-create',
    title: 'Creating Stock Transfer Requests',
    description: 'Transfer inventory between business locations',
    category: 'inventory',
    subcategory: 'inventory-transfers',
    requiredPermissions: [PERMISSIONS.STOCK_TRANSFER_CREATE],
    difficulty: 'intermediate',
    estimatedTime: '10 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'Understanding Stock Transfers',
        description: 'Stock transfers move inventory from one business location to another. This is a multi-step process with checks and balances.',
        notes: [
          'Transfer Request: Created by requester at destination location',
          'Check & Approval: Verified by source location',
          'Shipment: Source location sends goods',
          'Receiving: Destination location confirms receipt',
          'Completion: Stock levels updated at both locations',
        ],
      },
      {
        stepNumber: 2,
        title: 'Navigate to Stock Transfers',
        description: 'Go to Inventory > Stock Transfers from the sidebar.',
        imagePlaceholder: 'navigate-transfers.png',
      },
      {
        stepNumber: 3,
        title: 'Create New Transfer Request',
        description: 'Click "New Transfer Request" button.',
        imagePlaceholder: 'new-transfer.png',
        notes: [
          'Your location (From Location) is automatically set based on your assigned location',
          'You are requesting stock to be sent TO your location',
        ],
      },
      {
        stepNumber: 4,
        title: 'Select Source Location',
        description: 'Choose which location should send you the stock.',
        imagePlaceholder: 'select-source.png',
        tips: [
          'Check stock availability at different locations before requesting',
          'Consider shipping time and costs',
        ],
      },
      {
        stepNumber: 5,
        title: 'Add Products to Transfer',
        description: 'Search and select products you need, then specify quantities.',
        imagePlaceholder: 'add-transfer-products.png',
        notes: [
          'Product: Search by name, SKU, or scan barcode',
          'Requested Quantity: How many units you need',
          'Available at Source: System shows current stock at source location',
        ],
        warnings: [
          'You cannot request more than available stock at source',
          'Ensure quantities are realistic for your needs',
        ],
      },
      {
        stepNumber: 6,
        title: 'Add Transfer Details',
        description: 'Provide reason and additional information.',
        imagePlaceholder: 'transfer-details.png',
        notes: [
          'Reason: Why you need the stock (restock, promotion, shortage, etc.)',
          'Expected Date: When you need the stock by',
          'Notes: Any special instructions or urgency notes',
        ],
      },
      {
        stepNumber: 7,
        title: 'Submit Transfer Request',
        description: 'Review all details and click "Submit Request".',
        imagePlaceholder: 'submit-transfer.png',
        notes: [
          'Request status: Pending',
          'Source location staff will be notified',
          'You can track status in the Transfers list',
        ],
      },
      {
        stepNumber: 8,
        title: 'Track Transfer Progress',
        description: 'Monitor your transfer through various stages.',
        imagePlaceholder: 'transfer-status.png',
        notes: [
          'Pending: Awaiting review by source location',
          'Approved: Source location approved and is preparing shipment',
          'In Transit: Goods have been shipped',
          'Received: You have received the goods',
          'Completed: Transfer finalized, stock levels updated',
        ],
        tips: [
          'You will receive notifications at each stage',
          'Click on transfer to see detailed status and timeline',
        ],
      },
    ],
    relatedTutorials: ['stock-transfer-receive', 'stock-transfer-approve', 'check-stock-levels'],
  },

  // ==================== SALES OPERATIONS ====================
  {
    id: 'process-sale-pos',
    title: 'Processing a Sale (POS)',
    description: 'Complete guide to processing sales transactions at the Point of Sale',
    category: 'sales',
    subcategory: 'sales-pos',
    requiredPermissions: [PERMISSIONS.SELL_CREATE],
    difficulty: 'beginner',
    estimatedTime: '8 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'Open POS Interface',
        description: 'Navigate to Sales > POS or click the "POS" button on the dashboard.',
        imagePlaceholder: 'open-pos.png',
        notes: [
          'Ensure you have opened a cashier shift before processing sales',
          'If not, you will be prompted to open a shift',
        ],
      },
      {
        stepNumber: 2,
        title: 'Add Products to Cart',
        description: 'Search for products and add them to the sale.',
        imagePlaceholder: 'pos-add-products.png',
        notes: [
          'Search by product name, SKU, or scan barcode',
          'Click on product to add to cart',
          'Adjust quantity using + / - buttons or type quantity',
        ],
        tips: [
          'Use barcode scanner for faster checkout',
          'Press Enter after scanning to add product',
          'Use keyboard shortcuts: F2 (Search), F4 (Payment)',
        ],
      },
      {
        stepNumber: 3,
        title: 'Apply Discounts (Optional)',
        description: 'Add discounts to individual items or entire sale.',
        imagePlaceholder: 'pos-discounts.png',
        notes: [
          'Item Discount: Click discount icon on product line',
          'Cart Discount: Use "Apply Discount" button',
          'Discount types: Percentage or fixed amount',
          'Special discounts: Senior Citizen, PWD (Philippine setup)',
        ],
        warnings: [
          'Ensure proper documentation for special discounts (IDs)',
          'Large discounts may require manager approval',
        ],
      },
      {
        stepNumber: 4,
        title: 'Select Customer (Optional)',
        description: 'Link sale to a customer for credit sales or loyalty programs.',
        imagePlaceholder: 'pos-customer.png',
        notes: [
          'Click "Select Customer" or "Walk-in Customer"',
          'Search existing customer or create new',
          'Required for credit sales and returns',
        ],
      },
      {
        stepNumber: 5,
        title: 'Proceed to Payment',
        description: 'Click "Pay" or "Checkout" button to proceed to payment screen.',
        imagePlaceholder: 'pos-checkout.png',
        notes: [
          'Review total amount and items',
          'Verify discounts applied correctly',
        ],
      },
      {
        stepNumber: 6,
        title: 'Process Payment',
        description: 'Select payment method and enter payment details.',
        imagePlaceholder: 'pos-payment.png',
        notes: [
          'Payment Methods: Cash, Card, Bank Transfer, E-Wallet, Credit',
          'For cash: Enter amount tendered, change calculated automatically',
          'For multiple payments: Click "Split Payment"',
        ],
        tips: [
          'Count cash carefully before accepting',
          'For cards, ensure transaction is approved before completing',
        ],
      },
      {
        stepNumber: 7,
        title: 'Complete Sale',
        description: 'Click "Complete Sale" or "Finalize" to finish transaction.',
        imagePlaceholder: 'sale-completed.png',
        notes: [
          'Receipt is generated automatically',
          'Inventory is deducted immediately',
          'Sale is recorded in daily sales',
        ],
      },
      {
        stepNumber: 8,
        title: 'Print or Email Receipt',
        description: 'Provide receipt to customer.',
        imagePlaceholder: 'print-receipt.png',
        options: [
          'Print: Click "Print Receipt" button',
          'Email: Enter customer email and click "Email Receipt"',
          'SMS: Send receipt link via SMS (if configured)',
        ],
      },
    ],
    relatedTutorials: ['open-cashier-shift', 'process-refund', 'split-payment', 'credit-sales'],
  },
  {
    id: 'open-cashier-shift',
    title: 'Opening a Cashier Shift',
    description: 'Start your shift and declare beginning cash',
    category: 'sales',
    subcategory: 'sales-pos',
    requiredPermissions: [PERMISSIONS.SHIFT_OPEN],
    difficulty: 'beginner',
    estimatedTime: '3 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'Why Open a Shift?',
        description: 'Opening a shift records your beginning cash and tracks all transactions during your work period.',
        notes: [
          'Required before processing any sales',
          'Tracks cash accountability',
          'Simplifies end-of-day reconciliation',
        ],
      },
      {
        stepNumber: 2,
        title: 'Access Shift Management',
        description: 'Go to Sales > Cashier Shifts or click "Open Shift" prompt when accessing POS.',
        imagePlaceholder: 'shift-management.png',
      },
      {
        stepNumber: 3,
        title: 'Click "Open New Shift"',
        description: 'Start a new shift session.',
        imagePlaceholder: 'open-new-shift.png',
      },
      {
        stepNumber: 4,
        title: 'Declare Beginning Cash',
        description: 'Count the cash in your drawer and enter the amount.',
        imagePlaceholder: 'beginning-cash.png',
        notes: [
          'Count all bills and coins carefully',
          'Include change fund provided by management',
          'This amount will be compared against your closing cash',
        ],
        tips: [
          'Have a witness verify your count',
          'Take a photo of cash count for records (optional)',
        ],
      },
      {
        stepNumber: 5,
        title: 'Confirm and Start Shift',
        description: 'Click "Start Shift" to begin.',
        imagePlaceholder: 'shift-started.png',
        notes: [
          'Your shift is now active',
          'All sales will be linked to this shift',
          'You can now process transactions',
        ],
      },
    ],
    relatedTutorials: ['close-cashier-shift', 'process-sale-pos', 'cash-count'],
  },

  // ==================== PURCHASE MANAGEMENT ====================
  {
    id: 'create-purchase-order',
    title: 'Creating a Purchase Order',
    description: 'Order inventory from suppliers',
    category: 'purchases',
    subcategory: 'purchases-orders',
    requiredPermissions: [PERMISSIONS.PURCHASE_CREATE],
    difficulty: 'intermediate',
    estimatedTime: '10 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'Navigate to Purchases',
        description: 'Go to Purchases > Purchase Orders from the sidebar.',
        imagePlaceholder: 'navigate-purchases.png',
      },
      {
        stepNumber: 2,
        title: 'Create New Purchase Order',
        description: 'Click "New Purchase Order" or "+ Create PO" button.',
        imagePlaceholder: 'new-purchase-order.png',
      },
      {
        stepNumber: 3,
        title: 'Select Supplier',
        description: 'Choose the supplier you are ordering from.',
        imagePlaceholder: 'select-supplier.png',
        notes: [
          'Search existing suppliers',
          'Or click "Add New Supplier" to create one',
          'Supplier contact and payment terms will auto-fill',
        ],
      },
      {
        stepNumber: 4,
        title: 'Set Purchase Details',
        description: 'Enter order information.',
        imagePlaceholder: 'purchase-details.png',
        notes: [
          'PO Number: Auto-generated or enter custom',
          'Order Date: Date of order placement',
          'Expected Delivery: When you expect to receive goods',
          'Receiving Location: Which location will receive the goods (auto-set to Main Warehouse)',
        ],
      },
      {
        stepNumber: 5,
        title: 'Add Products to Order',
        description: 'Select products and quantities to order.',
        imagePlaceholder: 'add-purchase-products.png',
        notes: [
          'Product: Search or scan',
          'Quantity: Units to order',
          'Unit Cost: Cost per unit',
          'Subtotal: Automatically calculated',
        ],
        tips: [
          'Check current stock levels before ordering',
          'Review stock alerts for reorder suggestions',
          'Consider lead time when setting quantities',
        ],
      },
      {
        stepNumber: 6,
        title: 'Add Additional Costs (Optional)',
        description: 'Include shipping, taxes, and other charges.',
        imagePlaceholder: 'purchase-costs.png',
        notes: [
          'Shipping Cost: Delivery charges',
          'Tax: VAT or sales tax',
          'Other Charges: Handling fees, customs, etc.',
        ],
      },
      {
        stepNumber: 7,
        title: 'Review and Submit',
        description: 'Verify all details and submit the purchase order.',
        imagePlaceholder: 'submit-purchase-order.png',
        notes: [
          'PO Status: Draft',
          'Can be edited before approval',
          'Send PO to supplier via email or print',
        ],
      },
      {
        stepNumber: 8,
        title: 'Approval Process (If Required)',
        description: 'Purchase orders may require approval based on amount and business rules.',
        notes: [
          'Pending Approval: Awaiting manager/admin review',
          'Approved: Ready to send to supplier',
          'Rejected: Needs revision or cancellation',
        ],
      },
    ],
    relatedTutorials: ['receive-purchase', 'manage-suppliers', 'purchase-returns'],
  },

  // ==================== REPORTS ====================
  {
    id: 'generate-sales-report',
    title: 'Generating Sales Reports',
    description: 'Create and export sales analytics reports',
    category: 'reports',
    subcategory: 'reports-sales',
    requiredPermissions: [PERMISSIONS.SALES_REPORT_VIEW],
    difficulty: 'beginner',
    estimatedTime: '5 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'Navigate to Sales Reports',
        description: 'Go to Reports > Sales Reports from the sidebar.',
        imagePlaceholder: 'navigate-reports.png',
      },
      {
        stepNumber: 2,
        title: 'Choose Report Type',
        description: 'Select the type of sales report you need.',
        imagePlaceholder: 'select-report-type.png',
        notes: [
          'Daily Sales: Sales by date',
          'Sales Summary: Overview by period',
          'Sales by Cashier: Performance by staff',
          'Sales by Product: Product-wise sales',
          'Sales by Customer: Customer purchase history',
          'Sales by Location: Multi-location comparison',
        ],
      },
      {
        stepNumber: 3,
        title: 'Set Report Filters',
        description: 'Configure date range and other filters.',
        imagePlaceholder: 'report-filters.png',
        notes: [
          'Date Range: Select period (today, this week, this month, custom)',
          'Location: Filter by specific location or all',
          'Cashier: Specific cashier or all',
          'Payment Method: Cash, card, credit, all',
        ],
        tips: [
          'Use predefined ranges for common reports',
          'Custom date ranges for specific analysis',
        ],
      },
      {
        stepNumber: 4,
        title: 'Generate Report',
        description: 'Click "Generate Report" or "View Report" button.',
        imagePlaceholder: 'generate-report.png',
        notes: [
          'Report loads in the browser',
          'Data is current as of report generation time',
        ],
      },
      {
        stepNumber: 5,
        title: 'Review Report Data',
        description: 'Analyze the report contents.',
        imagePlaceholder: 'report-data.png',
        notes: [
          'Tables show detailed transaction data',
          'Charts visualize trends and patterns',
          'Summary cards show key metrics',
        ],
        tips: [
          'Look for trends and anomalies',
          'Compare periods for insights',
        ],
      },
      {
        stepNumber: 6,
        title: 'Export Report',
        description: 'Save or share the report.',
        imagePlaceholder: 'export-report.png',
        notes: [
          'Print: Print-friendly format',
          'Export to PDF: Portable document',
          'Export to Excel: For further analysis',
          'Email: Send directly to recipients',
        ],
        tips: [
          'Excel export allows custom calculations',
          'PDF is best for formal reports',
        ],
      },
    ],
    relatedTutorials: ['inventory-reports', 'financial-reports', 'x-reading', 'z-reading'],
  },

  // ==================== USER & RBAC ====================
  {
    id: 'create-new-user',
    title: 'Creating a New User',
    description: 'Add new staff members and assign roles',
    category: 'users-rbac',
    requiredPermissions: [PERMISSIONS.USER_CREATE],
    difficulty: 'intermediate',
    estimatedTime: '5 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'Navigate to User Management',
        description: 'Go to Settings > Users or Users & Roles > Users.',
        imagePlaceholder: 'navigate-users.png',
      },
      {
        stepNumber: 2,
        title: 'Click "Add User"',
        description: 'Start creating a new user account.',
        imagePlaceholder: 'add-user.png',
      },
      {
        stepNumber: 3,
        title: 'Enter User Details',
        description: 'Fill in personal information.',
        imagePlaceholder: 'user-details.png',
        notes: [
          'Username: Unique login name (required)',
          'Full Name: User\'s complete name',
          'Email: For notifications and password recovery',
          'Password: Initial password (user can change later)',
          'Phone: Contact number (optional)',
        ],
        tips: [
          'Use company email addresses',
          'Choose strong passwords',
          'Usernames should be easy to remember',
        ],
      },
      {
        stepNumber: 4,
        title: 'Assign Roles',
        description: 'Select the role(s) for this user.',
        imagePlaceholder: 'assign-roles.png',
        notes: [
          'Select from predefined roles (Admin, Manager, Cashier, etc.)',
          'Users can have multiple roles',
          'Permissions are combined from all roles',
        ],
        warnings: [
          'Be cautious with Admin and Manager roles',
          'Review role permissions before assigning',
        ],
      },
      {
        stepNumber: 5,
        title: 'Assign Business Location',
        description: 'Set the user\'s primary work location.',
        imagePlaceholder: 'assign-location.png',
        notes: [
          'Users can be assigned to one or multiple locations',
          'Primary location is used for transactions',
          'Location determines data access (location-specific data)',
        ],
      },
      {
        stepNumber: 6,
        title: 'Set Additional Permissions (Optional)',
        description: 'Grant specific permissions beyond their role.',
        imagePlaceholder: 'additional-permissions.png',
        tips: [
          'Use sparingly - roles should handle most permissions',
          'Useful for temporary or special access',
        ],
      },
      {
        stepNumber: 7,
        title: 'Save and Notify User',
        description: 'Create the user account.',
        imagePlaceholder: 'save-user.png',
        notes: [
          'Option to send welcome email with login credentials',
          'Advise user to change password on first login',
        ],
      },
    ],
    relatedTutorials: ['manage-roles', 'edit-user-permissions', 'deactivate-user'],
  },

  // ==================== ADVANCED FEATURES ====================
  {
    id: 'multi-location-setup',
    title: 'Setting Up Multiple Locations',
    description: 'Configure and manage multiple business locations',
    category: 'advanced',
    requiredPermissions: [PERMISSIONS.BUSINESS_SETTINGS_EDIT],
    difficulty: 'advanced',
    estimatedTime: '15 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'Understanding Multi-Location Architecture',
        description: 'Each business can have multiple physical locations (branches, warehouses, stores).',
        notes: [
          'Each location maintains separate inventory',
          'Stock transfers move inventory between locations',
          'Users are assigned to specific locations',
          'Reports can be location-specific or consolidated',
        ],
      },
      {
        stepNumber: 2,
        title: 'Navigate to Business Locations',
        description: 'Go to Settings > Business Settings > Locations.',
        imagePlaceholder: 'navigate-locations.png',
      },
      {
        stepNumber: 3,
        title: 'Add New Location',
        description: 'Click "Add Location" button.',
        imagePlaceholder: 'add-location.png',
      },
      {
        stepNumber: 4,
        title: 'Enter Location Details',
        description: 'Fill in location information.',
        imagePlaceholder: 'location-details.png',
        notes: [
          'Location Name: Descriptive name (e.g., "Downtown Store", "Warehouse A")',
          'Location Code: Short code for reports (e.g., "DT", "WH-A")',
          'Address: Full physical address',
          'Contact Info: Phone, email',
          'Location Type: Store, Warehouse, Office, etc.',
        ],
      },
      {
        stepNumber: 5,
        title: 'Configure Location Settings',
        description: 'Set location-specific configurations.',
        imagePlaceholder: 'location-settings.png',
        notes: [
          'Is Active: Enable/disable location',
          'Allow Sales: Can this location process sales?',
          'Allow Purchases: Can this location create purchase orders?',
          'Default for New Products: Auto-assign new products to this location',
        ],
      },
      {
        stepNumber: 6,
        title: 'Save Location',
        description: 'Click "Save" to create the location.',
        imagePlaceholder: 'save-location.png',
      },
      {
        stepNumber: 7,
        title: 'Assign Users to Location',
        description: 'Go to Users management and assign staff to the new location.',
        notes: [
          'Edit each user and select their assigned location(s)',
          'Users see data relevant to their location',
        ],
      },
      {
        stepNumber: 8,
        title: 'Transfer Stock to New Location',
        description: 'Use stock transfers to allocate inventory to the new location.',
        tips: [
          'Create initial stock through inventory corrections',
          'Or transfer from existing locations',
        ],
      },
    ],
    relatedTutorials: ['stock-transfer-create', 'location-based-pricing', 'consolidated-reports'],
  },
  {
    id: 'ai-assistant-usage',
    title: 'Using the AI Assistant',
    description: 'Get help and insights from the AI-powered assistant',
    category: 'advanced',
    difficulty: 'beginner',
    estimatedTime: '5 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'What Can the AI Assistant Do?',
        description: 'The AI assistant provides intelligent help and business insights.',
        notes: [
          'Answer questions about features and how to use them',
          'Provide business analytics and insights',
          'Generate reports summaries',
          'Troubleshoot issues',
          'Suggest optimizations',
        ],
      },
      {
        stepNumber: 2,
        title: 'Access the AI Assistant',
        description: 'Click the AI Assistant icon in the top navigation or go to Dashboard > AI Assistant.',
        imagePlaceholder: 'open-ai-assistant.png',
      },
      {
        stepNumber: 3,
        title: 'Ask a Question',
        description: 'Type your question or request in the chat box.',
        imagePlaceholder: 'ai-chat.png',
        examples: [
          '"How do I create a purchase order?"',
          '"What were my top selling products last month?"',
          '"Why is my stock count not matching?"',
          '"How can I improve my inventory turnover?"',
        ],
        tips: [
          'Be specific in your questions',
          'Provide context for better answers',
        ],
      },
      {
        stepNumber: 4,
        title: 'Review AI Response',
        description: 'The AI will provide detailed answers and suggestions.',
        imagePlaceholder: 'ai-response.png',
        notes: [
          'Responses include step-by-step instructions',
          'May include links to relevant pages',
          'Can generate insights based on your data',
        ],
      },
      {
        stepNumber: 5,
        title: 'Follow Up Questions',
        description: 'Continue the conversation for clarification or additional help.',
        tips: [
          'Ask follow-up questions',
          'Request examples or clarification',
        ],
      },
    ],
    relatedTutorials: ['system-overview', 'keyboard-shortcuts'],
  },

  // ==================== TROUBLESHOOTING & FAQ ====================
  {
    id: 'permission-denied-errors',
    title: 'Troubleshooting: Permission Denied Errors',
    description: 'Resolve access permission issues',
    category: 'troubleshooting',
    difficulty: 'beginner',
    estimatedTime: '3 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'Understanding Permission Denied',
        description: 'This error occurs when you try to access a feature you don\'t have permission for.',
        notes: [
          'The system enforces strict role-based access control',
          'Only users with specific permissions can access certain features',
        ],
      },
      {
        stepNumber: 2,
        title: 'Check Your Current Role',
        description: 'Verify what role you are assigned.',
        imagePlaceholder: 'check-role.png',
        steps: [
          {
            stepNumber: 1,
            title: '',
            description: 'Click on your profile icon',
          },
          {
            stepNumber: 2,
            title: '',
            description: 'View your assigned roles',
          },
        ] as any,
      },
      {
        stepNumber: 3,
        title: 'Contact Your Administrator',
        description: 'If you need access to a feature, request permission from your admin or manager.',
        notes: [
          'Explain which feature you need access to',
          'Provide business justification',
          'Admin can grant additional permissions or change your role',
        ],
      },
      {
        stepNumber: 4,
        title: 'For Administrators: Grant Permissions',
        description: 'Admins can grant permissions through User Management.',
        notes: [
          'Go to Users & Roles > Users',
          'Edit the user',
          'Add role or specific permissions',
          'User may need to logout and login again',
        ],
      },
    ],
    relatedTutorials: ['user-roles-overview', 'create-new-user', 'manage-roles'],
  },
  {
    id: 'stock-mismatch-issues',
    title: 'Troubleshooting: Stock Count Mismatches',
    description: 'Resolve discrepancies between system count and physical count',
    category: 'troubleshooting',
    difficulty: 'intermediate',
    estimatedTime: '10 minutes',
    steps: [
      {
        stepNumber: 1,
        title: 'Common Causes of Stock Mismatches',
        description: 'Understanding why stock counts don\'t match.',
        notes: [
          'Unreceived purchase orders (goods received but not recorded)',
          'Unrecorded damages or losses',
          'Theft or shrinkage',
          'Data entry errors',
          'Pending transfers not completed',
          'Returns not processed correctly',
        ],
      },
      {
        stepNumber: 2,
        title: 'Check Product History',
        description: 'Review all transactions for the product.',
        imagePlaceholder: 'product-history.png',
        notes: [
          'Go to Products > All Products',
          'Click on the product',
          'View "Product History" tab',
          'Review all ins and outs',
        ],
      },
      {
        stepNumber: 3,
        title: 'Verify Pending Transactions',
        description: 'Check for pending transfers, purchases, or sales.',
        notes: [
          'Check Purchases for pending receipts',
          'Check Transfers for in-transit items',
          'Check Sales for pending returns',
        ],
      },
      {
        stepNumber: 4,
        title: 'Perform Physical Count',
        description: 'Conduct an accurate physical count of the product.',
        tips: [
          'Count during off-hours for accuracy',
          'Use two people to count and verify',
          'Check all storage locations',
        ],
      },
      {
        stepNumber: 5,
        title: 'Create Inventory Correction',
        description: 'Adjust system count to match physical count.',
        notes: [
          'Go to Inventory > Corrections',
          'Create new correction',
          'Enter correct quantity',
          'Document reason thoroughly',
          'Attach photos if available',
        ],
      },
      {
        stepNumber: 6,
        title: 'Implement Preventive Measures',
        description: 'Prevent future mismatches.',
        tips: [
          'Schedule regular physical counts',
          'Train staff on proper receiving procedures',
          'Implement cycle counting',
          'Review and reconcile daily',
        ],
      },
    ],
    relatedTutorials: ['inventory-correction', 'physical-inventory-count', 'product-history'],
  },
]

// Helper function to filter tutorials by role
export function getTutorialsForRole(userRoles: string[], userPermissions: string[]): Tutorial[] {
  return TUTORIALS.filter((tutorial) => {
    // If no permissions required, show to everyone
    if (!tutorial.requiredPermissions && !tutorial.requiredRoles) {
      return true
    }

    // Check role match
    if (tutorial.requiredRoles && tutorial.requiredRoles.length > 0) {
      const hasRequiredRole = tutorial.requiredRoles.some((role) => userRoles.includes(role))
      if (hasRequiredRole) return true
    }

    // Check permission match
    if (tutorial.requiredPermissions && tutorial.requiredPermissions.length > 0) {
      const hasAllPermissions = tutorial.requiredPermissions.every((perm) =>
        userPermissions.includes(perm)
      )
      if (hasAllPermissions) return true
    }

    return false
  })
}

// Helper function to get tutorials by category
export function getTutorialsByCategory(categoryId: string): Tutorial[] {
  return TUTORIALS.filter((tutorial) => tutorial.category === categoryId)
}

// Helper function to search tutorials
export function searchTutorials(query: string): Tutorial[] {
  const lowerQuery = query.toLowerCase()
  return TUTORIALS.filter(
    (tutorial) =>
      tutorial.title.toLowerCase().includes(lowerQuery) ||
      tutorial.description.toLowerCase().includes(lowerQuery) ||
      tutorial.steps.some(
        (step) =>
          step.title.toLowerCase().includes(lowerQuery) ||
          step.description.toLowerCase().includes(lowerQuery)
      )
  )
}
