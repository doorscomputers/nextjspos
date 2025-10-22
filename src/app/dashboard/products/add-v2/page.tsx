"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import Form, {
  SimpleItem,
  GroupItem,
  TabbedItem,
  Tab,
  Label,
  RequiredRule,
  NumericRule,
  PatternRule,
  CompareRule,
  RangeRule,
  EmailRule,
  ButtonItem,
  ButtonOptions
} from 'devextreme-react/form'
import { Button as DxButton } from 'devextreme-react/button'
import SelectBox from 'devextreme-react/select-box'
import NumberBox from 'devextreme-react/number-box'
import TextBox from 'devextreme-react/text-box'
import TextArea from 'devextreme-react/text-area'
import CheckBox from 'devextreme-react/check-box'
import TagBox from 'devextreme-react/tag-box'
import FileUploader from 'devextreme-react/file-uploader'
import DataGrid, {
  Column,
  Editing,
  Button as GridButton
} from 'devextreme-react/data-grid'
import { LoadPanel } from 'devextreme-react/load-panel'

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
  purchasePrice: number
  sellingPrice: number
  isDefault: boolean
  unitId?: number
}

interface ComboItem {
  productId: number
  quantity: number
}

interface Product {
  id?: number
  name: string
  type: 'single' | 'variable' | 'combo'
  categoryId: number | null
  subCategoryId: number | null
  brandId: number | null
  unitId: number | null
  taxId: number | null
  taxType: 'inclusive' | 'exclusive'
  sku: string
  barcodeType: string
  description: string
  productDescription: string
  image: string
  brochure: string
  enableStock: boolean
  alertQuantity: number | null
  purchasePrice: number | null
  sellingPrice: number | null
  marginPercentage: number | null
  weight: number | null
  preparationTime: number | null
  enableProductInfo: boolean
  notForSelling: boolean
  isActive: boolean
}

