# Technical Service & Warranty Management - Permission Matrix

Quick reference guide showing which roles have which permissions.

## Legend
- ✅ = Has permission
- ❌ = Does not have permission
- 👁️ = View only (limited scope, e.g., "view own")

---

## Serial Number Permissions

| Permission | System Admin | Branch Manager | Tech Service Manager | Technician | Service Cashier | Warranty Inspector | Service Receptionist | Repair QC | Parts Coordinator | Report Viewer |
|-----------|--------------|----------------|---------------------|------------|-----------------|-------------------|---------------------|-----------|------------------|---------------|
| SERIAL_NUMBER_VIEW | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SERIAL_NUMBER_CREATE | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SERIAL_NUMBER_EDIT | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SERIAL_NUMBER_DELETE | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SERIAL_NUMBER_LOOKUP | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| SERIAL_NUMBER_ASSIGN | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SERIAL_NUMBER_TRACK | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| SERIAL_NUMBER_SCAN | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SERIAL_NUMBER_TRANSFER | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Technician Management Permissions

| Permission | System Admin | Branch Manager | Tech Service Manager | Technician | Service Cashier | Warranty Inspector | Service Receptionist | Repair QC | Parts Coordinator | Report Viewer |
|-----------|--------------|----------------|---------------------|------------|-----------------|-------------------|---------------------|-----------|------------------|---------------|
| TECHNICIAN_VIEW | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| TECHNICIAN_CREATE | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| TECHNICIAN_EDIT | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| TECHNICIAN_DELETE | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| TECHNICIAN_ASSIGN | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| TECHNICIAN_PERFORMANCE_VIEW | ✅ | ✅ | ✅ | 👁️ Own | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |

---

## Service Type Permissions

| Permission | System Admin | Branch Manager | Tech Service Manager | Technician | Service Cashier | Warranty Inspector | Service Receptionist | Repair QC | Parts Coordinator | Report Viewer |
|-----------|--------------|----------------|---------------------|------------|-----------------|-------------------|---------------------|-----------|------------------|---------------|
| SERVICE_TYPE_VIEW | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SERVICE_TYPE_CREATE | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SERVICE_TYPE_EDIT | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SERVICE_TYPE_DELETE | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SERVICE_TYPE_PRICING_MANAGE | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Warranty Claim Permissions

| Permission | System Admin | Branch Manager | Tech Service Manager | Technician | Service Cashier | Warranty Inspector | Service Receptionist | Repair QC | Parts Coordinator | Report Viewer |
|-----------|--------------|----------------|---------------------|------------|-----------------|-------------------|---------------------|-----------|------------------|---------------|
| WARRANTY_CLAIM_VIEW | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WARRANTY_CLAIM_VIEW_OWN | ✅ | ✅ | ✅ | 👁️ Own | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| WARRANTY_CLAIM_CREATE | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| WARRANTY_CLAIM_ACCEPT | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| WARRANTY_CLAIM_INSPECT | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| WARRANTY_CLAIM_ASSIGN | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| WARRANTY_CLAIM_APPROVE | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| WARRANTY_CLAIM_REJECT | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| WARRANTY_CLAIM_UPDATE | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| WARRANTY_CLAIM_DELETE | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| WARRANTY_CLAIM_VOID | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Job Order Permissions

| Permission | System Admin | Branch Manager | Tech Service Manager | Technician | Service Cashier | Warranty Inspector | Service Receptionist | Repair QC | Parts Coordinator | Report Viewer |
|-----------|--------------|----------------|---------------------|------------|-----------------|-------------------|---------------------|-----------|------------------|---------------|
| JOB_ORDER_VIEW | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| JOB_ORDER_VIEW_OWN | ✅ | ✅ | ✅ | 👁️ Own | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| JOB_ORDER_CREATE | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| JOB_ORDER_EDIT | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| JOB_ORDER_DELETE | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| JOB_ORDER_DIAGNOSE | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| JOB_ORDER_ADD_PARTS | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| JOB_ORDER_ESTIMATE | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| JOB_ORDER_APPROVE_ESTIMATE | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| JOB_ORDER_START_REPAIR | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| JOB_ORDER_COMPLETE | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| JOB_ORDER_QUALITY_CHECK | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| JOB_ORDER_CLOSE | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| JOB_ORDER_REOPEN | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

