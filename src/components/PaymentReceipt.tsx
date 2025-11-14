'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useEffect, useState, useRef } from 'react'
import { Printer, X } from 'lucide-react'
import { formatCurrency } from '@/lib/currencyUtils'

interface PaymentReceiptProps {
  paymentData: {
    customerName: string
    invoiceNumber: string
    paymentAmount: number
    paymentMethod: string
    referenceNumber?: string
    newBalance: number
    paymentDate: string
    cashierName?: string
    locationName?: string
  }
  isOpen: boolean
  onClose: () => void
}

export default function PaymentReceipt({ paymentData, isOpen, onClose }: PaymentReceiptProps) {
  const [business, setBusiness] = useState<any>(null)
  const [location, setLocation] = useState<any>(null)
  const printTriggeredRef = useRef(false)

  useEffect(() => {
    if (isOpen && paymentData) {
      // Fetch business data
      fetch('/api/business')
        .then(res => res.json())
        .then(data => setBusiness(data))
        .catch(err => console.error('Failed to fetch business:', err))

      // Reset print trigger
      printTriggeredRef.current = false
    }
  }, [isOpen, paymentData])

  useEffect(() => {
    // Auto-print after data loads (only once)
    if (isOpen && business && !printTriggeredRef.current) {
      printTriggeredRef.current = true
      // Small delay to ensure DOM is rendered
      setTimeout(() => {
        handlePrint()
      }, 500)
    }
  }, [isOpen, business])

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      alert('Please allow popups to print')
      return
    }

    const receiptContent = document.getElementById('payment-receipt-content')
    if (!receiptContent) return

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Payment Receipt</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Courier New', monospace;
              font-size: 11px;
              line-height: 1.4;
              color: #000;
              background: #fff;
              width: 80mm;
              padding: 5mm;
            }

            .receipt {
              width: 100%;
            }

            .header {
              text-align: center;
              margin-bottom: 10px;
              border-bottom: 2px dashed #000;
              padding-bottom: 10px;
            }

            .business-name {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 5px;
            }

            .business-info {
              font-size: 10px;
              margin-bottom: 3px;
            }

            .receipt-title {
              font-size: 14px;
              font-weight: bold;
              text-align: center;
              margin: 15px 0 10px 0;
              text-decoration: underline;
            }

            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
              font-size: 11px;
            }

            .info-label {
              font-weight: bold;
            }

            .divider {
              border-top: 1px dashed #000;
              margin: 10px 0;
            }

            .double-divider {
              border-top: 2px solid #000;
              margin: 10px 0;
            }

            .payment-details {
              margin: 15px 0;
            }

            .total-row {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              font-weight: bold;
              margin: 10px 0;
            }

            .balance-row {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              font-weight: bold;
              margin: 5px 0;
            }

            .footer {
              text-align: center;
              margin-top: 15px;
              padding-top: 10px;
              border-top: 2px dashed #000;
              font-size: 10px;
            }

            .thank-you {
              font-weight: bold;
              margin: 10px 0;
            }

            @media print {
              body {
                width: 80mm;
              }
            }
          </style>
        </head>
        <body onload="window.print(); setTimeout(() => window.close(), 500);">
          ${receiptContent.innerHTML}
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
  }

  if (!paymentData) return null

  const paymentDate = new Date(paymentData.paymentDate)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Payment Receipt</h2>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint} variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button size="sm" onClick={onClose} variant="outline">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Hidden receipt content for printing */}
        <div id="payment-receipt-content" className="hidden">
          <div className="receipt">
            <div className="header">
              <div className="business-name">{business?.name || 'Business Name'}</div>
              {business?.address && <div className="business-info">{business.address}</div>}
              {business?.phone && <div className="business-info">Tel: {business.phone}</div>}
              {business?.email && <div className="business-info">{business.email}</div>}
              {paymentData.locationName && <div className="business-info">{paymentData.locationName}</div>}
            </div>

            <div className="receipt-title">PAYMENT RECEIPT</div>

            <div className="info-row">
              <span className="info-label">Date:</span>
              <span>{paymentDate.toLocaleDateString()} {paymentDate.toLocaleTimeString()}</span>
            </div>

            <div className="info-row">
              <span className="info-label">Invoice #:</span>
              <span>{paymentData.invoiceNumber}</span>
            </div>

            <div className="info-row">
              <span className="info-label">Customer:</span>
              <span>{paymentData.customerName}</span>
            </div>

            {paymentData.cashierName && (
              <div className="info-row">
                <span className="info-label">Cashier:</span>
                <span>{paymentData.cashierName}</span>
              </div>
            )}

            <div className="double-divider"></div>

            <div className="payment-details">
              <div className="info-row">
                <span className="info-label">Payment Method:</span>
                <span>{paymentData.paymentMethod.toUpperCase()}</span>
              </div>

              {paymentData.referenceNumber && (
                <div className="info-row">
                  <span className="info-label">Reference #:</span>
                  <span>{paymentData.referenceNumber}</span>
                </div>
              )}

              <div className="divider"></div>

              <div className="total-row">
                <span>AMOUNT PAID:</span>
                <span>{formatCurrency(paymentData.paymentAmount)}</span>
              </div>

              <div className="balance-row">
                <span>REMAINING BALANCE:</span>
                <span>{formatCurrency(paymentData.newBalance)}</span>
              </div>
            </div>

            <div className="footer">
              <div className="thank-you">THANK YOU FOR YOUR PAYMENT!</div>
              <div>This is your official payment receipt</div>
              <div>Please keep for your records</div>
            </div>
          </div>
        </div>

        {/* Preview in modal */}
        <div className="border rounded-lg p-4 bg-white dark:bg-gray-900 max-h-[500px] overflow-y-auto">
          <div className="text-center mb-4">
            <div className="text-lg font-bold">{business?.name || 'Business Name'}</div>
            {business?.address && <div className="text-sm">{business.address}</div>}
            {business?.phone && <div className="text-sm">Tel: {business.phone}</div>}
            {paymentData.locationName && <div className="text-sm font-semibold">{paymentData.locationName}</div>}
          </div>

          <div className="text-center text-lg font-bold underline my-4">PAYMENT RECEIPT</div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold">Date:</span>
              <span>{paymentDate.toLocaleDateString()} {paymentDate.toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Invoice #:</span>
              <span>{paymentData.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Customer:</span>
              <span>{paymentData.customerName}</span>
            </div>
            {paymentData.cashierName && (
              <div className="flex justify-between">
                <span className="font-semibold">Cashier:</span>
                <span>{paymentData.cashierName}</span>
              </div>
            )}
          </div>

          <div className="border-t-2 border-gray-400 my-4"></div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold">Payment Method:</span>
              <span>{paymentData.paymentMethod.toUpperCase()}</span>
            </div>
            {paymentData.referenceNumber && (
              <div className="flex justify-between">
                <span className="font-semibold">Reference #:</span>
                <span>{paymentData.referenceNumber}</span>
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-gray-400 my-4"></div>

          <div className="space-y-2">
            <div className="flex justify-between text-base font-bold">
              <span>AMOUNT PAID:</span>
              <span>{formatCurrency(paymentData.paymentAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>REMAINING BALANCE:</span>
              <span className={paymentData.newBalance > 0 ? 'text-red-600' : 'text-green-600'}>
                {formatCurrency(paymentData.newBalance)}
              </span>
            </div>
          </div>

          <div className="border-t-2 border-dashed border-gray-400 my-4"></div>

          <div className="text-center text-sm">
            <div className="font-bold mb-2">THANK YOU FOR YOUR PAYMENT!</div>
            <div>This is your official payment receipt</div>
            <div>Please keep for your records</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
