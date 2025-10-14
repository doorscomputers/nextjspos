# Cheque Book Management System - Complete Specification

## 🎯 Business Requirements

### Problem Statement:
**Current Issue:** No way to track which cheque numbers are available, issued, cleared, or bounced. Suppliers claim non-payment but system shows payment issued. No tracking of post-dated cheques for maturity notifications.

### Solution: Complete Cheque Book Management System

---

## 📚 Database Schema Updates Needed

### 1. **ChequeBook Model** (NEW)
```prisma
model ChequeBook {
  id         Int @id @default(autoincrement())
  businessId Int @map("business_id")
  bankId     Int @map("bank_id")
  bank       Bank @relation(fields: [bankId], references: [id])

  // Cheque book details
  bookNumber      String   @map("book_number") @db.VarChar(50)
  startChequeNo   String   @map("start_cheque_no") @db.VarChar(20)
  endChequeNo     String   @map("end_cheque_no") @db.VarChar(20)
  totalCheques    Int      @map("total_cheques")
  issuedCheques   Int      @default(0) @map("issued_cheques")
  availableCheques Int     @map("available_cheques")

  // Status
  isActive Boolean @default(true) @map("is_active")
  notes    String? @db.Text

  // Timestamps
  receivedDate DateTime  @map("received_date") @db.Date
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")

  // Relations
  cheques Cheque[]

  @@index([businessId])
  @@index([bankId])
  @@map("cheque_books")
}
```

### 2. **Cheque Model** (NEW) - Individual Cheque Tracking
```prisma
model Cheque {
  id           Int @id @default(autoincrement())
  businessId   Int @map("business_id")
  chequeBookId Int @map("cheque_book_id")
  chequeBook   ChequeBook @relation(fields: [chequeBookId], references: [id])
  bankId       Int @map("bank_id")
  bank         Bank @relation(fields: [bankId], references: [id])

  // Cheque details
  chequeNumber String @unique @map("cheque_number") @db.VarChar(20)
  chequeDate   DateTime @map("cheque_date") @db.Date
  amount       Decimal  @db.Decimal(22, 4)

  // Status tracking
  status String @map("status") @db.VarChar(20)
  // Values: "available", "issued", "cleared", "bounced", "cancelled", "void", "stolen"

  statusDate    DateTime? @map("status_date") @db.Date
  clearedDate   DateTime? @map("cleared_date") @db.Date
  bouncedReason String?   @map("bounced_reason") @db.Text
  statusNotes   String?   @map("status_notes") @db.Text

  // Payment linkage
  paymentId Int? @map("payment_id")
  payment   Payment? @relation(fields: [paymentId], references: [id])

  // Payee information
  payeeName       String? @map("payee_name") @db.VarChar(255)
  payeeType       String? @map("payee_type") @db.VarChar(20) // supplier, employee, other
  supplierId      Int?    @map("supplier_id")
  accountsPayableId Int?  @map("accounts_payable_id")

  // Post-dated cheque tracking
  isPostDated       Boolean   @default(false) @map("is_post_dated")
  maturityDate      DateTime? @map("maturity_date") @db.Date
  reminderSent      Boolean   @default(false) @map("reminder_sent")
  reminderSentDate  DateTime? @map("reminder_sent_date")

  // Timestamps
  issuedDate DateTime? @map("issued_date") @db.Date
  createdBy  Int       @map("created_by")
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")
  deletedAt  DateTime? @map("deleted_at")

  @@index([businessId])
  @@index([chequeBookId])
  @@index([bankId])
  @@index([status])
  @@index([chequeNumber])
  @@map("cheques")
}
```

### 3. **Update Payment Model**
```prisma
model Payment {
  // ... existing fields ...

  chequeId     Int?    @map("cheque_id")
  cheque       Cheque? @relation(fields: [chequeId], references: [id])

  // Keep existing for backwards compatibility
  chequeNumber String? @map("cheque_number")
  chequeDate   DateTime? @map("cheque_date") @db.Date
  chequeStatus String? @default("issued") @map("cheque_status")
  chequeStatusDate DateTime? @map("cheque_status_date")
}
```

