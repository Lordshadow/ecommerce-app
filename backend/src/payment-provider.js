async function sendRefund({ orderId, amount, currency, items, idempotencyKey, refundId }) {
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
