-- Migration: 001_pos_schema.sql
-- Description: Consolidated POS + E-Commerce schema for peeap-pos standalone app
-- Created: 2026-03-12

-- =====================================================
-- POS CUSTOMERS
-- =====================================================
CREATE TABLE pos_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    customer_type VARCHAR(50) DEFAULT 'regular',
    credit_limit DECIMAL(15,2) DEFAULT 0,
    credit_balance DECIMAL(15,2) DEFAULT 0,
    loyalty_points INTEGER DEFAULT 0,
    total_purchases DECIMAL(15,2) DEFAULT 0,
    total_paid DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_customers_merchant ON pos_customers(merchant_id);

-- =====================================================
-- POS CATEGORIES
-- =====================================================
CREATE TABLE pos_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#3B82F6',
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_categories_merchant ON pos_categories(merchant_id);

-- =====================================================
-- POS PRODUCTS (with e-commerce/SEO fields)
-- =====================================================
CREATE TABLE pos_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    category_id UUID REFERENCES pos_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    image_url TEXT,
    price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    cost_price DECIMAL(15, 2) DEFAULT 0,
    track_inventory BOOLEAN DEFAULT false,
    stock_quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    has_variants BOOLEAN DEFAULT false,
    variants JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    -- E-commerce / SEO fields
    slug VARCHAR(255),
    video_url TEXT,
    seo_title VARCHAR(160),
    seo_description VARCHAR(320),
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_products_merchant ON pos_products(merchant_id);
CREATE INDEX idx_pos_products_category ON pos_products(category_id);
CREATE INDEX idx_pos_products_slug ON pos_products(slug);
CREATE INDEX idx_pos_products_published ON pos_products(is_published) WHERE is_published = true;

-- =====================================================
-- POS SALES
-- =====================================================
CREATE TABLE pos_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    sale_number VARCHAR(50) NOT NULL,
    customer_id UUID REFERENCES pos_customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'cash',
    payment_reference VARCHAR(255),
    payment_details JSONB DEFAULT '{}'::jsonb,
    cashier_id UUID,
    cashier_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'completed',
    notes TEXT,
    kitchen_status VARCHAR(20) DEFAULT 'new',
    order_type VARCHAR(20) DEFAULT 'dine_in',
    table_number VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(merchant_id, sale_number)
);

CREATE INDEX idx_pos_sales_merchant ON pos_sales(merchant_id);
CREATE INDEX idx_pos_sales_status ON pos_sales(status);
CREATE INDEX idx_pos_sales_created ON pos_sales(created_at DESC);

