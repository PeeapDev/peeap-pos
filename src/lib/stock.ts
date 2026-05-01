/**
 * Stock Reservation System — atomic via Postgres RPCs.
 *
 * Provides race-free stock operations for the checkout flow:
 *  - reserveStock: Hold stock when order is created (before payment)
 *  - commitStock: Finalize stock deduction when payment succeeds
 *  - releaseStock: Release reserved stock when order is cancelled/expired
 *
 * The previous implementation did SELECT reserved_quantity, check, then
 * UPDATE reserved_quantity = (read_value + qty), which leaks lost-update
 * races under concurrent reservations and oversells stock. The RPCs
 * defined in supabase/migrations/007_atomic_stock_reservation.sql
 * collapse the read+check+write into a single conditional UPDATE that
 * holds the row lock for the duration.
 */

import { supabase } from "@/lib/supabase";

interface StockItem {
  product_id: string;
  quantity: number;
}

/**
 * Reserve stock for items. Each item runs through the atomic
 * `reserve_stock_atomic` RPC. If any item fails to reserve, all
 * previously-reserved items in this call are released.
 */
export async function reserveStock(
  items: StockItem[]
): Promise<{ success: boolean; error?: string }> {
  const reserved: StockItem[] = [];

  for (const item of items) {
    try {
      const { data, error } = await supabase.rpc("reserve_stock_atomic", {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });

      if (error) {
        console.error("[Stock] reserve_stock_atomic failed:", error);
        await releaseStock(reserved);
        return { success: false, error: `Stock reservation failed: ${error.message}` };
      }

      // RPC returns a one-row TABLE; supabase wraps single-row returns as
      // an array.
      const row = Array.isArray(data) ? data[0] : data;

      if (!row || row.ok === false) {
        await releaseStock(reserved);
        return {
          success: false,
          error: row?.product_name
            ? `Insufficient stock for "${row.product_name}". Available: ${row.available ?? 0}`
            : "Insufficient stock",
        };
      }

      reserved.push(item);
    } catch (err) {
      console.error("[Stock] reserveStock exception for", item.product_id, err);
      await releaseStock(reserved);
      return { success: false, error: "Stock reservation failed" };
    }
  }

  return { success: true };
}

/**
 * Commit reserved stock. Called when payment succeeds.
 * Decrements both stock_quantity and reserved_quantity atomically.
 */
export async function commitStock(items: StockItem[]): Promise<void> {
  for (const item of items) {
    try {
      const { error } = await supabase.rpc("commit_stock_atomic", {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });
      if (error) {
        console.error("[Stock] commit_stock_atomic failed:", item.product_id, error);
      }
    } catch (err) {
      console.error("[Stock] commitStock exception for", item.product_id, err);
    }
  }
}

/**
 * Release reserved stock. Called when an order is cancelled or payment fails.
 * Decrements only reserved_quantity, leaving stock_quantity unchanged.
 */
export async function releaseStock(items: StockItem[]): Promise<void> {
  for (const item of items) {
    try {
      const { error } = await supabase.rpc("release_stock_atomic", {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });
      if (error) {
        console.error("[Stock] release_stock_atomic failed:", item.product_id, error);
      }
    } catch (err) {
      console.error("[Stock] releaseStock exception for", item.product_id, err);
    }
  }
}
