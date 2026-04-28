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
  deductionType: string | null
  deductionNotes: string | null
}

interface DeductionRow {
  type: string
  amount: string
  notes: string
}

interface ChequeRow {
  number: string
  bank: string
  date: string
  amount: string
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

  // Government deduction state
  const [hasDeductions, setHasDeductions] = useState(false)
  const [deductions, setDeductions] = useState<DeductionRow[]>([
    { type: "ewt", amount: "", notes: "" },
  ])

  // Cheque rows (only used when paymentMethod === 'cheque')
  // Each row tracks one physical cheque so it can be cleared/bounced independently.
  const [cheques, setCheques] = useState<ChequeRow[]>([
    { number: "", bank: "", date: new Date().toISOString().split("T")[0], amount: "" },
  ])

  // Payment methods
  const paymentMethods = [
    { value: "cash", label: "Cash", icon: BanknotesIcon },
    { value: "card", label: "Credit/Debit Card", icon: CreditCardIcon },
    { value: "bank_transfer", label: "Bank Transfer", icon: BanknotesIcon },
    { value: "cheque", label: "Cheque", icon: BanknotesIcon },
    { value: "gcash", label: "GCash", icon: CreditCardIcon },
    { value: "paymaya", label: "PayMaya", icon: CreditCardIcon },
  ]

  // Deduction types
  const deductionTypes = [
    { value: "ewt", label: "EWT (Expanded Withholding Tax)" },
    { value: "vat_withholding", label: "VAT Withholding" },
    { value: "other_gov_deduction", label: "Other Government Deduction" },
  ]

  // Calculate total deductions
  const totalDeductionAmount = hasDeductions
    ? deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
    : 0
  const paymentAmount = parseFloat(amount) || 0
  const totalApplied = paymentAmount + totalDeductionAmount

  // Deduction row helpers
  const addDeductionRow = () => {
    setDeductions([...deductions, { type: "ewt", amount: "", notes: "" }])
  }
  const removeDeductionRow = (index: number) => {
    setDeductions(deductions.filter((_, i) => i !== index))
  }
  const updateDeduction = (index: number, field: keyof DeductionRow, value: string) => {
    const updated = [...deductions]
    updated[index] = { ...updated[index], [field]: value }
    setDeductions(updated)
  }

  // Cheque row helpers
  const addChequeRow = () => {
    setCheques([
      ...cheques,
      { number: "", bank: "", date: new Date().toISOString().split("T")[0], amount: "" },
    ])
  }
  const removeChequeRow = (index: number) => {
    setCheques(cheques.filter((_, i) => i !== index))
  }
  const updateCheque = (index: number, field: keyof ChequeRow, value: string) => {
    const updated = [...cheques]
    updated[index] = { ...updated[index], [field]: value }
    setCheques(updated)
  }

