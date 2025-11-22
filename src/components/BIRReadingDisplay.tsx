'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Printer, FileText } from 'lucide-react'

interface XReadingData {
  shiftNumber: string
  cashierName: string
  cashierId: string
  locationName: string
  locationAddress: string
  businessName: string
  openedAt: Date
  readingTime: Date
  xReadingNumber: number
  beginningCash: number
  grossSales: number
  totalDiscounts: number
  netSales: number
  voidAmount: number
  transactionCount: number
  voidCount: number
  paymentBreakdown: Record<string, number>
  totalPaymentsReceived?: number // NEW: Total of all payments actually received (excludes credit sales)
  creditSales?: number // NEW: Charge invoices/credit sales (unpaid - tracked separately)
  cashIn: number
  cashOut: number
  arPaymentsCash: number
  expectedCash: number
  discountBreakdown: {
    senior: number
    pwd: number
    regular: number
  }
  // BIR Compliance Fields
  vatRegTin?: string
  minNumber?: string
  serialNumber?: string
  permitNumber?: string
  operatedBy?: string
  businessAddress?: string
  startDateTime: Date
  endDateTime: Date
  beginningOrNumber?: string
  endingOrNumber?: string
  refundAmount: number
  withdrawalAmount: number
  // Exchange tracking
  exchangeCount: number
  exchangeAmount: number
  returnAmount: number
}

interface ZReadingData extends XReadingData {
  closedAt?: Date
  endingCash: number
  cashVariance: number
  zReadingNumber: number
  cashDenominations?: any
  itemsSold?: Array<{
    productName: string
    categoryName: string
    quantity: number
    totalAmount: number
  }>
  // BIR Z-Reading Specific Fields
  beginningSiNumber?: string
  endingSiNumber?: string
  beginningVoidNumber?: string
  endingVoidNumber?: string
  beginningReturnNumber?: string
  endingReturnNumber?: string
  zCounter: number
  resetCounter: number
  previousAccumulatedSales: number
  salesForTheDay: number
  accumulatedSales: number
  vatableSales: number
  vatAmount: number
  vatExemptSales: number
  zeroRatedSales: number
  vatAdjustments: {
    scTransaction: number
    pwdTransaction: number
    regularDiscountTransaction: number
    zeroRatedTransaction: number
    vatOnReturn: number
    otherVatAdjustments: number
  }
  discountSummary: {
    seniorCitizenDiscount: number
    pwdDiscount: number
    naacDiscount: number
    soloParentDiscount: number
    otherDiscount: number
  }
}

interface BIRReadingDisplayProps {
  xReading?: XReadingData
  zReading?: ZReadingData
  onClose?: () => void
}

