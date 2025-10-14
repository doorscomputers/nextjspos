-- Seed new permissions for QC Inspections and Purchase Amendments
-- Run this SQL script in your PostgreSQL database

-- Insert the new permissions
INSERT INTO permissions (name, guard_name, created_at, updated_at) VALUES
  ('qc_inspection.view', 'web', NOW(), NOW()),
  ('qc_inspection.create', 'web', NOW(), NOW()),
  ('qc_inspection.conduct', 'web', NOW(), NOW()),
  ('qc_inspection.approve', 'web', NOW(), NOW()),
  ('qc_template.view', 'web', NOW(), NOW()),
  ('qc_template.manage', 'web', NOW(), NOW()),
  ('purchase_amendment.view', 'web', NOW(), NOW()),
  ('purchase_amendment.create', 'web', NOW(), NOW()),
  ('purchase_amendment.approve', 'web', NOW(), NOW()),
  ('purchase_amendment.reject', 'web', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Verify the permissions were inserted
SELECT id, name, guard_name FROM permissions
WHERE name LIKE 'qc_%' OR name LIKE 'purchase_amendment%'
ORDER BY name;
