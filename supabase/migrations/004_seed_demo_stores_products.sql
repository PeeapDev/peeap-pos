-- Migration: 004_seed_demo_stores_products.sql
-- Description: Seed demo stores and products to showcase the marketplace
-- Created: 2026-03-21
-- Run the cleanup first if re-running:
-- DELETE FROM product_reviews WHERE customer_id IN ('c1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000002','c3000000-0000-0000-0000-000000000003','c4000000-0000-0000-0000-000000000004','c5000000-0000-0000-0000-000000000005');
-- DELETE FROM pos_products WHERE merchant_id IN ('a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000004','a5000000-0000-0000-0000-000000000005','a6000000-0000-0000-0000-000000000006');
-- DELETE FROM stores WHERE merchant_id IN ('a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000004','a5000000-0000-0000-0000-000000000005','a6000000-0000-0000-0000-000000000006');

-- =====================================================
-- DEMO STORES (6 merchants across Sierra Leone)
-- =====================================================

INSERT INTO stores (merchant_id, name, slug, description, logo_url, banner_url, address, phone, email, city, country, is_published, is_verified, is_featured, offers_delivery, delivery_fee, free_delivery_minimum, minimum_order, preparation_time_minutes, average_rating, total_ratings, total_orders, tags)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'Tech Hub Freetown',
  'tech-hub-freetown',
  'Your #1 destination for phones, laptops, and gadgets in Freetown. Genuine products with warranty.',
  'https://ui-avatars.com/api/?name=Tech+Hub&background=3B82F6&color=fff&size=200&bold=true',
  'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1200&h=400&fit=crop',
  '15 Siaka Stevens Street, Freetown',
  '+232-76-123456',
  'info@techhub-sl.com',
  'Freetown', 'Sierra Leone',
  true, true, true, true,
  15.00, 200.00, 50.00, 30,
  4.7, 124, 387,
  ARRAY['electronics', 'phones', 'laptops', 'gadgets']
);

INSERT INTO stores (merchant_id, name, slug, description, logo_url, banner_url, address, phone, email, city, country, is_published, is_verified, is_featured, offers_delivery, delivery_fee, free_delivery_minimum, average_rating, total_ratings, total_orders, tags)
VALUES (
  'a2000000-0000-0000-0000-000000000002',
  'Mama Salone Fashion',
  'mama-salone-fashion',
  'Beautiful African fashion, locally made clothes, shoes, and accessories. Express your style with Salone pride.',
  'https://ui-avatars.com/api/?name=Mama+Salone&background=EC4899&color=fff&size=200&bold=true',
  'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&h=400&fit=crop',
  '42 Lumley Beach Road, Freetown',
  '+232-78-234567',
  'mama@salonefashion.com',
  'Freetown', 'Sierra Leone',
  true, true, true, true,
  10.00, 150.00,
  4.5, 89, 256,
  ARRAY['fashion', 'clothing', 'african-wear', 'accessories']
);

INSERT INTO stores (merchant_id, name, slug, description, logo_url, banner_url, address, phone, city, country, is_published, is_verified, is_featured, offers_delivery, delivery_fee, average_rating, total_ratings, total_orders, tags)
VALUES (
  'a3000000-0000-0000-0000-000000000003',
  'Bo Fresh Market',
  'bo-fresh-market',
  'Fresh fruits, vegetables, rice, and groceries delivered to your door in Bo City.',
  'https://ui-avatars.com/api/?name=Bo+Fresh&background=10B981&color=fff&size=200&bold=true',
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&h=400&fit=crop',
  'Bojon Street, Bo City',
  '+232-77-345678',
  'Bo', 'Sierra Leone',
  true, true, true, true,
  5.00,
  4.3, 67, 198,
  ARRAY['groceries', 'fresh-produce', 'food']
);

INSERT INTO stores (merchant_id, name, slug, description, logo_url, address, phone, city, country, is_published, is_featured, offers_delivery, delivery_fee, average_rating, total_ratings, total_orders, tags)
VALUES (
  'a4000000-0000-0000-0000-000000000004',
  'Kenema Electronics',
  'kenema-electronics',
  'Affordable electronics, solar panels, and home appliances for Eastern Province.',
  'https://ui-avatars.com/api/?name=Kenema+Elec&background=8B5CF6&color=fff&size=200&bold=true',
  '78 Hangha Road, Kenema',
  '+232-76-456789',
  'Kenema', 'Sierra Leone',
  true, true, true,
  20.00,
  4.1, 45, 134,
  ARRAY['electronics', 'solar', 'appliances']
);

