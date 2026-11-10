const USD_TO_INR_RATE = 94.83;
const CURRENCY_MIGRATION = 'catalog_prices_inr_v1';
const FREE_SHIPPING_THRESHOLD_INR = 999;
const STANDARD_SHIPPING_INR = 49;
const EXPRESS_SHIPPING_INR = 99;
const GST_RATE = 0.18;

function convertUsdToInr(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Number((amount * USD_TO_INR_RATE).toFixed(2));
}

module.exports = {
  USD_TO_INR_RATE,
  CURRENCY_MIGRATION,
  FREE_SHIPPING_THRESHOLD_INR,
  STANDARD_SHIPPING_INR,
  EXPRESS_SHIPPING_INR,
  GST_RATE,
  convertUsdToInr
};
