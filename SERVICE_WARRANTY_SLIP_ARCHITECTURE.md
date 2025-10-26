# Service Warranty Slip - System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   Service Warranty Slip System                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌────────────────────────────────────┐
        │        Database Layer              │
        │  (PostgreSQL/MySQL + Prisma ORM)   │
        └────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
    ┌──────────────────────┐    ┌──────────────────────┐
    │  ServiceJobOrder     │    │  ServiceJobPart      │
    │  ────────────────    │    │  ────────────────    │
    │  - Job details       │    │  - Part name         │
    │  - Customer info     │    │  - Quantity          │
    │  - Product info      │    │  - Price             │
    │  - Service details   │◄───┤  - Subtotal          │
    │  - Costs             │    │                      │
    │  - Payment           │    │  Links to:           │
    │  - Warranty terms    │    │  - Product           │
    │  - Status            │    │  - ProductVariation  │
    └──────────────────────┘    └──────────────────────┘
                │
                │ Relations to:
                ├─► Business
                ├─► BusinessLocation
                ├─► Customer
                ├─► User (Technician)
                ├─► User (Quality Checker)
                └─► User (Created By)
                              │
                              ▼
        ┌────────────────────────────────────┐
        │          API Layer                 │
        │  GET /api/reports/service-warranty-│
        │       slip?jobOrderId={id}         │
        └────────────────────────────────────┘
                              │
                              │ Returns:
                              │ - Complete job order
                              │ - All relations
                              │ - Formatted decimals
                              │ - Calculated warranty
                              │
                              ▼
        ┌────────────────────────────────────┐
        │     Presentation Layer             │
        │  ServiceWarrantySlipPrint.tsx      │
        └────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
    ┌──────────────────────┐    ┌──────────────────────┐
    │  Paper Size Selection│    │  Print Formatting    │
    │  ──────────────────  │    │  ──────────────────  │
    │  - 80mm Thermal      │    │  - Professional CSS  │
    │  - A4                │    │  - Responsive        │
    │  - Letter            │    │  - BIR-compliant     │
    │  - Legal             │    │  - Copy type labels  │
    └──────────────────────┘    └──────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   Print Output    │
                    │   ─────────────   │
                    │   - Customer Copy │
                    │   - Office Copy   │
                    │   - Technician    │
                    └───────────────────┘
```

## Data Flow Diagram

```
User Interface
     │
     │ 1. User clicks "Print Warranty Slip"
     ▼
Component State
     │
     │ 2. Set loading state, fetch data
     ▼
API Request
     │
     │ 3. GET /api/reports/service-warranty-slip?jobOrderId=123
     ▼
API Route Handler
     │
     │ 4. Verify authentication
     │ 5. Verify multi-tenant access
     │ 6. Fetch from database
     ▼
Prisma ORM Query
     │
     │ 7. Query ServiceJobOrder with includes:
     │    - business
     │    - location
     │    - customer
     │    - technician
     │    - qualityChecker
     │    - createdByUser
     │    - parts (with product/variation)
     ▼
Database (PostgreSQL/MySQL)
     │
     │ 8. Return complete job order data
     ▼
API Route Handler
     │
     │ 9. Format decimals
     │ 10. Calculate warranty expiry
     │ 11. Return JSON response
     ▼
Component
     │
     │ 12. Update state with job order
     │ 13. Open print dialog
     ▼
ServiceWarrantySlipPrint
     │
     │ 14. Render warranty slip
     │ 15. User selects paper size
     │ 16. User clicks "Print"
     ▼
Print Handler
     │
     │ 17. Open new window
     │ 18. Clone slip content
     │ 19. Apply print-specific CSS
     │ 20. Trigger browser print
     ▼
Browser Print Dialog
     │
     │ 21. User confirms print
     ▼
