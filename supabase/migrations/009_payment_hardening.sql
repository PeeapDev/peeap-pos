-- 009_payment_hardening.sql
--
-- Hardens the order/payment surface:
--   1. Durable-settlement columns on store_orders so the checkout-paid
--      webhook can record a paid receipt independent of the cashier UI.
--   2. A status CHECK constraint so only known states can be written.
--   3. Indexes for the settlement cron + webhook lookups (these query by
--      payment_reference / checkout_session_id / (status, created_at) and
--      were doing seq scans).
--   4. A unique idempotency key per (store, key) for POST /api/checkout
--      and a unique checkout_session_id so a retried webhook can't create
--      a duplicate receipt.
--   5. sell_stock_atomic — decrements ONLY stock_quantity (not reserved),
--      for terminal/scan-pay sales whose stock was never reserved.
--   6. A DB-backed fixed-window rate limiter (rate_limit_hit) used by the
--      public payment endpoints.

-- ── 1. Durable settlement columns ───────────────────────────────────────
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS checkout_session_id VARCHAR(255);
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS paid_by_user_id UUID;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

-- ── 2. Status integrity ─────────────────────────────────────────────────
-- Backfill any rows whose status is outside the known set BEFORE adding the
-- constraint, so the ALTER doesn't fail on legacy data.
UPDATE store_orders
   SET status = 'pending'
 WHERE status IS NULL
    OR status NOT IN (
      'pending','paid','confirmed','processing',
      'shipped','delivered','completed','cancelled','refunded'
    );

ALTER TABLE store_orders DROP CONSTRAINT IF EXISTS store_orders_status_check;
ALTER TABLE store_orders ADD CONSTRAINT store_orders_status_check
  CHECK (status IN (
    'pending','paid','confirmed','processing',
    'shipped','delivered','completed','cancelled','refunded'
  ));

-- ── 3. Indexes for settlement / webhook lookups ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_store_orders_payment_reference
  ON store_orders (payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_store_orders_status_created
  ON store_orders (status, created_at);

-- ── 4. Idempotency uniqueness ───────────────────────────────────────────
-- One paid receipt per checkout session — a retried webhook collides here
-- instead of inserting a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_orders_checkout_session
  ON store_orders (checkout_session_id)
  WHERE checkout_session_id IS NOT NULL;

-- One order per (store, client idempotency key) — a retried POST /api/checkout
-- collides here instead of creating a duplicate order.
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_orders_idempotency
  ON store_orders (store_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── 5. sell_stock_atomic (unreserved direct sale) ───────────────────────
CREATE OR REPLACE FUNCTION sell_stock_atomic(
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Direct sale of stock that was never reserved (terminal / scan-pay).
  -- Decrements stock_quantity only; leaves reserved_quantity untouched so
  -- it can't cannibalise another order's hold.
  UPDATE pos_products
     SET stock_quantity = GREATEST(0, stock_quantity - p_quantity),
         updated_at = NOW()
   WHERE id = p_product_id
     AND track_inventory = true;
END;
$$;

-- ── 6. DB-backed fixed-window rate limiter ──────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  bucket       TEXT    NOT NULL,
  window_start BIGINT  NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

CREATE OR REPLACE FUNCTION rate_limit_hit(
  p_bucket         TEXT,
  p_max            INTEGER,
  p_window_seconds INTEGER
) RETURNS TABLE (allowed BOOLEAN, current_count INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_window BIGINT;
  v_count  INTEGER;
BEGIN
  v_window := floor(extract(epoch FROM now()) / p_window_seconds);

  INSERT INTO rate_limit_hits (bucket, window_start, count)
       VALUES (p_bucket, v_window, 1)
  ON CONFLICT (bucket, window_start)
  DO UPDATE SET count = rate_limit_hits.count + 1
  RETURNING count INTO v_count;

  -- Opportunistic cleanup: only on the first hit of a fresh window, so we
  -- don't add a DELETE to every single call.
  IF v_count = 1 THEN
    DELETE FROM rate_limit_hits WHERE window_start < v_window - 2;
  END IF;

  RETURN QUERY SELECT (v_count <= p_max), v_count;
END;
$$;
