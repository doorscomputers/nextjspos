import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/rbac';
import { PERMISSIONS } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    const canViewReports = hasPermission(session.user.permissions, PERMISSIONS.VIEW_REPORTS) ||
                          hasPermission(session.user.permissions, PERMISSIONS.VIEW_INVENTORY_REPORTS);

    if (!canViewReports) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const targetDate = searchParams.get('date');
    const locationId = searchParams.get('locationId');
    const categoryId = searchParams.get('categoryId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';

    // Validate date
    if (!targetDate) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
    }

    const targetDateTime = new Date(targetDate);
    if (isNaN(targetDateTime.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Don't allow future dates
    const now = new Date();
    if (targetDateTime > now) {
      return NextResponse.json({ error: 'Cannot generate inventory reports for future dates' }, { status: 400 });
    }

    const businessId = session.user.businessId;
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const whereConditions: any = {
      businessId,
      location: locationId ? { id: parseInt(locationId) } : undefined,
      product: search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ]
      } : undefined,
      categoryId: categoryId ? parseInt(categoryId) : undefined,
    };

    // Remove undefined conditions
    Object.keys(whereConditions).forEach(key => {
      if (whereConditions[key] === undefined) {
        delete whereConditions[key];
      }
    });

    // Main query to get historical inventory levels
    const [inventoryData, totalCount] = await Promise.all([
      // Get inventory with historical calculations
      prisma.variationLocationDetails.findMany({
        where: whereConditions,
        include: {
          product: {
            include: {
              category: {
                select: { name: true }
              },
              brand: {
                select: { name: true }
              }
            }
          },
          productVariation: {
            include: {
              supplier: {
                select: { name: true }
              }
            }
          },
          location: {
            select: { name: true }
          }
          // Note: We'll calculate historical quantity separately
        },
        orderBy: [
          { product: { name: 'asc' } },
          { productVariation: { name: 'asc' } }
        ],
        skip: offset,
        take: limit
      }),

      // Get total count for pagination
      prisma.variationLocationDetails.count({
        where: whereConditions
      })
    ]);

    // Calculate historical quantities for each inventory item
    const inventoryWithHistoricalQty = await Promise.all(
      inventoryData.map(async (item) => {
        // Sum all transactions after the target date for this specific item
        const transactionSumResult = await prisma.stockTransaction.aggregate({
          where: {
            businessId,
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: item.locationId,
            createdAt: {
              gt: targetDateTime
            }
          },
          _sum: {
            quantity: true
          }
        });

        const transactionsAfterDate = transactionSumResult._sum.quantity || 0;

        // Historical quantity = Current quantity - Transactions after date
        const historicalQuantity = Number(item.qtyAvailable) - Number(transactionsAfterDate);

        // Calculate historical value
        const historicalUnitCost = Number(item.productVariation.purchasePrice) || 0;
        const historicalValue = historicalQuantity * historicalUnitCost;

        return {
          id: item.id,
          product: {
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
            category: item.product.category?.name || null,
            brand: item.product.brand?.name || null,
            enableStock: item.product.enableStock,
            alertQuantity: item.product.alertQuantity
          },
          variation: {
            id: item.productVariation.id,
            name: item.productVariation.name,
            sku: item.productVariation.sku,
            subSku: item.productVariation.subSku,
            purchasePrice: item.productVariation.purchasePrice,
            sellingPrice: item.productVariation.sellingPrice
          },
          location: item.location,
          supplier: item.productVariation.supplier?.name || null,
          currentQuantity: Number(item.qtyAvailable),
          historicalQuantity: Math.max(0, historicalQuantity), // Don't show negative quantities
          historicalValue: Math.max(0, historicalValue),
          unitCost: historicalUnitCost,
          currency: session.user.business?.currency?.symbol || '₱',
          lastUpdated: item.updatedAt
        };
      })
    );

    // Filter out items that didn't exist or had zero quantity at target date
    const filteredInventory = inventoryWithHistoricalQty.filter(item =>
      item.historicalQuantity > 0 || !item.product.enableStock
    );

    // Calculate summary statistics
    const summary = {
      totalProducts: filteredInventory.length,
      totalQuantity: filteredInventory.reduce((sum, item) => sum + item.historicalQuantity, 0),
      totalValue: filteredInventory.reduce((sum, item) => sum + item.historicalValue, 0),
      lowStockItems: filteredInventory.filter(item =>
        item.product.enableStock &&
        item.product.alertQuantity &&
        item.historicalQuantity <= Number(item.product.alertQuantity)
      ).length,
      outOfStockItems: filteredInventory.filter(item =>
        item.product.enableStock && item.historicalQuantity === 0
      ).length,
      currency: session.user.business?.currency?.symbol || '₱'
    };

    return NextResponse.json({
      success: true,
      data: {
        inventory: filteredInventory,
        summary,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        },
        reportInfo: {
          targetDate: targetDate,
          generatedAt: new Date().toISOString(),
          generatedBy: session.user.username,
          filters: {
            locationId: locationId || null,
            categoryId: categoryId || null,
            search: search || null
          }
        }
      }
    });

  } catch (error) {
    console.error('Historical inventory report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate historical inventory report' },
      { status: 500 }
    );
  }
}