INSERT INTO stores (merchant_id, name, slug, description, logo_url, address, phone, city, country, is_published, is_verified, offers_delivery, delivery_fee, average_rating, total_ratings, total_orders, tags)
VALUES (
  'a5000000-0000-0000-0000-000000000005',
  'Beauty Palace SL',
  'beauty-palace-sl',
  'Premium skincare, cosmetics, hair products, and beauty accessories. Look your best every day.',
  'https://ui-avatars.com/api/?name=Beauty+Palace&background=F43F5E&color=fff&size=200&bold=true',
  '23 Wilkinson Road, Freetown',
  '+232-78-567890',
  'Freetown', 'Sierra Leone',
  true, true, true,
  10.00,
  4.6, 93, 312,
  ARRAY['beauty', 'cosmetics', 'skincare', 'hair']
);

INSERT INTO stores (merchant_id, name, slug, description, logo_url, address, phone, city, country, is_published, offers_delivery, delivery_fee, average_rating, total_ratings, total_orders, tags)
VALUES (
  'a6000000-0000-0000-0000-000000000006',
  'Makeni Home & Living',
  'makeni-home-living',
  'Furniture, bedding, kitchen essentials, and home decor. Transform your living space.',
  'https://ui-avatars.com/api/?name=Makeni+Home&background=F59E0B&color=fff&size=200&bold=true',
  '5 Azzolini Highway, Makeni',
  '+232-77-678901',
  'Makeni', 'Sierra Leone',
  true, true,
  25.00,
  4.0, 38, 89,
  ARRAY['furniture', 'home', 'kitchen', 'decor']
);

-- =====================================================
-- DEMO PRODUCTS
-- =====================================================

-- === TECH HUB FREETOWN ===
INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, is_featured, track_inventory, stock_quantity, order_count, view_count, average_rating, total_ratings, marketplace_category_id)
SELECT 'a1000000-0000-0000-0000-000000000001',
  'iPhone 15 Pro Max 256GB', 'Brand new iPhone 15 Pro Max with 256GB storage. Natural Titanium finish. 1 year warranty.',
  8500.00, 7200.00,
  'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&h=600&fit=crop',
  'iphone-15-pro-max-256gb', 'Apple',
  true, true, true, true, 8, 45, 890, 4.8, 32,
  id FROM marketplace_categories WHERE slug = 'smartphones';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, average_rating, total_ratings, marketplace_category_id)
SELECT 'a1000000-0000-0000-0000-000000000001',
  'Samsung Galaxy S24 Ultra', 'Samsung Galaxy S24 Ultra 512GB. AI-powered camera. Titanium frame.',
  7200.00, 6000.00,
  'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&h=600&fit=crop',
  'samsung-galaxy-s24-ultra', 'Samsung',
  true, true, true, 12, 38, 720, 4.6, 28,
  id FROM marketplace_categories WHERE slug = 'smartphones';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, average_rating, total_ratings, marketplace_category_id)
SELECT 'a1000000-0000-0000-0000-000000000001',
  'MacBook Air M3 15"', 'Apple MacBook Air with M3 chip. 15-inch Liquid Retina display. 16GB RAM, 512GB SSD.',
  12000.00, 10500.00,
  'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop',
  'macbook-air-m3-15', 'Apple',
  true, true, true, 5, 22, 456, 4.9, 18,
  id FROM marketplace_categories WHERE slug = 'laptops';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a1000000-0000-0000-0000-000000000001',
  'AirPods Pro 2nd Gen', 'Apple AirPods Pro with USB-C. Active noise cancellation. Adaptive audio.',
  850.00, 680.00,
  'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&h=600&fit=crop',
  'airpods-pro-2', 'Apple',
  true, true, true, 20, 67, 1200,
  id FROM marketplace_categories WHERE slug = 'audio-speakers';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a1000000-0000-0000-0000-000000000001',
  'Anker 20000mAh Power Bank', 'Anker PowerCore 20000mAh portable charger. Fast charging for 2 devices.',
  250.00, 180.00,
  'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&h=600&fit=crop',
  'anker-20000mah-power-bank', 'Anker',
  true, true, true, 35, 89, 670,
  id FROM marketplace_categories WHERE slug = 'chargers-cables';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a1000000-0000-0000-0000-000000000001',
  'JBL Flip 6 Bluetooth Speaker', 'Waterproof portable speaker with powerful bass. 12 hours playtime.',
  450.00, 350.00,
  'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=600&fit=crop',
  'jbl-flip-6-speaker', 'JBL',
  true, true, true, 15, 54, 430,
  id FROM marketplace_categories WHERE slug = 'audio-speakers';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, average_rating, total_ratings, marketplace_category_id)
