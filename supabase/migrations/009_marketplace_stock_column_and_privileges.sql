-- POS project only (jyailfxlouvsssqujspo). Keep existing product and order rows.
-- Checkout and the atomic stock RPCs require this column; it was omitted from
-- the live POS schema even though the functions had already been installed.
BEGIN;

ALTER TABLE public.pos_products
  ADD COLUMN IF NOT EXISTS reserved_quantity integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pos_products_reserved_quantity_nonnegative' AND conrelid = 'public.pos_products'::regclass) THEN
    ALTER TABLE public.pos_products
      ADD CONSTRAINT pos_products_reserved_quantity_nonnegative
      CHECK (reserved_quantity >= 0) NOT VALID;
  END IF;
END $$;

-- The API server uses the service role. Browser roles must not reserve,
-- commit, or release another merchant's stock directly.
REVOKE ALL ON FUNCTION public.reserve_stock_atomic(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_stock_atomic(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_stock_atomic(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stock_atomic(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_stock_atomic(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_stock_atomic(uuid, integer) TO service_role;

COMMIT;

ALTER TABLE public.pos_products
  VALIDATE CONSTRAINT pos_products_reserved_quantity_nonnegative;
