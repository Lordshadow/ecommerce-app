const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { queryOne, run } = require('./db/database');
const { sendVerificationCode } = require('./mail');

const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE = 'apex_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;
const secret = process.env.AUTH_SECRET || 'local-development-secret-change-before-deploying';
const limitBuckets = new Map();
let signingPair;

function customerSigningKey() {
  if (signingPair) return signingPair;
  const privatePem = process.env.CUSTOMER_TOKEN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (privatePem) {
    const privateKey = crypto.createPrivateKey(privatePem);
    signingPair = { privateKey, publicKey: crypto.createPublicKey(privateKey) };
  } else {
    if (process.env.NODE_ENV === 'production') throw new Error('CUSTOMER_TOKEN_PRIVATE_KEY is required in production.');
    signingPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  }
  return signingPair;
}

function createCustomerToken(userId, extra = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: String(userId), iat: now, exp: now + 3600, iss: process.env.CUSTOMER_TOKEN_ISSUER || 'apexstore', ...extra })).toString('base64url');
  const data = `${header}.${payload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(data), customerSigningKey().privateKey).toString('base64url');
  return `${data}.${signature}`;
}

function verifyCustomerToken(token) {
  try {
    if (typeof token !== 'string' || token.length > 8192) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (header.alg !== 'RS256' || claims.iss !== (process.env.CUSTOMER_TOKEN_ISSUER || 'apexstore') || !claims.sub || claims.exp <= Date.now() / 1000) return null;
    if (!crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), customerSigningKey().publicKey, Buffer.from(parts[2], 'base64url'))) return null;
    return claims;
  } catch { return null; }
}

function customerJwks() {
  const jwk = customerSigningKey().publicKey.export({ format: 'jwk' });
  return { keys: [{ ...jwk, use: 'sig', alg: 'RS256', kid: 'apexstore-customer-v1' }] };
}

function hashCode(email, purpose, code) {
  return crypto.createHmac('sha256', secret).update(`${email.toLowerCase()}:${purpose}:${code}`).digest('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(req) {
  const parsed = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    try { parsed[key] = decodeURIComponent(part.slice(index + 1).trim()); } catch { parsed[key] = ''; }
  }
  return parsed;
}

function cookieOptions(maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure ? '; Secure' : ''}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', cookieOptions(0));
}

function getCurrentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token || token.length > 200) return null;
  const session = queryOne(`
    SELECT users.id, users.name, users.email, users.email_verified, auth_sessions.id AS session_id
    FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id
    WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ? AND users.email_verified = 1
  `, [hashToken(token), Date.now()]);
  if (!session) return null;
  return { id: session.id, name: session.name, email: session.email, email_verified: Boolean(session.email_verified) };
}

function createSession(userId, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  run('INSERT INTO auth_sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)', [
    userId, hashToken(token), now + SESSION_TTL_MS, now
  ]);
  setSessionCookie(res, token);
}

function revokeSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) run('DELETE FROM auth_sessions WHERE token_hash = ?', [hashToken(token)]);
}

function checkRateLimit(key, max, windowMs) {
  const now = Date.now();
  const recent = (limitBuckets.get(key) || []).filter((time) => time > now - windowMs);
  if (recent.length >= max) return false;
  recent.push(now);
  limitBuckets.set(key, recent);
  if (limitBuckets.size > 5000) {
    for (const [bucket, times] of limitBuckets) {
      if (!times.length || times[times.length - 1] <= now - windowMs) limitBuckets.delete(bucket);
    }
  }
  return true;
}

function ipFor(req) {
  return req.socket.remoteAddress || 'unknown';
}

function emailValue(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function userView(user) {
  return { id: user.id, name: user.name, email: user.email, email_verified: Boolean(user.email_verified) };
}

async function issueCode(email, purpose) {
  const now = Date.now();
  const cooldown = queryOne(
    'SELECT created_at FROM auth_codes WHERE email = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1',
    [email, purpose]
  );
  if (cooldown && now - cooldown.created_at < 60_000) {
    return { ok: false, status: 429, error: 'Please wait before requesting another code.' };
  }
  const hourly = queryOne(
    'SELECT COUNT(*) AS count FROM auth_codes WHERE email = ? AND purpose = ? AND created_at > ?',
    [email, purpose, now - 60 * 60 * 1000]
  );
  if (hourly.count >= 5) return { ok: false, status: 429, error: 'Too many code requests. Try again later.' };

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  run('DELETE FROM auth_codes WHERE email = ? AND purpose = ?', [email, purpose]);
  run('INSERT INTO auth_codes (email, purpose, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, 0, ?)', [
    email, purpose, hashCode(email, purpose, code), now + CODE_TTL_MS, now
  ]);
  try {
    await sendVerificationCode({ email, code, purpose });
  } catch (error) {
    run('DELETE FROM auth_codes WHERE email = ? AND purpose = ?', [email, purpose]);
    throw error;
  }
  return { ok: true };
}

function consumeCode(email, purpose, code) {
  if (!/^\d{6}$/.test(String(code || ''))) return { ok: false, error: 'The code is invalid or expired.' };
  const record = queryOne(
    'SELECT * FROM auth_codes WHERE email = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1',
    [email, purpose]
  );
  if (!record || record.expires_at <= Date.now() || record.attempts >= 5) {
    return { ok: false, error: 'The code is invalid or expired.' };
  }
  const candidate = hashCode(email, purpose, code);
  if (!safeEqual(candidate, record.code_hash)) {
    run('UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ?', [record.id]);
    return { ok: false, error: 'The code is invalid or expired.' };
  }
  run('DELETE FROM auth_codes WHERE id = ?', [record.id]);
  return { ok: true };
}

async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = await scrypt(password, salt, 64);
  return { salt, hash: Buffer.from(derived).toString('hex') };
}

module.exports = {
  checkRateLimit,
  createCustomerToken,
  customerJwks,
  consumeCode,
  createSession,
  emailValue,
  getCurrentUser,
  hashPassword,
  ipFor,
  issueCode,
  revokeSession,
  safeEqual,
  setSessionCookie,
  clearSessionCookie,
  userView,
  verifyCustomerToken,
  validEmail,
  SESSION_TTL_MS
};
