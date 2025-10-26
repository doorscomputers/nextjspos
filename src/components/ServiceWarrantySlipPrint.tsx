'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { Printer, X, FileText } from 'lucide-react'

interface ServiceWarrantySlipPrintProps {
  jobOrder: any
  isOpen: boolean
  onClose: () => void
  copyType?: 'customer' | 'office' | 'technician'
}

export default function ServiceWarrantySlipPrint({
  jobOrder,
  isOpen,
  onClose,
  copyType = 'customer',
}: ServiceWarrantySlipPrintProps) {
  const [paperSize, setPaperSize] = useState<'80mm' | 'a4' | 'letter' | 'legal'>('letter')

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      alert('Please allow popups to print')
      return
    }

    const slipContent = document.getElementById('warranty-slip-content')
    if (!slipContent) return

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

    const clonedContent = slipContent.cloneNode(true) as HTMLElement

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Service Warranty Slip - ${jobOrder.jobOrderNumber}</title>
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
            .text-orange-600 { color: #ea580c; }

            .bg-blue-50 { background-color: #eff6ff; }
            .bg-gray-50 { background-color: #f9fafb; }
            .bg-yellow-50 { background-color: #fefce8; }
            .border-blue-300 { border-color: #93c5fd; }
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
            .border-2 { border-width: 2px; }
            .border-gray-400 { border-color: #9ca3af; }
            .border-gray-300 { border-color: #d1d5db; }
            .rounded { border-radius: 0.25rem; }

            .pb-2 { padding-bottom: 0.5rem; }
            .pt-2 { padding-top: 0.5rem; }
            .pt-3 { padding-top: 0.75rem; }
            .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
            .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
            .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
            .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
            .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
            .px-4 { padding-left: 1rem; padding-right: 1rem; }
            .p-2 { padding: 0.5rem; }
            .p-3 { padding: 0.75rem; }
            .p-4 { padding: 1rem; }

            .mb-1 { margin-bottom: 0.25rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-3 { margin-bottom: 0.75rem; }
            .mb-4 { margin-bottom: 1rem; }
            .mt-1 { margin-top: 0.25rem; }
            .mt-2 { margin-top: 0.5rem; }
            .mt-3 { margin-top: 0.75rem; }
            .mt-4 { margin-top: 1rem; }
            .my-2 { margin-top: 0.5rem; margin-bottom: 0.5rem; }
            .my-3 { margin-top: 0.75rem; margin-bottom: 0.75rem; }

            .w-full { width: 100%; }
            .border-collapse { border-collapse: collapse; }

            table { width: 100%; border-collapse: collapse; }
            td, th { padding: 0.25rem; }

            .grid { display: grid; }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .gap-2 { gap: 0.5rem; }
            .gap-4 { gap: 1rem; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .items-start { align-items: flex-start; }
            .space-y-1 > * + * { margin-top: 0.25rem; }
            .space-y-2 > * + * { margin-top: 0.5rem; }

            ${paperSize === '80mm' ? `
              .text-sm { font-size: ${fontSize}; }
              .text-xs { font-size: ${smallFont}; }
              .text-\\[10px\\] { font-size: ${tinyFont}; }
              .text-lg { font-size: 11px; }
              .text-xl { font-size: 11px; }
              .text-2xl { font-size: 12px; }
              .text-base { font-size: ${fontSize}; }
            ` : `
              .text-sm { font-size: ${smallFont}; }
              .text-xs { font-size: ${tinyFont}; }
              .text-\\[10px\\] { font-size: 10px; }
              .text-lg { font-size: 18px; }
              .text-xl { font-size: 20px; }
              .text-2xl { font-size: 24px; }
              .text-base { font-size: 16px; }
            `}

            @media print {
              body {
                width: ${contentWidth};
              }
            }

            .signature-line {
              border-top: 1px solid #000;
              margin-top: 2rem;
              padding-top: 0.5rem;
              text-align: center;
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

  if (!jobOrder) return null

  const business = jobOrder.business
  const location = jobOrder.location

  const businessName = (business?.name || 'Technical Service Center').toUpperCase()
  const addressLinePrimary = location?.landmark || business?.address || ''
  const addressLineSecondary = [location?.city, location?.state, location?.zipCode]
    .filter(Boolean)
    .join(', ')
  const contactPhone = location?.mobile || business?.phone || ''
  const contactEmail = location?.email || business?.email || ''

  // Copy type label
  const copyLabel =
    copyType === 'customer'
      ? 'CUSTOMER COPY'
      : copyType === 'office'
      ? 'OFFICE COPY'
      : 'TECHNICIAN COPY'

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
                Print Warranty Slip
              </Button>
              <Button onClick={onClose} variant="outline" size="lg" className="gap-2">
                <X className="h-5 w-5" />
                Close
              </Button>
            </div>
          </div>

          {/* Warranty Slip Content */}
          <div
            className={`bg-white ${paperSize === '80mm' ? 'max-w-[80mm] mx-auto' : 'p-8'}`}
            id="warranty-slip-content"
          >
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-2 mb-3">
              <h1
                className={`font-bold tracking-wide text-gray-900 uppercase ${
                  paperSize === '80mm' ? 'text-sm' : 'text-2xl'
                }`}
              >
                {businessName}
              </h1>
              <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                Technical Service & Repair Center
              </p>
              <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                {addressLinePrimary}
              </p>
              {addressLineSecondary && (
                <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  {addressLineSecondary}
                </p>
              )}
              {contactPhone && (
                <p className={`text-gray-600 ${paperSize === '80mm' ? 'text-[10px]' : 'text-xs'}`}>
                  Phone: {contactPhone}
                </p>
              )}
              {contactEmail && (
                <p className={`text-gray-600 ${paperSize === '80mm' ? 'text-[10px]' : 'text-xs'}`}>
                  Email: {contactEmail}
                </p>
              )}
            </div>

            {/* Document Title */}
            <div className="text-center mb-3">
              <h2
                className={`font-bold text-gray-900 uppercase ${
                  paperSize === '80mm' ? 'text-sm' : 'text-xl'
                }`}
              >
                SERVICE WARRANTY SLIP
              </h2>
              <p
                className={`text-blue-700 font-semibold ${
                  paperSize === '80mm' ? 'text-xs' : 'text-sm'
                }`}
              >
                {copyLabel}
              </p>
            </div>

            {/* Job Order Info */}
            <div
              className={`mb-3 p-2 bg-gray-50 border border-gray-300 rounded ${
                paperSize === '80mm' ? '' : 'grid grid-cols-2 gap-2'
              }`}
            >
              <div>
                <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  <span className="font-semibold">Job Order #:</span> {jobOrder.jobOrderNumber}
                </p>
                <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  <span className="font-semibold">Date:</span>{' '}
                  {new Date(jobOrder.orderDate).toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div>
                <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  <span className="font-semibold">Status:</span>{' '}
                  <span className="capitalize">{jobOrder.status}</span>
                </p>
                <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  <span className="font-semibold">Service Type:</span> {jobOrder.serviceType}
                </p>
              </div>
            </div>

            {/* Customer Information */}
            <div className="mb-3 border border-gray-300 p-2 rounded">
              <h3
                className={`font-bold text-gray-900 mb-1 border-b border-gray-300 pb-1 ${
                  paperSize === '80mm' ? 'text-xs' : 'text-sm'
                }`}
              >
                CUSTOMER INFORMATION
              </h3>
              <div className="space-y-1">
                <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  <span className="font-semibold">Name:</span> {jobOrder.customerName}
                </p>
                <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  <span className="font-semibold">Phone:</span> {jobOrder.customerPhone}
                </p>
                {jobOrder.customerEmail && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Email:</span> {jobOrder.customerEmail}
                  </p>
                )}
                {jobOrder.customerAddress && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Address:</span> {jobOrder.customerAddress}
                  </p>
                )}
              </div>
            </div>

            {/* Product/Device Information */}
            <div className="mb-3 border border-gray-300 p-2 rounded">
              <h3
                className={`font-bold text-gray-900 mb-1 border-b border-gray-300 pb-1 ${
                  paperSize === '80mm' ? 'text-xs' : 'text-sm'
                }`}
              >
                PRODUCT/DEVICE INFORMATION
              </h3>
              <div className="space-y-1">
                <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  <span className="font-semibold">Product:</span> {jobOrder.productName}
                </p>
                {jobOrder.serialNumber && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Serial Number:</span> {jobOrder.serialNumber}
                  </p>
                )}
                {jobOrder.productPurchaseDate && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Purchase Date:</span>{' '}
                    {new Date(jobOrder.productPurchaseDate).toLocaleDateString('en-PH')}
                  </p>
                )}
                {jobOrder.warrantyExpiryDate && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Product Warranty Expiry:</span>{' '}
                    {new Date(jobOrder.warrantyExpiryDate).toLocaleDateString('en-PH')}
                  </p>
                )}
              </div>
            </div>

            {/* Problem & Diagnosis */}
            <div className="mb-3 border border-gray-300 p-2 rounded">
              <h3
                className={`font-bold text-gray-900 mb-1 border-b border-gray-300 pb-1 ${
                  paperSize === '80mm' ? 'text-xs' : 'text-sm'
                }`}
              >
                PROBLEM & DIAGNOSIS
              </h3>
              <div className="space-y-1">
                <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  <span className="font-semibold">Problem Reported:</span>
                  <br />
                  {jobOrder.problemReported}
                </p>
                {jobOrder.diagnosisFindings && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Diagnosis:</span>
                    <br />
                    {jobOrder.diagnosisFindings}
                  </p>
                )}
                {jobOrder.recommendedAction && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Recommended Action:</span>
                    <br />
                    {jobOrder.recommendedAction}
                  </p>
                )}
              </div>
            </div>

            {/* Service Details */}
            <div className="mb-3 border border-gray-300 p-2 rounded">
              <h3
                className={`font-bold text-gray-900 mb-1 border-b border-gray-300 pb-1 ${
                  paperSize === '80mm' ? 'text-xs' : 'text-sm'
                }`}
              >
                SERVICE DETAILS
              </h3>
              <div className="space-y-1">
                {jobOrder.technician && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Technician:</span>{' '}
                    {jobOrder.technician.firstName} {jobOrder.technician.lastName}
                  </p>
                )}
                <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  <span className="font-semibold">Date Received:</span>{' '}
                  {new Date(jobOrder.dateReceived).toLocaleDateString('en-PH')}
                </p>
                {jobOrder.estimatedCompletion && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Estimated Completion:</span>{' '}
                    {new Date(jobOrder.estimatedCompletion).toLocaleDateString('en-PH')}
                  </p>
                )}
                {jobOrder.actualCompletionDate && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Actual Completion:</span>{' '}
                    {new Date(jobOrder.actualCompletionDate).toLocaleDateString('en-PH')}
                  </p>
                )}
              </div>
            </div>

            {/* Parts Used */}
            {jobOrder.parts && jobOrder.parts.length > 0 && (
              <div className="mb-3">
                <h3
                  className={`font-bold text-gray-900 mb-1 ${
                    paperSize === '80mm' ? 'text-xs' : 'text-sm'
                  }`}
                >
                  PARTS USED
                </h3>
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th
                        className={`text-left border border-gray-300 p-1 font-bold ${
                          paperSize === '80mm' ? 'text-xs' : 'text-sm'
                        }`}
                      >
                        Part Name
                      </th>
                      <th
                        className={`text-center border border-gray-300 p-1 font-bold ${
                          paperSize === '80mm' ? 'text-xs' : 'text-sm'
                        }`}
                      >
                        Qty
                      </th>
                      <th
                        className={`text-right border border-gray-300 p-1 font-bold ${
                          paperSize === '80mm' ? 'text-xs' : 'text-sm'
                        }`}
                      >
                        Price
                      </th>
                      <th
                        className={`text-right border border-gray-300 p-1 font-bold ${
                          paperSize === '80mm' ? 'text-xs' : 'text-sm'
                        }`}
                      >
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobOrder.parts.map((part: any, index: number) => (
                      <tr key={index}>
                        <td
                          className={`border border-gray-300 p-1 text-gray-700 ${
                            paperSize === '80mm' ? 'text-xs' : 'text-sm'
                          }`}
                        >
                          {part.partName}
                          {part.description && (
                            <span className="text-gray-500 block text-xs">
                              {part.description}
                            </span>
                          )}
                        </td>
                        <td
                          className={`border border-gray-300 p-1 text-center text-gray-700 ${
                            paperSize === '80mm' ? 'text-xs' : 'text-sm'
                          }`}
                        >
                          {parseFloat(part.quantity).toFixed(2)}
                        </td>
                        <td
                          className={`border border-gray-300 p-1 text-right text-gray-700 ${
                            paperSize === '80mm' ? 'text-xs' : 'text-sm'
                          }`}
                        >
                          ₱
                          {parseFloat(part.unitPrice).toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td
                          className={`border border-gray-300 p-1 text-right text-gray-700 ${
                            paperSize === '80mm' ? 'text-xs' : 'text-sm'
                          }`}
                        >
                          ₱
                          {parseFloat(part.subtotal).toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Cost Breakdown */}
            <div className="mb-3 border-t-2 border-black pt-2">
              <h3
                className={`font-bold text-gray-900 mb-1 ${
                  paperSize === '80mm' ? 'text-xs' : 'text-sm'
                }`}
              >
                COST BREAKDOWN
              </h3>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    Labor Cost:
                  </span>
                  <span className={`text-gray-900 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    ₱
                    {parseFloat(jobOrder.laborCost).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    Parts Cost:
                  </span>
                  <span className={`text-gray-900 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    ₱
                    {parseFloat(jobOrder.partsCost).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {parseFloat(jobOrder.additionalCharges) > 0 && (
                  <div className="flex justify-between">
                    <span
                      className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}
                    >
                      Additional Charges:
                    </span>
                    <span
                      className={`text-gray-900 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}
                    >
                      ₱
                      {parseFloat(jobOrder.additionalCharges).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-dashed border-gray-400 pt-1">
                  <span
                    className={`text-gray-700 font-semibold ${
                      paperSize === '80mm' ? 'text-xs' : 'text-sm'
                    }`}
                  >
                    Subtotal:
                  </span>
                  <span
                    className={`text-gray-900 font-semibold ${
                      paperSize === '80mm' ? 'text-xs' : 'text-sm'
                    }`}
                  >
                    ₱
                    {parseFloat(jobOrder.subtotal).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {parseFloat(jobOrder.discountAmount) > 0 && (
                  <div className="flex justify-between">
                    <span
                      className={`text-red-600 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}
                    >
                      Discount:
                    </span>
                    <span
                      className={`text-red-600 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}
                    >
                      -₱
                      {parseFloat(jobOrder.discountAmount).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                {parseFloat(jobOrder.taxAmount) > 0 && (
                  <div className="flex justify-between">
                    <span
                      className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}
                    >
                      Tax (12%):
                    </span>
                    <span
                      className={`text-gray-900 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}
                    >
                      ₱
                      {parseFloat(jobOrder.taxAmount).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-y-2 border-black py-2 mt-2">
                  <span
                    className={`font-bold text-gray-900 ${
                      paperSize === '80mm' ? 'text-sm' : 'text-lg'
                    }`}
                  >
                    GRAND TOTAL:
                  </span>
                  <span
                    className={`font-bold text-gray-900 ${
                      paperSize === '80mm' ? 'text-sm' : 'text-lg'
                    }`}
                  >
                    ₱
                    {parseFloat(jobOrder.grandTotal).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="mb-3 border border-gray-300 p-2 rounded">
              <h3
                className={`font-bold text-gray-900 mb-1 border-b border-gray-300 pb-1 ${
                  paperSize === '80mm' ? 'text-xs' : 'text-sm'
                }`}
              >
                PAYMENT INFORMATION
              </h3>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    Amount Paid:
                  </span>
                  <span
                    className={`text-green-600 font-semibold ${
                      paperSize === '80mm' ? 'text-xs' : 'text-sm'
                    }`}
                  >
                    ₱
                    {parseFloat(jobOrder.amountPaid).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    Balance Due:
                  </span>
                  <span
                    className={`${
                      parseFloat(jobOrder.balanceDue) > 0 ? 'text-red-600' : 'text-gray-900'
                    } font-semibold ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}
                  >
                    ₱
                    {parseFloat(jobOrder.balanceDue).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {jobOrder.paymentMethod && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Payment Method:</span>{' '}
                    <span className="capitalize">{jobOrder.paymentMethod}</span>
                  </p>
                )}
                {jobOrder.paymentDate && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Payment Date:</span>{' '}
                    {new Date(jobOrder.paymentDate).toLocaleDateString('en-PH')}
                  </p>
                )}
                {jobOrder.receivedBy && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Received By:</span> {jobOrder.receivedBy}
                  </p>
                )}
              </div>
            </div>

            {/* Service Warranty Terms */}
            <div className="mb-3 border-2 border-blue-300 p-3 rounded bg-blue-50">
              <h3
                className={`font-bold text-blue-900 mb-2 text-center ${
                  paperSize === '80mm' ? 'text-xs' : 'text-sm'
                }`}
              >
                SERVICE WARRANTY TERMS
              </h3>
              <div className="space-y-1">
                <p
                  className={`text-gray-700 text-center font-semibold ${
                    paperSize === '80mm' ? 'text-xs' : 'text-sm'
                  }`}
                >
                  {jobOrder.serviceWarrantyPeriod} Days Service Warranty
                </p>
                {jobOrder.serviceWarrantyConditions && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold">Conditions:</span>
                    <br />
                    {jobOrder.serviceWarrantyConditions}
                  </p>
                )}
                {jobOrder.warrantyCovers && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold text-green-600">Warranty Covers:</span>
                    <br />
                    {jobOrder.warrantyCovers}
                  </p>
                )}
                {jobOrder.warrantyNotCovers && (
                  <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                    <span className="font-semibold text-red-600">NOT Covered:</span>
                    <br />
                    {jobOrder.warrantyNotCovers}
                  </p>
                )}
              </div>
            </div>

            {/* Quality Check */}
            {jobOrder.qualityChecker && (
              <div className="mb-3">
                <p className={`text-gray-700 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}>
                  <span className="font-semibold">Quality Checked By:</span>{' '}
                  {jobOrder.qualityChecker.firstName} {jobOrder.qualityChecker.lastName}
                  {jobOrder.qualityCheckDate &&
                    ` on ${new Date(jobOrder.qualityCheckDate).toLocaleDateString('en-PH')}`}
                </p>
              </div>
            )}

            {/* Signature Lines */}
            <div
              className={`mt-4 pt-3 border-t-2 border-dashed border-gray-400 ${
                paperSize === '80mm' ? '' : 'grid grid-cols-2 gap-4'
              }`}
            >
              <div className={`${paperSize === '80mm' ? 'mb-4' : ''}`}>
                <div className="signature-line">
                  <p
                    className={`font-semibold text-gray-700 ${
                      paperSize === '80mm' ? 'text-xs' : 'text-sm'
                    }`}
                  >
                    Customer Signature
                  </p>
                  <p className={`text-gray-500 ${paperSize === '80mm' ? 'text-[10px]' : 'text-xs'}`}>
                    Date: _________________
                  </p>
                </div>
              </div>
              <div>
                <div className="signature-line">
                  <p
                    className={`font-semibold text-gray-700 ${
                      paperSize === '80mm' ? 'text-xs' : 'text-sm'
                    }`}
                  >
                    Received By (Customer)
                  </p>
                  <p className={`text-gray-500 ${paperSize === '80mm' ? 'text-[10px]' : 'text-xs'}`}>
                    Date: _________________
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-3 border-t-2 border-black mt-4">
              <p
                className={`text-gray-600 mb-1 ${paperSize === '80mm' ? 'text-xs' : 'text-sm'}`}
              >
                Thank you for trusting our service!
              </p>
              <p className={`text-gray-500 ${paperSize === '80mm' ? 'text-[10px]' : 'text-xs'}`}>
                This serves as your Service Warranty Slip. Please keep for your records.
              </p>
              <p
                className={`text-gray-500 mt-1 ${paperSize === '80mm' ? 'text-[10px]' : 'text-xs'}`}
              >
                For warranty claims, please present this slip along with the repaired item.
              </p>
              <p
                className={`text-gray-500 mt-1 ${paperSize === '80mm' ? 'text-[10px]' : 'text-xs'}`}
              >
                Generated by: {businessName} Service Management System
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
