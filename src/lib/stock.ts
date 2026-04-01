/**
 * Stock Reservation System
 * Provides atomic stock operations for the checkout flow:
 * - reserveStock: Hold stock when order is created (before payment)
 * - commitStock: Finalize stock deduction when payment succeeds
 * - releaseStock: Release reserved stock when order is cancelled/expired
 */

import { supabase } from "@/lib/supabase";

interface StockItem {
  product_id: string;
  quantity: number;
}

/**
 * Reserve stock for items. Increments reserved_quantity only if enough
 * available stock exists (stock_quantity - reserved_quantity >= quantity).
 * Rolls back all reservations if any item fails.
 */
export async function reserveStock(
  items: StockItem[]
): Promise<{ success: boolean; error?: string }> {
  const reserved: StockItem[] = [];

  for (const item of items) {
    try {
      // Fetch current stock
      const { data: product } = await supabase
        .from("pos_products")
        .select("id, name, stock_quantity, reserved_quantity, track_inventory")
        .eq("id", item.product_id)
        .single();

      if (!product || !product.track_inventory) {
        // Non-tracked products don't need reservation
        continue;
      }

      const available =
        product.stock_quantity - (product.reserved_quantity || 0);
      if (available < item.quantity) {
        // Rollback previous reservations
        await releaseStock(reserved);
        return {
          success: false,
          error: `Insufficient stock for "${product.name}". Available: ${available}`,
        };
      }

      // Reserve
      const { error } = await supabase
        .from("pos_products")
        .update({
          reserved_quantity: (product.reserved_quantity || 0) + item.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.product_id);

      if (error) {
        await releaseStock(reserved);
        return { success: false, error: `Failed to reserve stock: ${error.message}` };
      }

      reserved.push(item);
    } catch (err) {
      console.error("[Stock] reserveStock error for", item.product_id, err);
      await releaseStock(reserved);
      return { success: false, error: "Stock reservation failed" };
    }
  }

  return { success: true };
}

/**
 * Commit reserved stock. Called when payment succeeds.
 * Decrements both stock_quantity and reserved_quantity.
 */
export async function commitStock(items: StockItem[]): Promise<void> {
  for (const item of items) {
    try {
      const { data: product } = await supabase
        .from("pos_products")
        .select("id, stock_quantity, reserved_quantity, track_inventory")
        .eq("id", item.product_id)
        .single();

      if (!product || !product.track_inventory) continue;

      await supabase
        .from("pos_products")
        .update({
          stock_quantity: Math.max(0, product.stock_quantity - item.quantity),
          reserved_quantity: Math.max(
            0,
            (product.reserved_quantity || 0) - item.quantity
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.product_id);
    } catch (err) {
      console.error("[Stock] commitStock error for", item.product_id, err);
    }
  }
}

/**
 * Release reserved stock. Called when order is cancelled or payment fails.
 * Decrements only reserved_quantity, leaving stock_quantity unchanged.
 */
export async function releaseStock(items: StockItem[]): Promise<void> {
  for (const item of items) {
    try {
      const { data: product } = await supabase
        .from("pos_products")
        .select("id, reserved_quantity, track_inventory")
        .eq("id", item.product_id)
        .single();

      if (!product || !product.track_inventory) continue;

      await supabase
        .from("pos_products")
        .update({
          reserved_quantity: Math.max(
            0,
            (product.reserved_quantity || 0) - item.quantity
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.product_id);
    } catch (err) {
      console.error("[Stock] releaseStock error for", item.product_id, err);
    }
  }
}
