const { db, run, queryOne, queryAll } = require('./database');
const { convertUsdToInr } = require('../currency');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const IMPORTED_CATALOG_PATH = path.join(__dirname, 'computer-catalog.json');

const categories = [
  { name: 'Laptops', slug: 'laptops', description: 'Work, study, and gaming laptops from established computer manufacturers.', icon: 'Laptop', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80' },
  { name: 'PC Components', slug: 'pc-components', description: 'Processors, graphics cards, storage, memory, and PC building hardware.', icon: 'Cpu', image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&q=80' },
  { name: 'Peripherals', slug: 'peripherals', description: 'Computer mice and accessories for productive desktop setups.', icon: 'Mouse', image: 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=800&q=80' }
];

const coupons = [
  { code: 'WELCOME10', discount_percent: 10, min_spend: 20 },
  { code: 'SAVE20', discount_percent: 20, min_spend: 80 },
  { code: 'SUPER30', discount_percent: 30, min_spend: 150 },
  { code: 'FLASH50', discount_percent: 50, min_spend: 300 }
];

const demoAccounts = [
  { name: 'Demo Customer One', email: 'demo.customer1@apexstore.local', password: 'Demo-Account-2026!' },
  { name: 'Demo Customer Two', email: 'demo.customer2@apexstore.local', password: 'Demo-Account-2026!' }
];

function seed() {
  console.log('Replacing the ApexStore product catalog while preserving orders and account data...');

  if (!fs.existsSync(IMPORTED_CATALOG_PATH)) {
    throw new Error('Missing computer-catalog.json. Restore the checked-in computer catalog before seeding.');
  }
  const imported = JSON.parse(fs.readFileSync(IMPORTED_CATALOG_PATH, 'utf8'));
  if (!Array.isArray(imported.products) || imported.products.length < 4) {
    throw new Error('computer-catalog.json must contain at least four products for the demo order seed.');
  }

  db.exec('BEGIN IMMEDIATE');
  try {
  // Seed Categories
  run('DELETE FROM categories');
  const catStmt = db.prepare(`
    INSERT INTO categories (name, slug, description, icon, image)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET slug=excluded.slug, description=excluded.description, icon=excluded.icon, image=excluded.image
  `);
  for (const c of categories) {
    catStmt.run(c.name, c.slug, c.description, c.icon, c.image);
  }
  console.log(`Inserted ${categories.length} categories.`);

  // Seed Coupons
  const coupStmt = db.prepare(`
    INSERT INTO coupons (code, discount_percent, min_spend, is_active)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(code) DO NOTHING
  `);
  for (const cp of coupons) {
    coupStmt.run(cp.code, cp.discount_percent, convertUsdToInr(cp.min_spend));
  }
  console.log(`Inserted ${coupons.length} discount coupons.`);

  // Product IDs are intentionally not reset: old order snapshots must not point at new listings.
  // Orders, accounts, coupons, and refund requests are retained; only catalog rows and reviews are replaced.
  run('DELETE FROM reviews');
  run('DELETE FROM products');

  const importedStmt = db.prepare(`
    INSERT INTO products (
      title, slug, description, category, price, original_price, rating, reviews_count,
      stock, image, images, features, specifications, faqs, source, source_ref,
      brand, badge, tags, is_featured, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const allowedCategories = new Set(categories.map(category => category.name));
  for (const p of imported.products) {
    if (!p.source_ref || !p.title || !p.description || !p.image || !Number.isFinite(Number(p.price))) {
      throw new Error(`Invalid computer catalog product record: ${p.source_ref || p.title || 'unknown'}`);
    }
    if (!allowedCategories.has(p.category)) {
      throw new Error(`Unsupported category '${p.category}' in computer catalog product '${p.source_ref}'.`);
    }
    const category = p.category;
    const specifications = p.specifications || [];
    const faqs = p.faqs || [];
    const slug = `${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${p.source_ref.slice(0, 8)}`;
    const price = p.currency === 'INR' ? Number(p.price) : convertUsdToInr(p.price);
    const originalPrice = p.currency === 'INR' ? Number(p.original_price ?? p.price) : convertUsdToInr(p.original_price ?? p.price);
    importedStmt.run(p.title, slug, p.description, category, price, originalPrice, p.rating || 0, p.reviews_count || 0,
      p.stock, p.image, JSON.stringify(p.images || [p.image]), JSON.stringify(p.features || []),
      JSON.stringify(specifications), JSON.stringify(faqs), p.source, p.source_ref, p.brand || '', '',
      JSON.stringify(p.tags || []), 0, 1);
  }

  seedDemoAccounts();

  const countRow = queryOne('SELECT count(*) as total FROM products');
  db.exec('COMMIT');
  console.log(`Catalog now contains ${countRow.total} manufacturer-referenced computer products with specifications and FAQs.`);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function seedDemoAccounts() {
  const hashPassword = password => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { salt, hash };
  };
  const products = queryAll('SELECT id, title, price, image FROM products WHERE is_active = 1 ORDER BY id LIMIT 6');
  if (products.length < 4) throw new Error('At least four active products are required to seed demo accounts.');

  for (let index = 0; index < demoAccounts.length; index += 1) {
    const account = demoAccounts[index];
    let user = queryOne('SELECT id FROM users WHERE email = ?', [account.email]);
    if (!user) {
      const credentials = hashPassword(account.password);
      run('INSERT INTO users (name, email, password_salt, password_hash, email_verified) VALUES (?, ?, ?, ?, 1)', [
        account.name, account.email, credentials.salt, credentials.hash
      ]);
      user = queryOne('SELECT id FROM users WHERE email = ?', [account.email]);
    }

    const orderId = `DEMO-${index + 1}-20261106`;
    if (queryOne('SELECT id FROM orders WHERE id = ?', [orderId])) continue;
    const first = products[index * 2];
    const second = products[index * 2 + 1];
    const items = [
      { id: first.id, title: first.title, price: first.price, quantity: 1, image: first.image },
      { id: second.id, title: second.title, price: second.price, quantity: 1, image: second.image }
    ];
    const subtotal = Number((first.price + second.price).toFixed(2));
    const shippingFee = subtotal > 999 ? 0 : 49;
    const tax = Number((subtotal * 0.18).toFixed(2));
    const total = Number((subtotal + shippingFee + tax).toFixed(2));
    run(`INSERT INTO orders (
      id, customer_name, customer_email, customer_phone, shipping_address, city, postal_code,
      payment_method, items, subtotal, discount, shipping_fee, tax, total, currency, status,
      delivered_at, user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'INR', 'Delivered', ?, ?, ?)`, [
      orderId, account.name, account.email, '9876543210', `${index + 1} Demo Street, Koramangala`,
      'Bengaluru', '560034', 'Cash on Delivery', JSON.stringify(items), subtotal, shippingFee, tax,
      total, '2026-11-03 10:00:00', user.id, '2026-10-28 10:00:00'
    ]);
    appendDemoOrderHistory(orderId, user.id);
    const returnItem = items[0];
    const returnAmount = Number((returnItem.price * 1.18).toFixed(2));
    run(`INSERT INTO refund_requests (
      order_id, requested_by, items, amount, reason, status, created_at
    ) VALUES (?, ?, ?, ?, ?, 'Requested', ?)`, [
      orderId, user.id, JSON.stringify([{
        product_id: returnItem.id,
        title: returnItem.title,
        quantity: 1,
        unit_price: returnItem.price,
        refund_amount: returnAmount
      }]), returnAmount, 'Demo return request for testing the customer refund workflow.', '2026-11-05 12:00:00'
    ]);
  }
  console.log(`Seeded ${demoAccounts.length} demo accounts with delivered orders and return requests.`);
}

function appendDemoOrderHistory(orderId, userId) {
  const statuses = [
    [null, 'Processing', 'Demo order created'],
    ['Processing', 'Confirmed', 'Demo order confirmed'],
    ['Confirmed', 'Shipped', 'Demo order shipped'],
    ['Shipped', 'Delivered', 'Demo order delivered']
  ];
  for (const [oldStatus, newStatus, note] of statuses) {
    run('INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, note) VALUES (?, ?, ?, ?, ?)', [
      orderId, oldStatus, newStatus, userId, note
    ]);
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
