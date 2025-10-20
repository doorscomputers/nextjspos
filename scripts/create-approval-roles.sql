-- ============================================================================
-- CREATE APPROVAL ROLES FOR ULTIMATEPOS MODERN
-- ============================================================================
-- This SQL script creates specialized approval roles with appropriate permissions.
-- Run this script after setting the @business_id variable to your business ID.
--
-- Usage:
--   1. Open your database client (MySQL/PostgreSQL)
--   2. Set @business_id to your business ID (see below)
--   3. Execute this entire script
--
-- Alternatively, use the Node.js script:
--   node scripts/create-approval-roles.mjs
-- ============================================================================

-- ============================================================================
-- STEP 1: SET YOUR BUSINESS ID
-- ============================================================================
-- Replace 1 with your actual business ID
SET @business_id = 1;

-- ============================================================================
-- STEP 2: CREATE APPROVAL ROLES
-- ============================================================================

-- 1. Transfer Approver
INSERT INTO roles (name, guard_name, business_id, is_default, created_at, updated_at)
SELECT
    'Transfer Approver',
    'web',
    @business_id,
    0,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM roles
    WHERE name = 'Transfer Approver' AND business_id = @business_id
);

-- 2. GRN Approver
INSERT INTO roles (name, guard_name, business_id, is_default, created_at, updated_at)
SELECT
    'GRN Approver',
    'web',
    @business_id,
    0,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM roles
    WHERE name = 'GRN Approver' AND business_id = @business_id
);

-- 3. Inventory Correction Approver
INSERT INTO roles (name, guard_name, business_id, is_default, created_at, updated_at)
SELECT
    'Inventory Correction Approver',
    'web',
    @business_id,
    0,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM roles
    WHERE name = 'Inventory Correction Approver' AND business_id = @business_id
);

-- 4. Return Approver
INSERT INTO roles (name, guard_name, business_id, is_default, created_at, updated_at)
SELECT
    'Return Approver',
    'web',
    @business_id,
    0,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM roles
    WHERE name = 'Return Approver' AND business_id = @business_id
);

-- 5. Purchase Approver
INSERT INTO roles (name, guard_name, business_id, is_default, created_at, updated_at)
SELECT
    'Purchase Approver',
    'web',
    @business_id,
    0,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM roles
    WHERE name = 'Purchase Approver' AND business_id = @business_id
);

-- 6. QC Inspector
INSERT INTO roles (name, guard_name, business_id, is_default, created_at, updated_at)
SELECT
    'QC Inspector',
    'web',
    @business_id,
    0,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM roles
    WHERE name = 'QC Inspector' AND business_id = @business_id
);

-- ============================================================================
-- STEP 3: ASSIGN PERMISSIONS TO ROLES
-- ============================================================================

