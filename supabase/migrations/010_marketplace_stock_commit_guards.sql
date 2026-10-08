-- POS project only. Deploy with the Card checkout reservation flow.
-- Replaying a commit or release must never deduct or free stock twice.
BEGIN;

CREATE OR REPLACE FUNCTION public.commit_stock_atomic(p_product_id uuid, p_quantity integer)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_rows integer;
  v_tracked boolean;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid_stock_quantity';
  END IF;
  UPDATE public.pos_products
     SET stock_quantity = stock_quantity - p_quantity,
         reserved_quantity = reserved_quantity - p_quantity,
         updated_at = now()
   WHERE id = p_product_id AND track_inventory = true
     AND reserved_quantity >= p_quantity AND stock_quantity >= p_quantity;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 1 THEN RETURN; END IF;
  SELECT track_inventory INTO v_tracked FROM public.pos_products WHERE id = p_product_id;
  IF v_tracked IS FALSE THEN RETURN; END IF;
  RAISE EXCEPTION 'stock_commit_without_reservation';
END;
$$;

CREATE OR REPLACE FUNCTION public.release_stock_atomic(p_product_id uuid, p_quantity integer)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_rows integer;
  v_tracked boolean;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid_stock_quantity';
  END IF;
  UPDATE public.pos_products
     SET reserved_quantity = reserved_quantity - p_quantity,
         updated_at = now()
   WHERE id = p_product_id AND track_inventory = true
     AND reserved_quantity >= p_quantity;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 1 THEN RETURN; END IF;
  SELECT track_inventory INTO v_tracked FROM public.pos_products WHERE id = p_product_id;
  IF v_tracked IS FALSE THEN RETURN; END IF;
  RAISE EXCEPTION 'stock_release_without_reservation';
END;
$$;

REVOKE ALL ON FUNCTION public.commit_stock_atomic(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_stock_atomic(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_stock_atomic(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_stock_atomic(uuid, integer) TO service_role;

COMMIT;
