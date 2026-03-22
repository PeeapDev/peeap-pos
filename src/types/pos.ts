// =====================================================
// POS Type Definitions
// Ported from apps/web/src/services/pos.service.ts
// =====================================================

export interface POSProductVariant {
  id?: string;
  product_id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price_adjustment: number;
  stock_quantity: number;
  is_active: boolean;
  attributes: Record<string, string>;
}

export interface POSCategory {
  id: string;
  merchant_id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface POSProduct {
  id: string;
  merchant_id: string;
  category_id?: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  price: number;
  cost_price: number;
  image_url?: string;
  track_inventory: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  has_variants: boolean;
  variants: POSProductVariant[];
  is_active: boolean;
  is_featured: boolean;
  tax_rate: number;
  created_at: string;
  updated_at: string;
  category?: POSCategory;
  // E-commerce / SEO fields
  slug?: string;
  video_url?: string;
  seo_title?: string;
  seo_description?: string;
  is_published?: boolean;
  // Marketplace fields
  marketplace_category_id?: string;
  marketplace_category?: MarketplaceCategory;
  view_count: number;
  order_count: number;
  images?: string[];
  weight_grams?: number;
  brand?: string;
  average_rating: number;
  total_ratings: number;
  store?: Store;
  reviews?: ProductReview[];
}

export interface POSSaleItem {
  id?: string;
  sale_id?: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  total_price: number;
  cost_price?: number;
  notes?: string;
}

export interface PaymentDetails {
  received?: number;
  change?: number;
  payments?: Array<{
    method: string;
    amount: number;
    reference?: string;
  }>;
}

export interface POSSplitPayment {
  method: "cash" | "mobile_money" | "card" | "qr" | "credit";
  amount: number;
  reference?: string;
  customer_id?: string;
}

export interface POSSale {
  id?: string;
  merchant_id: string;
  sale_number?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: "cash" | "mobile_money" | "card" | "qr" | "split";
  payment_status: "pending" | "completed" | "refunded" | "partial_refund";
  payment_reference?: string;
  payment_details?: PaymentDetails;
  payments?: POSSplitPayment[];
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  cashier_id?: string;
  cashier_name?: string;
  status: "completed" | "voided" | "refunded";
  notes?: string;
  items: POSSaleItem[];
  created_at?: string;
}

export interface CartItem {
  product: POSProduct;
  quantity: number;
  discount: number;
  discountType?: "percentage" | "fixed";
}

export interface POSCustomer {
  id?: string;
  merchant_id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  credit_limit: number;
  credit_balance: number;
  total_purchases: number;
  total_paid: number;
  is_active: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface POSCreditTransaction {
  id?: string;
  merchant_id: string;
  customer_id: string;
  sale_id?: string;
  type: "credit" | "payment";
  amount: number;
  balance_before: number;
  balance_after: number;
  payment_method?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
}

export interface POSHeldOrder {
  id?: string;
  merchant_id: string;
  hold_number?: string;
  customer_name?: string;
  customer_phone?: string;
  items: CartItem[];
  subtotal: number;
  discount_amount: number;
  notes?: string;
  held_by?: string;
  held_at?: string;
  expires_at?: string;
  status: "held" | "resumed" | "expired";
  created_at?: string;
}

export interface POSRefund {
  id?: string;
  merchant_id: string;
  sale_id: string;
  refund_number?: string;
  refund_type: "full" | "partial";
  refund_amount: number;
  refund_method: "cash" | "original" | "store_credit";
  items?: POSSaleItem[];
  reason: string;
  refunded_by?: string;
  created_at?: string;
}

export interface POSDiscount {
  id?: string;
  merchant_id: string;
  name: string;
  code?: string;
  type: "percentage" | "fixed";
  value: number;
  min_purchase?: number;
  max_discount?: number;
  applies_to: "cart" | "item" | "category";
  category_ids?: string[];
  product_ids?: string[];
  start_date?: string;
  end_date?: string;
  usage_limit?: number;
  usage_count: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface POSCashSession {
  id?: string;
  merchant_id: string;
  session_date: string;
  opening_balance: number;
  closing_balance?: number;
  expected_balance?: number;
  cash_sales_total?: number;
  cash_in?: number;
  cash_out?: number;
  difference?: number;
  status: "open" | "closed";
  opened_by?: string;
  opened_at?: string;
  closed_by?: string;
  closed_at?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface POSStaff {
  id?: string;
  merchant_id: string;
  user_id?: string;
  name: string;
  email?: string;
  phone?: string;
  pin?: string;
  role: "admin" | "manager" | "cashier";
  permissions: string[];
  is_active: boolean;
  invitation_status?: "pending" | "accepted" | "declined";
  created_at?: string;
  updated_at?: string;
}

export interface POSLoyaltyProgram {
  id?: string;
  merchant_id: string;
  name: string;
  points_per_currency: number;
  points_value: number;
  min_redeem_points: number;
  max_redeem_percent?: number;
  is_active: boolean;
  created_at?: string;
}

export interface POSLoyaltyPoints {
  id?: string;
  merchant_id: string;
  customer_id: string;
  points_balance: number;
  total_earned: number;
  total_redeemed: number;
  created_at?: string;
  updated_at?: string;
}

export interface POSInventoryAlert {
  id?: string;
  merchant_id: string;
  product_id: string;
  product_name: string;
  current_stock: number;
  threshold: number;
  alert_type: "low_stock" | "out_of_stock";
  is_acknowledged: boolean;
  created_at?: string;
}

export interface POSSalesReport {
  period: "daily" | "weekly" | "monthly" | "custom";
  start_date: string;
  end_date: string;
  total_sales: number;
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  profit_margin: number;
  total_items_sold: number;
  average_ticket: number;
  sales_by_category: {
    category: string;
    sales: number;
    revenue: number;
  }[];
  sales_by_payment: { method: string; count: number; amount: number }[];
  sales_by_hour: { hour: number; count: number; amount: number }[];
  top_products: {
    id: string;
    name: string;
    quantity: number;
    revenue: number;
    profit: number;
  }[];
  sales_trend: { date: string; sales: number; revenue: number }[];
}

// E-commerce types

export interface Store {
  id: string;
  merchant_id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  business_hours?: Record<string, string>;
  social_links?: Record<string, string>;
  is_published: boolean;
  // Marketplace fields
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  is_verified: boolean;
  is_featured: boolean;
  marketplace_category_ids?: string[];
  offers_delivery: boolean;
  delivery_radius_km?: number;
  delivery_fee: number;
  free_delivery_minimum?: number;
  minimum_order?: number;
  preparation_time_minutes?: number;
  average_rating: number;
  total_ratings: number;
  total_orders: number;
  total_revenue: number;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface StoreOrder {
  id: string;
  store_id: string;
  merchant_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  payment_reference?: string;
  status:
    | "pending"
    | "confirmed"
    | "processing"
    | "ready"
    | "completed"
    | "cancelled";
  notes?: string;
  items: StoreOrderItem[];
  // Marketplace delivery fields
  order_type: "online" | "pickup" | "delivery";
  delivery_address?: string;
  delivery_city?: string;
  delivery_fee: number;
  service_fee: number;
  estimated_delivery_time?: string;
  customer_id?: string;
  rating?: number;
  review?: string;
  created_at: string;
  updated_at: string;
}

export interface StoreOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

// Marketplace types

export interface MarketplaceCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image_url?: string;
  color: string;
  parent_id?: string;
  sort_order: number;
  product_count: number;
  is_active: boolean;
  children?: MarketplaceCategory[];
  created_at: string;
  updated_at: string;
}

export interface MarketplaceBanner {
  id: string;
  title: string;
  subtitle?: string;
  image_url: string;
  link_url?: string;
  link_type: string;
  link_target?: string;
  sort_order: number;
  is_active: boolean;
  starts_at: string;
  ends_at?: string;
  created_at: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  store_id: string;
  customer_id?: string;
  customer_name: string;
  rating: number;
  review_text?: string;
  is_verified_purchase: boolean;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  store_id: string;
  product?: POSProduct;
  store?: Store;
  created_at: string;
}

export interface MarketplaceHomepage {
  banners: MarketplaceBanner[];
  categories: MarketplaceCategory[];
  trending_products: POSProduct[];
  featured_stores: Store[];
  new_arrivals: POSProduct[];
}

export interface MarketplaceSearchResult {
  products: POSProduct[];
  total: number;
  page: number;
  per_page: number;
}
