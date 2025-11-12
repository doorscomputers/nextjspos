'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { Printer, X, FileText } from 'lucide-react'

interface QuotationPrintProps {
  quotation: any
  isOpen: boolean
  onClose: () => void
  business?: any
  location?: any
}

export default function QuotationPrint({
  quotation,
  isOpen,
  onClose,
  business: propBusiness,
  location: propLocation
}: QuotationPrintProps) {
  const [business, setBusiness] = useState<any>(propBusiness || null)
  const [location, setLocation] = useState<any>(propLocation || null)
  const [paperSize, setPaperSize] = useState<'80mm' | 'a4' | 'letter' | 'legal'>('letter')

  useEffect(() => {
    if (isOpen && quotation) {
      // Fetch data only if not provided as props
      const fetchPromises = []

      if (!propBusiness) {
        fetchPromises.push(
          fetch('/api/business').then(res => res.json()).catch(() => null)
        )
      } else {
        fetchPromises.push(Promise.resolve(propBusiness))
      }

      if (!propLocation && quotation.locationId) {
        fetchPromises.push(
          fetch(`/api/locations/${quotation.locationId}`)
            .then(res => res.json())
            .then(data => data.location ? data.location : data)
            .catch(() => null)
        )
      } else {
        fetchPromises.push(Promise.resolve(propLocation))
      }

      Promise.all(fetchPromises).then(([businessData, locationData]) => {
        if (businessData) setBusiness(businessData)
        if (locationData) setLocation(locationData)
      })
    }
  }, [isOpen, quotation, propBusiness, propLocation])

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      alert('Please allow popups to print')
      return
    }

    const invoiceContent = document.getElementById('quotation-print-content')
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

    const clonedContent = invoiceContent.cloneNode(true) as HTMLElement

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Quotation - ${quotation.quotationNumber}</title>
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

            .text-gray-900 { color: #111827; }
            .text-gray-800 { color: #1f2937; }
            .text-gray-700 { color: #374151; }
            .text-gray-600 { color: #4b5563; }
            .text-gray-500 { color: #6b7280; }
            .text-blue-600 { color: #2563eb; }

            .border-b-2 { border-bottom-width: 2px; }
            .border-black { border-color: #000; }
            .border-t-2 { border-top-width: 2px; }
            .border-y-2 { border-top-width: 2px; border-bottom-width: 2px; }
            .border-dashed { border-style: dashed; }
            .border-solid { border-style: solid; }
            .border-gray-300 { border-color: #d1d5db; }

            .pb-2 { padding-bottom: 0.5rem; }
            .pt-2 { padding-top: 0.5rem; }
            .pt-3 { padding-top: 0.75rem; }
            .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
            .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }

            .mb-1 { margin-bottom: 0.25rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-3 { margin-bottom: 0.75rem; }
            .mt-1 { margin-top: 0.25rem; }
            .mt-2 { margin-top: 0.5rem; }
            .mt-3 { margin-top: 0.75rem; }

            .w-full { width: 100%; }
            .border-collapse { border-collapse: collapse; }

            table { width: 100%; border-collapse: collapse; }
            td, th { padding: 0.25rem; }

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

    setTimeout(() => {
      printWindow.print()
      setTimeout(() => {
        printWindow.close()
      }, 100)
    }, 500)
  }

  if (!quotation || !business) return null

  const businessName = (business.invoiceHeaderName || business.name || 'PciNet Computer Trading & Services').toUpperCase()
  const ownerTitle = business.ownerTitle || 'Prop.'
  const proprietorLine = business.ownerName
    ? `${business.ownerName} - ${ownerTitle}`
    : 'CHARLIE G. HIADAN - Prop.'

  const vatTin = business.taxNumber1 || business.taxNumber || business.tinNumber || '106-638-378-00000'

  const addressLinePrimary =
    business.invoiceAddress ||
    business.billingAddress ||
    location?.landmark ||
    'B. Aquino Avenue, Quirino'

  const addressLineSecondary = [
    location?.city,
    location?.state,
    location?.zipCode ? location.zipCode.toString() : null,
  ]
    .filter(Boolean)
    .join(', ') || 'Solano, Nueva Vizcaya'

  const emailCandidates = [
    business.email,
    business.accountingEmail,
    business.invoiceEmail,
    location?.email,
  ].filter(Boolean)

  const uniqueEmails = Array.from(new Set(emailCandidates as string[]))
  const emailLine =
    uniqueEmails.length > 0
      ? `E-mail: ${uniqueEmails.join(' • ')}`
      : 'E-mail: pcinet_s2016@yahoo.com • pcinet_acctgdept@yahoo.com'

  const phoneCandidates = [
    business.phone,
    business.contactNumber,
    location?.mobile,
  ].filter(Boolean)

  const uniquePhones = Array.from(new Set(phoneCandidates as string[]))
  const phoneLine =
    uniquePhones.length > 0
      ? `CP Nos: ${uniquePhones.join(' • ')}`
      : 'CP Nos: (078) 326-6008 • 0927 364 0644 • 0922 891 0427'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="bg-white">
          {/* Action Buttons */}
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
                Print Quotation
              </Button>
              <Button onClick={onClose} variant="outline" size="lg" className="gap-2">
                <X className="h-5 w-5" />
                Close
              </Button>
            </div>
          </div>

          {/* Quotation Content */}
          <div
            className={`bg-white ${paperSize === '80mm' ? 'max-w-[80mm] mx-auto' : 'p-8'}`}
            id="quotation-print-content"
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
              {location?.name && (
                <p className={`text-gray-500 mt-1 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  {location.name}
                </p>
              )}
            </div>

            {/* Quotation Info */}
            <div className={`mb-3 ${paperSize === '80mm' ? 'text-center' : ''}`}>
              <h2 className={`font-bold text-blue-600 mb-2 ${paperSize === '80mm' ? 'text-sm' : 'text-lg'}`}>
                PRICE QUOTATION
              </h2>
              <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                <span className="font-semibold">Quotation #:</span> {quotation.quotationNumber}
              </p>
              <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                <span className="font-semibold">Date:</span>{' '}
                {new Date(quotation.quotationDate || quotation.createdAt).toLocaleDateString('en-PH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
              <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                <span className="font-semibold">Valid Until:</span>{' '}
                {quotation.expiryDate
                  ? new Date(quotation.expiryDate).toLocaleDateString('en-PH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : 'N/A'
                }
              </p>
              <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                <span className="font-semibold">Customer:</span>{' '}
                {quotation.customer?.name || quotation.customerName || 'Walk-in Customer'}
              </p>
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
                {quotation.items?.map((item: any, index: number) => (
                  <tr key={index} className="border-b border-dashed border-gray-300">
                    <td className={`py-1 text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                      {item.product?.name || item.productName || `Product #${item.productId}`}
                      {item.product?.sku && (
                        <div className={`text-gray-500 ${paperSize === '80mm' ? 'text-[10px]' : 'text-xs'}`}>
                          SKU: {item.product.sku}
                        </div>
                      )}
                    </td>
                    <td className={`py-1 text-center text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                      {parseFloat(item.quantity).toFixed(2)}
                    </td>
                    <td className={`py-1 text-right text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                      ₱{parseFloat(item.unitPrice).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                    <td className={`py-1 text-right text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                      ₱{(parseFloat(item.quantity) * parseFloat(item.unitPrice)).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals Section */}
            <div className="border-t-2 border-black pt-2">
              {/* Subtotal */}
              {quotation.subtotal && (
                <div className="flex justify-between py-1">
                  <span className={`text-gray-700 font-semibold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    Subtotal:
                  </span>
                  <span className={`text-gray-900 font-bold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    ₱{parseFloat(quotation.subtotal).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>
              )}

              {/* Discount */}
              {quotation.discountAmount && parseFloat(quotation.discountAmount) > 0 && (
                <div className="flex justify-between py-1">
                  <span className={`text-gray-700 font-semibold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    Discount:
                  </span>
                  <span className={`text-gray-900 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    -₱{parseFloat(quotation.discountAmount).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex justify-between py-2 border-y-2 border-black my-2">
                <span className={`font-bold text-gray-900 ${paperSize === '80mm' ? 'text-sm' : 'text-lg'}`}>
                  TOTAL:
                </span>
                <span className={`font-bold text-gray-900 ${paperSize === '80mm' ? 'text-sm' : 'text-lg'}`}>
                  ₱{parseFloat(quotation.totalAmount).toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>
            </div>

            {/* Notes */}
            {quotation.notes && (
              <div className="mt-3 pt-2 border-t border-dashed border-gray-300">
                <p className={`font-semibold text-gray-900 mb-1 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  Notes:
                </p>
                <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  {quotation.notes}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="text-center pt-3 border-t-2 border-black mt-3">
              <p className={`text-gray-600 mb-1 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                This quotation is valid for {quotation.validDays || 7} days from the date of issue.
              </p>
              <p className={`text-gray-600 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                Thank you for considering our products and services.
              </p>
              <p className={`text-gray-500 mt-2 ${paperSize === '80mm' ? 'text-[10px]' : 'text-xs'}`}>
                Generated by: {business.name} POS System
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
