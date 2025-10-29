import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

const MAX_LIMIT = 500

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canViewReadings =
      hasPermission(session.user, PERMISSIONS.X_READING) ||
      hasPermission(session.user, PERMISSIONS.Z_READING)

    if (!canViewReadings) {
      return NextResponse.json(
        { error: 'Forbidden - Missing reading history permission' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limitParam = parseInt(searchParams.get('limit') || '200', 10)
    const typeParam = searchParams.get('type')
    const dateFromParam = searchParams.get('dateFrom')
    const dateToParam = searchParams.get('dateTo')

    const limit = Math.min(Number.isNaN(limitParam) ? 200 : limitParam, MAX_LIMIT)
    const businessId = parseInt(session.user.businessId)
    const user = session.user as any

    const isSuperAdmin = user.roles?.includes('Super Admin')
    const isAllBranchAdmin = user.roles?.includes('All Branch Admin')

    let accessibleLocationIds: number[] = []

    if (isSuperAdmin || isAllBranchAdmin) {
      const allLocations = await prisma.businessLocation.findMany({
        where: {
          businessId,
          deletedAt: null,
        },
        select: { id: true },
      })
      accessibleLocationIds = allLocations.map(location => location.id)
    } else {
      const userLocations = await prisma.userLocation.findMany({
        where: { userId: parseInt(session.user.id) },
        select: { locationId: true },
      })
      accessibleLocationIds = userLocations.map(item => item.locationId)

      if (accessibleLocationIds.length === 0) {
        return NextResponse.json(
          { error: 'No location assigned. Please contact your administrator.' },
          { status: 403 }
        )
      }
    }

    await hydrateShiftReadings(businessId, accessibleLocationIds)

    const whereClause: any = {
      businessId,
      locationId: { in: accessibleLocationIds },
    }

    if (typeParam === 'X' || typeParam === 'Z') {
      whereClause.type = typeParam
    }

    if (dateFromParam || dateToParam) {
      whereClause.readingTime = {}
      if (dateFromParam) {
        whereClause.readingTime.gte = new Date(dateFromParam)
      }
      if (dateToParam) {
        const endDate = new Date(dateToParam)
        endDate.setHours(23, 59, 59, 999)
        whereClause.readingTime.lte = endDate
      }
    }

    const readings = await prisma.cashierShiftReading.findMany({
      where: whereClause,
      orderBy: { readingTime: 'desc' },
      take: limit,
    })

    if (readings.length === 0) {
      return NextResponse.json({ readings: [], count: 0 })
    }

    const shiftIds = Array.from(new Set(readings.map(reading => reading.shiftId)))
    const userIds = Array.from(new Set(readings.map(reading => reading.userId)))
    const locationIds = Array.from(new Set(readings.map(reading => reading.locationId)))

    const [shifts, users, locations] = await Promise.all([
      prisma.cashierShift.findMany({
        where: { id: { in: shiftIds } },
        select: { id: true, shiftNumber: true },
      }),
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          surname: true,
        },
      }),
      prisma.businessLocation.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, name: true },
      }),
    ])

    const shiftMap = new Map(shifts.map(shift => [shift.id, shift.shiftNumber]))
    const locationMap = new Map(locations.map(location => [location.id, location.name]))
    const userMap = new Map(users.map(user => [user.id, user]))

    const result = readings.map(reading => {
      const shiftNumber = shiftMap.get(reading.shiftId) || `SHIFT-${reading.shiftId}`
      const locationName = locationMap.get(reading.locationId) || `Location #${reading.locationId}`
      const userInfo = userMap.get(reading.userId)

      const cashierName = userInfo
        ? [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ') ||
          userInfo.username ||
          `User #${reading.userId}`
        : `User #${reading.userId}`

      return {
        id: reading.id,
        shiftId: reading.shiftId,
        shiftNumber,
        type: reading.type as 'X' | 'Z',
        readingNumber: reading.readingNumber,
        readingTime: reading.readingTime.toISOString(),
        cashierName,
        locationName,
        grossSales: parseFloat(reading.grossSales.toString()),
        netSales: parseFloat(reading.netSales.toString()),
        totalDiscounts: parseFloat(reading.totalDiscounts.toString()),
        expectedCash: reading.expectedCash ? parseFloat(reading.expectedCash.toString()) : null,
        transactionCount: reading.transactionCount,
        reportNumber: reading.reportNumber,
      }
    })

    return NextResponse.json({ readings: result, count: result.length })
  } catch (error: any) {
    console.error('Error fetching reading history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reading history', details: error.message },
      { status: 500 }
    )
  }
}

async function hydrateShiftReadings(businessId: number, locationIds: number[]) {
  if (!locationIds.length) return

  const shiftsNeedingLogs = await prisma.cashierShift.findMany({
    where: {
      businessId,
      locationId: { in: locationIds },
      status: 'closed',
      readings: { none: {} },
    },
    select: {
      id: true,
      businessId: true,
      locationId: true,
      userId: true,
      shiftNumber: true,
      openedAt: true,
      closedAt: true,
      updatedAt: true,
      totalSales: true,
      totalDiscounts: true,
      systemCash: true,
      transactionCount: true,
      xReadingCount: true,
    },
    take: 50,
  })

  if (shiftsNeedingLogs.length === 0) return

  const operations = shiftsNeedingLogs.map(shift => {
    const grossSales = parseFloat(shift.totalSales?.toString() || '0')
    const totalDiscounts = parseFloat(shift.totalDiscounts?.toString() || '0')
    const netSales = grossSales - totalDiscounts
    const expectedCash = shift.systemCash ? parseFloat(shift.systemCash.toString()) : null
    const readingTime = shift.closedAt ?? shift.updatedAt ?? shift.openedAt

    const transactions = [
      prisma.cashierShiftReading.upsert({
        where: {
          shiftId_type_readingNumber: {
            shiftId: shift.id,
            type: 'Z',
            readingNumber: 1,
          },
        },
        update: {
          readingTime,
          grossSales,
          netSales,
          totalDiscounts,
          expectedCash,
          transactionCount: shift.transactionCount,
          reportNumber: null,
          payload: null,
        },
        create: {
          businessId: shift.businessId,
          locationId: shift.locationId,
          shiftId: shift.id,
          userId: shift.userId,
          type: 'Z',
          readingNumber: 1,
          readingTime,
          grossSales,
          netSales,
          totalDiscounts,
          expectedCash,
          transactionCount: shift.transactionCount,
          reportNumber: null,
          payload: null,
        },
      }),
    ]

    if (shift.xReadingCount > 0) {
      const xReadingTime = shift.updatedAt ?? readingTime

      transactions.push(
        prisma.cashierShiftReading.upsert({
          where: {
            shiftId_type_readingNumber: {
              shiftId: shift.id,
              type: 'X',
              readingNumber: shift.xReadingCount,
            },
          },
          update: {
            readingTime: xReadingTime,
            grossSales,
            netSales,
            totalDiscounts,
            expectedCash,
            transactionCount: shift.transactionCount,
            payload: null,
          },
          create: {
            businessId: shift.businessId,
            locationId: shift.locationId,
            shiftId: shift.id,
            userId: shift.userId,
            type: 'X',
            readingNumber: shift.xReadingCount,
            readingTime: xReadingTime,
            grossSales,
            netSales,
            totalDiscounts,
            expectedCash,
            transactionCount: shift.transactionCount,
            payload: null,
          },
        })
      )
    }

    return transactions
  })

  const flattened = operations.flat()
  if (flattened.length) {
    await prisma.$transaction(flattened)
  }
}
