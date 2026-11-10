const fs = require('node:fs');
const path = require('node:path');

const DATASET = 'DummyJSON Products API';
const DATASET_VERSION = 'v1';
const LICENSE = 'public demo data';
const OUTPUT = path.join(__dirname, 'catalog-source.json');

const categoryMap = {
  beauty: 'Health & Beauty',
  fragrances: 'Health & Beauty',
  'skin-care': 'Health & Beauty',
  groceries: 'Groceries',
  furniture: 'Home & Kitchen',
  'home-decoration': 'Home & Kitchen',
  kitchen: 'Home & Kitchen',
  laptops: 'Computers & Office',
  'mobile-accessories': 'Electronics & Gadgets',
  smartphones: 'Electronics & Gadgets',
  tablets: 'Electronics & Gadgets',
  'mens-shirts': 'Fashion & Apparel',
  'mens-shoes': 'Fashion & Apparel',
  'mens-watches': 'Fashion & Apparel',
  'womens-bags': 'Fashion & Apparel',
  'womens-dresses': 'Fashion & Apparel',
  'womens-jewellery': 'Fashion & Apparel',
  'womens-shoes': 'Fashion & Apparel',
  'womens-watches': 'Fashion & Apparel',
  sunglasses: 'Fashion & Apparel',
  tops: 'Fashion & Apparel',
  automotive: 'Smart Home & Living',
  motorcycle: 'Sports & Outdoors',
  vehicle: 'Sports & Outdoors',
  sports: 'Sports & Outdoors'
};

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function categoryFor(sourceCategory, title, description) {
  const mapped = categoryMap[String(sourceCategory || '').toLowerCase()];
  if (mapped) return mapped;
  const text = `${title} ${description}`.toLowerCase();
  if (/\b(phone|laptop|tablet|charger|camera|watch|electronic)\b/.test(text)) return 'Electronics & Gadgets';
  if (/\b(shirt|shoe|dress|jewellery|jewelry|bag|watch|sunglasses)\b/.test(text)) return 'Fashion & Apparel';
  if (/\b(cream|serum|perfume|mascara|lipstick|skin|beauty|fragrance)\b/.test(text)) return 'Health & Beauty';
  return 'Home & Kitchen';
}

function specificationsFromProduct(product) {
  const dimensions = product.dimensions || {};
  const specs = [
    ['Brand', product.brand],
    ['SKU', product.sku],
    ['Category', product.category],
    ['Weight', product.weight ? `${product.weight} oz` : null],
    ['Dimensions', dimensions.width ? `${dimensions.width} x ${dimensions.height} x ${dimensions.depth} cm` : null],
    ['Warranty', product.warrantyInformation],
    ['Shipping', product.shippingInformation],
    ['Availability', product.availabilityStatus],
    ['Return policy', product.returnPolicy],
    ['Minimum order quantity', product.minimumOrderQuantity]
  ];
  return specs.filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => ({ label, value: cleanText(value) }));
}

function faqsFromProduct(product, specifications) {
  const answerFor = label => specifications.find(spec => spec.label === label)?.value;
  return [
    { question: 'What is included in this listing?', answer: cleanText(product.description) },
    { question: 'What are the product dimensions?', answer: answerFor('Dimensions') || 'Dimensions are not listed.' },
    { question: 'What warranty is provided?', answer: answerFor('Warranty') || 'No warranty information is listed.' },
    { question: 'How does shipping work?', answer: answerFor('Shipping') || 'Shipping information is not listed.' },
    { question: 'What is the return policy?', answer: answerFor('Return policy') || 'Return information is not listed.' }
  ];
}

function toProduct(product) {
  const title = cleanText(product.title);
  const description = cleanText(product.description);
  if (!product.id || !title || !description || !Number.isFinite(Number(product.price))) return null;
  const specifications = specificationsFromProduct(product);
  return {
    source_ref: `dummyjson-${product.id}`,
    source: `${DATASET} ${DATASET_VERSION} (${LICENSE})`,
    title,
    description,
    brand: cleanText(product.brand) || 'Unbranded',
    category: categoryFor(product.category, title, description),
    price: Number(Number(product.price).toFixed(2)),
    original_price: Number((product.price / (1 - (Number(product.discountPercentage) || 0) / 100)).toFixed(2)),
    rating: Number(product.rating) || 0,
    reviews_count: Array.isArray(product.reviews) ? product.reviews.length : 0,
    stock: Number(product.stock) || 0,
    image: product.thumbnail || product.images?.[0],
    images: Array.isArray(product.images) ? product.images : [product.thumbnail],
    features: Array.isArray(product.tags) ? product.tags.map(cleanText).filter(Boolean) : [],
    specifications,
    faqs: faqsFromProduct(product, specifications),
    tags: Array.isArray(product.tags) ? product.tags.map(cleanText).filter(Boolean) : [],
    reviews: Array.isArray(product.reviews) ? product.reviews.map(review => ({
      author: cleanText(review.reviewerName) || 'Verified customer',
      rating: Number(review.rating) || 0,
      comment: cleanText(review.comment),
      date: cleanText(review.date).slice(0, 10)
    })).filter(review => review.comment) : []
  };
}

async function download() {
  const response = await fetch('https://dummyjson.com/products?limit=0', { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Product API request failed (${response.status})`);
  const payload = await response.json();
  const products = (payload.products || []).map(toProduct).filter(Boolean);
  if (!products.length) throw new Error('Product API returned no usable products.');
  fs.writeFileSync(OUTPUT, JSON.stringify({
    dataset: DATASET,
    version: DATASET_VERSION,
    license: LICENSE,
    attribution: 'Product listings and customer reviews fetched from https://dummyjson.com/products.',
    products
  }, null, 2));
  console.log(`Saved ${products.length} products with ${products.reduce((sum, product) => sum + product.reviews.length, 0)} reviews to ${OUTPUT}`);
}

if (require.main === module) {
  download().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { categoryFor, faqsFromProduct, specificationsFromProduct, toProduct };
