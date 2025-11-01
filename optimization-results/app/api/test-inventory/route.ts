import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = session.user.businessId;

    // Test simple query first
    console.log('Testing simple query for businessId:', businessId);

    const simpleTest = await prisma.variationLocationDetails.findFirst({
      where: {
        product: {
          businessId: businessId
        }
      },
      select: {
        product: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            name: { select: { id: true, name: true } },
            sku: { select: { id: true, name: true } }
          }
        },
        productVariation: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } },
            sku: { select: { id: true, name: true } }
          }
        },
        location: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!simpleTest) {
      console.log('No inventory data found for business');
      return NextResponse.json({
        success: { select: { id: true, name: true } },
        message: 'No inventory data found',
        data: null
      });
    }

    console.log('Found test item:', simpleTest.product.name);

    // Test the main query with just one item
    const testQuery = await prisma.variationLocationDetails.findMany({
      where: {
        product: {
          businessId: businessId
        }
      },
      select: {
        product: {
          select: {
            category: {
              select: { name: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } } }
            },
            brand: {
              select: { name: { select: { id: true, name: true } } }
            }
          }
        },
        productVariation: {
          select: {
            supplier: {
              select: { name: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } } }
            }
          }
        },
        location: {
          select: { name: { select: { id: true, name: true } } }
        }
      },
      take: 5 // Limit to 5 items for testing
    });

    console.log('Test query successful, found', testQuery.length, 'items');

    return NextResponse.json({
      success: { select: { id: true, name: true } },
      message: 'Database query test successful',
      itemCount: testQuery.length,
      sampleItem: testQuery[0] || null
    });

  } catch (error) {
    console.error('Test API Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      {
        error: 'Database test failed',
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}