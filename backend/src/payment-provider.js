const crypto = require('node:crypto');

async function sendRefund({ orderId, amount, currency, items, idempotencyKey, refundId }) {
  const mode = String(process.env.PAYMENT_REFUND_MODE || 'external').trim().toLowerCase();
  if (mode === 'demo') {
    if (process.env.DEMO_PAYMENT_SIMULATOR_ENABLED !== 'true') {
      throw new Error('demo_payment_simulator_not_explicitly_enabled');
    }
    const numericAmount = Number(amount);
    if (!orderId || !idempotencyKey || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error('invalid_demo_refund_request');
    }
    const reference = crypto.createHash('sha256').update(String(idempotencyKey)).digest('hex').slice(0, 20);
    return { id: `DEMO-${reference}`, simulated: true, money_moved: false };
  }
  if (mode !== 'external') throw new Error('unsupported_payment_refund_mode');

  const url = process.env.PAYMENT_REFUND_URL;
  const apiKey = process.env.PAYMENT_API_KEY;
  if (!url || !apiKey) throw new Error('payment_provider_not_configured');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.PAYMENT_TIMEOUT_MS || 8000));
  try {
    const response = await fetch(url, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ order_id: orderId, amount, currency, items, refund_id: refundId })
    });
    if (!response.ok) throw new Error(`payment_provider_http_${response.status}`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}
module.exports = { sendRefund };