export function BIRReadingDisplay({ xReading, zReading, onClose }: BIRReadingDisplayProps) {
  if (!xReading && !zReading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No reading data available
        </CardContent>
      </Card>
    )
  }

  const formatCurrency = (amount: number | undefined | null) => {
    const value = amount ?? 0
    return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const handlePrint = (readingType: 'x' | 'z') => {
    const printContent = document.getElementById(
      readingType === 'x' ? 'bir-x-reading-print' : 'bir-z-reading-print'
    )
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${readingType === 'x' ? 'X-READING REPORT' : 'Z-READING REPORT'}</title>
          <style>
            @media print {
              @page {
                size: 80mm auto;
                margin: 5mm;
              }
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 11px;
              line-height: 1.3;
              margin: 0;
              padding: 10px;
              max-width: 80mm;
            }
            .receipt-header {
              text-align: center;
              margin-bottom: 10px;
              padding-bottom: 8px;
              border-bottom: 1px dashed #000;
            }
            .business-name {
              font-weight: bold;
              font-size: 13px;
              margin-bottom: 3px;
            }
            .section {
              margin: 8px 0;
              padding-bottom: 6px;
              border-bottom: 1px dashed #000;
            }
            .section-title {
              font-weight: bold;
              margin-bottom: 4px;
              text-align: center;
            }
            .line {
              display: flex;
              justify-content: space-between;
              margin: 2px 0;
            }
            .line-label {
              flex: 1;
            }
            .line-value {
              text-align: right;
              min-width: 80px;
            }
            .separator {
              border-bottom: 2px solid #000;
              margin: 8px 0;
            }
            .total-line {
              font-weight: bold;
              margin-top: 4px;
              padding-top: 4px;
              border-top: 1px solid #000;
            }
            .center {
              text-align: center;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  // Calculate cash in drawer and shortage/overage
  const calculateCashSummary = (reading: XReadingData | ZReadingData) => {
    const cashPayments = reading.paymentBreakdown['cash'] || 0
    const cashInDrawer = reading.beginningCash + cashPayments + reading.cashIn - reading.cashOut
    const systemExpected = reading.expectedCash

    let shortOver = 0
    let shortOverText = ''

    if ('endingCash' in reading && reading.endingCash > 0) {
      shortOver = reading.endingCash - systemExpected
      if (Math.abs(shortOver) < 0.01) {
        shortOverText = 'BALANCED'
      } else if (shortOver > 0) {
        shortOverText = `${formatCurrency(Math.abs(shortOver))}+`
      } else {
        shortOverText = `${formatCurrency(Math.abs(shortOver))}-`
      }
    }

    return { cashInDrawer, shortOver, shortOverText }
  }

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex gap-2 justify-end print:hidden">
        {xReading && (
          <Button onClick={() => handlePrint('x')} variant="outline" size="sm" className="gap-2">
            <Printer className="w-4 h-4" />
            Print X Reading
          </Button>
        )}
        {zReading && (
          <Button onClick={() => handlePrint('z')} variant="outline" size="sm" className="gap-2">
            <Printer className="w-4 h-4" />
            Print Z Reading
          </Button>
        )}
        {onClose && (
          <Button onClick={onClose} variant="secondary" size="sm">
            Close
          </Button>
        )}
      </div>

      {/* X Reading Display */}
      {xReading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              X-READING REPORT (BIR Compliant)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div id="bir-x-reading-print" className="font-mono text-sm">
              {/* Header */}
              <div className="receipt-header">
                <div className="business-name">{xReading.businessName}</div>
                {xReading.operatedBy && (
                  <div>Operated by: {xReading.operatedBy}</div>
                )}
                <div className="text-xs">{xReading.businessAddress || xReading.locationAddress}</div>
                <div className="text-xs">{xReading.locationName}</div>
                {xReading.vatRegTin && (
                  <div className="mt-1">VAT REG TIN: {xReading.vatRegTin}</div>
                )}
                {xReading.minNumber && (
                  <div>MIN: {xReading.minNumber}</div>
                )}
                {xReading.serialNumber && (
                  <div>S/N: {xReading.serialNumber}</div>
                )}
              </div>

              {/* Report Title */}
              <div className="section-title text-base font-bold my-3">
                X-READING REPORT
              </div>

              {/* Date and Time Info */}
              <div className="section">
                <div className="line">
                  <span className="line-label">Report Date:</span>
                  <span className="line-value">{formatDate(xReading.readingTime)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Report Time:</span>
                  <span className="line-value">{formatTime(xReading.readingTime)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Start Date & Time:</span>
                  <span className="line-value">{formatDateTime(xReading.startDateTime)}</span>
                </div>
                <div className="line">
                  <span className="line-label">End Date & Time:</span>
                  <span className="line-value">{formatDateTime(xReading.endDateTime)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Cashier:</span>
                  <span className="line-value">{xReading.cashierName}</span>
                </div>
                <div className="line">
                  <span className="line-label">Beg. SI #:</span>
                  <span className="line-value">{xReading.beginningOrNumber || 'N/A'}</span>
                </div>
                <div className="line">
                  <span className="line-label">End. SI #:</span>
                  <span className="line-value">{xReading.endingOrNumber || 'N/A'}</span>
                </div>
                <div className="line">
                  <span className="line-label">Opening Fund:</span>
                  <span className="line-value">{formatCurrency(xReading.beginningCash)}</span>
                </div>
              </div>

              {/* ═══════════════════════════════════════ */}
              {/* SECTION 1: TRANSACTION COUNT */}
              {/* ═══════════════════════════════════════ */}
              <div className="section">
                <div className="section-title text-base font-bold">📊 TRANSACTION COUNT</div>
                <div className="line">
                  <span className="line-label font-bold">Total Transactions:</span>
                  <span className="line-value font-bold text-lg">{xReading.transactionCount}</span>
                </div>
                <div className="line">
                  <span className="line-label">Voided Transactions:</span>
                  <span className="line-value">{xReading.voidCount || 0}</span>
                </div>
                <div className="line">
                  <span className="line-label">Exchange Transactions:</span>
                  <span className="line-value">{xReading.exchangeCount}</span>
                </div>
              </div>

              {/* ═══════════════════════════════════════ */}
              {/* SECTION 2: GROSS SALES BREAKDOWN */}
              {/* ═══════════════════════════════════════ */}
              <div className="section">
                <div className="section-title text-base font-bold">💰 GROSS SALES (All Sales Before Deductions)</div>
                <div className="line">
                  <span className="line-label font-bold">GROSS SALES:</span>
                  <span className="line-value font-bold text-lg">{formatCurrency(xReading.grossSales)}</span>
                </div>
                <div className="separator my-2"></div>
                <div className="text-xs mb-1 font-semibold">Deductions from Gross:</div>
                <div className="line">
                  <span className="line-label">   - Total Discounts:</span>
                  <span className="line-value text-red-600 dark:text-red-400">-{formatCurrency(xReading.totalDiscounts)}</span>
                </div>
                <div className="line">
                  <span className="line-label">   - Total Returns:</span>
                  <span className="line-value text-red-600 dark:text-red-400">-{formatCurrency(xReading.returnAmount)}</span>
                </div>
                <div className="line">
                  <span className="line-label">   - Total Voids:</span>
                  <span className="line-value text-red-600 dark:text-red-400">-{formatCurrency(xReading.voidAmount)}</span>
                </div>
                <div className="line total-line mt-2">
                  <span className="line-label font-bold">= NET SALES:</span>
                  <span className="line-value font-bold text-green-600 dark:text-green-400">{formatCurrency(xReading.netSales)}</span>
                </div>
              </div>

              {/* ═══════════════════════════════════════ */}
              {/* SECTION 3: SALES BY PAYMENT METHOD */}
              {/* ═══════════════════════════════════════ */}
              <div className="section">
                <div className="section-title text-base font-bold">💳 HOW CUSTOMERS PAID (Payment Breakdown)</div>

                <div className="text-xs mb-2 font-semibold">Cash Payments:</div>
                <div className="line">
                  <span className="line-label">💵 CASH Sales:</span>
                  <span className="line-value font-bold">{formatCurrency(xReading.paymentBreakdown['cash'] || 0)}</span>
                </div>

                {/* Digital Payments Group */}
                {(() => {
                  const gcash = xReading.paymentBreakdown['gcash'] || 0
                  const paymaya = xReading.paymentBreakdown['paymaya'] || 0
                  const nfc = xReading.paymentBreakdown['nfc'] || 0
                  const digitalTotal = gcash + paymaya + nfc

                  return digitalTotal > 0 ? (
                    <>
                      <div className="text-xs mt-2 mb-1 font-semibold">Digital Payments:</div>
                      {gcash > 0 && (
                        <div className="line">
                          <span className="line-label">📱 GCASH:</span>
                          <span className="line-value">{formatCurrency(gcash)}</span>
                        </div>
                      )}
                      {paymaya > 0 && (
                        <div className="line">
                          <span className="line-label">📱 PAYMAYA:</span>
                          <span className="line-value">{formatCurrency(paymaya)}</span>
                        </div>
                      )}
                      {nfc > 0 && (
                        <div className="line">
                          <span className="line-label">📱 NFC Payment:</span>
                          <span className="line-value">{formatCurrency(nfc)}</span>
                        </div>
                      )}
                      <div className="line">
                        <span className="line-label font-semibold">Total Digital:</span>
                        <span className="line-value font-semibold">{formatCurrency(digitalTotal)}</span>
                      </div>
                    </>
                  ) : null
                })()}

                {/* Other Payment Methods */}
                {xReading.paymentBreakdown['card'] > 0 && (
                  <>
                    <div className="text-xs mt-2 mb-1 font-semibold">Card Payments:</div>
                    <div className="line">
                      <span className="line-label">💳 CREDIT/DEBIT CARD:</span>
                      <span className="line-value">{formatCurrency(xReading.paymentBreakdown['card'])}</span>
                    </div>
                  </>
                )}

                {xReading.paymentBreakdown['check'] > 0 && (
                  <>
                    <div className="text-xs mt-2 mb-1 font-semibold">Cheque Payments:</div>
                    <div className="line">
                      <span className="line-label">🧾 CHEQUE:</span>
                      <span className="line-value">{formatCurrency(xReading.paymentBreakdown['check'])}</span>
                    </div>
                  </>
                )}

                {xReading.paymentBreakdown['bank_transfer'] > 0 && (
                  <>
                    <div className="text-xs mt-2 mb-1 font-semibold">Bank Transfer:</div>
                    <div className="line">
                      <span className="line-label">🏦 BANK TRANSFER:</span>
                      <span className="line-value">{formatCurrency(xReading.paymentBreakdown['bank_transfer'])}</span>
                    </div>
                  </>
                )}

                {xReading.paymentBreakdown['other'] > 0 && (
                  <div className="line">
                    <span className="line-label">📋 OTHER:</span>
                    <span className="line-value">{formatCurrency(xReading.paymentBreakdown['other'])}</span>
                  </div>
                )}

                <div className="separator my-3"></div>
                <div className="line total-line">
                  <span className="line-label font-bold">TOTAL PAYMENTS RECEIVED:</span>
                  <span className="line-value font-bold text-green-600 dark:text-green-400">{formatCurrency(
                    Object.entries(xReading.paymentBreakdown)
                      .filter(([key]) => key !== 'credit')
                      .reduce((sum, [_, amount]) => sum + amount, 0)
                  )}</span>
                </div>
              </div>

              {/* ═══════════════════════════════════════ */}
              {/* SECTION 4: CREDIT SALES (UNPAID) */}
              {/* ═══════════════════════════════════════ */}
              <div className="section">
                <div className="section-title text-base font-bold">📋 CHARGE INVOICES / CREDIT SALES</div>
                <div className="line">
                  <span className="line-label">Credit Sales (NOT YET PAID):</span>
                  <span className="line-value font-bold text-orange-600 dark:text-orange-400">{formatCurrency((xReading as any).creditSales || 0)}</span>
                </div>
                <div className="text-xs mt-1 italic text-gray-500 dark:text-gray-400">
                  (Sales made on credit today - to be collected later)
                </div>
              </div>

              {/* ═══════════════════════════════════════ */}
              {/* SECTION 5: AR PAYMENTS COLLECTED */}
              {/* ═══════════════════════════════════════ */}
              <div className="section">
                <div className="section-title text-base font-bold">💰 AR PAYMENTS COLLECTED TODAY</div>
                <div className="line">
                  <span className="line-label">Cash from OLD Credit Sales:</span>
                  <span className="line-value font-bold text-green-600 dark:text-green-400">{formatCurrency(xReading.arPaymentsCash || 0)}</span>
                </div>
                <div className="text-xs mt-1 italic text-gray-500 dark:text-gray-400">
                  (Payments collected TODAY for PREVIOUS credit sales)
                </div>
              </div>

              {/* ═══════════════════════════════════════ */}
              {/* SECTION 6: EXCHANGE TRANSACTIONS */}
              {/* ═══════════════════════════════════════ */}
              <div className="section">
                <div className="section-title text-base font-bold">🔄 EXCHANGE TRANSACTIONS</div>
                <div className="line">
                  <span className="line-label">Exchange Count:</span>
                  <span className="line-value">{xReading.exchangeCount}</span>
                </div>
                <div className="line">
                  <span className="line-label">New Items Given (Exchange Out):</span>
                  <span className="line-value">{formatCurrency(xReading.exchangeAmount)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Items Returned (Exchange In):</span>
                  <span className="line-value">{formatCurrency(xReading.returnAmount)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Net Exchange Impact:</span>
                  <span className="line-value">{formatCurrency(xReading.exchangeAmount - xReading.returnAmount)}</span>
                </div>
              </div>

              {/* ═══════════════════════════════════════ */}
              {/* SECTION 7: VOID TRANSACTIONS */}
              {/* ═══════════════════════════════════════ */}
              <div className="section">
                <div className="section-title text-base font-bold">❌ VOIDED TRANSACTIONS</div>
                <div className="line">
                  <span className="line-label">Total Voids (Count):</span>
                  <span className="line-value">{xReading.voidCount || 0}</span>
                </div>
                <div className="line">
                  <span className="line-label">Total Void Amount:</span>
                  <span className="line-value text-red-600 dark:text-red-400">{formatCurrency(xReading.voidAmount)}</span>
                </div>
              </div>

              {/* ═══════════════════════════════════════ */}
              {/* SECTION 8: DISCOUNTS */}
              {/* ═══════════════════════════════════════ */}
              <div className="section">
                <div className="section-title text-base font-bold">🎫 DISCOUNT BREAKDOWN</div>
                <div className="line">
                  <span className="line-label">Senior Citizen Discount:</span>
                  <span className="line-value">{formatCurrency(xReading.discountBreakdown.senior)}</span>
                </div>
                <div className="line">
                  <span className="line-label">PWD Discount:</span>
                  <span className="line-value">{formatCurrency(xReading.discountBreakdown.pwd)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Other Discounts:</span>
                  <span className="line-value">{formatCurrency(xReading.discountBreakdown.regular)}</span>
                </div>
                <div className="line total-line">
                  <span className="line-label font-bold">TOTAL DISCOUNTS:</span>
                  <span className="line-value font-bold">{formatCurrency(xReading.totalDiscounts)}</span>
                </div>
              </div>


              {/* ═══════════════════════════════════════ */}
              {/* SECTION 9: CASH IN/OUT (Drawer Movements) */}
              {/* ═══════════════════════════════════════ */}
              <div className="section">
                <div className="section-title text-base font-bold">💸 CASH IN / CASH OUT (Non-Sales)</div>
                <div className="line">
                  <span className="line-label">➕ CASH IN (Added to Drawer):</span>
                  <span className="line-value text-green-600 dark:text-green-400 font-bold">+{formatCurrency(xReading.cashIn || 0)}</span>
                </div>
                <div className="line">
                  <span className="line-label">➖ CASH OUT (Withdrawals):</span>
                  <span className="line-value text-red-600 dark:text-red-400 font-bold">-{formatCurrency(xReading.withdrawalAmount || 0)}</span>
                </div>
                <div className="line total-line">
                  <span className="line-label font-bold">Net Cash Movement:</span>
                  <span className="line-value font-bold">{formatCurrency((xReading.cashIn || 0) - (xReading.withdrawalAmount || 0))}</span>
                </div>
              </div>

              {/* ═══════════════════════════════════════ */}
              {/* SECTION 10: EXPECTED CASH - COMPLETE CALCULATION */}
              {/* ═══════════════════════════════════════ */}
              <div className="section">
                <div className="section-title text-base font-bold">💰 EXPECTED CASH IN DRAWER (Full Calculation)</div>
                <div className="text-xs mb-3 text-gray-600 dark:text-gray-400 italic bg-gray-100 dark:bg-gray-800 p-2 rounded">
                  This shows ALL cash that should be in the drawer based on ALL transactions
                </div>

                {(() => {
                  const cashFromSales = xReading.paymentBreakdown['cash'] || 0
                  const arCash = xReading.arPaymentsCash || 0
                  const cashIn = xReading.cashIn || 0
                  const cashOut = xReading.withdrawalAmount || 0

                  return (
                    <>
                      <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded mb-3">
                        <div className="text-sm font-semibold mb-2 text-blue-900 dark:text-blue-100">CASH ADDED TO DRAWER:</div>

                        <div className="line">
                          <span className="line-label">1️⃣ Beginning Cash (Opening Fund):</span>
                          <span className="line-value font-semibold">{formatCurrency(xReading.beginningCash)}</span>
                        </div>

                        <div className="line">
                          <span className="line-label">2️⃣ + Cash from Sales Today:</span>
                          <span className="line-value text-green-600 dark:text-green-400 font-semibold">+{formatCurrency(cashFromSales)}</span>
                        </div>

                        <div className="line">
                          <span className="line-label">3️⃣ + AR Payments (cash collected):</span>
                          <span className="line-value text-green-600 dark:text-green-400 font-semibold">+{formatCurrency(arCash)}</span>
                        </div>

                        <div className="line">
                          <span className="line-label">4️⃣ + Cash In (added to drawer):</span>
                          <span className="line-value text-green-600 dark:text-green-400 font-semibold">+{formatCurrency(cashIn)}</span>
                        </div>

                        <div className="line total-line mt-2 pt-2 border-t border-blue-300 dark:border-blue-700">
                          <span className="line-label font-bold">SUBTOTAL (Cash Added):</span>
                          <span className="line-value font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(xReading.beginningCash + cashFromSales + arCash + cashIn)}
                          </span>
                        </div>
                      </div>

                      <div className="bg-red-50 dark:bg-red-950 p-3 rounded mb-3">
                        <div className="text-sm font-semibold mb-2 text-red-900 dark:text-red-100">CASH REMOVED FROM DRAWER:</div>

                        <div className="line">
                          <span className="line-label">5️⃣ - Cash Out (Withdrawals):</span>
                          <span className="line-value text-red-600 dark:text-red-400 font-semibold">-{formatCurrency(cashOut)}</span>
                        </div>
                      </div>

                      <div className="separator my-3"></div>

                      <div className="line total-line bg-green-100 dark:bg-green-900 p-3 rounded">
                        <span className="line-label font-bold text-lg">💰 EXPECTED CASH IN DRAWER:</span>
                        <span className="line-value font-bold text-lg text-green-700 dark:text-green-300">
                          {formatCurrency(xReading.expectedCash)}
                        </span>
                      </div>

                      <div className="text-xs mt-2 italic text-gray-500 dark:text-gray-400 text-center">
                        Formula: Beginning + Cash Sales + AR Cash + Cash In - Cash Out
                      </div>

                      {/* Non-Cash Summary */}
                      <div className="mt-4 pt-3 border-t-2 border-gray-300 dark:border-gray-700">
                        <div className="text-sm mb-2 font-bold text-gray-700 dark:text-gray-300">📋 NON-CASH PAYMENTS (Not in Drawer):</div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                          <div className="line text-sm">
                            <span className="line-label">• Cheques:</span>
                            <span className="line-value">{formatCurrency(xReading.paymentBreakdown['check'] || 0)}</span>
                          </div>
                          <div className="line text-sm">
                            <span className="line-label">• Credit/Debit Cards:</span>
                            <span className="line-value">{formatCurrency(xReading.paymentBreakdown['card'] || 0)}</span>
                          </div>
                          <div className="line text-sm">
                            <span className="line-label">• E-Wallets (GCash/PayMaya/NFC):</span>
                            <span className="line-value">{formatCurrency(
                              (xReading.paymentBreakdown['gcash'] || 0) +
                              (xReading.paymentBreakdown['paymaya'] || 0) +
                              (xReading.paymentBreakdown['nfc'] || 0)
                            )}</span>
                          </div>
                          <div className="line text-sm">
                            <span className="line-label">• Bank Transfers:</span>
                            <span className="line-value">{formatCurrency(xReading.paymentBreakdown['bank_transfer'] || 0)}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Footer Note */}
              <div className="center text-xs mt-4 italic">
                Cashier's Accountability Reading<br/>
                ANNEX "D-1"
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Z Reading Display */}
      {zReading && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Z-READING REPORT (BIR Compliant - End of Day)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div id="bir-z-reading-print" className="font-mono text-sm">
              {/* Header */}
              <div className="receipt-header">
                <div className="business-name">{zReading.businessName}</div>
                {zReading.operatedBy && (
                  <div>Operated by: {zReading.operatedBy}</div>
                )}
                <div className="text-xs">{zReading.businessAddress || zReading.locationAddress}</div>
                <div className="text-xs">{zReading.locationName}</div>
                {zReading.vatRegTin && (
                  <div className="mt-1">VAT REG TIN: {zReading.vatRegTin}</div>
                )}
                {zReading.minNumber && (
                  <div>MIN: {zReading.minNumber}</div>
                )}
                {zReading.serialNumber && (
                  <div>S/N: {zReading.serialNumber}</div>
                )}
              </div>

              {/* Report Title */}
              <div className="section-title text-base font-bold my-3">
                Z-READING REPORT
              </div>

              {/* Date and Time Info */}
              <div className="section">
                <div className="line">
                  <span className="line-label">Report Date:</span>
                  <span className="line-value">{formatDate(zReading.readingTime)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Report Time:</span>
                  <span className="line-value">{formatTime(zReading.readingTime)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Start Date & Time:</span>
                  <span className="line-value">{formatDateTime(zReading.startDateTime)}</span>
                </div>
                <div className="line">
                  <span className="line-label">End Date & Time:</span>
                  <span className="line-value">{formatDateTime(zReading.endDateTime)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Beg. SI #:</span>
                  <span className="line-value">{zReading.beginningSiNumber || 'No Sales'}</span>
                </div>
                <div className="line">
                  <span className="line-label">End. SI #:</span>
                  <span className="line-value">{zReading.endingSiNumber || 'No Sales'}</span>
                </div>
                <div className="line">
                  <span className="line-label">Beg. VOID #:</span>
                  <span className="line-value">{zReading.beginningVoidNumber || 'No Voids'}</span>
                </div>
                <div className="line">
                  <span className="line-label">End. VOID #:</span>
                  <span className="line-value">{zReading.endingVoidNumber || 'No Voids'}</span>
                </div>
                <div className="line">
                  <span className="line-label">Beg. RETURN #:</span>
                  <span className="line-value">{zReading.beginningReturnNumber || 'No Returns'}</span>
                </div>
                <div className="line">
                  <span className="line-label">End. RETURN #:</span>
                  <span className="line-value">{zReading.endingReturnNumber || 'No Returns'}</span>
                </div>
                <div className="line">
                  <span className="line-label">Reset Counter No.</span>
                  <span className="line-value">{zReading.resetCounter}</span>
                </div>
                <div className="line">
                  <span className="line-label">Z Counter No. :</span>
                  <span className="line-value">{zReading.zCounter}</span>
                </div>
              </div>

              {/* Accumulated Sales */}
              <div className="section">
                <div className="line">
                  <span className="line-label">Present Accumulated Sales:</span>
                  <span className="line-value">{formatCurrency(zReading.accumulatedSales)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Previous Accumulated Sales:</span>
                  <span className="line-value">{formatCurrency(zReading.previousAccumulatedSales)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Sales for the Day:</span>
                  <span className="line-value">{formatCurrency(zReading.salesForTheDay)}</span>
                </div>
              </div>

              {/* Breakdown of Sales */}
              <div className="section">
                <div className="section-title">BREAKDOWN OF SALES</div>
                <div className="line">
                  <span className="line-label">VATABLE SALES :</span>
                  <span className="line-value">{formatCurrency(zReading.vatableSales)}</span>
                </div>
                <div className="line">
                  <span className="line-label">VAT AMOUNT:</span>
                  <span className="line-value">{formatCurrency(zReading.vatAmount)}</span>
                </div>
                <div className="line">
                  <span className="line-label">VAT EXEMPT SALES:</span>
                  <span className="line-value">{formatCurrency(zReading.vatExemptSales)}</span>
                </div>
                <div className="line">
                  <span className="line-label">ZERO RATED SALES:</span>
                  <span className="line-value">{formatCurrency(zReading.zeroRatedSales)}</span>
                </div>
              </div>

              {/* Sales Summary */}
              <div className="section">
                <div className="line">
                  <span className="line-label">Gross Amount:</span>
                  <span className="line-value">{formatCurrency(zReading.grossSales)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Less Discount:</span>
                  <span className="line-value">{formatCurrency(zReading.totalDiscounts)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Less Return:</span>
                  <span className="line-value">{formatCurrency(zReading.returnAmount)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Less Void:</span>
                  <span className="line-value">{formatCurrency(zReading.voidAmount)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Less VAT Adjustment:</span>
                  <span className="line-value">
                    {formatCurrency(
                      zReading.vatAdjustments.scTransaction +
                      zReading.vatAdjustments.pwdTransaction +
                      zReading.vatAdjustments.regularDiscountTransaction
                    )}
                  </span>
                </div>
                <div className="line total-line">
                  <span className="line-label">Net Amount:</span>
                  <span className="line-value">{formatCurrency(
                    zReading.grossSales -
                    zReading.totalDiscounts -
                    zReading.returnAmount -
                    zReading.voidAmount -
                    (zReading.vatAdjustments.scTransaction +
                     zReading.vatAdjustments.pwdTransaction +
                     zReading.vatAdjustments.regularDiscountTransaction)
                  )}</span>
                </div>
              </div>

              {/* Discount Summary */}
              <div className="section">
                <div className="section-title">DISCOUNT SUMMARY</div>
                <div className="line">
                  <span className="line-label">SC Disc. :</span>
                  <span className="line-value">{formatCurrency(zReading.discountSummary.seniorCitizenDiscount)}</span>
                </div>
                <div className="line">
                  <span className="line-label">PWD Disc. :</span>
                  <span className="line-value">{formatCurrency(zReading.discountSummary.pwdDiscount)}</span>
                </div>
                <div className="line">
                  <span className="line-label">NAAC Disc. :</span>
                  <span className="line-value">{formatCurrency(zReading.discountSummary.naacDiscount)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Solo Parent Disc. :</span>
                  <span className="line-value">{formatCurrency(zReading.discountSummary.soloParentDiscount)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Other Disc. :</span>
                  <span className="line-value">{formatCurrency(zReading.discountSummary.otherDiscount)}</span>
                </div>
              </div>

              {/* Sales Adjustment */}
              <div className="section">
                <div className="section-title">SALES ADJUSTMENT</div>
                <div className="line">
                  <span className="line-label">VOID Count :</span>
                  <span className="line-value">{zReading.voidCount || 0}</span>
                </div>
                <div className="line">
                  <span className="line-label">VOID Amount :</span>
                  <span className="line-value">{formatCurrency(zReading.voidAmount)}</span>
                </div>
                <div className="line">
                  <span className="line-label">RETURN :</span>
                  <span className="line-value">{formatCurrency(zReading.returnAmount)}</span>
                </div>
              </div>

              {/* Exchange Summary */}
              <div className="section">
                <div className="section-title">EXCHANGE SUMMARY</div>
                <div className="line">
                  <span className="line-label">Exchange Count :</span>
                  <span className="line-value">{zReading.exchangeCount}</span>
                </div>
                <div className="line">
                  <span className="line-label">Exchange Amount :</span>
                  <span className="line-value">{formatCurrency(zReading.exchangeAmount)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Return Amount :</span>
                  <span className="line-value">{formatCurrency(zReading.returnAmount)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Net Exchange Impact :</span>
                  <span className="line-value">{formatCurrency(zReading.exchangeAmount - zReading.returnAmount)}</span>
                </div>
              </div>

              {/* VAT Adjustment */}
              <div className="section">
                <div className="section-title">VAT ADJUSTMENT</div>
                <div className="line">
                  <span className="line-label">SC TRANS. :</span>
                  <span className="line-value">{formatCurrency(zReading.vatAdjustments.scTransaction)}</span>
                </div>
                <div className="line">
                  <span className="line-label">PWD TRANS :</span>
                  <span className="line-value">{formatCurrency(zReading.vatAdjustments.pwdTransaction)}</span>
                </div>
                <div className="line">
                  <span className="line-label">REG.Disc. TRANS :</span>
                  <span className="line-value">{formatCurrency(zReading.vatAdjustments.regularDiscountTransaction)}</span>
                </div>
                <div className="line">
                  <span className="line-label">ZERO-RATED TRANS.:</span>
                  <span className="line-value">{formatCurrency(zReading.vatAdjustments.zeroRatedTransaction)}</span>
                </div>
                <div className="line">
                  <span className="line-label">VAT on Return:</span>
                  <span className="line-value">{formatCurrency(zReading.vatAdjustments.vatOnReturn)}</span>
                </div>
                <div className="line">
                  <span className="line-label">Other VAT Adjustments</span>
                  <span className="line-value">{formatCurrency(zReading.vatAdjustments.otherVatAdjustments)}</span>
                </div>
              </div>

              {/* Transaction Summary - Simplified and Clear */}
              <div className="section">
                <div className="section-title">TRANSACTION SUMMARY</div>
                <div className="text-xs mb-2 text-gray-600 italic">Summary of all payments collected during shift:</div>

                {/* Cash Section */}
                <div className="line">
                  <span className="line-label">Cash Payments:</span>
                  <span className="line-value">{formatCurrency(zReading.paymentBreakdown['cash'] || 0)}</span>
                </div>

                {/* Non-Cash Payments */}
                {zReading.paymentBreakdown['check'] > 0 && (
                  <div className="line">
                    <span className="line-label">Cheque:</span>
                    <span className="line-value">{formatCurrency(zReading.paymentBreakdown['check'] || 0)}</span>
                  </div>
                )}
                {zReading.paymentBreakdown['card'] > 0 && (
                  <div className="line">
                    <span className="line-label">Credit Card:</span>
                    <span className="line-value">{formatCurrency(zReading.paymentBreakdown['card'] || 0)}</span>
                  </div>
                )}
                {zReading.paymentBreakdown['gcash'] > 0 && (
                  <div className="line">
                    <span className="line-label">GCash:</span>
                    <span className="line-value">{formatCurrency(zReading.paymentBreakdown['gcash'] || 0)}</span>
                  </div>
                )}
                {zReading.paymentBreakdown['paymaya'] > 0 && (
                  <div className="line">
                    <span className="line-label">PayMaya:</span>
                    <span className="line-value">{formatCurrency(zReading.paymentBreakdown['paymaya'] || 0)}</span>
                  </div>
                )}
                {zReading.paymentBreakdown['bank_transfer'] > 0 && (
                  <div className="line">
                    <span className="line-label">Bank Transfer:</span>
                    <span className="line-value">{formatCurrency(zReading.paymentBreakdown['bank_transfer'] || 0)}</span>
                  </div>
                )}

                <div className="line total-line">
                  <span className="line-label">Total Payments Received:</span>
                  <span className="line-value">{formatCurrency(
                    Object.entries(zReading.paymentBreakdown)
                      .filter(([key]) => key !== 'credit') // Exclude credit sales
                      .reduce((sum, [_, amount]) => sum + amount, 0)
                  )}</span>
                </div>

                {/* Credit Sales shown separately - NOT a payment */}
                {(zReading as any).creditSales > 0 && (
                  <div className="line">
                    <span className="line-label">Charge Invoice/Credit Sales (Unpaid):</span>
                    <span className="line-value">{formatCurrency((zReading as any).creditSales)}</span>
                  </div>
                )}

                {/* Additional Cash Movements */}
                {(zReading.cashIn > 0 || zReading.cashOut > 0 || zReading.arPaymentsCash > 0) && (
                  <>
                    <div className="mt-3 mb-1 text-xs font-semibold text-gray-700">Other Cash Movements:</div>
                    {zReading.cashIn > 0 && (
                      <div className="line">
                        <span className="line-label">+ Cash In (added to drawer):</span>
                        <span className="line-value">+{formatCurrency(zReading.cashIn)}</span>
                      </div>
                    )}
                    {zReading.arPaymentsCash > 0 && (
                      <div className="line">
                        <span className="line-label">+ AR Payments (cash):</span>
                        <span className="line-value">+{formatCurrency(zReading.arPaymentsCash)}</span>
                      </div>
                    )}
                    {zReading.cashOut > 0 && (
                      <div className="line">
                        <span className="line-label">- Cash Out (withdrawals):</span>
                        <span className="line-value">-{formatCurrency(zReading.cashOut)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Expected Cash Calculation - Simplified and Clear */}
              <div className="section">
                <div className="section-title">EXPECTED CASH CALCULATION</div>
                <div className="text-xs mb-2 text-gray-600 italic">Step-by-step calculation of expected cash in drawer:</div>

                <div className="mb-2 text-xs font-semibold text-gray-700">Starting Amount:</div>
                <div className="line">
                  <span className="line-label">1. Beginning Cash (Opening Fund)</span>
                  <span className="line-value">{formatCurrency(zReading.beginningCash)}</span>
                </div>

                <div className="mt-2 mb-2 text-xs font-semibold text-gray-700">Add Cash Received:</div>
                <div className="line">
                  <span className="line-label">2. + Cash from Sales</span>
                  <span className="line-value">{formatCurrency(zReading.cashFromSales || zReading.paymentBreakdown?.cash || 0)}</span>
                </div>
                {(zReading.cashIn > 0) && (
                  <div className="line">
                    <span className="line-label">3. + Cash In (added to drawer)</span>
                    <span className="line-value">{formatCurrency(zReading.cashIn)}</span>
                  </div>
                )}
                {(zReading.arPaymentsCash > 0) && (
                  <div className="line">
                    <span className="line-label">4. + AR Payments (cash collected)</span>
                    <span className="line-value">{formatCurrency(zReading.arPaymentsCash)}</span>
                  </div>
                )}

                <div className="mt-2 mb-2 text-xs font-semibold text-gray-700">Subtract Cash Removed:</div>
                {(zReading.cashOut > 0) && (
                  <div className="line">
                    <span className="line-label">5. - Cash Out (withdrawals)</span>
                    <span className="line-value">-{formatCurrency(zReading.cashOut)}</span>
                  </div>
                )}

                <div className="line total-line mt-3">
                  <span className="line-label font-bold">= Expected Cash in Drawer</span>
                  <span className="line-value font-bold">{formatCurrency(zReading.expectedCash)}</span>
                </div>

                <div className="text-xs mt-2 italic text-gray-500">
                  Formula: Beginning Cash + Cash Sales + Cash In + AR Cash - Cash Out = Expected Cash
                </div>
              </div>

              {/* Cash Denomination Breakdown */}
              {zReading.cashDenominations && (
                <div className="section">
                  <div className="section-title">CASH DENOMINATION BREAKDOWN</div>
                  <div className="text-xs mb-2 text-gray-600">Actual bills/coins counted by cashier:</div>

                  {zReading.cashDenominations.count1000 > 0 && (
                    <div className="line">
                      <span className="line-label">₱1000 Bills × {zReading.cashDenominations.count1000}</span>
                      <span className="line-value">= {formatCurrency(zReading.cashDenominations.count1000 * 1000)}</span>
                    </div>
                  )}
                  {zReading.cashDenominations.count500 > 0 && (
                    <div className="line">
                      <span className="line-label">₱500 Bills × {zReading.cashDenominations.count500}</span>
                      <span className="line-value">= {formatCurrency(zReading.cashDenominations.count500 * 500)}</span>
                    </div>
                  )}
                  {zReading.cashDenominations.count200 > 0 && (
                    <div className="line">
                      <span className="line-label">₱200 Bills × {zReading.cashDenominations.count200}</span>
                      <span className="line-value">= {formatCurrency(zReading.cashDenominations.count200 * 200)}</span>
                    </div>
                  )}
                  {zReading.cashDenominations.count100 > 0 && (
                    <div className="line">
                      <span className="line-label">₱100 Bills × {zReading.cashDenominations.count100}</span>
                      <span className="line-value">= {formatCurrency(zReading.cashDenominations.count100 * 100)}</span>
                    </div>
                  )}
                  {zReading.cashDenominations.count50 > 0 && (
                    <div className="line">
                      <span className="line-label">₱50 Bills × {zReading.cashDenominations.count50}</span>
                      <span className="line-value">= {formatCurrency(zReading.cashDenominations.count50 * 50)}</span>
                    </div>
                  )}
                  {zReading.cashDenominations.count20 > 0 && (
                    <div className="line">
                      <span className="line-label">₱20 Bills × {zReading.cashDenominations.count20}</span>
                      <span className="line-value">= {formatCurrency(zReading.cashDenominations.count20 * 20)}</span>
                    </div>
                  )}
                  {zReading.cashDenominations.count10 > 0 && (
                    <div className="line">
                      <span className="line-label">₱10 Coins × {zReading.cashDenominations.count10}</span>
                      <span className="line-value">= {formatCurrency(zReading.cashDenominations.count10 * 10)}</span>
                    </div>
                  )}
                  {zReading.cashDenominations.count5 > 0 && (
                    <div className="line">
                      <span className="line-label">₱5 Coins × {zReading.cashDenominations.count5}</span>
                      <span className="line-value">= {formatCurrency(zReading.cashDenominations.count5 * 5)}</span>
                    </div>
                  )}
                  {zReading.cashDenominations.count1 > 0 && (
                    <div className="line">
                      <span className="line-label">₱1 Coins × {zReading.cashDenominations.count1}</span>
                      <span className="line-value">= {formatCurrency(zReading.cashDenominations.count1 * 1)}</span>
                    </div>
                  )}
                  {zReading.cashDenominations.count025 > 0 && (
                    <div className="line">
                      <span className="line-label">₱0.25 Coins × {zReading.cashDenominations.count025}</span>
                      <span className="line-value">= {formatCurrency(zReading.cashDenominations.count025 * 0.25)}</span>
                    </div>
                  )}
                  <div className="line total-line">
                    <span className="line-label font-bold">= Total Physical Count:</span>
                    <span className="line-value font-bold">{formatCurrency(zReading.endingCash)}</span>
                  </div>
                </div>
              )}

              {/* Final Variance Calculation - Clear and Understandable */}
              <div className="section">
                <div className="section-title">CASH RECONCILIATION (SHORT/OVER)</div>
                <div className="text-xs mb-3 text-gray-600 italic">Comparing system calculations vs actual physical count:</div>

                <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded mb-2">
                  <div className="line">
                    <span className="line-label font-semibold">A. System Expected Cash:</span>
                    <span className="line-value font-semibold">{formatCurrency(zReading.expectedCash)}</span>
                  </div>
                  <div className="text-xs text-gray-600 ml-4">
                    (Based on beginning cash + sales + cash in - cash out)
                  </div>
                </div>

                <div className="p-2 bg-green-50 dark:bg-green-950 rounded mb-2">
                  <div className="line">
                    <span className="line-label font-semibold">B. Physical Count (Actual):</span>
                    <span className="line-value font-semibold">{formatCurrency(zReading.endingCash)}</span>
                  </div>
                  <div className="text-xs text-gray-600 ml-4">
                    (Cash denominations counted by cashier: ₱{zReading.endingCash.toFixed(2)})
                  </div>
                </div>

                <div className="p-2 bg-amber-50 dark:bg-amber-950 rounded mb-2">
                  <div className="line">
                    <span className="line-label font-semibold">C. Variance (B - A):</span>
                    <span className="line-value font-semibold">
                      {(zReading.cashVariance ?? 0) >= 0 ? '+' : ''}{formatCurrency(zReading.cashVariance ?? 0)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 ml-4">
                    {formatCurrency(zReading.endingCash)} minus {formatCurrency(zReading.expectedCash)} = {formatCurrency(zReading.cashVariance ?? 0)}
                  </div>
                </div>

                <div className={`line total-line p-3 rounded ${
                  Math.abs(zReading.cashVariance ?? 0) < 0.01
                    ? 'bg-green-100 dark:bg-green-900'
                    : (zReading.cashVariance ?? 0) > 0
                      ? 'bg-blue-100 dark:bg-blue-900'
                      : 'bg-red-100 dark:bg-red-900'
                }`}>
                  <span className="line-label font-bold text-lg">SHORT/OVER:</span>
                  <span className="line-value font-bold text-lg">
                    {Math.abs(zReading.cashVariance ?? 0) < 0.01
                      ? 'BALANCED ✓'
                      : (zReading.cashVariance ?? 0) > 0
                        ? `${formatCurrency(Math.abs(zReading.cashVariance ?? 0))}+ (OVER)`
                        : `${formatCurrency(Math.abs(zReading.cashVariance ?? 0))}- (SHORT)`}
                  </span>
                </div>

                <div className="text-xs mt-3 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                  <div className="font-semibold mb-1">Understanding Short/Over:</div>
                  <ul className="list-disc ml-4 space-y-1">
                    <li><strong>OVER (+)</strong>: Physical cash is MORE than expected (extra cash in drawer)</li>
                    <li><strong>SHORT (-)</strong>: Physical cash is LESS than expected (missing cash)</li>
                    <li><strong>BALANCED</strong>: Physical cash matches system expected exactly</li>
                  </ul>
                </div>
              </div>

              {/* Footer Note */}
              <div className="center text-xs mt-4 italic">
                End-of-Day (EOD) Reading<br/>
                ANNEX "D-2"
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
