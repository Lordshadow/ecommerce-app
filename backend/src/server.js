const http = require('node:http');
const crypto = require('node:crypto');
const { queryAll, queryOne, run } = require('./db/database');
const auth = require('./auth');
const assistantApi = require('./assistant-api');
const { sendRefund } = require('./payment-provider');
const { FREE_SHIPPING_THRESHOLD_INR, STANDARD_SHIPPING_INR, EXPRESS_SHIPPING_INR, GST_RATE } = require('./currency');
const { isReturnWindowOpen, isNonReturnableItem } = require('./refund-policy');

const PORT = process.env.PORT || 5000;
const demoRefunds = new Map();

const orderTransitions = {
  Processing: ['Confirmed', 'Rejected'],
  Confirmed: ['Preparing', 'Cancelled'],
  Preparing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Rejected: [],
  Cancelled: []
};

function isAdmin(user) {
  if (!user) return false;
  const allowed = (process.env.ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(user.email.toLowerCase());
}

function appendOrderStatus(orderId, oldStatus, newStatus, actorId, note = '') {
  run('INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, note) VALUES (?, ?, ?, ?, ?)', [
    orderId, oldStatus || null, newStatus, actorId || null, note
  ]);
}

if (process.env.NODE_ENV === 'production' && !process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET must be set before starting the production API.');
}
if (process.env.NODE_ENV === 'production' && !process.env.CUSTOMER_TOKEN_PRIVATE_KEY) {
  throw new Error('CUSTOMER_TOKEN_PRIVATE_KEY must be set before starting the production API.');
}

// Helper to send JSON responses
function sendJSON(res, statusCode, data) {
  const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Parse request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function syncStoreRefundToAssistant({ orderId, refundId, status, amount, note }) {
  const url = process.env.NOVARETAIL_REFUND_SYNC_URL;
  const secret = process.env.NOVARETAIL_REFUND_SYNC_SECRET;
  if (!url || !secret) return { synced: false, warning: 'assistant_sync_not_configured' };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ order_id: orderId, store_refund_id: String(refundId), status, amount, note }),
      signal: AbortSignal.timeout(Number(process.env.REFUND_SYNC_TIMEOUT_MS || 5000))
    });
    if (!response.ok) return { synced: false, warning: `assistant_sync_http_${response.status}` };
    return { synced: true };
  } catch {
    return { synced: false, warning: 'assistant_sync_unavailable' };
  }
}

async function handleAssistantRefundReview(req, res, pathname) {
  if (pathname !== '/api/integrations/refunds/review') return false;
  const secret = process.env.REFUND_SYNC_SECRET || '';
  const supplied = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!secret || !safeEqual(supplied, secret)) {
    sendJSON(res, 401, { success: false, error: 'Invalid integration credential.' });
    return true;
  }
  if (req.method !== 'POST') {
    sendJSON(res, 405, { success: false, error: 'Use POST for refund review.' });
    return true;
  }
  let body;
  try { body = await parseBody(req); } catch {
    sendJSON(res, 400, { success: false, error: 'Request body must be valid JSON.' });
    return true;
  }
  const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
  const decision = body.decision;
  const sourceRefundId = typeof body.source_refund_id === 'string' ? body.source_refund_id.slice(0, 100) : '';
  if (!orderId || !['Approved', 'Rejected'].includes(decision) || !sourceRefundId) {
    sendJSON(res, 400, { success: false, error: 'Provide an order ID, source refund ID, and Approved or Rejected decision.' });
    return true;
  }
  const candidates = queryAll("SELECT * FROM refund_requests WHERE order_id = ? AND (status IN ('Requested', 'Approved') OR (status = 'Processed' AND admin_note LIKE ?)) ORDER BY created_at DESC", [orderId, `%${sourceRefundId}%`]);
  if (candidates.length !== 1) {
    sendJSON(res, 409, { success: false, error: candidates.length ? 'More than one store refund is open for this order; review it in the store admin panel.' : 'No open store refund exists for this order.' });
    return true;
  }
  const refund = candidates[0];
  const order = queryOne('SELECT id, currency, status, total, shipping_fee FROM orders WHERE id = ?', [orderId]);
  if (!order) {
    sendJSON(res, 404, { success: false, error: 'Store order not found.' });
    return true;
  }
  if (refund.status === 'Processed') {
    return sendJSON(res, 200, { success: true, refund_id: refund.id, status: 'Processed', amount: Number(refund.amount), replayed: true, test_mode: true, money_moved: false });
  }
  if (decision === 'Rejected') {
    run("UPDATE refund_requests SET status = 'Rejected', admin_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('Requested', 'Approved')", [`Rejected in AI dashboard (${sourceRefundId}). ${String(body.note || '').slice(0, 700)}`, refund.id]);
    return sendJSON(res, 200, { success: true, refund_id: refund.id, status: 'Rejected', amount: Number(refund.amount) });
  }
  try {
    const providerResult = await sendRefund({ orderId, amount: Number(refund.amount), currency: order.currency || 'INR', items: JSON.parse(refund.items || '[]'), idempotencyKey: `store-refund-${refund.id}`, refundId: refund.id });
    run("UPDATE refund_requests SET status = 'Processed', admin_note = ?, reviewed_at = CURRENT_TIMESTAMP, processed_at = CURRENT_TIMESTAMP, processor_ref = ? WHERE id = ? AND status IN ('Requested', 'Approved')", [`Approved and processed from AI dashboard (${sourceRefundId}). ${String(body.note || '').slice(0, 500)}`, String(providerResult.id || providerResult.refund_id || ''), refund.id]);
    const issued = queryOne("SELECT COALESCE(SUM(amount), 0) AS amount FROM refund_requests WHERE order_id = ? AND status = 'Processed'", [orderId]);
    const nextStatus = issued.amount >= Math.max(0, Number(order.total) - Number(order.shipping_fee || 0)) - 0.01 ? 'Refunded' : 'Partially Refunded';
    run('UPDATE orders SET status = ? WHERE id = ?', [nextStatus, orderId]);
    appendOrderStatus(orderId, order.status, nextStatus, null, `Refund ${refund.id} processed from AI dashboard.`);
    return sendJSON(res, 200, { success: true, refund_id: refund.id, status: 'Processed', amount: Number(refund.amount), provider_ref: String(providerResult.id || providerResult.refund_id || ''), test_mode: providerResult.test_mode === true, money_moved: providerResult.money_moved === true });
  } catch {
    sendJSON(res, 503, { success: false, error: 'Refund provider is unavailable; no status was changed.', code: 'TEMPORARILY_UNAVAILABLE' });
    return true;
  }
}

