---
name: pos-product-variation-builder
description: Creates and manages products with variations across multiple business locations, handling complex pr
---

# pos-product-variation-builder

## Purpose
Creates and manages products with variations across multiple business locations, handling complex pricing, stock levels, SKUs, barcodes, and location-specific details.

## When to Use
- Creating new products with variations (size, color, etc.)
- Managing multi-location inventory
- Setting location-specific pricing
- Configuring product details (categories, units, warranties)
- Bulk product imports
- Product catalog management

## Critical Requirements

### 1. Product Types
```typescript
enum ProductType {
  single    // No variations (e.g., laptop model XYZ)
  variable  // Has variations (e.g., T-shirt: S/M/L, Red/Blue)
  combo     // Bundle of other products
}
```

### 2. Variation Structure
```typescript
// Product (parent)
//   ├── ProductVariation 1 (e.g., Size: S, Color: Red)
//   │     ├── VariationLocationDetails (Location A: qty=10, price=$20)
//   │     └── VariationLocationDetails (Location B: qty=5, price=$22)
//   └── ProductVariation 2 (e.g., Size: M, Color: Blue)
//         ├── VariationLocationDetails (Location A: qty=15, price=$20)
//         └── VariationLocationDetails (Location B: qty=8, price=$22)
```

### 3. Location-Independent Data
Stored in `ProductVariation`:
- Variation name
- Default SKU
- Default barcode
- Default cost price
- Default selling price
- Images

### 4. Location-Specific Data
Stored in `VariationLocationDetails`:
- Current stock quantity
- Location-specific SKU (optional)
- Location-specific barcode (optional)
- Location-specific pricing (optional)
- Opening stock details
- Min/max stock levels

## Implementation Pattern

### API Route: Create Product with Variations

```typescript
// /src/app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  if (!user.permissions?.includes(PERMISSIONS.PRODUCT_CREATE)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const {
    type,           // single | variable | combo
    name,
    description,
    categoryId,
    brandId,
    unitId,
    taxRate,
    warrantyMonths,
    alertQuantity,
    variations      // Array of variation definitions
  } = body

  // Validation
  if (!name || !type) {
    return NextResponse.json({
      error: 'Missing required fields: name, type'
    }, { status: 400 })
  }

  if (type === 'variable' && (!variations || variations.length === 0)) {
    return NextResponse.json({
      error: 'Variable products must have at least one variation'
    }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify category, brand, unit belong to business (if provided)
      if (categoryId) {
        const category = await tx.productCategory.findUnique({
          where: { id: categoryId },
          select: { businessId: true }
        })
        if (!category || category.businessId !== user.businessId) {
          throw new Error('Invalid category')
        }
      }

      // Create product
      const product = await tx.product.create({
        data: {
          businessId: user.businessId,
          type,
          name,
          description,
          categoryId,
          brandId,
          unitId,
          taxRate: taxRate || 0,
          warrantyMonths: warrantyMonths || 0,
          alertQuantity: alertQuantity || 0,
          isActive: true,
          createdBy: user.id
        }
      })

      // Create variations
      const createdVariations = []

      if (type === 'single') {
        // Single product = one default variation
        const variation = await tx.productVariation.create({
          data: {
            productId: product.id,
            name: 'Default',
            sku: body.sku || await generateSKU(tx, user.businessId),
            barcode: body.barcode,
            costPrice: body.costPrice || 0,
            sellingPrice: body.sellingPrice || 0,
            isDefault: true
          }
        })
        createdVariations.push(variation)

      } else if (type === 'variable') {
        // Create each variation
        for (let i = 0; i < variations.length; i++) {
          const v = variations[i]
          const variation = await tx.productVariation.create({
            data: {
              productId: product.id,
              name: v.name,  // e.g., "Red - Small"
              sku: v.sku || await generateSKU(tx, user.businessId),
              barcode: v.barcode,
              costPrice: v.costPrice || body.defaultCostPrice || 0,
              sellingPrice: v.sellingPrice || body.defaultSellingPrice || 0,
              isDefault: i === 0  // First variation is default
            }
          })
          createdVariations.push(variation)
        }
      }

      // Get all business locations
      const locations = await tx.businessLocation.findMany({
        where: { businessId: user.businessId, isActive: true },
        select: { id: true }
      })

      // Create VariationLocationDetails for each variation x location
      for (const variation of createdVariations) {
        for (const location of locations) {
          await tx.variationLocationDetails.create({
            data: {
              variationId: variation.id,
              locationId: location.id,
              currentQty: 0,  // Start with 0, set via opening stock
              openingStockQty: 0,
              openingStockSet: false,
              openingStockLocked: false
            }
          })
        }
      }

      // Audit log
      await createAuditLog({
        businessId: user.businessId,
        userId: user.id,
        username: user.username,
        action: 'PRODUCT_CREATE',
        entityType: 'PRODUCT',
        entityIds: [product.id.toString()],
        description: `Created ${type} product: ${name}`,
        metadata: {
          productId: product.id,
          productName: name,
          productType: type,
          variationCount: createdVariations.length,
          locationCount: locations.length,
          totalStockRecords: createdVariations.length * locations.length
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })

      return { product, variations: createdVariations }
    })

    return NextResponse.json({
      success: true,
      product: result.product,
      variations: result.variations,
      message: 'Product created successfully'
    })

  } catch (error: any) {
    console.error('Product creation error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to create product'
    }, { status: 500 })
  }
}

// Helper: Generate unique SKU
async function generateSKU(tx: any, businessId: number): Promise<string> {
  const count = await tx.product.count({ where: { businessId } })
  const prefix = 'PRD'
  return `${prefix}-${String(count + 1).padStart(6, '0')}`
}
```

