import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// All users mentioned in COMPLETE_DEMO_ACCOUNTS_ALL_WORKFLOWS.md
const documentedUsers = {
  'System Administrators': [
    'superadmin',
    'jayvillalon',
    'Gemski'
  ],
  'Main Store Transfer Users': [
    'mainstore_clerk',
    'mainstore_supervisor',
    'store_manager',
    'mainstore_receiver'
  ],
  'Main Warehouse Transfer Users': [
    'warehouse_clerk',
    'warehouse_supervisor',
    'warehouse_manager',
    'warehouse_receiver',
    'warehousesender',
    'Jheirone'
  ],
  'Bambang Transfer Users': [
    'bambang_clerk',
    'bambang_supervisor',
    'bambang_manager',
    'bambang_receiver'
  ],
  'Tuguegarao Transfer Users': [
    'tugue_clerk',
    'tugue_supervisor',
    'tugue_manager',
    'tugue_receiver'
  ],
  'Special Transfer Roles': [
    'MainStoreApprove',
    'mainverifier'
  ],
  'Main Store Inventory Correction Users': [
    'mainstore_inv_creator',
    'mainstore_inv_approver'
  ],
  'Main Warehouse Inventory Correction Users': [
    'mainwarehouse_inv_creator',
    'mainwarehouse_inv_approver'
  ],
  'Bambang Inventory Correction Users': [
    'bambang_inv_creator',
    'bambang_inv_approver'
  ],
  'Tuguegarao Inventory Correction Users': [
    'tuguegarao_inv_creator',
    'tuguegarao_inv_approver'
  ],
  'Main Store Sales Users': [
    'mainstore_cashier',
    'mainstore_sales_mgr',
    'mainmgr'
  ],
  'Main Warehouse Sales Users': [
    'mainwarehouse_cashier',
    'mainwarehouse_sales_mgr'
  ],
  'Bambang Sales Users': [
    'bambang_cashier',
    'bambang_sales_mgr'
  ],
  'Tuguegarao Sales Users': [
    'tuguegarao_cashier',
    'tuguegarao_sales_mgr'
  ],
  'Legacy Cashier Account': [
    'cashiermain'
  ],
  'Main Store Purchase Users': [
    'mainstore_purchase_creator',
    'mainstore_purchase_approver',
    'mainstore_grn_receiver'
  ],
  'Main Warehouse Purchase Users': [
    'mainwarehouse_purchase_creator',
    'mainwarehouse_purchase_approver',
    'mainwarehouse_grn_receiver'
  ],
  'Bambang Purchase Users': [
    'bambang_purchase_creator',
    'bambang_purchase_approver',
    'bambang_grn_receiver'
  ],
  'Tuguegarao Purchase Users': [
    'tuguegarao_purchase_creator',
    'tuguegarao_purchase_approver',
    'tuguegarao_grn_receiver'
  ],
  'Main Store Supplier Return Users': [
    'mainstore_return_creator',
    'mainstore_return_approver'
  ],
  'Main Warehouse Supplier Return Users': [
    'mainwarehouse_return_creator',
    'mainwarehouse_return_approver'
  ],
  'Bambang Supplier Return Users': [
    'bambang_return_creator',
    'bambang_return_approver'
  ],
  'Tuguegarao Supplier Return Users': [
    'tuguegarao_return_creator',
    'tuguegarao_return_approver'
  ],
  'Main Store Customer Return Users': [
    'mainstore_cust_return_processor'
  ],
  'Main Warehouse Customer Return Users': [
    'mainwarehouse_cust_return_processor'
  ],
  'Bambang Customer Return Users': [
    'bambang_cust_return_processor'
  ],
  'Tuguegarao Customer Return Users': [
    'tuguegarao_cust_return_processor'
  ]
};

