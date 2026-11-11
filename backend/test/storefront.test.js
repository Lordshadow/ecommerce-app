const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

const deliveredCodes = [];
const mailPath = require.resolve('../src/mail');
require.cache[mailPath] = {
  id: mailPath,
  filename: mailPath,
  loaded: true,
  exports: { sendVerificationCode: async payload => deliveredCodes.push(payload) }
};

const server = require('../src/server');
const { queryOne, run } = require('../src/db/database');
const requestHandler = server.listeners('request')[0];

async function invoke(method, pathname, body, cookie = '', extraHeaders = {}) {
  const payload = body === undefined ? '{}' : JSON.stringify(body);
  const req = Readable.from([payload]);
  req.method = method;
  req.url = pathname;
  req.headers = { origin: 'http://localhost:3000', 'content-type': 'application/json', cookie, ...extraHeaders };
  req.socket = { remoteAddress: '127.0.0.42' };

  const response = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      for (const [name, value] of Object.entries(headers)) this.headers[name.toLowerCase()] = value;
    },
    end(value = '') { this.body = String(value); }
  };
  await requestHandler(req, response);
  return { ...response, json: response.body ? JSON.parse(response.body) : {} };
}

test('catalog, customer authentication, OTP recovery, account orders, and guest tracking', async () => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const email = `codex-qa-${suffix}@example.test`;
  const expiredEmail = `codex-expired-${suffix}@example.test`;
  const oldPassword = 'Testing-Password-9042!';
  const newPassword = 'Updated-Password-9043!';
  const orderIds = [];
  let productId;
  let originalStock;

  try {
    const catalog = await invoke('GET', '/api/products?limit=1');
    assert.equal(catalog.statusCode, 200);
    assert.equal(catalog.json.pagination.total, 12);
    assert.equal(catalog.json.products.length, 1);
    const productResponse = await invoke('GET', `/api/products/${catalog.json.products[0].id}`);
    assert.ok(Array.isArray(productResponse.json.product.specifications));
    assert.ok(Array.isArray(productResponse.json.product.faqs));
    assert.ok(productResponse.json.product.faqs.length > 0);

    const registration = await invoke('POST', '/api/auth/register', { name: 'Codex QA', email, password: oldPassword });
    assert.equal(registration.statusCode, 200);
    assert.equal((await invoke('POST', '/api/auth/register', { name: 'Codex QA', email, password: oldPassword })).statusCode, 429);
    const verifyCode = deliveredCodes.findLast(code => code.email === email && code.purpose === 'email_verification').code;
    assert.match(verifyCode, /^\d{6}$/);
    const verify = await invoke('POST', '/api/auth/verify-email', { email, code: verifyCode });
    assert.equal(verify.statusCode, 200);
    assert.match(verify.headers['set-cookie'], /HttpOnly/);
    assert.match(verify.headers['set-cookie'], /SameSite=Lax/);
    const firstCookie = verify.headers['set-cookie'].split(';')[0];
    assert.equal((await invoke('GET', '/api/auth/me', undefined, firstCookie)).json.user.email, email);
    assert.equal((await invoke('POST', '/api/auth/register', { name: 'Codex QA', email, password: oldPassword })).statusCode, 409);

    const login = await invoke('POST', '/api/auth/login', { email, password: oldPassword });
    assert.equal(login.statusCode, 200);
    let cookie = login.headers['set-cookie'].split(';')[0];

    const profile = await invoke('PATCH', '/api/account/profile', { name: 'Updated QA Name' }, cookie);
    assert.equal(profile.json.user.name, 'Updated QA Name');

    assert.equal((await invoke('POST', '/api/auth/request-password-reset', { email })).statusCode, 200);
    const resetCode = deliveredCodes.findLast(code => code.email === email && code.purpose === 'password_reset').code;
    const invalidResetCode = resetCode === '000000' ? '000001' : '000000';
    assert.equal((await invoke('POST', '/api/auth/reset-password', { email, code: invalidResetCode, password: newPassword })).statusCode, 400);
    const reset = await invoke('POST', '/api/auth/reset-password', { email, code: resetCode, password: newPassword });
    assert.equal(reset.statusCode, 200);
    assert.equal((await invoke('GET', '/api/auth/me', undefined, cookie)).json.user, null);

    const invalidRegistration = await invoke('POST', '/api/auth/register', { name: 'Expired QA', email: expiredEmail, password: oldPassword });
    assert.equal(invalidRegistration.statusCode, 200);
    const expiredCode = deliveredCodes.findLast(code => code.email === expiredEmail && code.purpose === 'email_verification').code;
    run('UPDATE auth_codes SET expires_at = 0 WHERE email = ? AND purpose = ?', [expiredEmail, 'email_verification']);
    assert.equal((await invoke('POST', '/api/auth/verify-email', { email: expiredEmail, code: expiredCode })).statusCode, 400);

    const wrongCodeRegistration = await invoke('POST', '/api/auth/register', { name: 'Wrong Code QA', email: `wrong-${suffix}@example.test`, password: oldPassword });
    assert.equal(wrongCodeRegistration.statusCode, 200);
    const wrongEmail = `wrong-${suffix}@example.test`;
    const wrongCode = deliveredCodes.findLast(code => code.email === wrongEmail && code.purpose === 'email_verification').code;
    const wrong = wrongCode === '000000' ? '000001' : '000000';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal((await invoke('POST', '/api/auth/verify-email', { email: wrongEmail, code: wrong })).statusCode, 400);
    }
    assert.equal((await invoke('POST', '/api/auth/verify-email', { email: wrongEmail, code: wrongCode })).statusCode, 400);

    const relogin = await invoke('POST', '/api/auth/login', { email, password: newPassword });
    assert.equal(relogin.statusCode, 200);
    cookie = relogin.headers['set-cookie'].split(';')[0];
    const userId = relogin.json.user.id;
    run('UPDATE auth_sessions SET expires_at = 0 WHERE user_id = ?', [userId]);
    assert.equal((await invoke('GET', '/api/auth/me', undefined, cookie)).json.user, null);
    const activeLogin = await invoke('POST', '/api/auth/login', { email, password: newPassword });
    assert.equal(activeLogin.statusCode, 200);
    cookie = activeLogin.headers['set-cookie'].split(';')[0];

    const product = queryOne('SELECT id, stock FROM products WHERE is_active = 1 AND stock > 0 LIMIT 1');
    productId = product.id;
    originalStock = product.stock;
    const accountOrder = await invoke('POST', '/api/orders', {
      customer_name: 'Updated QA Name', customer_email: email, shipping_address: '1 Test Street',
      city: 'Test City', postal_code: '00000', items: [{ id: productId, quantity: 1 }]
    }, cookie);
    assert.equal(accountOrder.statusCode, 201);
    orderIds.push(accountOrder.json.order.id);
    assert.equal(queryOne('SELECT user_id FROM orders WHERE id = ?', [accountOrder.json.order.id]).user_id, userId);
    assert.equal((await invoke('GET', '/api/account/orders', undefined, cookie)).json.orders.length, 1);
    assert.equal((await invoke('GET', `/api/orders/${accountOrder.json.order.id}`)).statusCode, 404);
    assert.equal((await invoke('GET', `/api/orders/${accountOrder.json.order.id}`, undefined, cookie)).statusCode, 200);

    const accountOrderId = accountOrder.json.order.id;
    const returnBody = { reason: 'The product is not suitable for my needs.', items: [{ product_id: productId, quantity: 1 }] };
    const prematureReturn = await invoke('POST', `/api/account/orders/${accountOrderId}/refunds`, returnBody, cookie);
    assert.equal(prematureReturn.statusCode, 409);
    run("UPDATE orders SET status = 'Delivered', delivered_at = CURRENT_TIMESTAMP WHERE id = ?", [accountOrderId]);
    const requestedReturn = await invoke('POST', `/api/account/orders/${accountOrderId}/refunds`, returnBody, cookie);
    assert.equal(requestedReturn.statusCode, 201);
    assert.equal(requestedReturn.json.refund.status, 'Requested');
    const accountAfterReturn = await invoke('GET', '/api/account/orders', undefined, cookie);
    assert.equal(accountAfterReturn.json.orders[0].refunds[0].status, 'Requested');
    run("UPDATE orders SET delivered_at = datetime('now', '-31 days') WHERE id = ?", [accountOrderId]);
    const expiredReturn = await invoke('POST', `/api/account/orders/${accountOrderId}/refunds`, returnBody, cookie);
    assert.equal(expiredReturn.statusCode, 409);
    assert.match(expiredReturn.json.error, /30-day return window/i);

    const guestOrder = await invoke('POST', '/api/orders', {
      customer_name: 'Guest QA', customer_email: `guest-${suffix}@example.test`, shipping_address: '2 Test Street',
      city: 'Test City', postal_code: '00000', items: [{ id: productId, quantity: 1 }]
    });
    assert.equal(guestOrder.statusCode, 201);
    orderIds.push(guestOrder.json.order.id);
    assert.equal((await invoke('GET', `/api/orders/${guestOrder.json.order.id}`)).statusCode, 200);

    assert.equal((await invoke('POST', '/api/auth/logout', {}, cookie)).statusCode, 200);
    assert.equal((await invoke('GET', '/api/auth/me', undefined, cookie)).json.user, null);
  } finally {
    for (const orderId of orderIds) run('DELETE FROM orders WHERE id = ?', [orderId]);
    if (productId !== undefined && originalStock !== undefined) run('UPDATE products SET stock = ? WHERE id = ?', [originalStock, productId]);
    const testEmails = [email, expiredEmail, `wrong-${suffix}@example.test`];
    for (const testEmail of testEmails) {
      run('DELETE FROM auth_codes WHERE email = ?', [testEmail]);
      const user = queryOne('SELECT id FROM users WHERE email = ?', [testEmail]);
      if (user) run('DELETE FROM auth_sessions WHERE user_id = ?', [user.id]);
      run('DELETE FROM users WHERE email = ?', [testEmail]);
    }
  }
});