SELECT 'a1000000-0000-0000-0000-000000000001',
  'Tecno Camon 30 Pro', 'Tecno Camon 30 Pro 256GB. 108MP camera. Fast charging. Perfect for Sierra Leone networks.',
  1800.00, 1400.00,
  'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&h=600&fit=crop',
  'tecno-camon-30-pro', 'Tecno',
  true, true, true, 25, 92, 1540, 4.4, 56,
  id FROM marketplace_categories WHERE slug = 'smartphones';

-- === MAMA SALONE FASHION ===
INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, is_featured, track_inventory, stock_quantity, order_count, view_count, average_rating, total_ratings, marketplace_category_id)
SELECT 'a2000000-0000-0000-0000-000000000002',
  'African Print Ankara Dress', 'Beautiful handmade Ankara dress with bold African patterns. Multiple sizes available.',
  180.00, 90.00,
  'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=600&h=600&fit=crop',
  'african-print-ankara-dress', 'Mama Salone',
  true, true, true, true, 30, 78, 920, 4.7, 45,
  id FROM marketplace_categories WHERE slug = 'womens-clothing';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, average_rating, total_ratings, marketplace_category_id)
SELECT 'a2000000-0000-0000-0000-000000000002',
  'Men''s African Kaftan Set', 'Elegant embroidered kaftan with matching trousers. Perfect for occasions.',
  250.00, 130.00,
  'https://images.unsplash.com/photo-1621072156002-e2fccdc0b176?w=600&h=600&fit=crop',
  'mens-african-kaftan-set', 'Mama Salone',
  true, true, true, 20, 56, 780, 4.5, 34,
  id FROM marketplace_categories WHERE slug = 'mens-clothing';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a2000000-0000-0000-0000-000000000002',
  'Leather Sandals Handmade', 'Genuine leather sandals, handcrafted by local artisans. Comfortable and durable.',
  120.00, 60.00,
  'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=600&h=600&fit=crop',
  'leather-sandals-handmade', 'Mama Salone',
  true, true, true, 40, 43, 560,
  id FROM marketplace_categories WHERE slug = 'shoes-footwear';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a2000000-0000-0000-0000-000000000002',
  'Kente Cloth Tote Bag', 'Stylish tote bag made from authentic Kente cloth. Spacious and eye-catching.',
  85.00, 40.00,
  'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=600&h=600&fit=crop',
  'kente-cloth-tote-bag', 'Mama Salone',
  true, true, true, 50, 67, 430,
  id FROM marketplace_categories WHERE slug = 'fashion';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a2000000-0000-0000-0000-000000000002',
  'Nike Air Max 90 Sneakers', 'Classic Nike Air Max 90. Comfortable cushioning for everyday wear.',
  550.00, 420.00,
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop',
  'nike-air-max-90', 'Nike',
  true, true, true, 15, 34, 890,
  id FROM marketplace_categories WHERE slug = 'shoes-footwear';

-- === BO FRESH MARKET ===
INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, is_active, is_published, is_featured, track_inventory, stock_quantity, order_count, view_count, average_rating, total_ratings, marketplace_category_id)
SELECT 'a3000000-0000-0000-0000-000000000003',
  'Local Rice 50kg Bag', 'Premium Sierra Leone local rice. 50kg bag. Freshly milled from Bo district.',
  350.00, 280.00,
  'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&h=600&fit=crop',
  'local-rice-50kg',
  true, true, true, true, 100, 156, 2100, 4.5, 89,
  id FROM marketplace_categories WHERE slug = 'food-groceries';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a3000000-0000-0000-0000-000000000003',
  'Palm Oil 5 Litres', 'Pure red palm oil. 5 litre container. Essential for Sierra Leonean cooking.',
  75.00, 55.00,
  'https://images.unsplash.com/photo-1474979266404-7f28b8ba8d16?w=600&h=600&fit=crop',
  'palm-oil-5-litres',
  true, true, true, 80, 134, 1800,
  id FROM marketplace_categories WHERE slug = 'food-groceries';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a3000000-0000-0000-0000-000000000003',
  'Fresh Cassava Leaves Bundle', 'Fresh cassava leaves for plasas. Harvested daily from local farms.',
  15.00, 8.00,
  'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&h=600&fit=crop',
  'fresh-cassava-leaves',
  true, true, true, 200, 245, 890,
  id FROM marketplace_categories WHERE slug = 'food-groceries';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a3000000-0000-0000-0000-000000000003',
  'Groundnut Paste 1kg', 'Freshly ground groundnut paste. Perfect for soups and sauces.',
  45.00, 30.00,
  'https://images.unsplash.com/photo-1612187209234-c85eb77e1029?w=600&h=600&fit=crop',
  'groundnut-paste-1kg',
  true, true, true, 60, 98, 670,
  id FROM marketplace_categories WHERE slug = 'food-groceries';

