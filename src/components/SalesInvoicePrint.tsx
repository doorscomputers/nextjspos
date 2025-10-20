'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'

interface SalesInvoicePrintProps {
  sale: any
  isOpen: boolean
  onClose: () => void
}

export default function SalesInvoicePrint({ sale, isOpen, onClose }: SalesInvoicePrintProps) {
  const [business, setBusiness] = useState<any>(null)
  const [location, setLocation] = useState<any>(null)

  useEffect(() => {
    if (isOpen && sale) {
      // Fetch business and location details
      Promise.all([
        fetch('/api/business').then(res => res.json()),
        fetch(`/api/locations/${sale.locationId}`).then(res => res.json())
      ]).then(([businessData, locationData]) => {
        setBusiness(businessData)
        setLocation(locationData)
      })
    }
  }, [isOpen, sale])

  const handlePrint = () => {
    window.print()
  }

  if (!sale || !business || !location) return null

  const calculateChange = () => {
    const totalPaid = sale.payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0) || 0
    const totalAmount = parseFloat(sale.totalAmount || 0)
    return Math.max(0, totalPaid - totalAmount)
  }

  const businessName = (business.invoiceHeaderName || business.name || 'PcInet Computer Trading').toUpperCase()
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
      ? `CP Nos: ${uniquePhones.join(' • ')}`
      : 'CP Nos: (078) 326-6008 • 0927 364 0644 • 0922 891 0427'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:static print:top-0 print:left-0 print:translate-x-0 print:translate-y-0 print:transform-none print:w-full print:max-w-full print:max-h-none print:h-auto print:overflow-visible print:p-0 print:m-0 print:shadow-none print:ring-0 print:bg-transparent">
        <div className="print:p-8">
          {/* Action Buttons - Hidden when printing */}
          <div className="flex justify-end gap-2 mb-4 print:hidden">
            <Button onClick={handlePrint} variant="default">
              Print Invoice
            </Button>
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>

          {/* Invoice Content */}
          <div className="bg-white p-8 print:p-0" id="invoice-content">
            {/* Header */}
            <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
              <h1 className="text-4xl font-extrabold tracking-wide text-gray-900 uppercase">
                {businessName}
              </h1>
              <p className="text-sm font-semibold uppercase text-gray-800 mt-1">{proprietorLine}</p>
              <p className="text-sm text-gray-700">VAT Reg. TIN: {vatTin}</p>
              <p className="text-sm text-gray-700 mt-1">{addressLinePrimary}</p>
              <p className="text-sm text-gray-700">{addressLineSecondary}</p>
              <p className="text-xs text-gray-600 mt-2">{emailLine}</p>
              <p className="text-xs text-gray-600">{phoneLine}</p>
              <p className="text-xs text-gray-500 mt-2">
                {location.name} Branch
              </p>
            </div>

            {/* Invoice Details */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">SALES INVOICE</h2>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Invoice #:</span> {sale.invoiceNumber}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Date:</span>{' '}
                  {new Date(sale.saleDate).toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Time:</span>{' '}
                  {new Date(sale.createdAt).toLocaleTimeString('en-PH')}
                </p>
              </div>

              <div className="text-right">
                <h3 className="text-sm font-bold text-gray-900 mb-2">SOLD TO:</h3>
                <p className="text-sm text-gray-700 font-semibold">
                  {sale.customer?.name || 'Walk-in Customer'}
                </p>
                {sale.customer?.mobile && (
                  <p className="text-sm text-gray-600">{sale.customer.mobile}</p>
                )}
                {sale.customer?.email && (
                  <p className="text-sm text-gray-600">{sale.customer.email}</p>
                )}
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-6 border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-800">
                  <th className="text-left py-2 px-2 text-sm font-bold">ITEM</th>
                  <th className="text-center py-2 px-2 text-sm font-bold">QTY</th>
                  <th className="text-right py-2 px-2 text-sm font-bold">PRICE</th>
                  <th className="text-right py-2 px-2 text-sm font-bold">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {sale.items?.map((item: any, index: number) => (
                  <tr key={index} className="border-b border-gray-300">
                    <td className="py-2 px-2 text-sm text-gray-700">
                      {item.product?.name || `Product #${item.productId}`}
                      {item.serialNumbers && (
                        <div className="text-xs text-gray-500 mt-1">
                          Serial: {item.serialNumbers.map((sn: any) => sn.serialNumber || sn.imei).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-sm text-center text-gray-700">
                      {parseFloat(item.quantity).toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-sm text-right text-gray-700">
                      ₱{parseFloat(item.unitPrice).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                    <td className="py-2 px-2 text-sm text-right text-gray-700">
                      ₱{(parseFloat(item.quantity) * parseFloat(item.unitPrice)).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-6">
              <div className="w-64">
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-gray-700">Subtotal:</span>
                  <span className="text-gray-900 font-semibold">
                    ₱{parseFloat(sale.subtotal).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>

                {parseFloat(sale.discountAmount) > 0 && (
                  <div className="flex justify-between py-1 text-sm text-red-600">
                    <span>Discount {sale.discountType && `(${sale.discountType})`}:</span>
                    <span className="font-semibold">
                      -₱{parseFloat(sale.discountAmount).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>
                )}

                {parseFloat(sale.taxAmount) > 0 && (
                  <div className="flex justify-between py-1 text-sm">
                    <span className="text-gray-700">Tax:</span>
                    <span className="text-gray-900 font-semibold">
                      ₱{parseFloat(sale.taxAmount).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>
                )}

                <div className="flex justify-between py-2 text-lg border-t-2 border-gray-800 mt-2">
                  <span className="font-bold text-gray-900">TOTAL:</span>
                  <span className="font-bold text-gray-900">
                    ₱{parseFloat(sale.totalAmount).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>

                {/* Payment Information */}
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <p className="text-sm font-semibold text-gray-700 mb-2">PAYMENT:</p>
                  {sale.payments?.map((payment: any, index: number) => (
                    <div key={index} className="flex justify-between py-1 text-sm">
                      <span className="text-gray-600 capitalize">{payment.paymentMethod}:</span>
                      <span className="text-gray-900">
                        ₱{parseFloat(payment.amount).toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </div>
                  ))}

                  {calculateChange() > 0 && (
                    <div className="flex justify-between py-1 text-sm font-semibold">
                      <span className="text-green-600">Change:</span>
                      <span className="text-green-600">
                        ₱{calculateChange().toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Discount Details (if applicable) */}
            {(sale.seniorCitizenId || sale.pwdId) && (
              <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm font-semibold text-gray-900 mb-1">BIR DISCOUNT DETAILS:</p>
                {sale.seniorCitizenId && (
                  <div className="text-sm text-gray-700">
                    <p>Senior Citizen ID: {sale.seniorCitizenId}</p>
                    <p>Name: {sale.seniorCitizenName}</p>
                  </div>
                )}
                {sale.pwdId && (
                  <div className="text-sm text-gray-700">
                    <p>PWD ID: {sale.pwdId}</p>
                    <p>Name: {sale.pwdName}</p>
                  </div>
                )}
              </div>
            )}

            {/* Warranty Remarks */}
            {business.invoiceWarrantyRemarks && (
              <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm font-semibold text-gray-900 mb-1">WARRANTY & TERMS:</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {business.invoiceWarrantyRemarks}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="text-center pt-6 border-t-2 border-gray-800 mt-6">
              <p className="text-sm text-gray-600 mb-2">
                Thank you for your business!
              </p>
              <p className="text-xs text-gray-500">
                This serves as your official receipt. Please keep for your records.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Generated by: {business.name} POS System
              </p>
            </div>
          </div>
        </div>

        {/* Print Styles */}
        <style jsx global>{`
          @page {
            margin: 12mm 10mm 15mm;
          }
          @media print {
            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
            }
            body * {
              visibility: hidden;
            }
            #invoice-content,
            #invoice-content * {
              visibility: visible;
            }
            #invoice-content {
              position: static;
              width: 100%;
              margin: 0;
            }
            .print\\:hidden {
              display: none !important;
            }
            .print\\:p-0 {
              padding: 0 !important;
            }
            .print\\:max-w-full {
              max-width: 100% !important;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  )
}
