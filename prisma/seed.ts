import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { PERMISSIONS, DEFAULT_ROLES } from '../src/lib/rbac'
import { initializeChartOfAccounts } from '../src/lib/chartOfAccounts'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create Currency
  const usd = await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
    },
  })
  console.log('✅ Currency created')

  // Create Super Admin User (Owner)
  const hashedPassword = await bcrypt.hash('password', 10)

  const superAdmin = await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      surname: 'Super',
      firstName: 'Admin',
      lastName: 'User',
      username: 'superadmin',
      email: 'superadmin@ultimatepos.com',
      password: hashedPassword,
      allowLogin: true,
      userType: 'user',
    },
  })
  console.log('✅ Super Admin user created')

  // Create Business
  const business = await prisma.business.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'PCInet Computer Store',
      currencyId: usd.id,
      ownerId: superAdmin.id,
      taxNumber1: 'TAX-001-123',
      taxLabel1: 'VAT',
      defaultProfitPercent: 15,
      timeZone: 'America/New_York',
      fyStartMonth: 1,
      accountingMethod: 'fifo',
      sellPriceTax: 'includes',
      skuPrefix: 'PCI',
      enableTooltip: true,
    },
  })
  console.log('✅ Business created')

  // Update super admin with business ID
  await prisma.user.update({
    where: { id: superAdmin.id },
    data: { businessId: business.id },
  })

  // Create Business Locations (Branches)
  // ID 1: Main Warehouse (Solano)
  const warehouseLocation = await prisma.businessLocation.upsert({
    where: { id: 1 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Main Warehouse',
      country: 'Philippines',
      state: 'NuevaVizcaya',
      city: 'Solano',
      zipCode: '2601',
      mobile: '+1234567890',
      email: 'warehouse@demo.com',
    },
  })

  // ID 2: Main Store (Solano)
  const mainLocation = await prisma.businessLocation.upsert({
    where: { id: 2 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Main Store',
      country: 'Philippines',
      state: 'Region 2',
      city: 'Solano',
      zipCode: '3500',
      mobile: '+63-912-555-0001',
      email: 'MainStore@pcinetstore.com',
    },
  })

  // ID 3: Bambang
  const bambangLocation = await prisma.businessLocation.upsert({
    where: { id: 3 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Bambang',
      country: 'Philippines',
      state: 'Region 2',
      city: 'Bambang',
      zipCode: '3702',
      mobile: '+63-912-555-0003',
      email: 'bambang@pcinetstore.com',
    },
  })

  // ID 4: Tuguegarao
  const downtownLocation = await prisma.businessLocation.upsert({
    where: { id: 4 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Tuguegarao',
      country: 'Philippines',
      state: 'Region 2',
      city: 'Tuguegarao',
      zipCode: '3500',
      mobile: '+63-912-555-0004',
      email: 'Tuguegarao@pcinetstore.com',
    },
  })
  console.log('✅ Business locations created (4 branches)')

  // Initialize Chart of Accounts for the business
  console.log('Initializing Chart of Accounts...')
  const chartOfAccounts = await initializeChartOfAccounts(business.id)
  console.log(`✅ Chart of Accounts initialized (${chartOfAccounts.length} accounts created)`)

  // Create All Permissions
  const permissionRecords = await Promise.all(
    Object.values(PERMISSIONS).map((permission) =>
      prisma.permission.upsert({
        where: { name: permission },
        update: {},
        create: {
          name: permission,
          guardName: 'web',
        },
      })
    )
  )
  console.log(`✅ ${permissionRecords.length} permissions created`)

  // Create All Roles from DEFAULT_ROLES dynamically
  console.log('Creating roles...')
  const roleMap = new Map<string, any>()

  // Create System Administrator (Super Admin) - PROTECTED
  let systemAdminRole = await prisma.role.findFirst({
    where: { name: 'System Administrator', businessId: business.id }
  })
  if (!systemAdminRole) {
    systemAdminRole = await prisma.role.create({
      data: {
        name: 'System Administrator',
        businessId: business.id,
        guardName: 'web',
        isDefault: true, // Protected - cannot be edited/deleted
      },
    })
  }
  roleMap.set('System Administrator', systemAdminRole)

  // Create "Super Admin" for backward compatibility
  let superAdminRole = await prisma.role.findFirst({
    where: { name: 'Super Admin', businessId: business.id }
  })
  if (!superAdminRole) {
    superAdminRole = await prisma.role.create({
      data: {
        name: 'Super Admin',
        businessId: business.id,
        guardName: 'web',
        isDefault: true, // Protected - cannot be edited/deleted
      },
    })
  }
  roleMap.set('Super Admin', superAdminRole)

  // Create all other roles from DEFAULT_ROLES
  for (const [key, roleData] of Object.entries(DEFAULT_ROLES)) {
    const roleName = roleData.name

    // Skip if already created above
    if (roleName === 'System Administrator' || roleName === 'Super Admin') continue

    let role = await prisma.role.findFirst({
      where: { name: roleName, businessId: business.id }
    })
    if (!role) {
      role = await prisma.role.create({
        data: {
          name: roleName,
          businessId: business.id,
          guardName: 'web',
          isDefault: false,
        },
      })
    }
    roleMap.set(roleName, role)
  }

  console.log(`✅ ${roleMap.size} roles created`)

  // Assign permissions to all roles dynamically
  console.log('Assigning permissions to roles...')
  let assignmentCount = 0

  for (const [key, roleData] of Object.entries(DEFAULT_ROLES)) {
    const roleName = roleData.name
    const role = roleMap.get(roleName)

    if (!role) continue

    const rolePermissions = permissionRecords.filter((p) =>
      (roleData.permissions as any).includes(p.name)
    )

    for (const permission of rolePermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      })
      assignmentCount++
    }
  }

  // Assign ALL permissions to System Administrator and Super Admin
  console.log('Assigning ALL permissions to System Administrator and Super Admin...')
  const adminRoles = [
    roleMap.get('System Administrator'),
    roleMap.get('Super Admin')
  ].filter(Boolean)

  for (const adminRole of adminRoles) {
    for (const permission of permissionRecords) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      })
      assignmentCount++
    }
  }

  console.log(`✅ ${assignmentCount} permissions assigned to ${roleMap.size} roles`)

  // Create Demo Users
  // First, clear any existing user location assignments to avoid conflicts
  await prisma.userLocation.deleteMany({})

  // Delete old demo users to avoid email conflicts (cleanup from previous seeds)
  await prisma.user.deleteMany({
    where: {
      username: { in: ['branchadmin', 'branchmanager', 'accountant', 'warehousemanager', 'staff', 'cashier'] }
    }
  })

  // Create Branch Manager demo user
  const branchManagerUser = await prisma.user.upsert({
    where: { username: 'branchmanager' },
    update: {
      email: 'branchmanager@ultimatepos.com',
      surname: 'Jane',
      firstName: 'Smith',
      lastName: 'Manager',
    },
    create: {
      surname: 'Jane',
      firstName: 'Smith',
      lastName: 'Manager',
      username: 'branchmanager',
      email: 'branchmanager@ultimatepos.com',
      password: hashedPassword,
      businessId: business.id,
      allowLogin: true,
      userType: 'user',
    },
  })

  // Create Warehouse Manager demo user
  const warehouseManagerUser = await prisma.user.upsert({
    where: { username: 'warehousemanager' },
    update: {
      email: 'warehouse@ultimatepos.com',
      surname: 'Robert',
      firstName: 'Davis',
      lastName: 'Warehouse Manager',
    },
    create: {
      surname: 'Robert',
      firstName: 'Davis',
      lastName: 'Warehouse Manager',
      username: 'warehousemanager',
      email: 'warehouse@ultimatepos.com',
      password: hashedPassword,
      businessId: business.id,
      allowLogin: true,
      userType: 'user',
    },
  })

  // Create Sales Cashier demo user
  const cashierUser = await prisma.user.upsert({
    where: { username: 'cashier' },
    update: {
      email: 'cashier@ultimatepos.com',
      surname: 'Mike',
      firstName: 'Johnson',
      lastName: 'Cashier',
    },
    create: {
      surname: 'Mike',
      firstName: 'Johnson',
      lastName: 'Cashier',
      username: 'cashier',
      email: 'cashier@ultimatepos.com',
      password: hashedPassword,
      businessId: business.id,
      allowLogin: true,
      userType: 'user',
    },
  })

  // Create Transfer Creator demo user
  const transferCreatorUser = await prisma.user.upsert({
    where: { username: 'transfercreator' },
    update: {
      email: 'transfercreator@ultimatepos.com',
      surname: 'Sarah',
      firstName: 'Miller',
      lastName: 'Transfer Creator',
    },
    create: {
      surname: 'Sarah',
      firstName: 'Miller',
      lastName: 'Transfer Creator',
      username: 'transfercreator',
      email: 'transfercreator@ultimatepos.com',
      password: hashedPassword,
      businessId: business.id,
      allowLogin: true,
      userType: 'user',
    },
  })

  // ============================================
  // INVENTORY CORRECTION USERS (Location-Specific Counters)
  // ============================================
  const hashedPassword111111 = await bcrypt.hash('111111', 10)

  // Inventory Counter - Main Store
  const invcorMainUser = await prisma.user.upsert({
    where: { username: 'invcormain' },
    update: {
      email: 'invcormain@pcinetstore.com',
      surname: 'Inventory',
      firstName: 'Counter',
      lastName: 'Main Store',
    },
    create: {
      surname: 'Inventory',
      firstName: 'Counter',
      lastName: 'Main Store',
      username: 'invcormain',
      email: 'invcormain@pcinetstore.com',
      password: hashedPassword111111,
      businessId: business.id,
      allowLogin: true,
      userType: 'user',
    },
  })

  // Inventory Counter - Bambang
  const invcorBambangUser = await prisma.user.upsert({
    where: { username: 'invcorbambang' },
    update: {
      email: 'invcorbambang@pcinetstore.com',
      surname: 'Inventory',
      firstName: 'Counter',
      lastName: 'Bambang',
    },
    create: {
      surname: 'Inventory',
      firstName: 'Counter',
      lastName: 'Bambang',
      username: 'invcorbambang',
      email: 'invcorbambang@pcinetstore.com',
      password: hashedPassword111111,
      businessId: business.id,
      allowLogin: true,
      userType: 'user',
    },
  })

  // Inventory Counter - Tuguegarao Downtown
  const invcorTugueUser = await prisma.user.upsert({
    where: { username: 'invcortugue' },
    update: {
      email: 'invcortugue@pcinetstore.com',
      surname: 'Inventory',
      firstName: 'Counter',
      lastName: 'Tuguegarao',
    },
    create: {
      surname: 'Inventory',
      firstName: 'Counter',
      lastName: 'Tuguegarao',
      username: 'invcortugue',
      email: 'invcortugue@pcinetstore.com',
      password: hashedPassword111111,
      businessId: business.id,
      allowLogin: true,
      userType: 'user',
    },
  })

  // Inventory Correction Approver (All Locations)
  const invcorApproverUser = await prisma.user.upsert({
    where: { username: 'invcorApprover' },
    update: {
      email: 'approver@pcinetstore.com',
      surname: 'Inventory',
      firstName: 'Correction',
      lastName: 'Approver',
    },
    create: {
      surname: 'Inventory',
      firstName: 'Correction',
      lastName: 'Approver',
      username: 'invcorApprover',
      email: 'approver@pcinetstore.com',
      password: hashedPassword111111,
      businessId: business.id,
      allowLogin: true,
      userType: 'user',
    },
  })

  console.log('✅ Demo users created (including 4 inventory correction users)')

  // Assign Roles to Users
  // Super Admin -> System Administrator
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: superAdmin.id,
        roleId: roleMap.get('System Administrator').id,
      },
    },
    update: {},
    create: {
      userId: superAdmin.id,
      roleId: roleMap.get('System Administrator').id,
    },
  })

  // Branch Manager -> Branch Manager role
  const branchManagerRole = roleMap.get('Branch Manager')
  if (branchManagerRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: branchManagerUser.id,
          roleId: branchManagerRole.id,
        },
      },
      update: {},
      create: {
        userId: branchManagerUser.id,
        roleId: branchManagerRole.id,
      },
    })
  }

  // Warehouse Manager -> Warehouse Manager role
  const warehouseManagerRole = roleMap.get('Warehouse Manager')
  if (warehouseManagerRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: warehouseManagerUser.id,
          roleId: warehouseManagerRole.id,
        },
      },
      update: {},
      create: {
        userId: warehouseManagerUser.id,
        roleId: warehouseManagerRole.id,
      },
    })
  }

  // Cashier -> Sales Cashier role
  const salesCashierRole = roleMap.get('Sales Cashier')
  if (salesCashierRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: cashierUser.id,
          roleId: salesCashierRole.id,
        },
      },
      update: {},
      create: {
        userId: cashierUser.id,
        roleId: salesCashierRole.id,
      },
    })
  }

  // Transfer Creator -> Transfer Creator role
  const transferCreatorRole = roleMap.get('Transfer Creator')
  if (transferCreatorRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: transferCreatorUser.id,
          roleId: transferCreatorRole.id,
        },
      },
      update: {},
      create: {
        userId: transferCreatorUser.id,
        roleId: transferCreatorRole.id,
      },
    })
  }

  // Inventory Counter - Main Store -> Inventory Counter role
  const inventoryCounterRole = roleMap.get('Inventory Counter')
  if (inventoryCounterRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: invcorMainUser.id,
          roleId: inventoryCounterRole.id,
        },
      },
      update: {},
      create: {
        userId: invcorMainUser.id,
        roleId: inventoryCounterRole.id,
      },
    })

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: invcorBambangUser.id,
          roleId: inventoryCounterRole.id,
        },
      },
      update: {},
      create: {
        userId: invcorBambangUser.id,
        roleId: inventoryCounterRole.id,
      },
    })

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: invcorTugueUser.id,
          roleId: inventoryCounterRole.id,
        },
      },
      update: {},
      create: {
        userId: invcorTugueUser.id,
        roleId: inventoryCounterRole.id,
      },
    })
  }

  // Inventory Correction Approver -> Inventory Correction Approver role
  const inventoryCorrectionApproverRole = roleMap.get('Inventory Correction Approver')
  if (inventoryCorrectionApproverRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: invcorApproverUser.id,
          roleId: inventoryCorrectionApproverRole.id,
        },
      },
      update: {},
      create: {
        userId: invcorApproverUser.id,
        roleId: inventoryCorrectionApproverRole.id,
      },
    })
  }

  console.log('✅ Roles assigned to users (including inventory correction roles)')

  // Assign Locations to Users
  // System Admin has ACCESS_ALL_LOCATIONS permission, so they see all branches
  // Other users are assigned to specific branches

  // Branch Manager -> Assigned to Main Store only
  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: branchManagerUser.id,
        locationId: mainLocation.id,
      },
    },
    update: {},
    create: {
      userId: branchManagerUser.id,
      locationId: mainLocation.id,
    },
  })

  // Warehouse Manager -> Assigned to Warehouse location
  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: warehouseManagerUser.id,
        locationId: warehouseLocation.id,
      },
    },
    update: {},
    create: {
      userId: warehouseManagerUser.id,
      locationId: warehouseLocation.id,
    },
  })

  // Transfer Creator -> Assigned to Main Store
  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: transferCreatorUser.id,
        locationId: mainLocation.id,
      },
    },
    update: {},
    create: {
      userId: transferCreatorUser.id,
      locationId: mainLocation.id,
    },
  })

  // Cashier -> Assigned to Tuguegarao Downtown only
  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: cashierUser.id,
        locationId: downtownLocation.id,
      },
    },
    update: {},
    create: {
      userId: cashierUser.id,
      locationId: downtownLocation.id,
    },
  })

  // Inventory Counter - Main Store -> Assigned to Main Store only
  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: invcorMainUser.id,
        locationId: mainLocation.id,
      },
    },
    update: {},
    create: {
      userId: invcorMainUser.id,
      locationId: mainLocation.id,
    },
  })

  // Inventory Counter - Bambang -> Assigned to Bambang location only
  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: invcorBambangUser.id,
        locationId: bambangLocation.id,
      },
    },
    update: {},
    create: {
      userId: invcorBambangUser.id,
      locationId: bambangLocation.id,
    },
  })

  // Inventory Counter - Tuguegarao -> Assigned to Tuguegarao Downtown only
  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: invcorTugueUser.id,
        locationId: downtownLocation.id,
      },
    },
    update: {},
    create: {
      userId: invcorTugueUser.id,
      locationId: downtownLocation.id,
    },
  })

  // Inventory Correction Approver -> Has ACCESS_ALL_LOCATIONS permission, so NO location assignment needed
  // This user can see and approve corrections from ALL locations

  console.log('✅ User locations assigned:')
  console.log('  - Branch Manager -> Main Store (ID 2)')
  console.log('  - Warehouse Manager -> Main Warehouse (ID 1)')
  console.log('  - Transfer Creator -> Main Store (ID 2)')
  console.log('  - Cashier -> Tuguegarao (ID 4)')
  console.log('  - Inventory Counter (Main) -> Main Store (ID 2)')
  console.log('  - Inventory Counter (Bambang) -> Bambang (ID 3)')
  console.log('  - Inventory Counter (Tugue) -> Tuguegarao (ID 4)')
  console.log('  - Inventory Correction Approver -> ALL LOCATIONS (via permission)')

  // Create Subscription Packages
  const freePackage = await prisma.package.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Free Trial',
      description: 'Perfect for testing the system',
      locationCount: 1,
      userCount: 3,
      productCount: 50,
      invoiceCount: 100,
      interval: 'days',
      intervalCount: 1,
      trialDays: 30,
      price: 0,
      sortOrder: 1,
      isActive: true,
      isPrivate: false,
      customPermissions: {
        modules: ['pos', 'products', 'customers'],
        features: ['basic_reporting']
      }
    }
  })

  const basicPackage = await prisma.package.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Basic',
      description: 'For small businesses getting started',
      locationCount: 1,
      userCount: 5,
      productCount: 500,
      invoiceCount: 1000,
      interval: 'months',
      intervalCount: 1,
      trialDays: 14,
      price: 29.99,
      sortOrder: 2,
      isActive: true,
      isPrivate: false,
      customPermissions: {
        modules: ['pos', 'products', 'customers', 'suppliers', 'expenses'],
        features: ['basic_reporting', 'inventory_management']
      }
    }
  })

  const proPackage = await prisma.package.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: 'Professional',
      description: 'For growing businesses with multiple locations',
      locationCount: 5,
      userCount: 25,
      productCount: 5000,
      invoiceCount: null, // Unlimited
      interval: 'months',
      intervalCount: 1,
      trialDays: 14,
      price: 99.99,
      sortOrder: 3,
      isActive: true,
      isPrivate: false,
      customPermissions: {
        modules: ['pos', 'products', 'customers', 'suppliers', 'expenses', 'purchases', 'stock_transfers'],
        features: ['advanced_reporting', 'inventory_management', 'multi_location', 'user_management']
      }
    }
  })

  const enterprisePackage = await prisma.package.upsert({
    where: { id: 4 },
    update: {},
    create: {
      name: 'Enterprise',
      description: 'For large businesses with unlimited needs',
      locationCount: 999,
      userCount: 999,
      productCount: 999999,
      invoiceCount: null, // Unlimited
      interval: 'months',
      intervalCount: 1,
      trialDays: 30,
      price: 299.99,
      sortOrder: 4,
      isActive: true,
      isPrivate: false,
      customPermissions: {
        modules: ['all'],
        features: ['all']
      }
    }
  })
  console.log('✅ Subscription packages created')

  // Create subscription for the demo business
  const subscription = await prisma.subscription.upsert({
    where: { id: 1 },
    update: {},
    create: {
      businessId: business.id,
      packageId: enterprisePackage.id,
      startDate: new Date(),
      trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      packagePrice: enterprisePackage.price,
      packageDetails: enterprisePackage as any,
      status: 'approved',
      createdBy: superAdmin.id
    }
  })
  console.log('✅ Subscription created for demo business')

  // Create Product Metadata (Categories, Brands, Units, Tax Rates)
  const electronicsCategory = await prisma.category.upsert({
    where: { id: 1 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Electronics',
      shortCode: 'ELEC',
      description: 'Electronic devices and accessories'
    }
  })

  const computersCategory = await prisma.category.upsert({
    where: { id: 2 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Computers',
      shortCode: 'COMP',
      description: 'Desktop and laptop computers'
    }
  })

  const accessoriesCategory = await prisma.category.upsert({
    where: { id: 3 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Accessories',
      shortCode: 'ACC',
      description: 'Computer accessories and peripherals'
    }
  })

  const dellBrand = await prisma.brand.upsert({
    where: { id: 1 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Dell',
      description: 'Dell Inc. - American technology company'
    }
  })

  const hpBrand = await prisma.brand.upsert({
    where: { id: 2 },
    update: {},
    create: {
      businessId: business.id,
      name: 'HP',
      description: 'Hewlett-Packard - Leading PC manufacturer'
    }
  })

  const logitechBrand = await prisma.brand.upsert({
    where: { id: 3 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Logitech',
      description: 'Swiss provider of personal computer and mobile peripherals'
    }
  })

  const piecesUnit = await prisma.unit.upsert({
    where: { id: 1 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Pieces',
      shortName: 'Pc(s)',
      allowDecimal: false
    }
  })

  const boxUnit = await prisma.unit.upsert({
    where: { id: 2 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Box',
      shortName: 'Box',
      allowDecimal: false
    }
  })

  const standardTax = await prisma.taxRate.upsert({
    where: { id: 1 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Standard VAT',
      amount: 10.00,
      isDefault: true
    }
  })

  const reducedTax = await prisma.taxRate.upsert({
    where: { id: 2 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Reduced VAT',
      amount: 5.00,
      isDefault: false
    }
  })
  console.log('✅ Product metadata created (categories, brands, units, taxes)')

  // Create Sample Sales Personnel
  const salesPerson1 = await prisma.salesPersonnel.upsert({
    where: {
      businessId_employeeCode: {
        businessId: business.id,
        employeeCode: 'SP-001',
      },
    },
    update: {},
    create: {
      businessId: business.id,
      employeeCode: 'SP-001',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      email: 'juan.delacruz@pcinetstore.com',
      mobile: '+63-912-555-1001',
      salesTarget: 50000.00,
      commissionRate: 2.5,
      isActive: true,
      hireDate: new Date('2023-01-15'),
    },
  })

  const salesPerson2 = await prisma.salesPersonnel.upsert({
    where: {
      businessId_employeeCode: {
        businessId: business.id,
        employeeCode: 'SP-002',
      },
    },
    update: {},
    create: {
      businessId: business.id,
      employeeCode: 'SP-002',
      firstName: 'Maria',
      lastName: 'Santos',
      email: 'maria.santos@pcinetstore.com',
      mobile: '+63-912-555-1002',
      salesTarget: 75000.00,
      commissionRate: 3.0,
      isActive: true,
      hireDate: new Date('2022-06-01'),
    },
  })

  const salesPerson3 = await prisma.salesPersonnel.upsert({
    where: {
      businessId_employeeCode: {
        businessId: business.id,
        employeeCode: 'SP-003',
      },
    },
    update: {},
    create: {
      businessId: business.id,
      employeeCode: 'SP-003',
      firstName: 'Pedro',
      lastName: 'Reyes',
      email: 'pedro.reyes@pcinetstore.com',
      mobile: '+63-912-555-1003',
      salesTarget: 60000.00,
      commissionRate: 2.75,
      isActive: true,
      hireDate: new Date('2023-03-10'),
    },
  })

  const salesPerson4 = await prisma.salesPersonnel.upsert({
    where: {
      businessId_employeeCode: {
        businessId: business.id,
        employeeCode: 'SP-004',
      },
    },
    update: {},
    create: {
      businessId: business.id,
      employeeCode: 'SP-004',
      firstName: 'Ana',
      lastName: 'Garcia',
      email: 'ana.garcia@pcinetstore.com',
      mobile: '+63-912-555-1004',
      salesTarget: 40000.00,
      commissionRate: 2.0,
      isActive: false,  // Inactive example
      hireDate: new Date('2021-09-20'),
      terminationDate: new Date('2024-06-30'),
    },
  })

  console.log('✅ Sample Sales Personnel created (4 personnel: 3 active, 1 inactive)')

  // Create Sample Products
  const laptop1 = await prisma.product.upsert({
    where: { id: 1 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Dell Inspiron 15 Laptop',
      type: 'single',
      categoryId: computersCategory.id,
      brandId: dellBrand.id,
      unitId: piecesUnit.id,
      taxId: standardTax.id,
      taxType: 'inclusive',
      sku: 'PCI-LAP-DELL-001',
      barcodeType: 'Code128',
      description: '15.6" FHD Display, Intel Core i5, 8GB RAM, 512GB SSD',
      productDescription: 'Perfect laptop for everyday computing needs with solid performance and reliability',
      image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400',
      enableStock: true,
      alertQuantity: 5,
      purchasePrice: 450.00,
      sellingPrice: 699.99
    }
  })

  const laptop2 = await prisma.product.upsert({
    where: { id: 2 },
    update: {},
    create: {
      businessId: business.id,
      name: 'HP Pavilion Gaming Laptop',
      type: 'single',
      categoryId: computersCategory.id,
      brandId: hpBrand.id,
      unitId: piecesUnit.id,
      taxId: standardTax.id,
      taxType: 'inclusive',
      sku: 'PCI-LAP-HP-001',
      barcodeType: 'Code128',
      description: '15.6" FHD 144Hz, AMD Ryzen 5, 16GB RAM, 512GB SSD, GTX 1650',
      productDescription: 'Gaming laptop with excellent performance for both gaming and productivity',
      image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=400',
      enableStock: true,
      alertQuantity: 3,
      purchasePrice: 650.00,
      sellingPrice: 999.99
    }
  })

  const mouse = await prisma.product.upsert({
    where: { id: 3 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Logitech M185 Wireless Mouse',
      type: 'single',
      categoryId: accessoriesCategory.id,
      brandId: logitechBrand.id,
      unitId: piecesUnit.id,
      taxId: reducedTax.id,
      taxType: 'inclusive',
      sku: 'PCI-MOU-LOG-001',
      barcodeType: 'Code128',
      description: 'Wireless mouse with 2.4GHz connection, up to 12 months battery life',
      productDescription: 'Reliable wireless mouse for daily use with plug-and-play simplicity',
      image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400',
      enableStock: true,
      alertQuantity: 10,
      purchasePrice: 8.00,
      sellingPrice: 14.99
    }
  })

  const keyboard = await prisma.product.upsert({
    where: { id: 4 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Logitech K380 Bluetooth Keyboard',
      type: 'variable',
      categoryId: accessoriesCategory.id,
      brandId: logitechBrand.id,
      unitId: piecesUnit.id,
      taxId: reducedTax.id,
      taxType: 'inclusive',
      sku: 'PCI-KEY-LOG-001',
      barcodeType: 'Code128',
      description: 'Multi-device Bluetooth keyboard, compact design',
      productDescription: 'Portable keyboard that can connect to up to 3 devices',
      image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400',
      enableStock: true,
      alertQuantity: 15,
      purchasePrice: null,
      sellingPrice: null
    }
  })

  // Create keyboard variations
  const keyboardBlack = await prisma.productVariation.upsert({
    where: { id: 1 },
    update: {},
    create: {
      businessId: business.id,
      productId: keyboard.id,
      name: 'Black',
      sku: 'PCI-KEY-LOG-001-BLK',
      purchasePrice: 20.00,
      sellingPrice: 34.99,
      isDefault: true,
      unitId: piecesUnit.id
    }
  })

  const keyboardWhite = await prisma.productVariation.upsert({
    where: { id: 2 },
    update: {},
    create: {
      businessId: business.id,
      productId: keyboard.id,
      name: 'White',
      sku: 'PCI-KEY-LOG-001-WHT',
      purchasePrice: 20.00,
      sellingPrice: 34.99,
      isDefault: false,
      unitId: piecesUnit.id
    }
  })

  const keyboardPink = await prisma.productVariation.upsert({
    where: { id: 3 },
    update: {},
    create: {
      businessId: business.id,
      productId: keyboard.id,
      name: 'Pink',
      sku: 'PCI-KEY-LOG-001-PNK',
      purchasePrice: 22.00,
      sellingPrice: 39.99,
      isDefault: false,
      unitId: piecesUnit.id
    }
  })

  const monitor = await prisma.product.upsert({
    where: { id: 5 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Dell 24" FHD Monitor',
      type: 'single',
      categoryId: electronicsCategory.id,
      brandId: dellBrand.id,
      unitId: piecesUnit.id,
      taxId: standardTax.id,
      taxType: 'inclusive',
      sku: 'PCI-MON-DELL-001',
      barcodeType: 'Code128',
      description: '24-inch Full HD IPS Monitor, 75Hz, AMD FreeSync',
      productDescription: 'Professional monitor with vibrant colors and smooth performance',
      image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400',
      enableStock: true,
      alertQuantity: 5,
      purchasePrice: 120.00,
      sellingPrice: 199.99
    }
  })

  // Create stock for products in locations
  await prisma.variationLocationDetails.create({
    data: {
      productId: laptop1.id,
      productVariationId: (await prisma.productVariation.create({
        data: {
          businessId: business.id,
          productId: laptop1.id,
          name: 'Default',
          sku: laptop1.sku,
          purchasePrice: laptop1.purchasePrice || 0,
          sellingPrice: laptop1.sellingPrice || 0,
          isDefault: true
        }
      })).id,
      locationId: mainLocation.id,
      qtyAvailable: 15
    }
  })

  await prisma.variationLocationDetails.create({
    data: {
      productId: laptop2.id,
      productVariationId: (await prisma.productVariation.create({
        data: {
          businessId: business.id,
          productId: laptop2.id,
          name: 'Default',
          sku: laptop2.sku,
          purchasePrice: laptop2.purchasePrice || 0,
          sellingPrice: laptop2.sellingPrice || 0,
          isDefault: true
        }
      })).id,
      locationId: mainLocation.id,
      qtyAvailable: 8
    }
  })

  await prisma.variationLocationDetails.create({
    data: {
      productId: mouse.id,
      productVariationId: (await prisma.productVariation.create({
        data: {
          businessId: business.id,
          productId: mouse.id,
          name: 'Default',
          sku: mouse.sku,
          purchasePrice: mouse.purchasePrice || 0,
          sellingPrice: mouse.sellingPrice || 0,
          isDefault: true
        }
      })).id,
      locationId: mainLocation.id,
      qtyAvailable: 45
    }
  })

  await prisma.variationLocationDetails.upsert({
    where: {
      productVariationId_locationId: {
        productVariationId: keyboardBlack.id,
        locationId: mainLocation.id,
      }
    },
    update: {},
    create: {
      productId: keyboard.id,
      productVariationId: keyboardBlack.id,
      locationId: mainLocation.id,
      qtyAvailable: 20
    }
  })

  await prisma.variationLocationDetails.upsert({
    where: {
      productVariationId_locationId: {
        productVariationId: keyboardWhite.id,
        locationId: mainLocation.id,
      }
    },
    update: {},
    create: {
      productId: keyboard.id,
      productVariationId: keyboardWhite.id,
      locationId: mainLocation.id,
      qtyAvailable: 18
    }
  })

  await prisma.variationLocationDetails.upsert({
    where: {
      productVariationId_locationId: {
        productVariationId: keyboardPink.id,
        locationId: mainLocation.id,
      }
    },
    update: {},
    create: {
      productId: keyboard.id,
      productVariationId: keyboardPink.id,
      locationId: mainLocation.id,
      qtyAvailable: 12
    }
  })

  await prisma.variationLocationDetails.create({
    data: {
      productId: monitor.id,
      productVariationId: (await prisma.productVariation.create({
        data: {
          businessId: business.id,
          productId: monitor.id,
          name: 'Default',
          sku: monitor.sku,
          purchasePrice: monitor.purchasePrice || 0,
          sellingPrice: monitor.sellingPrice || 0,
          isDefault: true
        }
      })).id,
      locationId: mainLocation.id,
      qtyAvailable: 12
    }
  })

  console.log('✅ Sample products created with stock')

  console.log('\n🎉 Database seeded successfully!')
  console.log('\n📝 Demo Accounts:')
  console.log('─'.repeat(80))
  console.log('Super Admin:         superadmin       / password  (All Locations)')
  console.log('Branch Manager:      branchmanager    / password  (Main Store only)')
  console.log('Warehouse Manager:   warehousemanager / password  (Warehouse only)')
  console.log('Transfer Creator:    transfercreator  / password  (Main Store only)')
  console.log('Sales Cashier:       cashier          / password  (Tuguegarao Downtown only)')
  console.log('─'.repeat(80))
  console.log('\n🔢 Inventory Correction Accounts (Location-Specific):')
  console.log('─'.repeat(80))
  console.log('Inv Counter (Main):  invcormain       / 111111    (Main Store only)')
  console.log('Inv Counter (Bambang): invcorbambang  / 111111    (Bambang only)')
  console.log('Inv Counter (Tugue): invcortugue      / 111111    (Tuguegarao Downtown only)')
  console.log('Inv Approver:        invcorApprover   / 111111    (All Locations - Approval Only)')
  console.log('─'.repeat(80))
  console.log(`\n✅ ${roleMap.size} task-specific roles created with granular permissions`)
  console.log('   Roles include: Transfer Creator, Transfer Sender, Transfer Receiver,')
  console.log('   Purchase Order Creator, Goods Receipt Clerk, Sales Cashier, and more!')
  console.log('─'.repeat(80))
  console.log('\n📦 Subscription Packages:')
  console.log('─'.repeat(50))
  console.log(`Free Trial:     $${freePackage.price}/month (30 days trial)`)
  console.log(`Basic:          $${basicPackage.price}/month`)
  console.log(`Professional:   $${proPackage.price}/month`)
  console.log(`Enterprise:     $${enterprisePackage.price}/month`)
  console.log('─'.repeat(50))
  console.log('\n📦 Sample Products Created:')
  console.log('─'.repeat(50))
  console.log('✓ 5 Products (Laptops, Mouse, Keyboard, Monitor)')
  console.log('✓ 3 Categories (Electronics, Computers, Accessories)')
  console.log('✓ 3 Brands (Dell, HP, Logitech)')
  console.log('✓ 2 Units (Pieces, Box)')
  console.log('✓ 2 Tax Rates (Standard 10%, Reduced 5%)')
  console.log('─'.repeat(50))
  console.log('\n👥 Sample Sales Personnel Created:')
  console.log('─'.repeat(50))
  console.log('✓ Juan Dela Cruz (SP-001) - Active, Target: ₱50,000')
  console.log('✓ Maria Santos (SP-002) - Active, Target: ₱75,000')
  console.log('✓ Pedro Reyes (SP-003) - Active, Target: ₱60,000')
  console.log('✓ Ana Garcia (SP-004) - Inactive (Terminated)')
  console.log('─'.repeat(50))
  console.log('\n📊 Accounting Setup:')
  console.log('─'.repeat(50))
  console.log('✓ Chart of Accounts initialized (Assets, Liabilities, Equity, Revenue, Expenses)')
  console.log('✓ Balance Sheet ready to use')
  console.log('✓ Income Statement ready to use')
  console.log('✓ Cash Flow Statement ready to use')
  console.log('─'.repeat(50))
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
