# Technical Service & Warranty Management - Quick Start Guide

## Implementation Status: SCHEMA COMPLETE ✓

The database schema for the Technical Service & Warranty Management System is fully implemented and ready for UI development.

## Verified Components

- ✓ 7 new database models created
- ✓ Relations added to 8 existing models
- ✓ Prisma Client generated successfully
- ✓ Database tables created in PostgreSQL
- ✓ All tables accessible and ready for data
- ✓ Multi-tenant architecture maintained

## Quick Start - Building Your First Feature

### Step 1: Create Repair Service Types (Foundation)

This is the easiest starting point - no complex relations needed.

**File: `src/app/api/service/service-types/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceTypes = await prisma.repairServiceType.findMany({
      where: {
        businessId: session.user.businessId,
        isActive: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(serviceTypes);
  } catch (error) {
    console.error('Error fetching service types:', error);
    return NextResponse.json(
      { error: "Failed to fetch service types" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();

    // Generate unique code if not provided
    if (!data.code) {
      const count = await prisma.repairServiceType.count({
        where: { businessId: session.user.businessId }
      });
      data.code = `SRV-${String(count + 1).padStart(4, '0')}`;
    }

    const serviceType = await prisma.repairServiceType.create({
      data: {
        businessId: session.user.businessId,
        code: data.code,
        name: data.name,
        description: data.description,
        category: data.category,
        standardPrice: data.standardPrice || 0,
        laborCostPerHour: data.laborCostPerHour || 0,
        estimatedHours: data.estimatedHours || 1,
        warrantyPeriodDays: data.warrantyPeriodDays || 30,
        isCoveredByWarranty: data.isCoveredByWarranty || false,
        isActive: true
      }
    });

    return NextResponse.json(serviceType, { status: 201 });
  } catch (error) {
    console.error('Error creating service type:', error);
    return NextResponse.json(
      { error: "Failed to create service type" },
      { status: 500 }
    );
  }
}
```

**File: `src/app/dashboard/service/service-types/page.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import DataGrid, {
  Column,
  Editing,
  Paging,
  FilterRow,
  HeaderFilter,
  Export,
  Toolbar,
  Item
} from "devextreme-react/data-grid";
import { Button } from "devextreme-react/button";
import { usePermissions } from "@/hooks/usePermissions";

export default function ServiceTypesPage() {
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { can } = usePermissions();

  useEffect(() => {
    fetchServiceTypes();
  }, []);

  const fetchServiceTypes = async () => {
    try {
      const response = await fetch('/api/service/service-types');
      const data = await response.json();
      setServiceTypes(data);
    } catch (error) {
      console.error('Error fetching service types:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRowInserting = async (e: any) => {
    try {
      const response = await fetch('/api/service/service-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e.data)
      });

      if (response.ok) {
        const newServiceType = await response.json();
        e.data.id = newServiceType.id;
        e.data.code = newServiceType.code;
      } else {
        e.cancel = true;
      }
    } catch (error) {
      console.error('Error creating service type:', error);
      e.cancel = true;
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Repair Service Types</h1>

      <DataGrid
        dataSource={serviceTypes}
        showBorders={true}
        columnAutoWidth={true}
        onRowInserting={onRowInserting}
      >
        <Editing
          mode="popup"
          allowAdding={can('TECHNICAL_SERVICE_CREATE')}
          allowUpdating={can('TECHNICAL_SERVICE_EDIT')}
          allowDeleting={can('TECHNICAL_SERVICE_DELETE')}
        />
        <Paging defaultPageSize={20} />
        <FilterRow visible={true} />
        <HeaderFilter visible={true} />
        <Export enabled={true} allowExportSelectedData={true} />

        <Column dataField="code" caption="Code" width={120} />
        <Column dataField="name" caption="Service Name" />
        <Column dataField="category" caption="Category" />
        <Column dataField="standardPrice" caption="Standard Price" format="currency" />
        <Column dataField="laborCostPerHour" caption="Labor Cost/Hour" format="currency" />
        <Column dataField="estimatedHours" caption="Est. Hours" />
        <Column dataField="warrantyPeriodDays" caption="Warranty Days" />
        <Column dataField="isCoveredByWarranty" caption="Warranty Coverage" dataType="boolean" />

        <Toolbar>
          <Item name="addRowButton" />
          <Item name="exportButton" />
          <Item name="searchPanel" />
        </Toolbar>
      </DataGrid>
    </div>
  );
}
```

### Step 2: Create Technical Service Employees

