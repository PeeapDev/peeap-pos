/**
 * IndexedDB wrapper for offline marketplace data.
 *
 * Stores:
 *   cart             – shopping-cart items keyed by storeSlug
 *   recently_viewed  – last 20 viewed products (FIFO)
 *   product_cache    – product data with 1-hour TTL
 *   search_history   – last 10 search queries (FIFO)
 */

const DB_NAME = "peeap_marketplace";
const DB_VERSION = 1;

// ── Types ──────────────────────────────────────────────────────────

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  variant?: string;
  [key: string]: unknown;
}

export interface RecentProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  slug?: string;
  storeSlug?: string;
  viewedAt: number; // timestamp
  [key: string]: unknown;
}

interface CachedProduct {
  id: string;
  data: Record<string, unknown>;
  cachedAt: number; // timestamp
}

interface SearchEntry {
  query: string;
  searchedAt: number; // timestamp
}

// ── Limits / constants ─────────────────────────────────────────────

const MAX_RECENTLY_VIEWED = 20;
const MAX_SEARCH_HISTORY = 10;
const PRODUCT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Internal helpers ───────────────────────────────────────────────

function openRawDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("cart")) {
        db.createObjectStore("cart", { keyPath: "storeSlug" });
      }
      if (!db.objectStoreNames.contains("recently_viewed")) {
        db.createObjectStore("recently_viewed", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("product_cache")) {
        db.createObjectStore("product_cache", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("search_history")) {
        db.createObjectStore("search_history", { keyPath: "query" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Generic "get one record" from a store. */
function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** Generic "put one record" into a store. */
function idbPut<T>(db: IDBDatabase, store: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Generic "get all records" from a store. */
function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

/** Generic "delete one record" from a store. */
function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Generic "clear all records" in a store. */
function idbClear(db: IDBDatabase, store: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Public API object ──────────────────────────────────────────────

export interface MarketplaceDB {
  cart: {
    get: (storeSlug: string) => Promise<CartItem[]>;
    set: (storeSlug: string, items: CartItem[]) => Promise<void>;
    clear: (storeSlug: string) => Promise<void>;
  };
  recentlyViewed: {
    add: (product: Omit<RecentProduct, "viewedAt">) => Promise<void>;
    getAll: () => Promise<RecentProduct[]>;
    clear: () => Promise<void>;
  };
  productCache: {
    get: (productId: string) => Promise<Record<string, unknown> | null>;
    set: (productId: string, productData: Record<string, unknown>) => Promise<void>;
    clear: () => Promise<void>;
  };
  searchHistory: {
    add: (query: string) => Promise<void>;
    getAll: () => Promise<string[]>;
    clear: () => Promise<void>;
  };
  /** Close the underlying database connection. */
  close: () => void;
}

export async function openMarketplaceDB(): Promise<MarketplaceDB> {
  const db = await openRawDB();

  // ── Cart ───────────────────────────────────────────────────────

  const cart: MarketplaceDB["cart"] = {
    async get(storeSlug: string): Promise<CartItem[]> {
      const record = await idbGet<{ storeSlug: string; items: CartItem[] }>(
        db,
        "cart",
        storeSlug,
      );
      return record?.items ?? [];
    },

    async set(storeSlug: string, items: CartItem[]): Promise<void> {
      await idbPut(db, "cart", { storeSlug, items });
    },

    async clear(storeSlug: string): Promise<void> {
      await idbDelete(db, "cart", storeSlug);
    },
  };

  // ── Recently Viewed ────────────────────────────────────────────

  const recentlyViewed: MarketplaceDB["recentlyViewed"] = {
    async add(product: Omit<RecentProduct, "viewedAt">): Promise<void> {
      const entry = { ...product, viewedAt: Date.now() } as RecentProduct;
      // Upsert the product (same id overwrites)
      await idbPut(db, "recently_viewed", entry);

      // Enforce FIFO cap
      const all = await idbGetAll<RecentProduct>(db, "recently_viewed");
      if (all.length > MAX_RECENTLY_VIEWED) {
        // Sort oldest first and remove extras
        all.sort((a, b) => a.viewedAt - b.viewedAt);
        const toRemove = all.slice(0, all.length - MAX_RECENTLY_VIEWED);
        for (const item of toRemove) {
          await idbDelete(db, "recently_viewed", item.id);
        }
      }
    },

    async getAll(): Promise<RecentProduct[]> {
      const all = await idbGetAll<RecentProduct>(db, "recently_viewed");
      // Return newest first
      return all.sort((a, b) => b.viewedAt - a.viewedAt);
    },

    async clear(): Promise<void> {
      await idbClear(db, "recently_viewed");
    },
  };

  // ── Product Cache ──────────────────────────────────────────────

  const productCache: MarketplaceDB["productCache"] = {
    async get(productId: string): Promise<Record<string, unknown> | null> {
      const record = await idbGet<CachedProduct>(db, "product_cache", productId);
      if (!record) return null;
      // Check TTL
      if (Date.now() - record.cachedAt > PRODUCT_CACHE_TTL_MS) {
        // Expired — remove and return null
        await idbDelete(db, "product_cache", productId);
        return null;
      }
      return record.data;
    },

    async set(productId: string, productData: Record<string, unknown>): Promise<void> {
      const entry: CachedProduct = {
        id: productId,
        data: productData,
        cachedAt: Date.now(),
      };
      await idbPut(db, "product_cache", entry);
    },

    async clear(): Promise<void> {
      await idbClear(db, "product_cache");
    },
  };

  // ── Search History ─────────────────────────────────────────────

  const searchHistory: MarketplaceDB["searchHistory"] = {
    async add(query: string): Promise<void> {
      const trimmed = query.trim();
      if (!trimmed) return;

      const entry: SearchEntry = { query: trimmed, searchedAt: Date.now() };
      await idbPut(db, "search_history", entry);

      // Enforce FIFO cap
      const all = await idbGetAll<SearchEntry>(db, "search_history");
      if (all.length > MAX_SEARCH_HISTORY) {
        all.sort((a, b) => a.searchedAt - b.searchedAt);
        const toRemove = all.slice(0, all.length - MAX_SEARCH_HISTORY);
        for (const item of toRemove) {
          await idbDelete(db, "search_history", item.query);
        }
      }
    },

    async getAll(): Promise<string[]> {
      const all = await idbGetAll<SearchEntry>(db, "search_history");
      // Return newest first
      return all
        .sort((a, b) => b.searchedAt - a.searchedAt)
        .map((e) => e.query);
    },

    async clear(): Promise<void> {
      await idbClear(db, "search_history");
    },
  };

  return {
    cart,
    recentlyViewed,
    productCache,
    searchHistory,
    close: () => db.close(),
  };
}
