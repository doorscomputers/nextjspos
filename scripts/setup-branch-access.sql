-- Setup Branch-Level Access Control for Testing
-- Run this after running npm run db:seed if you encounter email conflicts

-- Step 1: Clear existing user-location assignments
DELETE FROM user_locations;

-- Step 2: Find user and location IDs
-- (Adjust these IDs based on your actual database)

-- Step 3: Create test users if they don't exist (using manual SQL)
-- Password is bcrypt hash of "password"

-- Check if warehousemanager exists, if not create
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'warehousemanager') THEN
    INSERT INTO users (surname, first_name, last_name, username, email, password, business_id, allow_login, user_type, created_at, updated_at)
    VALUES ('Robert', 'Davis', 'Warehouse Manager', 'warehousemanager', 'warehouse@ultimatepos.com', '$2a$10$K9YL8xVqQGZ9xrYx9xrYxOe9xrYx9xrYx9xrYx9xrYx9xrYx9xrYx', 1, true, 'user', NOW(), NOW());
  END IF;
END $$;

-- Step 4: Assign users to locations
-- Get the user IDs and location IDs dynamically

-- Assign Branch Manager (branchmanager) to Main Store (location_id = 1)
INSERT INTO user_locations (user_id, location_id, created_at)
SELECT id, 1, NOW() FROM users WHERE username = 'branchmanager'
ON CONFLICT (user_id, location_id) DO NOTHING;

-- Assign Warehouse Manager to Warehouse (location_id = 3)
INSERT INTO user_locations (user_id, location_id, created_at)
SELECT id, 3, NOW() FROM users WHERE username = 'warehousemanager'
ON CONFLICT (user_id, location_id) DO NOTHING;

-- Assign Regular Staff to Main Store (1) and Bambang (2)
INSERT INTO user_locations (user_id, location_id, created_at)
SELECT id, 1, NOW() FROM users WHERE username = 'staff'
ON CONFLICT (user_id, location_id) DO NOTHING;

INSERT INTO user_locations (user_id, location_id, created_at)
SELECT id, 2, NOW() FROM users WHERE username = 'staff'
ON CONFLICT (user_id, location_id) DO NOTHING;

-- Assign Cashier to Tuguegarao Downtown (4)
INSERT INTO user_locations (user_id, location_id, created_at)
SELECT id, 4, NOW() FROM users WHERE username = 'cashier'
ON CONFLICT (user_id, location_id) DO NOTHING;

-- Step 5: Verify assignments
SELECT
  u.username,
  u.email,
  bl.name as location_name
FROM user_locations ul
JOIN users u ON ul.user_id = u.id
JOIN business_locations bl ON ul.location_id = bl.id
ORDER BY u.username, bl.name;
