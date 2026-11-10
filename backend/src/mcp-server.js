const readline = require('node:readline');

const base = (process.env.SHOP_API_URL || 'http://127.0.0.1:5000/api/assistant/v1').replace(/\/$/, '');
const apiKey = process.env.SHOP_API_TOKEN;
const tools = [
  { name: 'search_products', description: 'Search products or browse by category and price.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' }, min_price: { type: 'number' }, max_price: { type: 'number' } } } },
  { name: 'get_product', description: 'Get product specifications and description.', inputSchema: { type: 'object', properties: { product_id: { type: 'integer' } }, required: ['product_id'] } },
  { name: 'get_product_price', description: 'Get live price and stock status.', inputSchema: { type: 'object', properties: { product_id: { type: 'integer' } }, required: ['product_id'] } },
  { name: 'find_customer_by_phone', description: 'Find masked customer candidates for a WhatsApp phone number.', inputSchema: { type: 'object', properties: { phone: { type: 'string' } }, required: ['phone'] } },
  { name: 'list_customer_orders', description: 'List a customer’s latest orders; requires the storefront signed customer token.', inputSchema: { type: 'object', properties: { customer_id: { type: 'integer' }, customer_token: { type: 'string' }, limit: { type: 'integer' } }, required: ['customer_id', 'customer_token'] } },
  { name: 'get_order', description: 'Get an owner-scoped order summary; requires the storefront signed customer token.', inputSchema: { type: 'object', properties: { order_id: { type: 'string' }, customer_id: { type: 'integer' }, customer_token: { type: 'string' } }, required: ['order_id', 'customer_id', 'customer_token'] } },
  { name: 'get_order_tracking', description: 'Get shipment status events for an owned order; requires the storefront signed customer token.', inputSchema: { type: 'object', properties: { order_id: { type: 'string' }, customer_id: { type: 'integer' }, customer_token: { type: 'string' } }, required: ['order_id', 'customer_id', 'customer_token'] } },
  { name: 'check_refund_eligibility', description: 'Check return eligibility for selected purchased quantities; requires the storefront signed customer token.', inputSchema: { type: 'object', properties: { order_id: { type: 'string' }, customer_id: { type: 'integer' }, customer_token: { type: 'string' }, items: { type: 'array', items: { type: 'object', properties: { product_id: { type: 'integer' }, quantity: { type: 'integer' } }, required: ['product_id', 'quantity'] } } }, required: ['order_id', 'customer_id', 'customer_token', 'items'] } },
  { name: 'send_refund_otp', description: 'Send a refund verification OTP to the masked email on the owned order.', inputSchema: { type: 'object', properties: { order_id: { type: 'string' }, customer_id: { type: 'integer' }, customer_token: { type: 'string' } }, required: ['order_id', 'customer_id', 'customer_token'] } },
  { name: 'verify_refund_otp', description: 'Verify the order-contact OTP and receive a short-lived refund verification token.', inputSchema: { type: 'object', properties: { order_id: { type: 'string' }, customer_id: { type: 'integer' }, customer_token: { type: 'string' }, code: { type: 'string' } }, required: ['order_id', 'customer_id', 'customer_token', 'code'] } },
  { name: 'create_refund', description: 'Request a verified eligible return or refund. Requests above ₹2,000 are held for staff review. Requires OTP verification and an idempotency key.', inputSchema: { type: 'object', properties: { order_id: { type: 'string' }, customer_id: { type: 'integer' }, items: { type: 'array', items: { type: 'object', properties: { product_id: { type: 'integer' }, quantity: { type: 'integer' } }, required: ['product_id', 'quantity'] } }, reason: { type: 'string' }, verification_token: { type: 'string' }, idempotency_key: { type: 'string' } }, required: ['order_id', 'customer_id', 'items', 'reason', 'verification_token', 'idempotency_key'] } },
  { name: 'get_refund', description: 'Get the current status of an owned refund.', inputSchema: { type: 'object', properties: { refund_id: { type: 'integer' }, customer_id: { type: 'integer' }, customer_token: { type: 'string' } }, required: ['refund_id', 'customer_id', 'customer_token'] } }
];

async function request(path, { method = 'GET', body, idempotency } = {}) {
  if (!apiKey) throw new Error('SHOP_API_TOKEN is not configured');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${base}${path}`, { method, signal: controller.signal, headers: { Authorization: `Bearer ${apiKey}`, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(idempotency ? { 'Idempotency-Key': idempotency } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(`${data.error?.code || 'SHOP_ERROR'}: ${data.error?.message || response.statusText}`);
    return data;
  } finally { clearTimeout(timeout); }
}
function query(args) { return new URLSearchParams(Object.entries(args).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])).toString(); }
async function call(name, a) {
  switch (name) {
    case 'search_products': return request(`/products?${query(a)}`);
    case 'get_product': return request(`/products/${a.product_id}`);
    case 'get_product_price': return request(`/products/${a.product_id}/price`);
    case 'find_customer_by_phone': return request(`/customers?${query({ phone: a.phone })}`);
    case 'list_customer_orders': return request(`/customers/${a.customer_id}/orders?${query({ limit: a.limit, customer_token: a.customer_token })}`);
    case 'get_order': return request(`/orders/${encodeURIComponent(a.order_id)}?${query({ customer_id: a.customer_id, customer_token: a.customer_token })}`);
    case 'get_order_tracking': return request(`/orders/${encodeURIComponent(a.order_id)}/tracking?${query({ customer_id: a.customer_id, customer_token: a.customer_token })}`);
    case 'check_refund_eligibility': return request(`/orders/${encodeURIComponent(a.order_id)}/refund-eligibility?${query({ customer_id: a.customer_id, customer_token: a.customer_token, items: a.items })}`);
    case 'send_refund_otp': return request(`/orders/${encodeURIComponent(a.order_id)}/otp`, { method: 'POST', body: a });
    case 'verify_refund_otp': return request(`/orders/${encodeURIComponent(a.order_id)}/otp/verify`, { method: 'POST', body: a });
    case 'create_refund': return request('/refunds', { method: 'POST', body: a, idempotency: a.idempotency_key });
    case 'get_refund': return request(`/refunds/${a.refund_id}?${query({ customer_id: a.customer_id, customer_token: a.customer_token })}`);
    default: throw new Error('Unknown tool');
  }
}
function reply(id, result, error) {
  process.stdout.write(`${JSON.stringify(error ? { jsonrpc: '2.0', id, error: { code: -32000, message: error.message } } : { jsonrpc: '2.0', id, result })}\n`);
}
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', async line => {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  if (msg.method === 'notifications/initialized') return;
  if (msg.method === 'initialize') return reply(msg.id, { protocolVersion: msg.params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'apexstore-shop', version: '1.0.0' } });
  if (msg.method === 'ping') return reply(msg.id, {});
  if (msg.method === 'tools/list') return reply(msg.id, { tools });
  if (msg.method === 'tools/call') {
    try { const data = await call(msg.params?.name, msg.params?.arguments || {}); return reply(msg.id, { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }); }
    catch (error) { return reply(msg.id, { content: [{ type: 'text', text: error.message }], isError: true }); }
  }
  if (msg.id !== undefined) reply(msg.id, null, new Error(`Unsupported method: ${msg.method}`));
});