-- === KENEMA ELECTRONICS ===
INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, is_featured, track_inventory, stock_quantity, order_count, view_count, average_rating, total_ratings, marketplace_category_id)
SELECT 'a4000000-0000-0000-0000-000000000004',
  '200W Solar Panel Kit', 'Complete 200W solar panel kit with charge controller and cables. Power your home off-grid.',
  1200.00, 900.00,
  'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&h=600&fit=crop',
  '200w-solar-panel-kit', 'SunPower',
  true, true, true, true, 10, 34, 560, 4.3, 21,
  id FROM marketplace_categories WHERE slug = 'electronics';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a4000000-0000-0000-0000-000000000004',
  '32" LED Smart TV', 'Full HD 32 inch LED Smart TV with Android. Stream your favourite content.',
  1500.00, 1200.00,
  'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&h=600&fit=crop',
  '32-led-smart-tv', 'Hisense',
  true, true, true, 8, 28, 450,
  id FROM marketplace_categories WHERE slug = 'tvs-monitors';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, average_rating, total_ratings, marketplace_category_id)
SELECT 'a4000000-0000-0000-0000-000000000004',
  'Rechargeable LED Lantern', 'Solar rechargeable LED lantern. 3 brightness levels. Perfect for load shedding.',
  35.00, 20.00,
  'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=600&h=600&fit=crop',
  'rechargeable-led-lantern', 'GenPower',
  true, true, true, 100, 178, 2300, 4.2, 89,
  id FROM marketplace_categories WHERE slug = 'electronics';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a4000000-0000-0000-0000-000000000004',
  'Standing Fan 16"', '16 inch standing fan with 3 speed settings. Quiet operation.',
  180.00, 130.00,
  'https://images.unsplash.com/photo-1614005803024-5d3e27e54096?w=600&h=600&fit=crop',
  'standing-fan-16', 'Binatone',
  true, true, true, 25, 67, 890,
  id FROM marketplace_categories WHERE slug = 'electronics';

-- === BEAUTY PALACE SL ===
INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, is_featured, track_inventory, stock_quantity, order_count, view_count, average_rating, total_ratings, marketplace_category_id)
SELECT 'a5000000-0000-0000-0000-000000000005',
  'Shea Butter Body Cream 500ml', 'Pure African shea butter moisturizing cream. Natural ingredients. Made in Sierra Leone.',
  45.00, 20.00,
  'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=600&h=600&fit=crop',
  'shea-butter-body-cream', 'Beauty Palace',
  true, true, true, true, 80, 145, 1890, 4.8, 78,
  id FROM marketplace_categories WHERE slug = 'health-beauty';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, average_rating, total_ratings, marketplace_category_id)
SELECT 'a5000000-0000-0000-0000-000000000005',
  'Human Hair Wig 20"', 'Premium quality human hair wig. 20 inches. Natural black. Lace front.',
  800.00, 500.00,
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&h=600&fit=crop',
  'human-hair-wig-20', 'Beauty Palace',
  true, true, true, 12, 89, 1200, 4.6, 56,
  id FROM marketplace_categories WHERE slug = 'health-beauty';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a5000000-0000-0000-0000-000000000005',
  'MAC Lipstick Set (6 pieces)', 'MAC matte lipstick collection. 6 popular shades in one set.',
  120.00, 75.00,
  'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600&h=600&fit=crop',
  'mac-lipstick-set-6', 'MAC',
  true, true, true, 30, 112, 1560,
  id FROM marketplace_categories WHERE slug = 'health-beauty';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a5000000-0000-0000-0000-000000000005',
  'Coconut Oil Hair Treatment', 'Virgin coconut oil for hair growth and conditioning. 250ml bottle.',
  30.00, 15.00,
  'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=600&h=600&fit=crop',
  'coconut-oil-hair-treatment', 'Beauty Palace',
  true, true, true, 60, 134, 890,
  id FROM marketplace_categories WHERE slug = 'health-beauty';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a5000000-0000-0000-0000-000000000005',
  'Perfume Gift Set - Ladies', 'Luxury perfume gift set with 3 fragrances. Beautiful packaging for gifting.',
  200.00, 120.00,
  'https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&h=600&fit=crop',
  'perfume-gift-set-ladies', 'Various',
  true, true, true, 18, 56, 670,
  id FROM marketplace_categories WHERE slug = 'health-beauty';