async function verifyAccounts() {
  const users = await prisma.user.findMany({
    include: {
      userLocations: {
        include: {
          location: true
        }
      },
      roles: {
        include: {
          role: true
        }
      }
    }
  });

  const existingUsernames = new Set(users.map(u => u.username));
  const allDocumentedUsernames = new Set();

  console.log('=== VERIFICATION REPORT ===\n');

  const missing = [];
  const found = [];

  Object.entries(documentedUsers).forEach(([category, usernames]) => {
    usernames.forEach(username => {
      allDocumentedUsernames.add(username);
      if (existingUsernames.has(username)) {
        found.push({ category, username });
      } else {
        missing.push({ category, username });
      }
    });
  });

  console.log(`📊 SUMMARY:`);
  console.log(`   Total documented users: ${allDocumentedUsernames.size}`);
  console.log(`   Existing in database: ${found.length}`);
  console.log(`   Missing from database: ${missing.length}`);

  if (missing.length > 0) {
    console.log('\n\n❌ MISSING USERS (documented but NOT in database):\n');
    console.log('─'.repeat(100));

    const missingByCategory = {};
    missing.forEach(({ category, username }) => {
      if (!missingByCategory[category]) {
        missingByCategory[category] = [];
      }
      missingByCategory[category].push(username);
    });

    Object.entries(missingByCategory).forEach(([category, usernames]) => {
      console.log(`\n${category}:`);
      usernames.forEach(username => {
        console.log(`  - ${username}`);
      });
    });
  }

  // Check for users in database but not documented
  const undocumented = [];
  users.forEach(user => {
    if (!allDocumentedUsernames.has(user.username)) {
      const locations = user.userLocations.map(ul => ul.location.name).join(', ') || 'No Location';
      undocumented.push({
        username: user.username,
        location: locations,
        roles: user.roles.map(ur => ur.role.name).join(', ')
      });
    }
  });

  if (undocumented.length > 0) {
    console.log('\n\n⚠️  UNDOCUMENTED USERS (in database but NOT documented):\n');
    console.log('─'.repeat(100));
    undocumented.forEach(({ username, location, roles }) => {
      console.log(`  - ${username.padEnd(35)} | Location: ${location.padEnd(25)} | Role: ${roles}`);
    });
  }

  // Now identify business rule violations
  console.log('\n\n🔍 BUSINESS RULE VIOLATIONS:\n');
  console.log('─'.repeat(100));

  const violations = [];

  // Rule 1: No sales users in Main Warehouse (Warehouse)
  const warehouseSalesUsers = ['mainwarehouse_cashier', 'mainwarehouse_sales_mgr'];
  warehouseSalesUsers.forEach(username => {
    if (existingUsernames.has(username)) {
      violations.push({
        type: 'SALES_IN_WAREHOUSE',
        username,
        reason: 'Sales users should NOT exist in Main Warehouse (warehouse is for inventory/purchasing only)'
      });
    }
  });

  // Rule 2: No purchase users in branches (only Main Warehouse should handle purchases)
  const branchPurchaseUsers = [
    'mainstore_purchase_creator',
    'mainstore_purchase_approver',
    'mainstore_grn_receiver',
    'bambang_purchase_creator',
    'bambang_purchase_approver',
    'bambang_grn_receiver',
    'tuguegarao_purchase_creator',
    'tuguegarao_purchase_approver',
    'tuguegarao_grn_receiver'
  ];

  branchPurchaseUsers.forEach(username => {
    if (existingUsernames.has(username)) {
      violations.push({
        type: 'PURCHASE_IN_BRANCH',
        username,
        reason: 'Purchase users should ONLY exist in Main Warehouse (branches do not enter purchases)'
      });
    }
  });

  if (violations.length > 0) {
    const byType = {};
    violations.forEach(v => {
      if (!byType[v.type]) {
        byType[v.type] = [];
      }
      byType[v.type].push(v);
    });

    Object.entries(byType).forEach(([type, items]) => {
      console.log(`\n${type === 'SALES_IN_WAREHOUSE' ? '❌ Sales Users in Warehouse (REMOVE)' : '❌ Purchase Users in Branches (REMOVE)'}:`);
      items.forEach(({ username, reason }) => {
        console.log(`  - ${username.padEnd(40)} | ${reason}`);
      });
    });
  } else {
    console.log('✅ No business rule violations found!');
  }

  // Recommendations
  console.log('\n\n💡 RECOMMENDATIONS:\n');
  console.log('─'.repeat(100));

  if (missing.length > 0) {
    console.log('1. ADD missing users to the database OR remove them from documentation');
  }

  if (violations.length > 0) {
    console.log('2. REMOVE the following users from documentation (they violate business rules):');
    violations.forEach(({ username }) => {
      console.log(`   - ${username}`);
    });
    console.log('3. OPTIONALLY remove these users from the database as well');
  }

  if (undocumented.length > 0) {
    console.log('4. ADD undocumented users to the documentation OR remove them if not needed');
  }

  // Specific answers to the user's questions
  console.log('\n\n📋 ANSWERS TO YOUR QUESTIONS:\n');
  console.log('─'.repeat(100));

  console.log('\n1️⃣  PURCHASE WORKFLOW USERS:');
  const purchaseEncoder = users.find(u => u.username === 'warehouse_clerk');
  const purchaseApprover = users.find(u => u.username === 'warehouse_manager');

  if (purchaseEncoder) {
    const locations = purchaseEncoder.userLocations.map(ul => ul.location.name).join(', ') || 'No Location';
    console.log(`   ✅ ENCODING: warehouse_clerk (exists, locations: ${locations})`);
  } else {
    console.log('   ❌ ENCODING: warehouse_clerk (NOT FOUND)');
  }

  if (purchaseApprover) {
    const locations = purchaseApprover.userLocations.map(ul => ul.location.name).join(', ') || 'No Location';
    console.log(`   ✅ APPROVE GRN: warehouse_manager (exists, locations: ${locations})`);
  } else {
    console.log('   ❌ APPROVE GRN: warehouse_manager (NOT FOUND)');
  }

  console.log('\n2️⃣  TRANSFER WORKFLOW USERS (similar pattern to purchase):');
  console.log('   ENCODING: warehouse_clerk');
  console.log('   CHECKING: warehouse_supervisor');
  console.log('   SENDING: warehouse_manager');
  console.log('   RECEIVING: [depends on destination location]_receiver');
}

verifyAccounts().finally(() => prisma.$disconnect());
