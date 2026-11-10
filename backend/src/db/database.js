const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const { USD_TO_INR_RATE, CURRENCY_MIGRATION } = require('../currency');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'ecommerce.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);

// Initialize schema
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      icon TEXT,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      original_price REAL,
      rating REAL DEFAULT 4.5,
      reviews_count INTEGER DEFAULT 0,
      stock INTEGER DEFAULT 10,
      image TEXT NOT NULL,
      images TEXT,       -- JSON array of strings
      features TEXT,     -- JSON array of strings
      specifications TEXT DEFAULT '[]',
      faqs TEXT DEFAULT '[]',
      source TEXT,
      source_ref TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      brand TEXT,
      badge TEXT,        -- e.g. 'Best Seller', 'Sale', 'New Arrival'
      tags TEXT,         -- JSON array of strings
      is_featured INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      date TEXT NOT NULL,
      verified INTEGER DEFAULT 1,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT,
      shipping_address TEXT NOT NULL,
      city TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      items TEXT NOT NULL,   -- JSON array of { id, title, price, quantity, image }
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      shipping_fee REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT DEFAULT 'Processing',  -- 'Processing', 'Confirmed', 'Shipped', 'Delivered'
      delivered_at DATETIME,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      discount_percent REAL NOT NULL,
      min_spend REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by INTEGER,
      note TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS refund_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      requested_by INTEGER,
      items TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Requested',
      admin_note TEXT DEFAULT '',
      reviewed_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      processed_at DATETIME,
      idempotency_key TEXT,
      processor_ref TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
    CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating);
    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
    CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_status_history(order_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_refund_requests_order ON refund_requests(order_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status, created_at);
  `);

  // Convert the existing USD catalog and coupon thresholds once. Order snapshots
  // keep their original currency so historical receipts and refunds stay correct.
  db.exec('CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const currencyMigration = db.prepare('SELECT name FROM app_migrations WHERE name = ?').get(CURRENCY_MIGRATION);
  if (!currencyMigration) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE products SET price = ROUND(price * ?, 2), original_price = CASE WHEN original_price IS NULL THEN NULL ELSE ROUND(original_price * ?, 2) END').run(USD_TO_INR_RATE, USD_TO_INR_RATE);
      db.prepare('UPDATE coupons SET min_spend = ROUND(min_spend * ?, 2)').run(USD_TO_INR_RATE);
      db.prepare('INSERT INTO app_migrations (name) VALUES (?)').run(CURRENCY_MIGRATION);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  // Keep existing SQLite installations usable as new account/catalog fields are added.
  const addColumnIfMissing = (table, column, definition) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some(entry => entry.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };
  addColumnIfMissing('products', 'specifications', "TEXT DEFAULT '[]'");
  addColumnIfMissing('products', 'faqs', "TEXT DEFAULT '[]'");
  addColumnIfMissing('products', 'source', 'TEXT');
  addColumnIfMissing('products', 'source_ref', 'TEXT');
  addColumnIfMissing('products', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfMissing('orders', 'user_id', 'INTEGER');
  addColumnIfMissing('orders', 'currency', "TEXT NOT NULL DEFAULT 'USD'");
  addColumnIfMissing('orders', 'delivered_at', 'DATETIME');
  addColumnIfMissing('refund_requests', 'idempotency_key', 'TEXT');
  addColumnIfMissing('refund_requests', 'processor_ref', 'TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS auth_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL COLLATE NOCASE,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_auth_codes_email_purpose ON auth_codes(email, purpose, created_at);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_idempotency ON refund_requests(idempotency_key) WHERE idempotency_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_products_active_category ON products(is_active, category);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_source_ref_unique ON products(source_ref) WHERE source_ref IS NOT NULL;
  `);

  // Add a visible first status entry for orders that predate the workflow audit table.
  db.exec(`
    INSERT INTO order_status_history (order_id, old_status, new_status, note, created_at)
    SELECT o.id, NULL, o.status, 'Existing order status recorded during migration', o.created_at
    FROM orders o
    WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id)
  `);
}

initSchema();

module.exports = {
  db,
  queryAll: (sql, params = []) => {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  },
  queryOne: (sql, params = []) => {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  },
  run: (sql, params = []) => {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  }
};
