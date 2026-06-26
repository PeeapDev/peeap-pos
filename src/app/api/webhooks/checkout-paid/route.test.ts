import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests for the checkout-paid settlement webhook.
 *
 * Covers the two real flows + auth:
 *   - auth: bad secret / bad HMAC signature are rejected
 *   - terminal/scan-pay: no pre-existing order → durable receipt + sellStock,
 *     and a retry dedupes (UNIQUE checkout_session_id)
 *   - marketplace: existing pending order → atomic claim + merchant credit +
 *     commitStock; an already-paid order dedupes without re-crediting
 *
 * The Supabase client is replaced with a small in-memory fake that models the
 * query-builder chain (select/eq/maybeSingle, update/eq/select, insert/select)
 * and the UNIQUE(checkout_session_id) constraint. Wallet + stock side effects
 * are spies. The security helpers (HMAC) are the real implementation.
 */

// ── Shared, hoisted mock state (vi.mock factories run before module init) ──
const h = vi.hoisted(() => {
  type Row = Record<string, any>;
  type DB = Record<string, Row[]>;
  const state: { db: DB } = { db: {} };

  class Builder {
    private op: "select" | "update" | "insert" = "select";
    private filters: Array<[string, any]> = [];
    private patch: Row | null = null;
    private insertRow: Row | null = null;
    private selected = false;
    private wantSingle = false;
    constructor(private db: DB, private table: string) {}

    select() {
      this.selected = true;
      return this;
    }
    eq(col: string, val: any) {
      this.filters.push([col, val]);
      return this;
    }
    maybeSingle() {
      this.wantSingle = true;
      return this;
    }
    update(obj: Row) {
      this.op = "update";
      this.patch = obj;
      this.selected = false;
      return this;
    }
    insert(obj: Row) {
      this.op = "insert";
      this.insertRow = obj;
      this.selected = false;
      return this;
    }

    private rows() {
      return (this.db[this.table] ||= []);
    }
    private match(r: Row) {
      return this.filters.every(([c, v]) => r[c] === v);
    }

    private run() {
      const rows = this.rows();
      if (this.op === "select") {
        const found = rows.filter((r) => this.match(r));
        return this.wantSingle
          ? { data: found[0] ?? null, error: null }
          : { data: found, error: null };
      }
      if (this.op === "update") {
        const matched = rows.filter((r) => this.match(r));
        matched.forEach((r) => Object.assign(r, this.patch));
        if (this.selected) return { data: matched.map((r) => ({ ...r })), error: null };
        if (this.wantSingle) return { data: matched[0] ?? null, error: null };
        return { data: null, error: null };
      }
      // insert
      const row: Row = { ...this.insertRow };
      if (!row.id) row.id = `gen-${rows.length + 1}`;
      if (
        row.checkout_session_id &&
        rows.some((r) => r.checkout_session_id === row.checkout_session_id)
      ) {
        return { data: null, error: { code: "23505", message: "duplicate key" } };
      }
      rows.push(row);
      if (this.wantSingle) return { data: { id: row.id }, error: null };
      if (this.selected) return { data: [{ id: row.id }], error: null };
      return { data: null, error: null };
    }

    then(onF: (v: any) => any, onR?: (e: any) => any) {
      return Promise.resolve(this.run()).then(onF, onR);
    }
  }

  return {
    state,
    Builder,
    creditWallet: vi.fn(),
    commitStock: vi.fn(),
    sellStock: vi.fn(),
    generateReceiptPDF: vi.fn(),
    uploadToR2: vi.fn(),
    sendNotification: vi.fn(),
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (t: string) => new h.Builder(h.state.db, t),
    rpc: async () => ({ data: null, error: null }),
  },
}));
vi.mock("@/lib/api-client", () => ({ creditWallet: h.creditWallet }));
vi.mock("@/lib/stock", () => ({
  commitStock: h.commitStock,
  sellStock: h.sellStock,
}));
vi.mock("@/lib/receipt-pdf", () => ({ generateReceiptPDF: h.generateReceiptPDF }));
vi.mock("@/lib/r2", () => ({ uploadToR2: h.uploadToR2 }));
vi.mock("@/lib/notification-client", () => ({ sendNotification: h.sendNotification }));

import { POST } from "@/app/api/webhooks/checkout-paid/route";
import { hmacSha256Hex } from "@/lib/security";

const SECRET = "test-service-secret";

function makeReq(
  body: unknown,
  opts: { secret?: string | null; signature?: string } = {}
) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const headers = new Map<string, string>();
  if (opts.secret !== null) headers.set("x-service-secret", opts.secret ?? SECRET);
  if (opts.signature) headers.set("x-signature", opts.signature);
  return {
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    text: async () => raw,
  } as any;
}

beforeEach(() => {
  h.state.db = {};
  h.creditWallet.mockReset().mockResolvedValue({ data: { transaction_id: "tx_1" } });
  h.commitStock.mockReset().mockResolvedValue(undefined);
  h.sellStock.mockReset().mockResolvedValue(undefined);
  h.generateReceiptPDF.mockReset().mockResolvedValue(new ArrayBuffer(8));
  h.uploadToR2.mockReset().mockResolvedValue("https://r2.example/receipt.pdf");
  h.sendNotification.mockReset().mockResolvedValue(true);
  process.env.SERVICE_SECRET = SECRET;
});