**File: `src/app/api/service/employees/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const employees = await prisma.technicalServiceEmployee.findMany({
      where: {
        businessId: session.user.businessId,
        isActive: true
      },
      include: {
        user: {
          select: { id: true, username: true, email: true }
        },
        technicianProfile: true
      },
      orderBy: { employeeCode: 'asc' }
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();

    // Generate employee code if not provided
    if (!data.employeeCode) {
      const count = await prisma.technicalServiceEmployee.count({
        where: { businessId: session.user.businessId }
      });
      data.employeeCode = `TECH-${String(count + 1).padStart(3, '0')}`;
    }

    const employee = await prisma.technicalServiceEmployee.create({
      data: {
        businessId: session.user.businessId,
        employeeCode: data.employeeCode,
        userId: data.userId || null,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        mobile: data.mobile,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        zipCode: data.zipCode,
        position: data.position,
        department: data.department || 'Technical Service',
        specialization: data.specialization,
        certifications: data.certifications,
        hireDate: data.hireDate ? new Date(data.hireDate) : null,
        employmentStatus: 'active',
        isActive: true
      }
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json(
      { error: "Failed to create employee" },
      { status: 500 }
    );
  }
}
```

### Step 3: Create Warranty Claims (Core Feature)

**File: `src/app/api/service/warranty-claims/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const claims = await prisma.serviceWarrantyClaim.findMany({
      where: {
        businessId: session.user.businessId,
        ...(status && { status })
      },
      include: {
        location: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, mobile: true } },
        product: { select: { id: true, name: true } },
        productVariation: { select: { id: true, name: true } },
        serialNumber: { select: { id: true, serialNumber: true, imei: true } },
        sale: { select: { id: true, invoiceNumber: true, saleDate: true } },
        createdByUser: { select: { id: true, username: true } }
      },
      orderBy: { claimDate: 'desc' }
    });

    return NextResponse.json(claims);
  } catch (error) {
    console.error('Error fetching claims:', error);
    return NextResponse.json(
      { error: "Failed to fetch warranty claims" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();

    // Generate claim number
    const year = new Date().getFullYear();
    const count = await prisma.serviceWarrantyClaim.count({
      where: {
        businessId: session.user.businessId,
        claimNumber: { startsWith: `WC-${year}-` }
      }
    });
    const claimNumber = `WC-${year}-${String(count + 1).padStart(4, '0')}`;

    const claim = await prisma.serviceWarrantyClaim.create({
      data: {
        businessId: session.user.businessId,
        locationId: data.locationId,
        claimNumber,
        claimDate: new Date(data.claimDate),
        serialNumberId: data.serialNumberId || null,
        productId: data.productId || null,
        productVariationId: data.productVariationId || null,
        customerId: data.customerId || null,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        saleId: data.saleId || null,
        problemDescription: data.problemDescription,
        reportedIssues: data.reportedIssues,
        accessoriesIncluded: data.accessoriesIncluded,
        warrantyType: data.warrantyType,
        warrantyStartDate: data.warrantyStartDate ? new Date(data.warrantyStartDate) : null,
        warrantyEndDate: data.warrantyEndDate ? new Date(data.warrantyEndDate) : null,
        isUnderWarranty: data.isUnderWarranty || false,
        status: 'pending',
        createdBy: session.user.id
      },
      include: {
        customer: true,
        product: true,
        serialNumber: true
      }
    });

    return NextResponse.json(claim, { status: 201 });
  } catch (error) {
    console.error('Error creating claim:', error);
    return NextResponse.json(
      { error: "Failed to create warranty claim" },
      { status: 500 }
    );
  }
}
```

## Workflow Endpoints

### Accept Warranty Claim
**File: `src/app/api/service/warranty-claims/[id]/accept/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const claimId = parseInt(params.id);

    const updatedClaim = await prisma.serviceWarrantyClaim.update({
      where: { id: claimId },
      data: {
        status: 'accepted',
        acceptedBy: data.acceptedBy, // Technical service employee ID
        dateAccepted: new Date(),
        acceptanceNotes: data.acceptanceNotes
      },
      include: {
        customer: true,
        product: true,
        serialNumber: true
      }
    });

    return NextResponse.json(updatedClaim);
  } catch (error) {
    console.error('Error accepting claim:', error);
    return NextResponse.json(
      { error: "Failed to accept warranty claim" },
      { status: 500 }
    );
  }
}
```

## DevExtreme Integration Example

### Warranty Claims Page with DevExtreme DataGrid

