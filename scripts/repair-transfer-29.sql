-- REPAIR SCRIPT: Fix Transfer TR-202511-0028 (ID: 29)
-- Issue: Items deducted from sender but not added to receiver
-- This script will manually add the inventory to Main Store

-- Run diagnose-transfer-29.sql first to understand the current state

BEGIN;

-- Step 1: Get transfer details
DO $$
DECLARE
    v_transfer_id INT := 29;
    v_transfer_number TEXT := 'TR-202511-0028';
    v_from_location_id INT;
    v_to_location_id INT;
    v_business_id INT;
    v_item RECORD;
    v_dest_stock_id INT;
    v_current_qty NUMERIC;
    v_new_qty NUMERIC;
    v_received_qty NUMERIC;
BEGIN
    -- Get transfer location IDs and business
    SELECT from_location_id, to_location_id, business_id
    INTO v_from_location_id, v_to_location_id, v_business_id
    FROM stock_transfers
    WHERE id = v_transfer_id;

    RAISE NOTICE 'Transfer %: From Location %, To Location %, Business %',
        v_transfer_number, v_from_location_id, v_to_location_id, v_business_id;

    -- Step 2: Process each item
    FOR v_item IN
        SELECT
            sti.id,
            sti.product_id,
            sti.product_variation_id,
            sti.quantity,
            sti.received_quantity,
            p.name as product_name,
            pv.name as variation_name
        FROM stock_transfer_items sti
        JOIN products p ON sti.product_id = p.id
        JOIN product_variations pv ON sti.product_variation_id = pv.id
        WHERE sti.stock_transfer_id = v_transfer_id
    LOOP
        -- Determine received quantity (use quantity if received_quantity is 0 or NULL)
        v_received_qty := COALESCE(NULLIF(v_item.received_quantity, 0), v_item.quantity);

        RAISE NOTICE 'Processing: % - % (Quantity: %)',
            v_item.product_name, v_item.variation_name, v_received_qty;

        -- Step 3: Check if product already exists at destination
        SELECT id, qty_available
        INTO v_dest_stock_id, v_current_qty
        FROM variation_location_details
        WHERE product_id = v_item.product_id
            AND product_variation_id = v_item.product_variation_id
            AND location_id = v_to_location_id;

        IF v_dest_stock_id IS NULL THEN
            -- Create new stock record at destination
            INSERT INTO variation_location_details (
                product_id,
                product_variation_id,
                location_id,
                qty_available,
                business_id
            ) VALUES (
                v_item.product_id,
                v_item.product_variation_id,
                v_to_location_id,
                v_received_qty,
                v_business_id
            )
            RETURNING id, qty_available INTO v_dest_stock_id, v_new_qty;

            RAISE NOTICE '  → Created new stock record: ID %, New Qty: %', v_dest_stock_id, v_new_qty;
        ELSE
            -- Update existing stock record
            v_new_qty := v_current_qty + v_received_qty;

            UPDATE variation_location_details
            SET
                qty_available = v_new_qty,
                updated_at = NOW()
            WHERE id = v_dest_stock_id;

            RAISE NOTICE '  → Updated stock record: ID %, Old Qty: %, New Qty: %',
                v_dest_stock_id, v_current_qty, v_new_qty;
        END IF;

        -- Step 4: Check if stock transaction already exists (with 0 quantity)
        IF EXISTS (
            SELECT 1 FROM stock_transactions
            WHERE reference_type = 'stock_transfer'
                AND reference_id = v_transfer_id
                AND product_variation_id = v_item.product_variation_id
                AND location_id = v_to_location_id
                AND type = 'transfer_in'
                AND quantity = 0
        ) THEN
            -- Update the existing transaction
            UPDATE stock_transactions
            SET
                quantity = v_received_qty,
                balance_qty = v_new_qty,
                updated_at = NOW()
            WHERE reference_type = 'stock_transfer'
                AND reference_id = v_transfer_id
                AND product_variation_id = v_item.product_variation_id
                AND location_id = v_to_location_id
                AND type = 'transfer_in';

            RAISE NOTICE '  → Updated existing stock transaction (was 0, now %)', v_received_qty;
        ELSE
            -- Create new stock transaction if doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM stock_transactions
                WHERE reference_type = 'stock_transfer'
                    AND reference_id = v_transfer_id
                    AND product_variation_id = v_item.product_variation_id
                    AND location_id = v_to_location_id
                    AND type = 'transfer_in'
            ) THEN
                INSERT INTO stock_transactions (
                    business_id,
                    product_id,
                    product_variation_id,
                    location_id,
                    type,
                    quantity,
                    balance_qty,
                    reference_type,
                    reference_id,
                    created_by,
                    notes,
                    created_at
                ) VALUES (
                    v_business_id,
                    v_item.product_id,
                    v_item.product_variation_id,
                    v_to_location_id,
                    'transfer_in',
                    v_received_qty,
                    v_new_qty,
                    'stock_transfer',
                    v_transfer_id,
                    1, -- system user
                    'REPAIR: Transfer ' || v_transfer_number || ' received (manual fix)',
                    NOW()
                );

                RAISE NOTICE '  → Created new stock transaction';
            ELSE
                RAISE NOTICE '  → Stock transaction already exists with correct quantity';
            END IF;
        END IF;

        -- Step 5: Check if product history exists (with 0 quantity)
        IF EXISTS (
            SELECT 1 FROM product_history
            WHERE reference_type = 'stock_transfer'
                AND reference_number = v_transfer_number
                AND product_variation_id = v_item.product_variation_id
                AND location_id = v_to_location_id
                AND transaction_type = 'transfer_in'
                AND quantity_change = 0
        ) THEN
            -- Update the existing history entry
            UPDATE product_history
            SET
                quantity_change = v_received_qty,
                balance_quantity = v_new_qty,
                reason = 'REPAIR: Transfer ' || v_transfer_number || ' received from location ' || v_from_location_id || ' (manual fix)'
            WHERE reference_type = 'stock_transfer'
                AND reference_number = v_transfer_number
                AND product_variation_id = v_item.product_variation_id
                AND location_id = v_to_location_id
                AND transaction_type = 'transfer_in';

            RAISE NOTICE '  → Updated existing product history (was 0, now %)', v_received_qty;
        ELSE
            -- Create new product history if doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM product_history
                WHERE reference_type = 'stock_transfer'
                    AND reference_number = v_transfer_number
                    AND product_variation_id = v_item.product_variation_id
                    AND location_id = v_to_location_id
                    AND transaction_type = 'transfer_in'
            ) THEN
                INSERT INTO product_history (
                    business_id,
                    product_id,
                    product_variation_id,
                    location_id,
                    quantity_change,
                    balance_quantity,
                    transaction_type,
                    transaction_date,
                    reference_type,
                    reference_id,
                    reference_number,
                    created_by,
                    created_by_name,
                    reason
                ) VALUES (
                    v_business_id,
                    v_item.product_id,
                    v_item.product_variation_id,
                    v_to_location_id,
                    v_received_qty,
                    v_new_qty,
                    'transfer_in',
                    NOW(),
                    'stock_transfer',
                    v_transfer_id,
                    v_transfer_number,
                    1, -- system user
                    'System Repair',
                    'REPAIR: Transfer ' || v_transfer_number || ' received from location ' || v_from_location_id || ' (manual fix)'
                );

                RAISE NOTICE '  → Created new product history entry';
            ELSE
                RAISE NOTICE '  → Product history already exists with correct quantity';
            END IF;
        END IF;

        -- Step 6: Update receivedQuantity if it was 0 or NULL
        IF COALESCE(v_item.received_quantity, 0) = 0 THEN
            UPDATE stock_transfer_items
            SET received_quantity = v_item.quantity
            WHERE id = v_item.id;

            RAISE NOTICE '  → Updated receivedQuantity from 0/NULL to %', v_item.quantity;
        END IF;

    END LOOP;

    RAISE NOTICE 'Repair completed for transfer %', v_transfer_number;

END $$;

COMMIT;

-- Verify the fix by running these queries:
SELECT 'Transfer Items' as check_type, * FROM stock_transfer_items WHERE stock_transfer_id = 29;

SELECT 'Current Inventory' as check_type, vld.*, bl.name as location_name, p.name as product_name
FROM variation_location_details vld
JOIN business_locations bl ON vld.location_id = bl.id
JOIN products p ON vld.product_id = p.id
WHERE vld.product_variation_id IN (
    SELECT product_variation_id FROM stock_transfer_items WHERE stock_transfer_id = 29
)
ORDER BY p.name, bl.name;

SELECT 'Product History' as check_type, ph.*, p.name as product_name, bl.name as location_name
FROM product_history ph
JOIN products p ON ph.product_id = p.id
JOIN business_locations bl ON ph.location_id = bl.id
WHERE reference_number = 'TR-202511-0028'
AND transaction_type = 'transfer_in'
ORDER BY p.name;
