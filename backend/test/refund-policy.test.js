const test = require('node:test');
const assert = require('node:assert/strict');
const { RETURN_WINDOW_MS, isReturnWindowOpen, isNonReturnableItem } = require('../src/refund-policy');

test('returns require a delivered order within the 30-day window', () => {
  const now = Date.UTC(2026, 10, 10, 12);
  const order = { status: 'Delivered', delivered_at: new Date(now - RETURN_WINDOW_MS).toISOString() };
  assert.equal(isReturnWindowOpen(order, now), true);
  assert.equal(isReturnWindowOpen({ ...order, delivered_at: new Date(now - RETURN_WINDOW_MS - 1).toISOString() }, now), false);
  assert.equal(isReturnWindowOpen({ ...order, delivered_at: new Date(now + 1).toISOString() }, now), false);
  assert.equal(isReturnWindowOpen({ ...order, status: 'Shipped' }, now), false);
  assert.equal(isReturnWindowOpen({ ...order, status: 'Partially Refunded' }, now), true);
});

test('digital and gift card products cannot be returned', () => {
  assert.equal(isNonReturnableItem({ category: 'digital' }), true);
  assert.equal(isNonReturnableItem({}, 'Gift Cards'), true);
  assert.equal(isNonReturnableItem({ is_digital: true }), true);
  assert.equal(isNonReturnableItem({ category: 'Electronics & Gadgets' }), false);
});