### API Route: Update Product

```typescript
// /src/app/api/products/[id]/route.ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  if (!user.permissions?.includes(PERMISSIONS.PRODUCT_UPDATE)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const productId = parseInt(params.id)
  const body = await request.json()

  try {
    // Get existing product
    const existing = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, businessId: true, name: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (existing.businessId !== user.businessId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Update product
    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        name: body.name,
        description: body.description,
        categoryId: body.categoryId,
        brandId: body.brandId,
        unitId: body.unitId,
        taxRate: body.taxRate,
        warrantyMonths: body.warrantyMonths,
        alertQuantity: body.alertQuantity,
        isActive: body.isActive,
        updatedAt: new Date()
      },
      include: {
        category: true,
        brand: true,
        unit: true,
        variations: true
      }
    })

    // Audit log
    await createAuditLog({
      businessId: user.businessId,
      userId: user.id,
      username: user.username,
      action: 'PRODUCT_UPDATE',
      entityType: 'PRODUCT',
      entityIds: [productId.toString()],
      description: `Updated product: ${updated.name}`,
      metadata: {
        productId,
        productName: updated.name,
        changes: body  // Include what was changed
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request)
    })

    return NextResponse.json({ success: true, product: updated })

  } catch (error: any) {
    console.error('Product update error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to update product'
    }, { status: 500 })
  }
}
```

### API Route: Update Variation Location Details

```typescript
// /src/app/api/products/variations/[id]/locations/[locationId]/route.ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string, locationId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user
  const variationId = parseInt(params.id)
  const locationId = parseInt(params.locationId)
  const body = await request.json()

  try {
    // Verify variation belongs to business
    const variation = await prisma.productVariation.findUnique({
      where: { id: variationId },
      include: {
        product: { select: { businessId: true, name: true } }
      }
    })

    if (!variation || variation.product.businessId !== user.businessId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Update location details
    const updated = await prisma.variationLocationDetails.update({
      where: {
        variationId_locationId: { variationId, locationId }
      },
      data: {
        locationSpecificSku: body.locationSpecificSku,
        locationSpecificBarcode: body.locationSpecificBarcode,
        locationSellingPrice: body.locationSellingPrice,
        minStock: body.minStock,
        maxStock: body.maxStock,
        reorderPoint: body.reorderPoint,
        reorderQuantity: body.reorderQuantity
      }
    })

    return NextResponse.json({ success: true, details: updated })

  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Failed to update location details'
    }, { status: 500 })
  }
}
```

## Location-Specific Pricing

