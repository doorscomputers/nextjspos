'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Printer, Download, FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface XReadingData {
  shiftNumber: string
  cashierName: string
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
  expectedCash: number
  discountBreakdown: {
    senior: number
    pwd: number
    regular: number
  }
}

interface ZReadingData {
  reportType: string
  reportNumber: string
  generatedAt: string
  zCounter: number
  resetCounter: number
  previousAccumulatedSales: number
  salesForTheDay: number
  accumulatedSales: number
  business: {
    name: string
    tin: string | null
  }
  shift: {
    shiftNumber: string
    cashier: string
    openedAt: string
    closedAt: string | null
    status: string
    xReadingCount: number
  }
  sales: {
    transactionCount: number
    voidCount: number
    grossSales: number
    totalDiscounts: number
    netSales: number
    voidAmount: number
  }
  payments: Record<string, number>
  cash: {
    beginningCash: number
    endingCash: number
    systemCash: number
    cashOver: number
    cashShort: number
    cashIn: number
    cashOut: number
    cashInCount: number
    cashOutCount: number
  }
  discounts: {
    senior: { amount: number; count: number }
    pwd: { amount: number; count: number }
    regular: { amount: number; count: number }
  }
  categorySales: Record<string, number>
  cashDenomination: {
    count1000: number
    count500: number
    count200: number
    count100: number
    count50: number
    count20: number
    count10: number
    count5: number
    count1: number
    count025: number
    totalAmount: number
  } | null
}

interface ReadingDisplayProps {
  xReading?: XReadingData
  zReading?: ZReadingData
  variance?: {
    systemCash: number
    endingCash: number
    cashOver: number
    cashShort: number
    isBalanced: boolean
  }
  onClose?: () => void
}