export default function AddProductV2Page() {
  const router = useRouter()
  const { can } = usePermissions()
  const formRef = useRef<Form>(null)

  // Check permissions
  if (!can(PERMISSIONS.PRODUCT_CREATE)) {
    router.push('/dashboard/products')
    return null
  }

  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)

  // Dropdown data
  const [categories, setCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  const [availableProducts, setAvailableProducts] = useState<any[]>([])

  // Form data
  const [formData, setFormData] = useState<Product>({
    name: '',
    type: 'single',
    categoryId: null,
    subCategoryId: null,
    brandId: null,
    unitId: null,
    taxId: null,
    taxType: 'inclusive',
    sku: '',
    barcodeType: 'Code128',
    description: '',
    productDescription: '',
    image: '',
    brochure: '',
    enableStock: true,
    alertQuantity: null,
    purchasePrice: null,
    sellingPrice: null,
    marginPercentage: null,
    weight: null,
    preparationTime: null,
    enableProductInfo: false,
    notForSelling: false,
    isActive: true
  })

  const [variations, setVariations] = useState<Variation[]>([])
  const [variationSkuType, setVariationSkuType] = useState<'with_out_variation' | 'with_variation'>('with_out_variation')
  const [comboItems, setComboItems] = useState<ComboItem[]>([])
  const [imagePreview, setImagePreview] = useState<string>('')

  useEffect(() => {
    fetchMetadata()
  }, [])

  // Filter subcategories when category changes
  useEffect(() => {
    if (formData.categoryId) {
      const subs = categories.filter(cat => cat.parentId === formData.categoryId)
      setSubCategories(subs)
    } else {
      setSubCategories([])
      setFormData(prev => ({ ...prev, subCategoryId: null }))
    }
  }, [formData.categoryId, categories])

  // Auto-calculate selling price from margin
  useEffect(() => {
    if (formData.purchasePrice && formData.marginPercentage) {
      const purchase = formData.purchasePrice
      const margin = formData.marginPercentage
      const selling = purchase + (purchase * margin / 100)
      setFormData(prev => ({ ...prev, sellingPrice: parseFloat(selling.toFixed(2)) }))
    }
  }, [formData.purchasePrice, formData.marginPercentage])

  const fetchMetadata = async () => {
    try {
      setPageLoading(true)
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
      const fetchedTaxRates = taxRatesData.taxRates || []
      setTaxRates(fetchedTaxRates)
      setAvailableProducts(productsData.products || [])

      // Set default tax to "Standard VAT (12%)" if available
      const standardVAT = fetchedTaxRates.find((tax: TaxRate) =>
        tax.name === 'Standard VAT (12%)' || (tax.name.includes('Standard VAT') && tax.amount === 12)
      )
      if (standardVAT) {
        setFormData(prev => ({ ...prev, taxId: standardVAT.id }))
      }
    } catch (error) {
      console.error('Error fetching metadata:', error)
      toast.error('Failed to load form data')
    } finally {
      setPageLoading(false)
    }
  }

  const handleSubmit = async (saveAction: 'save' | 'save-and-add' | 'save-and-stock' = 'save') => {
    const formInstance = formRef.current?.instance
    const validationResult = formInstance?.validate()

    if (!validationResult?.isValid) {
      toast.error('Please fill in all required fields correctly')
      return
    }

    // Additional validation for product type
    if (formData.type === 'variable' && variations.length === 0) {
      toast.error('Variable products must have at least one variation')
      return
    }

    if (formData.type === 'combo' && comboItems.length === 0) {
      toast.error('Combo products must have at least one item')
      return
    }

    setLoading(true)

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

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Product created successfully')

        if (saveAction === 'save-and-stock') {
          router.push(`/dashboard/products/${data.product.id}/opening-stock`)
        } else if (saveAction === 'save-and-add') {
          // Reset form for new product
          formInstance?.resetValues()
          setFormData({
            name: '',
            type: 'single',
            categoryId: null,
            subCategoryId: null,
            brandId: null,
            unitId: null,
            taxId: formData.taxId, // Keep the same tax
            taxType: 'inclusive',
            sku: '',
            barcodeType: 'Code128',
            description: '',
            productDescription: '',
            image: '',
            brochure: '',
            enableStock: true,
            alertQuantity: null,
            purchasePrice: null,
            sellingPrice: null,
            marginPercentage: null,
            weight: null,
            preparationTime: null,
            enableProductInfo: false,
            notForSelling: false,
            isActive: true
          })
          setVariations([])
          setComboItems([])
          setImagePreview('')
          toast.info('Ready to add another product')
        } else {
          router.push('/dashboard/products')
        }
      } else {
        toast.error(data.error || 'Failed to create product')
      }
    } catch (error) {
      console.error('Error creating product:', error)
      toast.error('Failed to create product')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = (e: any) => {
    const file = e.value[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setFormData(prev => ({ ...prev, image: base64String }))
        setImagePreview(base64String)
      }
      reader.readAsDataURL(file)
    }
  }

  const productTypes = [
    { id: 'single', name: 'Single' },
    { id: 'variable', name: 'Variable' },
    { id: 'combo', name: 'Combo' }
  ]

  const barcodeTypes = [
    { id: 'Code128', name: 'Code128' },
    { id: 'Code39', name: 'Code39' },
    { id: 'EAN13', name: 'EAN13' },
    { id: 'EAN8', name: 'EAN8' },
    { id: 'UPC', name: 'UPC' }
  ]

  const taxTypes = [
    { id: 'inclusive', name: 'Inclusive' },
    { id: 'exclusive', name: 'Exclusive' }
  ]

  // Get parent categories only
  const parentCategories = categories.filter(cat => cat.parentId === null)

  const handleAddVariation = () => {
    setVariations([...variations, {
      name: '',
      sku: '',
      purchasePrice: 0,
      sellingPrice: 0,
      isDefault: variations.length === 0,
      unitId: formData.unitId || undefined
    }])
  }

  const handleRemoveVariation = (index: number) => {
    const newVariations = variations.filter((_, i) => i !== index)
    setVariations(newVariations)
  }

  const handleAddComboItem = () => {
    setComboItems([...comboItems, {
      productId: 0,
      quantity: 1
    }])
  }

  const handleRemoveComboItem = (index: number) => {
    const newItems = comboItems.filter((_, i) => i !== index)
    setComboItems(newItems)
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <LoadPanel
          visible={true}
          message="Loading form..."
          position={{ of: '.content' }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard/products">
            <button className="flex items-center justify-center w-10 h-10 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
              <ArrowLeftIcon className="w-5 h-5 text-slate-600 dark:text-gray-300" />
            </button>
          </Link>
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 dark:from-gray-100 dark:via-blue-300 dark:to-gray-100 bg-clip-text text-transparent">
              Add Product V2
            </h1>
            <p className="text-slate-600 dark:text-gray-300 text-sm sm:text-base">Create a new product using DevExtreme forms</p>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-slate-200 dark:border-gray-700 p-6">
        <Form
          ref={formRef}
          formData={formData}
          labelLocation="top"
          showColonAfterLabel={false}
          onFieldDataChanged={(e) => {
            if (e.dataField) {
              setFormData(prev => ({ ...prev, [e.dataField!]: e.value }))
            }
          }}
        >
          <TabbedItem>
            {/* Basic Information Tab */}
            <Tab title="Basic Information">
              <GroupItem colCount={2}>
                <SimpleItem dataField="name" editorType="dxTextBox">
                  <Label text="Product Name" />
                  <RequiredRule message="Product name is required" />
                </SimpleItem>

                <SimpleItem dataField="type" editorType="dxSelectBox" editorOptions={{
                  items: productTypes,
                  displayExpr: 'name',
                  valueExpr: 'id',
                  searchEnabled: false
                }}>
                  <Label text="Product Type" />
                  <RequiredRule message="Product type is required" />
                </SimpleItem>

                <SimpleItem dataField="sku" editorType="dxTextBox" editorOptions={{
                  placeholder: 'Leave empty for auto-generation'
                }}>
                  <Label text="SKU (Stock Keeping Unit)" />
                </SimpleItem>

                <SimpleItem dataField="barcodeType" editorType="dxSelectBox" editorOptions={{
                  items: barcodeTypes,
                  displayExpr: 'name',
                  valueExpr: 'id',
                  searchEnabled: false
                }}>
                  <Label text="Barcode Type" />
                </SimpleItem>

                <SimpleItem dataField="categoryId" editorType="dxSelectBox" editorOptions={{
                  items: parentCategories,
                  displayExpr: 'name',
                  valueExpr: 'id',
                  searchEnabled: true,
                  placeholder: 'Select category',
                  showClearButton: true
                }}>
                  <Label text="Category" />
                </SimpleItem>

                <SimpleItem dataField="subCategoryId" editorType="dxSelectBox" editorOptions={{
                  items: subCategories,
                  displayExpr: 'name',
                  valueExpr: 'id',
                  searchEnabled: true,
                  placeholder: 'Select sub-category',
                  showClearButton: true,
                  disabled: !formData.categoryId || subCategories.length === 0
                }}>
                  <Label text="Sub-Category" />
                </SimpleItem>

                <SimpleItem dataField="brandId" editorType="dxSelectBox" editorOptions={{
                  items: brands,
                  displayExpr: 'name',
                  valueExpr: 'id',
                  searchEnabled: true,
                  placeholder: 'Select brand',
                  showClearButton: true
                }}>
                  <Label text="Brand" />
                </SimpleItem>

                <SimpleItem dataField="unitId" editorType="dxSelectBox" editorOptions={{
                  items: units,
                  displayExpr: (item: Unit) => item ? `${item.name} (${item.shortName})` : '',
                  valueExpr: 'id',
                  searchEnabled: true,
                  placeholder: 'Select unit',
                  showClearButton: true
                }}>
                  <Label text="Unit of Measure" />
                </SimpleItem>
              </GroupItem>

              <GroupItem colCount={1}>
                <SimpleItem dataField="description" editorType="dxTextArea" editorOptions={{
                  height: 80,
                  placeholder: 'Short description for internal use'
                }}>
                  <Label text="Description" />
                </SimpleItem>

                <SimpleItem dataField="productDescription" editorType="dxTextArea" editorOptions={{
                  height: 100,
                  placeholder: 'Detailed product description for customers'
                }}>
                  <Label text="Product Description (Customer-facing)" />
                </SimpleItem>
              </GroupItem>
            </Tab>

            {/* Pricing Tab */}
            <Tab title="Pricing & Tax">
              <GroupItem colCount={2} visible={formData.type === 'single'}>
                <SimpleItem dataField="purchasePrice" editorType="dxNumberBox" editorOptions={{
                  format: '#,##0.00',
                  min: 0,
                  placeholder: 'Enter purchase price'
                }}>
                  <Label text="Purchase Price (Cost)" />
                  <RequiredRule message="Purchase price is required for single products" />
                  <NumericRule message="Must be a valid number" />
                  <RangeRule min={0.01} message="Must be greater than zero" />
                </SimpleItem>

                <SimpleItem dataField="marginPercentage" editorType="dxNumberBox" editorOptions={{
                  format: '#,##0.00',
                  min: 0,
                  placeholder: 'Enter margin %'
                }}>
                  <Label text="Margin Percentage (%)" />
                  <NumericRule message="Must be a valid number" />
                  <RangeRule min={0} message="Must be zero or greater" />
                </SimpleItem>

                <SimpleItem dataField="sellingPrice" editorType="dxNumberBox" editorOptions={{
                  format: '#,##0.00',
                  min: 0,
                  placeholder: 'Enter selling price'
                }}>
                  <Label text="Selling Price" />
                  <RequiredRule message="Selling price is required for single products" />
                  <NumericRule message="Must be a valid number" />
                  <RangeRule min={0.01} message="Must be greater than zero" />
                </SimpleItem>

                <SimpleItem dataField="weight" editorType="dxNumberBox" editorOptions={{
                  format: '#,##0.000',
                  min: 0,
                  placeholder: 'Enter weight'
                }}>
                  <Label text="Weight (optional)" />
                  <NumericRule message="Must be a valid number" />
                </SimpleItem>
              </GroupItem>

              <GroupItem colCount={2}>
                <SimpleItem dataField="taxId" editorType="dxSelectBox" editorOptions={{
                  items: taxRates,
                  displayExpr: (item: TaxRate) => item ? `${item.name} (${item.amount}%)` : '',
                  valueExpr: 'id',
                  searchEnabled: true,
                  placeholder: 'Select tax rate',
                  showClearButton: true
                }}>
                  <Label text="Tax Rate" />
                </SimpleItem>

                <SimpleItem dataField="taxType" editorType="dxSelectBox" editorOptions={{
                  items: taxTypes,
                  displayExpr: 'name',
                  valueExpr: 'id',
                  searchEnabled: false
                }}>
                  <Label text="Tax Type" />
                </SimpleItem>
              </GroupItem>

              {/* Variations Grid for Variable Products */}
              {formData.type === 'variable' && (
                <GroupItem colCount={1}>
                  <SimpleItem>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label text="Product Variations" />
                        <button
                          type="button"
                          onClick={handleAddVariation}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Add Variation
                        </button>
                      </div>

                      <DataGrid
                        dataSource={variations}
                        showBorders={true}
                        columnAutoWidth={true}
                        onRowRemoving={(e) => {
                          const index = variations.indexOf(e.data)
                          handleRemoveVariation(index)
                          e.cancel = true
                        }}
                      >
                        <Editing mode="cell" allowUpdating={true} allowDeleting={true} />
                        <Column dataField="name" caption="Variation Name">
                          <RequiredRule />
                        </Column>
                        <Column dataField="sku" caption="SKU (optional)" />
                        <Column dataField="purchasePrice" caption="Purchase Price" dataType="number" format="#,##0.00">
                          <RequiredRule />
                        </Column>
                        <Column dataField="sellingPrice" caption="Selling Price" dataType="number" format="#,##0.00">
                          <RequiredRule />
                        </Column>
                        <Column dataField="isDefault" caption="Default" dataType="boolean" />
                        <Column type="buttons">
                          <GridButton name="delete" />
                        </Column>
                      </DataGrid>
                    </div>
                  </SimpleItem>
                </GroupItem>
              )}

              {/* Combo Items Grid for Combo Products */}
              {formData.type === 'combo' && (
                <GroupItem colCount={1}>
                  <SimpleItem>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label text="Combo Items" />
                        <button
                          type="button"
                          onClick={handleAddComboItem}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Add Item
                        </button>
                      </div>

                      <DataGrid
                        dataSource={comboItems}
                        showBorders={true}
                        columnAutoWidth={true}
                        onRowRemoving={(e) => {
                          const index = comboItems.indexOf(e.data)
                          handleRemoveComboItem(index)
                          e.cancel = true
                        }}
                      >
                        <Editing mode="cell" allowUpdating={true} allowDeleting={true} />
                        <Column dataField="productId" caption="Product">
                          <RequiredRule />
                        </Column>
                        <Column dataField="quantity" caption="Quantity" dataType="number">
                          <RequiredRule />
                        </Column>
                        <Column type="buttons">
                          <GridButton name="delete" />
                        </Column>
                      </DataGrid>
                    </div>
                  </SimpleItem>
                </GroupItem>
              )}
            </Tab>

            {/* Inventory Tab */}
            <Tab title="Inventory">
              <GroupItem colCount={1}>
                <SimpleItem dataField="enableStock" editorType="dxCheckBox" editorOptions={{
                  text: 'Enable stock management for this product'
                }}>
                  <Label text="Stock Management" />
                </SimpleItem>
              </GroupItem>

              <GroupItem colCount={2} visible={formData.enableStock}>
                <SimpleItem dataField="alertQuantity" editorType="dxNumberBox" editorOptions={{
                  format: '#,##0',
                  min: 0,
                  placeholder: 'Enter alert quantity'
                }}>
                  <Label text="Alert Quantity (Low Stock Warning)" />
                  <NumericRule message="Must be a valid number" />
                </SimpleItem>

                <SimpleItem>
                  <div className="text-sm text-slate-600 dark:text-gray-400 p-4 bg-blue-50 dark:bg-gray-700 rounded-lg">
                    <strong>Note:</strong> Initial stock quantities will be set on the next page after saving the product.
                  </div>
                </SimpleItem>
              </GroupItem>
            </Tab>

            {/* Advanced Settings Tab */}
            <Tab title="Advanced">
              <GroupItem colCount={2}>
                <SimpleItem dataField="preparationTime" editorType="dxNumberBox" editorOptions={{
                  format: '#,##0',
                  min: 0,
                  placeholder: 'Enter time in minutes'
                }}>
                  <Label text="Preparation Time (minutes)" />
                  <NumericRule message="Must be a valid number" />
                </SimpleItem>

                <SimpleItem dataField="isActive" editorType="dxCheckBox" editorOptions={{
                  text: 'Product is active and available for sale'
                }}>
                  <Label text="Active Status" />
                </SimpleItem>

                <SimpleItem dataField="enableProductInfo" editorType="dxCheckBox" editorOptions={{
                  text: 'Track IMEI/Serial numbers for this product'
                }}>
                  <Label text="IMEI/Serial Tracking" />
                </SimpleItem>

                <SimpleItem dataField="notForSelling" editorType="dxCheckBox" editorOptions={{
                  text: 'Exclude this product from selling (stock/inventory only)'
                }}>
                  <Label text="Not for Selling" />
                </SimpleItem>
              </GroupItem>

              {/* Image Upload */}
              <GroupItem colCount={1}>
                <SimpleItem>
                  <div className="space-y-2">
                    <Label text="Product Image" />
                    <FileUploader
                      selectButtonText="Select Image"
                      labelText="or drag image here"
                      accept="image/*"
                      uploadMode="useForm"
                      onValueChanged={handleImageUpload}
                      multiple={false}
                    />
                    {imagePreview && (
                      <div className="mt-4">
                        <p className="text-sm text-slate-600 dark:text-gray-400 mb-2">Preview:</p>
                        <img
                          src={imagePreview}
                          alt="Product preview"
                          className="max-w-xs h-48 object-cover rounded-lg border border-slate-200 dark:border-gray-700"
                        />
                      </div>
                    )}
                  </div>
                </SimpleItem>
              </GroupItem>
            </Tab>
          </TabbedItem>

          {/* Form Actions */}
          <GroupItem colCount={4} cssClass="mt-6">
            <ButtonItem>
              <ButtonOptions
                text="Save & Close"
                type="success"
                useSubmitBehavior={false}
                onClick={() => handleSubmit('save')}
                disabled={loading}
              />
            </ButtonItem>

            <ButtonItem>
              <ButtonOptions
                text="Save & Add Another"
                type="default"
                useSubmitBehavior={false}
                onClick={() => handleSubmit('save-and-add')}
                disabled={loading}
              />
            </ButtonItem>

            <ButtonItem>
              <ButtonOptions
                text="Save & Add Opening Stock"
                type="default"
                useSubmitBehavior={false}
                onClick={() => handleSubmit('save-and-stock')}
                disabled={loading}
              />
            </ButtonItem>

            <ButtonItem>
              <ButtonOptions
                text="Cancel"
                type="danger"
                useSubmitBehavior={false}
                onClick={() => router.push('/dashboard/products')}
                disabled={loading}
              />
            </ButtonItem>
          </GroupItem>
        </Form>
      </div>

      {/* Loading Overlay */}
      <LoadPanel
        visible={loading}
        message="Saving product..."
        position={{ of: '.content' }}
      />
    </div>
  )
}