```typescript
// Get selling price for a variation at a location
async function getSellingPrice(
  variationId: number,
  locationId: number
): Promise<number> {
  const details = await prisma.variationLocationDetails.findUnique({
    where: { variationId_locationId: { variationId, locationId } },
    include: {
      variation: { select: { sellingPrice: true } }
    }
  })

  // Use location-specific price if set, otherwise use default
  return details?.locationSellingPrice || details?.variation.sellingPrice || 0
}
```

## Variation Attributes (Advanced)

```typescript
// For complex variations (e.g., T-shirt: Size=L, Color=Red)
interface VariationAttribute {
  attributeName: string   // "Size"
  attributeValue: string  // "Large"
}

// Store in ProductVariation.attributes (JSONB)
const variation = {
  name: "Large - Red",
  attributes: [
    { name: "Size", value: "Large" },
    { name: "Color", value: "Red" }
  ]
}

// Query variations by attribute
const largeTshirts = await prisma.productVariation.findMany({
  where: {
    productId: tshirtProductId,
    attributes: {
      path: ['$[*].value'],
      array_contains: 'Large'
    }
  }
})
```

## Best Practices

### ✅ DO:
- **Generate unique SKUs** automatically
- **Create location details** for ALL variations x locations
- **Support location-specific pricing** for flexibility
- **Use default variation** for single-type products
- **Validate SKU/barcode uniqueness** within business
- **Track creation/modification** users and timestamps
- **Support bulk operations** for efficiency
- **Allow soft delete** (isActive flag)

### ❌ DON'T:
- **Don't allow duplicate SKUs** within same business
- **Don't forget to create location details** for new locations
- **Don't hardcode pricing** - support location-specific
- **Don't skip category/brand/unit validation**
- **Don't allow negative prices**
- **Don't forget multi-tenant isolation**

## Bulk Product Import

```typescript
// Import products from CSV
async function bulkImportProducts(
  businessId: number,
  csvData: Array<{
    name: string
    sku: string
    barcode: string
    costPrice: number
    sellingPrice: number
    category: string
    // ... other fields
  }>
) {
  const results = { created: 0, errors: [] }

  for (const row of csvData) {
    try {
      await prisma.$transaction(async (tx) => {
        // Find or create category
        let category = await tx.productCategory.findFirst({
          where: { businessId, name: row.category }
        })

        if (!category) {
          category = await tx.productCategory.create({
            data: { businessId, name: row.category }
          })
        }

        // Create product
        const product = await tx.product.create({
          data: {
            businessId,
            type: 'single',
            name: row.name,
            categoryId: category.id
          }
        })

        // Create default variation
        const variation = await tx.productVariation.create({
          data: {
            productId: product.id,
            name: 'Default',
            sku: row.sku,
            barcode: row.barcode,
            costPrice: row.costPrice,
            sellingPrice: row.sellingPrice,
            isDefault: true
          }
        })

        // Create location details
        const locations = await tx.businessLocation.findMany({
          where: { businessId }
        })

        for (const location of locations) {
          await tx.variationLocationDetails.create({
            data: {
              variationId: variation.id,
              locationId: location.id,
              currentQty: 0
            }
          })
        }

        results.created++
      })
    } catch (error: any) {
      results.errors.push({ row: row.name, error: error.message })
    }
  }

  return results
}
```

## Adding New Location

```typescript
// When a new location is added, create VariationLocationDetails for ALL variations
async function onNewLocationCreated(locationId: number, businessId: number) {
  const variations = await prisma.productVariation.findMany({
    where: {
      product: { businessId }
    },
    select: { id: true }
  })

  await prisma.variationLocationDetails.createMany({
    data: variations.map(v => ({
      variationId: v.id,
      locationId,
      currentQty: 0,
      openingStockQty: 0,
      openingStockSet: false
    }))
  })
}
```

## Related Skills
- `pos-opening-stock-guardian` - Sets initial stock for variations
- `pos-inventory-transaction-logger` - Tracks stock movements
- `pos-multi-tenant-guardian` - Enforces product isolation
- `pos-barcode-label-printer` - Generates product labels

## References
- Schema: `/prisma/schema.prisma` lines 589-764 (Product, ProductVariation, VariationLocationDetails)
- Example: `/src/app/dashboard/products/page.tsx`
- RBAC: `/src/lib/rbac.ts` (PRODUCT_* permissions)
