"use client"

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

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
  id?: number
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

interface ComboProduct {
  childProductId: number
  quantity: number
  childProduct: {
    id: number
    name: string
    sku: string
  }
}

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])

  // Quick Add Modal States
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showSubCategoryModal, setShowSubCategoryModal] = useState(false)
  const [showBrandModal, setShowBrandModal] = useState(false)
  const [showUnitModal, setShowUnitModal] = useState(false)

  // Quick Add Form States
  const [quickAddLoading, setQuickAddLoading] = useState(false)
  const [categoryForm, setCategoryForm] = useState({ name: '', shortCode: '', description: '' })
  const [subCategoryForm, setSubCategoryForm] = useState({ name: '', shortCode: '', description: '' })
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
  }, [productId])

  // Fetch product AFTER categories are loaded
  useEffect(() => {
    if (categories.length > 0) {
      fetchProduct()
    }
  }, [categories, productId])

  useEffect(() => {
    // Filter sub-categories when category changes
    if (formData.categoryId) {
      const subs = categories.filter(cat => cat.parentId === parseInt(formData.categoryId))
      console.log('=== Subcategories Filter Debug ===')
      console.log('Parent category ID:', formData.categoryId)
      console.log('Total categories:', categories.length)
      console.log('Filtered subcategories:', subs.length, subs)
      console.log('==================================')
      setSubCategories(subs)
    } else {
      setSubCategories([])
    }
  }, [formData.categoryId, categories])

  // Auto-calculate selling price from margin
  useEffect(() => {
    if (formData.purchasePrice && formData.marginPercentage) {
      const purchase = parseFloat(formData.purchasePrice)
      const margin = parseFloat(formData.marginPercentage)
      if (!isNaN(purchase) && !isNaN(margin)) {
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
      setUnits(unitsData.units || [])
      setTaxRates(taxRatesData.taxRates || [])
      setAvailableProducts(productsData.products || [])
    } catch (error) {
      console.error('Error fetching metadata:', error)
    }
  }

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/products/${productId}`)
      const data = await response.json()

      if (response.ok) {
        const product = data.product

        // Determine if category is a subcategory
        const category = categories.find(c => c.id === product.categoryId)
        const isSubcategory = category?.parentId !== null

        // DEBUG: Log category loading
        console.log('=== Frontend Category Debug (Loading) ===')
        console.log('product.categoryId:', product.categoryId)
        console.log('category found:', category)
        console.log('isSubcategory:', isSubcategory)
        console.log('Will set categoryId to:', isSubcategory ? String(category?.parentId || '') : String(product.categoryId || ''))
        console.log('Will set subCategoryId to:', isSubcategory ? String(product.categoryId || '') : '')
        console.log('=======================================')

        setFormData({
          name: product.name || '',
          type: product.type || 'single',
          categoryId: isSubcategory ? String(category?.parentId || '') : String(product.categoryId || ''),
          subCategoryId: isSubcategory ? String(product.categoryId || '') : '',
          brandId: String(product.brandId || ''),
          unitId: String(product.unitId || ''),
          taxId: String(product.taxId || ''),
          taxType: product.taxType || 'inclusive',
          sku: product.sku || '',
          barcodeType: product.barcodeType || 'Code128',
          description: product.description || '',
          productDescription: product.productDescription || '',
          image: product.image || '',
          brochure: product.brochure || '',
          enableStock: product.enableStock ?? true,
          alertQuantity: product.alertQuantity ? String(product.alertQuantity) : '',
          purchasePrice: product.purchasePrice ? String(product.purchasePrice) : '',
          sellingPrice: product.sellingPrice ? String(product.sellingPrice) : '',
          marginPercentage: product.marginPercentage ? String(product.marginPercentage) : '',
          weight: product.weight ? String(product.weight) : '',
          preparationTime: product.preparationTime ? String(product.preparationTime) : '',
          enableProductInfo: product.enableProductInfo || false,
          notForSelling: product.notForSelling || false,
        })

        // Load variations if variable product
        if (product.type === 'variable' && product.variations) {
          setVariations(product.variations.map((v: any) => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            purchasePrice: String(v.purchasePrice),
            sellingPrice: String(v.sellingPrice),
            isDefault: v.isDefault
          })))
        }

        // Load combo items if combo product
        if (product.type === 'combo' && product.comboProducts) {
          setComboItems(product.comboProducts.map((cp: ComboProduct) => ({
            productId: String(cp.childProductId),
            quantity: String(cp.quantity)
          })))
        }
      } else {
        alert(data.error || 'Failed to fetch product')
        router.push('/dashboard/products')
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      alert('An error occurred while loading the product')
    } finally {
      setFetchLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate pricing for single products
      if (formData.type === 'single') {
        const cost = parseFloat(formData.purchasePrice) || 0
        const price = parseFloat(formData.sellingPrice) || 0

        if (cost <= 0) {
          alert('Purchase price (cost) must be greater than zero')
          setLoading(false)
          return
        }

        if (price <= 0) {
          alert('Selling price must be greater than zero')
          setLoading(false)
          return
        }

        if (price < cost) {
          alert('Selling price cannot be lower than purchase price (cost)')
          setLoading(false)
          return
        }
      }

      // Validate pricing for variable products
      if (formData.type === 'variable') {
        for (let i = 0; i < variations.length; i++) {
          const variation = variations[i]
          const cost = parseFloat(variation.purchasePrice) || 0
          const price = parseFloat(variation.sellingPrice) || 0

          if (!variation.name) {
            alert(`Variation ${i + 1}: Name is required`)
            setLoading(false)
            return
          }

          if (cost <= 0) {
            alert(`Variation "${variation.name}": Purchase price must be greater than zero`)
            setLoading(false)
            return
          }

          if (price <= 0) {
            alert(`Variation "${variation.name}": Selling price must be greater than zero`)
            setLoading(false)
            return
          }

          if (price < cost) {
            alert(`Variation "${variation.name}": Selling price cannot be lower than purchase price`)
            setLoading(false)
            return
          }
        }
      }

      const payload = {
        ...formData,
        variations: formData.type === 'variable' ? variations : undefined,
        variationSkuType: formData.type === 'variable' ? variationSkuType : undefined,
        comboItems: formData.type === 'combo' ? comboItems : undefined
      }

      // DEBUG: Log what we're sending
      console.log('=== Frontend Category Debug (Saving) ===')
      console.log('formData.categoryId:', formData.categoryId, 'type:', typeof formData.categoryId)
      console.log('formData.subCategoryId:', formData.subCategoryId, 'type:', typeof formData.subCategoryId)
      console.log('Full payload:', payload)
      console.log('========================================')

      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        alert('Product updated successfully!')
        router.push('/dashboard/products')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to update product')
      }
    } catch (error) {
      console.error('Error updating product:', error)
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

        // Update categories using functional form
        setCategories(prev => [...prev, data.category])

        // Update formData using functional form
        setFormData(prev => ({ ...prev, categoryId: data.category.id.toString(), subCategoryId: '' }))

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

  const handleQuickAddSubCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    setQuickAddLoading(true)

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...subCategoryForm,
          parentId: parseInt(formData.categoryId) // Set parent to current category
        }),
      })

      if (response.ok) {
        const data = await response.json()

        // Update categories array with new subcategory
        setCategories(prev => [...prev, data.category])

        // Update formData using functional form to avoid stale closure
        setFormData(prev => ({ ...prev, subCategoryId: data.category.id.toString() }))

        // Clear form and close modal
        setSubCategoryForm({ name: '', shortCode: '', description: '' })
        setShowSubCategoryModal(false)

        alert('Subcategory added successfully')

        // Log for debugging
        console.log('Subcategory added:', data.category)
        console.log('Parent category ID:', formData.categoryId)
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to add subcategory')
      }
    } catch (error) {
      console.error('Error adding subcategory:', error)
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

  if (fetchLoading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="text-center py-12">Loading product...</div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <Link
          href="/dashboard/products"
          className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800 mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Products
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Edit Product</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Type Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Type</h2>

          {/* Warning message about type change */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h4 className="font-semibold text-amber-900 text-sm mb-1">Product Type Cannot Be Changed</h4>
                <p className="text-xs text-amber-800">
                  Changing product type after creation would corrupt inventory records, stock history, and transaction data across all business locations.
                </p>
                <p className="text-xs text-amber-900 font-medium mt-2">
                  To use a different type: Mark this product as inactive and create a new product with the desired type.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.type}
              disabled={true}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
              title="Product type cannot be changed after creation to prevent data corruption"
            >
              <option value="single">Single</option>
              <option value="variable">Variable</option>
              <option value="combo">Combo</option>
            </select>
            <p className="mt-2 text-xs text-gray-500">
              <strong>Current type:</strong> {formData.type.charAt(0).toUpperCase() + formData.type.slice(1)} (locked to preserve data integrity)
            </p>
          </div>
        </div>

        {/* Product Information Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Product Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                placeholder="Enter product name"
              />
            </div>

            {/* SKU */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SKU
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                placeholder="Leave empty to auto-generate"
              />
              <p className="mt-1 text-sm text-gray-500">Leave blank to automatically generate SKU</p>
            </div>

            {/* Barcode Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Barcode Type</label>
              <select
                value={formData.barcodeType}
                onChange={(e) => setFormData({ ...formData, barcodeType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
              >
                <option value="Code128">Code128</option>
                <option value="Code39">Code39</option>
                <option value="EAN13">EAN13</option>
                <option value="UPC">UPC</option>
              </select>
            </div>

            {/* Category with Quick Add */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <div className="flex gap-2">
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subCategoryId: '' })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                >
                  <option value="">None</option>
                  {mainCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
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

            {/* Sub Category with Quick Add */}
            {formData.categoryId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sub Category</label>
                <div className="flex gap-2">
                  <select
                    value={formData.subCategoryId}
                    onChange={(e) => setFormData({ ...formData, subCategoryId: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  >
                    <option value="">None</option>
                    {subCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowSubCategoryModal(true)}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"
                    title="Quick add subcategory"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Brand with Quick Add */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
              <div className="flex gap-2">
                <select
                  value={formData.brandId}
                  onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                >
                  <option value="">None</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Unit <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <select
                  value={formData.unitId}
                  onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                  required
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Description:</label>
              <textarea
                value={formData.productDescription}
                onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                rows={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                placeholder="Enter product description..."
              />
              <p className="text-xs text-gray-500 mt-1">Plain text description</p>
            </div>

            {/* Product Brochure */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Brochure</label>
              <input
                type="text"
                value={formData.brochure}
                onChange={(e) => setFormData({ ...formData, brochure: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
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
                <span className="text-sm text-gray-700">Enable Product description, IMEI or Serial Number</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.notForSelling}
                  onChange={(e) => setFormData({ ...formData, notForSelling: e.target.checked })}
                  className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Not for selling</span>
              </label>
            </div>

            {/* Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Weight (kg)</label>
              <input
                type="number"
                step="0.01"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                placeholder="0.00"
              />
            </div>

            {/* Service Staff Timer / Preparation Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Preparation Time (minutes)</label>
              <input
                type="number"
                value={formData.preparationTime}
                onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                placeholder="e.g., 15"
              />
            </div>

            {/* Product Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Product image:</label>
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
                <p className="text-xs text-gray-500 mt-1">Max File size: 5MB</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Or Image URL:</label>
              <input
                type="text"
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>
        </div>

        {/* Tax Information Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tax Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tax */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Applicable Tax</label>
              <select
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Selling Price Tax Type</label>
                <select
                  value={formData.taxType}
                  onChange={(e) => setFormData({ ...formData, taxType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
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
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Pricing</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exc. Tax Purchase Price <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  placeholder="0.00"
                  required
                />
                {parseFloat(formData.purchasePrice || '0') <= 0 && formData.purchasePrice && (
                  <p className="mt-1 text-sm text-red-600">Purchase price must be greater than zero</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Margin %</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.marginPercentage}
                  onChange={(e) => setFormData({ ...formData, marginPercentage: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exc. Tax Selling Price <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 text-gray-900 bg-white ${
                    parseFloat(formData.sellingPrice || '0') < parseFloat(formData.purchasePrice || '0') && formData.sellingPrice
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-indigo-500'
                  }`}
                  placeholder="0.00"
                  required
                />
                {parseFloat(formData.sellingPrice || '0') <= 0 && formData.sellingPrice && (
                  <p className="mt-1 text-sm text-red-600">Selling price must be greater than zero</p>
                )}
                {parseFloat(formData.sellingPrice || '0') < parseFloat(formData.purchasePrice || '0') &&
                 parseFloat(formData.sellingPrice || '0') > 0 && (
                  <p className="mt-1 text-sm text-red-600 font-semibold">⚠️ Warning: Selling price is lower than purchase price!</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Variations Section */}
        {formData.type === 'variable' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Product Variations</h2>
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
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-3">
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
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label htmlFor="sku-number" className="ml-3 text-sm text-gray-700">
                    SKU-Number <span className="text-gray-500">(Example: PROD-001-1, PROD-001-2)</span>
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
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label htmlFor="sku-variation" className="ml-3 text-sm text-gray-700">
                    SKUVariation <span className="text-gray-500">(Example: PROD-001Small, PROD-001Medium)</span>
                  </label>
                </div>
              </div>
            </div>

            {variations.map((variation, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-gray-900">Variation {index + 1}</h4>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Variation Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={variation.name}
                      onChange={(e) => updateVariation(index, 'name', e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                      placeholder="e.g., Small, Medium, Large"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Variation SKU
                    </label>
                    <input
                      type="text"
                      value={variation.sku}
                      onChange={(e) => updateVariation(index, 'sku', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                      placeholder="Leave empty to auto-generate"
                    />
                    <p className="mt-1 text-sm text-gray-500">Leave blank to auto-generate based on format selection</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Purchase Price <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={variation.purchasePrice}
                      onChange={(e) => updateVariation(index, 'purchasePrice', e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                      placeholder="0.00"
                    />
                    {parseFloat(variation.purchasePrice || '0') <= 0 && variation.purchasePrice && (
                      <p className="mt-1 text-sm text-red-600">Purchase price must be greater than zero</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selling Price <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={variation.sellingPrice}
                      onChange={(e) => updateVariation(index, 'sellingPrice', e.target.value)}
                      required
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 text-gray-900 bg-white ${
                        parseFloat(variation.sellingPrice || '0') < parseFloat(variation.purchasePrice || '0') && variation.sellingPrice
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-indigo-500'
                      }`}
                      placeholder="0.00"
                    />
                    {parseFloat(variation.sellingPrice || '0') <= 0 && variation.sellingPrice && (
                      <p className="mt-1 text-sm text-red-600">Selling price must be greater than zero</p>
                    )}
                    {parseFloat(variation.sellingPrice || '0') < parseFloat(variation.purchasePrice || '0') &&
                     parseFloat(variation.sellingPrice || '0') > 0 && (
                      <p className="mt-1 text-sm text-red-600 font-semibold">⚠️ Warning: Selling price is lower than purchase price!</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={variation.isDefault}
                        onChange={(e) => updateVariation(index, 'isDefault', e.target.checked)}
                        className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">Set as default variation</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Combo Products Section */}
        {formData.type === 'combo' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Combo Products</h2>
              <button
                type="button"
                onClick={addComboItem}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
              >
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Product
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Select products to include in this combo package
            </p>

            {comboItems.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-gray-900">Product {index + 1}</h4>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={item.productId}
                      onChange={(e) => updateComboItem(index, 'productId', e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                    >
                      <option value="">Select Product</option>
                      {availableProducts.filter(p => p.id !== parseInt(productId)).map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateComboItem(index, 'quantity', e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                      placeholder="1"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stock Management Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Stock Management</h2>

          {/* Manage Stock Checkbox */}
          <div className="mb-6">
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={formData.enableStock}
                onChange={(e) => setFormData({ ...formData, enableStock: e.target.checked })}
                className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mt-1"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">Manage Stock?</div>
                <div className="text-xs text-gray-500 italic">Enable stock management at product level</div>
              </div>
            </label>
          </div>

          {formData.enableStock && (
            <>
              {/* Centralized Product Management Info */}
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-cyan-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="font-semibold text-cyan-900 text-sm mb-1">Centralized Product Management</h4>
                    <p className="text-xs text-cyan-800 mb-2">
                      Products are managed centrally. Each business location maintains their own stock levels.
                    </p>
                    <p className="text-xs text-cyan-900 font-medium">
                      Stock levels are location-specific and can be adjusted via opening stock or stock adjustments.
                    </p>
                  </div>
                </div>
              </div>

              {/* Alert Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Alert Quantity:</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.alertQuantity}
                  onChange={(e) => setFormData({ ...formData, alertQuantity: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
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
            onClick={() => router.push('/dashboard/products')}
            className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'Updating...' : 'Update Product'}
          </button>
        </div>
      </form>

      {/* Quick Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Add Category</h3>
            <form onSubmit={handleQuickAddCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  placeholder="Enter category name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Short Code</label>
                <input
                  type="text"
                  value={categoryForm.shortCode}
                  onChange={(e) => setCategoryForm({ ...categoryForm, shortCode: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  placeholder="Optional"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickAddLoading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {quickAddLoading ? 'Adding...' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add SubCategory Modal */}
      {showSubCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Add Subcategory</h3>
            <form onSubmit={handleQuickAddSubCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subcategory Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={subCategoryForm.name}
                  onChange={(e) => setSubCategoryForm({ ...subCategoryForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  placeholder="Enter subcategory name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Short Code</label>
                <input
                  type="text"
                  value={subCategoryForm.shortCode}
                  onChange={(e) => setSubCategoryForm({ ...subCategoryForm, shortCode: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={subCategoryForm.description}
                  onChange={(e) => setSubCategoryForm({ ...subCategoryForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  placeholder="Optional"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  This subcategory will be added under: <strong>{mainCategories.find(c => c.id === parseInt(formData.categoryId))?.name}</strong>
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSubCategoryModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickAddLoading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {quickAddLoading ? 'Adding...' : 'Add Subcategory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Brand Modal */}
      {showBrandModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Add Brand</h3>
            <form onSubmit={handleQuickAddBrand} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={brandForm.name}
                  onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  placeholder="Enter brand name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={brandForm.description}
                  onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  placeholder="Optional"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBrandModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickAddLoading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Add Unit</h3>
            <form onSubmit={handleQuickAddUnit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={unitForm.name}
                  onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  placeholder="e.g., Pieces, Kilograms"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Short Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={unitForm.shortName}
                  onChange={(e) => setUnitForm({ ...unitForm, shortName: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
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
                  <span className="text-sm text-gray-700">Allow Decimal</span>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUnitModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickAddLoading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
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