---

## 🖥️ UI Components Needed

### 1. **Cheque Book Management Page** (`/dashboard/cheque-books`)

**Features:**
- List all cheque books by bank account
- Add new cheque book (with start/end numbers)
- View available vs issued cheques count
- Activate/deactivate cheque books
- Filter by bank, status (active/depleted)

**Table Columns:**
- Bank Name
- Book Number
- Cheque Range (Start - End)
- Total Cheques
- Issued
- Available
- Status
- Actions (Edit, Deactivate, View Cheques)

**Add Cheque Book Form:**
```tsx
- Select Bank Account *
- Book Number
- Start Cheque Number *
- End Cheque Number *
- Total Cheques (auto-calculated)
- Received Date *
- Notes
```

---

### 2. **Cheque Register Page** (`/dashboard/cheque-register`)

**Purpose:** View all cheques with their current status

**Features:**
- List all cheques with filters
- Update cheque status
- Search by cheque number, payee
- Filter by:
  - Bank Account
  - Status (Available, Issued, Cleared, Bounced, etc.)
  - Date Range
  - Post-Dated only

**Table Columns:**
- Cheque Number
- Bank
- Cheque Date
- Payee
- Amount
- Status (with color badges)
- Issued Date
- Cleared/Bounced Date
- Actions (Update Status, View Details)

**Status Color Coding:**
- 🟢 **Available** - Green
- 🔵 **Issued** - Blue
- ✅ **Cleared** - Green with checkmark
- 🔴 **Bounced** - Red
- ⚫ **Cancelled** - Gray
- 🟣 **Void** - Purple
- 🟠 **Stolen** - Orange alert

---

### 3. **Payment Form Updates**

**When Cheque Payment Method Selected:**

```tsx
// Show bank selection
<Select bankAccount>
  {banks.map(bank => (
    <option>
      {bank.name} - Balance: {bank.currentBalance}
    </option>
  ))}
</Select>

// Auto-suggest next available cheque number
<Input chequeNumber>
  <button>Get Next Available</button>
</Input>

// Validation on blur
if (chequeNumber entered) {
  const cheque = await checkChequeStatus(chequeNumber, bankId)
  if (cheque.status !== 'available') {
    showError(`Cheque ${chequeNumber} is already ${cheque.status}!`)
    // Show details: Issued to {payee} on {date} for {amount}
  }
}

// Show warning if cheque out of range
if (chequeNumber < startNo || chequeNumber > endNo) {
  showWarning('Cheque number not in any active cheque book')
}

// Post-dated cheque checkbox
<Checkbox isPostDated>
  {checked && (
    <DatePicker maturityDate />
  )}
</Checkbox>
```

---

### 4. **Post-Dated Cheques Dashboard Widget**

**Location:** Main Dashboard

**Display:**
- Count of PDCs maturing in:
  - Today
  - This Week
  - This Month
- List of upcoming maturities
- Alert icon for cheques maturing today

**Click Action:** Navigate to PDC report filtered by date range

---

### 5. **Cheque Status Update Modal**

**Trigger:** From Cheque Register or Payments list

**Form Fields:**
```tsx
Current Status: {current}

New Status *:
- Cleared
- Bounced
- Cancelled
- Void
- Stolen

Status Date *: [date picker]

{status === 'cleared' && (
  <DatePicker clearedDate />
)}

{status === 'bounced' && (
  <>
    <Select bouncedReason>
      - Insufficient Funds
      - Account Closed
      - Signature Mismatch
      - Stop Payment
      - Other
    </Select>
    <Textarea bouncedNotes />
    <Checkbox reversePayment>
      Reverse Accounts Payable entry
    </Checkbox>
  </>
)}

{status === 'cancelled' && (
  <Textarea cancellationReason />
)}

Notes: [textarea]
```

