import { z } from "zod";

// Products
export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  sku: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
  price: z.number().min(0),
  cost_price: z.number().min(0).default(0),
  category_id: z.string().uuid().optional(),
  image_url: z.string().url().optional(),
  track_inventory: z.boolean().default(false),
  stock_quantity: z.number().int().min(0).default(0),
  low_stock_threshold: z.number().int().min(0).default(10),
  has_variants: z.boolean().default(false),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  tax_rate: z.number().min(0).max(100).default(0),
  // E-commerce / SEO fields
  slug: z.string().max(255).optional(),
  video_url: z.string().url().optional(),
  seo_title: z.string().max(160).optional(),
  seo_description: z.string().max(320).optional(),
  is_published: z.boolean().default(false),
});

export const updateProductSchema = createProductSchema.partial();

// Categories
export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  color: z.string().max(20).default("#3B82F6"),
  icon: z.string().max(50).optional(),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

// Sales
export const saleItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string().min(1),
  product_sku: z.string().optional(),
  quantity: z.number().int().min(1),
  unit_price: z.number().min(0),
  discount_amount: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0),
  total_price: z.number().min(0),
  cost_price: z.number().min(0).default(0),
  notes: z.string().optional(),
});

export const splitPaymentSchema = z.object({
  method: z.enum(["cash", "mobile_money", "card", "qr", "credit"]),
  amount: z.number().min(0),
  reference: z.string().optional(),
  customer_id: z.string().uuid().optional(),
});

export const createSaleSchema = z.object({
  subtotal: z.number().min(0),
  tax_amount: z.number().min(0).default(0),
  discount_amount: z.number().min(0).default(0),
  total_amount: z.number().min(0),
  payment_method: z.enum(["cash", "mobile_money", "card", "qr", "split"]),
  payment_reference: z.string().optional(),
  payment_details: z
    .object({
      received: z.number().optional(),
      change: z.number().optional(),
      payments: z
        .array(
          z.object({
            method: z.string(),
            amount: z.number(),
            reference: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),
  payments: z.array(splitPaymentSchema).optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  customer_email: z.string().optional(),
  cashier_id: z.string().uuid().optional(),
  cashier_name: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(saleItemSchema).min(1),
});

// Stores (merchant storefront profiles)
export const createStoreSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  logo_url: z.string().url().optional(),
  banner_url: z.string().url().optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  business_hours: z.record(z.string()).optional(),
  social_links: z.record(z.string()).optional(),
  is_published: z.boolean().default(false),
});

export const updateStoreSchema = createStoreSchema.partial();

// Customers
export const createCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  is_active: z.boolean().default(true),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// Staff
export const createStaffSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional(),
  role: z
    .enum(["cashier", "manager", "admin"])
    .default("cashier"),
  pin: z.string().min(4).max(6).regex(/^\d+$/).optional(),
  is_active: z.boolean().default(true),
});

export const updateStaffSchema = createStaffSchema.partial();

// Cash Sessions
export const openCashSessionSchema = z.object({
  opening_amount: z.number().min(0),
  opened_by: z.string().max(255).optional(),
  notes: z.string().max(500).optional(),
});

export const cashSessionActionSchema = z.object({
  action: z.enum(["close", "cash_in", "cash_out"]),
  amount: z.number().min(0).optional(),
  closing_amount: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
  closed_by: z.string().max(255).optional(),
});

// Discounts
export const createDiscountSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50).optional(),
  type: z.enum(["percentage", "fixed"]),
  value: z.number().min(0),
  min_order_amount: z.number().min(0).default(0),
  max_discount_amount: z.number().min(0).optional(),
  usage_limit: z.number().int().min(0).optional(),
  starts_at: z.string().optional(),
  expires_at: z.string().optional(),
  is_active: z.boolean().default(true),
  applies_to: z
    .enum(["all", "category", "product"])
    .default("all"),
  target_ids: z.array(z.string().uuid()).optional(),
});

