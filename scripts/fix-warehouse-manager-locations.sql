-- Fix Warehouse Manager Location Access
-- Add Tuguegarao location to warehouse manager user

-- First, find the IDs we need
-- SELECT id, username FROM users WHERE username = 'warehousemanager';
-- SELECT id, name FROM business_locations WHERE name IN ('Warehouse', 'Tuguegarao Downtown');

-- Add Tuguegarao Downtown location to warehouse manager
-- Replace the IDs with actual values from your database
INSERT INTO user_locations (user_id, location_id)
SELECT
    u.id as user_id,
    bl.id as location_id
FROM users u
CROSS JOIN business_locations bl
WHERE u.username = 'warehousemanager'
  AND bl.name = 'Tuguegarao Downtown'
  AND NOT EXISTS (
    SELECT 1 FROM user_locations ul
    WHERE ul.user_id = u.id AND ul.location_id = bl.id
  );

-- Verify the update
SELECT
    u.username,
    u.first_name,
    u.last_name,
    bl.name as location_name
FROM users u
JOIN user_locations ul ON u.id = ul.user_id
JOIN business_locations bl ON ul.location_id = bl.id
WHERE u.username = 'warehousemanager'
ORDER BY bl.name;

-- Expected Result:
-- warehousemanager should have 2 locations:
-- 1. Tuguegarao Downtown
-- 2. Warehouse