Physical Printer / PDF Export
```

## Component Hierarchy

```
Page/Container Component
  │
  └─► ServiceWarrantySlipPrint Dialog
       │
       ├─► Dialog Container
       │    │
       │    └─► Print Controls (Hidden on Print)
       │         ├─► Paper Size Buttons (80mm, A4, Letter, Legal)
       │         ├─► Print Button
       │         └─► Close Button
       │
       └─► Warranty Slip Content (Visible on Print)
            │
            ├─► Header Section
            │    ├─► Business Name
            │    ├─► Business Address
            │    └─► Contact Information
            │
            ├─► Document Title
            │    ├─► "SERVICE WARRANTY SLIP"
            │    └─► Copy Type Label
            │
            ├─► Job Order Info
            │    ├─► Job Order Number
            │    ├─► Date
            │    ├─► Status
            │    └─► Service Type
            │
            ├─► Customer Information Section
            │    ├─► Name
            │    ├─► Phone
            │    ├─► Email
            │    └─► Address
            │
            ├─► Product/Device Information Section
            │    ├─► Product Name
            │    ├─► Serial Number
            │    ├─► Purchase Date
            │    └─► Warranty Expiry
            │
            ├─► Problem & Diagnosis Section
            │    ├─► Problem Reported
            │    ├─► Diagnosis Findings
            │    └─► Recommended Action
            │
            ├─► Service Details Section
            │    ├─► Technician
            │    ├─► Date Received
            │    ├─► Estimated Completion
            │    └─► Actual Completion
            │
            ├─► Parts Used Table
            │    └─► For each part:
            │         ├─► Part Name + Description
            │         ├─► Quantity
            │         ├─► Unit Price
            │         └─► Subtotal
            │
            ├─► Cost Breakdown Section
            │    ├─► Labor Cost
            │    ├─► Parts Cost
            │    ├─► Additional Charges
            │    ├─► Subtotal
            │    ├─► Discount (if any)
            │    ├─► Tax (if any)
            │    └─► Grand Total
            │
            ├─► Payment Information Section
            │    ├─► Amount Paid
            │    ├─► Balance Due
            │    ├─► Payment Method
            │    ├─► Payment Date
            │    └─► Received By
            │
            ├─► Service Warranty Terms Section
            │    ├─► Warranty Period
            │    ├─► Conditions
            │    ├─► What's Covered
            │    └─► What's NOT Covered
            │
            ├─► Quality Check Section
            │    ├─► Quality Checked By
            │    └─► Quality Check Date
            │
            ├─► Signature Lines
            │    ├─► Customer Signature + Date
            │    └─► Received By + Date
            │
            └─► Footer
                 ├─► Thank You Message
                 ├─► Warranty Instructions
                 └─► System Attribution
```

## Database Relationships

```
Business (1) ──────┬────────► (N) ServiceJobOrder
                   │
BusinessLocation (1) ──────┬──► (N) ServiceJobOrder
                           │
Customer (1) ──────────────┼──► (N) ServiceJobOrder
                           │
User (Technician) (1) ─────┼──► (N) ServiceJobOrder
User (Quality Checker) (1) ┼──► (N) ServiceJobOrder
User (Created By) (1) ─────┼──► (N) ServiceJobOrder
                           │
ServiceJobOrder (1) ───────┴──► (N) ServiceJobPart
                                      │
                                      ├──► (1) Product
                                      └──► (1) ProductVariation
```

## Multi-Tenant Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Request Layer                          │
└──────────────────────────────────────────────────────────┘
                         │
                         │ NextAuth Session
                         │ Contains: user.businessId
                         ▼
┌──────────────────────────────────────────────────────────┐
│                 Security Layer                           │
│  1. Check authentication                                 │
│  2. Extract businessId from session                      │
│  3. Verify businessId matches requested resource         │
└──────────────────────────────────────────────────────────┘
                         │
                         │ businessId = session.user.businessId
                         ▼
┌──────────────────────────────────────────────────────────┐
│                  Data Layer                              │
│  WHERE businessId = {session.user.businessId}            │
│                                                          │
│  Ensures:                                                │
│  - User 1 (Business A) cannot access Business B data    │
│  - Complete data isolation per tenant                   │
│  - Automatic filtering on all queries                   │
└──────────────────────────────────────────────────────────┘
```

## Status Workflow

```
┌─────────────┐
│   PENDING   │  ◄─── Job Order Created
└──────┬──────┘
       │
       │ Technician assigned
       ▼
┌─────────────┐
│ IN_PROGRESS │  ◄─── Diagnosis, Parts Added
└──────┬──────┘
       │
       │ Repair complete, quality check
       ▼
┌─────────────┐
│  COMPLETED  │  ◄─── Ready for customer
└──────┬──────┘
       │
       │ Customer picks up, signs, pays
       ▼
┌─────────────┐
│  DELIVERED  │  ◄─── Final state
└─────────────┘
       │
       │ Can also be:
       ▼
┌─────────────┐
│  CANCELLED  │  ◄─── If customer cancels
└─────────────┘
```

## Print Flow

```
┌────────────────────────────────────────┐
│  User clicks "Print Warranty Slip"     │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│  Component fetches job order data      │
│  via API                               │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│  Dialog opens with warranty slip       │
└────────────────┬───────────────────────┘
                 │
                 ├─► User selects paper size
                 │   (80mm, A4, Letter, Legal)
                 │
                 ▼
┌────────────────────────────────────────┐
│  User clicks "Print Warranty Slip"     │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│  handlePrint() function:               │
│  1. Opens new window                   │
│  2. Clones slip content                │
│  3. Generates HTML with CSS            │
│  4. Applies paper-size styling         │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│  Browser print dialog appears          │
└────────────────┬───────────────────────┘
                 │
                 ├─► Print to physical printer
                 ├─► Save as PDF
                 └─► Cancel
```

## Paper Size Handling

