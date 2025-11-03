import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.simple'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    console.log('[Test Auth] Looking up user:', username)

    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        business: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
                locations: {
                  include: {
                    location: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found',
      }, { status: 404 })
    }

    console.log('[Test Auth] User found, checking password...')

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid password',
      }, { status: 401 })
    }

    console.log('[Test Auth] Password valid!')

    return NextResponse.json({
      success: true,
      message: 'Auth test successful',
      user: {
        id: user.id,
        username: user.username,
        businessId: user.businessId,
        businessName: user.business?.name,
        roleCount: user.roles.length,
      },
    })
  } catch (error: any) {
    console.error('[Test Auth] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
