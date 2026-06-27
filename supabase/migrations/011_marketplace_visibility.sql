-- 011_marketplace_visibility.sql
--
-- Split product visibility into two independent-but-layered flags:
--   is_published        → visible on the merchant's OWN online store (shop page)
--   show_in_marketplace → ALSO listed on the public, aggregated marketplace
--
-- Rule: marketplace requires online — a product only appears on the marketplace
-- when BOTH is_published AND show_in_marketplace are true. is_published=false is
-- a draft (shows nowhere) regardless of show_in_marketplace.
--
-- Backfill = is_published: until now the marketplace gated on is_published alone,
-- so every currently-published product was effectively on the marketplace. Set
-- show_in_marketplace = is_published so nothing disappears from the marketplace
-- when the new gate (is_published AND show_in_marketplace) goes live.

ALTER TABLE pos_products
  ADD COLUMN IF NOT EXISTS show_in_marketplace BOOLEAN DEFAULT false;

UPDATE pos_products
   SET show_in_marketplace = COALESCE(is_published, false)
 WHERE show_in_marketplace IS DISTINCT FROM COALESCE(is_published, false);

-- Marketplace listing queries filter on (is_active, is_published,
-- show_in_marketplace); a partial index keeps those scans cheap.
CREATE INDEX IF NOT EXISTS idx_pos_products_marketplace
  ON pos_products (merchant_id)
  WHERE is_active = true AND is_published = true AND show_in_marketplace = true;