```
User Selection
     │
     ├─► 80mm Thermal
     │    │
     │    ├─► pageSize: "80mm auto"
     │    ├─► contentWidth: "80mm"
     │    ├─► fontSize: "10px"
     │    ├─► smallFont: "9px"
     │    └─► tinyFont: "8px"
     │
     ├─► A4
     │    │
     │    ├─► pageSize: "A4 portrait"
     │    ├─► contentWidth: "100%"
     │    ├─► fontSize: "14px"
     │    ├─► smallFont: "12px"
     │    └─► tinyFont: "11px"
     │
     ├─► Letter
     │    │
     │    ├─► pageSize: "letter portrait"
     │    ├─► contentWidth: "100%"
     │    ├─► fontSize: "14px"
     │    ├─► smallFont: "12px"
     │    └─► tinyFont: "11px"
     │
     └─► Legal
          │
          ├─► pageSize: "legal portrait"
          ├─► contentWidth: "100%"
          ├─► fontSize: "14px"
          ├─► smallFont: "12px"
          └─► tinyFont: "11px"
```

## Cost Calculation Flow

```
Input Data:
  ├─► Labor Cost
  ├─► Parts Cost (sum of all parts)
  └─► Additional Charges

       │
       ▼
┌──────────────────────┐
│  Subtotal =          │
│  Labor + Parts +     │
│  Additional Charges  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  After Discount =    │
│  Subtotal - Discount │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Grand Total =       │
│  After Discount +    │
│  Tax Amount          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Balance Due =       │
│  Grand Total -       │
│  Amount Paid         │
└──────────────────────┘
```

## Security Layers

```
Layer 1: Authentication
  └─► NextAuth session required
      │
      ▼
Layer 2: Multi-Tenant Isolation
  └─► businessId verification
      │
      ▼
Layer 3: Permission Check (Optional)
  └─► RBAC permission validation
      │
      ▼
Layer 4: Data Access
  └─► Prisma query with businessId filter
      │
      ▼
Layer 5: Response Sanitization
  └─► Return only allowed fields
```

## File Organization

```
ultimatepos-modern/
│
├── prisma/
│   └── schema.prisma ──────────► Database models
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── reports/
│   │   │       └── service-warranty-slip/
│   │   │           └── route.ts ───► API endpoint
│   │   │
│   │   └── dashboard/
│   │       └── service/
│   │           └── example-usage.tsx ───► Usage examples
│   │
│   └── components/
│       └── ServiceWarrantySlipPrint.tsx ───► Print component
│
└── Documentation/
    ├── SERVICE_WARRANTY_SLIP_IMPLEMENTATION.md
    ├── SERVICE_WARRANTY_SLIP_QUICK_START.md
    ├── SERVICE_WARRANTY_SLIP_SUMMARY.md
    └── SERVICE_WARRANTY_SLIP_ARCHITECTURE.md (this file)
```

## Technology Stack

```
┌─────────────────────────────────────────┐
│         Frontend (React)                │
│  - Next.js 15 (App Router)              │
│  - TypeScript                           │
│  - Tailwind CSS                         │
│  - Shadcn UI Components                 │
└────────────┬────────────────────────────┘
             │
             │ HTTP/REST
             ▼
┌─────────────────────────────────────────┐
│        Backend (Next.js API)            │
│  - Route Handlers                       │
│  - NextAuth (Authentication)            │
│  - Session Management                   │
└────────────┬────────────────────────────┘
             │
             │ Prisma ORM
             ▼
┌─────────────────────────────────────────┐
│       Database (PostgreSQL/MySQL)       │
│  - ServiceJobOrder table                │
│  - ServiceJobPart table                 │
│  - Related tables (User, Business, etc) │
└─────────────────────────────────────────┘
```

## Integration Points

```
Service Warranty Slip System
            │
            ├──► Inventory Management
            │     └─► Parts tracking
            │         └─► Auto-deduct inventory
            │
            ├──► Customer Management
            │     └─► Customer records
            │         └─► Service history
            │
            ├──► Financial Management
            │     └─► Revenue tracking
            │         └─► Cost analysis
            │
            ├──► User Management
            │     └─► Technician assignment
            │         └─► Performance tracking
            │
            └──► Accounting Module
                  └─► Journal entries
                      └─► Financial statements
```

## Future Architecture Enhancements

```
Current State                Future Enhancements
     │                              │
     ├─► Print Component      ─────►├─► Email Service
     │                              ├─► SMS Notifications
     │                              ├─► Customer Portal
     │                              ├─► Photo Upload (S3)
     │                              ├─► Signature Capture
     │                              └─► QR Code Generation
     │
     ├─► API Route            ─────►├─► GraphQL API
     │                              ├─► Webhook Support
     │                              └─► Real-time Updates
     │
     └─► Database             ─────►├─► Full-text Search
                                    ├─► Analytics Views
                                    └─► Data Warehousing
```

This architecture provides a solid foundation for a production-ready Service Warranty Slip system with room for future growth and enhancements.
