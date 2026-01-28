-- CreateMaterializedView: Stock Pivot for fast inventory reporting
-- This view pre-calculates stock quantities by location for each product variation
-- Hybrid design: 20 fixed location columns + JSON for additional locations

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS stock_pivot_view CASCADE;

-- Create the materialized view
CREATE MATERIALIZED VIEW stock_pivot_view AS
SELECT
  pv.id AS variation_id,
  p.id AS product_id,
  p.name AS product_name,
  p.sku AS product_sku,
  p.image AS product_image,
  pv.name AS variation_name,
  pv.sku AS variation_sku,
  COALESCE(c.name, '') AS category,
  COALESCE(b.name, '') AS brand,
  COALESCE(u.short_name, 'N/A') AS unit,

  -- Fixed columns for first 20 locations (hybrid approach)
  -- Use COALESCE(MAX(CASE...END), 0) instead of MAX(CASE...ELSE 0) to correctly handle negative quantities
  -- With ELSE 0, MAX(-2, 0) = 0 which masks negatives; without ELSE, MAX(-2) = -2 which is correct
  COALESCE(MAX(CASE WHEN vld.location_id = 1 THEN vld.qty_available END), 0) AS loc_1_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 2 THEN vld.qty_available END), 0) AS loc_2_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 3 THEN vld.qty_available END), 0) AS loc_3_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 4 THEN vld.qty_available END), 0) AS loc_4_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 5 THEN vld.qty_available END), 0) AS loc_5_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 6 THEN vld.qty_available END), 0) AS loc_6_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 7 THEN vld.qty_available END), 0) AS loc_7_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 8 THEN vld.qty_available END), 0) AS loc_8_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 9 THEN vld.qty_available END), 0) AS loc_9_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 10 THEN vld.qty_available END), 0) AS loc_10_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 11 THEN vld.qty_available END), 0) AS loc_11_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 12 THEN vld.qty_available END), 0) AS loc_12_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 13 THEN vld.qty_available END), 0) AS loc_13_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 14 THEN vld.qty_available END), 0) AS loc_14_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 15 THEN vld.qty_available END), 0) AS loc_15_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 16 THEN vld.qty_available END), 0) AS loc_16_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 17 THEN vld.qty_available END), 0) AS loc_17_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 18 THEN vld.qty_available END), 0) AS loc_18_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 19 THEN vld.qty_available END), 0) AS loc_19_qty,
  COALESCE(MAX(CASE WHEN vld.location_id = 20 THEN vld.qty_available END), 0) AS loc_20_qty,

  -- JSON column for locations beyond 20 (overflow)
  jsonb_object_agg(
    vld.location_id::text,
    vld.qty_available
  ) FILTER (WHERE vld.location_id > 20) AS extra_locations_json,

  -- Total stock across ALL locations
  COALESCE(SUM(vld.qty_available), 0) AS total_stock,

  -- Business context
  p.business_id,
  NOW() AS last_refreshed

FROM product_variations pv
INNER JOIN products p ON pv.product_id = p.id
LEFT JOIN variation_location_details vld ON vld.product_variation_id = pv.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN brands b ON p.brand_id = b.id
LEFT JOIN units u ON COALESCE(pv.unit_id, p.unit_id) = u.id

WHERE p.deleted_at IS NULL
  AND pv.deleted_at IS NULL
  AND p.is_active = true

GROUP BY
  pv.id,
  p.id,
  p.name,
  p.sku,
  p.image,
  pv.name,
  pv.sku,
  c.name,
  b.name,
  u.short_name,
  p.business_id;

-- Create indexes for fast querying
CREATE UNIQUE INDEX idx_stock_pivot_variation_business ON stock_pivot_view(variation_id, business_id);
CREATE INDEX idx_stock_pivot_business ON stock_pivot_view(business_id);
CREATE INDEX idx_stock_pivot_product_name ON stock_pivot_view USING btree(product_name);
CREATE INDEX idx_stock_pivot_variation_sku ON stock_pivot_view USING btree(variation_sku);
CREATE INDEX idx_stock_pivot_category ON stock_pivot_view USING btree(category);
CREATE INDEX idx_stock_pivot_brand ON stock_pivot_view USING btree(brand);
CREATE INDEX idx_stock_pivot_total_stock ON stock_pivot_view USING btree(total_stock);

-- Create stored function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_stock_pivot_view()
RETURNS TABLE(
  rows_affected BIGINT,
  refresh_duration_ms INTEGER,
  last_refreshed TIMESTAMP
) AS $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  row_count BIGINT;
BEGIN
  start_time := clock_timestamp();

  -- Refresh the materialized view (CONCURRENTLY allows queries during refresh)
  REFRESH MATERIALIZED VIEW CONCURRENTLY stock_pivot_view;

  end_time := clock_timestamp();

  -- Get row count
  SELECT COUNT(*) INTO row_count FROM stock_pivot_view;

  RETURN QUERY SELECT
    row_count,
    EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER,
    end_time;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your user)
-- GRANT SELECT ON stock_pivot_view TO your_app_user;

-- Initial population of the view
REFRESH MATERIALIZED VIEW stock_pivot_view;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Stock Pivot Materialized View created successfully!';
  RAISE NOTICE 'Use: SELECT * FROM stock_pivot_view WHERE business_id = ? ORDER BY product_name;';
  RAISE NOTICE 'Refresh: SELECT * FROM refresh_stock_pivot_view();';
END $$;
