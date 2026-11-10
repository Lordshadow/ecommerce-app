export const CURRENCY = 'INR';
export const USD_TO_INR_RATE = 94.83;
export const FREE_SHIPPING_THRESHOLD = 999;
export const STANDARD_SHIPPING_FEE = 49;
export const EXPRESS_SHIPPING_FEE = 99;
export const GST_RATE = 0.18;

export function formatCurrency(value, currency = CURRENCY) {
  const amount = Number(value);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function convertLegacyUsdAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number((amount * USD_TO_INR_RATE).toFixed(2)) : 0;
}