---

## Service Payment Permissions

| Permission | System Admin | Branch Manager | Tech Service Manager | Technician | Service Cashier | Warranty Inspector | Service Receptionist | Repair QC | Parts Coordinator | Report Viewer |
|-----------|--------------|----------------|---------------------|------------|-----------------|-------------------|---------------------|-----------|------------------|---------------|
| SERVICE_PAYMENT_VIEW | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| SERVICE_PAYMENT_CREATE | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SERVICE_PAYMENT_VOID | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SERVICE_PAYMENT_REFUND | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SERVICE_RECEIPT_PRINT | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Service Reports & Analytics Permissions

| Permission | System Admin | Branch Manager | Tech Service Manager | Technician | Service Cashier | Warranty Inspector | Service Receptionist | Repair QC | Parts Coordinator | Report Viewer |
|-----------|--------------|----------------|---------------------|------------|-----------------|-------------------|---------------------|-----------|------------------|---------------|
| SERVICE_REPORT_VIEW | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| SERVICE_REPORT_EXPORT | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| SERVICE_WARRANTY_SLIP_VIEW | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| SERVICE_WARRANTY_SLIP_PRINT | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| TECHNICIAN_PERFORMANCE_REPORT | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| REPAIR_ANALYTICS_VIEW | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| SERVICE_REVENUE_REPORT | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| WARRANTY_ANALYTICS_VIEW | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |

---

## Role Permission Summary

| Role | Total Service Permissions | Key Capabilities |
|------|-------------------------|------------------|
| **System Administrator** | 68/68 (100%) | Full access to all technical service operations |
| **Branch Manager** | 60/68 (88%) | Full management except deletes and refunds |
| **Technical Service Manager** | 60/68 (88%) | Complete service center operations |
| **Technician** | 15/68 (22%) | Repair work and job order updates only |
| **Service Cashier** | 18/68 (26%) | Payment processing and warranty slip printing |
| **Warranty Inspector** | 17/68 (25%) | Warranty claim inspection and approval |
| **Service Receptionist** | 19/68 (28%) | Customer reception and job assignment |
| **Repair Quality Inspector** | 13/68 (19%) | Quality control and job closure |
| **Service Parts Coordinator** | 16/68 (24%) | Parts management for repairs |
| **Service Report Viewer** | 13/68 (19%) | Read-only reporting access |

---

## Common Permission Combinations

### Scenario 1: Complete Warranty Claim Processing
Required roles working together:
1. **Service Receptionist** → Creates and accepts claim
2. **Warranty Inspector** → Inspects and approves claim
3. **Service Receptionist** → Assigns to technician
4. **Technician** → Performs repair
5. **Repair Quality Inspector** → QC check and closure
6. **Service Cashier** → Processes payment (if applicable)

### Scenario 2: Repair Job Order Workflow
Required permissions:
1. `JOB_ORDER_CREATE` - Create job
2. `JOB_ORDER_DIAGNOSE` - Document findings
3. `JOB_ORDER_ADD_PARTS` - Add required parts
4. `JOB_ORDER_ESTIMATE` - Quote customer
5. `JOB_ORDER_START_REPAIR` - Begin work
6. `JOB_ORDER_COMPLETE` - Finish repair
7. `JOB_ORDER_QUALITY_CHECK` - QC inspection
8. `JOB_ORDER_CLOSE` - Finalize job