export const updateDiscountSchema = createDiscountSchema.partial();

// Inventory
export const inventoryAdjustmentSchema = z.object({
  product_id: z.string().uuid(),
  type: z.enum([
    "adjustment",
    "restock",
    "return",
    "damage",
    "transfer",
    "count",
  ]),
  quantity_change: z.number().int(),
  reason: z.string().max(500).optional(),
});

export const inventoryThresholdSchema = z.object({
  product_id: z.string().uuid(),
  low_stock_threshold: z.number().int().min(0),
});

// Held Orders
export const createHeldOrderSchema = z.object({
  name: z.string().min(1).max(255),
  items: z.array(z.any()).min(1),
  subtotal: z.number().min(0),
  tax_amount: z.number().min(0).default(0),
  discount_amount: z.number().min(0).default(0),
  total_amount: z.number().min(0),
  customer_name: z.string().max(255).optional(),
  customer_phone: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
});

// Checkout (guest / public)
export const checkoutItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1),
});

export const checkoutSchema = z.object({
  store_id: z.string().uuid(),
  customer_name: z.string().min(1).max(255),
  customer_phone: z.string().max(50).default(""),
  customer_email: z.string().email().max(255).optional(),
  items: z.array(checkoutItemSchema).min(1),
  payment_method: z.enum(["mobile_money", "wallet"]),
  notes: z.string().max(2000).optional(),
  // Delivery fields
  order_type: z.enum(["online", "pickup", "delivery"]).default("online"),
  delivery_address: z.string().max(500).optional(),
  delivery_city: z.string().max(100).optional(),
  customer_id: z.string().uuid().optional(),
});

// Marketplace Categories (admin)
export const createMarketplaceCategorySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  icon: z.string().max(100).optional(),
  image_url: z.string().url().optional(),
  color: z.string().max(20).default("#3B82F6"),
  parent_id: z.string().uuid().optional(),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export const updateMarketplaceCategorySchema =
  createMarketplaceCategorySchema.partial();

// Marketplace Banners (admin)
export const createBannerSchema = z.object({
  title: z.string().min(1).max(255),
  subtitle: z.string().max(500).optional(),
  image_url: z.string().url(),
  link_url: z.string().url().optional(),
  link_type: z.enum(["url", "category", "store", "product"]).default("url"),
  link_target: z.string().max(255).optional(),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
});

export const updateBannerSchema = createBannerSchema.partial();

// Product Review
export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review_text: z.string().max(2000).optional(),
  customer_name: z.string().max(255).optional(),
});

// AI Image Enhancement
export const enhanceImageSchema = z.object({
  image_url: z.string().url(),
  enhancement_type: z.enum(["upscale", "remove_bg", "enhance", "auto_crop"]),
});

// AI Image Generation
export const generateImageSchema = z.object({
  prompt: z.string().min(5).max(500),
  product_name: z.string().min(1).max(255),
});

// Order status updates (merchant)
export const updateOrderStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    "pending",
    "paid",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ]),
  notes: z.string().max(2000).optional(),
});

// Settings
export const updateSettingsSchema = z.object({
  store_name: z.string().max(255).optional(),
  currency: z.string().max(10).default("SLE"),
  tax_rate: z.number().min(0).max(100).default(0),
  tax_inclusive: z.boolean().default(false),
  receipt_header: z.string().max(1000).optional(),
  receipt_footer: z.string().max(1000).optional(),
  receipt_show_logo: z.boolean().default(true),
  low_stock_alert: z.boolean().default(true),
  low_stock_threshold: z.number().int().min(0).default(10),
  require_customer: z.boolean().default(false),
  allow_negative_stock: z.boolean().default(false),
  auto_print_receipt: z.boolean().default(false),
  sound_enabled: z.boolean().default(true),
  theme: z.enum(["light", "dark", "system"]).default("system"),
});
