'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
import { apiPost, isConnectionOnline, getOfflineQueueLength } from '@/lib/client/apiClient'
import SerialNumberSelector from '@/components/SerialNumberSelector'
import ARPaymentCollectionModal from '@/components/ARPaymentCollectionModal'

export default function POSEnhancedPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
  const [digitalMethod, setDigitalMethod] = useState<'gcash' | 'maya' | ''>('')
  const [digitalReference, setDigitalReference] = useState('')
  const [digitalPhoto, setDigitalPhoto] = useState<string>('')
  const [chequeAmount, setChequeAmount] = useState<string>('')
  const [chequeNumber, setChequeNumber] = useState('')
  const [chequeBank, setChequeBank] = useState('')
  const [chequeDate, setChequeDate] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [isCreditSale, setIsCreditSale] = useState(false)

  // Discount State - Updated
  const [discountType, setDiscountType] = useState<string>('none')
  const [discountAmount, setDiscountAmount] = useState<string>('')
  const [seniorCitizenId, setSeniorCitizenId] = useState('')
  const [seniorCitizenName, setSeniorCitizenName] = useState('')
  const [pwdId, setPwdId] = useState('')
  const [pwdName, setPwdName] = useState('')

  // Dialog States
  const [showCashInDialog, setShowCashInDialog] = useState(false)
  const [showCashOutDialog, setShowCashOutDialog] = useState(false)
  const [showARPaymentDialog, setShowARPaymentDialog] = useState(false)
  const [showQuotationDialog, setShowQuotationDialog] = useState(false)
  const [showSavedQuotations, setShowSavedQuotations] = useState(false)
  const [showHoldDialog, setShowHoldDialog] = useState(false)
  const [showHeldTransactions, setShowHeldTransactions] = useState(false)
  const [showNumericKeypad, setShowNumericKeypad] = useState(false)
  const [showDigitalPaymentDialog, setShowDigitalPaymentDialog] = useState(false)
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false)
  const [showCameraDialog, setShowCameraDialog] = useState(false)

  // Serial Number State
  const [showSerialNumberDialog, setShowSerialNumberDialog] = useState(false)
  const [serialNumberCartIndex, setSerialNumberCartIndex] = useState<number | null>(null)

  // Cash In/Out State
  const [cashIOAmount, setCashIOAmount] = useState('')
  const [cashIORemarks, setCashIORemarks] = useState('')

  // Quotation State
  const [quotations, setQuotations] = useState<any[]>([])
  const [quotationCustomerName, setQuotationCustomerName] = useState('')
  const [quotationNotes, setQuotationNotes] = useState('')

  // Hold Transaction State
  const [heldTransactions, setHeldTransactions] = useState<any[]>([])
  const [holdNote, setHoldNote] = useState('')

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
  const [keypadTarget, setKeypadTarget] = useState<'cash' | 'digital' | 'discount' | 'cashin' | 'cashout'>('cash')
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
  const [networkStatus, setNetworkStatus] = useState<'connected' | 'disconnected'>('connected')
  const [printerStatus, setPrinterStatus] = useState<'ready' | 'offline'>('ready')
  const [currentTransaction, setCurrentTransaction] = useState('')
  const [actualCashInDrawer, setActualCashInDrawer] = useState(0)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)

  // Search State
  const [searchTerm, setSearchTerm] = useState('')

  // Only run checks when session is ready
  useEffect(() => {
    if (session) {
      checkShift()
      fetchCategories()
      fetchCustomers()
      fetchQuotations()
      loadHeldTransactions()
    }
  }, [session])

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

      // F6 - Retrieve Held Transaction
      if (e.key === 'F6') {
        e.preventDefault()
        setShowHeldTransactions(true)
        return
      }

      // Ctrl+P - Complete Sale
      if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        if (cart.length > 0) {
          handleCheckout()
        } else {
          setError('Cart is empty')
          setTimeout(() => setError(''), 2000)
        }
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

      // F3 - Load Quotation
      if (e.key === 'F3') {
        e.preventDefault()
        setShowSavedQuotations(true)
        return
      }

      // Alt+I - Cash In
      if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault()
        setCashIOAmount('')
        setCashIORemarks('')
        setShowCashInDialog(true)
        return
      }

      // Alt+O - Cash Out
      if (e.altKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault()
        setCashIOAmount('')
        setCashIORemarks('')
        setShowCashOutDialog(true)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart])

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
  }, [barcodeBuffer, lastKeyTime])

  const checkShift = async () => {
    try {
      console.log('[POS] Checking for active shift...')
      const res = await fetch('/api/shifts?status=open')
      const data = await res.json()

      console.log('[POS] API response:', data)

      if (data.shifts && data.shifts.length > 0) {
        const shift = data.shifts[0]
        console.log('[POS] Found shift:', shift.shiftNumber, 'Beginning cash:', shift.beginningCash)

        if (!shift.beginningCash || parseFloat(shift.beginningCash) <= 0) {
          console.error('[POS] Invalid shift - no beginning cash')
          setError('Invalid shift: No beginning cash found.')
          router.push('/dashboard/shifts/begin')
          return
        }

        console.log('[POS] Setting current shift and loading products...')
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
      // API returns array directly, not wrapped in { customers: [] }
      if (Array.isArray(data)) {
        setCustomers(data)
      } else if (data.customers) {
        setCustomers(data.customers)
      }
    } catch (err) {
      console.error('Error fetching customers:', err)
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

    const searchTerm = barcode.toLowerCase()

    // Automatically switch to "All Products" when searching
    if (selectedCategory !== 'all') {
      setSelectedCategory('all')
    }

    // Search for product by barcode, SKU, or name (partial match) - search ALL products
    const product = products.find((p) => {
      // Exact barcode/SKU match
      if (p.sku?.toLowerCase() === searchTerm) return true
      if (p.variations?.some((v: any) => v.sku?.toLowerCase() === searchTerm)) return true

      // Partial name match (case-insensitive)
      if (p.name?.toLowerCase().includes(searchTerm)) return true

      return false
    })

    if (product) {
      addToCart(product, false)
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS75+mfTQ0OTqni77dhGgU7k')
      audio.play().catch(() => {})
    } else {
      setError('Product not found')
      setTimeout(() => setError(''), 3000)
    }

    if (barcodeInputRef.current) {
      barcodeInputRef.current.value = ''
      barcodeInputRef.current.focus()
    }
  }

  // Check if product has serial numbers in stock
  const checkHasSerialNumbers = async (productId: number, variationId: number, locationId: number): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/serial-numbers/available?productId=${productId}&variationId=${variationId}&locationId=${locationId}`
      )
      const data = await response.json()
      return data.success && data.data && data.data.length > 0
    } catch (error) {
      console.error('Error checking serial numbers:', error)
      return false
    }
  }

  const addToCart = async (product: any, isFreebie: boolean = false) => {
    const variation = product.variations?.[0]
    if (!variation) return

    const locationStock = variation.variationLocationDetails?.find(
      (vl: any) => vl.locationId === currentShift?.locationId
    )

    if (!locationStock || parseFloat(locationStock.qtyAvailable) <= 0) {
      setError('Product out of stock at your location')
      setTimeout(() => setError(''), 3000)
      return
    }

    const availableStock = parseFloat(locationStock.qtyAvailable)

    const existingIndex = cart.findIndex(
      (item) =>
        item.productVariationId === variation.id && item.isFreebie === isFreebie
    )

    const price = parseFloat(variation.sellingPrice)

    // Use quantity multiplier if set, otherwise 1
    const qtyToAdd = quantityMultiplier || 1

    // Clear multiplier after use
    if (quantityMultiplier) {
      setQuantityMultiplier(null)
    }

    // Check if product has serial numbers
    const hasSerials = await checkHasSerialNumbers(product.id, variation.id, currentShift?.locationId)

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
      // Reset serial numbers if quantity changes
      if (hasSerials) {
        newCart[existingIndex].serialNumberIds = []
        newCart[existingIndex].serialNumbers = []
      }
      setCart(newCart)
    } else {
      // Check if initial quantity exceeds available stock
      if (qtyToAdd > availableStock) {
        setError(`Insufficient stock! Only ${availableStock} units available at this branch.`)
        setTimeout(() => setError(''), 4000)
        return
      }

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
          availableStock: availableStock, // Store available stock
          isFreebie,
          requiresSerial: hasSerials,
          serialNumberIds: [],
          serialNumbers: [], // Store full serial number objects
        },
      ])
    }
  }

  const addFreebieToCart = (product: any) => {
    addToCart(product, true)
  }

  // Handle serial number selection
  const handleOpenSerialDialog = (cartIndex: number) => {
    setSerialNumberCartIndex(cartIndex)
    setShowSerialNumberDialog(true)
  }

  const handleSerialNumberConfirm = (selectedIds: number[], selectedSerials: any[]) => {
    if (serialNumberCartIndex === null) return

    const newCart = [...cart]
    newCart[serialNumberCartIndex].serialNumberIds = selectedIds
    newCart[serialNumberCartIndex].serialNumbers = selectedSerials
    setCart(newCart)
    setSerialNumberCartIndex(null)
  }

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index))
  }

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(index)
      return
    }

    const item = cart[index]
    const availableStock = item.availableStock || 0

    // Validate against available stock
    if (quantity > availableStock) {
      setError(`⚠️ Insufficient stock! Only ${availableStock} units available at this branch for "${item.name}".`)
      setTimeout(() => setError(''), 5000)
      return
    }

    const newCart = [...cart]
    newCart[index].quantity = quantity

    // Reset serial numbers if quantity changes and product requires serials
    if (item.requiresSerial && item.serialNumberIds.length !== quantity) {
      newCart[index].serialNumberIds = []
      newCart[index].serialNumbers = []
    }

    setCart(newCart)
  }

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  }

  const calculateDiscount = () => {
    const subtotal = calculateSubtotal()
    if (discountType === 'senior' || discountType === 'pwd') {
      return subtotal * 0.2
    } else if (discountType === 'regular' && discountAmount) {
      return parseFloat(discountAmount)
    }
    return 0
  }

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount()
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
    if (keypadTarget === 'cash') {
      setCashAmount(keypadValue)
    } else if (keypadTarget === 'digital') {
      setDigitalAmount(keypadValue)
    } else if (keypadTarget === 'discount') {
      setDiscountAmount(keypadValue)
    } else if (keypadTarget === 'cashin' || keypadTarget === 'cashout') {
      setCashIOAmount(keypadValue)
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
    if (!cashIOAmount || parseFloat(cashIOAmount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

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
    }
  }

  const handleCashOut = async () => {
    if (!cashIOAmount || parseFloat(cashIOAmount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    if (!cashIORemarks) {
      setError('Remarks are required for cash out')
      return
    }

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

      alert('Quotation saved successfully!')

      // Clear quotation dialog fields
      setShowQuotationDialog(false)
      setQuotationCustomerName('')
      setQuotationNotes('')

      // Clear cart and customer
      setCart([])
      setSelectedCustomer(null)

      // Refresh quotations list
      fetchQuotations()
    } catch (err: any) {
      console.error('Error saving quotation:', err)
      setError(err.message)
      // Keep dialog open on error so user can see what went wrong
    }
  }

  const handleLoadQuotation = (quotation: any) => {
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

    alert(`Quotation ${quotation.quotationNumber} loaded successfully!`)
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

    // Create a new window for printing
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow popups to print quotations')
      return
    }

    // Build the print content with Philippine header
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Quotation ${quotation.quotationNumber}</title>
        <style>
          @media print {
            @page { margin: 0.5in; }
          }
          body {
            font-family: 'Courier New', monospace;
            margin: 0;
            padding: 20px;
            font-size: 12px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            font-size: 20px;
            font-weight: bold;
          }
          .header p {
            margin: 2px 0;
            font-size: 11px;
          }
          .quotation-info {
            margin-bottom: 20px;
          }
          .quotation-info div {
            display: flex;
            justify-between;
            margin: 3px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid #ddd;
          }
          th {
            background-color: #f2f2f2;
            font-weight: bold;
          }
          .total-row {
            font-weight: bold;
            font-size: 14px;
            border-top: 2px solid #000;
          }
          .footer {
            margin-top: 40px;
            border-top: 1px solid #000;
            padding-top: 10px;
          }
          .signature-line {
            margin-top: 40px;
            border-top: 1px solid #000;
            width: 200px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PciNet</h1>
          <p style="font-weight: bold;">COMPUTER TRADING</p>
          <p style="font-size: 10px;">CHARLIE G. HIADAN - Prop.</p>
          <p style="font-size: 10px;">VAT Reg. TIN: 106-638-378-00000</p>
          <p style="font-size: 10px;">B. Aquino Avenue, Quirino,</p>
          <p style="font-size: 10px;">Solano, Nueva Vizcaya</p>
          <p style="font-size: 9px;">E-mail: pcinet_s2016@yahoo.com • pcinet_acctdept@yahoo.com</p>
          <p style="font-size: 9px;">CP Nos: (078) 326-6008 • 0927 364 0644 • 0922 801 0247</p>
        </div>

        <div class="quotation-info">
          <div><span><strong>Quotation #:</strong></span><span>${quotation.quotationNumber}</span></div>
          <div><span><strong>Date:</strong></span><span>${new Date(quotation.quotationDate || quotation.createdAt).toLocaleDateString('en-PH')}</span></div>
          <div><span><strong>Customer:</strong></span><span>${quotation.customer?.name || quotation.customerName || 'Walk-in Customer'}</span></div>
          ${quotation.notes ? `<div><span><strong>Notes:</strong></span><span>${quotation.notes}</span></div>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 10%">#</th>
              <th style="width: 45%">Item Description</th>
              <th style="width: 15%">Qty</th>
              <th style="width: 15%">Unit Price</th>
              <th style="width: 15%">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${quotation.items.map((item: any, index: number) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.product?.name || 'Unknown Product'}</td>
                <td>${parseFloat(item.quantity).toFixed(2)}</td>
                <td>₱${parseFloat(item.unitPrice).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>₱${(parseFloat(item.quantity) * parseFloat(item.unitPrice)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="4" style="text-align: right;">TOTAL:</td>
              <td>₱${parseFloat(quotation.totalAmount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <p><strong>Note:</strong> This quotation is valid for 30 days from the date of issue.</p>
          <p>Thank you for your business!</p>
        </div>

        <div class="signature-line">
          <p>Authorized Signature</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
            // window.close(); // Uncomment to auto-close after printing
          }
        </script>
      </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
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
    // Prevent double submission
    if (isSubmitting) {
      console.log('[POS] Checkout already in progress - ignoring duplicate click')
      return
    }

    if (cart.length === 0) {
      setError('Cart is empty')
      return
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

    // Validate serial numbers for items that require them
    const itemsNeedingSerials = cart.filter(item => item.requiresSerial)
    for (const item of itemsNeedingSerials) {
      if (!item.serialNumberIds || item.serialNumberIds.length !== item.quantity) {
        setError(`Please select ${item.quantity} serial number(s) for "${item.name}"`)
        return
      }
    }

    setLoading(true)
    setIsSubmitting(true) // Lock to prevent double submission
    setError('')

    try {
      const subtotal = calculateSubtotal()
      const discountAmt = calculateDiscount()
      const total = calculateTotal()

      // Build payments array
      const payments: any[] = []
      if (!isCreditSale) {
        if (cashAmount && parseFloat(cashAmount) > 0) {
          payments.push({
            method: 'cash',
            amount: parseFloat(cashAmount),
          })
        }
        if (digitalAmount && parseFloat(digitalAmount) > 0) {
          payments.push({
            method: digitalMethod,
            amount: parseFloat(digitalAmount),
            reference: digitalReference || null,
            photo: digitalPhoto || null,
          })
        }
        if (chequeAmount && parseFloat(chequeAmount) > 0) {
          payments.push({
            method: 'cheque',
            amount: parseFloat(chequeAmount),
            reference: chequeNumber || null,
            chequeBank: chequeBank || null,
            chequeDate: chequeDate || null,
          })
        }
      }

      const saleData: any = {
        locationId: currentShift.locationId,
        customerId: selectedCustomer?.id,
        saleDate: new Date().toISOString(),
        items: cart.map((item) => ({
          productId: item.productId,
          productVariationId: item.productVariationId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          isFreebie: item.isFreebie,
          requiresSerial: item.requiresSerial || false,
          serialNumberIds: item.serialNumberIds || [],
        })),
        payments,
        discountAmount: discountAmt,
        status: isCreditSale ? 'pending' : 'completed',
        freebieTotal: freebieTotal,
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

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden gap-2">
        {/* Left Side - Products */}
        <div className="flex-[1.5] flex flex-col p-4 space-y-3 min-w-0">
          {/* Barcode Search */}
          <div className="bg-white p-3 rounded-lg shadow-md">
            <Label className="text-sm font-medium mb-2 block">
              Scan Barcode or Search Product (Ctrl+S to focus)
            </Label>
            <Input
              ref={barcodeInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value
                setSearchTerm(value)
                // Auto-switch to All Products when typing
                if (value && selectedCategory !== 'all') {
                  setSelectedCategory('all')
                }
              }}
              placeholder="Type product name or SKU, then press Enter..."
              className="text-lg"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = e.currentTarget.value
                  if (value) {
                    handleBarcodeScanned(value)
                    setSearchTerm('')
                  }
                }
              }}
            />
            {quantityMultiplier && (
              <p className="text-xs text-green-600 mt-1 font-semibold">
                ✓ Next product will be added with quantity: {quantityMultiplier}
              </p>
            )}
          </div>

          {/* Action Buttons Bar - Full Width Buttons with Icons and Text */}
          <div className="bg-white px-2 py-2 flex items-center space-x-2 shadow-md border rounded-lg">
            {/* X Reading Button */}
            <Button
              onClick={() => window.open('/dashboard/readings/x-reading', '_blank')}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg font-bold flex flex-row items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg h-[50px]"
              title="Generate X Reading (Mid-Shift Report)"
            >
              <span className="text-2xl leading-none">📊</span>
              <span className="text-sm font-bold leading-tight">X Read</span>
            </Button>

            {/* Cash In Button */}
            <Button
              onClick={() => {
                setCashIOAmount('')
                setCashIORemarks('')
                setShowCashInDialog(true)
              }}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-bold flex flex-row items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg h-[50px]"
            >
              <span className="text-2xl leading-none">💵</span>
              <span className="text-sm font-bold leading-tight">Cash <u>I</u>n</span>
            </Button>

            {/* Cash Out Button */}
            <Button
              onClick={() => {
                setCashIOAmount('')
                setCashIORemarks('')
                setShowCashOutDialog(true)
              }}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg font-bold flex flex-row items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg h-[50px]"
            >
              <span className="text-2xl leading-none">💸</span>
              <span className="text-sm font-bold leading-tight">Cash <u>O</u>ut</span>
            </Button>

            {/* AR Payment Collection Button */}
            <Button
              onClick={() => setShowARPaymentDialog(true)}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg font-bold flex flex-row items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg h-[50px]"
              title="Collect Accounts Receivable Payment"
            >
              <span className="text-2xl leading-none">💳</span>
              <span className="text-sm font-bold leading-tight">AR Pay</span>
            </Button>

            {/* Save Button */}
            <Button
              onClick={() => {
                if (cart.length === 0) {
                  setError('Cart is empty - nothing to save as quotation')
                  setTimeout(() => setError(''), 3000)
                  return
                }
                setShowQuotationDialog(true)
              }}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg font-bold flex flex-row items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg h-[50px]"
            >
              <span className="text-2xl leading-none">📋</span>
              <span className="text-sm font-bold leading-tight">Save (F2)</span>
            </Button>

            {/* Load Button */}
            <Button
              onClick={() => setShowSavedQuotations(true)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-bold flex flex-row items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg h-[50px]"
            >
              <span className="text-2xl leading-none">📂</span>
              <span className="text-sm font-bold leading-tight">Load (F3)</span>
            </Button>

            {/* Hold Button */}
            <Button
              onClick={() => setShowHoldDialog(true)}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg font-bold flex flex-row items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg h-[50px]"
            >
              <span className="text-2xl leading-none">⏸️</span>
              <span className="text-sm font-bold leading-tight">Hold (F5)</span>
            </Button>

            {/* Retrieve Button */}
            <Button
              onClick={() => setShowHeldTransactions(true)}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded-lg font-bold flex flex-row items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg h-[50px]"
            >
              <span className="text-2xl leading-none">▶️</span>
              <span className="text-sm font-bold leading-tight">Retrieve (F6)</span>
            </Button>
          </div>

          {error && (
            <div className="animate-blink rounded-lg border-2 border-red-700 bg-red-600 text-white text-sm sm:text-base font-semibold text-center py-3 shadow-[0_0_18px_rgba(220,38,38,0.75)]">
              <div className="flex items-center justify-center gap-3 uppercase tracking-wide">
                <span className="text-xl sm:text-2xl" role="img" aria-label="warning">
                  ⚠️
                </span>
                <span>{error}</span>
                <span className="text-xl sm:text-2xl" role="img" aria-label="warning">
                  ⚠️
                </span>
              </div>
              {error.includes('Insufficient payment') && (
                <p className="text-xs sm:text-sm font-normal normal-case tracking-normal mt-1">
                  Please tender the full amount before completing the sale.
                </p>
              )}
            </div>
          )}

          {/* Category Tabs - Scrollable Product Area */}
          <Tabs
            value={selectedCategory}
            onValueChange={setSelectedCategory}
            className="flex-1 flex flex-col bg-white rounded-lg shadow-md min-h-0 mt-3"
          >
            <TabsList className="w-full justify-start overflow-x-auto bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200 rounded-t-lg flex-shrink-0 h-auto py-2">
              {categories.map((cat) => (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id.toString()}
                  className="px-6 py-3 text-sm font-semibold text-gray-700 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
                >
                  {cat.name}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent
              value={selectedCategory}
              className="flex-1 overflow-y-auto p-3 min-h-0"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {currentProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="bg-white hover:shadow-xl transition-all hover:border-blue-400 cursor-pointer border"
                  >
                    <CardContent className="p-3">
                      <h3 className="font-bold text-xs mb-1 line-clamp-2 h-8">
                        {product.name}
                      </h3>
                      <p className="text-[10px] text-gray-500 mb-1">
                        SKU: {product.sku || product.variations?.[0]?.sku}
                      </p>
                      <p className="text-lg font-bold text-blue-600 mb-1">
                        ₱{parseFloat(
                          product.variations?.[0]?.sellingPrice || 0
                        ).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-green-600 mb-2">
                        Stock:{' '}
                        {product.variations?.[0]?.variationLocationDetails?.find(
                          (vl: any) => vl.locationId === currentShift.locationId
                        )?.qtyAvailable || 0}
                      </p>

                      <Button
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] h-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          addToCart(product, false)
                        }}
                      >
                        + Add
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-3">
                  <Button
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Side - Cart & Checkout */}
        <div className="flex-1 min-w-[400px] max-w-[550px] bg-white border-l flex flex-col shadow-2xl">
          {/* Customer Selection */}
          <div className="p-2 border-b bg-gradient-to-r from-gray-50 to-gray-100">
            <Label className="text-xs font-medium mb-1 block">Customer</Label>
            <div className="flex gap-2">
              <Select
                value={selectedCustomer?.id?.toString()}
                onValueChange={(value) => {
                  if (value === 'walk-in') {
                    setSelectedCustomer(null)
                    setIsCreditSale(false) // Uncheck credit sale when Walk-in is selected
                  } else {
                    const customer = customers.find((c) => c.id.toString() === value)
                    setSelectedCustomer(customer || null)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Walk-in Customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id.toString()}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
                onClick={() => setShowNewCustomerDialog(true)}
              >
                + New
              </Button>
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-2">
            <h2 className="font-bold text-sm mb-2">Cart Items</h2>
            {cart.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                No items in cart. Scan or select products.
              </p>
            ) : (
              <div className="space-y-1">
                {cart.map((item, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-1 p-2 bg-gray-50 rounded border text-xs"
                  >
                    <div className="flex items-center gap-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">
                          {item.name}
                          {item.isFreebie && (
                            <span className="ml-1 text-[10px] bg-green-500 text-white px-1 py-0.5 rounded">
                              FREE
                            </span>
                          )}
                          {item.requiresSerial && (
                            <span className="ml-1 text-[10px] bg-blue-500 text-white px-1 py-0.5 rounded">
                              SERIAL
                            </span>
                          )}
                        </p>
                        <p className="text-xs font-semibold text-gray-700">
                          ₱{item.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="sm"
                          className="h-7 w-7 p-0 text-xs bg-red-500 hover:bg-red-600 text-white font-bold rounded shadow"
                          onClick={() => updateQuantity(index, item.quantity - 1)}
                        >
                          −
                        </Button>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(index, parseInt(e.target.value) || 1)
                          }
                          className="w-20 text-center h-7 text-base font-black border-2 border-blue-400 rounded bg-white text-gray-900 px-1"
                        />
                        <Button
                          size="sm"
                          className="h-7 w-7 p-0 text-xs bg-green-500 hover:bg-green-600 text-white font-bold rounded shadow"
                          onClick={() => updateQuantity(index, item.quantity + 1)}
                        >
                          +
                        </Button>
                      </div>
                      <div className="text-right w-20">
                        <p className="font-bold text-xs">
                          ₱{(item.unitPrice * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 h-6 w-6 p-0"
                        onClick={() => removeFromCart(index)}
                      >
                        ×
                      </Button>
                    </div>

                    {/* Serial Number Selection */}
                    {item.requiresSerial && (
                      <div className="mt-1 pt-1 border-t">
                        <Button
                          size="sm"
                          className={`w-full text-xs h-7 font-medium shadow-sm hover:shadow-md transition-all ${
                            item.serialNumberIds.length === item.quantity
                              ? 'bg-green-600 hover:bg-green-700 text-white border-2 border-green-700'
                              : 'bg-yellow-600 hover:bg-yellow-700 text-white border-2 border-yellow-700'
                          }`}
                          onClick={() => handleOpenSerialDialog(index)}
                        >
                          {item.serialNumberIds.length === item.quantity ? (
                            <>✓ {item.serialNumberIds.length} Serial(s) Selected</>
                          ) : (
                            <>⚠ Select {item.quantity} Serial Number(s)</>
                          )}
                        </Button>
                        {item.serialNumbers && item.serialNumbers.length > 0 && (
                          <div className="mt-1 text-[10px] text-gray-600">
                            {item.serialNumbers.map((sn: any, idx: number) => (
                              <div key={idx} className="truncate">• {sn.serialNumber}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discount Section - Renamed */}
          <div className="p-2 border-t bg-yellow-50">
            <Label className="text-xs font-bold mb-1 block">Discount</Label>
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
                  placeholder="Enter discount amount..."
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  onClick={() => openKeypad('discount')}
                />
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="p-2 border-t space-y-1">
            <div className="flex justify-between text-xs">
              <span>Subtotal:</span>
              <span>₱{calculateSubtotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {calculateDiscount() > 0 && (
              <div className="flex justify-between text-xs text-red-600">
                <span>Discount:</span>
                <span>-₱{calculateDiscount().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            {freebieTotal > 0 && (
              <div className="flex justify-between text-xs text-green-600">
                <span>Freebie (Not Charged):</span>
                <span>₱{freebieTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-1">
              <span>TOTAL:</span>
              <span className="text-blue-600">
                ₱{calculateTotal().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="p-2 border-t space-y-2">
            <Label className="text-xs font-medium">Payment Method</Label>

            {/* Credit Sale Toggle */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="creditSale"
                checked={isCreditSale}
                onChange={(e) => setIsCreditSale(e.target.checked)}
                className="w-4 h-4"
                disabled={!selectedCustomer}
              />
              <label
                htmlFor="creditSale"
                className={`text-xs font-medium ${!selectedCustomer ? 'text-gray-400 cursor-not-allowed' : ''}`}
              >
                📝 Credit / Charge Invoice {!selectedCustomer && <span>(Select customer first)</span>}
              </label>
            </div>

            {!isCreditSale && (
              <>
                {/* Cash Payment */}
                <div className="space-y-1">
                  <Label className="text-xs">💵 Cash Payment</Label>
                  <Input
                    type="text"
                    placeholder="Cash amount..."
                    value={formatCurrencyDisplay(cashAmount)}
                    onChange={(e) => setCashAmount(sanitizeCurrencyInput(e.target.value))}
                    onClick={() => openKeypad('cash')}
                    className="text-sm font-bold h-8"
                    inputMode="decimal"
                  />
                </div>

                {/* Digital Payment */}
                <div className="space-y-1">
                  <Label className="text-xs">📱 Digital Payment</Label>
                  <div className="flex gap-2">
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
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setShowCameraDialog(true)
                            setTimeout(() => startCamera(), 100)
                          }}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium border-2 border-indigo-700 hover:border-indigo-800 shadow-md hover:shadow-lg transition-all"
                        >
                          📷 Capture Receipt
                        </Button>
                        {digitalPhoto && (
                          <span className="text-xs text-green-600 flex items-center">
                            ✓ Photo captured
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Cheque Payment */}
                <div className="space-y-1">
                  <Label className="text-xs">🏦 Cheque Payment</Label>
                  <Input
                    type="text"
                    placeholder="Cheque amount..."
                    value={formatCurrencyDisplay(chequeAmount)}
                    onChange={(e) => setChequeAmount(sanitizeCurrencyInput(e.target.value))}
                    className="text-sm font-bold h-8"
                    inputMode="decimal"
                  />
                  {chequeAmount && parseFloat(chequeAmount) > 0 && (
                    <>
                      <Input
                        placeholder="Cheque Number *"
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        className="text-xs"
                      />
                      <Input
                        placeholder="Bank Name *"
                        value={chequeBank}
                        onChange={(e) => setChequeBank(e.target.value)}
                        className="text-xs"
                      />
                      <Input
                        type="date"
                        placeholder="Cheque Date"
                        value={chequeDate}
                        onChange={(e) => setChequeDate(e.target.value)}
                        className="text-xs"
                      />
                    </>
                  )}
                </div>

                {/* Change Display */}
                {(cashAmount || digitalAmount || chequeAmount) && (
                  <div className={`p-2 rounded ${calculateChange() >= 0 ? 'bg-green-50' : 'bg-red-50 border-2 border-red-500'}`}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span>Total Paid:</span>
                      <span className="font-bold">₱{getTotalPayments().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span>Change:</span>
                      <span className={calculateChange() >= 0 ? 'text-green-600' : 'text-red-600'}>
                        ₱{calculateChange().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {calculateChange() < 0 && (
                      <div className="mt-2 p-2 bg-red-600 text-white rounded animate-blink">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="text-lg">⚠️</span>
                          <span className="font-bold text-sm">INSUFFICIENT PAYMENT DUE</span>
                          <span className="text-lg">⚠️</span>
                        </div>
                        <div className="text-center text-xs mt-1">
                          Short: ₱{Math.abs(calculateChange()).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {isCreditSale && (
              <Alert>
                <AlertDescription>
                  Credit sales require customer selection. Customer will pay later.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Checkout Button */}
          <div className="p-2 border-t">
            <Button
              className="w-full py-6 text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-xl"
              size="lg"
              onClick={handleCheckout}
              disabled={loading || cart.length === 0}
            >
              {loading ? '⏳ Processing...' : '🏪 COMPLETE SALE (Ctrl+P)'}
            </Button>
          </div>
        </div>
      </div>

      {/* Numeric Keypad Dialog */}
      <Dialog open={showNumericKeypad} onOpenChange={setShowNumericKeypad}>
        <DialogContent className="max-w-sm">
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
                  className="h-16 text-2xl font-bold bg-slate-700 hover:bg-slate-600 text-white border-2 border-slate-800 hover:border-slate-700 shadow-md hover:shadow-lg transition-all active:scale-95"
                >
                  {key}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => handleKeypadClick('C')}
                className="h-12 bg-red-600 hover:bg-red-700 text-white font-bold border-2 border-red-700 hover:border-red-800 shadow-md hover:shadow-lg transition-all"
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
            <Button onClick={() => {
              stopCamera()
              setShowCameraDialog(false)
            }} className="bg-gray-600 hover:bg-gray-700 text-white font-medium border-2 border-gray-700 hover:border-gray-800 shadow-md">
              Cancel
            </Button>
            <Button onClick={capturePhoto} className="bg-blue-600 hover:bg-blue-700 text-white font-medium border-2 border-blue-700 hover:border-blue-800 shadow-md">
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
            <Button onClick={() => setShowHoldDialog(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-medium border-2 border-gray-700 hover:border-gray-800 shadow-md">
              Cancel
            </Button>
            <Button onClick={saveHeldTransaction} className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium border-2 border-yellow-700 hover:border-yellow-800 shadow-md">
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
            <Button onClick={() => setShowNewCustomerDialog(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-medium border-2 border-gray-700 hover:border-gray-800 shadow-md">
              Cancel
            </Button>
            <Button onClick={handleCreateCustomer} className="bg-blue-600 hover:bg-blue-700 text-white font-medium border-2 border-blue-700 hover:border-blue-800 shadow-md">
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
            <Button onClick={() => setShowCashInDialog(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-medium border-2 border-gray-700 hover:border-gray-800 shadow-md">
              Cancel
            </Button>
            <Button onClick={handleCashIn} className="bg-green-600 hover:bg-green-700 text-white font-medium border-2 border-green-700 hover:border-green-800 shadow-md">
              Record Cash In
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
            <Button onClick={() => setShowCashOutDialog(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-medium border-2 border-gray-700 hover:border-gray-800 shadow-md">
              Cancel
            </Button>
            <Button onClick={handleCashOut} className="bg-red-600 hover:bg-red-700 text-white font-medium border-2 border-red-700 hover:border-red-800 shadow-md">
              Record Cash Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AR Payment Collection Modal */}
      {currentShift && (
        <ARPaymentCollectionModal
          isOpen={showARPaymentDialog}
          onClose={() => setShowARPaymentDialog(false)}
          shiftId={currentShift.id}
          onPaymentSuccess={() => {
            // Refresh today's sales or any other data if needed
            fetchTodaysSales()
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
              onClick={() => setShowQuotationDialog(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white font-medium border-2 border-gray-700 hover:border-gray-800 shadow-md"
            >
              Cancel
            </Button>
            <Button onClick={handleSaveQuotation} className="bg-purple-600 hover:bg-purple-700 text-white font-medium border-2 border-purple-700 hover:border-purple-800 shadow-md">
              Save Quotation
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
                    className="p-4 border rounded hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 cursor-pointer" onClick={() => handleLoadQuotation(quot)}>
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
                            onClick={(e) => handlePrintQuotation(quot, e)}
                            className="bg-green-600 hover:bg-green-700 text-white font-medium border-2 border-green-700 hover:border-green-800 shadow-sm"
                          >
                            🖨️ Print
                          </Button>
                          <Button
                            size="sm"
                            onClick={(e) => handleDeleteQuotation(quot.id, e)}
                            className="bg-red-600 hover:bg-red-700 text-white font-medium border-2 border-red-700 hover:border-red-800 shadow-sm"
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

      {/* Serial Number Selector Dialog */}
      {showSerialNumberDialog && serialNumberCartIndex !== null && (
        <SerialNumberSelector
          open={showSerialNumberDialog}
          onClose={() => {
            setShowSerialNumberDialog(false)
            setSerialNumberCartIndex(null)
          }}
          productId={cart[serialNumberCartIndex]?.productId}
          variationId={cart[serialNumberCartIndex]?.productVariationId}
          locationId={currentShift?.locationId}
          productName={cart[serialNumberCartIndex]?.name}
          quantityRequired={cart[serialNumberCartIndex]?.quantity}
          onConfirm={handleSerialNumberConfirm}
          preselectedIds={cart[serialNumberCartIndex]?.serialNumberIds || []}
        />
      )}
    </div>
  )
}