-- =====================================================
-- POS SALE ITEMS
-- =====================================================
CREATE TABLE pos_sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES pos_products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    unit_price DECIMAL(15, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    total_price DECIMAL(15, 2) NOT NULL,
    cost_price DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    modifiers JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_sale_items_sale ON pos_sale_items(sale_id);
CREATE INDEX idx_pos_sale_items_product ON pos_sale_items(product_id);

-- =====================================================
-- POS INVENTORY LOG
-- =====================================================
CREATE TABLE pos_inventory_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES pos_products(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    quantity_change INTEGER NOT NULL,
    previous_quantity INTEGER,
    new_quantity INTEGER,
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_inventory_log_product ON pos_inventory_log(product_id);

-- =====================================================
-- POS PRODUCT VARIANTS
-- =====================================================
CREATE TABLE pos_product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES pos_products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    price_adjustment DECIMAL(15, 2) DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    attributes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_variants_product ON pos_product_variants(product_id);

-- =====================================================
-- POS DISCOUNTS
-- =====================================================
CREATE TABLE pos_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    type VARCHAR(20) NOT NULL DEFAULT 'percentage',
    value DECIMAL(15, 2) NOT NULL DEFAULT 0,
    min_purchase DECIMAL(15, 2),
    max_discount DECIMAL(15, 2),
    applies_to VARCHAR(20) DEFAULT 'cart',
    category_ids UUID[],
    product_ids UUID[],
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    conditions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_discounts_merchant ON pos_discounts(merchant_id);
CREATE INDEX idx_pos_discounts_code ON pos_discounts(code);

-- =====================================================
-- POS STAFF
-- =====================================================
CREATE TABLE pos_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    user_id UUID,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    pin VARCHAR(10),
    role VARCHAR(20) DEFAULT 'cashier',
    permissions TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    invitation_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_staff_merchant ON pos_staff(merchant_id);

-- =====================================================
-- POS CASH SESSIONS
-- =====================================================
CREATE TABLE pos_cash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    session_date DATE NOT NULL,
    opening_balance DECIMAL(15, 2) DEFAULT 0,
    closing_balance DECIMAL(15, 2),
    expected_balance DECIMAL(15, 2),
    cash_sales_total DECIMAL(15, 2) DEFAULT 0,
    cash_in DECIMAL(15, 2) DEFAULT 0,
    cash_out DECIMAL(15, 2) DEFAULT 0,
    difference DECIMAL(15, 2),
    status VARCHAR(20) DEFAULT 'open',
    opened_by UUID,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_by UUID,
    closed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_cash_sessions_merchant ON pos_cash_sessions(merchant_id);

-- =====================================================
-- POS CREDIT TRANSACTIONS
-- =====================================================
CREATE TABLE pos_credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES pos_customers(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES pos_sales(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    balance_before DECIMAL(15, 2),
    balance_after DECIMAL(15, 2),
    payment_method VARCHAR(50),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_credit_tx_customer ON pos_credit_transactions(customer_id);

-- =====================================================
-- POS HELD ORDERS
-- =====================================================
CREATE TABLE pos_held_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    hold_number VARCHAR(50),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal DECIMAL(15, 2) DEFAULT 0,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    held_by UUID,
    held_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'held',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_held_orders_merchant ON pos_held_orders(merchant_id);

-- =====================================================
-- POS REFUNDS
-- =====================================================
CREATE TABLE pos_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    sale_id UUID NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
    refund_number VARCHAR(50),
    refund_type VARCHAR(20) NOT NULL DEFAULT 'full',
    refund_amount DECIMAL(15, 2) NOT NULL,
    refund_method VARCHAR(20) DEFAULT 'cash',
    items JSONB DEFAULT '[]'::jsonb,
    reason TEXT,
    refunded_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_refunds_sale ON pos_refunds(sale_id);

-- =====================================================
-- POS LOYALTY PROGRAMS
-- =====================================================
CREATE TABLE pos_loyalty_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    points_per_currency DECIMAL(10, 4) DEFAULT 1,
    points_value DECIMAL(10, 4) DEFAULT 10,
    min_redeem_points INTEGER DEFAULT 100,
    max_redeem_percent DECIMAL(5, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_loyalty_merchant ON pos_loyalty_programs(merchant_id);

-- =====================================================
-- POS LOYALTY POINTS
-- =====================================================
CREATE TABLE pos_loyalty_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES pos_customers(id) ON DELETE CASCADE,
    points_balance INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    total_redeemed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_loyalty_customer ON pos_loyalty_points(customer_id);

-- =====================================================
-- POS SETTINGS
-- =====================================================
CREATE TABLE pos_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL UNIQUE,
    business_name VARCHAR(255),
    business_address TEXT,
    business_phone VARCHAR(50),
    business_email VARCHAR(255),
    tax_number VARCHAR(100),
    receipt_header TEXT,
    receipt_footer TEXT,
    receipt_logo_url TEXT,
    tax_enabled BOOLEAN DEFAULT false,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    tax_label VARCHAR(50) DEFAULT 'GST',
    currency VARCHAR(10) DEFAULT 'NLe',
    setup_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- POS TABLE SECTIONS (Restaurant)
-- =====================================================
CREATE TABLE pos_table_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_table_sections_merchant ON pos_table_sections(merchant_id);

-- =====================================================
-- POS TABLES (Restaurant)
-- =====================================================
CREATE TABLE pos_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    section_id UUID REFERENCES pos_table_sections(id) ON DELETE SET NULL,
    table_number VARCHAR(20) NOT NULL,
    capacity INTEGER DEFAULT 4,
    status VARCHAR(20) DEFAULT 'available',
    position_x DECIMAL(10, 2) DEFAULT 0,
    position_y DECIMAL(10, 2) DEFAULT 0,
    shape VARCHAR(20) DEFAULT 'square',
    current_order_id UUID,
    current_guests INTEGER DEFAULT 0,
    reservation_info JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_tables_merchant ON pos_tables(merchant_id);

-- =====================================================
-- POS RESERVATIONS
-- =====================================================
CREATE TABLE pos_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    table_id UUID REFERENCES pos_tables(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    party_size INTEGER DEFAULT 2,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 90,
    status VARCHAR(20) DEFAULT 'confirmed',
    special_requests TEXT,
    seated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_reservations_merchant ON pos_reservations(merchant_id);
CREATE INDEX idx_pos_reservations_date ON pos_reservations(reservation_date);

-- =====================================================
-- POS SUPPLIERS
-- =====================================================
CREATE TABLE pos_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    payment_terms VARCHAR(20) DEFAULT 'COD',
    bank_account VARCHAR(255),
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(15, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_suppliers_merchant ON pos_suppliers(merchant_id);

-- =====================================================
-- POS PURCHASE ORDERS
-- =====================================================
CREATE TABLE pos_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    supplier_id UUID REFERENCES pos_suppliers(id) ON DELETE SET NULL,
    order_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal DECIMAL(15, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    shipping_cost DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) DEFAULT 0,
    expected_date DATE,
    received_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_purchase_orders_merchant ON pos_purchase_orders(merchant_id);

-- =====================================================
-- STORES (Merchant Storefront Profiles)
-- =====================================================
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    address VARCHAR(500),
    phone VARCHAR(50),
    email VARCHAR(255),
    business_hours JSONB DEFAULT '{}'::jsonb,
    social_links JSONB DEFAULT '{}'::jsonb,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_stores_published ON stores(is_published) WHERE is_published = true;

-- =====================================================
-- STORE ORDERS (Online)
-- =====================================================
CREATE TABLE store_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'mobile_money',
    payment_reference VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_store_orders_merchant ON store_orders(merchant_id);
CREATE INDEX idx_store_orders_store ON store_orders(store_id);
CREATE INDEX idx_store_orders_status ON store_orders(status);

-- =====================================================
-- STORE ORDER ITEMS
-- =====================================================
CREATE TABLE store_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES pos_products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(15, 2) NOT NULL,
    total_price DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_store_order_items_order ON store_order_items(order_id);

-- =====================================================
-- POS INVENTORY ALERTS
-- =====================================================
CREATE TABLE pos_inventory_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES pos_products(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    current_stock INTEGER DEFAULT 0,
    threshold INTEGER DEFAULT 10,
    alert_type VARCHAR(20) DEFAULT 'low_stock',
    is_acknowledged BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_inventory_alerts_merchant ON pos_inventory_alerts(merchant_id);
