-- Migration: 002_marketplace_schema.sql
-- Description: Extend POS schema for ecommerce-first marketplace
-- Created: 2026-03-21

-- =====================================================
-- MARKETPLACE CATEGORIES (Global, admin-managed)
-- =====================================================
CREATE TABLE marketplace_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(100),
    image_url TEXT,
    color VARCHAR(20) DEFAULT '#3B82F6',
    parent_id UUID REFERENCES marketplace_categories(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    product_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_marketplace_categories_slug ON marketplace_categories(slug);
CREATE INDEX idx_marketplace_categories_parent ON marketplace_categories(parent_id);
CREATE INDEX idx_marketplace_categories_active ON marketplace_categories(is_active) WHERE is_active = true;

-- =====================================================
-- FEATURED PRODUCTS (Promoted listings)
-- =====================================================
CREATE TABLE featured_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES pos_products(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    feature_type VARCHAR(30) NOT NULL DEFAULT 'homepage',
    priority INTEGER DEFAULT 0,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_featured_products_type ON featured_products(feature_type);
CREATE INDEX idx_featured_products_active ON featured_products(is_active, starts_at, ends_at);

-- =====================================================
-- PRODUCT REVIEWS
-- =====================================================
CREATE TABLE product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES pos_products(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_id UUID,
    customer_name VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_verified_purchase BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX idx_product_reviews_store ON product_reviews(store_id);
CREATE INDEX idx_product_reviews_rating ON product_reviews(rating);

-- =====================================================
-- WISHLISTS
-- =====================================================
CREATE TABLE wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES pos_products(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

CREATE INDEX idx_wishlists_user ON wishlists(user_id);

-- =====================================================
-- MARKETPLACE BANNERS (Homepage hero)
-- =====================================================
CREATE TABLE marketplace_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT,
    link_type VARCHAR(30) DEFAULT 'url',
    link_target VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_marketplace_banners_active ON marketplace_banners(is_active, sort_order);

-- =====================================================
-- EXTEND STORES TABLE
-- =====================================================
ALTER TABLE stores ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Sierra Leone';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS marketplace_category_ids UUID[] DEFAULT '{}';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS offers_delivery BOOLEAN DEFAULT false;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_radius_km DECIMAL(5, 1);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS free_delivery_minimum DECIMAL(15, 2);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS minimum_order DECIMAL(15, 2);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3, 2) DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_stores_city ON stores(city);
CREATE INDEX IF NOT EXISTS idx_stores_featured ON stores(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_stores_verified ON stores(is_verified) WHERE is_verified = true;

-- =====================================================
-- EXTEND POS_PRODUCTS TABLE
-- =====================================================
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS marketplace_category_id UUID REFERENCES marketplace_categories(id) ON DELETE SET NULL;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS weight_grams INTEGER;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS brand VARCHAR(255);
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3, 2) DEFAULT 0;
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pos_products_search ON pos_products USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_pos_products_marketplace_cat ON pos_products(marketplace_category_id);
CREATE INDEX IF NOT EXISTS idx_pos_products_order_count ON pos_products(order_count DESC);

-- Trigger to auto-populate search_vector
CREATE OR REPLACE FUNCTION update_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.brand, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.sku, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_product_search_vector ON pos_products;
CREATE TRIGGER trg_update_product_search_vector
    BEFORE INSERT OR UPDATE OF name, description, brand, sku ON pos_products
    FOR EACH ROW
    EXECUTE FUNCTION update_product_search_vector();

-- Backfill search_vector for existing products
UPDATE pos_products SET search_vector =
    setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(brand, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(sku, '')), 'D')
WHERE search_vector IS NULL;

-- =====================================================
-- EXTEND STORE_ORDERS TABLE
-- =====================================================
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(30) DEFAULT 'online';
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS delivery_city VARCHAR(100);
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS service_fee DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMPTZ;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS review TEXT;

CREATE INDEX IF NOT EXISTS idx_store_orders_customer ON store_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_type ON store_orders(order_type);

-- =====================================================
-- Helper function: update marketplace category product counts
-- =====================================================
CREATE OR REPLACE FUNCTION update_marketplace_category_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update old category count
    IF TG_OP = 'UPDATE' AND OLD.marketplace_category_id IS NOT NULL THEN
        UPDATE marketplace_categories
        SET product_count = (
            SELECT COUNT(*) FROM pos_products
            WHERE marketplace_category_id = OLD.marketplace_category_id
            AND is_active = true AND is_published = true
        )
        WHERE id = OLD.marketplace_category_id;
    END IF;

    -- Update new category count
    IF NEW.marketplace_category_id IS NOT NULL THEN
        UPDATE marketplace_categories
        SET product_count = (
            SELECT COUNT(*) FROM pos_products
            WHERE marketplace_category_id = NEW.marketplace_category_id
            AND is_active = true AND is_published = true
        )
        WHERE id = NEW.marketplace_category_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_marketplace_category_counts ON pos_products;
CREATE TRIGGER trg_update_marketplace_category_counts
    AFTER INSERT OR UPDATE OF marketplace_category_id, is_active, is_published ON pos_products
    FOR EACH ROW
    EXECUTE FUNCTION update_marketplace_category_counts();

-- =====================================================
-- Helper function: update store rating from reviews
-- =====================================================
CREATE OR REPLACE FUNCTION update_store_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE stores SET
        average_rating = (
            SELECT COALESCE(AVG(rating), 0) FROM product_reviews
            WHERE store_id = NEW.store_id AND is_approved = true
        ),
        total_ratings = (
            SELECT COUNT(*) FROM product_reviews
            WHERE store_id = NEW.store_id AND is_approved = true
        ),
        updated_at = NOW()
    WHERE id = NEW.store_id;

    -- Also update product rating
    UPDATE pos_products SET
        average_rating = (
            SELECT COALESCE(AVG(rating), 0) FROM product_reviews
            WHERE product_id = NEW.product_id AND is_approved = true
        ),
        total_ratings = (
            SELECT COUNT(*) FROM product_reviews
            WHERE product_id = NEW.product_id AND is_approved = true
        ),
        updated_at = NOW()
    WHERE id = NEW.product_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_store_rating ON product_reviews;
CREATE TRIGGER trg_update_store_rating
    AFTER INSERT OR UPDATE OR DELETE ON product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_store_rating();