-- Get role IDs (we'll use these in the next steps)
SET @transfer_approver_id = (SELECT id FROM roles WHERE name = 'Transfer Approver' AND business_id = @business_id LIMIT 1);
SET @grn_approver_id = (SELECT id FROM roles WHERE name = 'GRN Approver' AND business_id = @business_id LIMIT 1);
SET @inventory_correction_approver_id = (SELECT id FROM roles WHERE name = 'Inventory Correction Approver' AND business_id = @business_id LIMIT 1);
SET @return_approver_id = (SELECT id FROM roles WHERE name = 'Return Approver' AND business_id = @business_id LIMIT 1);
SET @purchase_approver_id = (SELECT id FROM roles WHERE name = 'Purchase Approver' AND business_id = @business_id LIMIT 1);
SET @qc_inspector_id = (SELECT id FROM roles WHERE name = 'QC Inspector' AND business_id = @business_id LIMIT 1);

-- ============================================================================
-- TRANSFER APPROVER PERMISSIONS
-- ============================================================================
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT @transfer_approver_id, p.id
FROM permissions p
WHERE p.name IN (
    'dashboard.view',
    'stock_transfer.view',
    'stock_transfer.check',
    'stock_transfer.send',
    'stock_transfer.receive',
    'stock_transfer.verify',
    'stock_transfer.complete',
    'stock_transfer.cancel',
    'location.view',
    'product.view',
    'report.transfer.view',
    'report.transfer.trends',
    'audit_log.view'
);

-- ============================================================================
-- GRN APPROVER PERMISSIONS
-- ============================================================================
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT @grn_approver_id, p.id
FROM permissions p
WHERE p.name IN (
    'dashboard.view',
    'purchase.receipt.view',
    'purchase.receipt.approve',
    'purchase.view',
    'product.view',
    'supplier.view',
    'serial_number.view',
    'serial_number.track',
    'location.view',
    'report.purchase.view',
    'audit_log.view'
);

-- ============================================================================
-- INVENTORY CORRECTION APPROVER PERMISSIONS
-- ============================================================================
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT @inventory_correction_approver_id, p.id
FROM permissions p
WHERE p.name IN (
    'dashboard.view',
    'inventory_correction.view',
    'inventory_correction.approve',
    'product.view',
    'location.view',
    'inventory_ledger.view',
    'report.stock.view',
    'report.stock_alert',
    'view_inventory_reports',
    'audit_log.view'
);

-- ============================================================================
-- RETURN APPROVER PERMISSIONS
-- ============================================================================
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT @return_approver_id, p.id
FROM permissions p
WHERE p.name IN (
    'dashboard.view',
    'customer_return.view',
    'customer_return.approve',
    'supplier_return.view',
    'supplier_return.approve',
    'product.view',
    'customer.view',
    'supplier.view',
    'location.view',
    'serial_number.view',
    'audit_log.view'
);

-- ============================================================================
-- PURCHASE APPROVER PERMISSIONS
-- ============================================================================
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT @purchase_approver_id, p.id
FROM permissions p
WHERE p.name IN (
    'dashboard.view',
    'purchase.view',
    'purchase.approve',
    'product.view',
    'supplier.view',
    'location.view',
    'report.purchase.view',
    'audit_log.view'
);

-- ============================================================================
-- QC INSPECTOR PERMISSIONS
-- ============================================================================
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT @qc_inspector_id, p.id
FROM permissions p
WHERE p.name IN (
    'dashboard.view',
    'qc_inspection.view',
    'qc_inspection.conduct',
    'qc_inspection.approve',
    'qc_template.view',
    'product.view',
    'purchase.receipt.view',
    'supplier.view',
    'audit_log.view'
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Show created roles
SELECT
    id,
    name,
    business_id,
    is_default,
    created_at
FROM roles
WHERE business_id = @business_id
    AND name IN (
        'Transfer Approver',
        'GRN Approver',
        'Inventory Correction Approver',
        'Return Approver',
        'Purchase Approver',
        'QC Inspector'
    )
ORDER BY name;

-- Show permission counts for each role
SELECT
    r.name as role_name,
    COUNT(rp.permission_id) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.business_id = @business_id
    AND r.name IN (
        'Transfer Approver',
        'GRN Approver',
        'Inventory Correction Approver',
        'Return Approver',
        'Purchase Approver',
        'QC Inspector'
    )
GROUP BY r.id, r.name
ORDER BY r.name;

-- ============================================================================
-- HOW TO ASSIGN ROLES TO USERS
-- ============================================================================

-- Example: Assign Transfer Approver role to user with ID 10
-- INSERT INTO user_roles (user_id, role_id)
-- VALUES (10, @transfer_approver_id);

-- Example: Assign multiple roles to a user
-- INSERT INTO user_roles (user_id, role_id)
-- VALUES
--     (10, @transfer_approver_id),
--     (10, @grn_approver_id),
--     (10, @return_approver_id);

-- ============================================================================
-- HOW TO RESTRICT ROLE TO SPECIFIC LOCATIONS
-- ============================================================================

-- Example: Restrict Transfer Approver to location ID 1 and 2
-- INSERT INTO role_locations (role_id, location_id, created_at)
-- VALUES
--     (@transfer_approver_id, 1, NOW()),
--     (@transfer_approver_id, 2, NOW());

-- ============================================================================
-- HOW TO GRANT ACCESS TO ALL LOCATIONS
-- ============================================================================

-- Example: Grant Transfer Approver access to all locations
-- SET @access_all_locations_perm_id = (SELECT id FROM permissions WHERE name = 'access_all_locations' LIMIT 1);
-- INSERT IGNORE INTO role_permissions (role_id, permission_id)
-- VALUES (@transfer_approver_id, @access_all_locations_perm_id);

-- ============================================================================
-- CLEANUP (OPTIONAL)
-- ============================================================================

-- To remove a role and all its assignments (BE CAREFUL!):
-- DELETE FROM role_permissions WHERE role_id = @transfer_approver_id;
-- DELETE FROM user_roles WHERE role_id = @transfer_approver_id;
-- DELETE FROM role_locations WHERE role_id = @transfer_approver_id;
-- DELETE FROM roles WHERE id = @transfer_approver_id;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================

SELECT
    '✅ Approval roles created successfully!' as status,
    'Run verification queries above to confirm' as next_step;
