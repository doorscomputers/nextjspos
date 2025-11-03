import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CSV template content
    const csvContent = `Product Name,Brand,Unit,Category,Sub category,SKU,Barcode Type,Manage Stock,Alert quantity,Expires in,Expiry Period Unit,Applicable Tax,Selling Price Tax Type,Product Type,Variation Name,Variation Values,Variation SKUs,Purchase Price (Including Tax),Purchase Price (Excluding Tax),Profit Margin %,Selling Price,Opening Stock,Opening stock location,Expiry Date,Enable Product description; IMEI or Serial Number,Weight,Rack,Row,Position,Image,Product Description,Custom Field1,Custom Field2,Custom Field3,Custom Field4,Not for selling,Product locations
Test Product,Test Brand,Piece,Electronics,Mobile,SKU001,C128,1,10,6,months,GST 18%,inclusive,single,,,,,100,84.75,15,115,100,Main Store,2025-12-31,1,0.5,R1,ROW1,POS1,image.jpg,This is a test product,,,,,0,Main Store
Variable Product,Brand A,Piece,Clothing,Shirts,VAR001,C128,1,5,12,months,VAT 10%,exclusive,variable,Size,Small|Medium|Large,SKU-S|SKU-M|SKU-L,50|55|60,45.45|50|54.55,20|18|15,60|65|70,10|15|20,Main Store|Warehouse,,,1,0.3,R2|R2|R2,ROW2|ROW2|ROW2,POS2|POS3|POS4,,Product with size variations,,,,,0,Main Store;Warehouse`

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="product_import_template.csv"'
      }
    })

  } catch (error: any) {
    console.error('Template download error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate template' },
      { status: 500 }
    )
  }
}
