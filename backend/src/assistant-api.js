const crypto = require('node:crypto');
const { queryAll, queryOne, run } = require('./db/database');
const auth = require('./auth');
const { sendRefund } = require('./payment-provider');
const { isReturnWindowOpen, isNonReturnableItem } = require('./refund-policy');

const READ_SCOPES = new Set(['catalog:read', 'orders:read', 'refunds:read']);
const buckets = new Map();

function json(res, status, code, data = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ success: status < 400, ...(code ? { error: { code, message: messages[code] || code } } : {}), ...data }));
}
const messages = {
  UNAUTHORIZED: 'A valid scoped API credential is required.', FORBIDDEN: 'The credential does not have the required scope.',
  NOT_FOUND: 'The requested resource was not found.', NOT_ELIGIBLE: 'This request does not meet refund eligibility requirements.',
  RATE_LIMITED: 'Too many requests. Try again later.', TEMPORARILY_UNAVAILABLE: 'The service is temporarily unavailable.',
  INVALID_REQUEST: 'The request is invalid.'
};
function limited(key, max, windowMs) {
  const now = Date.now(); const recent = (buckets.get(key) || []).filter(time => time > now - windowMs);
  if (recent.length >= max) return false;
  recent.push(now); buckets.set(key, recent); return true;
}
function apiCredential(req, required) {
  const raw = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!raw) return { error: 'UNAUTHORIZED' };
  let config;
  try { config = JSON.parse(process.env.SHOP_API_KEYS || '{}'); } catch { return { error: 'TEMPORARILY_UNAVAILABLE' }; }
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const matched = Object.entries(config).find(([key]) => crypto.timingSafeEqual(Buffer.from(crypto.createHash('sha256').update(key).digest('hex')), Buffer.from(hash)));
  if (!matched) return { error: 'UNAUTHORIZED' };
  const scopes = new Set(matched[1].scopes || []);
  if (!scopes.has(required)) return { error: 'FORBIDDEN' };
  return { name: matched[1].name || 'assistant', scopes };
}
function queryCustomerId(value) { return /^\d+$/.test(String(value || '')) ? Number(value) : null; }
function ownedOrder(orderId, customerId) {
  return queryOne('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, customerId]);
}
function parseItems(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try { return JSON.parse(value); } catch { return []; }
}
function assistantOrderItems(value) {
  return parseItems(value).map(item => {
    const productId = Number(item.id ?? item.product_id);
    let product = Number.isInteger(productId)
      ? queryOne('SELECT category FROM products WHERE id = ?', [productId])
      : null;
    // Older orders may retain product IDs from a previous catalog import.
    // Fall back only to the exact catalog title and image pair, never to a
    // customer-supplied category or a loose title match.
    if (!product && item.title && item.image) {
      product = queryOne(
        'SELECT category FROM products WHERE title = ? AND image = ? AND is_active = 1 LIMIT 1',
        [item.title, item.image]
      );
    }
    return {
      product_id: item.id ?? item.product_id,
      name: item.title || item.name,
      category: product?.category || item.category || null,
      quantity: item.quantity,
      unit_price: item.price ?? item.unit_price
    };
  });
}
function refundAmount(order, requested) {
  const purchased = parseItems(order.items); const selected = new Map();
  for (const entry of requested) {
    const id = Number(entry.product_id), quantity = Number(entry.quantity);
    if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1) return { error: 'INVALID_REQUEST' };
    selected.set(id, (selected.get(id) || 0) + quantity);
  }
  const reserved = new Map();
  const previous = queryAll("SELECT items FROM refund_requests WHERE order_id = ? AND status IN ('Requested', 'Approved', 'Processed')", [order.id]);
  for (const refund of previous) for (const item of parseItems(refund.items)) reserved.set(Number(item.product_id), (reserved.get(Number(item.product_id)) || 0) + Number(item.quantity));
  const subtotal = Number(order.subtotal) || 0;
  const discountRatio = subtotal > 0 ? Math.max(0, (subtotal - Number(order.discount || 0)) / subtotal) : 0;
  const taxRate = Math.max(0, Number(order.tax || 0)) / Math.max(0.01, subtotal - Number(order.discount || 0));
  let amount = 0; const lines = [];
  for (const [id, quantity] of selected) {
    const line = purchased.find(item => Number(item.id) === id);
    if (!line) return { error: 'NOT_ELIGIBLE', reason: 'item_not_purchased' };
    const product = queryOne('SELECT category FROM products WHERE id = ?', [id]);
    if (isNonReturnableItem(line, product?.category)) return { error: 'NOT_ELIGIBLE', reason: 'item_not_returnable' };
    if (quantity > Number(line.quantity) - (reserved.get(id) || 0)) return { error: 'NOT_ELIGIBLE', reason: 'quantity_already_refunded_or_reserved' };
    const discounted = Number(line.price) * quantity * discountRatio;
    const lineAmount = Number((discounted * (1 + taxRate)).toFixed(2)); amount += lineAmount;
    lines.push({ product_id: id, title: line.title, quantity, unit_price: Number(line.price), refund_amount: lineAmount });
  }
  amount = Number(amount.toFixed(2));
  return amount > 0 ? { amount, lines } : { error: 'NOT_ELIGIBLE', reason: 'zero_refundable_amount' };
}
function eligibility(order, requested) {
  if (!order) return { eligible: false, reason: 'order_not_found' };
  if (!['Delivered', 'Partially Refunded'].includes(order.status) || !order.delivered_at) return { eligible: false, reason: 'order_not_delivered' };
  if (!isReturnWindowOpen(order)) return { eligible: false, reason: 'return_window_expired' };
  const result = refundAmount(order, requested);
  if (result.error) return { eligible: false, reason: result.reason || result.error };
  if (order.currency !== 'INR') return { eligible: false, reason: 'currency_not_supported_for_automatic_refund' , amount: result.amount, currency: order.currency };
  return { eligible: true, reason: 'eligible', amount: result.amount, currency: order.currency, items: result.lines };
}
function verifiedClaims(token, customerId, orderId) {
  const claims = auth.verifyCustomerToken(token);
  return claims && String(claims.sub) === String(customerId) && claims.order_id === orderId && claims.otp_verified === true ? claims : null;
}
function customerClaims(token, customerId) {
  const claims = auth.verifyCustomerToken(token);
  return claims && String(claims.sub) === String(customerId) ? claims : null;
}
async function issueRefund({ order, customerId, requestedItems, key, reason, actor }) {
  const previous = queryOne('SELECT * FROM refund_requests WHERE idempotency_key = ?', [key]);
  if (previous) {
    if (previous.order_id !== order.id) return { error: 'NOT_ELIGIBLE' };
    return { refund: previous, replay: true };
  }
  const check = eligibility(order, requestedItems);
  if (!check.eligible) return { error: 'NOT_ELIGIBLE', reason: check.reason, details: check };
  if (!Array.isArray(requestedItems) || !requestedItems.length) return { error: 'NOT_ELIGIBLE' };
  const requiresReview = check.amount > 2000;
  let inserted;
  try {
    inserted = run("INSERT INTO refund_requests (order_id, requested_by, items, amount, reason, status, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)", [order.id, customerId || null, JSON.stringify(check.items), check.amount, String(reason || actor || 'Customer return request').trim().slice(0, 1000), requiresReview ? 'Requested' : 'Processing', key]);
  } catch (error) {
    const concurrent = queryOne('SELECT * FROM refund_requests WHERE idempotency_key = ?', [key]);
    if (concurrent && concurrent.order_id === order.id) return { refund: concurrent, replay: true };
    throw error;
  }
  const refundId = Number(inserted.lastInsertRowid);
  if (requiresReview) {
    const refund = queryOne('SELECT * FROM refund_requests WHERE id = ?', [refundId]);
    return { refund, replay: false };
  }
  try {
    const result = await sendRefund({ orderId: order.id, amount: check.amount, currency: order.currency, items: check.items, idempotencyKey: key, refundId });
    run("UPDATE refund_requests SET status = 'Processed', processed_at = CURRENT_TIMESTAMP, processor_ref = ? WHERE id = ?", [String(result.id || result.refund_id || ''), refundId]);
    const currentOrder = queryOne('SELECT status, total, shipping_fee FROM orders WHERE id = ?', [order.id]);
    const issued = queryOne("SELECT COALESCE(SUM(amount), 0) AS amount FROM refund_requests WHERE order_id = ? AND status = 'Processed'", [order.id]);
    const nextStatus = issued.amount >= Math.max(0, Number(currentOrder.total) - Number(currentOrder.shipping_fee || 0)) - 0.01 ? 'Refunded' : 'Partially Refunded';
    run('UPDATE orders SET status = ? WHERE id = ?', [nextStatus, order.id]);
    run('INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, note) VALUES (?, ?, ?, NULL, ?)', [order.id, currentOrder.status, nextStatus, `Refund ${refundId} issued by payment provider.`]);
    const refund = queryOne('SELECT * FROM refund_requests WHERE id = ?', [refundId]);
    return { refund, replay: false };
  } catch (error) {
    run("UPDATE refund_requests SET status = 'Failed', admin_note = ? WHERE id = ?", [error.name === 'AbortError' ? 'processor_timeout' : 'processor_unavailable', refundId]);
    return { error: 'TEMPORARILY_UNAVAILABLE' };
  }
}

