"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { formatCurrency } from "@/lib/currencyUtils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import { useToast } from "@/hooks/use-toast"

interface Bank {
  id: number
  bankName: string
  accountNumber: string
  currentBalance: string
}

export default function ManualBankTransactionPage() {
  const router = useRouter()
  const { can } = usePermissions()
  const { toast } = useToast()

  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [bankId, setBankId] = useState("")
  const [transactionType, setTransactionType] = useState<"debit" | "credit">("debit")
  const [amount, setAmount] = useState("")
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [transactionNumber, setTransactionNumber] = useState("")
  const [description, setDescription] = useState("")

  useEffect(() => {
    fetchBanks()
  }, [])

  const fetchBanks = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/banks")
      if (response.ok) {
        const data = await response.json()
        setBanks(data.filter((bank: Bank) => bank.isActive))
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch banks",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching banks:", error)
      toast({
        title: "Error",
        description: "Failed to fetch banks",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Validation
      if (!bankId) {
        toast({
          title: "Validation Error",
          description: "Please select a bank account",
          variant: "destructive",
        })
        setSubmitting(false)
        return
      }

      if (!amount || parseFloat(amount) <= 0) {
        toast({
          title: "Validation Error",
          description: "Please enter a valid amount",
          variant: "destructive",
        })
        setSubmitting(false)
        return
      }

      // Prepare payload
      // Debit = negative amount (money out), Credit = positive amount (money in)
      const finalAmount = transactionType === "debit"
        ? -Math.abs(parseFloat(amount))
        : Math.abs(parseFloat(amount))

      const payload = {
        bankId: parseInt(bankId),
        transactionType: transactionType === "debit" ? "manual_debit" : "manual_credit",
        amount: finalAmount,
        transactionDate,
        transactionNumber: transactionNumber.trim() || null,
        description: description.trim() || null,
      }

      const response = await fetch("/api/bank-transactions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Bank transaction created successfully",
        })
        router.push("/dashboard/bank-transactions")
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to create transaction",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating transaction:", error)
      toast({
        title: "Error",
        description: "Failed to create transaction",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const selectedBank = banks.find((b) => b.id === parseInt(bankId))

  if (!can(PERMISSIONS.BANK_TRANSACTION_CREATE)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-500">
              You do not have permission to create bank transactions.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Add Manual Bank Transaction
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Record a debit or credit transaction for bank reconciliation
          </p>
        </div>
      </div>

      {banks.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-600 dark:text-gray-400">
              No active bank accounts found. Please add a bank account first.
            </p>
            <Button
              className="mt-4"
              onClick={() => router.push("/dashboard/banks")}
            >
              Go to Banks
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Transaction Details</CardTitle>
                <CardDescription>
                  Enter the transaction information below
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Bank Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="bankId">
                      Bank Account <span className="text-red-500">*</span>
                    </Label>
                    <Select value={bankId} onValueChange={setBankId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bank account" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((bank) => (
                          <SelectItem key={bank.id} value={bank.id.toString()}>
                            {bank.bankName} - {bank.accountNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Transaction Type */}
                  <div className="space-y-2">
                    <Label>
                      Transaction Type <span className="text-red-500">*</span>
                    </Label>
                    <RadioGroup
                      value={transactionType}
                      onValueChange={(value) =>
                        setTransactionType(value as "debit" | "credit")
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="debit" id="debit" />
                        <Label htmlFor="debit" className="cursor-pointer font-normal">
                          Debit (Money Out)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="credit" id="credit" />
                        <Label htmlFor="credit" className="cursor-pointer font-normal">
                          Credit (Money In)
                        </Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-gray-500">
                      {transactionType === "debit"
                        ? "Select Debit to record money going out of the account (expenses, withdrawals)"
                        : "Select Credit to record money coming into the account (deposits, receipts)"}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <Label htmlFor="amount">
                      Amount <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  {/* Transaction Date */}
                  <div className="space-y-2">
                    <Label htmlFor="transactionDate">
                      Transaction Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="transactionDate"
                      type="date"
                      value={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                      required
                    />
                  </div>

                  {/* Transaction Number */}
                  <div className="space-y-2">
                    <Label htmlFor="transactionNumber">
                      Reference/Transaction Number
                    </Label>
                    <Input
                      id="transactionNumber"
                      value={transactionNumber}
                      onChange={(e) => setTransactionNumber(e.target.value)}
                      placeholder="e.g., CHQ-12345, REF-67890"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter transaction description..."
                      rows={3}
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.back()}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Creating..." : "Create Transaction"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Transaction Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedBank && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Bank Account</p>
                    <p className="font-semibold">{selectedBank.bankName}</p>
                    <p className="text-sm font-mono">{selectedBank.accountNumber}</p>
                  </div>
                )}

                {selectedBank && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Current Balance</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(selectedBank.currentBalance)}
                    </p>
                  </div>
                )}

                {amount && parseFloat(amount) > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {transactionType === "debit" ? "Debit Amount" : "Credit Amount"}
                    </p>
                    <p className={`text-2xl font-bold ${transactionType === "debit" ? "text-red-600" : "text-green-600"}`}>
                      {transactionType === "debit" ? "-" : "+"}
                      {formatCurrency(amount)}
                    </p>
                  </div>
                )}

                {selectedBank && amount && parseFloat(amount) > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-gray-600 dark:text-gray-400">New Balance</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(
                        parseFloat(selectedBank.currentBalance) +
                        (transactionType === "debit"
                          ? -parseFloat(amount)
                          : parseFloat(amount))
                      )}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <p className="text-xs text-gray-500">
                    This transaction will be recorded as a{" "}
                    <span className="font-semibold">
                      {transactionType === "debit" ? "manual debit" : "manual credit"}
                    </span>{" "}
                    for bank reconciliation purposes.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