describe("checkout-paid webhook — auth", () => {
  it("rejects a missing/wrong service secret with 401", async () => {
    const res = await POST(makeReq({ session_id: "s1", store_id: "store_1" }, { secret: "nope" }));
    expect(res.status).toBe(401);
    expect(h.sellStock).not.toHaveBeenCalled();
  });

  it("rejects a bad HMAC signature when one is provided", async () => {
    const res = await POST(
      makeReq({ session_id: "s1", store_id: "store_1" }, { signature: "sha256=deadbeef" })
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("bad_signature");
  });

  it("accepts a correct HMAC signature", async () => {
    const body = { session_id: "sess_sig", store_id: "store_1", amount: 100 };
    h.state.db.stores = [{ id: "store_1", merchant_id: "merch_1" }];
    const raw = JSON.stringify(body);
    const sig = await hmacSha256Hex(raw, SECRET);
    const res = await POST(makeReq(raw, { signature: sig }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });
});

describe("checkout-paid webhook — validation", () => {
  it("400s when session_id or store_id is missing", async () => {
    const res = await POST(makeReq({ session_id: "", store_id: "" }));
    expect(res.status).toBe(400);
  });
});

describe("checkout-paid webhook — terminal/scan-pay path", () => {
  it("creates a durable receipt and decrements stock via sellStock", async () => {
    h.state.db.stores = [{ id: "store_1", merchant_id: "merch_1" }];
    const res = await POST(
      makeReq({
        session_id: "sess_term_1",
        store_id: "store_1",
        amount: 5000,
        line_items: [{ product_id: "p1", qty: 2 }],
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.settled).toBe(true);

    // A paid receipt row now exists for this session.
    const orders = h.state.db.store_orders || [];
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      status: "paid",
      checkout_session_id: "sess_term_1",
      merchant_id: "merch_1",
    });

    // Unreserved sale → sellStock (NOT commitStock, which would touch reserved).
    expect(h.sellStock).toHaveBeenCalledWith([{ product_id: "p1", quantity: 2 }]);
    expect(h.commitStock).not.toHaveBeenCalled();
    // Terminal funds already moved at scan time → no double credit.
    expect(h.creditWallet).not.toHaveBeenCalled();
  });

  it("sends an instant receipt to the payer when paid_by_user_id is present", async () => {
    h.state.db.stores = [{ id: "store_1", merchant_id: "merch_1", name: "Corner Shop" }];
    const res = await POST(
      makeReq({
        session_id: "sess_term_receipt",
        store_id: "store_1",
        amount: 7500,
        paid_by_user_id: "payer_99",
        line_items: [{ product_id: "p1", qty: 1, name: "Rice 5kg", price: 7500 }],
      })
    );
    expect(res.status).toBe(200);
    // Receipt PDF generated + uploaded, and payer notified with the link.
    expect(h.generateReceiptPDF).toHaveBeenCalledTimes(1);
    expect(h.uploadToR2).toHaveBeenCalledTimes(1);
    expect(h.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "payer_99",
        type: "payment_receipt",
        action_url: "https://r2.example/receipt.pdf",
      })
    );
  });

  it("dedupes a retried terminal delivery (same session_id)", async () => {
    h.state.db.stores = [{ id: "store_1", merchant_id: "merch_1" }];
    const payload = {
      session_id: "sess_term_2",
      store_id: "store_1",
      amount: 5000,
      line_items: [{ product_id: "p1", qty: 1 }],
    };
    const first = await POST(makeReq(payload));
    expect((await first.json()).settled).toBe(true);

    const second = await POST(makeReq(payload));
    const json = await second.json();
    expect(json.deduped).toBe(true);
    // Still only one receipt; stock not decremented twice.
    expect(h.state.db.store_orders).toHaveLength(1);
    expect(h.sellStock).toHaveBeenCalledTimes(1);
  });
});

describe("checkout-paid webhook — marketplace path", () => {
  it("claims a pending order, credits the merchant, and commits reserved stock", async () => {
    h.state.db.stores = [{ id: "store_1", merchant_id: "merch_1" }];
    h.state.db.store_orders = [
      {
        id: "ord_1",
        status: "pending",
        merchant_id: "merch_1",
        total_amount: 10000,
        payment_reference: "sess_mp_1",
      },
    ];
    h.state.db.store_order_items = [
      { order_id: "ord_1", product_id: "p9", quantity: 3 },
    ];

    const res = await POST(
      makeReq({ session_id: "sess_mp_1", store_id: "store_1", amount: 10000 })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).settled).toBe(true);

    expect(h.state.db.store_orders[0].status).toBe("paid");
    expect(h.creditWallet).toHaveBeenCalledWith(
      "merch_1",
      10000,
      expect.any(String),
      "ord_1"
    );
    expect(h.commitStock).toHaveBeenCalledWith([{ product_id: "p9", quantity: 3 }]);
    // No extra receipt row created for an order that already existed.
    expect(h.state.db.store_orders).toHaveLength(1);
  });

  it("dedupes an already-paid order without re-crediting", async () => {
    h.state.db.store_orders = [
      {
        id: "ord_2",
        status: "paid",
        merchant_id: "merch_1",
        total_amount: 10000,
        payment_reference: "sess_mp_2",
      },
    ];
    const res = await POST(
      makeReq({ session_id: "sess_mp_2", store_id: "store_1", amount: 10000 })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).deduped).toBe(true);
    expect(h.creditWallet).not.toHaveBeenCalled();
    expect(h.commitStock).not.toHaveBeenCalled();
  });
});
