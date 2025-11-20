-- Diagnose Transfer TR-202511-0028 (ID: 29)
-- Issue: Items not added to receiving location (Main Store)

-- 1. Check transfer status
SELECT
    id,
    transfer_number,
    status,
    from_location_id,
    to_location_id,
    created_at,
    sent_at,
    received_at,
    completed_at,
    verified_at
FROM stock_transfers
WHERE id = 29;

-- 2. Check transfer items and received quantities
SELECT
    sti.id,
    p.name as product_name,
    pv.name as variation_name,
    sti.quantity as sent_quantity,
    sti.received_quantity,
    sti.verified,
    sti.verified_at,
    sti.verified_by
FROM stock_transfer_items sti
JOIN products p ON sti.product_id = p.id
JOIN product_variations pv ON sti.product_variation_id = pv.id
WHERE sti.stock_transfer_id = 29;

-- 3. Check stock transactions for this transfer
SELECT
    st.id,
    st.type,
    p.name as product_name,
    st.quantity,
    st.balance_qty,
    st.location_id,
    bl.name as location_name,
    st.reference_type,
    st.reference_id,
    st.created_at
FROM stock_transactions st
JOIN products p ON st.product_id = p.id
JOIN business_locations bl ON st.location_id = bl.id
WHERE st.reference_type = 'stock_transfer'
    AND st.reference_id = 29
ORDER BY st.location_id, st.created_at;

-- 4. Check product history for this transfer
SELECT
    ph.id,
    ph.transaction_type,
    p.name as product_name,
    ph.quantity_change,
    ph.balance_quantity,
    ph.location_id,
    bl.name as location_name,
    ph.reference_type,
    ph.reference_number,
    ph.transaction_date
FROM product_history ph
JOIN products p ON ph.product_id = p.id
JOIN business_locations bl ON ph.location_id = bl.id
WHERE ph.reference_type = 'stock_transfer'
    AND ph.reference_number = 'TR-202511-0028'
ORDER BY ph.location_id, ph.transaction_date;

-- 5. Check current inventory at both locations for the transferred products
SELECT
    vld.id,
    p.name as product_name,
    pv.name as variation_name,
    vld.location_id,
    bl.name as location_name,
    vld.qty_available
FROM variation_location_details vld
JOIN products p ON vld.product_id = p.id
JOIN product_variations pv ON vld.product_variation_id = pv.id
JOIN business_locations bl ON vld.location_id = bl.id
WHERE vld.product_variation_id IN (
    SELECT product_variation_id
    FROM stock_transfer_items
    WHERE stock_transfer_id = 29
)
AND vld.location_id IN (
    SELECT from_location_id FROM stock_transfers WHERE id = 29
    UNION
    SELECT to_location_id FROM stock_transfers WHERE id = 29
)
ORDER BY p.name, bl.name;

-- 6. Check if there's a pending job for this transfer
SELECT
    id,
    type,
    status,
    progress,
    total,
    error_message,
    started_at,
    completed_at,
    created_at
FROM job_queue
WHERE type = 'transfer_complete'
    AND payload::text LIKE '%"transferId":29%'
ORDER BY created_at DESC;

-- 7. Check audit logs for this transfer
SELECT
    al.id,
    al.action,
    al.description,
    al.created_at,
    u.username,
    al.metadata
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.entity_type = 'stock_transfer'
    AND al.entity_ids @> ARRAY[29]
ORDER BY al.created_at DESC;