async function handleDemoRefund(req, res, pathname) {
  if (pathname !== '/api/test/payment-refunds') return false;
  // The demo issuer is intentionally unavailable in production, even if misconfigured.
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_TEST_REFUND_ENDPOINT !== 'true') {
    sendJSON(res, 404, { success: false, error: 'Not found.' });
    return true;
  }
  if (req.method !== 'POST') {
    sendJSON(res, 405, { success: false, error: 'Use POST for test refunds.' });
    return true;
  }
  const configuredKey = process.env.PAYMENT_API_KEY || '';
  const suppliedKey = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!configuredKey || !suppliedKey || !safeEqual(suppliedKey, configuredKey)) {
    sendJSON(res, 401, { success: false, error: 'Invalid test provider credential.' });
    return true;
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    sendJSON(res, 400, { success: false, error: 'Request body must be valid JSON.' });
    return true;
  }
  const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
  const valid = body && typeof body.order_id === 'string' && body.order_id.length > 0 && body.order_id.length <= 100 &&
    Number.isFinite(Number(body.amount)) && Number(body.amount) > 0 && /^[A-Z]{3}$/.test(body.currency || '') &&
    Array.isArray(body.items) && body.items.length > 0 && body.items.length <= 50 &&
    Number.isInteger(Number(body.refund_id)) && Number(body.refund_id) > 0 && idempotencyKey.length >= 8 && idempotencyKey.length <= 200;
  if (!valid) {
    sendJSON(res, 400, { success: false, error: 'Provide a valid refund payload and Idempotency-Key header.' });
    return true;
  }

  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({
    order_id: body.order_id, amount: Number(body.amount), currency: body.currency, items: body.items, refund_id: Number(body.refund_id)
  })).digest('hex');
  const previous = demoRefunds.get(idempotencyKey);
  if (previous && previous.fingerprint !== fingerprint) {
    sendJSON(res, 409, { success: false, error: 'Idempotency key was already used with a different refund payload.' });
    return true;
  }
  const record = previous || {
    fingerprint,
    id: `test_refund_${crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 20)}`
  };
  if (!previous) {
    demoRefunds.set(idempotencyKey, record);
    if (demoRefunds.size > 5000) demoRefunds.delete(demoRefunds.keys().next().value);
  }
  sendJSON(res, previous ? 200 : 201, { id: record.id, status: 'succeeded', test_mode: true, money_moved: false });
  return true;
}

