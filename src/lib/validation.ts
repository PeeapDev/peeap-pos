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
