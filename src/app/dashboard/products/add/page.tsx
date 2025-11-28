/**
 * ============================================================================
 * ADD PRODUCT PAGE (src/app/dashboard/products/add/page.tsx)
 * ============================================================================
 *
 * PURPOSE: Form page for creating new products (single, variable, or combo)
 *
 * WHAT THIS PAGE DOES:
 * 1. Displays comprehensive product creation form
 * 2. Handles three product types: Single, Variable, Combo
 * 3. Validates all inputs (pricing, required fields, SKU uniqueness)
 * 4. Supports quick-add for categories, brands, and units
 * 5. Auto-calculates margin percentage and selling price
 * 6. Allows image and brochure uploads
 * 7. Creates product with zero inventory at all locations
 * 8. Provides three save options: Save, Save & Add Another, Save & Add Stock
 *
 * USER JOURNEY:
 * User clicks "Add Product" button on products list page
 *   ↓
 * This form page loads
 *   ↓
 * User fills in product details:
 *   - Basic info (name, type, category, brand, unit)
 *   - Pricing (purchase price, selling price, tax)
 *   - Stock settings (enable stock, alert quantity)
 *   - For Variable: Add variations with individual prices
 *   - For Combo: Select component products and quantities
 *   ↓
 * User clicks "Save" (or "Save & Add Another" or "Save & Add Stock")
 *   ↓
 * Form validates all fields
 *   ↓
 * POST /api/products (sends product data)
 *   ↓
 * API creates product record
 *   ↓
 * API creates variations (1 default for single, N for variable)
 *   ↓
 * API initializes ZERO inventory at ALL locations
 *   ↓
 * Success toast notification
 *   ↓
 * Redirect based on save action:
 *   - "Save" → /dashboard/products (list page)
 *   - "Save & Add Another" → Stay on form (reset fields)
 *   - "Save & Add Stock" → /dashboard/products/[id]/add-stock (initial stock entry)
 *
 * PRODUCT TYPES:
 *
 * 1. SINGLE PRODUCT:
 *    - Regular product without variations (e.g., "Laptop", "Keyboard")
 *    - Has ONE default variation created automatically
 *    - Single set of prices (purchase price, selling price)
 *    - Use case: Most common products
 *
 * 2. VARIABLE PRODUCT:
 *    - Product with multiple variations (e.g., "T-Shirt" with sizes S/M/L/XL)
 *    - Each variation has its own SKU, purchase price, selling price
 *    - Can mark one variation as default
 *    - Inventory tracked per variation per location
 *    - Use case: Clothing, shoes, products with sizes/colors/options
 *
 * 3. COMBO PRODUCT:
 *    - Bundle of multiple products (e.g., "Meal Deal" = Burger + Fries + Drink)
 *    - Select component products and specify quantities
 *    - Has bundle price (different from sum of individual prices)
 *    - Stock auto-calculated based on component availability
 *    - Use case: Meal combos, bundle deals, product kits
 *
 * FORM SECTIONS:
 *
 * 1. BASIC INFORMATION:
 *    - Product Name * (required)
 *    - Product Type * (single/variable/combo)
 *    - Category (optional, with quick-add button)
 *    - Sub-Category (if parent category selected)
 *    - Brand (optional, with quick-add button)
 *    - Unit of Measurement * (required, with quick-add button)
 *    - SKU (auto-generated if empty)
 *    - Barcode Type (Code128, Code39, EAN13, etc.)
 *
 * 2. PRICING (for Single products):
 *    - Purchase Price * (cost from supplier)
 *    - Selling Price * (price to customer)
 *    - Margin % (auto-calculated: (selling - purchase) / purchase × 100)
 *    - Tax Rate (optional, select from list)
 *    - Tax Type (inclusive or exclusive)
 *
 * 3. VARIATIONS (for Variable products):
 *    - Variation Name (e.g., "Small", "Medium", "Large")
 *    - SKU (auto-generated or manual)
 *    - Purchase Price (cost for this variation)
 *    - Selling Price (price for this variation)
 *    - Default (mark one as default)
 *    - Add/Remove variation buttons
 *
 * 4. COMBO ITEMS (for Combo products):
 *    - Select Product (from existing products)
 *    - Quantity (how many units in combo)
 *    - Add/Remove item buttons
 *    - Shows product name, price, available stock
 *
 * 5. STOCK MANAGEMENT:
 *    - Enable Stock Tracking (checkbox)
 *    - Alert Quantity (reorder level threshold)
 *    - Note: Initial stock is zero, added via:
 *      * Purchase receipts
 *      * Initial stock entry (if "Save & Add Stock" clicked)
 *      * Inventory adjustments
 *
 * 6. ADDITIONAL DETAILS:
 *    - Description (short text)
 *    - Product Description (long text, shown to customers)
 *    - Image Upload (product photo)
 *    - Brochure Upload (PDF/document)
 *    - Weight (for shipping calculations)
 *    - Preparation Time (for food/kitchen items)
 *    - Enable Product Info (show details to customers)
 *    - Not For Selling (internal use only)
 *
 * VALIDATION RULES:
 *
 * 1. Required Fields:
 *    - Product name cannot be empty
 *    - Unit must be selected
 *    - Purchase price > 0 (must have cost)
 *    - Selling price > 0 (must have price)
 *    - Selling price >= Purchase price (prevent selling at loss)
 *
 * 2. Variable Products:
 *    - At least one variation required
 *    - Each variation must have name
 *    - Each variation must have valid prices
 *    - Variation SKUs must be unique
 *
 * 3. Combo Products:
 *    - At least one component product required
 *    - Quantity must be > 0
 *    - Cannot add same product twice
 *
 * 4. SKU Validation:
 *    - Must be unique within business
 *    - If empty, auto-generated from business settings
 *    - Format: {PREFIX}-{COUNTER} (e.g., PROD-001)
 *
 * AUTO-CALCULATIONS:
 *
 * 1. Margin Percentage:
 *    - Formula: ((sellingPrice - purchasePrice) / purchasePrice) × 100
 *    - Example: Cost $50, Price $75 → Margin = 50%
 *    - Updates automatically when prices change
 *
 * 2. Selling Price from Margin:
 *    - User can enter margin % instead of selling price
 *    - Formula: sellingPrice = purchasePrice × (1 + margin/100)
 *    - Example: Cost $50, Margin 50% → Price = $75
 *
 * QUICK-ADD MODALS:
 *
 * Instead of navigating away to create categories/brands/units,
 * user can create them inline with quick-add modals:
 *
 * 1. Quick Add Category:
 *    - Opens modal overlay
 *    - Fields: Name, Short Code, Description
 *    - POST /api/categories
 *    - New category immediately available in dropdown
 *
 * 2. Quick Add Brand:
 *    - Opens modal overlay
 *    - Fields: Name, Description
 *    - POST /api/brands
 *    - New brand immediately available in dropdown
 *
 * 3. Quick Add Unit:
 *    - Opens modal overlay
 *    - Fields: Name, Short Name, Allow Decimal
 *    - POST /api/units
 *    - New unit immediately available in dropdown
 *
 * SAVE ACTIONS:
 *
 * 1. Save:
 *    - Creates product
 *    - Shows success toast
 *    - Redirects to products list page
 *    - Use case: One-time product addition
 *
 * 2. Save & Add Another:
 *    - Creates product
 *    - Shows success toast
 *    - Clears form
 *    - Stays on add page
 *    - Use case: Bulk product entry (adding many products)
 *
 * 3. Save & Add Stock:
 *    - Creates product
 *    - Shows success toast
 *    - Redirects to initial stock entry page
 *    - Use case: New product that needs immediate inventory
 *    - Next page: /dashboard/products/[id]/add-stock
 *
 * INVENTORY INITIALIZATION:
 *
 * When product is created (via POST /api/products):
 * 1. API gets all active business locations
 * 2. API creates variations:
 *    - Single product: 1 default variation
 *    - Variable product: N variations (as specified)
 * 3. API creates VariationLocationDetails for each variation × location:
 *    - qtyAvailable = 0 (zero inventory)
 *    - Establishes tracking baseline
 * 4. Stock can then be added via:
 *    - Purchase receipts (receiving from suppliers)
 *    - Initial stock entry (if "Save & Add Stock" clicked)
 *    - Inventory adjustments (manual corrections)
 *    - Transfers (from other locations)
 *
 * WHY ZERO INVENTORY?
 * - Prevents negative stock issues
 * - Requires explicit stock addition (audit trail)
 * - Matches accounting best practices
 * - Ensures proper cost tracking (FIFO/LIFO)
 *
 * DATA FLOW:
 *
 * 1. Page Load:
 *    - Fetch categories: GET /api/categories
 *    - Fetch brands: GET /api/brands
 *    - Fetch units: GET /api/units
 *    - Fetch tax rates: GET /api/tax-rates
 *    - For combo: Fetch products: GET /api/products
 *
 * 2. Form Submission:
 *    - Validate all fields locally
 *    - Build request body based on product type
 *    - POST /api/products { name, type, prices, variations, comboItems, ... }
 *    - Handle response:
 *      * Success: Show toast, redirect/reset
 *      * Error: Show validation errors in form
 *
 * 3. Quick-Add:
 *    - User clicks "+ Category"
 *    - Modal opens with form
 *    - User enters name
 *    - POST /api/categories { name, ... }
 *    - New category added to dropdown
 *    - Modal closes
 *
 * ERROR HANDLING:
 * - Required field empty → Red border + error message below field
 * - Invalid pricing → Alert toast + error message
 * - Duplicate SKU → API error → Toast notification
 * - Network error → Retry button + error message
 *
 * RELATED COMPONENTS:
 * - DevExtreme SelectBox: Dropdown selects with search
 * - Image upload component (not shown in snippet)
 * - Quick-add modal dialogs
 *
 * RELATED API ENDPOINTS:
 * - POST /api/products - Create new product
 * - GET /api/categories - Fetch categories for dropdown
 * - GET /api/brands - Fetch brands for dropdown
 * - GET /api/units - Fetch units for dropdown
 * - GET /api/tax-rates - Fetch tax rates for dropdown
 * - POST /api/categories - Quick-add category
 * - POST /api/brands - Quick-add brand
 * - POST /api/units - Quick-add unit
 *
 * RELATED PAGES:
 * - /dashboard/products - Products list (redirect after save)
 * - /dashboard/products/[id]/add-stock - Initial stock entry
 * - /dashboard/products/[id]/edit - Edit product form
 */

