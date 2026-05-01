-- Atomic stock reservation / commit / release.
--
-- The previous TypeScript implementation in src/lib/stock.ts read the
-- current reserved_quantity, computed `read + qty`, and wrote it back —
-- a classic lost-update race. Two concurrent reservations both reading
-- the same `reserved_quantity` could both pass the availability check
-- and overwrite each other's increments, leading to overselling.
--
-- These RPCs do the read+update inside a single SQL statement so the
-- check and the write are atomic at the row-level. The CHECK in the
-- WHERE clause guarantees we never reserve more than the available
-- stock — a concurrent transaction that races us will fail-fast with
-- 0 rows affected.

CREATE OR REPLACE FUNCTION reserve_stock_atomic(
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS TABLE (
  ok BOOLEAN,
  available INTEGER,
  product_name TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_track_inventory BOOLEAN;
  v_available INTEGER;
  v_name TEXT;
  v_rows INTEGER;
BEGIN
  -- For non-tracked products: skip and report ok=true.
  SELECT track_inventory, name INTO v_track_inventory, v_name
  FROM pos_products WHERE id = p_product_id;

  IF v_track_inventory IS NULL THEN
    RETURN QUERY SELECT false, 0, COALESCE(v_name, '');
    RETURN;
  END IF;

  IF v_track_inventory = false THEN
    RETURN QUERY SELECT true, NULL::INTEGER, v_name;
    RETURN;
  END IF;

  -- Atomic update: increment reserved_quantity ONLY if the row still has
  -- enough headroom. The condition is evaluated against the row at the
  -- moment of UPDATE, holding the row lock — no read-then-write race.
  UPDATE pos_products
     SET reserved_quantity = COALESCE(reserved_quantity, 0) + p_quantity,
         updated_at = NOW()
   WHERE id = p_product_id
     AND track_inventory = true
     AND (stock_quantity - COALESCE(reserved_quantity, 0)) >= p_quantity;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    -- Reservation refused. Re-read current available for the error message.
    SELECT stock_quantity - COALESCE(reserved_quantity, 0)
      INTO v_available
      FROM pos_products WHERE id = p_product_id;
    RETURN QUERY SELECT false, COALESCE(v_available, 0), v_name;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::INTEGER, v_name;
END;
$$;

CREATE OR REPLACE FUNCTION commit_stock_atomic(
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE pos_products
     SET stock_quantity = GREATEST(0, stock_quantity - p_quantity),
         reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - p_quantity),
         updated_at = NOW()
   WHERE id = p_product_id
     AND track_inventory = true;
END;
$$;

CREATE OR REPLACE FUNCTION release_stock_atomic(
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE pos_products
     SET reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - p_quantity),
         updated_at = NOW()
   WHERE id = p_product_id
     AND track_inventory = true;
END;
$$;
