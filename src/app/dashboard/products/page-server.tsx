import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCachedProducts, getCachedLocations, getCachedCategories, getCachedBrands } from '@/lib/cache'
import { PERMISSIONS } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import ProductsList from '@/components/ProductsList'
import ProductsFilters from '@/components/ProductsFilters'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface ProductsPageProps {
    searchParams: {
        page?: string
        limit?: string
        search?: string
        active?: string
        categoryName?: string
        brandName?: string
        productType?: string
        stockMin?: string
        stockMax?: string
    }
}

/**
 * SERVER COMPONENT VERSION of Products Page
 * 
 * OPTIMIZATIONS:
 * 1. Server-side data fetching
 * 2. Cached data loading
 * 3. No client-side useEffect
 * 4. Better SEO and performance
 * 5. Reduced JavaScript bundle size
 */
export default async function ProductsPageServer({ searchParams }: ProductsPageProps) {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
        redirect('/login')
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
        redirect('/dashboard')
    }

    // Check permissions
    const canViewProducts = user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW)
    if (!canViewProducts) {
        redirect('/dashboard')
    }

    // Parse search params
    const page = parseInt(searchParams.page || '1')
    const limit = parseInt(searchParams.limit || '10')
    const search = searchParams.search || ''
    const activeFilter = searchParams.active || 'all'
    const categoryName = searchParams.categoryName || ''
    const brandName = searchParams.brandName || ''
    const productType = searchParams.productType || ''
    const stockMin = searchParams.stockMin ? parseFloat(searchParams.stockMin) : undefined
    const stockMax = searchParams.stockMax ? parseFloat(searchParams.stockMax) : undefined

    // Build where clause for filtering
    const whereClause: any = {
        businessId: parseInt(businessId),
        deletedAt: null
    }

    // Apply filters
    if (activeFilter === 'active') {
        whereClause.isActive = true
    } else if (activeFilter === 'inactive') {
        whereClause.isActive = false
    }

    if (search) {
        whereClause.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { productDescription: { contains: search, mode: 'insensitive' } }
        ]
    }

    if (categoryName) {
        whereClause.category = {
            name: { contains: categoryName, mode: 'insensitive' }
        }
    }

    if (brandName) {
        whereClause.brand = {
            name: { contains: brandName, mode: 'insensitive' }
        }
    }

    if (productType) {
        whereClause.type = productType
    }

    // Load data in parallel with caching
    const [products, locations, categories, brands] = await Promise.all([
        getCachedProducts(businessId, page, limit),
        getCachedLocations(businessId),
        getCachedCategories(businessId),
        getCachedBrands(businessId)
    ])

    // Apply client-side filters that require calculation
    let filteredProducts = products
    if (stockMin !== undefined || stockMax !== undefined) {
        filteredProducts = products.filter(product => {
            if (!product.enableStock) return false

            let totalStock = 0
            if (product.type === 'variable' || product.type === 'single') {
                totalStock = product.variations.reduce((total, variation) => {
                    const varStock = variation.variationLocationDetails.reduce((sum, detail) => sum + Number(detail.qtyAvailable), 0)
                    return total + varStock
                }, 0)
            }

            if (stockMin !== undefined && totalStock < stockMin) return false
            if (stockMax !== undefined && totalStock > stockMax) return false
            return true
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Products</h1>
                    <p className="text-muted-foreground">
                        Manage your product inventory and pricing
                    </p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-6">
                    <Suspense fallback={<Skeleton className="h-10 w-full" />}>
                        <ProductsFilters
                            locations={locations}
                            categories={categories}
                            brands={brands}
                            searchParams={searchParams}
                        />
                    </Suspense>
                </CardContent>
            </Card>

            {/* Products List */}
            <Card>
                <CardContent className="p-6">
                    <Suspense fallback={<ProductsListSkeleton />}>
                        <ProductsList
                            products={filteredProducts}
                            totalCount={filteredProducts.length}
                            currentPage={page}
                            itemsPerPage={limit}
                            searchParams={searchParams}
                        />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    )
}

/**
 * Loading skeleton for products list
 */
function ProductsListSkeleton() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-4 w-[100px]" />
                    </div>
                </div>
            ))}
        </div>
    )
}

