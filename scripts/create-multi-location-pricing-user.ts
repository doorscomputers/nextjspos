import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import readline from 'readline'

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const PERMISSION_NAMES = [
  'dashboard.view',
  'product.view',
  'product.view_purchase_price',
  'product.view_profit_margin',
  'product.view_supplier',
  'access_all_locations',
  'product.price.edit_all',
  'product.price.bulk_edit',
  'product.price.multi_location_update',
  'product.price.export',
  'product.cost_audit.view',
  'product.price_comparison.view',
  'pricing.settings.view',
  'pricing.alerts.view',
  'report.view',
  'report.stock_alert',
  'stock_report.view',
]

async function question(prompt: string): Promise<string> {
  return new Promise(resolve => rl.question(prompt, resolve))
}

async function ensurePermission(name: string, guardName: string = 'web') {
  const existing = await prisma.permission.findUnique({ where: { name } })
  if (existing) {
    return existing
  }

  return prisma.permission.create({
    data: {
      name,
      guardName,
    },
  })
}

async function ensureRole(businessId: number, permissionIds: number[]) {
  const roleName = 'Multi-Location Price Operator'

  let role = await prisma.role.findFirst({
    where: {
      businessId,
      name: roleName,
    },
  })

  if (!role) {
    role = await prisma.role.create({
      data: {
        name: roleName,
        businessId,
        description:
          'Applies coordinated price updates across selected locations with double-confirm safeguards.',
      },
    })
    console.log(`Created role "${roleName}" (ID: ${role.id})`)
  } else {
    console.log(`Role "${roleName}" already exists (ID: ${role.id})`)
  }

  for (const permissionId of permissionIds) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId,
      },
    })
  }

  return role
}

async function main() {
  try {
    const businesses = await prisma.business.findMany({
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    if (businesses.length === 0) {
      console.error('No businesses found. Seed business data first.')
      process.exit(1)
    }

    console.log('Available Businesses:')
    businesses.forEach((biz, index) => {
      console.log(`  ${index + 1}. ${biz.name} (ID: ${biz.id})`)
    })
    console.log('')

    const selectedIndex = Number(await question(`Select business (1-${businesses.length}): `)) - 1
    const selectedBusiness = businesses[selectedIndex]

    if (!selectedBusiness) {
      console.error('Invalid business selection.')
      process.exit(1)
    }

    console.log(`\nSelected Business: ${selectedBusiness.name} (ID: ${selectedBusiness.id})\n`)

    // Ensure permissions exist
    const permissionRecords = []
    for (const name of PERMISSION_NAMES) {
      const permission = await ensurePermission(name)
      permissionRecords.push(permission)
    }
    console.log(`Ensured ${permissionRecords.length} permissions.`)

    const role = await ensureRole(
      selectedBusiness.id,
      permissionRecords.map(p => p.id)
    )

    // Prompt user details
    const username = await question('Enter username: ')
    if (!username || username.length < 3) {
      console.error('Username must be at least 3 characters.')
      process.exit(1)
    }

    const existingUser = await prisma.user.findUnique({ where: { username } })
    if (existingUser) {
      console.error(`Username "${username}" already exists.`)
      process.exit(1)
    }

    const email = await question('Enter email: ')
    const firstName = await question('Enter first name: ')
    const lastName = await question('Enter last name: ')

    const password = await question('Enter password (min 8 characters): ')
    if (password.length < 8) {
      console.error('Password must be at least 8 characters.')
      process.exit(1)
    }
    const passwordConfirm = await question('Confirm password: ')
    if (password !== passwordConfirm) {
      console.error('Passwords do not match.')
      process.exit(1)
    }

    console.log('\nHashing password...')
    const hashedPassword = await bcrypt.hash(password, 10)

    console.log('Creating user...')
    const user = await prisma.user.create({
      data: {
        username,
        email,
        firstName,
        lastName,
        password: hashedPassword,
        businessId: selectedBusiness.id,
        allowLogin: true,
      },
    })
    console.log(`User created (ID: ${user.id})`)

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    })
    console.log(`Assigned role "${role.name}" to user.`)

    const activeLocations = await prisma.businessLocation.findMany({
      where: {
        businessId: selectedBusiness.id,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    if (activeLocations.length > 0) {
      await prisma.userLocation.createMany({
        data: activeLocations.map(loc => ({
          userId: user.id,
          locationId: loc.id,
        })),
        skipDuplicates: true,
      })
      console.log(`Assigned user to ${activeLocations.length} active locations.`)
    } else {
      console.warn('No active locations found to assign to the user.')
    }

    console.log('\n=== Multi-Location Pricing User Created ===')
    console.log(` Username: ${username}`)
    console.log(` Email:    ${email}`)
    console.log(` Role:     ${role.name}`)
    console.log(` Business: ${selectedBusiness.name}`)
    console.log('------------------------------------------')
    console.log('REMINDER: Share the password securely and require a change on first login.')
  } catch (error) {
    console.error('Error creating multi-location pricing user:', error)
    process.exit(1)
  } finally {
    rl.close()
    await prisma.$disconnect()
  }
}

main()
