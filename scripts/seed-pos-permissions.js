/**
 * Seed POS/Sales permissions to database
 * Run with: node scripts/seed-pos-permissions.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const POS_PERMISSIONS = [
  // Cashier Shift Management
  { name: 'shift.open', guardName: 'web' },
  { name: 'shift.close', guardName: 'web' },
  { name: 'shift.view', guardName: 'web' },
  { name: 'shift.view_all', guardName: 'web' },

  // Cash Management
  { name: 'cash.in_out', guardName: 'web' },
  { name: 'cash.count', guardName: 'web' },
  { name: 'cash.approve_large_transactions', guardName: 'web' },

  // Void Transactions
  { name: 'void.create', guardName: 'web' },
  { name: 'void.approve', guardName: 'web' },

  // BIR Readings
  { name: 'reading.x_reading', guardName: 'web' },
  { name: 'reading.z_reading', guardName: 'web' },

  // Sales Reports
  { name: 'sales_report.view', guardName: 'web' },
  { name: 'sales_report.daily', guardName: 'web' },
  { name: 'sales_report.summary', guardName: 'web' },
]

async function main() {
  console.log('🚀 Starting POS permissions seeding...\n')

  // Step 1: Create permissions if they don't exist
  console.log('📝 Creating permissions...')
  for (const perm of POS_PERMISSIONS) {
    const existing = await prisma.permission.findUnique({
      where: { name: perm.name },
    })

    if (!existing) {
      await prisma.permission.create({ data: perm })
      console.log(`  ✅ Created: ${perm.name}`)
    } else {
      console.log(`  ⏭️  Skipped: ${perm.name} (already exists)`)
    }
  }

  console.log('\n📊 Fetching permissions and roles...')

  // Get all POS permission IDs
  const permissions = await prisma.permission.findMany({
    where: {
      name: {
        in: POS_PERMISSIONS.map(p => p.name),
      },
    },
  })

  console.log(`  Found ${permissions.length} POS permissions`)

  // Step 2: Assign to Cashier role
  console.log('\n👤 Assigning to Cashier roles...')
  const cashierPermissions = permissions.filter(p =>
    ['shift.open', 'shift.close', 'shift.view', 'cash.in_out', 'cash.count',
     'reading.x_reading', 'void.create'].includes(p.name)
  )

  const cashierRoles = await prisma.role.findMany({
    where: {
      name: { in: ['Regular Cashier', 'Cashier'] },
    },
  })

  for (const role of cashierRoles) {
    for (const perm of cashierPermissions) {
      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: perm.id,
          },
        },
      })

      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: perm.id,
          },
        })
        console.log(`  ✅ ${role.name}: ${perm.name}`)
      }
    }
  }

  // Step 3: Assign to Branch Manager role
  console.log('\n👔 Assigning to Branch Manager roles...')
  const managerPermissions = permissions.filter(p =>
    ['shift.open', 'shift.close', 'shift.view', 'shift.view_all',
     'cash.in_out', 'cash.count', 'cash.approve_large_transactions',
     'void.create', 'void.approve', 'reading.x_reading', 'reading.z_reading',
     'sales_report.view', 'sales_report.daily', 'sales_report.summary'].includes(p.name)
  )

  const managerRoles = await prisma.role.findMany({
    where: {
      name: { in: ['Branch Manager', 'Manager'] },
    },
  })

  for (const role of managerRoles) {
    for (const perm of managerPermissions) {
      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: perm.id,
          },
        },
      })

      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: perm.id,
          },
        })
        console.log(`  ✅ ${role.name}: ${perm.name}`)
      }
    }
  }

  // Step 4: Assign ALL to Super Admin / Branch Admin roles
  console.log('\n⭐ Assigning all POS permissions to Admin roles...')
  const adminRoles = await prisma.role.findMany({
    where: {
      name: { in: ['Super Admin', 'Branch Admin', 'Admin'] },
    },
  })

  for (const role of adminRoles) {
    for (const perm of permissions) {
      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: perm.id,
          },
        },
      })

      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: perm.id,
          },
        })
        console.log(`  ✅ ${role.name}: ${perm.name}`)
      }
    }
  }

  console.log('\n✅ POS permissions seeding completed!\n')
  console.log('📋 Summary:')
  console.log(`  • ${POS_PERMISSIONS.length} permissions created`)
  console.log(`  • Assigned to ${cashierRoles.length} Cashier role(s)`)
  console.log(`  • Assigned to ${managerRoles.length} Manager role(s)`)
  console.log(`  • Assigned to ${adminRoles.length} Admin role(s)`)
  console.log('\n🎉 Ready to use the POS system!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