---

## 📊 Reports Required

### 1. **Cheque Register Report**
- All cheques by status
- Group by bank account
- Filter by date range, status
- Export to Excel/PDF

### 2. **Outstanding Cheques Report**
- All issued but not cleared cheques
- Age analysis (how long outstanding)
- Group by supplier
- Total amount outstanding

### 3. **Bounced Cheques Report**
- All bounced cheques
- Reason for bounce
- Action taken (reversed, reissued)
- Supplier-wise summary

### 4. **Post-Dated Cheques Report**
- All PDCs by maturity date
- Maturing this week/month
- Alert for overdue PDCs
- Notification status

### 5. **Cheque Book Utilization Report**
- Books by bank account
- % utilized
- Depleted books
- Reorder suggestions

### 6. **Bank Reconciliation Report**
- Issued cheques
- Cleared cheques
- Outstanding cheques
- Match with bank statement

---

## 🔔 Notification & Alert System

### **Notification Types:**

1. **Post-Dated Cheque Maturity Alerts**
   - 7 days before: "Cheque #123 matures in 7 days"
   - 3 days before: "Cheque #123 matures in 3 days"
   - On maturity day: "Cheque #123 matures TODAY"
   - 1 day overdue: "Cheque #123 is 1 day overdue"

2. **Cheque Book Depletion Alerts**
   - 90% utilized: "Cheque book nearing end - 10 cheques left"
   - 100% utilized: "Cheque book depleted - order new book"

3. **Bounced Cheque Alert**
   - Immediate notification when marked as bounced
   - Email/SMS to relevant users
   - Dashboard banner alert

4. **Duplicate Cheque Number Alert**
   - When trying to issue already-used cheque number
   - Shows existing cheque details

---

## ⚙️ Business Logic & Validation

### **When Recording Payment with Cheque:**

```typescript
// 1. Validate bank has sufficient balance
if (bank.currentBalance < paymentAmount) {
  throw new Error('Insufficient funds')
}

// 2. Validate cheque number is available
const existingCheque = await prisma.cheque.findUnique({
  where: { chequeNumber }
})

if (existingCheque && existingCheque.status !== 'available') {
  throw new Error(
    `Cheque ${chequeNumber} is ${existingCheque.status}. ` +
    `Issued to ${existingCheque.payeeName} on ${existingCheque.issuedDate}`
  )
}

// 3. Validate cheque is in an active book
const chequeBook = await prisma.chequeBook.findFirst({
  where: {
    bankId,
    isActive: true,
    startChequeNo: { lte: chequeNumber },
    endChequeNo: { gte: chequeNumber }
  }
})

if (!chequeBook) {
  showWarning('Cheque number not in any active cheque book')
  // Allow but warn
}

// 4. Create or update cheque record
if (!existingCheque) {
  await prisma.cheque.create({
    data: {
      chequeNumber,
      chequeBookId: chequeBook.id,
      bankId,
      chequeDate,
      amount: paymentAmount,
      status: 'issued',
      issuedDate: new Date(),
      isPostDated: isPostDated,
      maturityDate: isPostDated ? maturityDate : null,
      payeeName: supplier.name,
      payeeType: 'supplier',
      supplierId: supplier.id,
      accountsPayableId: apId,
      createdBy: user.id
    }
  })
} else {
  await prisma.cheque.update({
    where: { id: existingCheque.id },
    data: {
      status: 'issued',
      issuedDate: new Date(),
      // ... other fields
    }
  })
}

// 5. Update cheque book counts
await prisma.chequeBook.update({
  where: { id: chequeBook.id },
  data: {
    issuedCheques: { increment: 1 },
    availableCheques: { decrement: 1 }
  }
})

// 6. Update bank balance
await prisma.bank.update({
  where: { id: bankId },
  data: {
    currentBalance: { decrement: paymentAmount }
  }
})

// 7. Link cheque to payment
await prisma.payment.create({
  data: {
    // ... payment fields
    chequeId: cheque.id,
    chequeNumber: chequeNumber,
    chequeDate: chequeDate,
    chequeStatus: 'issued'
  }
})
```

