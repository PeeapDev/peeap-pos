-- Migration: 003_seed_marketplace.sql
-- Description: Seed marketplace categories and banners for ecommerce-first homepage
-- Created: 2026-03-21

-- =====================================================
-- MARKETPLACE CATEGORIES
-- =====================================================
INSERT INTO marketplace_categories (name, slug, description, icon, color, sort_order) VALUES
  ('Phones & Accessories', 'phones-accessories', 'Smartphones, cases, chargers, and mobile accessories', '📱', '#3B82F6', 1),
  ('Electronics', 'electronics', 'Laptops, TVs, speakers, and gadgets', '💻', '#8B5CF6', 2),
  ('Fashion', 'fashion', 'Clothing, shoes, and accessories for men and women', '👗', '#EC4899', 3),
  ('Food & Groceries', 'food-groceries', 'Fresh produce, packaged foods, and beverages', '🛒', '#10B981', 4),
  ('Health & Beauty', 'health-beauty', 'Skincare, cosmetics, and wellness products', '💄', '#F43F5E', 5),
  ('Home & Living', 'home-living', 'Furniture, decor, kitchen, and household items', '🏠', '#F59E0B', 6),
  ('Baby & Kids', 'baby-kids', 'Toys, baby gear, kids clothing, and school supplies', '🧸', '#06B6D4', 7),
  ('Sports & Outdoors', 'sports-outdoors', 'Sportswear, equipment, and outdoor gear', '⚽', '#22C55E', 8),
  ('Books & Stationery', 'books-stationery', 'Books, notebooks, pens, and office supplies', '📚', '#6366F1', 9),
  ('Auto & Parts', 'auto-parts', 'Car parts, accessories, and motorcycle gear', '🚗', '#EF4444', 10),
  ('Building & Hardware', 'building-hardware', 'Construction materials, tools, and hardware', '🔨', '#78716C', 11),
  ('Services', 'services', 'Professional services, repairs, and installations', '🔧', '#0EA5E9', 12);

-- Subcategories for Phones & Accessories
INSERT INTO marketplace_categories (name, slug, description, icon, color, parent_id, sort_order)
SELECT 'Smartphones', 'smartphones', 'New and refurbished smartphones', '📱', '#3B82F6', id, 1
FROM marketplace_categories WHERE slug = 'phones-accessories';

INSERT INTO marketplace_categories (name, slug, description, icon, color, parent_id, sort_order)
SELECT 'Phone Cases', 'phone-cases', 'Protective cases and covers', '🛡️', '#3B82F6', id, 2
FROM marketplace_categories WHERE slug = 'phones-accessories';

INSERT INTO marketplace_categories (name, slug, description, icon, color, parent_id, sort_order)
SELECT 'Chargers & Cables', 'chargers-cables', 'Chargers, power banks, and cables', '🔌', '#3B82F6', id, 3
FROM marketplace_categories WHERE slug = 'phones-accessories';

-- Subcategories for Fashion
INSERT INTO marketplace_categories (name, slug, description, icon, color, parent_id, sort_order)
SELECT 'Men''s Clothing', 'mens-clothing', 'Shirts, trousers, and men''s fashion', '👔', '#EC4899', id, 1
FROM marketplace_categories WHERE slug = 'fashion';

INSERT INTO marketplace_categories (name, slug, description, icon, color, parent_id, sort_order)
SELECT 'Women''s Clothing', 'womens-clothing', 'Dresses, tops, and women''s fashion', '👗', '#EC4899', id, 2
FROM marketplace_categories WHERE slug = 'fashion';

INSERT INTO marketplace_categories (name, slug, description, icon, color, parent_id, sort_order)
SELECT 'Shoes & Footwear', 'shoes-footwear', 'Shoes, sandals, and sneakers', '👟', '#EC4899', id, 3
FROM marketplace_categories WHERE slug = 'fashion';

-- Subcategories for Electronics
INSERT INTO marketplace_categories (name, slug, description, icon, color, parent_id, sort_order)
SELECT 'Laptops', 'laptops', 'Laptops and notebooks', '💻', '#8B5CF6', id, 1
FROM marketplace_categories WHERE slug = 'electronics';

INSERT INTO marketplace_categories (name, slug, description, icon, color, parent_id, sort_order)
SELECT 'TVs & Monitors', 'tvs-monitors', 'Televisions and computer monitors', '📺', '#8B5CF6', id, 2
FROM marketplace_categories WHERE slug = 'electronics';

INSERT INTO marketplace_categories (name, slug, description, icon, color, parent_id, sort_order)
SELECT 'Audio & Speakers', 'audio-speakers', 'Headphones, speakers, and sound systems', '🎧', '#8B5CF6', id, 3
FROM marketplace_categories WHERE slug = 'electronics';

-- =====================================================
-- MARKETPLACE BANNERS
-- =====================================================
-- Note: Update image_url values with real banner images after upload
INSERT INTO marketplace_banners (title, subtitle, image_url, link_type, link_target, sort_order) VALUES
  (
    'Shop Local, Pay Easy',
    'Discover products from verified merchants across Sierra Leone. Pay with mobile money or Peeap Wallet.',
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=400&fit=crop',
    'url',
    '/search',
    1
  ),
  (
    'Start Selling Today',
    'Create your online store in minutes. Reach customers beyond your shop walls.',
    'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=1200&h=400&fit=crop',
    'url',
    '/dashboard',
    2
  ),
  (
    'New Arrivals Weekly',
    'Fresh products added every week from merchants in Freetown, Bo, Kenema, and more.',
    'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1200&h=400&fit=crop',
    'url',
    '/search?sort=newest',
    3
  );
