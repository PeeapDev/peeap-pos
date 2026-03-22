-- Migration: 005_store_enhancements.sql
-- Description: Add vendor profile enhancements
-- Created: 2026-03-21

ALTER TABLE stores ADD COLUMN IF NOT EXISTS established_year INTEGER;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS specializations TEXT[] DEFAULT '{}';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS return_policy TEXT DEFAULT '100% Money Back Guarantee on all products within 7 days';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS response_time_hours INTEGER DEFAULT 1;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS total_products INTEGER DEFAULT 0;

-- Update demo stores with established years and specializations
UPDATE stores SET established_year = 2021, specializations = ARRAY['Smartphones', 'Laptops', 'Gadgets', 'Phone Accessories'], total_products = 7 WHERE slug = 'tech-hub-freetown';
UPDATE stores SET established_year = 2019, specializations = ARRAY['African Fashion', 'Ankara', 'Handmade Shoes', 'Accessories'], total_products = 5 WHERE slug = 'mama-salone-fashion';
UPDATE stores SET established_year = 2020, specializations = ARRAY['Local Rice', 'Fresh Produce', 'Groceries', 'Palm Oil'], total_products = 4 WHERE slug = 'bo-fresh-market';
UPDATE stores SET established_year = 2022, specializations = ARRAY['Solar Panels', 'TVs', 'Home Appliances', 'LED Lighting'], total_products = 4 WHERE slug = 'kenema-electronics';
UPDATE stores SET established_year = 2020, specializations = ARRAY['Skincare', 'Cosmetics', 'Hair Products', 'Wigs'], total_products = 5 WHERE slug = 'beauty-palace-sl';
UPDATE stores SET established_year = 2023, specializations = ARRAY['Furniture', 'Mattresses', 'Kitchen Essentials', 'Home Decor'], total_products = 4 WHERE slug = 'makeni-home-living';
