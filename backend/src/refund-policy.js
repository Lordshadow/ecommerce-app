'use strict';

const RETURN_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function isReturnWindowOpen(order, now = Date.now()) {
  if (!order || !['Delivered', 'Partially Refunded'].includes(order.status) || !order.delivered_at) return false;
  const raw = String(order.delivered_at);
  const normalized = /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(raw)
    ? `${raw.replace(' ', 'T')}Z`
    : raw;
  const deliveredAt = new Date(normalized).getTime();
  const age = now - deliveredAt;
  return Number.isFinite(deliveredAt) && age >= 0 && age <= RETURN_WINDOW_MS;
}

function isNonReturnableItem(item, catalogCategory = '') {
  const category = String(item?.category || catalogCategory || '').trim().toLowerCase();
  return item?.is_digital === true || item?.digital === true ||
    ['digital', 'gift card', 'gift cards', 'gift_card'].includes(category);
}

module.exports = { RETURN_WINDOW_MS, isReturnWindowOpen, isNonReturnableItem };