**File: `src/app/dashboard/service/warranty-claims/page.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import DataGrid, {
  Column,
  Paging,
  FilterRow,
  HeaderFilter,
  Export,
  Toolbar,
  Item,
  MasterDetail
} from "devextreme-react/data-grid";
import { Button } from "devextreme-react/button";
import { Popup } from "devextreme-react/popup";
import { Form, SimpleItem, GroupItem } from "devextreme-react/form";

export default function WarrantyClaimsPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewClaimPopup, setShowNewClaimPopup] = useState(false);

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    try {
      const response = await fetch('/api/service/warranty-claims');
      const data = await response.json();
      setClaims(data);
    } catch (error) {
      console.error('Error fetching claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusCellRender = (data: any) => {
    const statusColors: any = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-blue-100 text-blue-800',
      under_inspection: 'bg-purple-100 text-purple-800',
      diagnosed: 'bg-indigo-100 text-indigo-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      job_order_created: 'bg-teal-100 text-teal-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-gray-200 text-gray-600'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[data.value] || ''}`}>
        {data.value.replace(/_/g, ' ').toUpperCase()}
      </span>
    );
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Warranty Claims</h1>
        <Button
          text="New Warranty Claim"
          type="default"
          stylingMode="contained"
          onClick={() => setShowNewClaimPopup(true)}
        />
      </div>

      <DataGrid
        dataSource={claims}
        showBorders={true}
        columnAutoWidth={true}
        allowColumnReordering={true}
      >
        <Paging defaultPageSize={20} />
        <FilterRow visible={true} />
        <HeaderFilter visible={true} />
        <Export enabled={true} />

        <Column dataField="claimNumber" caption="Claim #" width={130} />
        <Column dataField="claimDate" caption="Date" dataType="date" format="dd/MM/yyyy" width={120} />
        <Column dataField="customerName" caption="Customer" />
        <Column dataField="customerPhone" caption="Phone" width={130} />
        <Column dataField="product.name" caption="Product" />
        <Column dataField="serialNumber.serialNumber" caption="Serial #" />
        <Column dataField="problemDescription" caption="Problem" />
        <Column dataField="warrantyType" caption="Warranty Type" width={130} />
        <Column
          dataField="status"
          caption="Status"
          width={150}
          cellRender={statusCellRender}
        />
        <Column dataField="createdByUser.username" caption="Created By" width={120} />

        <Toolbar>
          <Item name="exportButton" />
          <Item name="searchPanel" />
        </Toolbar>
      </DataGrid>

      <Popup
        visible={showNewClaimPopup}
        onHiding={() => setShowNewClaimPopup(false)}
        dragEnabled={true}
        closeOnOutsideClick={true}
        showTitle={true}
        title="New Warranty Claim"
        width={800}
        height={600}
      >
        {/* Add your warranty claim form here */}
        <p className="p-4">Warranty claim form will be implemented here...</p>
      </Popup>
    </div>
  );
}
```

## Next Steps

1. **Start with Service Types** - Simplest feature, no complex relations
2. **Add Technical Employees** - Foundation for technician assignment
3. **Build Warranty Claims** - Core feature with workflow
4. **Implement Job Orders** - Link to warranty claims
5. **Add Payment Processing** - Complete the cycle

## RBAC Permissions to Add

Add these to `src/lib/rbac.ts`:

```typescript
export const PERMISSIONS = {
  // ... existing permissions ...

  // Technical Service & Warranty
  TECHNICAL_SERVICE_VIEW: "technical_service_view",
  TECHNICAL_SERVICE_CREATE: "technical_service_create",
  TECHNICAL_SERVICE_EDIT: "technical_service_edit",
  TECHNICAL_SERVICE_DELETE: "technical_service_delete",
  WARRANTY_CLAIM_VIEW: "warranty_claim_view",
  WARRANTY_CLAIM_CREATE: "warranty_claim_create",
  WARRANTY_CLAIM_ACCEPT: "warranty_claim_accept",
  WARRANTY_CLAIM_INSPECT: "warranty_claim_inspect",
  WARRANTY_CLAIM_APPROVE: "warranty_claim_approve",
  REPAIR_JOB_VIEW: "repair_job_view",
  REPAIR_JOB_CREATE: "repair_job_create",
  REPAIR_JOB_EDIT: "repair_job_edit",
  REPAIR_JOB_ASSIGN: "repair_job_assign",
  REPAIR_JOB_COMPLETE: "repair_job_complete",
  SERVICE_PAYMENT_VIEW: "service_payment_view",
  SERVICE_PAYMENT_CREATE: "service_payment_create",
};
```

## Reference Implementations

Look at these existing files for patterns:
- **Transfer Export:** `src/app/dashboard/transfers/export/page.tsx`
- **Stock Pivot:** `src/app/dashboard/reports/stock-pivot-v2/page.tsx`
- **API Routes:** `src/app/api/transfers/[id]/route.ts`

## Support

For detailed schema documentation, see:
- `TECHNICAL_SERVICE_WARRANTY_SCHEMA_IMPLEMENTATION.md`

The schema is production-ready. Start building your UI features with confidence!
