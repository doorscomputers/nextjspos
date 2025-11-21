'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { Printer, X } from 'lucide-react'

interface ExchangeInvoicePrintProps {
  exchange: any // Exchange data including both return and exchange items
  isOpen: boolean
  onClose: () => void
  business?: any
  location?: any
}

export default function ExchangeInvoicePrint({
  exchange,
  isOpen,
  onClose,
  business: propBusiness,
  location: propLocation
}: ExchangeInvoicePrintProps) {
  const normalizedLocation = propLocation?.location ? propLocation.location : propLocation

  const [business, setBusiness] = useState<any>(propBusiness || null)
  const [location, setLocation] = useState<any>(normalizedLocation || null)
  const [cashier, setCashier] = useState<any>(null)
  const [paperSize, setPaperSize] = useState<'80mm' | 'a4' | 'letter' | 'legal'>('letter')

  useEffect(() => {
    if (isOpen && exchange) {
      // Set cashier from exchange.creator if available
      if ((exchange as any).creator) {
        setCashier((exchange as any).creator)
      } else if (exchange.createdBy) {
        setCashier({ id: exchange.createdBy, username: `User #${exchange.createdBy}` })
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

      if (!normalizedLocation && exchange.locationId) {
        fetchPromises.push(
          fetch(`/api/locations/${exchange.locationId}`)
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
  }, [isOpen, exchange, propBusiness, propLocation, normalizedLocation])

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      alert('Please allow popups to print')
      return
    }

    const invoiceContent = document.getElementById('exchange-invoice-content')
    if (!invoiceContent) return

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
          <title>Exchange Receipt - ${exchange.exchangeNumber}</title>
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

            .border-b-2 { border-bottom-width: 2px; }
            .border-black { border-color: #000; }
            .border-t-2 { border-top-width: 2px; }
            .border-dashed { border-style: dashed; }

            .pb-2 { padding-bottom: 0.5rem; }
            .pt-2 { padding-top: 0.5rem; }
            .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mt-2 { margin-top: 0.5rem; }

            table { width: 100%; border-collapse: collapse; }
            td, th { padding: 0.25rem; }

            ${paperSize === '80mm' ? `
              .text-sm { font-size: ${fontSize}; }
              .text-xs { font-size: ${smallFont}; }
              .text-lg { font-size: 11px; }
              .text-2xl { font-size: 12px; }
            ` : `
              .text-sm { font-size: ${smallFont}; }
              .text-xs { font-size: ${tinyFont}; }
              .text-lg { font-size: 18px; }
              .text-2xl { font-size: 24px; }
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

  if (!exchange || !business) return null

  const businessName = (business.invoiceHeaderName || business.name || 'Your Business Name').toUpperCase()
  const ownerTitle = business.ownerTitle || 'Prop.'
  const proprietorLine = business.ownerName
    ? `${business.ownerName} - ${ownerTitle}`
    : ''

  const addressLinePrimary =
    business.invoiceAddress ||
    business.billingAddress ||
    location?.landmark ||
    ''

  const addressLineSecondary = [
    location?.city,
    location?.state,
    location?.zipCode ? location.zipCode.toString() : null,
  ]
    .filter(Boolean)
    .join(', ')

  // Calculate totals
  const returnTotal = exchange.returnTotal || 0
  const exchangeTotal = exchange.exchangeTotal || 0
  const priceDifference = exchangeTotal - returnTotal
  const customerPaysMore = priceDifference > 0
  const customerGetsCredit = priceDifference < 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="space-y-4">
          {/* Paper Size Selector */}
          <div className="flex items-center justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold">Exchange Receipt</h2>
              <p className="text-sm text-gray-600">{exchange.exchangeNumber}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Paper Size:</label>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as any)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="80mm">80mm Receipt</option>
                <option value="letter">Letter (8.5" × 11")</option>
                <option value="a4">A4</option>
                <option value="legal">Legal (8.5" × 14")</option>
              </select>
            </div>
          </div>

          {/* Print Preview */}
          <div
            id="exchange-invoice-content"
            className={`bg-white p-8 border rounded ${
              paperSize === '80mm' ? 'text-xs max-w-[80mm] mx-auto' : 'text-sm'
            }`}
          >
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-2 mb-2">
              <div className="font-bold text-2xl">{businessName}</div>
              {proprietorLine && <div className="text-sm">{proprietorLine}</div>}
              {addressLinePrimary && <div className="text-xs">{addressLinePrimary}</div>}
              {addressLineSecondary && <div className="text-xs">{addressLineSecondary}</div>}
              {business.phone && <div className="text-xs">Tel: {business.phone}</div>}
            </div>

            {/* Exchange Info */}
            <div className="text-center my-2">
              <div className="font-bold text-lg uppercase">EXCHANGE RECEIPT</div>
              <div className="text-xs mt-1">Exchange #: {exchange.exchangeNumber}</div>
              <div className="text-xs">Original Invoice: {exchange.originalInvoiceNumber}</div>
              <div className="text-xs">Date: {new Date(exchange.createdAt || Date.now()).toLocaleString()}</div>
              {cashier && <div className="text-xs">Cashier: {cashier.username}</div>}
            </div>

            <div className="border-t-2 border-dashed border-black my-2"></div>

            {/* Items Returned Section */}
            <div className="mb-4">
              <div className="font-bold text-sm mb-1 uppercase">Items Returned:</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left">Item</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {exchange.returnItems?.map((item: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="text-left">
                        {item.productName || item.name}
                        {item.serialNumbers && item.serialNumbers.length > 0 && (
                          <div className="text-[10px] text-gray-600">
                            SN: {item.serialNumbers.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-right">₱{parseFloat(item.unitPrice || 0).toFixed(2)}</td>
                      <td className="text-right">₱{(parseFloat(item.unitPrice || 0) * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={3} className="text-right">Return Total:</td>
                    <td className="text-right">₱{returnTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="border-t-2 border-dashed border-black my-2"></div>

            {/* Items Exchanged Section */}
            <div className="mb-4">
              <div className="font-bold text-sm mb-1 uppercase">Items Exchanged For:</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left">Item</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {exchange.exchangeItems?.map((item: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="text-left">
                        {item.productName || item.name}
                        {item.serialNumbers && item.serialNumbers.length > 0 && (
                          <div className="text-[10px] text-gray-600">
                            SN: {item.serialNumbers.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-right">₱{parseFloat(item.unitPrice || 0).toFixed(2)}</td>
                      <td className="text-right">₱{(parseFloat(item.unitPrice || 0) * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={3} className="text-right">Exchange Total:</td>
                    <td className="text-right">₱{exchangeTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="border-t-2 border-black my-2"></div>

            {/* Price Difference */}
            <div className="my-2">
              <div className="flex justify-between font-bold text-sm">
                <span>Price Difference:</span>
                <span className={customerPaysMore ? 'text-red-600' : customerGetsCredit ? 'text-green-600' : ''}>
                  {customerPaysMore ? '+' : ''}₱{Math.abs(priceDifference).toFixed(2)}
                </span>
              </div>
              {customerPaysMore && (
                <div className="text-xs mt-1">
                  Customer Paid: ₱{Math.abs(priceDifference).toFixed(2)} ({exchange.paymentMethod || 'Cash'})
                </div>
              )}
              {customerGetsCredit && (
                <div className="text-xs mt-1 text-green-600">
                  Credit to Customer: ₱{Math.abs(priceDifference).toFixed(2)}
                </div>
              )}
              {priceDifference === 0 && (
                <div className="text-xs mt-1">
                  Even Exchange - No Payment Required
                </div>
              )}
            </div>

            {/* Exchange Reason */}
            {exchange.reason && (
              <div className="my-2 text-xs">
                <div className="font-semibold">Reason for Exchange:</div>
                <div className="mt-1">{exchange.reason}</div>
              </div>
            )}

            <div className="border-t-2 border-dashed border-black my-2"></div>

            {/* Footer */}
            <div className="text-center text-xs mt-4">
              <div className="mb-1">Thank you for your business!</div>
              <div className="text-[10px]">
                This serves as your official exchange receipt.
              </div>
              <div className="text-[10px]">
                Please keep this for your records.
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onClose} className="gap-2">
              <X className="h-4 w-4" />
              Close
            </Button>
            <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