### Scenario 3: Technician Assignment
Required permissions:
1. `TECHNICIAN_VIEW` - See available technicians
2. `WARRANTY_CLAIM_ASSIGN` OR `TECHNICIAN_ASSIGN` - Assign to job
3. `JOB_ORDER_VIEW` - View job details

### Scenario 4: Service Revenue Reporting
Required permissions:
1. `SERVICE_REPORT_VIEW` - Access reports
2. `SERVICE_REVENUE_REPORT` - View revenue data
3. `SERVICE_REPORT_EXPORT` - Export to Excel/PDF

---

## Permission Dependencies

Some permissions require other permissions to be useful:

```
WARRANTY_CLAIM_APPROVE
  └─ Requires: WARRANTY_CLAIM_VIEW
  └─ Requires: WARRANTY_CLAIM_INSPECT (best practice)

JOB_ORDER_COMPLETE
  └─ Requires: JOB_ORDER_VIEW
  └─ Requires: JOB_ORDER_VIEW_OWN (for technicians)

SERVICE_PAYMENT_CREATE
  └─ Requires: JOB_ORDER_VIEW
  └─ Requires: SERVICE_PAYMENT_VIEW

TECHNICIAN_ASSIGN
  └─ Requires: TECHNICIAN_VIEW
  └─ Requires: JOB_ORDER_VIEW or WARRANTY_CLAIM_VIEW
```

---

## Best Practice Role Assignments

### Small Service Center (1-5 technicians)
- **1x Technical Service Manager** - Handles everything
- **2-5x Technician** - Repair work
- **1x Service Cashier** - Payments and reception

### Medium Service Center (6-15 technicians)
- **1x Technical Service Manager** - Overall supervision
- **1x Service Receptionist** - Customer intake
- **1x Warranty Inspector** - Claim approval
- **6-15x Technician** - Repair work
- **1x Repair Quality Inspector** - QC checks
- **1x Service Parts Coordinator** - Parts management
- **1x Service Cashier** - Payment processing

### Large Service Center (15+ technicians)
- **1x Technical Service Manager** - Operations manager
- **2-3x Service Receptionist** - Customer service
- **2x Warranty Inspector** - Claim processing
- **15+x Technician** - Repair specialists
- **2x Repair Quality Inspector** - QC team
- **2x Service Parts Coordinator** - Parts inventory
- **2-3x Service Cashier** - Payment processing
- **1x Service Report Viewer** - Analytics/BI

---

## Quick Reference: Who Can Do What?

### Create Warranty Claim
- System Administrator ✅
- Branch Manager ✅
- Technical Service Manager ✅
- Service Cashier ✅
- Service Receptionist ✅

### Approve Warranty Claim
- System Administrator ✅
- Branch Manager ✅
- Technical Service Manager ✅
- Warranty Inspector ✅

### Assign Technician to Job
- System Administrator ✅
- Branch Manager ✅
- Technical Service Manager ✅
- Service Receptionist ✅

### Perform Repair Work
- System Administrator ✅
- Branch Manager ✅
- Technical Service Manager ✅
- Technician ✅

### Quality Check Repair
- System Administrator ✅
- Branch Manager ✅
- Technical Service Manager ✅
- Repair Quality Inspector ✅

### Process Service Payment
- System Administrator ✅
- Branch Manager ✅
- Technical Service Manager ✅
- Service Cashier ✅

### Add Parts to Job Order
- System Administrator ✅
- Branch Manager ✅
- Technical Service Manager ✅
- Technician ✅
- Service Parts Coordinator ✅

### View Service Reports
- System Administrator ✅
- Branch Manager ✅
- Technical Service Manager ✅
- Service Cashier ✅ (basic)
- Warranty Inspector ✅ (warranty analytics)
- Repair Quality Inspector ✅ (repair analytics)
- Service Report Viewer ✅ (all reports)

---

**Last Updated:** 2025-10-26
**Version:** 1.0
**Related Document:** TECHNICAL_SERVICE_RBAC_IMPLEMENTATION.md