"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { SelectBox } from 'devextreme-react/select-box'

interface Category {
  id: number
  name: string
  parentId: number | null
}

interface Brand {
  id: number
  name: string
}

interface Unit {
  id: number
  name: string
  shortName: string
}

interface TaxRate {
  id: number
  name: string
  amount: number
}

interface Variation {
  name: string
  sku: string
  purchasePrice: string
  sellingPrice: string
  isDefault: boolean
}

interface ComboItem {
  productId: string
  quantity: string
}

export default function AddProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saveAction, setSaveAction] = useState<'save' | 'save-and-add' | 'save-and-stock'>('save')
  const [categories, setCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])

  // Quick Add Modal States
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showBrandModal, setShowBrandModal] = useState(false)
  const [showUnitModal, setShowUnitModal] = useState(false)

  // Quick Add Form States
  const [quickAddLoading, setQuickAddLoading] = useState(false)
  const [categoryForm, setCategoryForm] = useState({ name: '', shortCode: '', description: '' })
  const [brandForm, setBrandForm] = useState({ name: '', description: '' })
  const [unitForm, setUnitForm] = useState({ name: '', shortName: '', allowDecimal: false })

  const [formData, setFormData] = useState({
    name: '',
    type: 'single',
    categoryId: '',
    subCategoryId: '',
    brandId: '',
    unitId: '',
    taxId: '',
    taxType: 'inclusive',
    sku: '',
    barcodeType: 'Code128',
    description: '',
    productDescription: '',
    image: '',
    brochure: '',
    enableStock: true,
    alertQuantity: '',
    purchasePrice: '',
    sellingPrice: '',
    marginPercentage: '',
    weight: '',
    preparationTime: '',
    enableProductInfo: false,
    notForSelling: false,
  })

  const [variations, setVariations] = useState<Variation[]>([])
  const [variationSkuType, setVariationSkuType] = useState<'with_out_variation' | 'with_variation'>('with_out_variation')
  const [comboItems, setComboItems] = useState<ComboItem[]>([])
  const [availableProducts, setAvailableProducts] = useState<any[]>([])

  useEffect(() => {
    fetchMetadata()
  }, [])

  useEffect(() => {
    // Filter sub-categories when category changes
    if (formData.categoryId) {
      const subs = categories.filter(cat => cat.parentId === parseInt(formData.categoryId))
      setSubCategories(subs)
    } else {
      setSubCategories([])
    }
  }, [formData.categoryId, categories])

  // Auto-calculate selling price from margin whenever purchase price or margin changes
  useEffect(() => {
    if (formData.purchasePrice && formData.marginPercentage) {
      const purchase = parseFloat(formData.purchasePrice)
      const margin = parseFloat(formData.marginPercentage)
      if (!isNaN(purchase) && !isNaN(margin) && purchase > 0) {
        const selling = purchase + (purchase * margin / 100)
        setFormData(prev => ({ ...prev, sellingPrice: selling.toFixed(2) }))
      }
    }
  }, [formData.purchasePrice, formData.marginPercentage])

  const fetchMetadata = async () => {
    try {
      const [categoriesRes, brandsRes, unitsRes, taxRatesRes, productsRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/brands'),
        fetch('/api/units'),
        fetch('/api/tax-rates'),
        fetch('/api/products')
      ])

      const [categoriesData, brandsData, unitsData, taxRatesData, productsData] = await Promise.all([
        categoriesRes.json(),
        brandsRes.json(),
        unitsRes.json(),
        taxRatesRes.json(),
        productsRes.json()
      ])

      setCategories(categoriesData.categories || [])
      setBrands(brandsData.brands || [])
      const fetchedUnits = unitsData.units || []
      setUnits(fetchedUnits)
      const fetchedTaxRates = taxRatesData.taxRates || []
      setTaxRates(fetchedTaxRates)
      setAvailableProducts(productsData.products || [])

      // Set default tax to "Standard VAT (12%)" if available - only on initial load
      const standardVAT = fetchedTaxRates.find((tax: TaxRate) =>
        tax.name === 'Standard VAT (12%)' || (tax.name.includes('Standard VAT') && tax.amount === 12)
      )

      // Set default unit to "Piece(s)" if available - only on initial load
      const pieceUnit = fetchedUnits.find((unit: Unit) =>
        unit.name === 'Piece(s)' ||
        unit.name === 'Pieces' ||
        unit.name.toLowerCase().includes('piece') ||
        unit.shortName === 'Pcs' ||
        unit.shortName === 'Pc'
      )

      setFormData(prev => {
        const updates: any = {}

        // Only set tax if it's not already set and this is the initial load
        if (!prev.taxId && standardVAT) {
          updates.taxId = standardVAT.id.toString()
        }

        // Only set unit if it's not already set and this is the initial load
        if (!prev.unitId && pieceUnit) {
          updates.unitId = pieceUnit.id.toString()
        }

        if (Object.keys(updates).length > 0) {
          return { ...prev, ...updates }
        }
        return prev
      })
    } catch (error) {
      console.error('Error fetching metadata:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent, action: 'save' | 'save-and-add' | 'save-and-stock' = 'save') => {
    e.preventDefault()
    setLoading(true)
    setSaveAction(action)

    try {
      const payload = {
        ...formData,
        variations: formData.type === 'variable' ? variations : undefined,
        variationSkuType: formData.type === 'variable' ? variationSkuType : undefined,
        comboItems: formData.type === 'combo' ? comboItems : undefined
      }

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const data = await response.json()

        if (action === 'save-and-stock') {
          router.push(`/dashboard/products/${data.product.id}/opening-stock`)
        } else if (action === 'save-and-add') {
          // Reset form for new product
          setFormData({
            name: '',
            type: 'single',
            categoryId: '',
            subCategoryId: '',
            brandId: '',
            unitId: '',
            taxId: '',
            taxType: 'inclusive',
            sku: '',
            barcodeType: 'Code128',
            description: '',
            productDescription: '',
            image: '',
            brochure: '',
            enableStock: true,
            alertQuantity: '',
            purchasePrice: '',
            sellingPrice: '',
            marginPercentage: '',
            weight: '',
            preparationTime: '',
            enableProductInfo: false,
            notForSelling: false,
          })
          setVariations([])
          alert('Product created successfully! Add another.')
        } else {
          router.push('/dashboard/products')
        }
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to create product')
      }
    } catch (error) {
      console.error('Error creating product:', error)
      alert('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const addVariation = () => {
    setVariations([...variations, {
      name: '',
      sku: '',
      purchasePrice: '',
      sellingPrice: '',
      isDefault: variations.length === 0
    }])
  }

  const removeVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index))
  }

  const updateVariation = (index: number, field: keyof Variation, value: string | boolean) => {
    const updated = [...variations]
    updated[index] = { ...updated[index], [field]: value }
    setVariations(updated)
  }

  const addComboItem = () => {
    setComboItems([...comboItems, { productId: '', quantity: '' }])
  }

  const removeComboItem = (index: number) => {
    setComboItems(comboItems.filter((_, i) => i !== index))
  }

  const updateComboItem = (index: number, field: keyof ComboItem, value: string) => {
    const updated = [...comboItems]
    updated[index] = { ...updated[index], [field]: value }
    setComboItems(updated)
  }

  const mainCategories = categories.filter(cat => !cat.parentId)

  // Quick Add handlers
  const handleQuickAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    setQuickAddLoading(true)

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryForm),
      })

      if (response.ok) {
        const data = await response.json()
        setCategories([...categories, data.category])
        setFormData({ ...formData, categoryId: data.category.id.toString() })
        setCategoryForm({ name: '', shortCode: '', description: '' })
        setShowCategoryModal(false)
        alert('Category added successfully')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to add category')
      }
    } catch (error) {
      console.error('Error adding category:', error)
      alert('An error occurred')
    } finally {
      setQuickAddLoading(false)
    }
  }

  const handleQuickAddBrand = async (e: React.FormEvent) => {
    e.preventDefault()
    setQuickAddLoading(true)

    try {
      const response = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandForm),
      })

      if (response.ok) {
        const data = await response.json()
        setBrands([...brands, data.brand])
        setFormData({ ...formData, brandId: data.brand.id.toString() })
        setBrandForm({ name: '', description: '' })
        setShowBrandModal(false)
        alert('Brand added successfully')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to add brand')
      }
    } catch (error) {
      console.error('Error adding brand:', error)
      alert('An error occurred')
    } finally {
      setQuickAddLoading(false)
    }
  }

  const handleQuickAddUnit = async (e: React.FormEvent) => {
    e.preventDefault()
    setQuickAddLoading(true)

    try {
      const response = await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unitForm),
      })

      if (response.ok) {
        const data = await response.json()
        setUnits([...units, data.unit])
        setFormData({ ...formData, unitId: data.unit.id.toString() })
        setUnitForm({ name: '', shortName: '', allowDecimal: false })
        setShowUnitModal(false)
        alert('Unit added successfully')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to add unit')
      }
    } catch (error) {
      console.error('Error adding unit:', error)
      alert('An error occurred')
    } finally {
      setQuickAddLoading(false)
    }
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-6">
        <Link
          href="/dashboard/products"
          className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Products
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Add Product</h1>
      </div>

      <form onSubmit={(e) => handleSubmit(e, 'save')} className="space-y-6">
        {/* Product Type Card */}
        <div className="card-form-dark">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Product Type</h2>
          <div>
            <label className="label-form-dark">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => {
                setFormData({ ...formData, type: e.target.value })
                if (e.target.value === 'variable') {
                  setVariations([{ name: '', sku: '', purchasePrice: '', sellingPrice: '', isDefault: true }])
                  setComboItems([])
                } else if (e.target.value === 'combo') {
                  setComboItems([{ productId: '', quantity: '' }])
                  setVariations([])
                } else {
                  setVariations([])
                  setComboItems([])
                }
              }}
              className="select-form-dark"
            >
              <option value="single">Single</option>
              <option value="variable">Variable</option>
              <option value="combo">Combo</option>
            </select>
          </div>
        </div>

        {/* Product Information Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Product Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Product Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="Enter product name"
              />
            </div>

            {/* SKU */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                SKU
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="Leave empty to auto-generate"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Leave blank to automatically generate SKU</p>
            </div>

            {/* Barcode Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Barcode Type</label>
              <select
                value={formData.barcodeType}
                onChange={(e) => setFormData({ ...formData, barcodeType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              >
                <option value="Code128">Code128</option>
                <option value="Code39">Code39</option>
                <option value="EAN13">EAN13</option>
                <option value="UPC">UPC</option>
              </select>
            </div>

            {/* Category with Quick Add */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SelectBox
                    dataSource={[{ id: '', name: 'None' }, ...mainCategories]}
                    value={formData.categoryId || ''}
                    onValueChanged={(e) => setFormData({ ...formData, categoryId: e.value, subCategoryId: '' })}
                    displayExpr="name"
                    valueExpr="id"
                    searchEnabled={true}
                    searchMode="contains"
                    searchExpr="name"
                    placeholder="Select or search category..."
                    showClearButton={true}
                    className="dx-theme-material-typography"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(true)}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"
                  title="Quick add category"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub Category */}
            {formData.categoryId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sub Category</label>
                <SelectBox
                  dataSource={[{ id: '', name: 'None' }, ...subCategories]}
                  value={formData.subCategoryId || ''}
                  onValueChanged={(e) => setFormData({ ...formData, subCategoryId: e.value })}
                  displayExpr="name"
                  valueExpr="id"
                  searchEnabled={true}
                  searchMode="contains"
                  searchExpr="name"
                  placeholder="Select or search sub-category..."
                  showClearButton={true}
                  className="dx-theme-material-typography"
                />
              </div>
            )}

            {/* Brand with Quick Add */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Brand</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SelectBox
                    dataSource={[{ id: '', name: 'None' }, ...brands]}
                    value={formData.brandId || ''}
                    onValueChanged={(e) => setFormData({ ...formData, brandId: e.value })}
                    displayExpr="name"
                    valueExpr="id"
                    searchEnabled={true}
                    searchMode="contains"
                    searchExpr="name"
                    placeholder="Select or search brand..."
                    showClearButton={true}
                    className="dx-theme-material-typography"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowBrandModal(true)}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"
                  title="Quick add brand"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Unit with Quick Add */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unit <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <select
                  value={formData.unitId}
                  onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                  required
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                >
                  <option value="">Please Select</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.name} ({unit.shortName})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowUnitModal(true)}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"
                  title="Quick add unit"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Product Description WYSIWYG */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Product Description:</label>
              <textarea
                value={formData.productDescription}
                onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                rows={8}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="Enter product description..."
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Plain text description</p>
            </div>

            {/* Product Brochure */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Product Brochure</label>
              <input
                type="text"
                value={formData.brochure}
                onChange={(e) => setFormData({ ...formData, brochure: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="Brochure file path or URL"
              />
            </div>

            {/* Checkboxes */}
            <div className="md:col-span-2 space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.enableProductInfo}
                  onChange={(e) => setFormData({ ...formData, enableProductInfo: e.target.checked })}
                  className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable Product description, IMEI or Serial Number</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.notForSelling}
                  onChange={(e) => {
                    const isNotForSelling = e.target.checked
                    setFormData({
                      ...formData,
                      notForSelling: isNotForSelling,
                      enableStock: isNotForSelling ? false : formData.enableStock
                    })
                  }}
                  className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Not for selling</span>
              </label>
            </div>

            {/* Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Weight (kg)</label>
              <input
                type="number"
                step="0.01"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="0.00"
              />
            </div>

            {/* Service Staff Timer / Preparation Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preparation Time (minutes)</label>
              <input
                type="number"
                value={formData.preparationTime}
                onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="e.g., 15"
              />
            </div>

            {/* Product Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Product image:</label>
              <div className="mt-1">
                <button
                  type="button"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Browse...
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Max File size: 5MB</p>
                <p className="text-xs text-gray-500">Aspect ratio should be 1:1</p>
              </div>
              {formData.image && (
                <div className="mt-2">
                  <img src={formData.image} alt="Product preview" className="w-32 h-32 object-cover rounded-lg border border-gray-300" />
                </div>
              )}
            </div>

            {/* Image URL (temporary fallback) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Or Image URL:</label>
              <input
                type="text"
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>
        </div>

        {/* Tax Information Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Tax Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tax */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Applicable Tax</label>
              <select
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              >
                <option value="">None</option>
                {taxRates.map((tax) => (
                  <option key={tax.id} value={tax.id}>{tax.name} ({tax.amount}%)</option>
                ))}
              </select>
            </div>

            {/* Tax Type */}
            {formData.taxId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selling Price Tax Type</label>
                <select
                  value={formData.taxType}
                  onChange={(e) => setFormData({ ...formData, taxType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                >
                  <option value="inclusive">Inclusive</option>
                  <option value="exclusive">Exclusive</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Card - Only for Single Products */}
        {formData.type === 'single' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Product Pricing</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Exc. Tax Purchase Price <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Margin %</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.marginPercentage}
                  onChange={(e) => setFormData({ ...formData, marginPercentage: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Exc. Tax Selling Price <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        )}

        {/* Variations Section */}
        {formData.type === 'variable' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Product Variations</h2>
              <button
                type="button"
                onClick={addVariation}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
              >
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Variation
              </button>
            </div>

            {/* Variation SKU Format Selection */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                Variation SKU Format
              </label>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="sku-number"
                    name="variationSkuType"
                    value="with_out_variation"
                    checked={variationSkuType === 'with_out_variation'}
                    onChange={(e) => setVariationSkuType(e.target.value as 'with_out_variation' | 'with_variation')}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600"
                  />
                  <label htmlFor="sku-number" className="ml-3 text-sm text-gray-700 dark:text-gray-200">
                    SKU-Number <span className="text-gray-500 dark:text-gray-400">(Example: PROD-001-1, PROD-001-2)</span>
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="sku-variation"
                    name="variationSkuType"
                    value="with_variation"
                    checked={variationSkuType === 'with_variation'}
                    onChange={(e) => setVariationSkuType(e.target.value as 'with_out_variation' | 'with_variation')}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600"
                  />
                  <label htmlFor="sku-variation" className="ml-3 text-sm text-gray-700 dark:text-gray-200">
                    SKUVariation <span className="text-gray-500 dark:text-gray-400">(Example: PROD-001Small, PROD-001Medium)</span>
                  </label>
                </div>
              </div>
            </div>

            {variations.map((variation, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4 bg-gray-50 dark:bg-gray-700">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">Variation {index + 1}</h4>
                  {variations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariation(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Variation Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={variation.name}
                      onChange={(e) => updateVariation(index, 'name', e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      placeholder="e.g., Small, Medium, Large"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Variation SKU
                    </label>
                    <input
                      type="text"
                      value={variation.sku}
                      onChange={(e) => updateVariation(index, 'sku', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      placeholder="Leave empty to auto-generate"
                    />
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Leave blank to auto-generate based on format selection</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Purchase Price <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={variation.purchasePrice}
                      onChange={(e) => updateVariation(index, 'purchasePrice', e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Selling Price <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={variation.sellingPrice}
                      onChange={(e) => updateVariation(index, 'sellingPrice', e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={variation.isDefault}
                        onChange={(e) => updateVariation(index, 'isDefault', e.target.checked)}
                        className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Set as default variation</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Combo Products Section */}
        {formData.type === 'combo' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Combo Products</h2>
              <button
                type="button"
                onClick={addComboItem}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
              >
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Product
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Select products to include in this combo package
            </p>

            {comboItems.map((item, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4 bg-gray-50 dark:bg-gray-700">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">Product {index + 1}</h4>
                  {comboItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeComboItem(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Product <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={item.productId}
                      onChange={(e) => updateComboItem(index, 'productId', e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    >
                      <option value="">Select Product</option>
                      {availableProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateComboItem(index, 'quantity', e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      placeholder="1"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stock Management Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Stock Management</h2>

          {/* Manage Stock Checkbox */}
          <div className="mb-6">
            <label className={`flex items-start ${formData.notForSelling ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="checkbox"
                checked={formData.enableStock}
                disabled={formData.notForSelling}
                onChange={(e) => setFormData({ ...formData, enableStock: e.target.checked })}
                className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Manage Stock?</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 italic">Enable stock management at product level</div>
                {formData.notForSelling && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">Stock management is disabled for "Not for Selling" items (services/charges)</div>
                )}
              </div>
            </label>
          </div>

          {formData.enableStock && (
            <>
              {/* Centralized Product Management Info */}
              <div className="bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-700 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-cyan-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="font-semibold text-cyan-900 dark:text-cyan-100 text-sm mb-1">Centralized Product Management</h4>
                    <p className="text-xs text-cyan-800 dark:text-cyan-200 mb-2">
                      Products are created with zero stock. Each business location can set their initial stock using "Add Opening Stock" after product creation.
                    </p>
                    <p className="text-xs text-cyan-900 dark:text-cyan-100 font-medium">
                      This product will be automatically available to all business locations with zero initial stock.
                    </p>
                  </div>
                </div>
              </div>

              {/* Alert Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Alert Quantity:</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.alertQuantity}
                  onChange={(e) => setFormData({ ...formData, alertQuantity: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="10"
                />
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={(e: any) => handleSubmit(e, 'save-and-add')}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-lg disabled:opacity-50 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            {loading && saveAction === 'save-and-add' ? 'Saving...' : 'Save And Add Another'}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white rounded-lg disabled:opacity-50 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            {loading && saveAction === 'save' ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>

      {/* Quick Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Add Category</h3>
            <form onSubmit={handleQuickAddCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="Enter category name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Short Code</label>
                <input
                  type="text"
                  value={categoryForm.shortCode}
                  onChange={(e) => setCategoryForm({ ...categoryForm, shortCode: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="Optional"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickAddLoading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white rounded-lg disabled:opacity-50 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                >
                  {quickAddLoading ? 'Adding...' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Brand Modal */}
      {showBrandModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Add Brand</h3>
            <form onSubmit={handleQuickAddBrand} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Brand Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={brandForm.name}
                  onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="Enter brand name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea
                  value={brandForm.description}
                  onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="Optional"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBrandModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickAddLoading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white rounded-lg disabled:opacity-50 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                >
                  {quickAddLoading ? 'Adding...' : 'Add Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Unit Modal */}
      {showUnitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Add Unit</h3>
            <form onSubmit={handleQuickAddUnit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Unit Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={unitForm.name}
                  onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="e.g., Pieces, Kilograms"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Short Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={unitForm.shortName}
                  onChange={(e) => setUnitForm({ ...unitForm, shortName: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="e.g., Pcs, Kg"
                />
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={unitForm.allowDecimal}
                    onChange={(e) => setUnitForm({ ...unitForm, allowDecimal: e.target.checked })}
                    className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Allow Decimal</span>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUnitModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickAddLoading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white rounded-lg disabled:opacity-50 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                >
                  {quickAddLoading ? 'Adding...' : 'Add Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