---

## 🚀 Implementation Priority

### **Phase 1: Foundation** (Immediate)
1. ✅ Add ChequeBook and Cheque models to schema
2. ✅ Run migration
3. ✅ Create Cheque Book Management page
4. ✅ Add "Get Next Available Cheque" function

### **Phase 2: Payment Integration** (Critical)
5. ✅ Update payment form with cheque validation
6. ✅ Add bank balance check
7. ✅ Link payments to cheque records
8. ✅ Auto-create/update cheque status on payment

### **Phase 3: Status Management**
9. ✅ Create Cheque Register page
10. ✅ Add status update modal
11. ✅ Implement bounced cheque reversal logic
12. ✅ Add cheque history audit trail

### **Phase 4: Reporting**
13. ✅ Outstanding Cheques Report
14. ✅ Bounced Cheques Report
15. ✅ Post-Dated Cheques Report
16. ✅ Bank Reconciliation Report

### **Phase 5: Notifications**
17. ✅ Dashboard PDC widget
18. ✅ Maturity date reminders (daily cron job)
19. ✅ Cheque book depletion alerts
20. ✅ Bounced cheque alerts

---

## 📋 Testing Scenarios

### **Scenario 1: Add New Cheque Book**
- [ ] Add cheque book for BPI Cheque Account
- [ ] Range: 100001 to 100050 (50 cheques)
- [ ] Verify all 50 cheques created with status "available"

### **Scenario 2: Issue Cheque Payment**
- [ ] Select cheque payment method
- [ ] Click "Get Next Available" → Should suggest 100001
- [ ] Enter amount 10,000
- [ ] Record payment
- [ ] Verify cheque status changed to "issued"
- [ ] Verify cheque book counts updated (49 available, 1 issued)
- [ ] Verify bank balance reduced by 10,000

### **Scenario 3: Duplicate Cheque Prevention**
- [ ] Try to issue cheque 100001 again
- [ ] Should show error: "Cheque 100001 is issued to ABC Supplier"
- [ ] Payment should be blocked

### **Scenario 4: Post-Dated Cheque**
- [ ] Issue cheque 100002 as post-dated (maturity: +30 days)
- [ ] Verify notification scheduled
- [ ] Check dashboard widget shows PDC count
- [ ] Advance date to maturity → verify alert appears

### **Scenario 5: Bounced Cheque**
- [ ] Mark cheque 100001 as bounced
- [ ] Select reason: "Insufficient Funds"
- [ ] Check "Reverse AP" checkbox
- [ ] Verify AP balance restored
- [ ] Verify bank balance updated
- [ ] Verify cheque status = "bounced"
- [ ] Verify notification sent

### **Scenario 6: Clear Cheque**
- [ ] Mark cheque 100002 as cleared
- [ ] Enter cleared date
- [ ] Verify status = "cleared"
- [ ] Verify removed from outstanding report

### **Scenario 7: Cheque Book Depletion**
- [ ] Issue all 50 cheques from book
- [ ] Verify alert: "Cheque book depleted"
- [ ] Verify book marked inactive or flagged

---

## 💡 Additional Features (Future Enhancement)

1. **Cheque Printing**
   - Print cheque from system
   - Pre-filled with amount, payee, date

2. **OCR Cheque Scanning**
   - Scan physical cheque image
   - Auto-extract cheque number, date, amount

3. **Bank Statement Import**
   - Upload bank statement CSV
   - Auto-match cleared cheques

4. **Stop Payment Tracking**
   - Record stop payment requests
   - Alert if stopped cheque tries to clear

5. **Cheque Batch Processing**
   - Issue multiple cheques at once
   - Print batch of cheques

---

**This comprehensive cheque management system will solve all your tracking, verification, and reconciliation needs!**