export function ReadingDisplay({ xReading, zReading, variance, onClose }: ReadingDisplayProps) {
  // Add safety check
  if (!xReading && !zReading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No reading data available
        </CardContent>
      </Card>
    )
  }

  const handlePrint = (readingType: 'x' | 'z' | 'both') => {
    const printContent = document.getElementById(
      readingType === 'x' ? 'x-reading-print' : readingType === 'z' ? 'z-reading-print' : 'both-readings-print'
    )
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${readingType === 'x' ? 'X Reading' : readingType === 'z' ? 'Z Reading' : 'X & Z Readings'}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              margin: 20px;
              max-width: 80mm;
            }
            .header {
              text-align: center;
              border-bottom: 2px dashed #000;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .section {
              margin: 10px 0;
              border-bottom: 1px dashed #000;
              padding-bottom: 10px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              margin: 3px 0;
            }
            .label { font-weight: bold; }
            .value { text-align: right; }
            .total {
              font-weight: bold;
              font-size: 14px;
              border-top: 2px solid #000;
              padding-top: 5px;
            }
            h1 { font-size: 18px; margin: 5px 0; }
            h2 { font-size: 14px; margin: 8px 0; }
            h3 { font-size: 12px; margin: 5px 0; }
            .page-break { page-break-after: always; }
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

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex gap-2 justify-end print:hidden">
        {xReading && (
          <Button onClick={() => handlePrint('x')} variant="outline" size="sm">
            <Printer className="w-4 h-4 mr-2" />
            Print X Reading
          </Button>
        )}
        {zReading && (
          <Button onClick={() => handlePrint('z')} variant="outline" size="sm">
            <Printer className="w-4 h-4 mr-2" />
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
              X Reading - Mid-Shift Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div id="x-reading-print" className="space-y-4">
              <div className="header">
                <h1>{xReading.businessName}</h1>
                <div>{xReading.locationName}</div>
                <div className="text-sm">{xReading.locationAddress}</div>
                <div className="mt-2 font-bold">X READING #{xReading.xReadingNumber}</div>
                <div className="text-xs">NON-RESETTING</div>
              </div>

              <div className="section">
                <h3>SHIFT INFORMATION</h3>
                <div className="row">
                  <span className="label">Shift Number:</span>
                  <span className="value">{xReading.shiftNumber}</span>
                </div>
                <div className="row">
                  <span className="label">Cashier:</span>
                  <span className="value">{xReading.cashierName}</span>
                </div>
                <div className="row">
                  <span className="label">Opened:</span>
                  <span className="value">{new Date(xReading.openedAt).toLocaleString()}</span>
                </div>
                <div className="row">
                  <span className="label">Reading Time:</span>
                  <span className="value">{new Date(xReading.readingTime).toLocaleString()}</span>
                </div>
              </div>

              <div className="section">
                <h3>SALES SUMMARY</h3>
                <div className="row">
                  <span className="label">Transaction Count:</span>
                  <span className="value">{xReading.transactionCount}</span>
                </div>
                <div className="row">
                  <span className="label">Gross Sales:</span>
                  <span className="value">₱{formatCurrency(xReading.grossSales)}</span>
                </div>
                <div className="row">
                  <span className="label">Total Discounts:</span>
                  <span className="value">(₱{formatCurrency(xReading.totalDiscounts)})</span>
                </div>
                <div className="row">
                  <span className="label">Void Amount:</span>
                  <span className="value">(₱{formatCurrency(xReading.voidAmount)})</span>
                </div>
                <div className="row total">
                  <span className="label">NET SALES:</span>
                  <span className="value">₱{formatCurrency(xReading.netSales)}</span>
                </div>
              </div>

              <div className="section">
                <h3>PAYMENT BREAKDOWN</h3>
                {Object.entries(xReading.paymentBreakdown).map(([method, amount]) => (
                  <div key={method} className="row">
                    <span className="label">{method.toUpperCase()}:</span>
                    <span className="value">₱{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>

              <div className="section">
                <h3>CASH RECONCILIATION</h3>
                <div className="row">
                  <span className="label">Beginning Cash:</span>
                  <span className="value">₱{formatCurrency(xReading.beginningCash)}</span>
                </div>
                <div className="row">
                  <span className="label">Cash Sales:</span>
                  <span className="value">₱{formatCurrency(xReading.paymentBreakdown['cash'] || 0)}</span>
                </div>
                <div className="row">
                  <span className="label">Cash In:</span>
                  <span className="value">₱{formatCurrency(xReading.cashIn)}</span>
                </div>
                <div className="row">
                  <span className="label">Cash Out:</span>
                  <span className="value">(₱{formatCurrency(xReading.cashOut)})</span>
                </div>
                <div className="row total">
                  <span className="label">EXPECTED CASH:</span>
                  <span className="value">₱{formatCurrency(xReading.expectedCash)}</span>
                </div>
              </div>

              <div className="section">
                <h3>DISCOUNT BREAKDOWN</h3>
                <div className="row">
                  <span className="label">Senior Citizen:</span>
                  <span className="value">₱{formatCurrency(xReading.discountBreakdown.senior)}</span>
                </div>
                <div className="row">
                  <span className="label">PWD:</span>
                  <span className="value">₱{formatCurrency(xReading.discountBreakdown.pwd)}</span>
                </div>
                <div className="row">
                  <span className="label">Regular:</span>
                  <span className="value">₱{formatCurrency(xReading.discountBreakdown.regular)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Z Reading Display */}
      {zReading && (
        <Card className="page-break-before">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Z Reading - End of Day Report (BIR Compliant)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div id="z-reading-print" className="space-y-4 print-preserve">
              <div className="header">
                <h1>{zReading.business.name}</h1>
                {zReading.business.tin && <div>TIN: {zReading.business.tin}</div>}
                <div className="mt-2 font-bold text-lg">{zReading.reportNumber}</div>
                <div className="font-bold">Z READING - END OF DAY</div>
                <div className="text-xs">BIR COMPLIANT</div>
                <div className="text-xs">{new Date(zReading.generatedAt).toLocaleString()}</div>
              </div>

              <div className="section">
                <h3>BIR COUNTERS</h3>
                <div className="row">
                  <span className="label">Z Counter:</span>
                  <span className="value">{zReading.zCounter}</span>
                </div>
                <div className="row">
                  <span className="label">Reset Counter:</span>
                  <span className="value">{zReading.resetCounter}</span>
                </div>
                <div className="row">
                  <span className="label">Previous Accumulated:</span>
                  <span className="value">₱{formatCurrency(zReading.previousAccumulatedSales)}</span>
                </div>
                <div className="row">
                  <span className="label">Sales for the Day:</span>
                  <span className="value">₱{formatCurrency(zReading.salesForTheDay)}</span>
                </div>
                <div className="row total">
                  <span className="label">NEW ACCUMULATED:</span>
                  <span className="value">₱{formatCurrency(zReading.accumulatedSales)}</span>
                </div>
              </div>

              <div className="section">
                <h3>SHIFT INFORMATION</h3>
                <div className="row">
                  <span className="label">Shift Number:</span>
                  <span className="value">{zReading.shift.shiftNumber}</span>
                </div>
                <div className="row">
                  <span className="label">Cashier:</span>
                  <span className="value">{zReading.shift.cashier}</span>
                </div>
                <div className="row">
                  <span className="label">Opened:</span>
                  <span className="value">{new Date(zReading.shift.openedAt).toLocaleString()}</span>
                </div>
                {zReading.shift.closedAt && (
                  <div className="row">
                    <span className="label">Closed:</span>
                    <span className="value">{new Date(zReading.shift.closedAt).toLocaleString()}</span>
                  </div>
                )}
                <div className="row">
                  <span className="label">X Readings Count:</span>
                  <span className="value">{zReading.shift.xReadingCount}</span>
                </div>
              </div>

              <div className="section">
                <h3>SALES SUMMARY</h3>
                <div className="row">
                  <span className="label">Transaction Count:</span>
                  <span className="value">{zReading.sales.transactionCount}</span>
                </div>
                <div className="row">
                  <span className="label">Void Count:</span>
                  <span className="value">{zReading.sales.voidCount}</span>
                </div>
                <div className="row">
                  <span className="label">Gross Sales:</span>
                  <span className="value">₱{formatCurrency(zReading.sales.grossSales)}</span>
                </div>
                <div className="row">
                  <span className="label">Total Discounts:</span>
                  <span className="value">(₱{formatCurrency(zReading.sales.totalDiscounts)})</span>
                </div>
                <div className="row">
                  <span className="label">Void Amount:</span>
                  <span className="value">(₱{formatCurrency(zReading.sales.voidAmount)})</span>
                </div>
                <div className="row total">
                  <span className="label">NET SALES:</span>
                  <span className="value">₱{formatCurrency(zReading.sales.netSales)}</span>
                </div>
              </div>

              <div className="section">
                <h3>PAYMENT BREAKDOWN</h3>
                {Object.entries(zReading.payments).map(([method, amount]) => (
                  <div key={method} className="row">
                    <span className="label">{method.toUpperCase()}:</span>
                    <span className="value">₱{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>

              <div className="section">
                <h3>CASH RECONCILIATION</h3>
                <div className="row">
                  <span className="label">Beginning Cash:</span>
                  <span className="value">₱{formatCurrency(zReading.cash.beginningCash)}</span>
                </div>
                <div className="row">
                  <span className="label">Cash Sales:</span>
                  <span className="value">₱{formatCurrency(zReading.payments['cash'] || 0)}</span>
                </div>
                <div className="row">
                  <span className="label">Cash In ({zReading.cash.cashInCount}):</span>
                  <span className="value">₱{formatCurrency(zReading.cash.cashIn)}</span>
                </div>
                <div className="row">
                  <span className="label">Cash Out ({zReading.cash.cashOutCount}):</span>
                  <span className="value">(₱{formatCurrency(zReading.cash.cashOut)})</span>
                </div>
                <div className="row">
                  <span className="label">System Cash:</span>
                  <span className="value">₱{formatCurrency(zReading.cash.systemCash)}</span>
                </div>
                <div className="row">
                  <span className="label">Actual Cash:</span>
                  <span className="value">
                    {zReading.shift.status === 'open' && zReading.cash.endingCash === 0
                      ? '(Not Yet Entered)'
                      : `₱${formatCurrency(zReading.cash.endingCash)}`}
                  </span>
                </div>
                {zReading.cash.cashOver > 0 && (
                  <div className="row" style={{ color: 'green' }}>
                    <span className="label">Cash Over:</span>
                    <span className="value">₱{formatCurrency(zReading.cash.cashOver)}</span>
                  </div>
                )}
                {zReading.cash.cashShort > 0 && (
                  <div className="row" style={{ color: 'red' }}>
                    <span className="label">Cash Short:</span>
                    <span className="value">(₱{formatCurrency(zReading.cash.cashShort)})</span>
                  </div>
                )}
              </div>

              <div className="section">
                <h3>BIR DISCOUNT BREAKDOWN</h3>
                <div className="row">
                  <span className="label">Senior Citizen ({zReading.discounts.senior.count}):</span>
                  <span className="value">₱{formatCurrency(zReading.discounts.senior.amount)}</span>
                </div>
                <div className="row">
                  <span className="label">PWD ({zReading.discounts.pwd.count}):</span>
                  <span className="value">₱{formatCurrency(zReading.discounts.pwd.amount)}</span>
                </div>
                <div className="row">
                  <span className="label">Regular ({zReading.discounts.regular.count}):</span>
                  <span className="value">₱{formatCurrency(zReading.discounts.regular.amount)}</span>
                </div>
              </div>

              {zReading.cashDenomination && (
                <div className="section">
                  <h3>CASH DENOMINATION</h3>
                  {zReading.cashDenomination.count1000 > 0 && (
                    <div className="row">
                      <span className="label">₱1000 x {zReading.cashDenomination.count1000}:</span>
                      <span className="value">₱{formatCurrency(zReading.cashDenomination.count1000 * 1000)}</span>
                    </div>
                  )}
                  {zReading.cashDenomination.count500 > 0 && (
                    <div className="row">
                      <span className="label">₱500 x {zReading.cashDenomination.count500}:</span>
                      <span className="value">₱{formatCurrency(zReading.cashDenomination.count500 * 500)}</span>
                    </div>
                  )}
                  {zReading.cashDenomination.count200 > 0 && (
                    <div className="row">
                      <span className="label">₱200 x {zReading.cashDenomination.count200}:</span>
                      <span className="value">₱{formatCurrency(zReading.cashDenomination.count200 * 200)}</span>
                    </div>
                  )}
                  {zReading.cashDenomination.count100 > 0 && (
                    <div className="row">
                      <span className="label">₱100 x {zReading.cashDenomination.count100}:</span>
                      <span className="value">₱{formatCurrency(zReading.cashDenomination.count100 * 100)}</span>
                    </div>
                  )}
                  {zReading.cashDenomination.count50 > 0 && (
                    <div className="row">
                      <span className="label">₱50 x {zReading.cashDenomination.count50}:</span>
                      <span className="value">₱{formatCurrency(zReading.cashDenomination.count50 * 50)}</span>
                    </div>
                  )}
                  {zReading.cashDenomination.count20 > 0 && (
                    <div className="row">
                      <span className="label">₱20 x {zReading.cashDenomination.count20}:</span>
                      <span className="value">₱{formatCurrency(zReading.cashDenomination.count20 * 20)}</span>
                    </div>
                  )}
                  {zReading.cashDenomination.count10 > 0 && (
                    <div className="row">
                      <span className="label">₱10 x {zReading.cashDenomination.count10}:</span>
                      <span className="value">₱{formatCurrency(zReading.cashDenomination.count10 * 10)}</span>
                    </div>
                  )}
                  {zReading.cashDenomination.count5 > 0 && (
                    <div className="row">
                      <span className="label">₱5 x {zReading.cashDenomination.count5}:</span>
                      <span className="value">₱{formatCurrency(zReading.cashDenomination.count5 * 5)}</span>
                    </div>
                  )}
                  {zReading.cashDenomination.count1 > 0 && (
                    <div className="row">
                      <span className="label">₱1 x {zReading.cashDenomination.count1}:</span>
                      <span className="value">₱{formatCurrency(zReading.cashDenomination.count1 * 1)}</span>
                    </div>
                  )}
                  {zReading.cashDenomination.count025 > 0 && (
                    <div className="row">
                      <span className="label">₱0.25 x {zReading.cashDenomination.count025}:</span>
                      <span className="value">₱{formatCurrency(zReading.cashDenomination.count025 * 0.25)}</span>
                    </div>
                  )}
                  <div className="row total">
                    <span className="label">TOTAL COUNTED:</span>
                    <span className="value">₱{formatCurrency(zReading.cashDenomination.totalAmount)}</span>
                  </div>
                </div>
              )}

              {Object.keys(zReading.categorySales).length > 0 && (
                <div className="section">
                  <h3>CATEGORY SALES</h3>
                  {Object.entries(zReading.categorySales).map(([category, amount]) => (
                    <div key={category} className="row">
                      <span className="label">{category}:</span>
                      <span className="value">₱{formatCurrency(amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center text-xs mt-4" style={{ borderTop: '2px dashed #000', paddingTop: '10px' }}>
                <div>END OF Z READING</div>
                <div className="mt-2">This document is BIR compliant</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Combined Print View (Hidden) */}
      {xReading && zReading && (
        <div id="both-readings-print" className="hidden">
          <div id="x-reading-combined">
            {/* Copy of X Reading content */}
            <div className="space-y-4">
              <div className="header">
                <h1>{xReading.businessName}</h1>
                <div>{xReading.locationName}</div>
                <div className="text-sm">{xReading.locationAddress}</div>
                <div className="mt-2 font-bold">X READING #{xReading.xReadingNumber}</div>
                <div className="text-xs">NON-RESETTING</div>
              </div>
              {/* Rest of X Reading content... (abbreviated for brevity) */}
            </div>
          </div>
          <div className="page-break"></div>
          <div id="z-reading-combined">
            {/* Copy of Z Reading content */}
            <div className="space-y-4">
              <div className="header">
                <h1>{zReading.business.name}</h1>
                {zReading.business.tin && <div>TIN: {zReading.business.tin}</div>}
                <div className="mt-2 font-bold text-lg">{zReading.reportNumber}</div>
                <div className="font-bold">Z READING - END OF DAY</div>
              </div>
              {/* Rest of Z Reading content... (abbreviated for brevity) */}
            </div>
          </div>
        </div>
      )}

      {/* Variance Summary */}
      {variance && (
        <Card className={variance.isBalanced ? 'border-green-500' : 'border-yellow-500'}>
          <CardHeader>
            <CardTitle>Cash Reconciliation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">System Cash</div>
                <div className="text-2xl font-bold">₱{formatCurrency(variance.systemCash)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Actual Cash</div>
                <div className="text-2xl font-bold">₱{formatCurrency(variance.endingCash)}</div>
              </div>
              {variance.cashOver > 0 && (
                <div className="col-span-2 p-4 bg-green-50 border border-green-200 rounded">
                  <div className="text-sm text-green-700">Cash Over (Excess)</div>
                  <div className="text-xl font-bold text-green-600">₱{formatCurrency(variance.cashOver)}</div>
                </div>
              )}
              {variance.cashShort > 0 && (
                <div className="col-span-2 p-4 bg-red-50 border border-red-200 rounded">
                  <div className="text-sm text-red-700">Cash Short (Shortage)</div>
                  <div className="text-xl font-bold text-red-600">₱{formatCurrency(variance.cashShort)}</div>
                </div>
              )}
              {variance.isBalanced && (
                <div className="col-span-2 p-4 bg-green-50 border border-green-200 rounded text-center">
                  <div className="text-lg font-bold text-green-600">Cash is Balanced!</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