test('assistant API enforces scopes, signed ownership, and refund idempotency', async () => {
  const secret = `assistant-test-${Date.now()}-${Math.random()}`;
  process.env.SHOP_API_KEYS = JSON.stringify({ [secret]: { name: 'assistant-test', scopes: ['catalog:read', 'orders:read', 'refunds:read', 'refunds:create'] } });
  const auth = require('../src/auth');
  const { queryOne, run } = require('../src/db/database');
  const { randomBytes } = require('node:crypto');
  const suffix = randomBytes(6).toString('hex');
  const email = `assistant-${suffix}@example.test`;
  run('INSERT INTO users (name, email, password_salt, password_hash, email_verified) VALUES (?, ?, ?, ?, 1)', ['Assistant test', email, 'salt', 'hash']);
  const customerId = Number(queryOne('SELECT id FROM users WHERE email = ?', [email]).id);
  const product = queryOne('SELECT id, price, title FROM products WHERE is_active = 1 LIMIT 1');
  const orderId = `TEST-${suffix}`;
  const highOrderId = `TEST-HIGH-${suffix}`;
  const expiredOrderId = `TEST-OLD-${suffix}`;
  run(`INSERT INTO orders (id, customer_name, customer_email, customer_phone, shipping_address, city, postal_code, payment_method, items, subtotal, discount, shipping_fee, tax, total, status, user_id, currency, delivered_at)
      VALUES (?, 'Assistant test', ?, '1234567890', 'Test', 'Test', '00000', 'card', ?, ?, 0, 0, 0, ?, 'Delivered', ?, 'INR', CURRENT_TIMESTAMP)`, [orderId, email, JSON.stringify([{ id: product.id, title: product.title, price: 1000, quantity: 1 }]), 1000, 1000, customerId]);
  run(`INSERT INTO orders (id, customer_name, customer_email, customer_phone, shipping_address, city, postal_code, payment_method, items, subtotal, discount, shipping_fee, tax, total, status, user_id, currency, delivered_at)
      VALUES (?, 'Assistant test', ?, '1234567890', 'Test', 'Test', '00000', 'card', ?, 3000, 0, 0, 0, 3000, 'Delivered', ?, 'INR', CURRENT_TIMESTAMP)`, [highOrderId, email, JSON.stringify([{ id: product.id, title: product.title, price: 3000, quantity: 1 }]), customerId]);
  run(`INSERT INTO orders (id, customer_name, customer_email, customer_phone, shipping_address, city, postal_code, payment_method, items, subtotal, discount, shipping_fee, tax, total, status, user_id, currency, delivered_at)
      VALUES (?, 'Assistant test', ?, '1234567890', 'Test', 'Test', '00000', 'card', ?, 1000, 0, 0, 0, 1000, 'Delivered', ?, 'INR', datetime('now', '-31 days'))`, [expiredOrderId, email, JSON.stringify([{ id: product.id, title: product.title, price: 1000, quantity: 1 }]), customerId]);
  const customerToken = auth.createCustomerToken(customerId);
  const verificationToken = auth.createCustomerToken(customerId, { order_id: orderId, otp_verified: true });
  const highVerificationToken = auth.createCustomerToken(customerId, { order_id: highOrderId, otp_verified: true });
  const expiredVerificationToken = auth.createCustomerToken(customerId, { order_id: expiredOrderId, otp_verified: true });
  const priorFetch = global.fetch; let providerCalls = 0;
  process.env.PAYMENT_REFUND_URL = 'https://processor.example/refunds'; process.env.PAYMENT_API_KEY = 'test-key';
  global.fetch = async (_url, options) => { providerCalls += 1; assert.ok(options.headers['Idempotency-Key']); return { ok: true, json: async () => ({ id: 'provider-refund-1' }) }; };
  try {
    const noCredential = await invoke('GET', '/api/assistant/v1/products', undefined);
    assert.equal(noCredential.statusCode, 401);
    assert.equal((await invoke('POST', '/api/assistant/v1/whatsapp-auth/request-code', { email })).statusCode, 401);
    const codeRequested = await invoke('POST', '/api/assistant/v1/whatsapp-auth/request-code', { email }, '', { authorization: `Bearer ${secret}` });
    assert.equal(codeRequested.statusCode, 200);
    const whatsappCode = deliveredCodes.findLast(code => code.email === email && code.purpose === 'whatsapp_auth').code;
    const whatsappIdentity = await invoke('POST', '/api/assistant/v1/whatsapp-auth/verify-code', { email, code: whatsappCode }, '', { authorization: `Bearer ${secret}` });
    assert.equal(whatsappIdentity.statusCode, 200);
    assert.equal(whatsappIdentity.json.customer_id, String(customerId));
    assert.equal(auth.verifyCustomerToken(whatsappIdentity.json.customer_token).sub, String(customerId));
    const wrongWhatsappCode = await invoke('POST', '/api/assistant/v1/whatsapp-auth/verify-code', { email, code: '000000' }, '', { authorization: `Bearer ${secret}` });
    assert.equal(wrongWhatsappCode.statusCode, 400);
    const products = await invoke('GET', '/api/assistant/v1/products?query=test', undefined, '', { authorization: `Bearer ${secret}` });
    assert.equal(products.statusCode, 200);
    const exportFirst = await invoke('GET', '/api/assistant/v1/catalog/export?page=1&limit=2', undefined, '', { authorization: `Bearer ${secret}` });
    assert.equal(exportFirst.statusCode, 200);
    assert.equal(exportFirst.json.pagination.page, 1);
    assert.equal(exportFirst.json.pagination.limit, 2);
    assert.equal(exportFirst.json.products.length, 2);
    assert.ok(exportFirst.json.products[0].product_id);
    assert.ok(exportFirst.json.products[0].name);
    assert.ok(Array.isArray(exportFirst.json.products[0].faqs));
    assert.equal(Object.hasOwn(exportFirst.json.products[0], 'description'), true);
    const exportSecond = await invoke('GET', '/api/assistant/v1/catalog/export?page=2&limit=2', undefined, '', { authorization: `Bearer ${secret}` });
    assert.equal(exportSecond.statusCode, 200);
    assert.notEqual(exportSecond.json.products[0].product_id, exportFirst.json.products[0].product_id);
    const exportUnauthorized = await invoke('GET', '/api/assistant/v1/catalog/export', undefined);
    assert.equal(exportUnauthorized.statusCode, 401);
    const noToken = await invoke('GET', `/api/assistant/v1/orders/${orderId}?customer_id=${customerId}`, undefined, '', { authorization: `Bearer ${secret}` });
    assert.equal(noToken.statusCode, 404);
    const customerEmail = await invoke('GET', `/api/assistant/v1/customers/${customerId}/email?customer_token=${encodeURIComponent(customerToken)}`, undefined, '', { authorization: `Bearer ${secret}` });
    assert.equal(customerEmail.statusCode, 200);
    assert.equal(customerEmail.json.email, email);
    const otherCustomerEmail = await invoke('GET', `/api/assistant/v1/customers/${customerId + 1}/email?customer_token=${encodeURIComponent(customerToken)}`, undefined, '', { authorization: `Bearer ${secret}` });
    assert.equal(otherCustomerEmail.statusCode, 404);
    const owned = await invoke('GET', `/api/assistant/v1/orders/${orderId}?customer_id=${customerId}&customer_token=${encodeURIComponent(customerToken)}`, undefined, '', { authorization: `Bearer ${secret}` });
    assert.equal(owned.statusCode, 200);
    const body = { customer_id: customerId, order_id: orderId, items: [{ product_id: product.id, quantity: 1 }], reason: 'The item did not meet expectations.', verification_token: verificationToken, idempotency_key: `idem-${suffix}` };
    const first = await invoke('POST', '/api/assistant/v1/refunds', body, '', { authorization: `Bearer ${secret}` });
    assert.equal(first.statusCode, 201);
    assert.equal(first.json.refund.status, 'Processed');
    assert.equal(first.json.refund.reason, body.reason);
    const replay = await invoke('POST', '/api/assistant/v1/refunds', body, '', { authorization: `Bearer ${secret}` });
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.json.replayed, true);
    assert.equal(providerCalls, 1);

    const high = await invoke('POST', '/api/assistant/v1/refunds', {
      customer_id: customerId,
      order_id: highOrderId,
      items: [{ product_id: product.id, quantity: 1 }],
      reason: 'The item arrived but costs more than the auto refund limit.',
      verification_token: highVerificationToken,
      idempotency_key: `idem-high-${suffix}`,
    }, '', { authorization: `Bearer ${secret}` });
    assert.equal(high.statusCode, 201);
    assert.equal(high.json.refund.status, 'Requested');
    assert.equal(providerCalls, 1, 'over-limit requests wait for staff and do not call the provider');

    const expired = await invoke('POST', '/api/assistant/v1/refunds', {
      customer_id: customerId,
      order_id: expiredOrderId,
      items: [{ product_id: product.id, quantity: 1 }],
      reason: 'This return is outside the allowed window.',
      verification_token: expiredVerificationToken,
      idempotency_key: `idem-expired-${suffix}`,
    }, '', { authorization: `Bearer ${secret}` });
    assert.equal(expired.statusCode, 409);
    assert.equal(providerCalls, 1);
  } finally {
    global.fetch = priorFetch;
    delete process.env.PAYMENT_REFUND_URL; delete process.env.PAYMENT_API_KEY; delete process.env.SHOP_API_KEYS;
    run('DELETE FROM refund_requests WHERE order_id = ?', [orderId]);
    run('DELETE FROM refund_requests WHERE order_id = ?', [highOrderId]);
    run('DELETE FROM refund_requests WHERE order_id = ?', [expiredOrderId]);
    run('DELETE FROM orders WHERE id = ?', [orderId]);
    run('DELETE FROM orders WHERE id = ?', [highOrderId]);
    run('DELETE FROM orders WHERE id = ?', [expiredOrderId]);
    run('DELETE FROM users WHERE id = ?', [customerId]);
  }
});

