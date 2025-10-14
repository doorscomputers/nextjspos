import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { PERMISSIONS, DEFAULT_ROLES } from '../src/lib/rbac'

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
  const mainLocation = await prisma.businessLocation.upsert({
    where: { id: 1 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Main Store',
      country: 'Philippines',
      state: 'Cagayan Valley',
      city: 'Tuguegarao',
      zipCode: '3500',
      mobile: '+63-912-555-0001',
      email: 'main@pcinetstore.com',
    },
  })

  const warehouseLocation = await prisma.businessLocation.upsert({
    where: { id: 2 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Warehouse',
      country: 'Philippines',
      state: 'Cagayan Valley',
      city: 'Tuguegarao',
      zipCode: '3500',
      mobile: '+63-912-555-0002',
      email: 'warehouse@pcinetstore.com',
    },
  })

  const bambangLocation = await prisma.businessLocation.upsert({
    where: { id: 3 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Bambang',
      country: 'Philippines',
      state: 'Nueva Vizcaya',
      city: 'Bambang',
      zipCode: '3702',
      mobile: '+63-912-555-0003',
      email: 'bambang@pcinetstore.com',
    },
  })

  const downtownLocation = await prisma.businessLocation.upsert({
    where: { id: 4 },
    update: {},
    create: {
      businessId: business.id,
      name: 'Tuguegarao Downtown',
      country: 'Philippines',
      state: 'Cagayan Valley',
      city: 'Tuguegarao',
      zipCode: '3500',
      mobile: '+63-912-555-0004',
      email: 'downtown@pcinetstore.com',
    },
  })
  console.log('✅ Business locations created (4 branches)')

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

  // Create Roles
  const superAdminRole = await prisma.role.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Super Admin',
      businessId: business.id,
      guardName: 'web',
      isDefault: true, // Super Admin is protected (cannot be edited/deleted)
    },
  })

  const branchAdminRole = await prisma.role.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Branch Admin',
      businessId: business.id,
      guardName: 'web',
      isDefault: false,
    },
  })

  const branchManagerRole = await prisma.role.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: 'Branch Manager',
      businessId: business.id,
      guardName: 'web',
      isDefault: false,
    },
  })

  const accountingStaffRole = await prisma.role.upsert({
    where: { id: 4 },
    update: {},
    create: {
      name: 'Accounting Staff',
      businessId: business.id,
      guardName: 'web',
      isDefault: false,
    },
  })

  const regularStaffRole = await prisma.role.upsert({
    where: { id: 5 },
    update: {},
    create: {
      name: 'Regular Staff',
      businessId: business.id,
      guardName: 'web',
      isDefault: false,
    },
  })

  const cashierRole = await prisma.role.upsert({
    where: { id: 6 },
    update: {},
    create: {
      name: 'Regular Cashier',
      businessId: business.id,
      guardName: 'web',
      isDefault: false, // Can be edited (not protected)
    },
  })
  console.log('✅ Roles created')

  // Assign permissions to Super Admin Role (all permissions)
  for (const permission of permissionRecords) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: permission.id,
      },
    })
  }

  // Assign permissions to Branch Admin Role
  const branchAdminPermissions = permissionRecords.filter((p) =>
    DEFAULT_ROLES.BRANCH_ADMIN.permissions.includes(p.name)
  )
  for (const permission of branchAdminPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: branchAdminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: branchAdminRole.id,
        permissionId: permission.id,
      },
    })
  }

  // Assign permissions to Branch Manager Role
  const branchManagerPermissions = permissionRecords.filter((p) =>
    DEFAULT_ROLES.BRANCH_MANAGER.permissions.includes(p.name)
  )
  for (const permission of branchManagerPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: branchManagerRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: branchManagerRole.id,
        permissionId: permission.id,
      },
    })
  }

  // Assign permissions to Accounting Staff Role
  const accountingStaffPermissions = permissionRecords.filter((p) =>
    DEFAULT_ROLES.ACCOUNTING_STAFF.permissions.includes(p.name)
  )
  for (const permission of accountingStaffPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: accountingStaffRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: accountingStaffRole.id,
        permissionId: permission.id,
      },
    })
  }

  // Assign permissions to Regular Staff Role
  const regularStaffPermissions = permissionRecords.filter((p) =>
    DEFAULT_ROLES.REGULAR_STAFF.permissions.includes(p.name)
  )
  for (const permission of regularStaffPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: regularStaffRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: regularStaffRole.id,
        permissionId: permission.id,
      },
    })
  }

  // Assign permissions to Cashier Role
  const cashierPermissions = permissionRecords.filter((p) =>
    DEFAULT_ROLES.CASHIER.permissions.includes(p.name)
  )
  for (const permission of cashierPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: cashierRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: cashierRole.id,
        permissionId: permission.id,
      },
    })
  }
  console.log('✅ Permissions assigned to roles')

  // Create Demo Users
  // First, clear any existing user location assignments to avoid conflicts
  await prisma.userLocation.deleteMany({})

  // Delete old demo users to avoid email conflicts (cleanup from previous seeds)
  await prisma.user.deleteMany({
    where: {
      username: { in: ['branchadmin', 'branchmanager', 'accountant', 'warehousemanager', 'staff', 'cashier'] }
    }
  })

  const branchAdminUser = await prisma.user.upsert({
    where: { username: 'branchadmin' },
    update: {
      email: 'branchadmin@ultimatepos.com',
      surname: 'John',
      firstName: 'Williams',
      lastName: 'Branch Admin',
    },
    create: {
      surname: 'John',
      firstName: 'Williams',
      lastName: 'Branch Admin',
      username: 'branchadmin',
      email: 'branchadmin@ultimatepos.com',
      password: hashedPassword,
      businessId: business.id,
      allowLogin: true,
      userType: 'user',
    },
  })

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

  // Delete old accountant user if exists (migration from old username)
  await prisma.user.deleteMany({
    where: { username: 'accountant' }
  })

  const accountingStaffUser = await prisma.user.upsert({
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

  const regularStaffUser = await prisma.user.upsert({
    where: { username: 'staff' },
    update: {
      email: 'staff@ultimatepos.com',
      surname: 'Sarah',
      firstName: 'Miller',
      lastName: 'Staff',
    },
    create: {
      surname: 'Sarah',
      firstName: 'Miller',
      lastName: 'Staff',
      username: 'staff',
      email: 'staff@ultimatepos.com',
      password: hashedPassword,
      businessId: business.id,
      allowLogin: true,
      userType: 'user',
    },
  })

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
  console.log('✅ Demo users created')

  // Assign Roles to Users
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: superAdmin.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: superAdmin.id,
      roleId: superAdminRole.id,
    },
  })

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: branchAdminUser.id,
        roleId: branchAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: branchAdminUser.id,
      roleId: branchAdminRole.id,
    },
  })

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

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: accountingStaffUser.id,
        roleId: accountingStaffRole.id,
      },
    },
    update: {},
    create: {
      userId: accountingStaffUser.id,
      roleId: accountingStaffRole.id,
    },
  })

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: regularStaffUser.id,
        roleId: regularStaffRole.id,
      },
    },
    update: {},
    create: {
      userId: regularStaffUser.id,
      roleId: regularStaffRole.id,
    },
  })

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: cashierUser.id,
        roleId: cashierRole.id,
      },
    },
    update: {},
    create: {
      userId: cashierUser.id,
      roleId: cashierRole.id,
    },
  })
  console.log('✅ Roles assigned to users')

  // Assign Locations to Users
  // Branch Admin and Super Admin have ACCESS_ALL_LOCATIONS permission, so they see all branches
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

  // Warehouse Manager -> Assigned to Warehouse and Tuguegarao
  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: accountingStaffUser.id,
        locationId: warehouseLocation.id,
      },
    },
    update: {},
    create: {
      userId: accountingStaffUser.id,
      locationId: warehouseLocation.id,
    },
  })

  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: accountingStaffUser.id,
        locationId: downtownLocation.id,
      },
    },
    update: {},
    create: {
      userId: accountingStaffUser.id,
      locationId: downtownLocation.id,
    },
  })

  // Regular Staff -> Assigned to both Main Store and Bambang
  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: regularStaffUser.id,
        locationId: mainLocation.id,
      },
    },
    update: {},
    create: {
      userId: regularStaffUser.id,
      locationId: mainLocation.id,
    },
  })

  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: regularStaffUser.id,
        locationId: bambangLocation.id,
      },
    },
    update: {},
    create: {
      userId: regularStaffUser.id,
      locationId: bambangLocation.id,
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

  console.log('✅ User locations assigned:')
  console.log('  - Branch Manager -> Main Store')
  console.log('  - Accounting Staff (Warehouse Manager) -> Warehouse')
  console.log('  - Regular Staff -> Main Store + Bambang')
  console.log('  - Cashier -> Tuguegarao Downtown')

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
  console.log('Super Admin:       superadmin       / password  (All Locations)')
  console.log('Branch Admin:      branchadmin      / password  (All Locations)')
  console.log('Branch Manager:    branchmanager    / password  (Main Store only)')
  console.log('Warehouse Manager: warehousemanager / password  (Warehouse + Tuguegarao)')
  console.log('Regular Staff:     staff            / password  (Main Store + Bambang)')
  console.log('Regular Cashier:   cashier          / password  (Tuguegarao Downtown only)')
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
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
