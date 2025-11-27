'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { Printer, X, FileText } from 'lucide-react'

interface SalesInvoicePrintProps {
  sale: any
  isOpen: boolean
  isReprint?: boolean
  onClose: () => void
  business?: any
  location?: any
}

export default function SalesInvoicePrint({ sale, isOpen, isReprint = false, onClose, business: propBusiness, location: propLocation }: SalesInvoicePrintProps) {
  // Handle nested location object if API returns {location: {...}}
  const normalizedLocation = propLocation?.location ? propLocation.location : propLocation

  const [business, setBusiness] = useState<any>(propBusiness || null)
  const [location, setLocation] = useState<any>(normalizedLocation || null)
  const [cashier, setCashier] = useState<any>(null)
  const [paperSize, setPaperSize] = useState<'80mm' | 'a4' | 'letter' | 'legal'>('letter')


  useEffect(() => {
    if (isOpen && sale) {
      // Set cashier from sale.creator if available
      if ((sale as any).creator) {
        setCashier((sale as any).creator)
      } else if (sale.createdBy) {
        setCashier({ id: sale.createdBy, username: `User #${sale.createdBy}` })
      }

      // Fetch data only if not provided as props
      const fetchPromises = []

      if (!propBusiness) {
        fetchPromises.push(
          fetch('/api/business').then(res => res.json()).catch(() => null)
        )
      } else {
        fetchPromises.push(Promise.resolve(propBusiness))
      }

      if (!normalizedLocation && sale.locationId) {
        fetchPromises.push(
          fetch(`/api/locations/${sale.locationId}`)
            .then(res => res.json())
            .then(data => data.location ? data.location : data)
            .catch(() => null)
        )
      } else {
        fetchPromises.push(Promise.resolve(normalizedLocation))
      }

      Promise.all(fetchPromises).then(([businessData, locationData]) => {
        if (businessData) setBusiness(businessData)
        if (locationData) setLocation(locationData)
      })
    }
  }, [isOpen, sale, propBusiness, propLocation, normalizedLocation])

  const handlePrint = () => {
    // Create a new window with just the invoice content
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      alert('Please allow popups to print')
      return
    }

    const invoiceContent = document.getElementById('invoice-content')
    if (!invoiceContent) return

    // Get the computed paper size settings
    let pageSize = ''
    let pageMargin = ''
    let contentWidth = ''
    let fontSize = ''
    let smallFont = ''
    let tinyFont = ''

    if (paperSize === '80mm') {
      pageSize = 'size: 80mm auto;'
      pageMargin = 'margin: 0;'
      contentWidth = '80mm'
      fontSize = '10px'
      smallFont = '9px'
      tinyFont = '8px'
    } else if (paperSize === 'a4') {
      pageSize = 'size: A4 portrait;'
      pageMargin = 'margin: 10mm;'
      contentWidth = '100%'
      fontSize = '14px'
      smallFont = '12px'
      tinyFont = '11px'
    } else if (paperSize === 'letter') {
      pageSize = 'size: letter portrait;'
      pageMargin = 'margin: 10mm;'
      contentWidth = '100%'
      fontSize = '14px'
      smallFont = '12px'
      tinyFont = '11px'
    } else {
      pageSize = 'size: legal portrait;'
      pageMargin = 'margin: 10mm;'
      contentWidth = '100%'
      fontSize = '14px'
      smallFont = '12px'
      tinyFont = '11px'
    }

    // Clone the invoice content and get its HTML
    const clonedContent = invoiceContent.cloneNode(true) as HTMLElement

    // Write the complete HTML document with all necessary styles
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Sales Invoice - ${sale.invoiceNumber}</title>
          <style>
            @page {
              ${pageSize}
              ${pageMargin}
            }

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              width: ${contentWidth};
              margin: 0 auto;
              padding: ${paperSize === '80mm' ? '2mm' : '0'};
              background: white;
              color: #000;
              font-size: ${fontSize};
              line-height: 1.4;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .uppercase { text-transform: uppercase; }
            .capitalize { text-transform: capitalize; }

            .text-gray-900 { color: #111827; }
            .text-gray-800 { color: #1f2937; }
            .text-gray-700 { color: #374151; }
            .text-gray-600 { color: #4b5563; }
            .text-gray-500 { color: #6b7280; }
            .text-red-600 { color: #dc2626; }
            .text-blue-700 { color: #1d4ed8; }
            .text-green-600 { color: #16a34a; }

            .bg-yellow-50 { background-color: #fefce8; }
            .border-yellow-300 { border-color: #fde047; }

            .border-b-2 { border-bottom-width: 2px; }
            .border-black { border-color: #000; }
            .border-t-2 { border-top-width: 2px; }
            .border-y-2 { border-top-width: 2px; border-bottom-width: 2px; }
            .border-y { border-top-width: 1px; border-bottom-width: 1px; }
            .border-t { border-top-width: 1px; }
            .border-b { border-bottom-width: 1px; }
            .border-dashed { border-style: dashed; }
            .border-solid { border-style: solid; }
            .border { border-width: 1px; }
            .border-gray-400 { border-color: #9ca3af; }
            .border-gray-300 { border-color: #d1d5db; }
            .rounded { border-radius: 0.25rem; }

            .pb-2 { padding-bottom: 0.5rem; }
            .pt-2 { padding-top: 0.5rem; }
            .pt-3 { padding-top: 0.75rem; }
            .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
            .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
            .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
            .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
            .p-2 { padding: 0.5rem; }
            .p-4 { padding: 1rem; }

            .mb-1 { margin-bottom: 0.25rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-3 { margin-bottom: 0.75rem; }
            .mt-1 { margin-top: 0.25rem; }
            .mt-2 { margin-top: 0.5rem; }
            .mt-3 { margin-top: 0.75rem; }
            .my-2 { margin-top: 0.5rem; margin-bottom: 0.5rem; }

            .w-full { width: 100%; }
            .border-collapse { border-collapse: collapse; }

            table { width: 100%; border-collapse: collapse; }
            td, th { padding: 0.25rem; }

            .grid { display: grid; }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .gap-4 { gap: 1rem; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .space-y-2 > * + * { margin-top: 0.5rem; }

            ${paperSize === '80mm' ? `
              .text-sm { font-size: ${fontSize}; }
              .text-xs { font-size: ${smallFont}; }
              .text-\\[10px\\] { font-size: ${tinyFont}; }
              .text-lg { font-size: 11px; }
              .text-2xl { font-size: 12px; }
              .text-base { font-size: ${fontSize}; }
            ` : `
              .text-sm { font-size: ${smallFont}; }
              .text-xs { font-size: ${tinyFont}; }
              .text-\\[10px\\] { font-size: 10px; }
              .text-lg { font-size: 18px; }
              .text-2xl { font-size: 24px; }
              .text-base { font-size: 16px; }
            `}

            @media print {
              body {
                width: ${contentWidth};
              }
            }
          </style>
        </head>
        <body>
          ${clonedContent.innerHTML}
        </body>
      </html>
    `)

    printWindow.document.close()

    try {
      const invoicePath = `/print/sales-invoice/${sale.invoiceNumber || 'receipt'}`
      printWindow.history.replaceState(null, '', invoicePath)
    } catch (error) {
      console.warn('[Print] Unable to adjust print window URL', error)
    }

    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print()
      setTimeout(() => {
        printWindow.close()
      }, 100)
    }, 500)
  }

  if (!sale || !business) return null

  // Helper function to format payment method names
  const formatPaymentMethod = (method: string | null | undefined): string => {
    if (!method || method.trim() === '') return 'Digital Payment'

    const methodMap: { [key: string]: string } = {
      'cash': 'Cash',
      'card': 'Card',
      'credit_card': 'Credit Card',
      'debit_card': 'Debit Card',
      'bank_transfer': 'Bank Transfer',
      'cheque': 'Cheque',
      'check': 'Cheque',
      'mobile_payment': 'Mobile Payment',
      'gcash': 'GCash',
      'paymaya': 'PayMaya',
      'credit': 'Account Receivable'
    }

    const normalized = method.toLowerCase().trim()
    return methodMap[normalized] || method.charAt(0).toUpperCase() + method.slice(1)
  }

  // Calculate payment totals
  const totalPaid = sale.payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0) || 0
  const totalAmount = parseFloat(sale.totalAmount || 0)

  // Calculate cash tendered and change
  // If cashTendered is stored (new sales), use it; otherwise fall back to totalPaid (old sales)
  const cashTendered = sale.cashTendered ? parseFloat(sale.cashTendered) : totalPaid
  const changeAmount = Math.max(0, cashTendered - totalAmount)

  // BIR VAT Calculation (12% VAT)
  const isVATExempt = sale.vatExempt || sale.discountType === 'senior' || sale.discountType === 'pwd'
  let vatableSales = 0
  let vatAmount = 0
  let vatExemptAmount = 0

  if (isVATExempt) {
    vatExemptAmount = totalAmount
  } else {
    // VAT-Inclusive calculation
    vatableSales = totalAmount / 1.12
    vatAmount = vatableSales * 0.12
  }

  const businessName = (business.invoiceHeaderName || business.name || 'PciNet Computer Trading').toUpperCase()
  const ownerTitle = business.ownerTitle || 'Prop.'
  const proprietorLine = business.ownerName
    ? `${business.ownerName} - ${ownerTitle}`
    : 'CHARLIE G. HIADAN - Prop.'

  const vatTin = business.taxNumber1 || business.taxNumber || business.tinNumber || '106-638-378-00000'

  const addressLinePrimary =
    business.invoiceAddress ||
    business.billingAddress ||
    location.landmark ||
    'B. Aquino Avenue, Quirino'

  const addressLineSecondary = [
    location.city,
    location.state,
    location.zipCode ? location.zipCode.toString() : null,
  ]
    .filter(Boolean)
    .join(', ') || 'Solano, Nueva Vizcaya'

  const emailCandidates = [
    business.email,
    business.accountingEmail,
    business.invoiceEmail,
    business.supportEmail,
    location.email,
  ].filter(Boolean)

  const uniqueEmails = Array.from(new Set(emailCandidates as string[]))
  const emailLine =
    uniqueEmails.length > 0
      ? `E-mail: ${uniqueEmails.join(' • ')}`
      : 'E-mail: pcinet_s2016@yahoo.com • pcinet_acctgdept@yahoo.com'

  const phoneCandidates = [
    business.phone,
    business.contactNumber,
    business.telephone,
    location.mobile,
    location.alternateNumber,
  ].filter(Boolean)

  const uniquePhones = Array.from(new Set(phoneCandidates as string[]))
  const phoneLine =
    uniquePhones.length > 0
      ? `Mobile #: ${uniquePhones.join(' • ')}`
      : 'Mobile #: (078) 326-6008 • 0927 364 0644 • 0922 891 0427'

  const saleDateValue = sale?.saleDate ? new Date(sale.saleDate) : new Date()
  const saleCreatedValue = sale?.createdAt ? new Date(sale.createdAt) : saleDateValue
  const invoiceDate = saleDateValue.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const invoiceTime = saleCreatedValue.toLocaleTimeString('en-PH')
  const formattedCashierName = cashier
    ? (cashier.firstName && cashier.lastName
        ? `${cashier.firstName} ${cashier.lastName}`
        : cashier.username || 'Unknown')
    : 'Loading...'
  const branchName = location?.name || (sale.locationId ? 'Loading...' : 'N/A')

  const renderCustomerField = (label: string, value: string) => (
    <div className="flex py-0.5">
      <span className={`text-gray-700 font-semibold ${paperSize === '80mm' ? 'text-xs w-24' : 'text-sm w-28'}`}>
        {label}
      </span>
      <span className={`text-gray-900 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'} flex-1`}>
        {value}
      </span>
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="bg-white">
          {/* Action Buttons - Hidden when printing */}
          <div className="flex justify-between items-center mb-4 print:hidden bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setPaperSize('80mm')}
                size="sm"
                className={`gap-2 font-semibold transition-all ${
                  paperSize === '80mm'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-700 shadow-lg'
                    : 'bg-white hover:bg-gray-100 text-gray-700 border-2 border-gray-300'
                }`}
              >
                <FileText className="h-4 w-4" />
                80mm Thermal
                {paperSize === '80mm' && <span className="ml-1">✓</span>}
              </Button>
              <Button
                onClick={() => setPaperSize('a4')}
                size="sm"
                className={`gap-2 font-semibold transition-all ${
                  paperSize === 'a4'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-700 shadow-lg'
                    : 'bg-white hover:bg-gray-100 text-gray-700 border-2 border-gray-300'
                }`}
              >
                <FileText className="h-4 w-4" />
                A4
                {paperSize === 'a4' && <span className="ml-1">✓</span>}
              </Button>
              <Button
                onClick={() => setPaperSize('letter')}
                size="sm"
                className={`gap-2 font-semibold transition-all ${
                  paperSize === 'letter'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-700 shadow-lg'
                    : 'bg-white hover:bg-gray-100 text-gray-700 border-2 border-gray-300'
                }`}
              >
                <FileText className="h-4 w-4" />
                Letter
                {paperSize === 'letter' && <span className="ml-1">✓</span>}
              </Button>
              <Button
                onClick={() => setPaperSize('legal')}
                size="sm"
                className={`gap-2 font-semibold transition-all ${
                  paperSize === 'legal'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-700 shadow-lg'
                    : 'bg-white hover:bg-gray-100 text-gray-700 border-2 border-gray-300'
                }`}
              >
                <FileText className="h-4 w-4" />
                Legal
                {paperSize === 'legal' && <span className="ml-1">✓</span>}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handlePrint}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6"
                size="lg"
              >
                <Printer className="h-5 w-5" />
                Print Receipt
              </Button>
              <Button onClick={onClose} variant="outline" size="lg" className="gap-2">
                <X className="h-5 w-5" />
                Close
              </Button>
            </div>
          </div>

          {/* Invoice Content */}
          <div
            className={`bg-white ${paperSize === '80mm' ? 'max-w-[80mm] mx-auto' : 'p-8'}`}
            id="invoice-content"
          >
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-2 mb-3">
              <h1 className={`font-bold tracking-wide text-gray-900 uppercase ${paperSize === '80mm' ? 'text-sm' : 'text-2xl'}`}>
                {businessName}
              </h1>
              <p className={`font-semibold uppercase text-gray-800 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                {proprietorLine}
              </p>
              <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                VAT Reg. TIN: {vatTin}
              </p>
              <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                {addressLinePrimary}
              </p>
              <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                {addressLineSecondary}
              </p>
              <p className={`text-gray-600 mt-1 ${paperSize === '80mm' ? 'text-[10px]' : 'text-xs'}`}>
                {emailLine}
              </p>
              <p className={`text-gray-600 ${paperSize === '80mm' ? 'text-[10px]' : 'text-xs'}`}>
                {phoneLine}
              </p>
            </div>

            {/* Invoice Info */}
            <div className={`mb-3 ${paperSize === '80mm' ? 'text-center space-y-1' : 'grid grid-cols-2 gap-4 items-start'}`}>
              <div className={paperSize === '80mm' ? '' : 'space-y-1'}>
                <h2 className={`font-bold text-gray-900 mb-1 ${paperSize === '80mm' ? 'text-sm' : 'text-lg'}`}>
                  {(() => {
                    // Determine invoice type based on payment method
                    const hasCredit = sale.payments?.some((p: any) => p.paymentMethod === 'credit')
                    const totalPaid = sale.payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0) || 0

                    // If there's a credit payment or no payment (amount = 0), it's a charge invoice
                    if (hasCredit || totalPaid === 0) {
                      return 'CHARGE INVOICE'
                    }
                    return 'SALES INVOICE'
                  })()}
                </h2>
                {isReprint && (
                  <div className={`${paperSize === '80mm' ? 'text-xs' : 'text-base'} font-bold text-red-600 mb-2 border-2 border-red-600 inline-block px-3 py-1 rounded`}>
                    ⚠ RE-PRINT
                  </div>
                )}
                <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  <span className="font-semibold">Invoice #:</span> {sale.invoiceNumber}
                </p>
                {paperSize === '80mm' && (
                  <>
                    <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                      <span className="font-semibold">Date & Time:</span> {invoiceDate} • {invoiceTime}
                    </p>
                    <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                      <span className="font-semibold">Cashier:</span> {formattedCashierName} • <span className="font-semibold">Branch:</span> {branchName}
                    </p>
                  </>
                )}
              </div>
              {paperSize !== '80mm' && (
                <div className="space-y-1 text-right">
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Date & Time:</span> {invoiceDate} • {invoiceTime}
                  </p>
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Cashier:</span> {formattedCashierName} • <span className="font-semibold">Branch:</span> {branchName}
                  </p>
                </div>
              )}
            </div>

            {/* Items Table */}
            <table className="w-full mb-3 border-collapse">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className={`text-left py-1 font-bold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    ITEM
                  </th>
                  <th className={`text-center py-1 font-bold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    QTY
                  </th>
                  <th className={`text-right py-1 font-bold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    PRICE
                  </th>
                  <th className={`text-right py-1 font-bold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    AMOUNT
                  </th>
                </tr>
              </thead>
              <tbody>
                {sale.items?.map((item: any, index: number) => {
                  const qty = item.displayQuantity && item.selectedUnitName
                    ? parseFloat(item.displayQuantity)
                    : parseFloat(item.quantity)
                  const lineTotal = qty * parseFloat(item.unitPrice)
                  const itemDiscount = item.discountAmount ? parseFloat(item.discountAmount) : 0
                  const finalAmount = lineTotal - itemDiscount

                  return (
                    <tr key={index} className="border-b border-dashed border-gray-300">
                      <td className={`py-1 text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                        {item.product?.name || item.productName || `Product #${item.productId}`}
                        {/* Show item discount info below product name */}
                        {itemDiscount > 0 && (
                          <div className={`text-orange-600 ${paperSize === '80mm' ? 'text-[8px]' : 'text-xs'}`}>
                            Disc: {item.discountType === 'percentage' ? `${item.discountValue}%` : `₱${parseFloat(item.discountValue).toFixed(2)}`} (-₱{itemDiscount.toFixed(2)})
                          </div>
                        )}
                      </td>
                      <td className={`py-1 text-center text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                        {item.displayQuantity && item.selectedUnitName
                          ? `${parseFloat(item.displayQuantity).toFixed(2)} ${item.selectedUnitName}`
                          : parseFloat(item.quantity).toFixed(2)}
                      </td>
                      <td className={`py-1 text-right text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                        ₱{parseFloat(item.unitPrice).toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td className={`py-1 text-right ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                        {/* Show original amount struck through if discount applied */}
                        {itemDiscount > 0 ? (
                          <div>
                            <span className="text-gray-400 line-through text-[10px]">
                              ₱{lineTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <br />
                            <span className="text-gray-900 font-bold">
                              ₱{finalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-700">
                            ₱{lineTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Totals Section */}
            <div className="border-t-2 border-black pt-2">
              {/* Subtotal */}
              <div className="flex justify-between py-1">
                <span className={`text-gray-700 font-semibold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  Subtotal:
                </span>
                <span className={`text-gray-900 font-bold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  ₱{parseFloat(sale.subtotal).toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>

              {/* Number of Items */}
              <div className="flex justify-between py-1">
                <span className={`text-gray-700 font-semibold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  Number of Items:
                </span>
                <span className={`text-gray-900 font-bold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  {sale.items?.length || 0}
                </span>
              </div>

              {/* Total Quantity */}
              <div className="flex justify-between py-1">
                <span className={`text-gray-700 font-semibold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  Total Quantity:
                </span>
                <span className={`text-gray-900 font-bold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  {sale.items?.reduce((sum: number, item: any) => sum + parseFloat(item.quantity || 0), 0) || 0}
                </span>
              </div>

              {/* Item Discounts Total */}
              {(() => {
                const itemDiscountsTotal = sale.items?.reduce((sum: number, item: any) =>
                  sum + (item.discountAmount ? parseFloat(item.discountAmount) : 0), 0) || 0
                return itemDiscountsTotal > 0 ? (
                  <div className="flex justify-between py-1">
                    <span className={`text-orange-600 font-semibold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                      Item Discounts:
                    </span>
                    <span className={`text-orange-600 font-bold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                      -₱{itemDiscountsTotal.toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>
                ) : null
              })()}

              {/* Senior/PWD Discount */}
              {(() => {
                // Calculate sale-level discount by subtracting item discounts from total discount
                const itemDiscountsTotal = sale.items?.reduce((sum: number, item: any) =>
                  sum + (item.discountAmount ? parseFloat(item.discountAmount) : 0), 0) || 0
                const saleLevelDiscount = parseFloat(sale.discountAmount || 0) - itemDiscountsTotal
                return saleLevelDiscount > 0 ? (
                  <div className="flex justify-between py-1">
                    <span className={`text-red-600 font-semibold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                      {sale.discountType === 'senior' ? 'Senior Discount' : sale.discountType === 'pwd' ? 'PWD Discount' : 'Discount'} {sale.discountType && `(${sale.discountType})`}:
                    </span>
                    <span className={`text-red-600 font-bold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                      -₱{saleLevelDiscount.toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>
                ) : null
              })()}

              {/* BIR VAT Breakdown */}
              <div className="border-y border-dashed border-gray-400 my-2 py-2">
                <p className={`font-bold text-gray-900 mb-1 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  BIR VAT BREAKDOWN:
                </p>
                {isVATExempt ? (
                  <div className="flex justify-between py-0.5">
                    <span className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                      VAT-Exempt Sales:
                    </span>
                    <span className={`text-gray-900 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                      ₱{vatExemptAmount.toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between py-0.5">
                      <span className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                        VATable Sales:
                      </span>
                      <span className={`text-gray-900 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                        ₱{vatableSales.toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                        VAT Amount (12%):
                      </span>
                      <span className={`text-gray-900 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                        ₱{vatAmount.toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Grand Total */}
              <div className="flex justify-between py-2 border-y-2 border-black my-2">
                <span className={`font-bold text-gray-900 ${paperSize === '80mm' ? 'text-sm' : 'text-lg'}`}>
                  TOTAL:
                </span>
                <span className={`font-bold text-gray-900 ${paperSize === '80mm' ? 'text-sm' : 'text-lg'}`}>
                  ₱{totalAmount.toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>

              {/* Payment Details */}
              <div className="mt-2 pt-2 border-t border-dashed border-gray-400">
                <p className={`font-bold text-gray-900 mb-1 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  PAYMENT DETAILS:
                </p>
                {sale.payments?.map((payment: any, index: number) => (
                  <div key={index} className="flex justify-between py-0.5">
                    <span className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                      {formatPaymentMethod(payment.paymentMethod)}:
                    </span>
                    <span className={`text-gray-900 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                      ₱{parseFloat(payment.amount).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>
                ))}

                {/* Amount Tendered - Hidden for Credit/Charge Invoice */}
                {(() => {
                  const hasCredit = sale.payments?.some((p: any) => p.paymentMethod === 'credit')
                  const totalPaid = sale.payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0) || 0
                  const isChargeInvoice = hasCredit || totalPaid === 0

                  if (isChargeInvoice) return null

                  return (
                    <div className="flex justify-between py-0.5 font-semibold">
                      <span className={`text-blue-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                        Amount Tendered:
                      </span>
                      <span className={`text-blue-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                        ₱{cashTendered.toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </div>
                  )
                })()}

                {/* Customer Information */}
                <div className="mt-2 pt-2 border-t border-gray-300 space-y-1">
                  {paperSize === '80mm' ? (
                    <>
                      {renderCustomerField('Sold to:', sale.customer?.name || 'Walk-in Customer')}
                      {renderCustomerField('Address:', sale.customer?.address || '_______________________________')}
                      {renderCustomerField('TIN:', sale.customer?.taxNumber || '_______________________________')}
                      {renderCustomerField('Bus. Style:', sale.customer?.businessStyle || '_______________________________')}
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                        {renderCustomerField('Sold to:', sale.customer?.name || 'Walk-in Customer')}
                        {renderCustomerField('TIN:', sale.customer?.taxNumber || '_______________________________')}
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                        {renderCustomerField('Address:', sale.customer?.address || '_______________________________')}
                        {renderCustomerField('Bus. Style:', sale.customer?.businessStyle || '_______________________________')}
                      </div>
                    </>
                  )}
                </div>

                {/* Change - Hidden for Credit/Charge Invoice */}
                {(() => {
                  const hasCredit = sale.payments?.some((p: any) => p.paymentMethod === 'credit')
                  const totalPaid = sale.payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0) || 0
                  const isChargeInvoice = hasCredit || totalPaid === 0

                  if (isChargeInvoice || changeAmount <= 0) return null

                  return (
                    <div className="flex justify-between py-0.5 font-bold mt-2">
                      <span className={`text-green-600 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                        Change:
                      </span>
                      <span className={`text-green-600 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                        ₱{changeAmount.toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Discount Details (if applicable) */}
            {(sale.seniorCitizenId || sale.pwdId) && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-300 rounded">
                <p className={`font-bold text-gray-900 mb-1 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  BIR DISCOUNT DETAILS:
                </p>
                {sale.seniorCitizenId && (
                  <div className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <p>Senior Citizen ID: {sale.seniorCitizenId}</p>
                    <p>Name: {sale.seniorCitizenName}</p>
                  </div>
                )}
                {sale.pwdId && (
                  <div className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <p>PWD ID: {sale.pwdId}</p>
                    <p>Name: {sale.pwdName}</p>
                  </div>
                )}
              </div>
            )}

            {/* Remarks (if provided) */}
            {sale.remarks && (
              <div className="mt-3 p-2 border border-gray-300 rounded">
                <p className={`font-bold text-gray-900 mb-1 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  REMARKS:
                </p>
                <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  {sale.remarks}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="text-center pt-3 border-t-2 border-black mt-3">
              <p className={`text-gray-600 mb-1 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                Thank you for shopping with us!
              </p>
              <p className={`text-gray-500 ${paperSize === '80mm' ? 'text-[10px]' : 'text-xs'}`}>
                This serves as your Warranty Slip. Please keep for your records.
              </p>
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  )
}
