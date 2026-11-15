'use strict';

const { Pool, types } = require('pg');
const { USD_TO_INR_RATE, CURRENCY_MIGRATION } = require('../currency');

// Keep BIGINT/count values as JS numbers, matching the prior SQLite adapter.
types.setTypeParser(20, value => Number(value));

const pool = new Pool({
  max: Number(process.env.PGPOOL_MAX || 5),
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 10000),
  idleTimeoutMillis: 30000
});
pool.on('error', error => console.error('PostgreSQL pool error:', error.message));

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, slug TEXT UNIQUE NOT NULL,
    description TEXT, icon TEXT, image TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL, description TEXT NOT NULL,
    category TEXT NOT NULL, price DOUBLE PRECISION NOT NULL, original_price DOUBLE PRECISION,
    rating DOUBLE PRECISION DEFAULT 4.5, reviews_count INTEGER DEFAULT 0, stock INTEGER DEFAULT 10,
    image TEXT NOT NULL, images TEXT, features TEXT, specifications TEXT DEFAULT '[]', faqs TEXT DEFAULT '[]',
    source TEXT, source_ref TEXT, is_active SMALLINT NOT NULL DEFAULT 1, brand TEXT, badge TEXT, tags TEXT,
    is_featured SMALLINT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
    email_verified SMALLINT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    author TEXT NOT NULL, rating INTEGER NOT NULL, comment TEXT NOT NULL, date TEXT NOT NULL,
    verified SMALLINT DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, customer_phone TEXT,
    shipping_address TEXT NOT NULL, city TEXT NOT NULL, postal_code TEXT NOT NULL,
    payment_method TEXT NOT NULL, items TEXT NOT NULL, subtotal DOUBLE PRECISION NOT NULL,
    discount DOUBLE PRECISION DEFAULT 0, shipping_fee DOUBLE PRECISION DEFAULT 0,
    tax DOUBLE PRECISION DEFAULT 0, total DOUBLE PRECISION NOT NULL, currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT DEFAULT 'Processing', delivered_at TIMESTAMP, user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS coupons (
    code TEXT PRIMARY KEY, discount_percent DOUBLE PRECISION NOT NULL,
    min_spend DOUBLE PRECISION DEFAULT 0, is_active SMALLINT DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status TEXT, new_status TEXT NOT NULL, changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS refund_requests (
    id SERIAL PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL, items TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Requested',
    admin_note TEXT DEFAULT '', reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, reviewed_at TIMESTAMP, processed_at TIMESTAMP,
    idempotency_key TEXT, processor_ref TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS auth_codes (
    id SERIAL PRIMARY KEY, email TEXT NOT NULL, purpose TEXT NOT NULL, code_hash TEXT NOT NULL,
    expires_at BIGINT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, expires_at BIGINT NOT NULL, created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`,
  `CREATE INDEX IF NOT EXISTS idx_products_price ON products(price)`,
  `CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_status_history(order_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_refund_requests_order ON refund_requests(order_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_codes_email_purpose ON auth_codes(email, purpose, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_idempotency ON refund_requests(idempotency_key) WHERE idempotency_key IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_products_active_category ON products(is_active, category)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_products_source_ref_unique ON products(source_ref) WHERE source_ref IS NOT NULL`
];

function pgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function initializeDatabase() {
  for (const statement of schemaStatements) await pool.query(statement);
  await pool.query(`
    INSERT INTO order_status_history (order_id, old_status, new_status, note, created_at)
    SELECT o.id, NULL, o.status, 'Existing order status recorded during migration', o.created_at
    FROM orders o
    WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id)
  `);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(739301001::bigint)');
    const migration = await client.query("SELECT name FROM app_migrations WHERE name = $1", [CURRENCY_MIGRATION]);
    if (!migration.rowCount) {
      await client.query("UPDATE products SET price = ROUND(price::numeric * $1::numeric, 2)::double precision, original_price = CASE WHEN original_price IS NULL THEN NULL ELSE ROUND(original_price::numeric * $2::numeric, 2)::double precision END", [USD_TO_INR_RATE, USD_TO_INR_RATE]);
      await client.query("UPDATE coupons SET min_spend = ROUND(min_spend::numeric * $1::numeric, 2)::double precision", [USD_TO_INR_RATE]);
      await client.query("INSERT INTO app_migrations (name) VALUES ($1) ON CONFLICT(name) DO NOTHING", [CURRENCY_MIGRATION]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const ready = initializeDatabase();
async function queryAll(sql, params = [], client = pool) {
  await ready;
  return (await client.query(pgSql(sql), params)).rows;
}
async function queryOne(sql, params = [], client = pool) {
  await ready;
  const result = await client.query(pgSql(sql), params);
  return result.rows[0];
}
async function run(sql, params = [], client = pool) {
  await ready;
  const result = await client.query(pgSql(sql), params);
  return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id, rows: result.rows };
}
async function withTransaction(callback) {
  await ready;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx = {
      queryAll: (sql, params = []) => queryAll(sql, params, client),
      queryOne: (sql, params = []) => queryOne(sql, params, client),
      run: (sql, params = []) => run(sql, params, client)
    };
    const result = await callback(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, ready, initializeDatabase, queryAll, queryOne, run, withTransaction };

