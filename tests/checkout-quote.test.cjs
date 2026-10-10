const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
function load(relative, replacements = {}, globals = {}, exposePin = false) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  vm.runInNewContext(outputText + (exposePin ? "\nmodule.exports.PinOverlay = PinOverlay;" : ""), { module, exports: module.exports, require: (name) => name in replacements ? replacements[name] : require(name), URL, Buffer, AbortController, console, crypto: globalThis.crypto, process: { env: {} }, ...globals }, { filename: relative });
  return module.exports;
}
const productId = "151ca947-94df-4a7f-827a-9b970a4c42d5";
const addressId = "e2c91410-5a26-466c-81f8-05660190be97";
const userId = "f9ef9ac7-3a9c-43a2-b7e7-5f183b0177da";
const plain = (value) => JSON.parse(JSON.stringify(value));
const lines = [{ product_id: productId, quantity: 2 }];
const quote = (now = Date.now()) => ({ success: true, items: [{ product_id: productId, name: "School bag", product_name: "School bag", unit_price: 5, total_price: 10, quantity: 2, image_url: null }], product_subtotal: 10, delivery_fee: 12, charge_total: 22, currency: "SLE", shipping_address: { id: addressId, address: "1 School Road", city: "Freetown" }, quote_token: "server-signed-quote.test", quote_expires_at: new Date(now + 600000).toISOString() });
const helpers = load("src/lib/checkout-quote.ts");