-- === MAKENI HOME & LIVING ===
INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, is_featured, track_inventory, stock_quantity, order_count, view_count, average_rating, total_ratings, marketplace_category_id)
SELECT 'a6000000-0000-0000-0000-000000000006',
  'Queen Size Bed Frame', 'Solid wood queen size bed frame. Durable construction. Easy assembly.',
  2500.00, 1800.00,
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&h=600&fit=crop',
  'queen-size-bed-frame', 'Makeni Home',
  true, true, true, true, 5, 23, 340, 4.4, 15,
  id FROM marketplace_categories WHERE slug = 'home-living';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a6000000-0000-0000-0000-000000000006',
  'Non-Stick Cooking Set (7 pieces)', 'Complete non-stick cooking pot and pan set. 7 pieces with lids.',
  350.00, 220.00,
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=600&fit=crop',
  'non-stick-cooking-set-7', 'Prestige',
  true, true, true, 20, 45, 560,
  id FROM marketplace_categories WHERE slug = 'home-living';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a6000000-0000-0000-0000-000000000006',
  'Foam Mattress 6x6 Medium', 'High density foam mattress. 6x6 feet. Medium firmness for comfort.',
  1200.00, 850.00,
  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&h=600&fit=crop',
  'foam-mattress-6x6-medium', 'Vitafoam',
  true, true, true, 8, 34, 450,
  id FROM marketplace_categories WHERE slug = 'home-living';

INSERT INTO pos_products (merchant_id, name, description, price, cost_price, image_url, slug, brand, is_active, is_published, track_inventory, stock_quantity, order_count, view_count, marketplace_category_id)
SELECT 'a6000000-0000-0000-0000-000000000006',
  'Plastic Storage Containers (Set of 5)', 'Stackable food storage containers with airtight lids. BPA-free.',
  65.00, 35.00,
  'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=600&h=600&fit=crop',
  'plastic-storage-containers-5', 'Makeni Home',
  true, true, true, 40, 78, 340,
  id FROM marketplace_categories WHERE slug = 'home-living';

-- =====================================================
-- DEMO REVIEWS
-- =====================================================
INSERT INTO product_reviews (product_id, store_id, customer_id, customer_name, rating, review_text, is_verified_purchase)
SELECT p.id, s.id, 'c1000000-0000-0000-0000-000000000001', 'Aminata K.', 5,
  'Excellent phone! Fast delivery to my door in Freetown. Very happy with the purchase.', true
FROM pos_products p JOIN stores s ON p.merchant_id = s.merchant_id WHERE p.slug = 'iphone-15-pro-max-256gb';

INSERT INTO product_reviews (product_id, store_id, customer_id, customer_name, rating, review_text, is_verified_purchase)
SELECT p.id, s.id, 'c2000000-0000-0000-0000-000000000002', 'Mohamed B.', 5,
  'Best rice in Bo! Always fresh and clean. I order every month.', true
FROM pos_products p JOIN stores s ON p.merchant_id = s.merchant_id WHERE p.slug = 'local-rice-50kg';

INSERT INTO product_reviews (product_id, store_id, customer_id, customer_name, rating, review_text, is_verified_purchase)
SELECT p.id, s.id, 'c3000000-0000-0000-0000-000000000003', 'Fatmata S.', 5,
  'Love this cream! My skin feels so smooth. 100% natural ingredients.', true
FROM pos_products p JOIN stores s ON p.merchant_id = s.merchant_id WHERE p.slug = 'shea-butter-body-cream';

INSERT INTO product_reviews (product_id, store_id, customer_id, customer_name, rating, review_text, is_verified_purchase)
SELECT p.id, s.id, 'c4000000-0000-0000-0000-000000000004', 'Ibrahim D.', 4,
  'Good solar panel, powers my lights and phone charging. Great for areas without EDSA power.', true
FROM pos_products p JOIN stores s ON p.merchant_id = s.merchant_id WHERE p.slug = '200w-solar-panel-kit';

INSERT INTO product_reviews (product_id, store_id, customer_id, customer_name, rating, review_text, is_verified_purchase)
SELECT p.id, s.id, 'c5000000-0000-0000-0000-000000000005', 'Mariama J.', 5,
  'Beautiful dress! The Ankara print is stunning. Got so many compliments.', true
FROM pos_products p JOIN stores s ON p.merchant_id = s.merchant_id WHERE p.slug = 'african-print-ankara-dress';
