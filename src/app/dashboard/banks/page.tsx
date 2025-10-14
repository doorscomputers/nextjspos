"use client"

import { useState, useEffect } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline"
import { useToast } from "@/hooks/use-toast"

interface Bank {
  id: number
  bankName: string
  accountType: string
  accountNumber: string
  openingBalance: string
  openingBalanceDate: string | null
  currentBalance: string
  isActive: boolean
  notes: string | null
}

export default function BanksPage() {
  const { can } = usePermissions()
  const { toast } = useToast()

  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingBank, setEditingBank] = useState<Bank | null>(null)

  // Form state
  const [bankName, setBankName] = useState("")
  const [accountType, setAccountType] = useState("savings")
  const [accountNumber, setAccountNumber] = useState("")
  const [openingBalance, setOpeningBalance] = useState("0")
  const [openingBalanceDate, setOpeningBalanceDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [notes, setNotes] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchBanks()
  }, [])

  const fetchBanks = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/banks")
      if (response.ok) {
        const data = await response.json()
        setBanks(data)
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

  const resetForm = () => {
    setBankName("")
    setAccountType("savings")
    setAccountNumber("")
    setOpeningBalance("0")
    setOpeningBalanceDate(new Date().toISOString().split("T")[0])
    setNotes("")
    setIsActive(true)
    setEditingBank(null)
  }

  const handleOpenDialog = (bank?: Bank) => {
    if (bank) {
      setEditingBank(bank)
      setBankName(bank.bankName)
      setAccountType(bank.accountType)
      setAccountNumber(bank.accountNumber)
      setOpeningBalance(bank.openingBalance)
      setOpeningBalanceDate(
        bank.openingBalanceDate
          ? new Date(bank.openingBalanceDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      )
      setNotes(bank.notes || "")
      setIsActive(bank.isActive)
    } else {
      resetForm()
    }
    setShowDialog(true)
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const payload = {
        bankName,
        accountType,
        accountNumber,
        openingBalance: parseFloat(openingBalance),
        openingBalanceDate,
        notes: notes.trim() || null,
        isActive,
      }

      let response
      if (editingBank) {
        // Update
        response = await fetch(`/api/banks/${editingBank.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        // Create
        response = await fetch("/api/banks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (response.ok) {
        toast({
          title: "Success",
          description: `Bank ${editingBank ? "updated" : "created"} successfully`,
        })
        handleCloseDialog()
        fetchBanks()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to save bank",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving bank:", error)
      toast({
        title: "Error",
        description: "Failed to save bank",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (bank: Bank) => {
    if (
      !confirm(
        `Are you sure you want to delete ${bank.bankName} - ${bank.accountNumber}?`
      )
    ) {
      return
    }

    try {
      const response = await fetch(`/api/banks/${bank.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Bank deleted successfully",
        })
        fetchBanks()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to delete bank",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting bank:", error)
      toast({
        title: "Error",
        description: "Failed to delete bank",
        variant: "destructive",
      })
    }
  }

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case "savings":
        return "Savings Account"
      case "cheque":
        return "Cheque Account"
      case "credit_card":
        return "Credit Card"
      default:
        return type
    }
  }

  if (!can(PERMISSIONS.BANK_VIEW)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-500">
              You do not have permission to view banks.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Bank Accounts
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your business bank accounts and track balances
          </p>
        </div>
        {can(PERMISSIONS.BANK_CREATE) && (
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-green-600 hover:bg-green-700 text-white font-bold border-2 border-green-700 shadow-md"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Add Bank Account
          </Button>
        )}
      </div>

      {/* Banks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bank Accounts</CardTitle>
          <CardDescription>
            List of all bank accounts for your business
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">Loading banks...</p>
            </div>
          ) : banks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">
                No bank accounts found. Add your first bank account to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank Name</TableHead>
                    <TableHead>Account Type</TableHead>
                    <TableHead>Account Number</TableHead>
                    <TableHead className="text-right">Opening Balance</TableHead>
                    <TableHead className="text-right">Current Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banks.map((bank) => (
                    <TableRow key={bank.id}>
                      <TableCell className="font-medium">{bank.bankName}</TableCell>
                      <TableCell>{getAccountTypeLabel(bank.accountType)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {bank.accountNumber}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(bank.openingBalance)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(bank.currentBalance)}
                      </TableCell>
                      <TableCell>
                        {bank.isActive ? (
                          <Badge variant="default" className="bg-green-500">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {can(PERMISSIONS.BANK_UPDATE) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDialog(bank)}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold border-2 border-blue-700"
                            >
                              <PencilIcon className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                          )}
                          {can(PERMISSIONS.BANK_DELETE) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(bank)}
                              className="bg-red-600 hover:bg-red-700 text-white font-semibold border-2 border-red-700"
                            >
                              <TrashIcon className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingBank ? "Edit Bank Account" : "Add Bank Account"}
              </DialogTitle>
              <DialogDescription>
                {editingBank
                  ? "Update bank account details"
                  : "Enter bank account details below"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">
                    Bank Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="bankName"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g., Bank of the Philippine Islands"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountType">
                    Account Type <span className="text-red-500">*</span>
                  </Label>
                  <Select value={accountType} onValueChange={setAccountType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Savings Account</SelectItem>
                      <SelectItem value="cheque">Cheque Account</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountNumber">
                  Account Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="accountNumber"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g., 1234-5678-9012"
                  required
                  disabled={!!editingBank} // Cannot change account number when editing
                />
                {editingBank && (
                  <p className="text-xs text-gray-500">
                    Account number cannot be changed
                  </p>
                )}
              </div>

              {!editingBank && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="openingBalance">Opening Balance</Label>
                      <Input
                        id="openingBalance"
                        type="number"
                        step="0.01"
                        value={openingBalance}
                        onChange={(e) => setOpeningBalance(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="openingBalanceDate">
                        Opening Balance Date
                      </Label>
                      <Input
                        id="openingBalanceDate"
                        type="date"
                        value={openingBalanceDate}
                        onChange={(e) => setOpeningBalanceDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Opening balance will be recorded as the initial bank transaction
                  </p>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes about this account..."
                  rows={3}
                />
              </div>

              {editingBank && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="isActive" className="cursor-pointer">
                    Account is active
                  </Label>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={submitting}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-bold border-2 border-gray-400 shadow-md dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white dark:border-gray-500"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold border-2 border-blue-700 shadow-md disabled:bg-gray-400"
              >
                {submitting
                  ? "Saving..."
                  : editingBank
                  ? "Update Bank"
                  : "Add Bank"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
