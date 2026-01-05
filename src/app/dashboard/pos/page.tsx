'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useUserLocations } from '@/hooks/useUserLocations'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { hasPermission, PERMISSIONS, type RBACUser } from '@/lib/rbac'
import SalesInvoicePrint from '@/components/SalesInvoicePrint'
import QuotationPrint from '@/components/QuotationPrint'
import { apiPost, isConnectionOnline, getOfflineQueueLength } from '@/lib/client/apiClient'
import ARPaymentCollectionModal from '@/components/ARPaymentCollectionModal'
import POSUnitSelector from '@/components/POSUnitSelector'
import ExchangeDialog from '@/components/ExchangeDialog'
import { Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export default function POSEnhancedPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { isLocationUser, loading: locationsLoading } = useUserLocations()
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cashIOSubmittingRef = useRef(false) // Prevent double submission for Cash In/Out

  // State Management
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false) // Prevent double submission
  const [error, setError] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('online')
  const [queuedRequests, setQueuedRequests] = useState(0)
  const [currentShift, setCurrentShift] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Payment State - Mixed Payment Support
  const [paymentModes, setPaymentModes] = useState<Array<{method: string, amount: number, reference?: string, photo?: string}>>([])
  const [cashAmount, setCashAmount] = useState<string>('')
  const [digitalAmount, setDigitalAmount] = useState<string>('')
  const [digitalMethod, setDigitalMethod] = useState<string>('gcash') // Default to GCash to prevent blank payment methods
  const [digitalReference, setDigitalReference] = useState('')
  const [digitalPhoto, setDigitalPhoto] = useState<string>('')
  const [chequeAmount, setChequeAmount] = useState<string>('')
  const [chequeNumber, setChequeNumber] = useState('')
  const [chequeBank, setChequeBank] = useState('')
  const [chequeDate, setChequeDate] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [isCreditSale, setIsCreditSale] = useState(false)

  // Sales Personnel State
  const [salesPersonnel, setSalesPersonnel] = useState<any[]>([])
  const [selectedSalesPersonnel, setSelectedSalesPersonnel] = useState<any>(null)

  // Discount State - Updated
  const [discountType, setDiscountType] = useState<string>('none')
  const [discountAmount, setDiscountAmount] = useState<string>('')
  const [regularDiscountPercent, setRegularDiscountPercent] = useState<number>(0)
  const [seniorCitizenId, setSeniorCitizenId] = useState('')
  const [seniorCitizenName, setSeniorCitizenName] = useState('')
  const [pwdId, setPwdId] = useState('')
  const [pwdName, setPwdName] = useState('')
  const [enableSeniorPwdDiscount, setEnableSeniorPwdDiscount] = useState(false)

  // Additional Charge State (for Credit Sales - uses shippingCost field internally)
  const [additionalChargeType, setAdditionalChargeType] = useState<'fixed' | 'percentage'>('fixed')
  const [additionalChargeValue, setAdditionalChargeValue] = useState<string>('')

  // Dialog States
  const [showCashInDialog, setShowCashInDialog] = useState(false)
  const [showCashOutDialog, setShowCashOutDialog] = useState(false)
  const [showARPaymentDialog, setShowARPaymentDialog] = useState(false)
  const [showQuotationDialog, setShowQuotationDialog] = useState(false)
  const [showSavedQuotations, setShowSavedQuotations] = useState(false)
  const [showHoldDialog, setShowHoldDialog] = useState(false)
  const [showHeldTransactions, setShowHeldTransactions] = useState(false)
  const [showNumericKeypad, setShowNumericKeypad] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showDigitalPaymentDialog, setShowDigitalPaymentDialog] = useState(false)
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false)
  const [showCameraDialog, setShowCameraDialog] = useState(false)
  const [showExchangeDialog, setShowExchangeDialog] = useState(false)

  // Package Template State
  const [showPackageDialog, setShowPackageDialog] = useState(false)
  const [packageCategories, setPackageCategories] = useState<any[]>([])
  const [packageTemplates, setPackageTemplates] = useState<any[]>([])
  const [loadingPackages, setLoadingPackages] = useState(false)
  const [activePackageTab, setActivePackageTab] = useState<string>('all')

  // Confirmation Dialog States
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false)
  const [showHoldConfirm, setShowHoldConfirm] = useState(false)
  const [showSaveQuotationConfirm, setShowSaveQuotationConfirm] = useState(false)

  // Serial Number State
  const [showSerialNumberDialog, setShowSerialNumberDialog] = useState(false)
  const [serialNumberCartIndex, setSerialNumberCartIndex] = useState<number | null>(null)

  // UOM (Unit of Measure) State
  const [showUnitSelector, setShowUnitSelector] = useState<number | null>(null)

  // Cash In/Out State
  const [cashIOAmount, setCashIOAmount] = useState('')
  const [cashIORemarks, setCashIORemarks] = useState('')
  const [cashIOSubmitting, setCashIOSubmitting] = useState(false)

  // Quotation State
  const [quotations, setQuotations] = useState<any[]>([])
  const [quotationCustomerName, setQuotationCustomerName] = useState('')
  const [quotationNotes, setQuotationNotes] = useState('')
  const [savingQuotation, setSavingQuotation] = useState(false) // Loading state for saving quotation
  const [loadingQuotation, setLoadingQuotation] = useState(false) // Loading state for loading quotation

  // Hold Transaction State
  const [heldTransactions, setHeldTransactions] = useState<any[]>([])
  const [holdNote, setHoldNote] = useState('')

  // Sale Remarks State
  const [remarks, setRemarks] = useState('')

  // New Customer State
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerAddress, setNewCustomerAddress] = useState('')

  // Barcode State
  const [barcodeBuffer, setBarcodeBuffer] = useState('')
  const [lastKeyTime, setLastKeyTime] = useState(Date.now())
  const [quantityMultiplier, setQuantityMultiplier] = useState<number | null>(null)

  // Numeric Keypad State
  const [keypadTarget, setKeypadTarget] = useState<'cash' | 'digital' | 'discount' | 'cashin' | 'cashout' | 'additionalCharge'>('cash')
  const [keypadValue, setKeypadValue] = useState('')

  // Freebie Total State
  const [freebieTotal, setFreebieTotal] = useState(0)

  // Footer Status Bar State
  const [lastSaleAmount, setLastSaleAmount] = useState(0)
  const [todaysSalesTotal, setTodaysSalesTotal] = useState(0)
  const [cashDrawerOpen, setCashDrawerOpen] = useState(false)

  // Invoice Print State
  const [showInvoice, setShowInvoice] = useState(false)
  const [completedSale, setCompletedSale] = useState<any>(null)

  // Quotation Print State
  const [showQuotationPrint, setShowQuotationPrint] = useState(false)
  const [quotationToPrint, setQuotationToPrint] = useState<any>(null)
  const [networkStatus, setNetworkStatus] = useState<'connected' | 'disconnected'>('connected')
  const [printerStatus, setPrinterStatus] = useState<'ready' | 'offline'>('ready')
  const [currentTransaction, setCurrentTransaction] = useState('')
  const [actualCashInDrawer, setActualCashInDrawer] = useState(0)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)

  // Product Search State
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchResultRefs = useRef<(HTMLDivElement | null)[]>([])

  // Customer Search State (same pattern as product search)
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([])
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(0)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const customerResultRefs = useRef<(HTMLDivElement | null)[]>([])

  // Only run checks when session is ready
  useEffect(() => {
    if (session) {
      checkShift()
      fetchCategories()
      fetchCustomers()
      fetchQuotations()
      loadHeldTransactions()
      fetchBusinessSettings()
      fetchSalesPersonnel()
    }
  }, [session])

  // Fetch business settings for Senior/PWD discount toggle
  const fetchBusinessSettings = async () => {
    try {
      const response = await fetch('/api/business/settings')
      const data = await response.json()
      if (response.ok && data.business) {
        setEnableSeniorPwdDiscount(data.business.enableSeniorPwdDiscount || false)
      }
    } catch (error) {
      console.error('Error fetching business settings:', error)
    }
  }

  // Fetch active sales personnel for dropdown
  const fetchSalesPersonnel = async () => {
    try {
      const response = await fetch('/api/sales-personnel/active')
      const data = await response.json()
      if (response.ok && data.salesPersonnel) {
        setSalesPersonnel(data.salesPersonnel)
      }
    } catch (error) {
      console.error('Error fetching sales personnel:', error)
    }
  }

  // Fetch package templates and categories
  const fetchPackages = async () => {
    setLoadingPackages(true)
    try {
      const [catRes, templatesRes] = await Promise.all([
        fetch('/api/package-categories'),
        fetch('/api/package-templates')
      ])

      const catData = await catRes.json()
      const templatesData = await templatesRes.json()

      if (catRes.ok) {
        setPackageCategories(catData.categories || [])
      }
      if (templatesRes.ok) {
        setPackageTemplates(templatesData.templates || [])
      }
    } catch (error) {
      console.error('Error fetching packages:', error)
    } finally {
      setLoadingPackages(false)
    }
  }

  // Load package items into cart - with consolidation and proper stock validation
  const loadPackageToCart = (template: any) => {
    if (!currentShift?.location?.id) {
      setError('No location selected')
      return
    }

    const locationId = currentShift.location.id
    let updatedCart = [...cart]
    let itemsAdded = 0
    let itemsUpdated = 0

    for (const item of template.items) {
      // Find the product in our products list to get stock and variation details
      const product = products.find((p: any) => p.id === item.productId)
      if (!product) continue

      const variation = product.variations?.find((v: any) => v.id === item.productVariationId)
      if (!variation) continue

      // Get stock for current location (use variationLocationDetails like addToCart does)
      const locationStock = variation.variationLocationDetails?.find((s: any) => s.locationId === locationId)
      const availableStock = product.notForSelling ? 999999 : parseFloat(locationStock?.qtyAvailable || '0')
      const qtyToAdd = Number(item.quantity) || 1

      // Check if this product variation already exists in cart (consolidate)
      const existingIndex = updatedCart.findIndex(
        (cartItem) => cartItem.productVariationId === variation.id && !cartItem.isFreebie
      )

      if (existingIndex >= 0) {
        // Product exists in cart - increase quantity
        const newQuantity = updatedCart[existingIndex].quantity + qtyToAdd

        // Validate stock
        if (newQuantity > availableStock && !product.notForSelling) {
          setError(`Insufficient stock for "${product.name}"! Only ${availableStock} available.`)
          setTimeout(() => setError(''), 4000)
          continue
        }

        updatedCart[existingIndex].quantity = newQuantity
        updatedCart[existingIndex].displayQuantity = newQuantity
        itemsUpdated++
      } else {
        // New product - validate stock first
        if (qtyToAdd > availableStock && !product.notForSelling) {
          setError(`Insufficient stock for "${product.name}"! Only ${availableStock} available.`)
          setTimeout(() => setError(''), 4000)
          continue
        }

        // Add new item with correct availableStock property
        updatedCart.push({
          productId: product.id,
          productVariationId: variation.id,
          name: product.name + (variation.name ? ` - ${variation.name}` : ''),
          sku: variation.sku || product.sku,
          unitPrice: Number(item.customPrice) || 0, // Use package custom price
          originalPrice: Number(item.originalPrice) || Number(item.customPrice) || 0,
          quantity: qtyToAdd,
          displayQuantity: qtyToAdd,
          selectedUnitId: null,
          selectedUnitName: null,
          availableStock: availableStock, // FIXED: Use availableStock for updateQuantity compatibility
          imageUrl: product.imageUrl,
          requiresSerial: product.enableSerialNumber || false,
          serialNumberIds: [],
          isFreebie: false,
          freebieReason: '',
          itemDiscountType: null,
          itemDiscountValue: 0,
          itemDiscountAmount: 0,
          notForSelling: product.notForSelling || false,
        })
        itemsAdded++
      }
    }

    setCart(updatedCart)
    setShowPackageDialog(false)

    if (itemsAdded > 0 || itemsUpdated > 0) {
      toast.success(`Package "${template.name}": ${itemsAdded} added, ${itemsUpdated} updated`)
    }
  }

  // Fetch products after shift is loaded
  useEffect(() => {
    if (currentShift) {
      fetchProducts()
      fetchTodaysSales()
    }
  }, [currentShift])

  // Reset pagination when category or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory, searchTerm])

  // Live search: Show dropdown as user types
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setShowSearchDropdown(false)
      setSearchResults([])
      return
    }

    // Search with debouncing (wait 300ms after user stops typing)
    const timer = setTimeout(() => {
      const matches = searchProducts(searchTerm)
      if (matches.length > 0) {
        setSearchResults(matches)
        setSelectedSearchIndex(0)
        setShowSearchDropdown(true)
      } else {
        setShowSearchDropdown(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, products])

  // Auto-scroll selected search result into view
  useEffect(() => {
    if (showSearchDropdown && searchResultRefs.current[selectedSearchIndex]) {
      searchResultRefs.current[selectedSearchIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [selectedSearchIndex, showSearchDropdown])

  // Customer live search: Show dropdown as user types
  useEffect(() => {
    if (customerSearchTerm.trim() === '') {
      setShowCustomerDropdown(false)
      setCustomerSearchResults([])
      // Don't clear selected customer here - only clear via explicit clear button
      return
    }

    // Search with debouncing (wait 300ms after user stops typing)
    const timer = setTimeout(() => {
      const searchLower = customerSearchTerm.toLowerCase().trim()
      console.log('[POS] Searching customers for:', searchLower)
      console.log('[POS] Total customers loaded:', customers.length)

      const matches = customers.filter((customer) =>
        customer.name?.toLowerCase().includes(searchLower) ||
        customer.email?.toLowerCase().includes(searchLower) ||
        customer.mobile?.includes(searchLower)
      )

      console.log('[POS] Search matches found:', matches.length)

      if (matches.length > 0) {
        console.log('[POS] Showing dropdown with', matches.length, 'results')
        setCustomerSearchResults(matches)
        setSelectedCustomerIndex(0)
        setShowCustomerDropdown(true)
      } else {
        console.log('[POS] No matches - hiding dropdown')
        setShowCustomerDropdown(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [customerSearchTerm, customers])

  // Auto-scroll selected customer result into view
  useEffect(() => {
    if (showCustomerDropdown && customerResultRefs.current[selectedCustomerIndex]) {
      customerResultRefs.current[selectedCustomerIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [selectedCustomerIndex, showCustomerDropdown])

  // Connection status monitor for API client
  useEffect(() => {
    const updateConnectionStatus = () => {
      setConnectionStatus(isConnectionOnline() ? 'online' : 'offline')
      setQueuedRequests(getOfflineQueueLength())
    }

    // Update every 2 seconds
    const interval = setInterval(updateConnectionStatus, 2000)
    updateConnectionStatus() // Initial check

    return () => clearInterval(interval)
  }, [])

  // Network status detection
  useEffect(() => {
    const handleOnline = () => setNetworkStatus('connected')
    const handleOffline = () => setNetworkStatus('disconnected')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Focus barcode input on mount
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // IMPORTANT: Disable ALL shortcuts when dialogs are open
      if (showSerialNumberDialog || showPaymentModal) {
        return
      }

      // Don't trigger shortcuts when typing in input/textarea (except Ctrl+S)
      const target = e.target as HTMLElement
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      if (isInputField && !(e.ctrlKey && e.key === 's')) {
        return
      }

      // F5 - Hold Transaction
      if (e.key === 'F5') {
        e.preventDefault()
        if (cart.length > 0) {
          setShowHoldDialog(true)
        } else {
          setError('Cart is empty - nothing to hold')
          setTimeout(() => setError(''), 2000)
        }
        return
      }

      // F6 - Retrieve Held Transaction (blocked if cart has items)
      if (e.key === 'F6') {
        e.preventDefault()
        if (cart.length > 0) {
          setError('Complete or clear current sale first')
          setTimeout(() => setError(''), 3000)
          return
        }
        setShowHeldTransactions(true)
        return
      }

      // F7 - Process Exchange (blocked if cart has items)
      if (e.key === 'F7') {
        e.preventDefault()
        if (cart.length > 0) {
          setError('Complete or clear current sale first')
          setTimeout(() => setError(''), 3000)
          return
        }
        setShowExchangeDialog(true)
        return
      }


      // Ctrl+S - Focus Search Field
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus()
          barcodeInputRef.current.select()
        }
        return
      }

      // F2 - Save Quotation
      if (e.key === 'F2') {
        e.preventDefault()
        if (cart.length > 0) {
          setShowQuotationDialog(true)
        } else {
          setError('Cart is empty - nothing to save')
          setTimeout(() => setError(''), 2000)
        }
        return
      }

      // F3 - Load Quotation (blocked if cart has items)
      if (e.key === 'F3') {
        e.preventDefault()
        if (cart.length > 0) {
          setError('Complete or clear current sale first')
          setTimeout(() => setError(''), 3000)
          return
        }
        setShowSavedQuotations(true)
        return
      }

      // Alt+I - Cash In (blocked if cart has items)
      if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault()
        if (cart.length > 0) {
          setError('Complete or clear current sale first')
          setTimeout(() => setError(''), 3000)
          return
        }
        setCashIOAmount('')
        setCashIORemarks('')
        setShowCashInDialog(true)
        return
      }

      // Alt+O - Cash Out (blocked if cart has items)
      if (e.altKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault()
        if (cart.length > 0) {
          setError('Complete or clear current sale first')
          setTimeout(() => setError(''), 3000)
          return
        }
        setCashIOAmount('')
        setCashIORemarks('')
        setShowCashOutDialog(true)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart, showSerialNumberDialog, showPaymentModal])

  // Calculate freebie total
  useEffect(() => {
    const total = cart
      .filter(item => item.isFreebie)
      .reduce((sum, item) => sum + parseFloat(item.originalPrice || 0) * item.quantity, 0)
    setFreebieTotal(total)
  }, [cart])

  // Barcode scanner handler
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // IMPORTANT: Disable barcode scanner when dialogs are open
      if (showSerialNumberDialog || showPaymentModal) {
        return
      }

      const currentTime = Date.now()
      if (currentTime - lastKeyTime > 100) {
        setBarcodeBuffer('')
      }
      setLastKeyTime(currentTime)

      if (e.key === 'Enter' && barcodeBuffer.length > 0) {
        handleBarcodeScanned(barcodeBuffer)
        setBarcodeBuffer('')
      } else if (e.key.length === 1) {
        setBarcodeBuffer(prev => prev + e.key)
      }
    }

    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [barcodeBuffer, lastKeyTime, showSerialNumberDialog, showPaymentModal])

  const checkShift = async () => {
    try {
      console.log('[POS] Checking for active shift...')
      const res = await fetch('/api/shifts?status=open')
      const data = await res.json()

      console.log('[POS] API response:', data)

      if (data.shifts && data.shifts.length > 0) {
        const shift = data.shifts[0]
        console.log('[POS] Found shift:', {
          shiftNumber: shift.shiftNumber,
          beginningCash: shift.beginningCash,
          locationId: shift.locationId,
          openedAt: shift.openedAt,
          status: shift.status
        })

        if (!shift.beginningCash || parseFloat(shift.beginningCash) <= 0) {
          console.error('[POS] CRITICAL: Invalid shift detected - missing or zero beginning cash:', {
            shiftId: shift.id,
            shiftNumber: shift.shiftNumber,
            beginningCash: shift.beginningCash
          })
          setError(`Invalid shift (${shift.shiftNumber}): No beginning cash found. Please close this shift and start a new one with proper beginning cash.`)

          // Show alert to user
          alert(`CRITICAL ERROR: Your shift (${shift.shiftNumber}) has no beginning cash!\n\nThis shift cannot be used for sales. You must:\n1. Close this invalid shift\n2. Start a new shift with beginning cash\n\nYou will now be redirected to begin a proper shift.`)

          router.push('/dashboard/shifts/begin')
          return
        }

        console.log('[POS] ✓ Valid shift confirmed - Setting current shift and loading products...')
        setCurrentShift(shift)
      } else {
        console.log('[POS] No open shift found - redirecting to begin shift')
        setError('No active shift found. Please begin your shift first.')
        router.push('/dashboard/shifts/begin')
      }
    } catch (err) {
      console.error('[POS] Error checking shift:', err)
      setError('Unable to verify your shift status.')
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?limit=10000&status=active')
      const data = await res.json()

      console.log('[POS] Fetched products:', data.products?.length || 0)

      if (data.products) {
        const productsWithStock = data.products.filter((p: any) => {
          // Always include "Not for Selling" items (services, fees) regardless of stock
          if (p.notForSelling) {
            return true
          }
          // For regular products, require stock > 0 at location
          return p.variations?.some((v: any) => {
            const locationStock = v.variationLocationDetails?.find(
              (vl: any) => vl.locationId === currentShift?.locationId
            )
            return locationStock && parseFloat(locationStock.qtyAvailable) > 0
          })
        })

        console.log('[POS] Products with stock at location:', productsWithStock.length)

        const sortedProducts = productsWithStock.sort((a: any, b: any) =>
          a.name.localeCompare(b.name)
        )

        setProducts(sortedProducts)
      }
    } catch (err) {
      console.error('Error fetching products:', err)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      if (data.categories) {
        setCategories([{ id: 'all', name: 'All Products' }, ...data.categories])
      }
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers')
      const data = await res.json()
      console.log('[POS] Fetched customers:', data?.length || 0, 'customers')
      // API returns array directly, not wrapped in { customers: [] }
      if (Array.isArray(data)) {
        setCustomers(data)
        console.log('[POS] Set customers array:', data.length, 'customers')
      } else if (data.customers) {
        setCustomers(data.customers)
        console.log('[POS] Set customers from .customers property:', data.customers.length)
      }
    } catch (err) {
      console.error('[POS] Error fetching customers:', err)
    }
  }

  const fetchQuotations = async () => {
    try {
      const res = await fetch('/api/quotations')
      const data = await res.json()
      if (data.quotations) {
        setQuotations(data.quotations)
      }
    } catch (err) {
      console.error('Error fetching quotations:', err)
    }
  }

  const loadHeldTransactions = () => {
    const held = localStorage.getItem('heldTransactions')
    if (held) {
      setHeldTransactions(JSON.parse(held))
    }
  }

  const fetchTodaysSales = async () => {
    if (!currentShift) return

    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/sales?date=${today}&shiftId=${currentShift.id}`)
      const data = await res.json()
      if (data.sales) {
        const total = data.sales.reduce(
          (sum: number, sale: any) => sum + parseFloat(sale.totalAmount || 0),
          0
        )
        setTodaysSalesTotal(total)

        // Set last sale amount (most recent sale is first in the array)
        if (data.sales.length > 0) {
          setLastSaleAmount(parseFloat(data.sales[0].totalAmount || 0))
        }
      }
    } catch (err) {
      console.error('Error fetching today sales:', err)
    }
  }

  const calculateActualCash = () => {
    const beginningCash = parseFloat(currentShift?.beginningCash || '0')
    const cashSales = todaysSalesTotal // This should filter only cash payments
    const cashIn = 0 // TODO: Get from cash-in transactions
    const cashOut = 0 // TODO: Get from cash-out transactions
    const credits = 0 // TODO: Get from credit sales
    const discounts = 0 // TODO: Get from discounted sales

    return beginningCash + cashSales + cashIn - cashOut - credits - discounts
  }

  const saveHeldTransaction = () => {
    if (cart.length === 0) {
      setError('Cart is empty')
      return
    }

    const transaction = {
      id: Date.now(),
      cart: [...cart],
      customer: selectedCustomer,
      discountType,
      discountAmount,
      seniorCitizenId,
      seniorCitizenName,
      pwdId,
      pwdName,
      note: holdNote,
      timestamp: new Date().toISOString(),
    }

    const held = [...heldTransactions, transaction]
    setHeldTransactions(held)
    localStorage.setItem('heldTransactions', JSON.stringify(held))

    // Clear current transaction
    setCart([])
    setSelectedCustomer(null)
    setDiscountType('none')
    setDiscountAmount('')
    setSeniorCitizenId('')
    setSeniorCitizenName('')
    setPwdId('')
    setPwdName('')
    setHoldNote('')
    setRemarks('')
    setShowHoldDialog(false)

    alert('Transaction held successfully!')
  }

  const retrieveHeldTransaction = (transaction: any) => {
    setCart(transaction.cart)
    setSelectedCustomer(transaction.customer)
    setDiscountType(transaction.discountType)
    setDiscountAmount(transaction.discountAmount || '')
    setSeniorCitizenId(transaction.seniorCitizenId || '')
    setSeniorCitizenName(transaction.seniorCitizenName || '')
    setPwdId(transaction.pwdId || '')
    setPwdName(transaction.pwdName || '')

    // Remove from held transactions
    const updated = heldTransactions.filter(t => t.id !== transaction.id)
    setHeldTransactions(updated)
    localStorage.setItem('heldTransactions', JSON.stringify(updated))

    setShowHeldTransactions(false)
    alert('Transaction retrieved!')
  }

  // Search for products by SKU or name (returns ALL matches)
  const searchProducts = (searchText: string): any[] => {
    if (!searchText || searchText.trim() === '') {
      return []
    }

    const searchLower = searchText.toLowerCase().trim()

    // Find all matching products
    const matches = products.filter((p) => {
      // Exact SKU match (highest priority)
      if (p.sku?.toLowerCase() === searchLower) return true
      if (p.variations?.some((v: any) => v.sku?.toLowerCase() === searchLower)) return true

      // Partial SKU match
      if (p.sku?.toLowerCase().includes(searchLower)) return true
      if (p.variations?.some((v: any) => v.sku?.toLowerCase().includes(searchLower))) return true

      // Partial name match (case-insensitive)
      if (p.name?.toLowerCase().includes(searchLower)) return true

      return false
    })

    return matches
  }

  const handleBarcodeScanned = async (barcode: string) => {
    // Check if input starts with * for quantity multiplier
    if (barcode.startsWith('*')) {
      const qty = parseInt(barcode.substring(1))
      if (!isNaN(qty) && qty > 0) {
        // If cart has items, update last item quantity
        if (cart.length > 0) {
          const lastIndex = cart.length - 1
          updateQuantity(lastIndex, qty)
          alert(`Quantity updated to ${qty} for last item`)
        } else {
          // Store multiplier for next product
          setQuantityMultiplier(qty)
          alert(`Next product will be added with quantity: ${qty}`)
        }
      } else {
        setError('Invalid quantity. Use format: *5 for quantity 5')
        setTimeout(() => setError(''), 3000)
      }

      if (barcodeInputRef.current) {
        barcodeInputRef.current.value = ''
        barcodeInputRef.current.focus()
      }
      return
    }

    // Automatically switch to "All Products" when searching
    if (selectedCategory !== 'all') {
      setSelectedCategory('all')
    }

    // Search for matching products
    const matches = searchProducts(barcode)

    if (matches.length === 1) {
      // Single match: add immediately (barcode scanner behavior)
      addToCart(matches[0], false)
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS75+mfTQ0OTqni77dhGgU7k')
      audio.play().catch(() => {})

      // Clear search
      setSearchTerm('')
      setShowSearchDropdown(false)
    } else if (matches.length > 1) {
      // Multiple matches: show dropdown for selection
      setSearchResults(matches)
      setSelectedSearchIndex(0)
      setShowSearchDropdown(true)
    } else {
      // No matches
      setError('Product not found')
      setTimeout(() => setError(''), 3000)
      setShowSearchDropdown(false)
    }

    if (barcodeInputRef.current && matches.length !== 1) {
      barcodeInputRef.current.focus()
    }
  }

  // REMOVED: checkHasSerialNumbers function
  // No longer needed - user manually enters serial numbers as text

  const addToCart = async (product: any, isFreebie: boolean = false) => {
    const variation = product.variations?.[0]
    if (!variation) return

    const locationStock = variation.variationLocationDetails?.find(
      (vl: any) => vl.locationId === currentShift?.locationId
    )

    // Skip stock check for "Not for Selling" items (services, fees)
    if (!product.notForSelling) {
      if (!locationStock || parseFloat(locationStock.qtyAvailable) <= 0) {
        setError('Product out of stock at your location')
        setTimeout(() => setError(''), 3000)
        return
      }
    }

    const availableStock = product.notForSelling ? 999999 : parseFloat(locationStock?.qtyAvailable || '0')

    // Get the unit this product will be added with (defaults to primary unit)
    const addingWithUnitId = product.unitId || null

    const existingIndex = cart.findIndex(
      (item) =>
        item.productVariationId === variation.id &&
        item.isFreebie === isFreebie &&
        item.selectedUnitId === addingWithUnitId  // Must match EXACT unit
    )

    // ⚡ PERFORMANCE: Use pre-loaded location-specific prices (NO API CALLS = INSTANT!)
    let price = parseFloat(variation.sellingPrice) // Fallback to global default
    let priceSource = 'global-default'

    console.log('⚡ POS addToCart - Looking up price from pre-loaded data:', {
      productId: product.id,
      productName: product.name,
      addingWithUnitId,
      currentLocationId: currentShift?.locationId,
      hasUnitLocationPrices: !!product.unitLocationPrices,
      hasVariationLocationDetails: !!locationStock.sellingPrice,
    })

    // STEP 1: Try multi-unit location-specific price (from pre-loaded data)
    if (product.unitLocationPrices && Array.isArray(product.unitLocationPrices)) {
      const locationUnitPrice = product.unitLocationPrices.find(
        (ulp: any) => ulp.locationId === currentShift?.locationId && ulp.unitId === addingWithUnitId
      )
      if (locationUnitPrice) {
        price = parseFloat(String(locationUnitPrice.sellingPrice))
        priceSource = 'multi-unit-location-specific-cached'
        console.log('⚡ POS: Using CACHED multi-unit location price:', price, '(NO API CALL!)')
      } else {
        // Try global multi-unit price
        if (product.unitPrices && Array.isArray(product.unitPrices)) {
          const globalUnitPrice = product.unitPrices.find((up: any) => up.unitId === addingWithUnitId)
          if (globalUnitPrice) {
            price = parseFloat(String(globalUnitPrice.sellingPrice))
            priceSource = 'multi-unit-global-cached'
            console.log('⚡ POS: Using CACHED multi-unit global price:', price, '(NO API CALL!)')
          }
        }
      }
    }

    // STEP 2: If no multi-unit price, try single-unit location-specific price
    if (priceSource === 'global-default' && locationStock.sellingPrice) {
      price = parseFloat(String(locationStock.sellingPrice))
      priceSource = 'single-unit-location-specific-cached'
      console.log('⚡ POS: Using CACHED single-unit location price:', price, '(NO API CALL!)')
    }

    console.log('⚡ POS: Final price for', product.name, '=', price, '| Source:', priceSource, '| INSTANT (no delay)!')

    // Use quantity multiplier if set, otherwise 1
    const qtyToAdd = quantityMultiplier || 1

    // Clear multiplier after use
    if (quantityMultiplier) {
      setQuantityMultiplier(null)
    }

    // PERFORMANCE FIX: Don't check for serial numbers automatically
    // Let user manually add serial numbers if needed via button
    // This makes cart additions INSTANT!

    if (existingIndex >= 0) {
      const newCart = [...cart]
      const newQuantity = newCart[existingIndex].quantity + qtyToAdd

      // Check if new quantity exceeds available stock
      if (newQuantity > availableStock) {
        setError(`Insufficient stock! Only ${availableStock} units available at this branch.`)
        setTimeout(() => setError(''), 4000)
        return
      }

      newCart[existingIndex].quantity = newQuantity
      newCart[existingIndex].displayQuantity = newQuantity  // Same for primary unit
      // Reset serial numbers if quantity changes
      if (newCart[existingIndex].serialNumberIds?.length > 0) {
        newCart[existingIndex].serialNumberIds = []
        newCart[existingIndex].serialNumbers = []
      }
      setCart(newCart)
      // Focus back to search input for quick scanning
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
    } else {
      // Check if initial quantity exceeds available stock
      if (qtyToAdd > availableStock) {
        setError(`Insufficient stock! Only ${availableStock} units available at this branch.`)
        setTimeout(() => setError(''), 4000)
        return
      }

      // Get primary unit info for UOM
      const primaryUnitId = product.unitId || null
      const primaryUnitName = product.unit?.name || 'Unit'

      setCart([
        ...cart,
        {
          productId: product.id,
          productVariationId: variation.id,
          name: product.name,
          sku: variation.sku || product.sku,
          unitPrice: isFreebie ? 0 : price,
          originalPrice: price,
          quantity: qtyToAdd,
          displayQuantity: qtyToAdd,  // Same for primary unit initially
          selectedUnitId: primaryUnitId,  // Default to primary unit
          selectedUnitName: primaryUnitName,
          availableStock: availableStock, // Store available stock
          isFreebie,
          requiresSerial: false, // Default to false, user can add serials manually
          serialNumberIds: [],
          serialNumbers: [], // Store full serial number objects
          // Per-item discount fields
          itemDiscountType: null as 'fixed' | 'percentage' | null,
          itemDiscountValue: 0,
          itemDiscountAmount: 0,
          // Per-item remark (required when discount > 0)
          itemRemark: '',
          // Service item flag (no inventory deduction)
          notForSelling: product.notForSelling || false,
        },
      ])
      // Focus back to search input for quick scanning
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
    }
  }

  const addFreebieToCart = (product: any) => {
    addToCart(product, true)
  }

  // Handle UOM (Unit of Measure) change for cart items
  const handleUnitChange = (cartIndex: number, unitData: {
    selectedUnitId: number
    displayQuantity: number
    baseQuantity: number
    unitPrice: number
    unitName: string
  }) => {
    const newCart = [...cart]

    newCart[cartIndex] = {
      ...newCart[cartIndex],
      quantity: unitData.baseQuantity,  // Store base quantity for inventory
      displayQuantity: unitData.displayQuantity,  // Display quantity in selected unit
      selectedUnitId: unitData.selectedUnitId,
      selectedUnitName: unitData.unitName,
      unitPrice: unitData.unitPrice,
      subUnitId: unitData.selectedUnitId,  // For sales API
      subUnitPrice: unitData.unitPrice,  // For sales API
    }

    setCart(newCart)
    setShowUnitSelector(null)  // Close selector
  }

  // Handle serial number manual entry - NO database query, just open input dialog
  const handleOpenSerialDialog = (cartIndex: number) => {
    setSerialNumberCartIndex(cartIndex)
    setShowSerialNumberDialog(true)
  }

  // Handle manual serial number text entry
  const handleSerialNumberConfirm = (serialNumbersText: string[]) => {
    if (serialNumberCartIndex === null) return

    const newCart = [...cart]
    // Store serial numbers as simple text array
    newCart[serialNumberCartIndex].serialNumberIds = [] // Empty IDs
    newCart[serialNumberCartIndex].serialNumbers = serialNumbersText.map(sn => ({ serialNumber: sn }))
    setCart(newCart)
    setSerialNumberCartIndex(null)
    setShowSerialNumberDialog(false)
  }

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index))
  }

  // Handle per-item discount changes
  const updateItemDiscount = (index: number, discountType: 'fixed' | 'percentage' | null, discountValue: number) => {
    const newCart = [...cart]
    const item = newCart[index]
    const qty = item.displayQuantity && item.selectedUnitName ? item.displayQuantity : item.quantity
    const lineTotal = item.unitPrice * qty

    // Ensure discount value is non-negative and cap appropriately
    let cappedValue = Math.max(0, discountValue)  // Prevent negative values
    if (discountType === 'percentage') {
      // Cap percentage at 100% (and ensure >= 0)
      cappedValue = Math.min(Math.max(0, discountValue), 100)
    } else if (discountType === 'fixed') {
      // Cap fixed discount per item at unit price (and ensure >= 0)
      cappedValue = Math.min(Math.max(0, discountValue), item.unitPrice)
    }

    // Calculate the discount amount in peso
    let discountAmount = 0
    if (discountType && cappedValue > 0) {
      if (discountType === 'percentage') {
        discountAmount = (lineTotal * cappedValue) / 100
      } else {
        // Fixed discount per item × quantity
        discountAmount = cappedValue * qty
      }
    }

    newCart[index] = {
      ...item,
      itemDiscountType: discountType,
      itemDiscountValue: cappedValue,
      itemDiscountAmount: discountAmount,
    }
    setCart(newCart)
  }

  // Handle per-item remark changes (required when discount > 0)
  const updateItemRemark = (index: number, remark: string) => {
    const newCart = [...cart]
    newCart[index] = { ...newCart[index], itemRemark: remark }
    setCart(newCart)
  }

  const updateQuantity = (index: number, quantity: number, unitName?: string) => {
    if (quantity <= 0) {
      removeFromCart(index)
      return
    }

    const item = cart[index]
    const availableStock = item.availableStock || 0

    // If sub-unit is selected, handle conversion
    if (unitName && item.selectedUnitId) {
      const product = products.find(p => p.id === item.productId)

      if (!product) {
        setError(`Product not found for "${item.name}". Cannot update quantity.`)
        setTimeout(() => setError(''), 5000)
        return
      }

      // Build units array from product (same logic as UnitSelector)
      const unitMap = new Map()

      if (product.unit) {
        unitMap.set(product.unit.id, product.unit)
      }

      if (product.unitLocationPrices && Array.isArray(product.unitLocationPrices)) {
        const locationPrices = product.unitLocationPrices.filter(
          (ulp: any) => ulp.locationId === currentShift?.locationId
        )
        locationPrices.forEach((ulp: any) => {
          if (ulp.unit && !unitMap.has(ulp.unit.id)) {
            unitMap.set(ulp.unit.id, ulp.unit)
          }
        })
      }

      if (product.unitPrices && Array.isArray(product.unitPrices)) {
        product.unitPrices.forEach((up: any) => {
          if (up.unit && !unitMap.has(up.unit.id)) {
            unitMap.set(up.unit.id, up.unit)
          }
        })
      }

      const allUnits = Array.from(unitMap.values())
      const selectedUnit = allUnits.find(u => u.id === item.selectedUnitId)

      if (!selectedUnit) {
        setError(`Selected unit not found for "${item.name}". Cannot update quantity.`)
        setTimeout(() => setError(''), 5000)
        return
      }

      // Convert display quantity to base quantity for stock validation
      let baseQuantity = quantity

      if (selectedUnit.baseUnitId && selectedUnit.baseUnitMultiplier) {
        // Sub-unit conversion
        const multiplier = parseFloat(String(selectedUnit.baseUnitMultiplier))
        baseQuantity = quantity / multiplier
      }

      // Validate against available stock (in base units)
      if (baseQuantity > availableStock) {
        const maxAllowedInUnit = selectedUnit.baseUnitId && selectedUnit.baseUnitMultiplier
          ? availableStock * parseFloat(String(selectedUnit.baseUnitMultiplier))
          : availableStock

        setError(`⚠️ Insufficient stock! Only ${maxAllowedInUnit.toFixed(2)} ${unitName} available at this branch for "${item.name}".`)
        setTimeout(() => setError(''), 5000)
        return
      }

      // Update cart with both base and display quantities
      const newCart = [...cart]
      newCart[index].quantity = baseQuantity
      newCart[index].displayQuantity = quantity

      // Reset serial numbers if quantity changes and product requires serials
      if (item.requiresSerial && item.serialNumberIds.length !== baseQuantity) {
        newCart[index].serialNumberIds = []
        newCart[index].serialNumbers = []
      }

      // Recalculate discount amount when quantity changes
      if (newCart[index].itemDiscountType && newCart[index].itemDiscountValue > 0) {
        const newQty = quantity
        const newLineTotal = newCart[index].unitPrice * newQty
        if (newCart[index].itemDiscountType === 'percentage') {
          newCart[index].itemDiscountAmount = (newLineTotal * newCart[index].itemDiscountValue) / 100
        } else {
          // Fixed discount per item × quantity
          newCart[index].itemDiscountAmount = newCart[index].itemDiscountValue * newQty
        }
      }

      setCart(newCart)
    } else {
      // Primary unit - use existing logic
      // Validate against available stock
      if (quantity > availableStock) {
        setError(`⚠️ Insufficient stock! Only ${availableStock} units available at this branch for "${item.name}".`)
        setTimeout(() => setError(''), 5000)
        return
      }

      const newCart = [...cart]
      newCart[index].quantity = quantity
      newCart[index].displayQuantity = quantity  // Same for primary unit

      // Reset serial numbers if quantity changes and product requires serials
      if (item.requiresSerial && item.serialNumberIds.length !== quantity) {
        newCart[index].serialNumberIds = []
        newCart[index].serialNumbers = []
      }

      // Recalculate discount amount when quantity changes
      if (newCart[index].itemDiscountType && newCart[index].itemDiscountValue > 0) {
        const newQty = quantity
        const newLineTotal = newCart[index].unitPrice * newQty
        if (newCart[index].itemDiscountType === 'percentage') {
          newCart[index].itemDiscountAmount = (newLineTotal * newCart[index].itemDiscountValue) / 100
        } else {
          // Fixed discount per item × quantity
          newCart[index].itemDiscountAmount = newCart[index].itemDiscountValue * newQty
        }
      }

      setCart(newCart)
    }
  }

  // Calculate individual item discount amount in peso
  const calculateItemDiscount = (item: any) => {
    if (!item.itemDiscountType || !item.itemDiscountValue) return 0
    const qty = item.displayQuantity && item.selectedUnitName ? item.displayQuantity : item.quantity
    const lineTotal = item.unitPrice * qty
    if (item.itemDiscountType === 'percentage') {
      return (lineTotal * item.itemDiscountValue) / 100
    }
    // Fixed discount per item × quantity (capped at line total)
    return Math.min(item.itemDiscountValue * qty, lineTotal)
  }

  // Calculate total of all item-level discounts
  const calculateTotalItemDiscounts = () => {
    return cart.reduce((sum, item) => sum + calculateItemDiscount(item), 0)
  }

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      // For UOM items, use displayQuantity (e.g., 10 Meters)
      // For regular items, use quantity (base units)
      const qty = item.displayQuantity && item.selectedUnitName ? item.displayQuantity : item.quantity
      return sum + item.unitPrice * qty
    }, 0)
  }

  const calculateDiscount = () => {
    // Senior/PWD discount is 20% applied AFTER item discounts
    if (discountType === 'senior' || discountType === 'pwd') {
      const subtotalAfterItemDiscounts = calculateSubtotal() - calculateTotalItemDiscounts()
      return subtotalAfterItemDiscounts * 0.20
    }
    return 0
  }

  // Calculate Additional Charge (for all sales types)
  const calculateAdditionalCharge = () => {
    if (!additionalChargeValue) return 0
    const value = parseFloat(additionalChargeValue)
    if (isNaN(value) || value < 0) return 0  // Prevent negative values
    if (additionalChargeType === 'percentage') {
      return (calculateSubtotal() * Math.max(0, value)) / 100
    }
    return Math.max(0, value)  // Ensure non-negative
  }

  const calculateTotal = () => {
    // Formula: Subtotal - Item Discounts - Sale-Level Discount + Additional Charge
    // Item discounts are applied first, then sale-level discount (Senior/PWD)
    return calculateSubtotal() - calculateTotalItemDiscounts() - calculateDiscount() + calculateAdditionalCharge()
  }

  const getTotalPayments = () => {
    let total = 0
    if (cashAmount) total += parseFloat(cashAmount)
    if (digitalAmount) total += parseFloat(digitalAmount)
    if (chequeAmount) total += parseFloat(chequeAmount)
    return total
  }

  const calculateChange = () => {
    const paid = getTotalPayments()
    const due = calculateTotal()
    return paid - due
  }

  const sanitizeCurrencyInput = (raw: string) => {
    if (!raw) return ''
    // Remove negative signs and any non-numeric characters except decimal point
    const sanitized = raw.replace(/[^0-9.]/g, '')
    const parts = sanitized.split('.')
    if (parts.length <= 1) return sanitized
    return `${parts[0]}.${parts.slice(1).join('')}`
  }

  const formatCurrencyDisplay = (value: string, fractionDigits = 2) => {
    if (!value || value === '.') return ''
    const numericValue = Number(value)
    if (Number.isNaN(numericValue)) {
      return value
    }
    return numericValue.toLocaleString('en-PH', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
  }

  const keypadNumericValue = Number(keypadValue || '0')
  const keypadAmount = Number.isNaN(keypadNumericValue) ? 0 : keypadNumericValue
  const totalDueAmount = calculateTotal()
  const changeOrShortAmount = keypadAmount - totalDueAmount

  // Numeric Keypad Functions
  const openKeypad = (target: 'cash' | 'digital' | 'discount' | 'cashin' | 'cashout') => {
    setKeypadTarget(target)
    if (target === 'cash') setKeypadValue(cashAmount)
    else if (target === 'digital') setKeypadValue(digitalAmount)
    else if (target === 'discount') setKeypadValue(discountAmount)
    else if (target === 'cashin' || target === 'cashout') setKeypadValue(cashIOAmount)
    setShowNumericKeypad(true)
  }

  const handleKeypadClick = (value: string) => {
    if (value === 'C') {
      setKeypadValue('')
    } else if (value === '←') {
      setKeypadValue(keypadValue.slice(0, -1))
    } else if (value === '.') {
      if (!keypadValue.includes('.')) {
        setKeypadValue(keypadValue + '.')
      }
    } else {
      setKeypadValue(keypadValue + value)
    }
  }

  const confirmKeypadValue = () => {
    // Ensure non-negative values for discount and additional charge
    const numValue = parseFloat(keypadValue)
    const safeValue = (isNaN(numValue) || numValue < 0) ? '0' : keypadValue

    if (keypadTarget === 'cash') {
      setCashAmount(keypadValue)
    } else if (keypadTarget === 'digital') {
      setDigitalAmount(keypadValue)
    } else if (keypadTarget === 'discount') {
      // Prevent negative discount
      setDiscountAmount(safeValue)
    } else if (keypadTarget === 'cashin' || keypadTarget === 'cashout') {
      setCashIOAmount(keypadValue)
    } else if (keypadTarget === 'additionalCharge') {
      // Prevent negative additional charge
      setAdditionalChargeValue(safeValue)
    }
    setShowNumericKeypad(false)
    setKeypadValue('')
  }

  // Camera Functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      setError('Unable to access camera')
    }
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d')
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth
        canvasRef.current.height = videoRef.current.videoHeight
        context.drawImage(videoRef.current, 0, 0)
        const photo = canvasRef.current.toDataURL('image/jpeg')
        setDigitalPhoto(photo)
        stopCamera()
        setShowCameraDialog(false)
      }
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
    }
  }

  const handleCashIn = async () => {
    // Prevent double submission using ref (synchronous check)
    if (cashIOSubmittingRef.current) return

    if (!cashIOAmount || parseFloat(cashIOAmount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    // Confirmation before saving
    const confirmed = window.confirm(
      '✅ CONFIRM CASH IN\n\n' +
      `Amount: ₱${parseFloat(cashIOAmount).toFixed(2)}\n` +
      `Remarks: ${cashIORemarks || '(none)'}\n\n` +
      'Are you sure you want to record this Cash In transaction?'
    )
    if (!confirmed) return

    // Set ref BEFORE async state update to prevent race condition
    cashIOSubmittingRef.current = true
    setCashIOSubmitting(true)
    try {
      const res = await fetch('/api/cash/in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: currentShift.id,
          amount: parseFloat(cashIOAmount),
          remarks: cashIORemarks,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error('[Cash In Error]:', {
          status: res.status,
          statusText: res.statusText,
          errorData
        })
        const errorMessage = errorData.error || errorData.details || `HTTP ${res.status}: ${res.statusText}`
        throw new Error(errorMessage)
      }

      alert(`Cash In recorded: ₱${parseFloat(cashIOAmount).toFixed(2)}`)
      setShowCashInDialog(false)
      setCashIOAmount('')
      setCashIORemarks('')
    } catch (err: any) {
      console.error('[Cash In Exception]:', err)
      const errorMessage = err.message || 'Failed to record cash in'
      setError(errorMessage)
      alert(`Cash In Error: ${errorMessage}`)
    } finally {
      cashIOSubmittingRef.current = false
      setCashIOSubmitting(false)
    }
  }

  const handleCashOut = async () => {
    // Prevent double submission using ref (synchronous check)
    if (cashIOSubmittingRef.current) return

    if (!cashIOAmount || parseFloat(cashIOAmount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    if (!cashIORemarks) {
      setError('Remarks are required for cash out')
      return
    }

    // Confirmation before saving
    const confirmed = window.confirm(
      '✅ CONFIRM CASH OUT\n\n' +
      `Amount: ₱${parseFloat(cashIOAmount).toFixed(2)}\n` +
      `Remarks: ${cashIORemarks}\n\n` +
      'Are you sure you want to record this Cash Out transaction?'
    )
    if (!confirmed) return

    // Set ref BEFORE async state update to prevent race condition
    cashIOSubmittingRef.current = true
    setCashIOSubmitting(true)
    try {
      const res = await fetch('/api/cash/out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: currentShift.id,
          amount: parseFloat(cashIOAmount),
          remarks: cashIORemarks,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error('[Cash Out Error]:', {
          status: res.status,
          statusText: res.statusText,
          errorData
        })
        const errorMessage = errorData.error || errorData.details || `HTTP ${res.status}: ${res.statusText}`
        throw new Error(errorMessage)
      }

      alert(`Cash Out recorded: ₱${parseFloat(cashIOAmount).toFixed(2)}`)
      setShowCashOutDialog(false)
      setCashIOAmount('')
      setCashIORemarks('')
    } catch (err: any) {
      console.error('[Cash Out Exception]:', err)
      const errorMessage = err.message || 'Failed to record cash out'
      setError(errorMessage)
      alert(`Cash Out Error: ${errorMessage}`)
    } finally {
      cashIOSubmittingRef.current = false
      setCashIOSubmitting(false)
    }
  }

  const handleSaveQuotation = async () => {
    if (cart.length === 0) {
      setError('Cart is empty')
      return
    }

    if (!quotationCustomerName) {
      setError('Please enter customer name')
      return
    }

    try {
      setSavingQuotation(true) // Start loading state
      setError('') // Clear any previous errors

      const subtotal = calculateSubtotal()
      const discountAmt = calculateDiscount()
      const total = calculateTotal()

      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: quotationCustomerName,
          items: cart.map((item) => ({
            productId: item.productId,
            productVariationId: item.productVariationId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          notes: quotationNotes,
          subtotal,
          discountAmount: discountAmt,
          totalAmount: total,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        console.error('Quotation save error:', errorData)
        throw new Error(errorData.details || errorData.error || 'Failed to save quotation')
      }

      const savedData = await res.json()
      const savedQuotation = savedData.quotation

      // Store cart items before clearing for potential printing
      const cartItemsForPrint = [...cart]
      const customerNameForPrint = quotationCustomerName

      // Ask if user wants to print
      const shouldPrint = confirm(
        `✅ Quotation saved successfully!\n\nQuotation #: ${savedQuotation.quotationNumber}\n\nWould you like to print this quotation now?`
      )

      // Clear quotation dialog fields
      setShowQuotationDialog(false)
      setQuotationCustomerName('')
      setQuotationNotes('')

      // Clear cart and customer
      setCart([])
      setSelectedCustomer(null)
      setRemarks('')

      // Refresh quotations list
      await fetchQuotations()

      // If user wants to print, trigger print
      if (shouldPrint) {
        // Use the saved data with cart items for printing
        const quotationToPrint = {
          ...savedQuotation,
          items: cartItemsForPrint.map((item) => ({
            productId: item.productId,
            productVariationId: item.productVariationId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            product: {
              name: item.name,
              sku: item.sku,
            },
          })),
          customerName: customerNameForPrint,
        }
        const mockEvent = { stopPropagation: () => {} } as React.MouseEvent
        handlePrintQuotation(quotationToPrint, mockEvent)
      }
    } catch (err: any) {
      console.error('Error saving quotation:', err)
      setError(err.message)
      // Keep dialog open on error so user can see what went wrong
    } finally {
      setSavingQuotation(false) // End loading state
    }
  }

  const handleLoadQuotation = async (quotation: any) => {
    try {
      setLoadingQuotation(true) // Start loading state

      // Check stock availability first
      const res = await fetch(`/api/quotations/${quotation.id}`)

      if (!res.ok) {
        throw new Error('Failed to check stock availability')
      }

      const data = await res.json()
      const { stockStatus } = data

      // If some items are out of stock, show warning
      if (!stockStatus.allItemsAvailable) {
        const unavailableList = stockStatus.unavailableItems
          .map((item: any) =>
            `• ${item.productName} (SKU: ${item.productSku})\n  Requested: ${item.requestedQuantity}, Available: ${item.currentStock}, Short: ${item.shortage}`
          )
          .join('\n')

        const message = `⚠️ STOCK AVAILABILITY WARNING\n\n${stockStatus.unavailableCount} item(s) are out of stock or have insufficient quantity:\n\n${unavailableList}\n\nDo you want to load this quotation anyway?\n\nNote: You will need to adjust quantities or remove unavailable items before completing the sale.`

        setLoadingQuotation(false) // Stop loading before showing confirm
        if (!confirm(message)) {
          return // User cancelled
        }
        setLoadingQuotation(true) // Resume loading
      }

      // Load the quotation into cart
      const cartItems = quotation.items.map((item: any) => {
        // Find product from products list to get current details
        const product = products.find(p => p.id === item.productId)

        return {
          productId: item.productId,
          productVariationId: item.productVariationId,
          name: product?.name || 'Product',
          sku: product?.sku || product?.variations?.[0]?.sku || '',
          unitPrice: parseFloat(item.unitPrice),
          originalPrice: parseFloat(item.unitPrice),
          quantity: parseFloat(item.quantity),
          isFreebie: false,
          requiresSerial: false,
          serialNumberIds: [],
        }
      })

      setCart(cartItems)
      setShowSavedQuotations(false)

      if (quotation.customer) {
        setSelectedCustomer(quotation.customer)
      }

      const statusMsg = stockStatus.allItemsAvailable
        ? '✅ All items are available in stock!'
        : '⚠️ Some items may be out of stock - please verify quantities'

      alert(`Quotation ${quotation.quotationNumber} loaded successfully!\n\n${statusMsg}`)
    } catch (err: any) {
      console.error('Error loading quotation:', err)
      alert(`Error loading quotation: ${err.message}`)
    } finally {
      setLoadingQuotation(false) // End loading state
    }
  }

  const handleDeleteQuotation = async (quotationId: number, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent loading the quotation when clicking delete

    if (!confirm('Are you sure you want to delete this quotation?')) {
      return
    }

    setLoading(true)
    setError('')

    try {
      console.log('[POS] Deleting quotation:', quotationId)

      const res = await fetch(`/api/quotations/${quotationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('[POS] Delete response status:', res.status)

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error('[POS] Delete error:', errorData)
        throw new Error(errorData.error || errorData.details || 'Failed to delete quotation')
      }

      const data = await res.json()
      console.log('[POS] Delete success:', data)

      alert('Quotation deleted successfully!')
      await fetchQuotations() // Refresh the list
    } catch (err: any) {
      console.error('[POS] Error deleting quotation:', err)
      setError(err.message || 'Failed to delete quotation')
      alert(`Error: ${err.message || 'Failed to delete quotation'}`)
    } finally {
      setLoading(false)
    }
  }

  const handlePrintQuotation = (quotation: any, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent loading the quotation when clicking print

    // Set the quotation to print and open the print dialog
    setQuotationToPrint(quotation)
    setShowQuotationPrint(true)
  }

  const handleCreateCustomer = async () => {
    if (!newCustomerName) {
      setError('Customer name is required')
      return
    }

    // Check if customer name already exists (case-insensitive)
    const existingCustomer = customers.find(c =>
      c.name.toLowerCase().trim() === newCustomerName.toLowerCase().trim()
    )

    if (existingCustomer) {
      setError(`Customer name "${newCustomerName}" already exists. Please use a different name.`)
      return
    }

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustomerName,
          email: newCustomerEmail || null,
          mobile: newCustomerPhone || null,
          address: newCustomerAddress || null,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to create customer')
      }

      const data = await res.json()

      setCustomers([...customers, data])
      setSelectedCustomer(data)
      setShowNewCustomerDialog(false)
      setNewCustomerName('')
      setNewCustomerEmail('')
      setNewCustomerPhone('')
      setNewCustomerAddress('')

      alert('Customer created successfully!')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleCheckout = async () => {
    // Prevent double submission (React state)
    if (isSubmitting) {
      console.log('[POS] Checkout already in progress - ignoring duplicate click')
      return
    }

    // Check localStorage protection (survives page refresh)
    // Constants defined at top of function for access in finally block
    const SALE_LOCK_KEY = 'pos_sale_in_progress'  // Must match in finally block
    const LOCK_TIMEOUT_MS = 60000 // 60 seconds lock timeout
    const existingLock = localStorage.getItem(SALE_LOCK_KEY)

    if (existingLock) {
      const lockData = JSON.parse(existingLock)
      const lockAge = Date.now() - lockData.timestamp

      if (lockAge < LOCK_TIMEOUT_MS) {
        const secondsRemaining = Math.ceil((LOCK_TIMEOUT_MS - lockAge) / 1000)
        alert(
          `⚠️ SALE IN PROGRESS\n\n` +
          `A sale was started ${Math.floor(lockAge / 1000)} seconds ago.\n` +
          `Please wait ${secondsRemaining} more seconds before trying again.\n\n` +
          `If you're certain the previous sale failed, wait for the timeout or refresh the page after ${secondsRemaining} seconds.`
        )
        console.log('[POS] Sale blocked by localStorage lock - previous sale still in progress')
        return
      } else {
        // Lock expired, clear it
        console.log('[POS] Clearing expired sale lock')
        localStorage.removeItem(SALE_LOCK_KEY)
      }
    }

    if (cart.length === 0) {
      setError('Cart is empty')
      return
    }

    // Validate sales personnel selection (required field)
    if (!selectedSalesPersonnel) {
      setError('Please select a Sales Personnel before completing the sale')
      return
    }

    // Validate item remarks for discounted items (required when discount > 0)
    const itemsWithMissingRemarks = cart.filter(
      (item) => item.itemDiscountAmount > 0 && !item.itemRemark?.trim()
    )
    if (itemsWithMissingRemarks.length > 0) {
      const productNames = itemsWithMissingRemarks
        .map((item) => item.name)
        .slice(0, 3)
        .join(', ')
      const moreCount = itemsWithMissingRemarks.length > 3
        ? ` and ${itemsWithMissingRemarks.length - 3} more`
        : ''
      setError(`Please add remarks for discounted items: ${productNames}${moreCount}`)
      return
    }

    // CONFIRMATION DIALOG - Warn user to check their sale before completing
    const total = calculateTotal()
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
    const confirmed = window.confirm(
      '⚠️ PLEASE DOUBLE-CHECK BEFORE PROCEEDING\n\n' +
      `Total Items: ${itemCount}\n` +
      `Total Amount: ₱${total.toFixed(2)}\n\n` +
      '💳 PAYMENT DETAILS:\n' +
      `   Cash: ₱${cashAmount || '0.00'}\n` +
      `   Digital (${digitalMethod || 'N/A'}): ₱${digitalAmount || '0.00'}\n` +
      `   Cheque: ₱${chequeAmount || '0.00'}\n\n` +
      '✓ Have you verified the PAYMENT TYPES are correct?\n' +
      '✓ Have you verified the PAYMENT AMOUNTS are correct?\n' +
      '✓ Have you checked all items are correct?\n' +
      '✓ Have you entered the correct customer details?\n\n' +
      '⏱️ TAKE YOUR TIME - Do not rush!\n\n' +
      'Click OK to proceed with sale or Cancel to review.'
    )

    if (!confirmed) {
      console.log('[POS] User cancelled checkout - reviewing sale')
      return // User cancelled - do not proceed
    }

    // Credit sale validation
    if (isCreditSale) {
      if (!selectedCustomer) {
        setError('Please select a customer for credit sales')
        return
      }
    }

    // Payment validation for non-credit sales
    if (!isCreditSale) {
      const totalPayments = getTotalPayments()
      const totalDue = calculateTotal()

      if (totalDue > 0 && totalPayments === 0) {
        setError(`Insufficient payment. Due: ₱${totalDue.toFixed(2)}, Paid: ₱${totalPayments.toFixed(2)}. Please enter the amount tendered.`)
        return
      }

      if (totalPayments < totalDue) {
        setError(`Insufficient payment. Due: ₱${totalDue.toFixed(2)}, Paid: ₱${totalPayments.toFixed(2)}`)
        return
      }

      // Digital payment photo is optional - validation removed for better UX
      // if (digitalAmount && parseFloat(digitalAmount) > 0 && !digitalPhoto) {
      //   setError('Please capture digital payment receipt photo')
      //   return
      // }

      // Validate digital payment method
      if (digitalAmount && parseFloat(digitalAmount) > 0) {
        if (!digitalMethod || digitalMethod.trim() === '') {
          setError('Please select a payment method for digital payment')
          return
        }
      }

      // Validate cheque details if cheque payment exists
      if (chequeAmount && parseFloat(chequeAmount) > 0) {
        if (!chequeNumber) {
          setError('Please enter cheque number')
          return
        }
        if (!chequeBank) {
          setError('Please enter bank name for cheque')
          return
        }
      }
    }

    // Validate discount information
    if (discountType === 'senior') {
      if (!seniorCitizenId || !seniorCitizenName) {
        setError('Please enter Senior Citizen ID and Name')
        return
      }
    } else if (discountType === 'pwd') {
      if (!pwdId || !pwdName) {
        setError('Please enter PWD ID and Name')
        return
      }
    }

    // Serial numbers are now OPTIONAL at checkout
    // No validation required - user adds them manually if needed

    setLoading(true)
    setIsSubmitting(true) // Lock to prevent double submission
    setError('')

    // Set localStorage lock BEFORE making API call (survives page refresh)
    localStorage.setItem(SALE_LOCK_KEY, JSON.stringify({
      timestamp: Date.now(),
      cartTotal: calculateTotal(),
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    }))
    console.log('[POS] Sale lock set in localStorage')

    try {
      const subtotal = calculateSubtotal()
      const discountAmt = calculateDiscount()
      const total = calculateTotal()

      // Build payments array - IMPORTANT: Send actual payment amounts, not tendered amounts
      // For cash, we send the payment amount (capped at sale total), not the tendered amount
      // This ensures runningCashSales tracks actual cash received, not cash+change
      const payments: any[] = []
      if (!isCreditSale) {
        let remainingBalance = total

        if (cashAmount && parseFloat(cashAmount) > 0) {
          // Cash payment is the LESSER of: (cash tendered) OR (remaining balance)
          // Example: Sale=2970, Tendered=3000 → Payment=2970, Change=30
          const cashTendered = parseFloat(cashAmount)
          const cashPayment = Math.min(cashTendered, remainingBalance)
          payments.push({
            method: 'cash',
            amount: cashPayment,  // Actual payment received (excludes change)
          })
          remainingBalance -= cashPayment
        }
        if (digitalAmount && parseFloat(digitalAmount) > 0) {
          const digitalPayment = Math.min(parseFloat(digitalAmount), remainingBalance)
          payments.push({
            method: digitalMethod,
            amount: digitalPayment,
            reference: digitalReference || null,
            photo: digitalPhoto || null,
          })
          remainingBalance -= digitalPayment
        }
        if (chequeAmount && parseFloat(chequeAmount) > 0) {
          const chequePayment = Math.min(parseFloat(chequeAmount), remainingBalance)
          payments.push({
            method: 'cheque',
            amount: chequePayment,
            reference: chequeNumber || null,
            chequeBank: chequeBank || null,
            chequeDate: chequeDate || null,
          })
          remainingBalance -= chequePayment
        }
      }

      // Calculate total item-level discounts for the sale record
      const totalItemDiscounts = calculateTotalItemDiscounts()

      const saleData: any = {
        locationId: currentShift.locationId,
        customerId: selectedCustomer?.id,
        saleDate: new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString(), // Manila is UTC+8
        items: cart.map((item) => ({
          productId: item.productId,
          productVariationId: item.productVariationId,
          quantity: item.quantity,  // ALWAYS in base unit for inventory
          unitPrice: item.unitPrice,
          isFreebie: item.isFreebie,
          // Set requiresSerial=true if user added serial numbers (via IDs or manual text entry)
          requiresSerial: (item.serialNumberIds && item.serialNumberIds.length > 0) ||
                          (item.serialNumbers && item.serialNumbers.length > 0),
          serialNumberIds: item.serialNumberIds || [],
          serialNumbers: item.serialNumbers || [],  // Manual text entries
          // UOM fields - for display/reporting
          subUnitId: item.subUnitId || null,
          subUnitPrice: item.subUnitPrice || null,
          displayQuantity: item.displayQuantity || null,  // Display quantity (e.g., 100 Meters)
          selectedUnitName: item.selectedUnitName || null,  // Display unit name (e.g., "Meter")
          // Per-item discount fields
          discountType: item.itemDiscountType || null,
          discountValue: item.itemDiscountValue || null,
          discountAmount: item.itemDiscountAmount || 0,
          // Per-item remark (required when discount > 0)
          remark: item.itemRemark || null,
          // Service item flag (no inventory deduction)
          notForSelling: item.notForSelling || false,
        })),
        payments,
        // Sale-level discountAmount = item discounts + sale-level discount (Senior/PWD)
        discountAmount: totalItemDiscounts + discountAmt,
        // Separate fields for reporting
        itemDiscountsTotal: totalItemDiscounts,
        saleLevelDiscount: discountAmt,
        // Additional Charge (uses shippingCost field) - for all sales types
        shippingCost: calculateAdditionalCharge(),
        status: isCreditSale ? 'pending' : 'completed',
        freebieTotal: freebieTotal,
        // Cash tendered (for invoice display of change)
        cashTendered: cashAmount && parseFloat(cashAmount) > 0 ? parseFloat(cashAmount) : null,
        // Remarks field
        remarks: remarks || null,
        // Sales personnel tracking (required)
        salesPersonnelId: selectedSalesPersonnel?.id,
      }

      // Add discount information
      if (discountType === 'senior') {
        saleData.discountType = 'senior'
        saleData.seniorCitizenId = seniorCitizenId
        saleData.seniorCitizenName = seniorCitizenName
        saleData.vatExempt = true
      } else if (discountType === 'pwd') {
        saleData.discountType = 'pwd'
        saleData.pwdId = pwdId
        saleData.pwdName = pwdName
        saleData.vatExempt = true
      } else if (discountType === 'regular') {
        saleData.discountType = 'regular'
      }

      // Use bulletproof API client with retry logic and offline queue
      console.log('[POS] Submitting sale with apiPost (with retry and offline queue)')
      console.log('[POS] Sale Data:', JSON.stringify(saleData, null, 2))
      const data = await apiPost('/api/sales', saleData, {
        maxRetries: 3, // Retry up to 3 times
        retryDelay: 1000, // Start with 1 second delay
        queueIfOffline: true, // Queue if offline
      })

      // Update footer status
      const saleAmount = calculateTotal()
      setLastSaleAmount(saleAmount)
      setTodaysSalesTotal(prev => prev + saleAmount)
      setCurrentTransaction(data.invoiceNumber)

      // Refresh product list to get updated stock levels
      fetchProducts()

      // Clear everything
      setCart([])
      setDiscountType('none')
      setDiscountAmount('')
      setSeniorCitizenId('')
      setSeniorCitizenName('')
      setPwdId('')
      setPwdName('')
      setCashAmount('')
      setDigitalAmount('')
      setDigitalMethod('')
      setDigitalReference('')
      setDigitalPhoto('')
      setChequeAmount('')
      setChequeNumber('')
      setChequeBank('')
      setChequeDate('')
      setSelectedCustomer(null) // Reset to Walk-in Customer
      setIsCreditSale(false)
      setRemarks('') // Reset remarks
      // Reset additional charge
      setAdditionalChargeType('fixed')
      setAdditionalChargeValue('')
      // Reset sales personnel (user must select again for next sale)
      setSelectedSalesPersonnel(null)

      const changeAmount = calculateChange()

      // Show invoice print dialog
      setCompletedSale(data)
      setShowInvoice(true)

      // Also show a brief success message
      const message = `Sale completed! Invoice: ${data.invoiceNumber}`
      setTimeout(() => alert(message), 100)
    } catch (err: any) {
      console.error('[POS] Sale submission failed:', err)
      setError(err.message)

      // Show user-friendly error messages
      if (err.message.includes('queued')) {
        alert('⚠️ No internet connection. Sale has been queued and will be submitted when connection is restored.')
      } else if (err.message.includes('retry')) {
        alert('⚠️ Sale submission failed after multiple attempts. Please check your connection and try again.')
      }
    } finally {
      setLoading(false)
      setIsSubmitting(false) // Always release lock
      // Clear localStorage lock on completion (success or failure)
      localStorage.removeItem(SALE_LOCK_KEY)
      console.log('[POS] Sale lock cleared from localStorage')
    }
  }

  // Filter products by category AND search term
  const filteredProducts = products.filter((p) => {
    // Category filter
    const matchesCategory = selectedCategory === 'all' || p.categoryId?.toString() === selectedCategory

    // Search filter (if search term exists)
    const matchesSearch = !searchTerm ||
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.variations?.some((v: any) => v.sku?.toLowerCase().includes(searchTerm.toLowerCase()))

    return matchesCategory && matchesSearch
  })

  // Pagination calculations
  const indexOfLastProduct = currentPage * itemsPerPage
  const indexOfFirstProduct = indexOfLastProduct - itemsPerPage
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct)
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)

  // Permission check for regular discount feature
  const canApplyDiscount = session?.user ? hasPermission(
    session.user as unknown as RBACUser,
    PERMISSIONS.FREEBIE_ADD
  ) : false

  // 🧪 TEST FUNCTION: Add random items to cart for testing bulk sales
  const addRandomItemsToCart = () => {
    if (products.length === 0) {
      setError('No products available. Please wait for products to load.')
      setTimeout(() => setError(''), 3000)
      return
    }

    // Get products with stock at current location
    const availableProducts = products.filter(product => {
      const variation = product.variations?.[0]
      if (!variation) return false

      const locationStock = variation.variationLocationDetails?.find(
        (vl: any) => vl.locationId === currentShift?.locationId
      )
      return locationStock && parseFloat(locationStock.qtyAvailable) > 0
    })

    if (availableProducts.length === 0) {
      setError('No products with stock available at this location')
      setTimeout(() => setError(''), 3000)
      return
    }

    // Randomly select 20-25 items
    const itemCount = 20 + Math.floor(Math.random() * 6) // Random number between 20-25
    const selectedProducts = []

    for (let i = 0; i < Math.min(itemCount, availableProducts.length); i++) {
      const randomIndex = Math.floor(Math.random() * availableProducts.length)
      selectedProducts.push(availableProducts[randomIndex])
    }

    // Add each selected product to cart
    console.log(`[TEST] Adding ${selectedProducts.length} random items to cart`)
    selectedProducts.forEach(product => {
      addToCart(product, false)
    })

    console.log(`[TEST] Successfully added ${selectedProducts.length} items to cart`)
  }

  // Check if user has location assignments
  if (!locationsLoading && !isLocationUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="w-[500px]">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-4xl">🚫</div>
              <h2 className="text-xl font-semibold text-red-600">Access Restricted</h2>
              <p className="text-sm text-muted-foreground">
                POS access is only available for users assigned to specific locations.
              </p>
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded border border-amber-200">
                Please contact your administrator to assign you to a location before using the POS system.
              </p>
              <Button
                onClick={() => router.push('/dashboard')}
                className="mt-4"
              >
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!currentShift) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-4xl">⏳</div>
              <h2 className="text-xl font-semibold">Checking Shift Status...</h2>
              <p className="text-sm text-muted-foreground">
                Please wait while we verify your active shift
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Top Navigation Bar - Company & Cashier Info */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 flex items-center justify-between shadow-xl">
        {/* LEFT: Company Info & Terminal */}
        <div className="flex items-center space-x-6">
          <div>
            <h1 className="text-xl font-bold">PciNet Computer</h1>
            <p className="text-sm text-blue-200">Trading and Services</p>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-sm bg-blue-500 px-4 py-1 rounded-full font-medium">Terminal #1</span>
            {currentShift?.location?.name && (
              <span className="text-xs bg-green-500 px-3 py-1 rounded-full font-medium text-center">
                📍 {currentShift.location.name}
              </span>
            )}
          </div>
        </div>

        {/* CENTER: Sales Information */}
        <div className="flex items-center space-x-8 bg-blue-500/30 px-6 py-2 rounded-lg">
          <div className="text-center">
            <p className="text-xs text-blue-200">Last Sale</p>
            <p className="text-lg font-bold text-yellow-300">
              ₱{lastSaleAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-px h-10 bg-blue-400"></div>
          <div className="text-center">
            <p className="text-xs text-blue-200">Today's Sales</p>
            <p className="text-lg font-bold text-green-300">
              ₱{todaysSalesTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* RIGHT: Cashier Info & Time */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="text-sm">
              <p className="font-semibold">Cashier: {session?.user?.name || 'Unknown'}</p>
              <p className="text-xs text-blue-200">Shift: {currentShift.shiftNumber}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-blue-500/50 px-3 py-2 rounded-lg">
            <span className="text-sm font-medium">
              {new Date().toLocaleTimeString('en-US', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Product Search Bar (Top) */}
      <div className="px-4 py-3 bg-white border-b shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input
              ref={barcodeInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 Scan barcode or search product (SKU, Name)... Press Ctrl+S to focus"
              className="text-xl h-14 font-semibold border-2 border-blue-400 focus:border-blue-600"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  if (showSearchDropdown && searchResults.length > 0) {
                    setSelectedSearchIndex((prev) =>
                      prev < searchResults.length - 1 ? prev + 1 : 0
                    )
                  }
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  if (showSearchDropdown && searchResults.length > 0) {
                    setSelectedSearchIndex((prev) =>
                      prev > 0 ? prev - 1 : searchResults.length - 1
                    )
                  }
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  if (showSearchDropdown && searchResults.length > 0) {
                    // Add selected product from dropdown
                    const selectedProduct = searchResults[selectedSearchIndex]
                    addToCart(selectedProduct, false)
                    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS75+mfTQ0OTqni77dhGgU7k')
                    audio.play().catch(() => {})
                    setSearchTerm('')
                    setShowSearchDropdown(false)
                  } else {
                    // No dropdown, trigger barcode search
                    const value = e.currentTarget.value
                    if (value) {
                      handleBarcodeScanned(value)
                    }
                  }
                } else if (e.key === 'Escape') {
                  setShowSearchDropdown(false)
                  setSearchTerm('')
                }
              }}
            />
            {quantityMultiplier && (
              <p className="text-sm text-green-600 mt-1 font-semibold">
                ✓ Next product will be added with quantity: {quantityMultiplier}
              </p>
            )}

            {/* Search Results Dropdown */}
            {showSearchDropdown && searchResults.length > 0 && (
              <div
                className="absolute left-4 right-4 mt-1 bg-white border-2 border-blue-400 rounded-lg shadow-2xl z-50 max-h-[700px] overflow-y-auto scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-gray-200"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#60a5fa #e5e7eb' }}
              >
                <div className="p-2">
                  <div className="text-xs text-gray-500 mb-2 px-2">
                    Found {searchResults.length} product{searchResults.length !== 1 ? 's' : ''} (Use ↑↓ arrows, Enter to select)
                  </div>
                  {searchResults.map((product, index) => {
                    const variation = product.variations?.[0]
                    const locationStock = variation?.variationLocationDetails?.find(
                      (vl: any) => vl.locationId === currentShift?.locationId
                    )
                    const stockQty = locationStock ? parseFloat(locationStock.qtyAvailable) : 0

                    return (
                      <div
                        key={product.id}
                        ref={(el) => (searchResultRefs.current[index] = el)}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          index === selectedSearchIndex
                            ? 'bg-blue-100 border-2 border-blue-500 shadow-md'
                            : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                        }`}
                        onClick={() => {
                          addToCart(product, false)
                          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS75+mfTQ0OTqni77dhGgU7k')
                          audio.play().catch(() => {})
                          setSearchTerm('')
                          setShowSearchDropdown(false)
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-bold text-lg text-gray-800">{product.name}</div>
                            <div className="text-sm text-gray-600">
                              SKU: {product.sku} | Price: ₱{parseFloat(locationStock?.sellingPrice || variation?.sellingPrice || 0).toFixed(2)}
                            </div>
                          </div>
                          <div className={`text-sm font-semibold px-3 py-1 rounded ${
                            stockQty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            Stock: {stockQty}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Compact Action Buttons */}
          {hasPermission(session?.user as RBACUser, PERMISSIONS.PACKAGE_TEMPLATE_VIEW) && (
            <Button
              onClick={() => {
                fetchPackages()
                setShowPackageDialog(true)
              }}
              className="h-12 px-4 bg-purple-600 hover:bg-purple-700 text-white"
              title="Load Package Template"
            >
              📦 Package
            </Button>
          )}
          <Button
            onClick={() => window.open('/dashboard/readings/x-reading', '_blank')}
            className="h-12 px-4 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title={cart.length > 0 ? "Complete or clear current sale first" : "X Reading"}
            disabled={cart.length > 0}
          >
            📊 X Read
          </Button>
          <Button
            onClick={() => {
              const confirmed = window.confirm(
                '💵 CASH IN TRANSACTION\n\n' +
                'You are about to record a Cash In transaction.\n\n' +
                'Cash In is used for:\n' +
                '• Beginning cash/change fund\n' +
                '• Additional cash from owner/manager\n' +
                '• Cash corrections\n\n' +
                'Are you sure you want to proceed?'
              )
              if (confirmed) {
                setCashIOAmount('')
                setCashIORemarks('')
                setShowCashInDialog(true)
              }
            }}
            className="h-12 px-4 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title={cart.length > 0 ? "Complete or clear current sale first" : "Cash In"}
            disabled={cart.length > 0}
          >
            💵 Cash In
          </Button>
          <Button
            onClick={() => {
              const confirmed = window.confirm(
                '💸 CASH OUT TRANSACTION\n\n' +
                'You are about to record a Cash Out transaction.\n\n' +
                'Cash Out is used for:\n' +
                '• Petty cash expenses\n' +
                '• Cash pickups by manager\n' +
                '• Cash corrections\n\n' +
                'Are you sure you want to proceed?'
              )
              if (confirmed) {
                setCashIOAmount('')
                setCashIORemarks('')
                setShowCashOutDialog(true)
              }
            }}
            className="h-12 px-4 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title={cart.length > 0 ? "Complete or clear current sale first" : "Cash Out"}
            disabled={cart.length > 0}
          >
            💸 Cash Out
          </Button>
          <Button
            onClick={() => {
              if (!selectedCustomer) {
                setError('Please select a customer first')
                setTimeout(() => setError(''), 3000)
                return
              }
              setShowARPaymentDialog(true)
            }}
            className="h-12 px-4 bg-yellow-600 hover:bg-yellow-700 text-white relative disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              cart.length > 0
                ? "Complete or clear current sale first"
                : !selectedCustomer
                  ? "Select a customer first to collect AR payment"
                  : `Collect AR Payment from ${selectedCustomer.name}`
            }
            disabled={cart.length > 0 || !selectedCustomer}
          >
            💳 AR Pay
            {(() => {
              const customersWithAR = customers.filter(c => c.hasUnpaidInvoices && c.arBalance > 0).length
              return customersWithAR > 0 ? (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
                  {customersWithAR}
                </span>
              ) : null
            })()}
          </Button>          <Button onClick={() => { if (cart.length === 0) { setError('Cart is empty'); setTimeout(() => setError(''), 3000); return; } setShowQuotationDialog(true); }} className="h-12 px-4 bg-purple-600 hover:bg-purple-700 text-white">📋 Save</Button>
          <Button
            onClick={() => setShowSavedQuotations(true)}
            className="h-12 px-4 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title={cart.length > 0 ? "Complete or clear current sale first" : "Load Quotation"}
            disabled={cart.length > 0}
          >
            📂 Load
          </Button>
          <Button onClick={() => setShowHoldDialog(true)} className="h-12 px-4 bg-amber-500 hover:bg-amber-600 text-white">⏸️ Hold</Button>
          <Button
            onClick={() => setShowHeldTransactions(true)}
            className="h-12 px-4 bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title={cart.length > 0 ? "Complete or clear current sale first" : "Retrieve Held Transaction"}
            disabled={cart.length > 0}
          >
            ▶️ Retrieve
          </Button>
          <Button
            onClick={() => setShowExchangeDialog(true)}
            className="h-12 px-4 bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title={cart.length > 0 ? "Complete or clear current sale first" : "Process Exchange (F7)"}
            disabled={cart.length > 0}
          >
            🔄 Exchange
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-2 animate-blink rounded-lg border-2 border-red-700 bg-red-600 text-white text-sm font-semibold text-center py-3 shadow-[0_0_18px_rgba(220,38,38,0.75)]">
          <div className="flex items-center justify-center gap-3 uppercase tracking-wide">
            <span className="text-xl">⚠️</span>
            <span>{error}</span>
            <span className="text-xl">⚠️</span>
          </div>
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="flex-1 flex overflow-hidden gap-0">
        {/* LEFT SIDE - CART ITEMS (70%) */}
        <div className="flex-[0.7] min-w-0 bg-white border-r flex flex-col shadow-lg overflow-hidden">
          {/* Customer & Sales Personnel - Single Line Header */}
          <div className="p-2 border-b bg-gradient-to-r from-gray-50 to-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              {/* Customer Selection */}
              <Label className="text-xs font-medium shrink-0 text-gray-700">Customer:</Label>
              <div className="flex-1 relative min-w-0">
                <Input
                  type="text"
                  value={selectedCustomer ? selectedCustomer.name : customerSearchTerm}
                  onChange={(e) => {
                    if (!selectedCustomer) {
                      setCustomerSearchTerm(e.target.value)
                      if (!e.target.value) {
                        setSelectedCustomer(null)
                        setIsCreditSale(false)
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      if (showCustomerDropdown && customerSearchResults.length > 0) {
                        setSelectedCustomerIndex((prev) =>
                          prev < customerSearchResults.length - 1 ? prev + 1 : 0
                        )
                      }
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      if (showCustomerDropdown && customerSearchResults.length > 0) {
                        setSelectedCustomerIndex((prev) =>
                          prev > 0 ? prev - 1 : customerSearchResults.length - 1
                        )
                      }
                    } else if (e.key === 'Enter') {
                      e.preventDefault()
                      if (showCustomerDropdown && customerSearchResults[selectedCustomerIndex]) {
                        const customer = customerSearchResults[selectedCustomerIndex]
                        setSelectedCustomer(customer)
                        setCustomerSearchTerm('')
                        setShowCustomerDropdown(false)
                      }
                    } else if (e.key === 'Escape') {
                      setShowCustomerDropdown(false)
                      setCustomerSearchTerm('')
                    }
                  }}
                  placeholder={selectedCustomer ? '' : '🚶 Walk-in (search to change)...'}
                  className={`h-8 text-sm border ${
                    selectedCustomer
                      ? 'bg-green-50 border-green-500 font-semibold text-green-800 pr-7'
                      : 'border-gray-300 focus:border-blue-500'
                  }`}
                  readOnly={!!selectedCustomer}
                />
                {selectedCustomer && (
                  <button
                    onClick={() => {
                      setSelectedCustomer(null)
                      setCustomerSearchTerm('')
                      setIsCreditSale(false)
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center hover:bg-red-600 font-bold text-xs"
                    title="Clear customer"
                  >
                    ✕
                  </button>
                )}
                {showCustomerDropdown && customerSearchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-blue-400 rounded-lg shadow-2xl z-50 max-h-[300px] overflow-y-auto">
                    <div className="p-2">
                      <div className="text-xs text-gray-500 mb-2 px-2">
                        Found {customerSearchResults.length} customer{customerSearchResults.length !== 1 ? 's' : ''} (↑↓ Enter)
                      </div>
                      {customerSearchResults.map((customer, index) => (
                        <div
                          key={customer.id}
                          ref={(el) => (customerResultRefs.current[index] = el)}
                          className={`p-2 rounded-lg cursor-pointer transition-all ${
                            index === selectedCustomerIndex
                              ? 'bg-blue-100 border-2 border-blue-500 shadow-md'
                              : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                          }`}
                          onClick={() => {
                            setSelectedCustomer(customer)
                            setCustomerSearchTerm('')
                            setShowCustomerDropdown(false)
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-sm text-gray-800">{customer.name}</div>
                            {customer.hasUnpaidInvoices && (
                              <div className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded border border-red-300">
                                AR: ₱{customer.arBalance.toFixed(2)}
                              </div>
                            )}
                          </div>
                          {customer.email && (
                            <div className="text-xs text-gray-600">{customer.email}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-2 text-xs"
                size="sm"
                onClick={() => setShowNewCustomerDialog(true)}
              >
                + New
              </Button>
              {selectedCustomer?.hasUnpaidInvoices && selectedCustomer?.arBalance > 0 && (
                <Button
                  onClick={() => setShowARPaymentDialog(true)}
                  className="bg-red-600 hover:bg-red-700 text-white h-8 px-2 text-xs font-bold"
                  size="sm"
                  title={`Outstanding AR: ₱${selectedCustomer.arBalance.toFixed(2)}`}
                >
                  AR
                </Button>
              )}

              {/* Divider */}
              <div className="h-6 w-px bg-gray-300 shrink-0"></div>

              {/* Sales Personnel */}
              <Label className="text-xs font-medium shrink-0 text-blue-800">
                Sales<span className="text-red-500">*</span>
              </Label>
              <Select
                value={selectedSalesPersonnel?.id?.toString() || ''}
                onValueChange={(value) => {
                  const person = salesPersonnel.find(p => p.id.toString() === value)
                  setSelectedSalesPersonnel(person || null)
                }}
              >
                <SelectTrigger className={`h-8 text-sm border w-48 ${!selectedSalesPersonnel ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}`}>
                  <SelectValue placeholder="-- Select --" />
                </SelectTrigger>
                <SelectContent>
                  {salesPersonnel.map((person) => (
                    <SelectItem key={person.id} value={person.id.toString()}>
                      {person.fullName} ({person.employeeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cart Items - EXPANDED TO FILL MOST OF SIDEBAR */}
          <div className="flex-1 overflow-y-auto p-4">
            <h2 className="font-bold text-xl mb-4 flex items-center justify-between border-b pb-3">
              <span>🛒 Cart Items ({cart.length})</span>
              {cart.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 text-sm"
                  onClick={() => setShowClearCartConfirm(true)}
                >
                  Clear All
                </Button>
              )}
            </h2>
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <div className="text-8xl mb-6">🛒</div>
                <p className="text-2xl font-medium">Empty Cart</p>
                <p className="text-lg mt-2">Scan or search products to begin</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-3 p-4 bg-gradient-to-r from-blue-50 to-white rounded-xl border-2 border-blue-200 shadow-md hover:shadow-lg transition-all"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="font-bold text-lg truncate" title={item.name}>
                          {item.name}
                          {item.isFreebie && (
                            <span className="ml-2 text-xs bg-green-500 text-white px-2 py-1 rounded">
                              FREE
                            </span>
                          )}
                          {item.requiresSerial && (
                            <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">
                              SERIAL
                            </span>
                          )}
                        </p>
                        <p className="text-base font-semibold text-gray-600 mt-1">
                          ₱{item.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {item.displayQuantity || item.quantity} {item.selectedUnitName || ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* ALWAYS show +/- controls - they now work for both primary and sub-units */}
                        <Button
                          size="sm"
                          className="h-10 w-10 p-0 text-xl bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg shadow"
                          onClick={() => updateQuantity(index, item.selectedUnitName ? item.displayQuantity - 1 : item.quantity - 1, item.selectedUnitName)}
                        >
                          −
                        </Button>
                        <Input
                          type="number"
                          value={item.selectedUnitName ? item.displayQuantity : item.quantity}
                          onChange={(e) =>
                            updateQuantity(index, parseInt(e.target.value) || 1, item.selectedUnitName)
                          }
                          className="w-20 text-center h-10 text-xl font-black border-2 border-blue-400 rounded-lg bg-white text-gray-900"
                        />
                        <Button
                          size="sm"
                          className="h-10 w-10 p-0 text-xl bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg shadow"
                          onClick={() => updateQuantity(index, item.selectedUnitName ? item.displayQuantity + 1 : item.quantity + 1, item.selectedUnitName)}
                        >
                          +
                        </Button>
                        {item.selectedUnitName && (
                          <span className="text-sm font-semibold text-amber-700 ml-2">
                            {item.selectedUnitName}
                          </span>
                        )}
                      </div>
                      <div className="text-right min-w-[100px] shrink-0">
                        {/* Show original line total */}
                        <p className={`font-bold text-xl ${item.itemDiscountAmount > 0 ? 'text-gray-400 line-through text-base' : 'text-blue-600'}`}>
                          ₱{(item.unitPrice * (item.displayQuantity && item.selectedUnitName ? item.displayQuantity : item.quantity)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        {/* Show discounted total if discount applied */}
                        {item.itemDiscountAmount > 0 && (
                          <p className="font-bold text-xl text-green-600">
                            ₱{((item.unitPrice * (item.displayQuantity && item.selectedUnitName ? item.displayQuantity : item.quantity)) - item.itemDiscountAmount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:bg-red-100 h-10 w-10 p-0 shrink-0"
                        onClick={() => removeFromCart(index)}
                        aria-label="Remove product from cart"
                        title="Remove product from cart"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>

                    {/* Per-Item Discount Controls */}
                    {!item.isFreebie && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 font-medium">Discount:</span>
                          <div className="flex items-center gap-1 flex-1">
                            <Button
                              size="sm"
                              variant={item.itemDiscountType === 'percentage' ? 'default' : 'outline'}
                              className={`h-8 px-2 text-xs ${item.itemDiscountType === 'percentage' ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                              onClick={() => {
                                if (item.itemDiscountType === 'percentage') {
                                  updateItemDiscount(index, null, 0)
                                } else {
                                  updateItemDiscount(index, 'percentage', item.itemDiscountValue || 0)
                                }
                              }}
                            >
                              %
                            </Button>
                            <Button
                              size="sm"
                              variant={item.itemDiscountType === 'fixed' ? 'default' : 'outline'}
                              className={`h-8 px-2 text-xs ${item.itemDiscountType === 'fixed' ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                              onClick={() => {
                                if (item.itemDiscountType === 'fixed') {
                                  updateItemDiscount(index, null, 0)
                                } else {
                                  updateItemDiscount(index, 'fixed', item.itemDiscountValue || 0)
                                }
                              }}
                            >
                              ₱
                            </Button>
                            {item.itemDiscountType && (
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={item.itemDiscountValue || ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0
                                  // Prevent negative values
                                  if (val >= 0) {
                                    updateItemDiscount(index, item.itemDiscountType, val)
                                  }
                                }}
                                onKeyDown={(e) => {
                                  // Block minus sign key press
                                  if (e.key === '-' || e.key === 'Minus') {
                                    e.preventDefault()
                                  }
                                }}
                                placeholder="0"
                                className="h-8 w-24 text-sm text-center border-orange-300 focus:border-orange-500"
                              />
                            )}
                            {item.itemDiscountAmount > 0 && (
                              <span className="text-sm font-semibold text-orange-600 ml-2">
                                -₱{item.itemDiscountAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Item Remark Input - Shows when discount type is selected */}
                        {item.itemDiscountType && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium whitespace-nowrap ${
                                item.itemDiscountAmount > 0 && !item.itemRemark?.trim()
                                  ? 'text-red-600' : 'text-gray-600'
                              }`}>
                                Remark{item.itemDiscountAmount > 0 ? ' *' : ''}:
                              </span>
                              <Input
                                type="text"
                                value={item.itemRemark || ''}
                                onChange={(e) => updateItemRemark(index, e.target.value)}
                                placeholder={item.itemDiscountAmount > 0
                                  ? 'Required: Reason for discount...'
                                  : 'Optional: Add a note...'}
                                className={`h-8 flex-1 text-sm ${
                                  item.itemDiscountAmount > 0 && !item.itemRemark?.trim()
                                    ? 'border-red-400 focus:border-red-500 bg-red-50 dark:bg-red-950'
                                    : 'border-gray-300 focus:border-blue-500'
                                }`}
                                maxLength={500}
                              />
                            </div>
                            {item.itemDiscountAmount > 0 && !item.itemRemark?.trim() && (
                              <p className="text-xs text-red-500 mt-1 ml-16">
                                Remark is required when discount is applied
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* UOM (Unit of Measure) Selector - HIDDEN BY USER REQUEST */}
                    {/* COMMENTED OUT - Can be re-enabled in the future if needed */}
                    {/* <div className="mt-2 pt-2 border-t-2 border-amber-300">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-sm h-10 bg-gradient-to-r from-amber-100 to-amber-50 border-2 border-amber-500 text-amber-900 hover:from-amber-200 hover:to-amber-100 font-semibold shadow-sm"
                        onClick={() => setShowUnitSelector(showUnitSelector === index ? null : index)}
                      >
                        📏 Selling in: <span className="font-bold ml-1">{item.selectedUnitName || 'Unit'}</span> · Click to Change Unit & Quantity
                      </Button>

                      {showUnitSelector === index && (() => {
                        // ⚡ PERFORMANCE: Prepare pre-loaded unit data to avoid API call
                        const product = products.find(p => p.id === item.productId)
                        let preloadedUnits: any[] | undefined = undefined
                        let preloadedUnitPrices: any[] | undefined = undefined
                        let preloadedPrimaryUnitId: number | undefined = undefined

                        if (product) {
                          // Get unique units - ALWAYS start with primary unit
                          const unitMap = new Map()

                          // 🔧 FIX: Always add primary unit first (even if no prices configured)
                          if (product.unit) {
                            unitMap.set(product.unit.id, product.unit)
                          }

                          // Extract unique units from unitLocationPrices (with location filter)
                          if (product.unitLocationPrices && Array.isArray(product.unitLocationPrices)) {
                            const locationPrices = product.unitLocationPrices.filter(
                              (ulp: any) => ulp.locationId === currentShift?.locationId
                            )

                            locationPrices.forEach((ulp: any) => {
                              if (ulp.unit && !unitMap.has(ulp.unit.id)) {
                                unitMap.set(ulp.unit.id, ulp.unit)
                              }
                            })
                          }

                          // Also add units from global prices if not in location prices
                          if (product.unitPrices && Array.isArray(product.unitPrices)) {
                            product.unitPrices.forEach((up: any) => {
                              if (up.unit && !unitMap.has(up.unit.id)) {
                                unitMap.set(up.unit.id, up.unit)
                              }
                            })
                          }

                          preloadedUnits = Array.from(unitMap.values())
                          preloadedPrimaryUnitId = product.unitId || undefined

                          // Prepare unit prices (location-specific takes priority)
                          const locationPrices = product.unitLocationPrices?.filter(
                            (ulp: any) => ulp.locationId === currentShift?.locationId
                          ) || []

                          preloadedUnitPrices = Array.from(unitMap.values()).map((unit: any) => {
                            const locationPrice = locationPrices.find((lp: any) => lp.unitId === unit.id)
                            const globalPrice = product.unitPrices?.find((up: any) => up.unitId === unit.id)

                            return {
                              unitId: unit.id,
                              unit,
                              purchasePrice: locationPrice?.purchasePrice || globalPrice?.purchasePrice || 0,
                              sellingPrice: locationPrice?.sellingPrice || globalPrice?.sellingPrice || item.originalPrice || 0,
                            }
                          })

                          console.log('⚡ POS: Prepared pre-loaded unit data:', {
                            productId: product.id,
                            unitsCount: preloadedUnits.length,
                            pricesCount: preloadedUnitPrices.length,
                          })
                        }

                        return (
                          <div className="mt-2">
                            <POSUnitSelector
                              productId={item.productId}
                              productName={item.name}
                              baseUnitPrice={item.originalPrice}
                              availableStock={item.availableStock}
                              currentQuantity={item.quantity}
                              locationId={currentShift?.locationId || 0}
                              preloadedUnits={preloadedUnits}
                              preloadedUnitPrices={preloadedUnitPrices}
                              preloadedPrimaryUnitId={preloadedPrimaryUnitId}
                              onUnitChange={(unitData) => handleUnitChange(index, unitData)}
                            />
                          </div>
                        )
                      })()}
                    </div> */}

                    {/* Serial Number Selection - Always show button for manual entry */}
                    <div className="mt-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className={`w-full text-sm h-9 ${
                          item.serialNumberIds && item.serialNumberIds.length > 0
                            ? 'bg-green-50 border-green-500 text-green-700'
                            : 'bg-gray-50 border-gray-300 text-gray-600'
                        }`}
                        onClick={() => handleOpenSerialDialog(index)}
                      >
                        {item.serialNumberIds && item.serialNumberIds.length > 0 ? (
                          <>✓ {item.serialNumberIds.length} Serial(s) Added</>
                        ) : (
                          <>📝 Add Serial Numbers (Optional)</>
                        )}
                      </Button>
                      {item.serialNumbers && item.serialNumbers.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          {item.serialNumbers.map((sn: any, idx: number) => (
                            <div key={idx} className="truncate">• {sn.serialNumber}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE - PAYMENT PANEL (30%) */}
        <div className="flex-[0.3] min-w-[320px] bg-gradient-to-b from-gray-50 to-white border-l flex flex-col shadow-2xl shrink-0">
          {/* PAYMENT SECTION - Discount & Payment Methods */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* Discount Section - Only show if Senior/PWD discount is enabled in settings */}
            {enableSeniorPwdDiscount && (
              <div className="border-2 border-gray-300 rounded-lg p-3 bg-white">
                <Label className="text-sm font-bold mb-2 block text-gray-700">💰 Discount Type</Label>
                <Select value={discountType} onValueChange={(value) => setDiscountType(value)}>
                  <SelectTrigger className="h-12 text-base border-2 border-gray-400">
                    <SelectValue placeholder="Select discount type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Discount</SelectItem>
                    <SelectItem value="senior">Senior Citizen (20%)</SelectItem>
                    <SelectItem value="pwd">PWD (20%)</SelectItem>
                  </SelectContent>
                </Select>
                {discountType === 'senior' && (
                  <div className="mt-2 space-y-2">
                    <Input
                      type="text"
                      value={seniorCitizenId}
                      onChange={(e) => setSeniorCitizenId(e.target.value)}
                      placeholder="Senior Citizen ID"
                      className="h-10 text-base border-2 border-blue-400"
                    />
                    <Input
                      type="text"
                      value={seniorCitizenName}
                      onChange={(e) => setSeniorCitizenName(e.target.value)}
                      placeholder="Senior Citizen Name"
                      className="h-10 text-base border-2 border-blue-400"
                    />
                  </div>
                )}
                {discountType === 'pwd' && (
                  <div className="mt-2 space-y-2">
                    <Input
                      type="text"
                      value={pwdId}
                      onChange={(e) => setPwdId(e.target.value)}
                      placeholder="PWD ID"
                      className="h-10 text-base border-2 border-blue-400"
                    />
                    <Input
                      type="text"
                      value={pwdName}
                      onChange={(e) => setPwdName(e.target.value)}
                      placeholder="PWD Name"
                      className="h-10 text-base border-2 border-blue-400"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Credit Sale Toggle */}
            <div className="border-2 border-gray-300 rounded-lg p-3 bg-white">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="credit-sale"
                  checked={isCreditSale}
                  onChange={(e) => {
                    if (!selectedCustomer && e.target.checked) {
                      setError('Please select a customer first for credit sale')
                      setTimeout(() => setError(''), 3000)
                      return
                    }
                    setIsCreditSale(e.target.checked)
                  }}
                  disabled={!selectedCustomer}
                  className="w-5 h-5"
                />
                <label htmlFor="credit-sale" className="text-sm font-bold cursor-pointer">
                  📋 Credit Sale / Charge Invoice
                </label>
              </div>
              {!selectedCustomer && (
                <p className="text-xs text-red-600 mt-1">* Select customer to enable</p>
              )}
            </div>

            {/* Payment Methods */}
            {!isCreditSale && (
              <div className="border-2 border-gray-300 rounded-lg p-3 bg-white space-y-3">
                <Label className="text-sm font-bold block text-gray-700">💳 Payment Method</Label>

                {/* Cash Payment */}
                <div>
                  <Label className="text-base font-bold mb-1 block text-green-700">Cash Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={cashAmount}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '' || parseFloat(val) >= 0) setCashAmount(val)
                    }}
                    onKeyDown={(e) => { if (e.key === '-') e.preventDefault() }}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="0.00"
                    className="h-12 text-xl font-bold border-2 border-green-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                {/* Digital Payment */}
                <div>
                  <Label className="text-base font-bold mb-1 block text-blue-700">Digital Payment</Label>
                  <Select value={digitalMethod} onValueChange={(value) => setDigitalMethod(value)}>
                    <SelectTrigger className="h-10 text-base border-2 border-gray-400 mb-2">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gcash">Gcash</SelectItem>
                      <SelectItem value="nfc">NFC</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="card">Card Transaction</SelectItem>
                      <SelectItem value="other">Others</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={digitalAmount}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '' || parseFloat(val) >= 0) setDigitalAmount(val)
                    }}
                    onKeyDown={(e) => { if (e.key === '-') e.preventDefault() }}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="0.00"
                    className="h-12 text-xl font-bold border-2 border-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {parseFloat(digitalAmount || '0') > 0 && (
                    <Input
                      type="text"
                      value={digitalReference}
                      onChange={(e) => setDigitalReference(e.target.value)}
                      placeholder="Reference Number"
                      className="mt-2 h-10 text-base border-2 border-gray-300"
                    />
                  )}
                </div>

                {/* Cheque Payment */}
                <div>
                  <Label className="text-base font-bold mb-1 block text-amber-700">Cheque Payment</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={chequeAmount}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '' || parseFloat(val) >= 0) setChequeAmount(val)
                    }}
                    onKeyDown={(e) => { if (e.key === '-') e.preventDefault() }}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="0.00"
                    className="h-12 text-xl font-bold border-2 border-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {parseFloat(chequeAmount || '0') > 0 && (
                    <>
                      <Input
                        type="text"
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        placeholder="Cheque Number"
                        className="mt-2 h-10 text-base border-2 border-gray-300"
                      />
                      <Input
                        type="text"
                        value={chequeBank}
                        onChange={(e) => setChequeBank(e.target.value)}
                        placeholder="Bank Name"
                        className="mt-2 h-10 text-base border-2 border-gray-300"
                      />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Additional Charge Section (for all sales types) */}
            <div className="border-2 border-amber-400 rounded-lg p-3 bg-amber-50">
              <Label className="text-sm font-bold block text-amber-700 mb-2">💰 Additional Charge (Optional)</Label>
              <div className="space-y-2">
                {/* Type Toggle */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={additionalChargeType === 'fixed' ? 'default' : 'outline'}
                    onClick={() => setAdditionalChargeType('fixed')}
                    className={additionalChargeType === 'fixed' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                  >
                    Fixed ₱
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={additionalChargeType === 'percentage' ? 'default' : 'outline'}
                    onClick={() => setAdditionalChargeType('percentage')}
                    className={additionalChargeType === 'percentage' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                  >
                    Percentage %
                  </Button>
                </div>
                {/* Value Input */}
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={additionalChargeValue}
                    onChange={(e) => {
                      const val = e.target.value
                      // Prevent negative values - only allow empty or non-negative numbers
                      if (val === '' || (parseFloat(val) >= 0 && !val.includes('-'))) {
                        setAdditionalChargeValue(val)
                      }
                    }}
                    onKeyDown={(e) => {
                      // Block minus sign key press
                      if (e.key === '-' || e.key === 'Minus') {
                        e.preventDefault()
                      }
                    }}
                    placeholder={additionalChargeType === 'fixed' ? 'Enter amount' : 'Enter percentage'}
                    className="h-10 text-lg font-bold border-2 border-amber-400"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setKeypadTarget('additionalCharge')
                      setKeypadValue(additionalChargeValue)
                      setShowNumericKeypad(true)
                    }}
                    className="h-10 px-3 border-2 border-amber-400"
                  >
                    🔢
                  </Button>
                </div>
                {/* Calculated Display */}
                {additionalChargeValue && (
                  <div className="text-sm text-amber-700 font-semibold">
                    Additional Charge: +₱{calculateAdditionalCharge().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {additionalChargeType === 'percentage' && ` (${additionalChargeValue}%)`}
                  </div>
                )}
              </div>
            </div>

            {/* Remarks Field */}
            <div className="border-2 border-gray-300 rounded-lg p-3 bg-white">
              <Label className="text-sm font-bold block text-gray-700 mb-2">📝 Remarks (Optional)</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any additional notes or remarks about this sale..."
                className="min-h-[80px] text-sm border-2 border-gray-300 focus:border-blue-500"
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {remarks.length}/500 characters
              </p>
            </div>
          </div>

          {/* Total Summary & Complete Sale Button */}
          <div className="border-t bg-gradient-to-b from-gray-50 to-white">
            <div className="p-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal:</span>
                <span className="font-semibold">₱{calculateSubtotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {calculateTotalItemDiscounts() > 0 && (
                <div className="flex justify-between text-sm text-orange-600">
                  <span>Item Discounts:</span>
                  <span className="font-semibold">-₱{calculateTotalItemDiscounts().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {calculateDiscount() > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Senior/PWD Discount:</span>
                  <span className="font-semibold">-₱{calculateDiscount().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {calculateAdditionalCharge() > 0 && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Additional Charge:</span>
                  <span className="font-semibold">+₱{calculateAdditionalCharge().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-4xl font-bold border-t-2 pt-3 mt-2">
                <span>TOTAL:</span>
                <span className="text-blue-600">
                  ₱{calculateTotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Change/Balance Display */}
              {!isCreditSale && (
                <div className="flex justify-between text-xl font-bold pt-2">
                  <span className="text-gray-600">Change:</span>
                  <span className="text-green-600">
                    ₱{Math.max(0, (parseFloat(cashAmount || '0') + parseFloat(digitalAmount || '0') + parseFloat(chequeAmount || '0')) - calculateTotal()).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            {/* Complete Sale Button */}
            <div className="p-3">
              <Button
                className="w-full py-7 text-2xl font-bold bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-xl rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                size="lg"
                onClick={handleCheckout}
                disabled={cart.length === 0 || isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="animate-spin h-6 w-6 border-4 border-white border-t-transparent rounded-full"></div>
                    <span>Processing Sale...</span>
                  </div>
                ) : (
                  <>✅ COMPLETE SALE</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Numeric Keypad Dialog */}
      <Dialog open={showNumericKeypad} onOpenChange={setShowNumericKeypad}>
        <DialogContent
          className="max-w-sm"
          onKeyDown={(e) => {
            // Handle physical keyboard input
            if (e.key >= '0' && e.key <= '9') {
              handleKeypadClick(e.key)
            } else if (e.key === '.' || e.key === 'Decimal') {
              handleKeypadClick('.')
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
              handleKeypadClick('←')
            } else if (e.key === 'Escape') {
              handleKeypadClick('C')
            } else if (e.key === 'Enter') {
              confirmKeypadValue()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Enter Amount</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-center space-y-2">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Amount Tendered</div>
              <div className="text-3xl font-extrabold text-blue-700">
                {formatCurrencyDisplay(keypadAmount.toString(), 2) || '0.00'}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm text-gray-700">
                <div className="bg-white rounded-md py-2 px-3 border border-gray-200">
                  <div className="uppercase text-[10px] font-medium text-gray-500">Total Due</div>
                  <div className="font-bold">
                    {totalDueAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-white rounded-md py-2 px-3 border border-gray-200">
                  <div className="uppercase text-[10px] font-medium text-gray-500">
                    {changeOrShortAmount >= 0 ? 'Change' : 'Short'}
                  </div>
                  <div className={`font-bold ${changeOrShortAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(changeOrShortAmount).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '←'].map((key) => (
                <Button
                  key={key}
                  onClick={() => handleKeypadClick(key)}
                  className="h-16 text-2xl font-bold"
                  variant="outline"
                >
                  {key}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => handleKeypadClick('C')}
                className="h-12"
              >
                Clear
              </Button>
              <Button
                onClick={confirmKeypadValue}
                className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md"
              >
                OK
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Camera Dialog */}
      <Dialog open={showCameraDialog} onOpenChange={(open) => {
        setShowCameraDialog(open)
        if (!open) stopCamera()
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Capture Digital Payment Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <video ref={videoRef} autoPlay className="w-full rounded-lg" />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              stopCamera()
              setShowCameraDialog(false)
            }}>
              Cancel
            </Button>
            <Button onClick={capturePhoto} className="bg-blue-600">
              📸 Capture Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold Transaction Dialog */}
      <Dialog open={showHoldDialog} onOpenChange={setShowHoldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hold Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Note (Optional)</Label>
              <Textarea
                placeholder="Enter note for this transaction..."
                value={holdNote}
                onChange={(e) => setHoldNote(e.target.value)}
                rows={3}
              />
            </div>
            <div className="p-4 bg-gray-100 rounded">
              <p className="text-sm text-gray-600">Items: {cart.length}</p>
              <p className="text-xl font-bold">
                Total: ₱{calculateTotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHoldDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowHoldConfirm(true)} className="bg-yellow-600">
              Hold Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retrieve Held Transactions Dialog */}
      <Dialog open={showHeldTransactions} onOpenChange={setShowHeldTransactions}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Held Transactions</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {heldTransactions.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                No held transactions
              </p>
            ) : (
              <div className="space-y-2">
                {heldTransactions.map((trans: any) => (
                  <div
                    key={trans.id}
                    className="p-4 border rounded hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold">
                          {new Date(trans.timestamp).toLocaleString('en-PH')}
                        </p>
                        {trans.customer && (
                          <p className="text-sm font-medium text-gray-700">
                            Customer: {trans.customer.name}
                          </p>
                        )}
                        {trans.note && (
                          <p className="text-xs text-gray-400 mt-1 italic">
                            Note: {trans.note}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-blue-600">
                          ₱{trans.cart.reduce((sum: number, item: any) => sum + item.unitPrice * item.quantity, 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Item Details */}
                    <div className="bg-gray-50 rounded p-2 mb-2 space-y-1">
                      <p className="text-xs font-semibold text-gray-600 mb-1">Items ({trans.cart.length}):</p>
                      {trans.cart.map((item: any, index: number) => (
                        <div key={index} className="flex justify-between text-xs">
                          <span className="text-gray-700">
                            {item.name} {item.isFreebie && <span className="text-green-600">(FREE)</span>}
                          </span>
                          <span className="text-gray-600">
                            {item.quantity} × ₱{item.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = ₱{(item.quantity * item.unitPrice).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={() => retrieveHeldTransaction(trans)}
                      className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                      size="sm"
                    >
                      ▶️ Retrieve This Transaction
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Customer Dialog */}
      <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white">Customer Name *</Label>
              <Input
                placeholder="Enter customer name..."
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-white">Email (Optional)</Label>
              <Input
                type="email"
                placeholder="Enter email..."
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-white">Phone (Optional)</Label>
              <Input
                placeholder="Enter phone..."
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-white">Address (Optional)</Label>
              <Textarea
                placeholder="Enter address..."
                value={newCustomerAddress}
                onChange={(e) => setNewCustomerAddress(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCustomerDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCustomer} className="bg-blue-600">
              Create Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash In Dialog */}
      <Dialog open={showCashInDialog} onOpenChange={setShowCashInDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cash In Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input
                type="text"
                inputMode="none"
                placeholder="Enter amount..."
                value={cashIOAmount}
                onClick={() => openKeypad('cashin')}
                readOnly
                className="cursor-pointer text-lg font-bold"
              />
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea
                placeholder="Enter reason for cash in..."
                value={cashIORemarks}
                onChange={(e) => setCashIORemarks(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCashInDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCashIn} className="bg-green-600" disabled={cashIOSubmitting}>
              {cashIOSubmitting ? 'Recording...' : 'Record Cash In'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Out Dialog */}
      <Dialog open={showCashOutDialog} onOpenChange={setShowCashOutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cash Out Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input
                type="text"
                inputMode="none"
                placeholder="Enter amount..."
                value={cashIOAmount}
                onClick={() => openKeypad('cashout')}
                readOnly
                className="cursor-pointer text-lg font-bold"
              />
            </div>
            <div>
              <Label>Remarks *</Label>
              <Textarea
                placeholder="Enter reason for cash out (required)..."
                value={cashIORemarks}
                onChange={(e) => setCashIORemarks(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCashOutDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCashOut} className="bg-red-600" disabled={cashIOSubmitting}>
              {cashIOSubmitting ? 'Recording...' : 'Record Cash Out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AR Payment Collection Modal */}
      {currentShift && (
        <ARPaymentCollectionModal
          isOpen={showARPaymentDialog}
          onClose={() => {
            setShowARPaymentDialog(false)
            // Refresh customer data to update AR balance
            fetchCustomers()
          }}
          shiftId={currentShift.id}
          preSelectedCustomerId={selectedCustomer?.id}
          preSelectedCustomerName={selectedCustomer?.name}
          onPaymentSuccess={() => {
            // Refresh today's sales and customer data
            fetchTodaysSales()
            fetchCustomers()
          }}
        />
      )}

      {/* Save Quotation Dialog */}
      <Dialog open={showQuotationDialog} onOpenChange={setShowQuotationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Quotation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Customer Name</Label>
              <Input
                placeholder="Enter customer name..."
                value={quotationCustomerName}
                onChange={(e) => setQuotationCustomerName(e.target.value)}
              />
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add any notes..."
                value={quotationNotes}
                onChange={(e) => setQuotationNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="p-4 bg-gray-100 rounded">
              <p className="text-sm text-gray-600">Total Items: {cart.length}</p>
              <p className="text-xl font-bold">
                Total: ₱{calculateTotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowQuotationDialog(false)}
              disabled={savingQuotation}
            >
              Cancel
            </Button>
            <Button
              onClick={() => setShowSaveQuotationConfirm(true)}
              disabled={savingQuotation}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {savingQuotation ? 'Saving...' : 'Save Quotation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saved Quotations Dialog */}
      <Dialog
        open={showSavedQuotations}
        onOpenChange={setShowSavedQuotations}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Saved Quotations</DialogTitle>
          </DialogHeader>
          {loadingQuotation && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3 flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-sm text-blue-800 font-medium">Loading quotation...</span>
            </div>
          )}
          <div className="max-h-96 overflow-y-auto">
            {quotations.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                No saved quotations
              </p>
            ) : (
              <div className="space-y-2">
                {quotations.map((quot: any) => (
                  <div
                    key={quot.id}
                    className={`p-4 border rounded ${loadingQuotation ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div
                        className={`flex-1 ${loadingQuotation ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        onClick={() => !loadingQuotation && handleLoadQuotation(quot)}
                      >
                        <p className="font-bold">{quot.quotationNumber}</p>
                        <p className="text-sm font-medium text-gray-700">
                          {quot.customer?.name || quot.customerName || 'Walk-in Customer'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {quot.items?.length || 0} items
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(quot.quotationDate || quot.createdAt).toLocaleString('en-PH')}
                        </p>
                        {quot.notes && (
                          <p className="text-xs text-gray-400 mt-1 italic">
                            {quot.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex flex-col items-end space-y-2">
                        <div>
                          <p className="text-xl font-bold text-blue-600">
                            ₱{parseFloat(quot.totalAmount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {quot.status}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handlePrintQuotation(quot, e)}
                            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                          >
                            🖨️ Print
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleDeleteQuotation(quot.id, e)}
                            className="bg-red-50 hover:bg-red-100 text-red-700 border-red-300"
                          >
                            🗑️ Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer Status Bar */}
      <div className="bg-gray-900 text-white px-6 py-2 flex items-center justify-between text-xs font-medium shadow-lg">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="text-gray-400">Transaction:</span>
            <span className="font-bold text-blue-400">{currentTransaction || 'None'}</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-gray-400">Cash Drawer:</span>
            <span className={`font-bold ${cashDrawerOpen ? 'text-yellow-400' : 'text-green-400'}`}>
              {cashDrawerOpen ? 'Open' : 'Closed'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-gray-400">Last Sale:</span>
            <span className="font-bold text-green-400">
              ₱{lastSaleAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-gray-400">Today's Sales:</span>
            <span className="font-bold text-green-400">
              ₱{todaysSalesTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-gray-400">Cash in Drawer:</span>
            <span className="font-bold text-blue-400">
              ₱{calculateActualCash().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="text-gray-400">Network:</span>
            <span className={`font-bold ${networkStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
              {networkStatus === 'connected' ? '● Connected' : '○ Disconnected'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-gray-400">Printer:</span>
            <span className={`font-bold ${printerStatus === 'ready' ? 'text-green-400' : 'text-red-400'}`}>
              {printerStatus === 'ready' ? '● Ready' : '○ Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Sales Invoice Print Dialog */}
      {completedSale && (
        <SalesInvoicePrint
          sale={completedSale}
          isOpen={showInvoice}
          onClose={() => {
            setShowInvoice(false)
            setCompletedSale(null)
          }}
        />
      )}

      {/* Quotation Print Dialog */}
      {quotationToPrint && (
        <QuotationPrint
          quotation={quotationToPrint}
          isOpen={showQuotationPrint}
          onClose={() => {
            setShowQuotationPrint(false)
            setQuotationToPrint(null)
          }}
        />
      )}

      {/* Manual Serial Number Entry Dialog - Simple Text Input */}
      {showSerialNumberDialog && serialNumberCartIndex !== null && (
        <Dialog open={showSerialNumberDialog} onOpenChange={setShowSerialNumberDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Serial Numbers</DialogTitle>
              <p className="text-sm text-gray-600 mt-2">
                Product: <strong>{cart[serialNumberCartIndex]?.name}</strong>
                <br />
                Quantity: <strong>{cart[serialNumberCartIndex]?.quantity}</strong>
              </p>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Label>Enter Serial Numbers (one per line)</Label>
              <Textarea
                placeholder="Example:&#10;SN123456789&#10;SN987654321&#10;IMEI:123456789012345"
                className="min-h-[200px] font-mono"
                defaultValue={cart[serialNumberCartIndex]?.serialNumbers?.map((sn: any) => sn.serialNumber).join('\n') || ''}
                id="serial-numbers-input"
                autoFocus
                onKeyDown={(e) => {
                  // Allow Enter key to create new line (don't let it trigger anything else)
                  if (e.key === 'Enter') {
                    e.stopPropagation()
                  }
                }}
              />
              <p className="text-xs text-gray-500">
                💡 Tip: Enter one serial number per line. You can enter {cart[serialNumberCartIndex]?.quantity} serial number(s) for this item.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowSerialNumberDialog(false)
                  setSerialNumberCartIndex(null)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const textarea = document.getElementById('serial-numbers-input') as HTMLTextAreaElement
                  const serialNumbers = textarea.value
                    .split('\n')
                    .map(sn => sn.trim())
                    .filter(sn => sn.length > 0)

                  if (serialNumbers.length === 0) {
                    setError('Please enter at least one serial number')
                    setTimeout(() => setError(''), 3000)
                    return
                  }

                  handleSerialNumberConfirm(serialNumbers)
                }}
              >
                Save Serial Numbers
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Payment Modal - Comprehensive Payment Collection */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">💳 Payment Collection</DialogTitle>
            <p className="text-gray-600">Review cart and collect payment</p>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 py-4">
            {/* Left Column - Cart Summary */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg border-b pb-2">🛒 Cart Summary</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-lg p-3 bg-gray-50">
                {cart.map((item, index) => (
                  <div key={index} className="flex justify-between items-center text-sm py-2 border-b last:border-0">
                    <div className="flex-1">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-gray-600">
                        ₱{item.unitPrice.toFixed(2)} × {item.quantity}
                      </p>
                    </div>
                    <p className="font-bold text-blue-600">
                      ₱{(item.unitPrice * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Total Summary */}
              <div className="space-y-2 border-t pt-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span className="font-semibold">₱{calculateSubtotal().toFixed(2)}</span>
                </div>
                {calculateDiscount() > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Discount:</span>
                    <span className="font-semibold">-₱{calculateDiscount().toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold border-t-2 pt-2">
                  <span>TOTAL:</span>
                  <span className="text-blue-600">₱{calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Right Column - Payment Options */}
            <div className="space-y-4">
              {/* Discount Section */}
              <div className="border rounded-lg p-4 bg-yellow-50">
                <Label className="font-bold mb-2 block">💰 Discount</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Discount</SelectItem>
                    <SelectItem value="senior">Senior Citizen (20%)</SelectItem>
                    <SelectItem value="pwd">PWD (20%)</SelectItem>
                    <SelectItem value="regular">Regular Discount</SelectItem>
                  </SelectContent>
                </Select>

                {discountType === 'senior' && (
                  <div className="mt-2 space-y-2">
                    <Input
                      placeholder="SC ID Number"
                      value={seniorCitizenId}
                      onChange={(e) => setSeniorCitizenId(e.target.value)}
                    />
                    <Input
                      placeholder="SC Full Name"
                      value={seniorCitizenName}
                      onChange={(e) => setSeniorCitizenName(e.target.value)}
                    />
                  </div>
                )}

                {discountType === 'pwd' && (
                  <div className="mt-2 space-y-2">
                    <Input
                      placeholder="PWD ID Number"
                      value={pwdId}
                      onChange={(e) => setPwdId(e.target.value)}
                    />
                    <Input
                      placeholder="PWD Full Name"
                      value={pwdName}
                      onChange={(e) => setPwdName(e.target.value)}
                    />
                  </div>
                )}

                {discountType === 'regular' && (
                  <div className="mt-2">
                    <Label className="text-xs mb-1 block">Discount Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Enter discount amount..."
                      value={discountAmount}
                      onChange={(e) => {
                        const val = e.target.value
                        // Prevent negative values - only allow empty or non-negative numbers
                        if (val === '' || (parseFloat(val) >= 0 && !val.includes('-'))) {
                          setDiscountAmount(val)
                        }
                      }}
                      onKeyDown={(e) => {
                        // Block minus sign key press
                        if (e.key === '-' || e.key === 'Minus') {
                          e.preventDefault()
                        }
                      }}
                      onClick={() => openKeypad('discount')}
                    />
                  </div>
                )}
              </div>

              {/* Credit Sale Toggle */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="creditSaleModal"
                    checked={isCreditSale}
                    onChange={(e) => setIsCreditSale(e.target.checked)}
                    className="w-4 h-4"
                    disabled={!selectedCustomer}
                  />
                  <label
                    htmlFor="creditSaleModal"
                    className={`text-sm font-medium ${!selectedCustomer ? 'text-gray-400 cursor-not-allowed' : ''}`}
                  >
                    📝 Credit / Charge Invoice {!selectedCustomer && <span>(Select customer first)</span>}
                  </label>
                </div>
                {isCreditSale && (
                  <Alert className="mt-2">
                    <AlertDescription className="text-xs">
                      Credit sales require customer selection. Customer will pay later.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Payment Methods (only if not credit sale) */}
              {!isCreditSale && (
                <div className="space-y-3">
                  {/* Cash Payment */}
                  <div className="border rounded-lg p-3 bg-green-50">
                    <Label className="text-sm font-bold mb-2 block">💵 Cash Payment</Label>
                    <Input
                      type="text"
                      placeholder="Cash amount..."
                      value={formatCurrencyDisplay(cashAmount)}
                      onChange={(e) => setCashAmount(sanitizeCurrencyInput(e.target.value))}
                      onClick={() => openKeypad('cash')}
                      className="text-lg font-bold"
                      inputMode="decimal"
                    />
                  </div>

                  {/* Digital Payment */}
                  <div className="border rounded-lg p-3 bg-purple-50">
                    <Label className="text-sm font-bold mb-2 block">📱 Digital Payment</Label>
                    <div className="flex gap-2 mb-2">
                      <Select value={digitalMethod} onValueChange={setDigitalMethod}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gcash">GCash</SelectItem>
                          <SelectItem value="maya">Maya</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="text"
                        placeholder="Amount..."
                        value={formatCurrencyDisplay(digitalAmount)}
                        onChange={(e) => setDigitalAmount(sanitizeCurrencyInput(e.target.value))}
                        onClick={() => openKeypad('digital')}
                        className="flex-1"
                        inputMode="decimal"
                        disabled={!digitalMethod}
                      />
                    </div>
                    {digitalMethod && (
                      <>
                        <Input
                          placeholder="Reference Number"
                          value={digitalReference}
                          onChange={(e) => setDigitalReference(e.target.value)}
                          className="mb-2"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowCameraDialog(true)
                            setTimeout(() => startCamera(), 100)
                          }}
                          className="w-full"
                        >
                          📷 Capture Receipt {digitalPhoto && '✓'}
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Cheque Payment */}
                  <div className="border rounded-lg p-3 bg-orange-50">
                    <Label className="text-sm font-bold mb-2 block">🏦 Cheque Payment</Label>
                    <Input
                      type="text"
                      placeholder="Cheque amount..."
                      value={formatCurrencyDisplay(chequeAmount)}
                      onChange={(e) => setChequeAmount(sanitizeCurrencyInput(e.target.value))}
                      className="text-lg font-bold mb-2"
                      inputMode="decimal"
                    />
                    {chequeAmount && parseFloat(chequeAmount) > 0 && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Cheque Number *"
                          value={chequeNumber}
                          onChange={(e) => setChequeNumber(e.target.value)}
                          className="text-sm"
                        />
                        <Input
                          placeholder="Bank Name *"
                          value={chequeBank}
                          onChange={(e) => setChequeBank(e.target.value)}
                          className="text-sm"
                        />
                        <Input
                          type="date"
                          placeholder="Cheque Date"
                          value={chequeDate}
                          onChange={(e) => setChequeDate(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>

                  {/* Change Display */}
                  {(cashAmount || digitalAmount || chequeAmount) && (
                    <div className={`border-2 rounded-lg p-4 ${calculateChange() >= 0 ? 'bg-green-100 border-green-500' : 'bg-red-100 border-red-500'}`}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Total Paid:</span>
                        <span className="font-bold">₱{getTotalPayments().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xl font-bold">
                        <span>Change:</span>
                        <span className={calculateChange() >= 0 ? 'text-green-600' : 'text-red-600'}>
                          ₱{calculateChange().toFixed(2)}
                        </span>
                      </div>
                      {calculateChange() < 0 && (
                        <div className="mt-2 text-center text-red-600 font-bold animate-pulse">
                          ⚠️ INSUFFICIENT PAYMENT ⚠️
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPaymentModal(false)}
              className="text-lg"
            >
              Cancel
            </Button>
            <Button
              className="text-lg py-6 px-8 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              onClick={() => {
                setShowPaymentModal(false)
                handleCheckout()
              }}
              disabled={loading || cart.length === 0}
            >
              {loading ? '⏳ Processing...' : '🏪 COMPLETE SALE'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exchange Dialog */}
      <ExchangeDialog
        isOpen={showExchangeDialog}
        onClose={() => setShowExchangeDialog(false)}
        onSuccess={(exchangeNumber) => {
          setShowExchangeDialog(false)
          // Toast is already shown by ExchangeDialog component
        }}
      />

      {/* Clear Cart Confirmation Dialog */}
      <ConfirmDialog
        open={showClearCartConfirm}
        onOpenChange={setShowClearCartConfirm}
        title="Clear All Cart Items?"
        description={`Are you sure you want to remove all ${cart.length} item(s) from the cart? This action cannot be undone.`}
        confirmLabel="Yes, Clear All"
        cancelLabel="Cancel"
        onConfirm={() => {
          setCart([])
          setShowClearCartConfirm(false)
        }}
        variant="destructive"
      />

      {/* Hold Transaction Confirmation Dialog */}
      <ConfirmDialog
        open={showHoldConfirm}
        onOpenChange={setShowHoldConfirm}
        title="Hold Transaction?"
        description={`Are you sure you want to hold this transaction with ${cart.length} item(s)? You can retrieve it later from the held transactions list.`}
        confirmLabel="Yes, Hold"
        cancelLabel="Cancel"
        onConfirm={() => {
          setShowHoldConfirm(false)
          setShowHoldDialog(false)
          saveHeldTransaction()
        }}
        variant="default"
      />

      {/* Save Quotation Confirmation Dialog */}
      <ConfirmDialog
        open={showSaveQuotationConfirm}
        onOpenChange={setShowSaveQuotationConfirm}
        title="Save Quotation?"
        description={`Are you sure you want to save this quotation with ${cart.length} item(s)? The cart will be cleared after saving.`}
        confirmLabel="Yes, Save"
        cancelLabel="Cancel"
        onConfirm={() => {
          setShowSaveQuotationConfirm(false)
          handleSaveQuotation()
        }}
        variant="default"
      />

      {/* Package Selection Dialog */}
      <Dialog open={showPackageDialog} onOpenChange={setShowPackageDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              📦 Select Package Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {loadingPackages ? (
              <div className="text-center py-8">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
                <p className="mt-2 text-gray-500">Loading packages...</p>
              </div>
            ) : (
              <>
                <Tabs value={activePackageTab} onValueChange={setActivePackageTab}>
                  <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 flex-wrap">
                    <TabsTrigger
                      value="all"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600 data-[state=active]:bg-transparent"
                    >
                      All ({packageTemplates.length})
                    </TabsTrigger>
                    {packageCategories.map(cat => (
                      <TabsTrigger
                        key={cat.id}
                        value={cat.id.toString()}
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600 data-[state=active]:bg-transparent"
                      >
                        {cat.name} ({packageTemplates.filter((t: any) => t.categoryId === cat.id).length})
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                <div className="grid gap-3">
                  {(activePackageTab === 'all'
                    ? packageTemplates
                    : packageTemplates.filter((t: any) => t.categoryId?.toString() === activePackageTab)
                  ).map((template: any) => (
                    <div
                      key={template.id}
                      className="border rounded-lg p-4 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer transition-colors"
                      onClick={() => loadPackageToCart(template)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-lg">{template.name}</h3>
                          {template.category && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              {template.category.name}
                            </span>
                          )}
                          {template.description && (
                            <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                          )}
                          <p className="text-sm text-gray-500 mt-2">
                            {template.items?.length || template._count?.items || 0} items
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(template.targetPrice))}
                          </p>
                          <Button
                            size="sm"
                            variant="success"
                            className="mt-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              loadPackageToCart(template)
                            }}
                          >
                            Load to Cart
                          </Button>
                        </div>
                      </div>
                      {template.items && template.items.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-gray-500 mb-2">Items included:</p>
                          <div className="flex flex-wrap gap-2">
                            {template.items.slice(0, 5).map((item: any, idx: number) => (
                              <span key={idx} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                                {item.product?.name || 'Product'} x{Number(item.quantity)}
                              </span>
                            ))}
                            {template.items.length > 5 && (
                              <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                                +{template.items.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {(activePackageTab === 'all' ? packageTemplates : packageTemplates.filter((t: any) => t.categoryId?.toString() === activePackageTab)).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No package templates found.
                      <br />
                      <span className="text-sm">Create templates in the Package Templates menu.</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPackageDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
