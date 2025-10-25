"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import {
  CreditCardIcon,
  BanknotesIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline"

interface InvoiceData {
  id: number
  invoiceNumber: string
  totalAmount: number
  totalPaid: number
  balance: number
  isFullyPaid: boolean
  customer: {
    id: number
    name: string
  }
}

interface PaymentHistory {
  id: number
  amount: number
  paymentMethod: string
  referenceNumber: string | null
  paidAt: string
}

export default function RecordPaymentPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const { can } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  )

  // Payment methods
  const paymentMethods = [
    { value: "cash", label: "Cash", icon: BanknotesIcon },
    { value: "card", label: "Credit/Debit Card", icon: CreditCardIcon },
    { value: "bank_transfer", label: "Bank Transfer", icon: BanknotesIcon },
    { value: "cheque", label: "Cheque", icon: BanknotesIcon },
    { value: "gcash", label: "GCash", icon: CreditCardIcon },
    { value: "paymaya", label: "PayMaya", icon: CreditCardIcon },
  ]

  // Check permissions
  useEffect(() => {
    if (!can(PERMISSIONS.REPORT_CUSTOMER_PAYMENTS)) {
      router.push("/dashboard")
    }
  }, [can, router])

  // Fetch invoice data and payment history
  useEffect(() => {
    const fetchInvoiceData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/sales/${params.id}/payment`)
        const data = await response.json()

        if (data.success) {
          setInvoice(data.invoice)
          setPaymentHistory(data.payments || [])
          // Default payment amount to remaining balance
          setAmount(data.invoice.balance.toFixed(2))
        } else {
          setError(data.error || "Failed to load invoice")
        }
      } catch (err: any) {
        setError("Failed to load invoice data")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchInvoiceData()
  }, [params.id])

  // Handle payment submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validation
    const paymentAmount = parseFloat(amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setError("Please enter a valid payment amount")
      return
    }

    if (invoice && paymentAmount > invoice.balance + 0.01) {
      setError(
        `Payment amount cannot exceed outstanding balance of ₱${invoice.balance.toFixed(2)}`
      )
      return
    }

    try {
      setSubmitting(true)

      const response = await fetch(`/api/sales/${params.id}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: paymentAmount,
          paymentMethod,
          referenceNumber: referenceNumber || null,
          paymentDate,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(
          `Payment of ₱${paymentAmount.toFixed(2)} recorded successfully! ${data.invoice.isFullyPaid ? "Invoice is now fully paid." : `New balance: ₱${data.invoice.newBalance.toFixed(2)}`}`
        )

        // Update invoice data
        setInvoice({
          ...invoice!,
          totalPaid: invoice!.totalPaid + paymentAmount,
          balance: data.invoice.newBalance,
          isFullyPaid: data.invoice.isFullyPaid,
        })

        // Add payment to history
        setPaymentHistory([data.payment, ...paymentHistory])

        // Reset form
        setAmount(data.invoice.newBalance.toFixed(2))
        setReferenceNumber("")

        // If fully paid, redirect after 2 seconds
        if (data.invoice.isFullyPaid) {
          setTimeout(() => {
            router.push("/dashboard/reports/unpaid-invoices")
          }, 2000)
        }
      } else {
        setError(data.error || "Failed to record payment")
      }
    } catch (err: any) {
      setError("An error occurred while recording payment")
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(value)
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error || "Invoice not found"}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Record Customer Payment
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Invoice #{invoice.invoiceNumber}
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start">
          <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 mr-3 mt-0.5" />
          <p className="text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Invoice Summary
            </h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Customer</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {invoice.customer.name}
                </p>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(invoice.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Total Paid:</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(invoice.totalPaid)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    Outstanding Balance:
                  </span>
                  <span className="font-bold text-xl text-red-600 dark:text-red-400">
                    {formatCurrency(invoice.balance)}
                  </span>
                </div>
              </div>

              {invoice.isFullyPaid && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 text-center">
                    ✓ Fully Paid
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Payment History */}
          {paymentHistory.length > 0 && (
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Payment History
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {paymentHistory.map((payment) => (
                  <div
                    key={payment.id}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(payment.amount)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(payment.paidAt)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="capitalize">{payment.paymentMethod.replace("_", " ")}</span>
                      {payment.referenceNumber && (
                        <span className="ml-2">• Ref: {payment.referenceNumber}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Payment Form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Record Payment
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Payment Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500 dark:text-gray-400">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={invoice.balance}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                    disabled={submitting || invoice.isFullyPaid}
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Maximum: {formatCurrency(invoice.balance)}
                </p>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => setPaymentMethod(method.value)}
                        className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-all ${
                          paymentMethod === method.value
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500"
                        }`}
                        disabled={submitting || invoice.isFullyPaid}
                      >
                        <Icon className="h-5 w-5 mr-2" />
                        <span className="text-sm font-medium">{method.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Reference Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reference Number
                  <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">
                    (Optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g., Cheque #, Transaction ID, OR #"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  disabled={submitting || invoice.isFullyPaid}
                />
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                  disabled={submitting || invoice.isFullyPaid}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={submitting || invoice.isFullyPaid}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : invoice.isFullyPaid ? (
                    "Invoice Fully Paid"
                  ) : (
                    "Record Payment"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
