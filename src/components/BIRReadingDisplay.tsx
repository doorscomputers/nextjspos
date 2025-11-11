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
  returnAmount: number
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

  const formatCurrency = (amount: number) => {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
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

              {/* Payments Received */}
              <div className="section">
                <div className="section-title">PAYMENTS RECEIVED</div>
                <div className="line">
                  <span className="line-label">CASH</span>
                  <span className="line-value">{formatCurrency(xReading.paymentBreakdown['cash'] || 0)}</span>
                </div>
                {xReading.paymentBreakdown['check'] > 0 && (
                  <div className="line">
                    <span className="line-label">CHEQUE</span>
                    <span className="line-value">{formatCurrency(xReading.paymentBreakdown['check'] || 0)}</span>
                  </div>
                )}
                {xReading.paymentBreakdown['card'] > 0 && (
                  <div className="line">
                    <span className="line-label">CREDIT CARD</span>
                    <span className="line-value">{formatCurrency(xReading.paymentBreakdown['card'] || 0)}</span>
                  </div>
                )}
                {xReading.paymentBreakdown['gcash'] > 0 && (
                  <div className="line">
                    <span className="line-label">GCASH</span>
                    <span className="line-value">{formatCurrency(xReading.paymentBreakdown['gcash'] || 0)}</span>
                  </div>
                )}
                {xReading.paymentBreakdown['paymaya'] > 0 && (
                  <div className="line">
                    <span className="line-label">PAYMAYA</span>
                    <span className="line-value">{formatCurrency(xReading.paymentBreakdown['paymaya'] || 0)}</span>
                  </div>
                )}
                {xReading.paymentBreakdown['bank_transfer'] > 0 && (
                  <div className="line">
                    <span className="line-label">BANK TRANSFER</span>
                    <span className="line-value">{formatCurrency(xReading.paymentBreakdown['bank_transfer'] || 0)}</span>
                  </div>
                )}
                {xReading.paymentBreakdown['credit'] > 0 && (
                  <div className="line">
                    <span className="line-label">CREDIT</span>
                    <span className="line-value">{formatCurrency(xReading.paymentBreakdown['credit'] || 0)}</span>
                  </div>
                )}
                {xReading.paymentBreakdown['other'] > 0 && (
                  <div className="line">
                    <span className="line-label">OTHER</span>
                    <span className="line-value">{formatCurrency(xReading.paymentBreakdown['other'] || 0)}</span>
                  </div>
                )}
                <div className="line total-line">
                  <span className="line-label">Total Payments:</span>
                  <span className="line-value">{formatCurrency(xReading.netSales)}</span>
                </div>
              </div>

              {/* Void */}
              <div className="section">
                <div className="line">
                  <span className="line-label">VOID</span>
                  <span className="line-value">{formatCurrency(xReading.voidAmount)}</span>
                </div>
              </div>

              {/* Refund */}
              <div className="section">
                <div className="line">
                  <span className="line-label">REFUND</span>
                  <span className="line-value">{formatCurrency(xReading.refundAmount)}</span>
                </div>
              </div>

              {/* Withdrawal */}
              <div className="section">
                <div className="line">
                  <span className="line-label">WITHDRAWAL</span>
                  <span className="line-value">{formatCurrency(xReading.withdrawalAmount)}</span>
                </div>
              </div>

              {/* Transaction Summary */}
              <div className="section">
                <div className="section-title">TRANSACTION SUMMARY</div>
                {(() => {
                  const { cashInDrawer, shortOverText } = calculateCashSummary(xReading)
                  return (
                    <>
                      <div className="line">
                        <span className="line-label">Cash In Drawer:</span>
                        <span className="line-value">{formatCurrency(cashInDrawer)}</span>
                      </div>
                      {xReading.paymentBreakdown['check'] > 0 && (
                        <div className="line">
                          <span className="line-label">CHEQUE</span>
                          <span className="line-value">{formatCurrency(xReading.paymentBreakdown['check'] || 0)}</span>
                        </div>
                      )}
                      {xReading.paymentBreakdown['card'] > 0 && (
                        <div className="line">
                          <span className="line-label">CREDIT CARD</span>
                          <span className="line-value">{formatCurrency(xReading.paymentBreakdown['card'] || 0)}</span>
                        </div>
                      )}
                      <div className="line">
                        <span className="line-label">Opening Fund:</span>
                        <span className="line-value">{formatCurrency(xReading.beginningCash)}</span>
                      </div>
                      <div className="line">
                        <span className="line-label">Less Withdrawal:</span>
                        <span className="line-value">{formatCurrency(xReading.withdrawalAmount)}</span>
                      </div>
                      <div className="line">
                        <span className="line-label">Payments Received:</span>
                        <span className="line-value">{formatCurrency(xReading.netSales)}</span>
                      </div>
                      {shortOverText && (
                        <div className="line total-line">
                          <span className="line-label">SHORT/OVER:</span>
                          <span className="line-value">{shortOverText}</span>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Footer Note */}
              <div className="center text-xs mt-4 italic">
                Sample Cashier's Accountability Reading<br/>
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
                  <span className="line-value">{zReading.beginningSiNumber || '00000000000001'}</span>
                </div>
                <div className="line">
                  <span className="line-label">End. SI #:</span>
                  <span className="line-value">{zReading.endingSiNumber || '00000000000006'}</span>
                </div>
                <div className="line">
                  <span className="line-label">Beg. VOID #:</span>
                  <span className="line-value">{zReading.beginningVoidNumber || '00000000000001'}</span>
                </div>
                <div className="line">
                  <span className="line-label">End. VOID #:</span>
                  <span className="line-value">{zReading.endingVoidNumber || '00000000000001'}</span>
                </div>
                <div className="line">
                  <span className="line-label">Beg. RETURN #:</span>
                  <span className="line-value">{zReading.beginningReturnNumber || '00000000000000'}</span>
                </div>
                <div className="line">
                  <span className="line-label">End. RETURN #:</span>
                  <span className="line-value">{zReading.endingReturnNumber || '00000000000000'}</span>
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
                  <span className="line-value">{formatCurrency(zReading.netSales)}</span>
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
                  <span className="line-label">VOID :</span>
                  <span className="line-value">{formatCurrency(zReading.voidAmount)}</span>
                </div>
                <div className="line">
                  <span className="line-label">RETURN :</span>
                  <span className="line-value">{formatCurrency(zReading.returnAmount)}</span>
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

              {/* Transaction Summary */}
              <div className="section">
                <div className="section-title">TRANSACTION SUMMARY</div>
                {(() => {
                  const { cashInDrawer, shortOverText } = calculateCashSummary(zReading)
                  return (
                    <>
                      <div className="line">
                        <span className="line-label">Cash In Drawer:</span>
                        <span className="line-value">{formatCurrency(zReading.endingCash || cashInDrawer)}</span>
                      </div>
                      {zReading.paymentBreakdown['check'] > 0 && (
                        <div className="line">
                          <span className="line-label">CHEQUE</span>
                          <span className="line-value">{formatCurrency(zReading.paymentBreakdown['check'] || 0)}</span>
                        </div>
                      )}
                      {zReading.paymentBreakdown['card'] > 0 && (
                        <div className="line">
                          <span className="line-label">CREDIT CARD</span>
                          <span className="line-value">{formatCurrency(zReading.paymentBreakdown['card'] || 0)}</span>
                        </div>
                      )}
                      {zReading.paymentBreakdown['gcash'] > 0 && (
                        <div className="line">
                          <span className="line-label">GCASH</span>
                          <span className="line-value">{formatCurrency(zReading.paymentBreakdown['gcash'] || 0)}</span>
                        </div>
                      )}
                      {(zReading.paymentBreakdown['credit'] || 0) > 0 && (
                        <div className="line">
                          <span className="line-label">GIFT CERTIFICATE</span>
                          <span className="line-value">{formatCurrency(zReading.paymentBreakdown['credit'] || 0)}</span>
                        </div>
                      )}
                      <div className="line">
                        <span className="line-label">Opening Fund:</span>
                        <span className="line-value">{formatCurrency(zReading.beginningCash)}</span>
                      </div>
                      <div className="line">
                        <span className="line-label">Less Withdrawal:</span>
                        <span className="line-value">{formatCurrency(zReading.withdrawalAmount)}</span>
                      </div>
                      <div className="line">
                        <span className="line-label">Payments Received:</span>
                        <span className="line-value">{formatCurrency(zReading.netSales)}</span>
                      </div>
                      {shortOverText && (
                        <div className="line total-line">
                          <span className="line-label">SHORT/OVER:</span>
                          <span className="line-value">{shortOverText}</span>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Footer Note */}
              <div className="center text-xs mt-4 italic">
                Sample End-of-Day (EOD) Reading<br/>
                ANNEX "D-2"
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
