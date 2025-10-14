"use client"

import { formatCurrency } from "@/lib/currencyUtils"
import { useEffect, useState } from "react"

interface SaleReceiptProps {
  sale: {
    id: number
    invoiceNumber: string
    saleDate: string
    customer?: {
      name: string
      mobile?: string
      email?: string
    }
    items: Array<{
      productName: string
      variationName: string
      sku: string
      quantity: number
      unitPrice: number
      total: number
    }>
    payments: Array<{
      method: string
      amount: number
      referenceNumber?: string
    }>
    subtotal: number
    taxAmount: number
    discountAmount: number
    shippingCost: number
    totalAmount: number
    discountType?: string | null
    seniorCitizenId?: string | null
    seniorCitizenName?: string | null
    pwdId?: string | null
    pwdName?: string | null
    notes?: string | null
  }
  businessInfo: {
    name: string
    address?: string
    phone?: string
    email?: string
    taxId?: string
  }
  locationInfo: {
    name: string
    address?: string
  }
  onClose?: () => void
  autoPrint?: boolean
}

export default function SaleReceipt({
  sale,
  businessInfo,
  locationInfo,
  onClose,
  autoPrint = false
}: SaleReceiptProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (autoPrint) {
      // Delay to ensure content is rendered
      setTimeout(() => {
        window.print()
      }, 500)
    }
  }, [autoPrint])

  if (!mounted) return null

  const totalPayments = sale.payments.reduce((sum, p) => sum + p.amount, 0)
  const change = totalPayments - sale.totalAmount

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Action Buttons (Hidden on Print) */}
        <div className="print:hidden flex justify-end gap-2 p-4 border-b sticky top-0 bg-white z-10">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Print Receipt
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          )}
        </div>

        {/* Receipt Content */}
        <div className="p-8 print:p-4" id="receipt-content">
          {/* Header */}
          <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
            <h1 className="text-3xl font-bold text-gray-900">{businessInfo.name}</h1>
            {businessInfo.address && (
              <p className="text-sm text-gray-600 mt-1">{businessInfo.address}</p>
            )}
            <div className="flex justify-center gap-4 text-sm text-gray-600 mt-1">
              {businessInfo.phone && <span>Tel: {businessInfo.phone}</span>}
              {businessInfo.email && <span>Email: {businessInfo.email}</span>}
            </div>
            {businessInfo.taxId && (
              <p className="text-sm text-gray-600 mt-1">TIN: {businessInfo.taxId}</p>
            )}
          </div>

          {/* Location Info */}
          {locationInfo.name && (
            <div className="text-center mb-4">
              <p className="font-semibold text-gray-800">{locationInfo.name}</p>
              {locationInfo.address && (
                <p className="text-sm text-gray-600">{locationInfo.address}</p>
              )}
            </div>
          )}

          {/* Sale Info */}
          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-gray-800">Invoice #: <span className="font-bold">{sale.invoiceNumber}</span></p>
              <p className="text-gray-600">Date: {new Date(sale.saleDate).toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>
            {sale.customer && (
              <div className="text-right">
                <p className="font-semibold text-gray-800">Customer</p>
                <p className="text-gray-600">{sale.customer.name}</p>
                {sale.customer.mobile && (
                  <p className="text-gray-600 text-xs">{sale.customer.mobile}</p>
                )}
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-800">
                  <th className="text-left py-2 text-sm font-bold">Item</th>
                  <th className="text-center py-2 text-sm font-bold">SKU</th>
                  <th className="text-center py-2 text-sm font-bold">Qty</th>
                  <th className="text-right py-2 text-sm font-bold">Price</th>
                  <th className="text-right py-2 text-sm font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-2 text-sm">
                      <div className="font-medium text-gray-900">{item.productName}</div>
                      {item.variationName && item.variationName !== 'Default' && (
                        <div className="text-xs text-gray-500">({item.variationName})</div>
                      )}
                    </td>
                    <td className="text-center py-2 text-xs text-gray-600">{item.sku}</td>
                    <td className="text-center py-2 text-sm">{item.quantity}</td>
                    <td className="text-right py-2 text-sm">{formatCurrency(item.unitPrice)}</td>
                    <td className="text-right py-2 text-sm font-semibold">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mb-6 border-t-2 border-gray-800 pt-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(sale.subtotal)}</span>
                </div>

                {sale.taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="font-medium">{formatCurrency(sale.taxAmount)}</span>
                  </div>
                )}

                {sale.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>
                      Discount
                      {sale.discountType && ` (${sale.discountType === 'senior' ? 'Senior Citizen' : sale.discountType === 'pwd' ? 'PWD' : sale.discountType})`}
                      :
                    </span>
                    <span className="font-medium">-{formatCurrency(sale.discountAmount)}</span>
                  </div>
                )}

                {sale.shippingCost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping:</span>
                    <span className="font-medium">{formatCurrency(sale.shippingCost)}</span>
                  </div>
                )}

                <div className="flex justify-between text-lg font-bold border-t-2 border-gray-800 pt-2">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(sale.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="mb-6 border-t border-gray-300 pt-4">
            <h3 className="font-bold text-gray-800 mb-2">Payment Details</h3>
            <div className="space-y-2">
              {sale.payments.map((payment, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {payment.method.charAt(0).toUpperCase() + payment.method.slice(1).replace(/_/g, ' ')}
                    {payment.referenceNumber && ` (${payment.referenceNumber})`}:
                  </span>
                  <span className="font-medium">{formatCurrency(payment.amount)}</span>
                </div>
              ))}
              {change > 0.01 && (
                <div className="flex justify-between text-sm font-semibold border-t border-gray-300 pt-2">
                  <span className="text-gray-800">Change:</span>
                  <span className="text-green-600">{formatCurrency(change)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Discount Beneficiary Info (Philippine BIR Compliance) */}
          {(sale.seniorCitizenId || sale.pwdId) && (
            <div className="mb-6 border-t border-gray-300 pt-4">
              <h3 className="font-bold text-gray-800 mb-2">Discount Beneficiary Information</h3>
              {sale.seniorCitizenId && (
                <div className="text-sm space-y-1">
                  <p><span className="font-semibold">Senior Citizen Name:</span> {sale.seniorCitizenName}</p>
                  <p><span className="font-semibold">Senior Citizen ID:</span> {sale.seniorCitizenId}</p>
                </div>
              )}
              {sale.pwdId && (
                <div className="text-sm space-y-1">
                  <p><span className="font-semibold">PWD Name:</span> {sale.pwdName}</p>
                  <p><span className="font-semibold">PWD ID:</span> {sale.pwdId}</p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {sale.notes && (
            <div className="mb-6 border-t border-gray-300 pt-4">
              <h3 className="font-bold text-gray-800 mb-2">Notes</h3>
              <p className="text-sm text-gray-600">{sale.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center mt-8 pt-4 border-t-2 border-gray-800">
            <p className="text-sm font-semibold text-gray-800">Thank you for your business!</p>
            <p className="text-xs text-gray-600 mt-2">
              This serves as your official receipt
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {new Date().toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </p>
          </div>
        </div>

        {/* Print Styles */}
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #receipt-content,
            #receipt-content * {
              visibility: visible;
            }
            #receipt-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .print\\:hidden {
              display: none !important;
            }
            @page {
              margin: 0.5cm;
              size: auto;
            }
          }
        `}</style>
      </div>
    </div>
  )
}
