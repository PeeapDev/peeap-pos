-- Migration 006: Carts, stock reservation, returns, payouts, and order metadata
-- Part of the e-commerce ecosystem completion

-- 1. Add metadata column to store_orders for shipping job numbers etc.
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Add stock reservation column to pos_products
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER DEFAULT 0;

-- 3. Server-side cart persistence
CREATE TABLE IF NOT EXISTS store_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_store_carts_user ON store_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_store_carts_updated ON store_carts(updated_at);

-- 4. Return requests
CREATE TABLE IF NOT EXISTS return_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    refund_amount DECIMAL(15, 2),
    merchant_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_requests_order ON return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_merchant ON return_requests(merchant_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status);

-- 5. Merchant payouts
CREATE TABLE IF NOT EXISTS merchant_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    store_id UUID REFERENCES stores(id),
    amount DECIMAL(15, 2) NOT NULL,
    fee DECIMAL(15, 2) DEFAULT 0,
    net_amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    payout_method VARCHAR(50) DEFAULT 'wallet',
    reference VARCHAR(255),
    notes TEXT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_payouts_merchant ON merchant_payouts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_payouts_status ON merchant_payouts(status);

-- 6. Commission and payout tracking on orders
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES merchant_payouts(id);