async function handle(req, res, pathname, params, parseBody) {
  if (pathname === '/api/assistant/v1/.well-known/jwks.json' && req.method === 'GET') return json(res, 200, null, auth.customerJwks());
  const base = '/api/assistant/v1';
  if (!pathname.startsWith(base + '/') && pathname !== base) return false;
  const match = pathname.slice(base.length);
  if (match === '/health' && req.method === 'GET') return json(res, 200, null, { status: 'ok' });
  const method = req.method;
  const whatsappAuth = match.startsWith('/whatsapp-auth/');
  const scope = whatsappAuth ? 'orders:read' : match.startsWith('/catalog/export') || match.startsWith('/products') ? 'catalog:read' : match.startsWith('/customers') ? 'orders:read' : match.includes('/refund-eligibility') ? 'refunds:read' : match.includes('/otp') ? 'refunds:create' : match.startsWith('/orders') ? 'orders:read' : match.startsWith('/refunds') ? (method === 'POST' ? 'refunds:create' : 'refunds:read') : null;
  if (!scope) return json(res, 404, 'NOT_FOUND');
  const credential = apiCredential(req, scope);
  if (credential.error) return json(res, credential.error === 'FORBIDDEN' ? 403 : 401, credential.error);
  const refunding = method === 'POST' && match === '/refunds';
  if (!limited(`${credential.name}:${refunding ? 'refund' : 'read'}`, refunding ? 10 : 120, 60_000)) return json(res, 429, 'RATE_LIMITED');

  if (whatsappAuth && method === 'POST' && match === '/whatsapp-auth/request-code') {
    const body = await parseBody(req);
    const email = auth.emailValue(body.email);
    if (!auth.validEmail(email) || !limited(`${credential.name}:wa-code:${email}`, 3, 60 * 60_000)) {
      return json(res, 200, null, { message: 'If the verified account exists, a code has been sent.' });
    }
    const user = queryOne('SELECT id FROM users WHERE email = ? AND email_verified = 1', [email]);
    if (user) {
      try { await auth.issueCode(email, 'whatsapp_auth'); }
      catch { return json(res, 503, 'TEMPORARILY_UNAVAILABLE'); }
    }
    return json(res, 200, null, { message: 'If the verified account exists, a code has been sent.' });
  }
  if (whatsappAuth && method === 'POST' && match === '/whatsapp-auth/verify-code') {
    const body = await parseBody(req);
    const email = auth.emailValue(body.email);
    if (!auth.validEmail(email) || !auth.consumeCode(email, 'whatsapp_auth', body.code).ok) return json(res, 400, 'UNAUTHORIZED');
    const user = queryOne('SELECT id FROM users WHERE email = ? AND email_verified = 1', [email]);
    if (!user) return json(res, 400, 'UNAUTHORIZED');
    return json(res, 200, null, { customer_id: String(user.id), customer_token: auth.createCustomerToken(user.id) });
  }

  if (method === 'GET' && match === '/catalog/export') {
    const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(params.get('limit') || '100', 10) || 100));
    const total = queryOne('SELECT COUNT(*) AS total FROM products WHERE is_active = 1')?.total || 0;
    const rows = queryAll(
      'SELECT id, title, description, brand, category, specifications, faqs FROM products WHERE is_active = 1 ORDER BY id ASC LIMIT ? OFFSET ?',
      [limit, (page - 1) * limit]
    );
    const products = rows.map(product => {
      let faqs = [];
      let specifications = [];
      try { faqs = product.faqs ? JSON.parse(product.faqs) : []; } catch { faqs = []; }
      try { specifications = product.specifications ? JSON.parse(product.specifications) : []; } catch { specifications = []; }
      return {
        product_id: String(product.id),
        name: product.title,
        description: product.description || '',
        brand: product.brand || 'ApexStore',
        category: product.category || 'General',
        specifications: Array.isArray(specifications) ? specifications : [],
        faqs: Array.isArray(faqs) ? faqs : []
      };
    });
    return json(res, 200, null, {
      products,
      pagination: { total, page, limit, total_pages: Math.ceil(total / limit) }
    });
  }

  if (method === 'GET' && match === '/products') {
    const search = (params.get('query') || '').trim(); const category = params.get('category');
    const min = Number(params.get('min_price')); const max = Number(params.get('max_price'));
    let sql = 'SELECT id AS product_id, title AS name, brand, category, price, original_price AS offer_price, stock > 0 AS in_stock FROM products WHERE is_active = 1'; const args = [];
    if (search) { sql += ' AND title LIKE ?'; args.push(`%${search.slice(0, 100)}%`); }
    if (category) { sql += ' AND category = ?'; args.push(category); }
    if (Number.isFinite(min)) { sql += ' AND price >= ?'; args.push(min); }
    if (Number.isFinite(max)) { sql += ' AND price <= ?'; args.push(max); }
    sql += ' ORDER BY title LIMIT 50'; return json(res, 200, null, { currency: 'INR', products: queryAll(sql, args) });
  }
  let m = match.match(/^\/products\/(\d+)(?:\/(price))?$/);
  if (method === 'GET' && m) {
    const p = queryOne('SELECT * FROM products WHERE id = ? AND is_active = 1', [Number(m[1])]);
    if (!p) return json(res, 404, 'NOT_FOUND');
    if (m[2]) return json(res, 200, null, { product_id: p.id, price: p.price, offer_price: p.original_price, currency: 'INR', in_stock: p.stock > 0 });
    return json(res, 200, null, { product: { product_id: p.id, name: p.title, brand: p.brand, category: p.category, description: p.description, specifications: parseItems(p.specifications), currency: 'INR' } });
  }
  if (method === 'GET' && match === '/customers') {
    const phone = (params.get('phone') || '').replace(/[^\d+]/g, ''); if (phone.length < 7) return json(res, 400, 'INVALID_REQUEST');
    const users = queryAll('SELECT DISTINCT u.id, u.name, o.customer_phone, o.customer_email FROM users u JOIN orders o ON o.user_id = u.id WHERE REPLACE(REPLACE(o.customer_phone, \' \', \'\'), \'-\', \'\') LIKE ? LIMIT 10', [`%${phone.slice(-10)}%`]);
    return json(res, 200, null, { customers: users.map(u => ({ customer_id: u.id, name: u.name, phone: `***${String(u.customer_phone || '').slice(-4)}`, email: String(u.customer_email || '').replace(/^(.).+(@.*)$/, '$1***$2') })) });
  }
  m = match.match(/^\/customers\/(\d+)\/email$/);
  if (method === 'GET' && m) {
    const customerId = queryCustomerId(m[1]);
    const claims = auth.verifyCustomerToken(params.get('customer_token'));
    if (!customerId || !claims || String(claims.sub) !== String(customerId)) return json(res, 404, 'NOT_FOUND');
    const customer = queryOne('SELECT email, email_verified FROM users WHERE id = ?', [customerId]);
    if (!customer || !customer.email || !customer.email_verified) return json(res, 404, 'NOT_FOUND');
    return json(res, 200, null, { email: customer.email });
  }
  m = match.match(/^\/customers\/(\d+)\/orders$/);
  if (method === 'GET' && m) {
    const customerId = queryCustomerId(m[1]); if (!customerId) return json(res, 400, 'INVALID_REQUEST');
    const token = params.get('customer_token');
    if (!customerClaims(token, customerId)) return json(res, 404, 'NOT_FOUND');
    const limit = Math.min(50, Math.max(1, Number(params.get('limit')) || 10));
    const orders = queryAll('SELECT id AS order_id, status, total, currency, items, shipping_address, customer_name, customer_email, created_at, delivered_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [customerId, limit]);
    return json(res, 200, null, { orders: orders.map(o => ({ ...o, items: assistantOrderItems(o.items) })) });
  }
  m = match.match(/^\/orders\/([^/]+)(?:\/(tracking|refund-eligibility))?$/);
  if (m && method === 'GET') {
    const customerId = queryCustomerId(params.get('customer_id')); if (!customerId) return json(res, 400, 'INVALID_REQUEST');
    const token = params.get('customer_token');
    if (!customerClaims(token, customerId)) return json(res, 404, 'NOT_FOUND');
    const order = ownedOrder(decodeURIComponent(m[1]), customerId); if (!order) return json(res, 404, 'NOT_FOUND');
    if (m[2] === 'tracking') return json(res, 200, null, { events: queryAll('SELECT old_status, new_status AS status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY id', [order.id]) });
    if (m[2] === 'refund-eligibility') {
      const items = parseItems(params.get('items')); const result = eligibility(order, items);
      return json(res, 200, null, result);
    }
    const expectedDelivery = order.delivered_at || new Date(new Date(order.created_at).getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    return json(res, 200, null, { order: { order_id: order.id, status: order.status, total: order.total, customer_id: order.user_id, customer_name: order.customer_name, customer_email: order.customer_email, customer_phone: order.customer_phone, shipping_address: order.shipping_address, created_at: order.created_at, delivered_at: order.delivered_at, items: assistantOrderItems(order.items), expected_delivery: expectedDelivery, payment_status: order.status === 'Refunded' ? 'refunded' : 'recorded', currency: order.currency } });
  }
  m = match.match(/^\/orders\/([^/]+)\/otp$/);
  if (m && method === 'POST') {
    const body = await parseBody(req); const customerId = queryCustomerId(body.customer_id);
    const token = auth.verifyCustomerToken(body.customer_token);
    const order = customerId && ownedOrder(decodeURIComponent(m[1]), customerId);
    if (!token || String(token.sub) !== String(customerId) || !order) return json(res, 404, 'NOT_FOUND');
    const purpose = `refund:${order.id}`;
    let result;
    try { result = await auth.issueCode(order.customer_email, purpose); }
    catch { return json(res, 503, 'TEMPORARILY_UNAVAILABLE'); }
    if (!result.ok) return json(res, result.status, result.status === 429 ? 'RATE_LIMITED' : 'TEMPORARILY_UNAVAILABLE');
    return json(res, 200, null, { sent_to: String(order.customer_email).replace(/^(.).+(@.*)$/, '$1***$2') });
  }
  m = match.match(/^\/orders\/([^/]+)\/otp\/verify$/);
  if (m && method === 'POST') {
    const body = await parseBody(req); const customerId = queryCustomerId(body.customer_id); const orderId = decodeURIComponent(m[1]);
    const token = auth.verifyCustomerToken(body.customer_token); const order = customerId && ownedOrder(orderId, customerId);
    if (!token || String(token.sub) !== String(customerId) || !order) return json(res, 404, 'NOT_FOUND');
    const result = auth.consumeCode(order.customer_email, `refund:${order.id}`, body.code);
    if (!result.ok) return json(res, 400, 'UNAUTHORIZED');
    return json(res, 200, null, { verification_token: auth.createCustomerToken(customerId, { order_id: order.id, otp_verified: true }) });
  }
  if (match === '/refunds' && method === 'POST') {
    const body = await parseBody(req); const customerId = queryCustomerId(body.customer_id);
    const order = customerId && ownedOrder(String(body.order_id || ''), customerId);
    if (!order) return json(res, 404, 'NOT_FOUND');
    if (!verifiedClaims(body.verification_token, customerId, order.id)) return json(res, 401, 'UNAUTHORIZED');
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';
    if (reason.length < 10) return json(res, 400, 'INVALID_REQUEST');
    const key = req.headers['idempotency-key'] || body.idempotency_key;
    if (typeof key !== 'string' || key.length < 8 || key.length > 200) return json(res, 400, 'INVALID_REQUEST');
    const result = await issueRefund({ order, customerId, requestedItems: body.items, key, reason, actor: 'assistant' });
    if (result.error) return json(res, result.error === 'NOT_ELIGIBLE' ? 409 : 503, result.error, result.reason ? { reason: result.reason } : {});
    return json(res, result.replay ? 200 : 201, null, { refund: result.refund, replayed: result.replay });
  }
  m = match.match(/^\/refunds\/(\d+)$/);
  if (method === 'GET' && m) {
    const customerId = queryCustomerId(params.get('customer_id'));
    if (!customerClaims(params.get('customer_token'), customerId)) return json(res, 404, 'NOT_FOUND');
    const refund = queryOne('SELECT r.id, r.order_id, r.amount, r.status, r.created_at, r.processed_at FROM refund_requests r JOIN orders o ON o.id = r.order_id WHERE r.id = ? AND o.user_id = ?', [Number(m[1]), customerId]);
    return refund ? json(res, 200, null, { refund }) : json(res, 404, 'NOT_FOUND');
  }
  return json(res, 404, 'NOT_FOUND');
}

module.exports = { handle, issueRefund };