test('demo refund provider is gated, authenticated, validated, and idempotent', async () => {
  const previousEnv = {
    nodeEnv: process.env.NODE_ENV,
    enabled: process.env.ENABLE_TEST_REFUND_ENDPOINT,
    apiKey: process.env.PAYMENT_API_KEY
  };
  const apiKey = `demo-key-${Date.now()}-${Math.random()}`;
  const path = '/api/test/payment-refunds';
  const payload = { order_id: 'DEMO-ORDER-1', amount: 1200, currency: 'INR', items: [{ product_id: 7, quantity: 1 }], refund_id: 9 };
  const headers = { authorization: `Bearer ${apiKey}`, 'idempotency-key': `demo-refund-${Date.now()}` };
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.ENABLE_TEST_REFUND_ENDPOINT;
    process.env.PAYMENT_API_KEY = apiKey;
    assert.equal((await invoke('POST', path, payload, '', headers)).statusCode, 404);

    process.env.ENABLE_TEST_REFUND_ENDPOINT = 'true';
    assert.equal((await invoke('POST', path, payload)).statusCode, 401);
    assert.equal((await invoke('POST', path, { ...payload, amount: 0 }, '', headers)).statusCode, 400);
    const created = await invoke('POST', path, payload, '', headers);
    assert.equal(created.statusCode, 201);
    assert.equal(created.json.test_mode, true);
    assert.equal(created.json.money_moved, false);
    const replay = await invoke('POST', path, payload, '', headers);
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.json.id, created.json.id);
    assert.equal((await invoke('POST', path, { ...payload, amount: 1201 }, '', headers)).statusCode, 409);

    process.env.NODE_ENV = 'production';
    assert.equal((await invoke('POST', path, payload, '', headers)).statusCode, 404);
  } finally {
    if (previousEnv.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv.nodeEnv;
    if (previousEnv.enabled === undefined) delete process.env.ENABLE_TEST_REFUND_ENDPOINT; else process.env.ENABLE_TEST_REFUND_ENDPOINT = previousEnv.enabled;
    if (previousEnv.apiKey === undefined) delete process.env.PAYMENT_API_KEY; else process.env.PAYMENT_API_KEY = previousEnv.apiKey;
  }
});