  // Auto-sync the top-level `amount` field with sum of cheque amounts when in cheque mode
  const chequeTotal = cheques.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)
  useEffect(() => {
    if (paymentMethod === "cheque") {
      setAmount(chequeTotal > 0 ? chequeTotal.toFixed(2) : "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chequeTotal, paymentMethod])

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

    // Validate deductions
    const validDeductions = hasDeductions
      ? deductions.filter((d) => parseFloat(d.amount) > 0)
      : []
    const dedTotal = validDeductions.reduce((s, d) => s + parseFloat(d.amount), 0)
    const totalSubmit = paymentAmount + dedTotal

    if (invoice && totalSubmit > invoice.balance + 0.01) {
      setError(
        `Payment (₱${paymentAmount.toFixed(2)}) + Deductions (₱${dedTotal.toFixed(2)}) = ₱${totalSubmit.toFixed(2)} exceeds outstanding balance of ₱${invoice.balance.toFixed(2)}`
      )
      return
    }

    // Cheque-mode validation
    let chequesPayload: { number: string; bank: string | null; date: string; amount: number }[] | undefined
    if (paymentMethod === "cheque") {
      const validCheques = cheques.filter((c) => c.number.trim() !== "" || parseFloat(c.amount) > 0)
      if (validCheques.length === 0) {
        setError("Add at least one cheque with a number and amount")
        return
      }
      for (const c of validCheques) {
        if (!c.number.trim()) {
          setError("Each cheque must have a cheque number")
          return
        }
        const amt = parseFloat(c.amount)
        if (isNaN(amt) || amt <= 0) {
          setError(`Cheque "${c.number}" must have an amount greater than zero`)
          return
        }
      }
      const sumCheques = validCheques.reduce((s, c) => s + parseFloat(c.amount), 0)
      if (Math.abs(sumCheques - paymentAmount) > 0.01) {
        setError(
          `Sum of cheques (₱${sumCheques.toFixed(2)}) must equal payment amount (₱${paymentAmount.toFixed(2)})`
        )
        return
      }
      chequesPayload = validCheques.map((c) => ({
        number: c.number.trim(),
        bank: c.bank.trim() || null,
        date: c.date,
        amount: parseFloat(c.amount),
      }))
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
          deductions: validDeductions.length > 0
            ? validDeductions.map((d) => ({
                type: d.type,
                amount: parseFloat(d.amount),
                notes: d.notes || null,
              }))
            : undefined,
          cheques: chequesPayload,
        }),
      })

      const data = await response.json()

      if (data.success) {
        const dedMsg = dedTotal > 0 ? ` + ₱${dedTotal.toFixed(2)} deductions` : ""
        setSuccess(
          `Payment of ₱${paymentAmount.toFixed(2)}${dedMsg} recorded successfully! ${data.invoice.isFullyPaid ? "Invoice is now fully paid." : `New balance: ₱${data.invoice.newBalance.toFixed(2)}`}`
        )

        // Update invoice data
        setInvoice({
          ...invoice!,
          totalPaid: invoice!.totalPaid + totalSubmit,
          balance: data.invoice.newBalance,
          isFullyPaid: data.invoice.isFullyPaid,
        })

        // Re-fetch payment history to include deduction records
        const histRes = await fetch(`/api/sales/${params.id}/payment`)
        const histData = await histRes.json()
        if (histData.success) {
          setPaymentHistory(histData.payments || [])
        }

        // Reset form
        setAmount(data.invoice.newBalance.toFixed(2))
        setReferenceNumber("")
        setHasDeductions(false)
        setDeductions([{ type: "ewt", amount: "", notes: "" }])
        setCheques([
          { number: "", bank: "", date: new Date().toISOString().split("T")[0], amount: "" },
        ])

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
                {paymentHistory.map((payment) => {
                  const isDeduction = payment.paymentMethod === "government_deduction"
                  return (
                    <div
                      key={payment.id}
                      className={`rounded-lg p-3 border ${
                        isDeduction
                          ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700"
                          : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`font-medium ${isDeduction ? "text-amber-800 dark:text-amber-300" : "text-gray-900 dark:text-white"}`}>
                          {isDeduction ? "−" : ""}{formatCurrency(payment.amount)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(payment.paidAt)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {isDeduction ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            {payment.deductionType === "ewt" ? "EWT" :
                             payment.deductionType === "vat_withholding" ? "VAT Withholding" :
                             "Gov Deduction"}
                          </span>
                        ) : (
                          <span className="capitalize">{payment.paymentMethod.replace("_", " ")}</span>
                        )}
                        {payment.referenceNumber && (
                          <span className="ml-2">• Ref: {payment.referenceNumber}</span>
                        )}
                      </div>
                      {isDeduction && payment.deductionNotes && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{payment.deductionNotes}</p>
                      )}
                    </div>
                  )
                })}
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
                    className={`w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-white ${
                      paymentMethod === "cheque"
                        ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                        : "bg-white dark:bg-gray-700"
                    }`}
                    required
                    readOnly={paymentMethod === "cheque"}
                    disabled={submitting || invoice.isFullyPaid}
                    title={paymentMethod === "cheque" ? "Auto-calculated from cheque rows below" : undefined}
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Maximum: {formatCurrency(invoice.balance)}
                </p>
              </div>

              {/* Government Deductions Toggle */}
              <div className="border border-amber-200 dark:border-amber-800 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-900/10">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasDeductions}
                    onChange={(e) => setHasDeductions(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    disabled={submitting || invoice.isFullyPaid}
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Has Government Deductions (EWT, VAT Withholding, etc.)
                  </span>
                </label>

                {hasDeductions && (
                  <div className="mt-4 space-y-3">
                    {deductions.map((ded, index) => (
                      <div key={index} className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
                        <div className="flex-1 min-w-0">
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
                          <select
                            value={ded.type}
                            onChange={(e) => updateDeduction(index, "type", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            disabled={submitting}
                          >
                            {deductionTypes.map((dt) => (
                              <option key={dt.value} value={dt.value}>{dt.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-full sm:w-32">
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Amount</label>
                          <div className="relative">
                            <span className="absolute left-2 top-2 text-gray-500 text-sm">₱</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={ded.amount}
                              onChange={(e) => updateDeduction(index, "amount", e.target.value)}
                              className="w-full pl-6 pr-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              placeholder="0.00"
                              disabled={submitting}
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Notes</label>
                          <input
                            type="text"
                            value={ded.notes}
                            onChange={(e) => updateDeduction(index, "notes", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            placeholder="e.g., 2% EWT"
                            disabled={submitting}
                          />
                        </div>
                        {deductions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDeductionRow(index)}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm"
                            disabled={submitting}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addDeductionRow}
                      className="text-sm text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium"
                      disabled={submitting}
                    >
                      + Add Another Deduction
                    </button>

                    {/* Deduction Summary */}
                    <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-700 text-sm space-y-1">
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>Actual Payment:</span>
                        <span>{formatCurrency(paymentAmount)}</span>
                      </div>
                      <div className="flex justify-between text-amber-700 dark:text-amber-400">
                        <span>Government Deductions:</span>
                        <span>{formatCurrency(totalDeductionAmount)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-gray-900 dark:text-white pt-1 border-t border-amber-200 dark:border-amber-700">
                        <span>Total Applied to AR:</span>
                        <span>{formatCurrency(totalApplied)}</span>
                      </div>
                    </div>
                  </div>
                )}
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

              {/* Cheque sub-form (only when paymentMethod === 'cheque') */}
              {paymentMethod === "cheque" && (
                <div className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                      Cheque Details <span className="text-red-500">*</span>
                    </h3>
                    <span className="text-xs text-blue-700 dark:text-blue-300">
                      Each cheque is recorded separately for bank deposit tracking
                    </span>
                  </div>

                  <div className="space-y-3">
                    {cheques.map((cq, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white dark:bg-gray-800 p-3 rounded-lg border border-blue-200 dark:border-blue-700"
                      >
                        <div className="sm:col-span-3">
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Cheque # <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={cq.number}
                            onChange={(e) => updateCheque(index, "number", e.target.value)}
                            placeholder="e.g., 0001229252"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            disabled={submitting || invoice.isFullyPaid}
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Bank
                          </label>
                          <input
                            type="text"
                            value={cq.bank}
                            onChange={(e) => updateCheque(index, "bank", e.target.value)}
                            placeholder="e.g., BPI"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            disabled={submitting || invoice.isFullyPaid}
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Cheque Date
                          </label>
                          <input
                            type="date"
                            value={cq.date}
                            onChange={(e) => updateCheque(index, "date", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            disabled={submitting || invoice.isFullyPaid}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Amount <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cq.amount}
                            onChange={(e) => updateCheque(index, "amount", e.target.value)}
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm text-right"
                            disabled={submitting || invoice.isFullyPaid}
                          />
                        </div>
                        <div className="sm:col-span-1 flex items-end">
                          {cheques.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeChequeRow(index)}
                              title="Remove this cheque"
                              className="w-full px-2 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm border border-red-200 dark:border-red-800"
                              disabled={submitting}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addChequeRow}
                      className="text-sm text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                      disabled={submitting || invoice.isFullyPaid}
                    >
                      + Add Another Cheque
                    </button>

                    <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700 flex justify-between text-sm font-semibold text-blue-900 dark:text-blue-200">
                      <span>Total Cheques:</span>
                      <span>{formatCurrency(chequeTotal)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Reference Number — hidden in cheque mode (cheque numbers live on each row) */}
              {paymentMethod !== "cheque" && (
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
                    placeholder="e.g., Transaction ID, OR #"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    disabled={submitting || invoice.isFullyPaid}
                  />
                </div>
              )}

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