test("verified quote provides product subtotal, shipping, full charge and selected address", () => {
  const result = helpers.parseCheckoutQuote(quote(), lines, addressId);
  assert.equal(result.product_subtotal, 10);
  assert.equal(result.delivery_fee, 12);
  assert.equal(result.charge_total, 22);
  assert.equal(result.shipping_address.id, addressId);
});
for (const [label, change] of [
  ["missing shipping", { delivery_fee: undefined }], ["missing token", { quote_token: undefined }],
  ["foreign currency", { currency: "USD" }], ["negative fee", { delivery_fee: -1 }],
  ["fractional cent", { charge_total: 22.001 }], ["NaN", { charge_total: NaN }],
  ["infinite", { charge_total: Infinity }], ["unbalanced total", { charge_total: 10 }],
  ["unbalanced products", { product_subtotal: 12, charge_total: 24 }], ["expired", { quote_expires_at: new Date(0).toISOString() }],
  ["missing expiry", { quote_expires_at: undefined }], ["false success", { success: false }],
]) test(`unusable quote rejects ${label}`, () => assert.throws(() => helpers.parseCheckoutQuote({ ...quote(), ...change }, lines, addressId)));
test("quote must match exact cart quantities/products and selected saved address", () => {
  assert.throws(() => helpers.parseCheckoutQuote(quote(), [{ product_id: productId, quantity: 1 }], addressId));
  assert.throws(() => helpers.parseCheckoutQuote(quote(), lines, userId));
  assert.throws(() => helpers.parseCheckoutQuote(quote(), [...lines, ...lines], addressId));
  const result = quote(); result.items[0].total_price = 9;
  assert.throws(() => helpers.parseCheckoutQuote(result, lines, addressId));
});
test("zero shipping is accepted only as a valid explicit server quote, not an omitted default", () => {
  const result = helpers.parseCheckoutQuote({ ...quote(), delivery_fee: 0, charge_total: 10 }, lines, addressId);
  assert.equal(result.delivery_fee, 0);
  assert.throws(() => helpers.parseCheckoutQuote({ ...quote(), delivery_fee: null, charge_total: 10 }, lines, addressId));
});
test("quote context invalidates an old account, session, address, merchant or cart", () => {
  const current = helpers.checkoutQuoteContext(userId, "session-one", "school-store", lines, addressId);
  const confirmed = helpers.parseCheckoutQuote(quote(), lines, addressId);
  assert.equal(helpers.checkoutQuoteReady(confirmed, current, current), true);
  for (const changed of [
    helpers.checkoutQuoteContext(addressId, "session-one", "school-store", lines, addressId),
    helpers.checkoutQuoteContext(userId, "session-two", "school-store", lines, addressId),
    helpers.checkoutQuoteContext(userId, "session-one", "another-store", lines, addressId),
    helpers.checkoutQuoteContext(userId, "session-one", "school-store", [{ ...lines[0], quantity: 1 }], addressId),
    helpers.checkoutQuoteContext(userId, "session-one", "school-store", lines, userId),
  ]) assert.equal(helpers.checkoutQuoteReady(confirmed, current, changed), false);
  assert.equal(helpers.checkoutQuoteReady(confirmed, current, current, Date.parse(confirmed.quote_expires_at)), false);
});
test("PIN keypad has every digit once and permits exactly four through six digits", () => {
  const keys = helpers.randomizedPinKeys(() => 0);
  assert.deepEqual(plain([...keys].sort()), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.notDeepEqual(plain(keys), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const pin of ["1234", "12345", "123456"]) assert.equal(helpers.validTransactionPin(pin), true);
  for (const pin of ["", "123", "1234567", "12a4", " 1234"]) assert.equal(helpers.validTransactionPin(pin), false);
});

function hooks() {
  const slots = [], effects = [];
  let cursor = 0;
  return { reset: () => { cursor = 0; }, commit() { const queued = effects.splice(0); queued.forEach((effect) => effect()); }, react: {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; },
    useRef(value) { const index = cursor++; return slots[index] ||= { current: value }; },
    useMemo(fn) { cursor++; return fn(); },
    useEffect(fn, deps) { const index = cursor++; const previous = slots[index]; if (!previous || deps.some((value, key) => value !== previous.deps[key])) { effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; }); } },
  } };
}
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };
function find(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (predicate(node)) return node;
  for (const child of Array.isArray(node) ? node : [node.props?.children]) { const result = find(child, predicate); if (result) return result; }
  return null;
}
function texts(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return "";
  return (Array.isArray(node) ? node : [node.props?.children]).map(texts).join(" ");
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
function checkoutContext(options = {}) {
  const react = hooks();
  let now = Date.now();
  class ClockDate extends Date { static now() { return now; } }
  const timedHelpers = load("src/lib/checkout-quote.ts", {}, { Date: ClockDate });
  const timers = [], calls = [];
  const session = { user: { id: userId, name: "Customer", phone: "077000000" }, token: "signed-session", loading: false, loginPopup: async () => true };
  const saved = new Map([["cart_school-store", JSON.stringify([{ product_id: productId, name: "Old cart name", price: 1, quantity: 2 }])]]);
  const storage = { getItem: (key) => saved.get(key) ?? null, removeItem: (key) => saved.delete(key), setItem: (key, value) => saved.set(key, value) };
  const fetch = async (url, request = {}) => {
    calls.push({ url, request });
    if (String(url).startsWith("/api/stores")) return new Response(JSON.stringify({ store: { id: "store-id", name: "School Store", delivery_fee: 0, offers_delivery: false } }));
    if (String(url).startsWith("/api/wallet")) return new Response(JSON.stringify({ wallets: [{ id: "wallet", wallet_type: "primary", balance: 100, currency_code: "SLE" }] }));
    if (String(url).startsWith("/api/address")) return new Response(JSON.stringify({ addresses: [{ id: addressId, address_line: "1 School Road", city: "Freetown", is_default: true }] }));
    if (String(url).endsWith("/purchase/quote")) return options.quoteResponse ? options.quoteResponse() : new Response(JSON.stringify(quote(now)));
    if (String(url).endsWith("/purchase")) return options.purchaseResponse ? options.purchaseResponse() : new Response(JSON.stringify({ success: true, order: { id: "order-id", order_number: "ORD-123", charge_total: 22 } }));
    throw new Error(`Unexpected request: ${url}`);
  };
  const page = load("src/app/shop/[merchantSlug]/checkout/page.tsx", {
    react: react.react, "react/jsx-runtime": jsx, "lucide-react": {}, "next/link": { default: "a" }, "next/image": { default: "img" },
    "next/navigation": { useParams: () => ({ merchantSlug: "school-store" }), useRouter: () => ({}) }, "@/hooks/useAuth": { useAuth: () => session }, "@/lib/checkout-quote": timedHelpers,
  }, { fetch, localStorage: storage, sessionStorage: storage, window: { dispatchEvent() {} }, CustomEvent: class {}, Date: ClockDate,
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, clearTimeout() {}, setInterval() {}, clearInterval() {} }, true);
  return { page, calls, timers, session, render() { react.reset(); const view = page.default(); react.commit(); return view; }, advance(time) { now = time; }, now: () => now };
}
async function ready(context) { context.render(); await flush(); context.render(); await flush(); return context.render(); }
test("checkout asks authenticated backend for quote and displays products plus shipping before PIN", async () => {
  const context = checkoutContext();
  const view = await ready(context);
  const call = context.calls.find((entry) => String(entry.url).endsWith("/purchase/quote"));
  assert.equal(call.request.headers.Authorization, "Session signed-session");
  assert.equal(call.request.cache, "no-store");
  assert.deepEqual(JSON.parse(call.request.body), { store_slug: "school-store", items: lines, address_id: addressId, shipping_address_id: addressId });
  assert.match(texts(view), /School bag/);
  assert.match(texts(view), /SLE 10\.00/);
  assert.match(texts(view), /SLE 12\.00/);
  assert.match(texts(view), /SLE 22\.00/);
  assert.match(texts(view), /Confirmed destination:.*1 School Road.*Freetown/);
  const pay = find(view, (node) => node.type === "button" && node.props.type === "submit");
  assert.equal(pay.props.disabled, false);
});
test("quote error or malformed totals blocks payment and PIN", async () => {
  for (const quoteResponse of [() => new Response(JSON.stringify({ error_description: "City not configured" }), { status: 409 }), () => new Response(JSON.stringify({ ...quote(), delivery_fee: undefined }))]) {
    const context = checkoutContext({ quoteResponse });
    const view = await ready(context);
    const pay = find(view, (node) => node.type === "button" && node.props.type === "submit");
    assert.equal(pay.props.disabled, true);
    assert.ok(find(view, (node) => node.props?.role === "alert"));
    await find(view, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
    assert.equal(find(context.render(), (node) => node.type?.name === "PinOverlay"), null);
    assert.equal(context.calls.filter((entry) => String(entry.url).endsWith("/purchase")).length, 0);
  }
});
test("quote still loading never enables payment using stale cart/store estimates", async () => {
  let finish;
  const context = checkoutContext({ quoteResponse: () => new Promise((resolve) => { finish = resolve; }) });
  context.render(); await flush(); context.render();
  const view = context.render();
  assert.equal(find(view, (node) => node.type === "button" && node.props.type === "submit").props.disabled, true);
  assert.match(texts(view), /Confirming product prices and shipping fee/);
  assert.doesNotMatch(texts(view), /Pay SLE 2\.00/);
  finish(new Response(JSON.stringify(quote(context.now()))));
  await flush();
  assert.equal(find(context.render(), (node) => node.type === "button" && node.props.type === "submit").props.disabled, false);
});
test("expired confirmed quote closes PIN and requires review of refreshed totals", async () => {
  const context = checkoutContext();
  let view = await ready(context);
  await find(view, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.ok(find(context.render(), (node) => node.type?.name === "PinOverlay"));
  context.advance(context.now() + 600001);
  context.timers.at(-1).fn();
  view = context.render();
  assert.equal(find(view, (node) => node.type?.name === "PinOverlay"), null);
  assert.equal(find(view, (node) => node.type === "button" && node.props.type === "submit").props.disabled, true);
  assert.match(texts(view), /quote expired/);
});
test("PIN purchase includes quote token and exact saved address once on duplicate submission", async () => {
  let finish;
  const context = checkoutContext({ purchaseResponse: () => new Promise((resolve) => { finish = resolve; }) });
  let view = await ready(context);
  await find(view, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  const pin = find(context.render(), (node) => node.type?.name === "PinOverlay");
  pin.props.onSubmit("123456"); pin.props.onSubmit("123456");
  const calls = context.calls.filter((entry) => String(entry.url).endsWith("/purchase"));
  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].request.body);
  assert.equal(body.quote_token, "server-signed-quote.test");
  assert.equal(body.address_id, addressId);
  assert.equal(body.shipping_address_id, addressId);
  assert.equal(body.pin, "123456");
  assert.equal(body.order_type, "delivery");
  assert.equal(typeof body.idempotency_key, "string");
  assert.equal(body.delivery_fee, undefined);
  finish(new Response(JSON.stringify({ success: true, order: { id: "order-id", order_number: "ORD-123", charge_total: 22 } })));
  await flush();
  assert.match(texts(context.render()), /SLE 22\.00|NLe 22/);
});
test("account switch invalidates prior quote immediately before a new quote returns", async () => {
  const context = checkoutContext();
  await ready(context);
  context.session.token = "new-session";
  const view = context.render();
  assert.equal(find(view, (node) => node.type === "button" && node.props.type === "submit").props.disabled, true);
  assert.equal(find(view, (node) => node.type?.name === "PinOverlay"), null);
});
test("a late quote response for the old session cannot restore its payable total", async () => {
  const pending = [];
  const context = checkoutContext({ quoteResponse: () => new Promise((resolve) => pending.push(resolve)) });
  context.render(); await flush(); context.render();
  context.session.token = "new-session";
  context.render(); await flush();
  const oldQuote = { ...quote(context.now()), delivery_fee: 99, charge_total: 109 };
  pending[0](new Response(JSON.stringify(oldQuote)));
  await flush();
  const view = context.render();
  assert.equal(find(view, (node) => node.type === "button" && node.props.type === "submit").props.disabled, true);
  assert.doesNotMatch(texts(view), /SLE 109\.00/);
});
test("quote mismatch response returns to review without clearing the cart or claiming payment", async () => {
  const context = checkoutContext({ purchaseResponse: () => new Response(JSON.stringify({ error: "CHECKOUT_QUOTE_CHANGED", error_description: "Refresh changed total" }), { status: 409 }) });
  const view = await ready(context);
  await find(view, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  find(context.render(), (node) => node.type?.name === "PinOverlay").props.onSubmit("1234");
  await flush();
  const result = context.render();
  assert.match(texts(result), /Refresh changed total/);
  assert.doesNotMatch(texts(result), /Payment Successful/);
  assert.equal(find(result, (node) => node.type === "button" && node.props.type === "submit").props.disabled, true);
});
test("PIN keypad never auto-submits four digits and can explicitly confirm six", async () => {
  const react = hooks();
  let submitted = [];
  const module = load("src/app/shop/[merchantSlug]/checkout/page.tsx", { react: react.react, "react/jsx-runtime": jsx, "lucide-react": {}, "next/navigation": {}, "next/link": {}, "next/image": {}, "@/hooks/useAuth": {}, "@/lib/checkout-quote": helpers }, {}, true);
  const render = () => { react.reset(); const view = module.PinOverlay({ onSubmit: (pin) => submitted.push(pin), onClose() {}, loading: false, error: null, total: 22, shippingAddress: "School Road" }); react.commit(); return view; };
  render();
  for (const digit of [1, 2, 3, 4, 5, 6]) {
    const view = render();
    find(view, (node) => node.type === "button" && node.props.children === digit).props.onClick();
    assert.equal(submitted.length, 0);
  }
  const view = render();
  const confirm = find(view, (node) => node.type === "button" && Array.isArray(node.props.children) && node.props.children[0] === "Confirm ");
  assert.equal(confirm.props.disabled, false);
  confirm.props.onClick();
  assert.deepEqual(submitted, ["123456"]);
});
test("checkout no longer treats absent store fee as Free shipping", () => {
  const source = fs.readFileSync(path.join(root, "src/app/shop/[merchantSlug]/checkout/page.tsx"), "utf8");
  assert.doesNotMatch(source, /deliveryFee === 0 \? "Free"/);
  assert.match(source, /const MOBILE_MONEY_QUOTE_SUPPORTED = false/);
  assert.match(source, /disabled=\{!MOBILE_MONEY_QUOTE_SUPPORTED \|\| momoPaying\}/);
});