const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const query = Object.fromEntries(parsedUrl.searchParams.entries());

  try {
    const demoRefundHandled = await handleDemoRefund(req, res, pathname);
    if (demoRefundHandled) return;

    const assistantRefundHandled = await handleAssistantRefundReview(req, res, pathname);
    if (assistantRefundHandled) return;

    const assistantHandled = await assistantApi.handle(req, res, pathname, parsedUrl.searchParams, parseBody);
    if (assistantHandled !== false) return;

    // 1. Health check & Root API info
    if (pathname === '/' || pathname === '/api') {
      return sendJSON(res, 200, {
        name: 'ApexStore eCommerce REST API',
        version: '1.0.0',
        status: 'online',
        endpoints: [
          'POST /api/auth/register, /api/auth/verify-email, /api/auth/login, /api/auth/request-password-reset, /api/auth/reset-password, /api/auth/logout',
          'GET /api/auth/me, /api/account/orders',
          'GET /api/admin/orders, /api/admin/refunds (allowlisted staff only)',
          'PATCH /api/admin/orders/:id/status, PATCH /api/admin/refunds/:id/review, POST /api/admin/refunds/:id/process',
          'POST /api/account/orders/:id/refunds',
          'PATCH /api/account/profile',
          'GET /api/products (supports search, category, minPrice, maxPrice, rating, sort, page, limit)',
          'GET /api/products/:id (details, reviews, related products)',
          'GET /api/categories (list categories with product counts)',
          'GET /api/coupons/validate?code=CODE (validate promo code)',
          'POST /api/orders (place order, stock validation, checkout)',
          'GET /api/orders/:id (track order status and timeline)',
          'POST /api/reviews (submit customer product review)',
          'GET /api/stats (metrics: total revenue, order count, total products)'
        ]
      });
    }

    // 1a. Staff order and refund workflows. Access is granted only to configured staff emails.
    if (pathname.startsWith('/api/admin/')) {
      const currentUser = auth.getCurrentUser(req);
      if (!currentUser) return sendJSON(res, 401, { success: false, error: 'Sign in with an authorized staff account.' });
      if (!isAdmin(currentUser)) return sendJSON(res, 403, { success: false, error: 'You do not have permission to access order management.' });

      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await parseBody(req) : {};
      if (req.method !== 'GET') {
        const requestOrigin = req.headers.origin;
        const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
        if (requestOrigin && requestOrigin !== allowedOrigin) return sendJSON(res, 403, { success: false, error: 'Request origin is not allowed.' });
      }

      if (req.method === 'GET' && pathname === '/api/admin/orders') {
        const orders = queryAll('SELECT * FROM orders ORDER BY created_at DESC LIMIT 300');
        return sendJSON(res, 200, { success: true, orders: orders.map(order => ({
          ...order,
          items: JSON.parse(order.items || '[]'),
          history: queryAll('SELECT old_status, new_status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY id ASC', [order.id]),
          refunds: queryAll('SELECT id, amount, status FROM refund_requests WHERE order_id = ? ORDER BY created_at DESC', [order.id])
        })) });
      }

      if (req.method === 'GET' && pathname === '/api/admin/refunds') {
        const refunds = queryAll(`
          SELECT r.*, o.customer_name, o.customer_email, o.currency, o.status AS order_status,
                 u.name AS requester_name
          FROM refund_requests r
          JOIN orders o ON o.id = r.order_id
          LEFT JOIN users u ON u.id = r.requested_by
          ORDER BY CASE r.status WHEN 'Requested' THEN 0 WHEN 'Approved' THEN 1 ELSE 2 END, r.created_at ASC
          LIMIT 300
        `);
        return sendJSON(res, 200, { success: true, refunds: refunds.map(refund => ({
          ...refund,
          items: JSON.parse(refund.items || '[]')
        })) });
      }

      const statusMatch = pathname.match(/^\/api\/admin\/orders\/([A-Za-z0-9-]+)\/status$/);
      if (req.method === 'PATCH' && statusMatch) {
        const order = queryOne('SELECT id, status, items FROM orders WHERE id = ?', [statusMatch[1]]);
        if (!order) return sendJSON(res, 404, { success: false, error: 'Order not found.' });
        const nextStatus = typeof body.status === 'string' ? body.status : '';
        if (!(orderTransitions[order.status] || []).includes(nextStatus)) {
          return sendJSON(res, 409, { success: false, error: `Cannot change an order from ${order.status} to ${nextStatus || 'that status'}.` });
        }
        const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
        run('UPDATE orders SET status = ?, delivered_at = CASE WHEN ? = \'Delivered\' THEN CURRENT_TIMESTAMP ELSE delivered_at END WHERE id = ?', [nextStatus, nextStatus, order.id]);
        appendOrderStatus(order.id, order.status, nextStatus, currentUser.id, note);
        if (nextStatus === 'Rejected' || (nextStatus === 'Cancelled' && ['Confirmed', 'Preparing'].includes(order.status))) {
          for (const item of JSON.parse(order.items || '[]')) run('UPDATE products SET stock = stock + ? WHERE id = ?', [Number(item.quantity) || 0, Number(item.id)]);
        }
        return sendJSON(res, 200, { success: true, order_id: order.id, old_status: order.status, status: nextStatus });
      }

      const reviewMatch = pathname.match(/^\/api\/admin\/refunds\/(\d+)\/review$/);
      if (req.method === 'PATCH' && reviewMatch) {
        const refund = queryOne('SELECT * FROM refund_requests WHERE id = ?', [Number(reviewMatch[1])]);
        if (!refund) return sendJSON(res, 404, { success: false, error: 'Refund request not found.' });
        if (refund.status !== 'Requested') return sendJSON(res, 409, { success: false, error: 'Only requested refunds can be approved or rejected.' });
        if (!['Approved', 'Rejected'].includes(body.status)) return sendJSON(res, 400, { success: false, error: 'Choose Approved or Rejected.' });
        const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
        if (body.status === 'Rejected' && note.length < 5) return sendJSON(res, 400, { success: false, error: 'Provide a short reason when rejecting a refund.' });
        if (body.status === 'Approved') {
          const order = queryOne('SELECT id, currency FROM orders WHERE id = ?', [refund.order_id]);
          try {
            const providerResult = await sendRefund({ orderId: order.id, amount: Number(refund.amount), currency: order.currency || 'USD', items: JSON.parse(refund.items || '[]'), idempotencyKey: `staff-refund-${refund.id}`, refundId: refund.id });
            run("UPDATE refund_requests SET status = 'Processed', admin_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, processed_at = CURRENT_TIMESTAMP, processor_ref = ? WHERE id = ?", [note, currentUser.id, String(providerResult.id || providerResult.refund_id || ''), refund.id]);
            const orderState = queryOne('SELECT status, total, shipping_fee FROM orders WHERE id = ?', [order.id]);
            const issued = queryOne("SELECT COALESCE(SUM(amount), 0) AS amount FROM refund_requests WHERE order_id = ? AND status = 'Processed'", [order.id]);
            const refundStatus = issued.amount >= Math.max(0, Number(orderState.total) - Number(orderState.shipping_fee || 0)) - 0.01 ? 'Refunded' : 'Partially Refunded';
            run('UPDATE orders SET status = ? WHERE id = ?', [refundStatus, order.id]);
            appendOrderStatus(order.id, orderState.status, refundStatus, currentUser.id, `Refund ${refund.id} issued by payment provider.`);
          } catch (error) {
            return sendJSON(res, 503, { success: false, error: 'Refund provider is temporarily unavailable.', code: 'TEMPORARILY_UNAVAILABLE' });
          }
        } else {
          run('UPDATE refund_requests SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?', [body.status, note, currentUser.id, refund.id]);
        }
        const sync = await syncStoreRefundToAssistant({ orderId: refund.order_id, refundId: refund.id, status: body.status === 'Approved' ? 'Processed' : 'Rejected', amount: Number(refund.amount), note });
        return sendJSON(res, 200, { success: true, refund_id: refund.id, status: body.status === 'Approved' ? 'Processed' : 'Rejected', ...(sync.synced ? { assistant_synced: true } : { assistant_sync_warning: sync.warning }) });
      }

      const processMatch = pathname.match(/^\/api\/admin\/refunds\/(\d+)\/process$/);
      if (req.method === 'POST' && processMatch) {
        const refund = queryOne('SELECT * FROM refund_requests WHERE id = ?', [Number(processMatch[1])]);
        if (!refund) return sendJSON(res, 404, { success: false, error: 'Refund request not found.' });
        if (refund.status !== 'Approved') return sendJSON(res, 409, { success: false, error: 'Approve the refund before marking it processed.' });
        run('UPDATE refund_requests SET status = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?', ['Processed', refund.id]);
        const order = queryOne('SELECT id, status, total, shipping_fee FROM orders WHERE id = ?', [refund.order_id]);
        const refundTotals = queryOne("SELECT COALESCE(SUM(amount), 0) AS amount FROM refund_requests WHERE order_id = ? AND status = 'Processed'", [order.id]);
        const refundableTotal = Math.max(0, Number(order.total) - Number(order.shipping_fee || 0));
        if (refundTotals.amount > 0) {
          const nextStatus = refundTotals.amount >= refundableTotal - 0.01 ? 'Refunded' : 'Partially Refunded';
          run('UPDATE orders SET status = ? WHERE id = ?', [nextStatus, order.id]);
          appendOrderStatus(order.id, order.status, nextStatus, currentUser.id, `Refund ${refund.id} marked processed. Verify the refund was sent through the payment provider.`);
        }
        const sync = await syncStoreRefundToAssistant({ orderId: refund.order_id, refundId: refund.id, status: 'Processed', amount: Number(refund.amount), note: refund.admin_note || '' });
        return sendJSON(res, 200, { success: true, refund_id: refund.id, status: 'Processed', order_status: refundTotals.amount >= refundableTotal - 0.01 ? 'Refunded' : 'Partially Refunded', ...(sync.synced ? { assistant_synced: true } : { assistant_sync_warning: sync.warning }) });
      }

      return sendJSON(res, 404, { success: false, error: `Endpoint ${req.method} ${pathname} not found.` });
    }

    // 1b. Customer authentication and account endpoints.
    if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/account/')) {
      const email = auth.emailValue;
      const currentUser = auth.getCurrentUser(req);
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await parseBody(req) : {};
      const remoteKey = auth.ipFor(req);

      if (req.method !== 'GET') {
        const requestOrigin = req.headers.origin;
        const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
        if (requestOrigin && requestOrigin !== allowedOrigin) {
          return sendJSON(res, 403, { success: false, error: 'Request origin is not allowed.' });
        }
      }

      if (req.method === 'POST' && pathname === '/api/auth/register') {
        if (!auth.checkRateLimit(`register:${remoteKey}`, 8, 15 * 60_000)) return sendJSON(res, 429, { success: false, error: 'Too many requests. Try again later.' });
        const normalizedEmail = email(body.email);
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
        const password = typeof body.password === 'string' ? body.password : '';
        if (!name || !auth.validEmail(normalizedEmail) || password.length < 10 || password.length > 128) {
          return sendJSON(res, 400, { success: false, error: 'Enter your name, a valid email, and a password with at least 10 characters.' });
        }
        const existing = queryOne('SELECT id, email_verified FROM users WHERE email = ?', [normalizedEmail]);
        if (existing && existing.email_verified) return sendJSON(res, 409, { success: false, error: 'An account already uses this email. Sign in or reset its password.' });
        const credentials = await auth.hashPassword(password);
        if (existing) {
          run('UPDATE users SET name = ?, password_salt = ?, password_hash = ? WHERE id = ?', [name, credentials.salt, credentials.hash, existing.id]);
        } else {
          run('INSERT INTO users (name, email, password_salt, password_hash, email_verified) VALUES (?, ?, ?, ?, 0)', [name, normalizedEmail, credentials.salt, credentials.hash]);
        }
        const result = await auth.issueCode(normalizedEmail, 'email_verification');
        if (!result.ok) return sendJSON(res, result.status, { success: false, error: result.error });
        return sendJSON(res, 200, { success: true, message: 'A verification code has been sent to your email.' });
      }

      if (req.method === 'POST' && pathname === '/api/auth/verify-email') {
        if (!auth.checkRateLimit(`verify:${remoteKey}`, 10, 10 * 60_000)) return sendJSON(res, 429, { success: false, error: 'Too many attempts. Try again later.' });
        const normalizedEmail = email(body.email);
        const result = auth.consumeCode(normalizedEmail, 'email_verification', body.code);
        if (!result.ok) return sendJSON(res, 400, { success: false, error: result.error });
        const user = queryOne('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
        if (!user) return sendJSON(res, 400, { success: false, error: 'The code is invalid or expired.' });
        run('UPDATE users SET email_verified = 1 WHERE id = ?', [user.id]);
        auth.createSession(user.id, res);
        return sendJSON(res, 200, { success: true, user: { ...auth.userView({ ...user, email_verified: 1 }) }, customer_token: auth.createCustomerToken(user.id) });
      }

      if (req.method === 'POST' && pathname === '/api/auth/login') {
        if (!auth.checkRateLimit(`login:${remoteKey}`, 10, 15 * 60_000)) return sendJSON(res, 429, { success: false, error: 'Too many sign-in attempts. Try again later.' });
        const normalizedEmail = email(body.email);
        const user = queryOne('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
        if (!user || typeof body.password !== 'string') return sendJSON(res, 401, { success: false, error: 'Email or password is incorrect.' });
        const candidate = await auth.hashPassword(body.password, user.password_salt);
        if (!auth.safeEqual(candidate.hash, user.password_hash)) return sendJSON(res, 401, { success: false, error: 'Email or password is incorrect.' });
        if (!user.email_verified) return sendJSON(res, 403, { success: false, error: 'Verify your email before signing in.' });
        auth.createSession(user.id, res);
        return sendJSON(res, 200, { success: true, user: auth.userView(user), customer_token: auth.createCustomerToken(user.id) });
      }

      if (req.method === 'POST' && pathname === '/api/auth/request-password-reset') {
        if (!auth.checkRateLimit(`reset-request:${remoteKey}`, 6, 15 * 60_000)) return sendJSON(res, 429, { success: false, error: 'Too many requests. Try again later.' });
        const normalizedEmail = email(body.email);
        if (auth.validEmail(normalizedEmail) && queryOne('SELECT id FROM users WHERE email = ?', [normalizedEmail])) {
          await auth.issueCode(normalizedEmail, 'password_reset');
        }
        return sendJSON(res, 200, { success: true, message: 'If an account exists for that email, a reset code has been sent.' });
      }

      if (req.method === 'POST' && pathname === '/api/auth/reset-password') {
        if (!auth.checkRateLimit(`reset:${remoteKey}`, 10, 15 * 60_000)) return sendJSON(res, 429, { success: false, error: 'Too many attempts. Try again later.' });
        const normalizedEmail = email(body.email);
        if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 128) {
          return sendJSON(res, 400, { success: false, error: 'Choose a password with at least 10 characters.' });
        }
        const result = auth.consumeCode(normalizedEmail, 'password_reset', body.code);
        if (!result.ok) return sendJSON(res, 400, { success: false, error: result.error });
        const credentials = await auth.hashPassword(body.password);
        const user = queryOne('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
        if (!user) return sendJSON(res, 400, { success: false, error: 'The code is invalid or expired.' });
        run('UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?', [credentials.salt, credentials.hash, user.id]);
        run('DELETE FROM auth_sessions WHERE user_id = ?', [user.id]);
        auth.clearSessionCookie(res);
        return sendJSON(res, 200, { success: true, message: 'Password updated. Sign in with your new password.' });
      }

      if (req.method === 'GET' && pathname === '/api/auth/me') {
        if (!currentUser) return sendJSON(res, 200, { success: true, user: null });
        return sendJSON(res, 200, { success: true, user: { ...currentUser, is_admin: isAdmin(currentUser) }, customer_token: auth.createCustomerToken(currentUser.id) });
      }

      if (req.method === 'POST' && pathname === '/api/auth/logout') {
        auth.revokeSession(req);
        auth.clearSessionCookie(res);
        return sendJSON(res, 200, { success: true });
      }

      if (pathname === '/api/account/profile' && req.method === 'PATCH') {
        if (!currentUser) return sendJSON(res, 401, { success: false, error: 'Please sign in to view your account.' });
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
        if (!name) return sendJSON(res, 400, { success: false, error: 'Name is required.' });
        run('UPDATE users SET name = ? WHERE id = ?', [name, currentUser.id]);
        return sendJSON(res, 200, { success: true, user: { ...currentUser, name } });
      }

      if (pathname === '/api/account/orders' && req.method === 'GET') {
        if (!currentUser) return sendJSON(res, 401, { success: false, error: 'Please sign in to view your orders.' });
        const orders = queryAll('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [currentUser.id]);
        return sendJSON(res, 200, { success: true, orders: orders.map(order => ({
          ...order,
          items: JSON.parse(order.items || '[]'),
          history: queryAll('SELECT old_status, new_status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY id ASC', [order.id]),
          refunds: queryAll('SELECT id, items, amount, reason, status, admin_note, created_at, reviewed_at, processed_at FROM refund_requests WHERE order_id = ? AND requested_by = ? ORDER BY created_at DESC', [order.id, currentUser.id]).map(refund => ({
            ...refund,
            items: JSON.parse(refund.items || '[]')
          }))
        })) });
      }

      const customerRefundMatch = pathname.match(/^\/api\/account\/orders\/([A-Za-z0-9-]+)\/refunds$/);
      if (req.method === 'POST' && customerRefundMatch) {
        if (!currentUser) return sendJSON(res, 401, { success: false, error: 'Please sign in to request a refund.' });
        if (!auth.checkRateLimit(`refund-request:${currentUser.id}`, 5, 60 * 60_000)) return sendJSON(res, 429, { success: false, error: 'Too many refund requests. Try again later.' });
        const order = queryOne('SELECT * FROM orders WHERE id = ? AND user_id = ?', [customerRefundMatch[1], currentUser.id]);
        if (!order) return sendJSON(res, 404, { success: false, error: 'Order not found.' });
        if (order.status === 'Refunded') return sendJSON(res, 409, { success: false, error: 'This order is already fully refunded.' });
        if (!['Delivered', 'Partially Refunded'].includes(order.status) || !order.delivered_at) return sendJSON(res, 409, { success: false, error: 'Returns can be requested after an order is delivered.' });
        if (!isReturnWindowOpen(order)) return sendJSON(res, 409, { success: false, error: 'The 30-day return window is closed for this order.' });
        const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';
        if (reason.length < 10) return sendJSON(res, 400, { success: false, error: 'Please provide a reason of at least 10 characters.' });
        if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) return sendJSON(res, 400, { success: false, error: 'Select at least one purchased product to return.' });

        const purchasedItems = JSON.parse(order.items || '[]');
        const selected = new Map();
        for (const entry of body.items) {
          const productId = Number(entry.product_id);
          const quantity = Number(entry.quantity);
          if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) return sendJSON(res, 400, { success: false, error: 'Each selected product needs a valid quantity.' });
          selected.set(productId, (selected.get(productId) || 0) + quantity);
        }

        const reserved = new Map();
        const priorRequests = queryAll("SELECT items FROM refund_requests WHERE order_id = ? AND status IN ('Requested', 'Approved', 'Processed')", [order.id]);
        for (const refund of priorRequests) {
          for (const item of JSON.parse(refund.items || '[]')) reserved.set(Number(item.product_id), (reserved.get(Number(item.product_id)) || 0) + Number(item.quantity));
        }

        const subtotal = Number(order.subtotal) || 0;
        const discountRatio = subtotal > 0 ? Math.max(0, (subtotal - Number(order.discount || 0)) / subtotal) : 0;
        const discountedSubtotal = Math.max(0, subtotal - Number(order.discount || 0));
        const taxRate = discountedSubtotal > 0 ? Number(order.tax || 0) / discountedSubtotal : 0;
        let amount = 0;
        const refundItems = [];
        for (const [productId, quantity] of selected.entries()) {
          const purchased = purchasedItems.find(item => Number(item.id) === productId);
          if (!purchased) return sendJSON(res, 400, { success: false, error: 'A selected product is not part of this order.' });
          const product = queryOne('SELECT category FROM products WHERE id = ?', [productId]);
          if (isNonReturnableItem(purchased, product?.category)) return sendJSON(res, 409, { success: false, error: 'This product is not eligible for a return.' });
          const remaining = Number(purchased.quantity) - (reserved.get(productId) || 0);
          if (quantity > remaining) return sendJSON(res, 409, { success: false, error: `Only ${Math.max(0, remaining)} unit(s) of ${purchased.title} remain available for a refund request.` });
          const base = Number(purchased.price) * quantity;
          const discounted = base * discountRatio;
          const itemRefund = Number((discounted + discounted * taxRate).toFixed(2));
          amount += itemRefund;
          refundItems.push({ product_id: productId, title: purchased.title, quantity, unit_price: Number(purchased.price), refund_amount: itemRefund });
        }
        amount = Number(amount.toFixed(2));
        if (amount <= 0) return sendJSON(res, 400, { success: false, error: 'The selected products have no refundable amount.' });
        const result = run('INSERT INTO refund_requests (order_id, requested_by, items, amount, reason) VALUES (?, ?, ?, ?, ?)', [
          order.id, currentUser.id, JSON.stringify(refundItems), amount, reason
        ]);
        return sendJSON(res, 201, { success: true, refund: { id: Number(result.lastInsertRowid), order_id: order.id, items: refundItems, amount, status: 'Requested' } });
      }

      return sendJSON(res, 404, { success: false, error: `Endpoint ${req.method} ${pathname} not found` });
    }

    // 2. GET /api/categories - Categories with live product counts
    if (req.method === 'GET' && pathname === '/api/categories') {
      const categories = queryAll('SELECT * FROM categories ORDER BY name ASC');
      const counts = queryAll('SELECT category, count(*) as count FROM products WHERE is_active = 1 GROUP BY category');
      const countMap = {};
      counts.forEach(c => { countMap[c.category] = c.count; });

      const enriched = categories.map(cat => ({
        ...cat,
        product_count: countMap[cat.name] || 0
      }));

      return sendJSON(res, 200, { success: true, categories: enriched });
    }

    // 3. GET /api/products - Multi-facet filtering, searching, sorting, pagination
    if (req.method === 'GET' && pathname === '/api/products') {
      const search = query.search ? query.search.trim() : '';
      const category = query.category ? query.category.trim() : '';
      const minPrice = query.minPrice ? parseFloat(query.minPrice) : null;
      const maxPrice = query.maxPrice ? parseFloat(query.maxPrice) : null;
      const minRating = query.minRating ? parseFloat(query.minRating) : null;
      const inStockOnly = query.inStock === 'true';
      const featuredOnly = query.featured === 'true';
      const sort = query.sort || 'featured'; // 'price-asc', 'price-desc', 'rating', 'newest', 'featured'
      const page = parseInt(query.page) || 1;
      const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 12));
      const offset = (page - 1) * limit;

      const whereClauses = [];
      const params = [];

      whereClauses.push('is_active = 1');

      if (search) {
        whereClauses.push('(title LIKE ? OR description LIKE ? OR brand LIKE ? OR tags LIKE ?)');
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      if (category && category !== 'All' && category !== 'all') {
        whereClauses.push('category = ?');
        params.push(category);
      }

      if (minPrice !== null && !isNaN(minPrice)) {
        whereClauses.push('price >= ?');
        params.push(minPrice);
      }

      if (maxPrice !== null && !isNaN(maxPrice)) {
        whereClauses.push('price <= ?');
        params.push(maxPrice);
      }

      if (minRating !== null && !isNaN(minRating)) {
        whereClauses.push('rating >= ?');
        params.push(minRating);
      }

      if (inStockOnly) {
        whereClauses.push('stock > 0');
      }

      if (featuredOnly) {
        whereClauses.push('is_featured = 1');
      }

      const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Sorting
      let orderSQL = 'ORDER BY is_featured DESC, rating DESC';
      if (sort === 'price-asc') orderSQL = 'ORDER BY price ASC';
      else if (sort === 'price-desc') orderSQL = 'ORDER BY price DESC';
      else if (sort === 'rating') orderSQL = 'ORDER BY rating DESC, reviews_count DESC';
      else if (sort === 'newest') orderSQL = 'ORDER BY created_at DESC';
      else if (sort === 'title-asc') orderSQL = 'ORDER BY title ASC';

      // Count query
      const countResult = queryOne(`SELECT COUNT(*) as total FROM products ${whereSQL}`, params);
      const total = countResult ? countResult.total : 0;

      // Select query with pagination
      const products = queryAll(`SELECT * FROM products ${whereSQL} ${orderSQL} LIMIT ? OFFSET ?`, [...params, limit, offset]);

      // Parse JSON fields
      const formatted = products.map(p => ({
        ...p,
        images: p.images ? JSON.parse(p.images) : [p.image],
        features: p.features ? JSON.parse(p.features) : [],
        specifications: p.specifications ? JSON.parse(p.specifications) : [],
        faqs: p.faqs ? JSON.parse(p.faqs) : [],
        tags: p.tags ? JSON.parse(p.tags) : []
      }));

      // Price range metadata for frontend slider
      const priceMeta = queryOne(`SELECT MIN(price) as minPrice, MAX(price) as maxPrice FROM products WHERE is_active = 1`);

      return sendJSON(res, 200, {
        success: true,
        currency: 'INR',
        products: formatted,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        },
        meta: {
          minAvailablePrice: priceMeta ? Math.floor(priceMeta.minPrice) : 0,
          maxAvailablePrice: priceMeta ? Math.ceil(priceMeta.maxPrice) : 1000
        }
      });
    }

    // 4. GET /api/products/:id - Single product with reviews and related items
    const productMatch = pathname.match(/^\/api\/products\/(\d+)$/);
    if (req.method === 'GET' && productMatch) {
      const id = parseInt(productMatch[1]);
      const product = queryOne('SELECT * FROM products WHERE id = ? AND is_active = 1', [id]);

      if (!product) {
        return sendJSON(res, 404, { success: false, error: 'Product not found' });
      }

      const reviews = queryAll('SELECT * FROM reviews WHERE product_id = ? ORDER BY id DESC', [id]);
      const related = queryAll('SELECT * FROM products WHERE category = ? AND id != ? AND is_active = 1 LIMIT 4', [product.category, id]);

      return sendJSON(res, 200, {
        success: true,
        product: {
          ...product,
          currency: 'INR',
          images: product.images ? JSON.parse(product.images) : [product.image],
          features: product.features ? JSON.parse(product.features) : [],
          specifications: product.specifications ? JSON.parse(product.specifications) : [],
          faqs: product.faqs ? JSON.parse(product.faqs) : [],
          tags: product.tags ? JSON.parse(product.tags) : []
        },
        reviews,
        related: related.map(p => ({
          ...p,
          images: p.images ? JSON.parse(p.images) : [p.image]
        }))
      });
    }

    // 5. GET /api/coupons/validate?code=...
    if (req.method === 'GET' && pathname === '/api/coupons/validate') {
      const code = (query.code || '').trim().toUpperCase();
      const coupon = queryOne('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [code]);

      if (!coupon) {
        return sendJSON(res, 404, { success: false, error: 'Invalid or expired coupon code' });
      }

      return sendJSON(res, 200, {
        success: true,
        coupon: {
          code: coupon.code,
          discount_percent: coupon.discount_percent,
            min_spend: coupon.min_spend,
            currency: 'INR'
        }
      });
    }

    // 6. POST /api/orders - Checkout & Order Creation
    if (req.method === 'POST' && pathname === '/api/orders') {
      const body = await parseBody(req);
      const currentUser = auth.getCurrentUser(req);
      const {
        customer_name,
        customer_email,
        customer_phone,
        shipping_address,
        city,
        postal_code,
        payment_method = 'Credit Card',
        delivery_method = 'standard',
        items = [],
        coupon_code = ''
      } = body;

      if (!customer_name || !customer_email || !shipping_address || !items || items.length === 0) {
        return sendJSON(res, 400, {
          success: false,
          error: 'Missing required order fields: name, email, shipping address, or items.'
        });
      }

      // Calculate subtotal and verify stock
      let subtotal = 0;
      const verifiedItems = [];

      for (const item of items) {
        const prod = queryOne('SELECT id, title, price, stock, image FROM products WHERE id = ? AND is_active = 1', [item.id]);
        if (!prod) {
          return sendJSON(res, 400, { success: false, error: `Product with ID ${item.id} not found.` });
        }
        if (prod.stock < item.quantity) {
          return sendJSON(res, 400, {
            success: false,
            error: `Insufficient stock for "${prod.title}". Only ${prod.stock} remaining.`
          });
        }
        const itemTotal = prod.price * item.quantity;
        subtotal += itemTotal;
        verifiedItems.push({
          id: prod.id,
          title: prod.title,
          price: prod.price,
          quantity: item.quantity,
          image: prod.image,
          line_total: itemTotal
        });
      }

      // Handle coupon discount
      let discount = 0;
      if (coupon_code) {
        const coupon = queryOne('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [coupon_code.trim().toUpperCase()]);
        if (coupon && subtotal >= coupon.min_spend) {
          discount = (subtotal * coupon.discount_percent) / 100;
        }
      }

      // Indian storefront delivery policy and GST.
      const standardShipping = subtotal > FREE_SHIPPING_THRESHOLD_INR ? 0 : STANDARD_SHIPPING_INR;
      const expressExtra = delivery_method === 'express' ? EXPRESS_SHIPPING_INR : 0;
      const shipping_fee = Number((standardShipping + expressExtra).toFixed(2));
      const tax = (subtotal - discount) * GST_RATE;
      const total = Math.max(0, subtotal - discount + shipping_fee + tax);

      // Generate order ID e.g. ORD-20261102-4821
      const randDigits = Math.floor(1000 + Math.random() * 9000);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const orderId = `ORD-${dateStr}-${randDigits}`;

      // Insert Order into SQLite
      run(`
        INSERT INTO orders (
          id, customer_name, customer_email, customer_phone,
          shipping_address, city, postal_code, payment_method,
          items, subtotal, discount, shipping_fee, tax, total, currency, status, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderId,
        customer_name,
        customer_email,
        customer_phone || '',
        shipping_address,
        city || '',
        postal_code || '',
        payment_method,
        JSON.stringify(verifiedItems),
        parseFloat(subtotal.toFixed(2)),
        parseFloat(discount.toFixed(2)),
        parseFloat(shipping_fee.toFixed(2)),
        parseFloat(tax.toFixed(2)),
        parseFloat(total.toFixed(2)),
        'INR',
        'Processing',
        currentUser ? currentUser.id : null
      ]);
      appendOrderStatus(orderId, null, 'Processing', currentUser ? currentUser.id : null, 'Order placed and awaiting staff review.');

      // Reduce product stock in SQLite
      for (const item of verifiedItems) {
        run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.id]);
      }

      return sendJSON(res, 201, {
        success: true,
        message: 'Order placed successfully!',
        order: {
          id: orderId,
          customer_name,
          customer_email,
          shipping_address,
          city,
          postal_code,
          payment_method,
          items: verifiedItems,
          subtotal: parseFloat(subtotal.toFixed(2)),
          discount: parseFloat(discount.toFixed(2)),
          shipping_fee: parseFloat(shipping_fee.toFixed(2)),
          tax: parseFloat(tax.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
          currency: 'INR',
          status: 'Processing',
          estimated_delivery: '3-5 Business Days',
          created_at: new Date().toISOString()
        }
      });
    }

    // 7. GET /api/orders/:id - Track order status
    const orderMatch = pathname.match(/^\/api\/orders\/([A-Za-z0-9-]+)$/);
    if (req.method === 'GET' && orderMatch) {
      const orderId = orderMatch[1];
      const order = queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);

      if (!order) {
        return sendJSON(res, 404, { success: false, error: 'Order not found' });
      }

      const currentUser = auth.getCurrentUser(req);
      if (order.user_id && (!currentUser || currentUser.id !== order.user_id)) {
        return sendJSON(res, 404, { success: false, error: 'Order not found' });
      }

      return sendJSON(res, 200, {
        success: true,
        order: {
          ...order,
          items: order.items ? JSON.parse(order.items) : [],
          history: queryAll('SELECT old_status, new_status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY id ASC', [order.id]),
          refunds: currentUser && order.user_id === currentUser.id
            ? queryAll('SELECT id, items, amount, status, admin_note, created_at, reviewed_at, processed_at FROM refund_requests WHERE order_id = ? AND requested_by = ? ORDER BY created_at DESC', [order.id, currentUser.id]).map(refund => ({
              ...refund,
              items: JSON.parse(refund.items || '[]')
            }))
            : []
        }
      });
    }

    // 8. POST /api/reviews - Add customer review
    if (req.method === 'POST' && pathname === '/api/reviews') {
      const body = await parseBody(req);
      const { product_id, author, rating, comment } = body;

      if (!product_id || !author || !rating || !comment) {
        return sendJSON(res, 400, { success: false, error: 'All fields (product_id, author, rating, comment) are required.' });
      }

      const today = new Date().toISOString().slice(0, 10);
      run('INSERT INTO reviews (product_id, author, rating, comment, date, verified) VALUES (?, ?, ?, ?, ?, 1)', [
        parseInt(product_id),
        author,
        parseInt(rating),
        comment,
        today
      ]);

      // Recalculate average rating for product
      const stats = queryOne('SELECT COUNT(*) as count, AVG(rating) as avg_rating FROM reviews WHERE product_id = ?', [product_id]);
      if (stats) {
        const roundedAvg = Math.round(stats.avg_rating * 10) / 10;
        run('UPDATE products SET rating = ?, reviews_count = ? WHERE id = ?', [roundedAvg, stats.count, product_id]);
      }

      return sendJSON(res, 201, {
        success: true,
        message: 'Review submitted successfully!',
        newRating: stats ? Math.round(stats.avg_rating * 10) / 10 : rating
      });
    }

    // 9. GET /api/stats - Store dashboard stats
    if (req.method === 'GET' && pathname === '/api/stats') {
      const prodCount = queryOne('SELECT COUNT(*) as count FROM products WHERE is_active = 1');
      const orderStats = queryOne('SELECT COUNT(*) as order_count, SUM(total) as revenue FROM orders');
      const catCount = queryOne('SELECT COUNT(*) as count FROM categories');

      return sendJSON(res, 200, {
        success: true,
        stats: {
          total_products: prodCount ? prodCount.count : 0,
          total_orders: orderStats && orderStats.order_count ? orderStats.order_count : 0,
          total_revenue: orderStats && orderStats.revenue ? parseFloat(orderStats.revenue.toFixed(2)) : 0,
          total_categories: catCount ? catCount.count : 0
        }
      });
    }

    // The legacy chat endpoint deliberately does not query shop data. Live shop operations go through the scoped assistant API and MCP tools.
    if (req.method === 'POST' && pathname === '/api/ai/chat') {
      const body = await parseBody(req);
      if (typeof body.message !== 'string' || !body.message.trim()) {
        return sendJSON(res, 400, { success: false, error: 'Message cannot be empty.' });
      }
      return sendJSON(res, 200, {
        success: true,
        reply: 'For live product search, order details, tracking, and refunds, use the authenticated ApexStore tools. You can also visit /orders or /account to manage your order.',
        actionPills: ['Browse products', 'View my orders', 'Open my account']
      });
    }

    // Fallthrough 404
    return sendJSON(res, 404, { success: false, error: `Endpoint ${req.method} ${pathname} not found` });

  } catch (err) {
    console.error('Server error:', err);
    return sendJSON(res, 500, { success: false, error: 'Internal Server Error' });
  }
});

if (require.main === module) {
  async function start() {
    const demoPassword = process.env.DEMO_ADMIN_PASSWORD;
    if (demoPassword && process.env.NODE_ENV === 'production') {
      throw new Error('DEMO_ADMIN_PASSWORD is only available outside production.');
    }
    if (demoPassword) {
      if (demoPassword.length < 10 || demoPassword.length > 128) {
        throw new Error('DEMO_ADMIN_PASSWORD must be between 10 and 128 characters.');
      }
      const { queryOne, run } = require('./db/database');
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',')
        .map(value => value.trim().toLowerCase()).filter(Boolean);
      for (const email of adminEmails) {
        if (!auth.validEmail(email)) continue;
        const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
        const credentials = await auth.hashPassword(demoPassword);
        if (existing) {
          run('UPDATE users SET password_salt = ?, password_hash = ?, email_verified = 1 WHERE id = ?', [
            credentials.salt, credentials.hash, existing.id
          ]);
        } else {
          run('INSERT INTO users (name, email, password_salt, password_hash, email_verified) VALUES (?, ?, ?, ?, 1)', [
            'ApexStore Demo Admin', email, credentials.salt, credentials.hash
          ]);
        }
      }
      console.log(`Initialized ${adminEmails.length} local demo admin account(s).`);
    }

    server.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`ApexStore Backend REST API running on port ${PORT}`);
      console.log(`SQLite Database: Connected & Initialized`);
      console.log(`API URL: http://localhost:${PORT}/api`);
      console.log(`Products: http://localhost:${PORT}/api/products`);
      console.log(`===============================================`);
    });
  }
  start().catch(error => {
    console.error('Backend startup failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = server;
