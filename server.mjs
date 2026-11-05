import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG, PRODUCT_IDS } from './catalog.mjs';
import { ORDER_NEXT, CONVERSION_NEXT, COMMISSION, CONVERSION_COST } from './workflow.mjs';
import { render, FLASH } from './views.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB = join(ROOT, 'data', 'store.sqlite');
const SESSION_DAYS = 7;
const REF_DAYS = 30;
const nowIso = () => new Date().toISOString();

export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { public: true, status });
}

const get = (db, sql, ...args) => db.prepare(sql).get(...args);
const all = (db, sql, ...args) => db.prepare(sql).all(...args);
const run = (db, sql, ...args) => db.prepare(sql).run(...args);

export function openDb(dbPath = DEFAULT_DB) {
  mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      referral_code TEXT NOT NULL UNIQUE,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions(
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products(
      id TEXT PRIMARY KEY,
      price INTEGER NOT NULL,
      cost INTEGER NOT NULL,
      stock INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders(
      id INTEGER PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      product_id TEXT NOT NULL REFERENCES products(id),
      status TEXT NOT NULL,
      price INTEGER NOT NULL,
      cost INTEGER NOT NULL,
      ref_user_id INTEGER REFERENCES users(id),
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id, id DESC);
    CREATE TABLE IF NOT EXISTS order_events(
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS commissions(
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      referrer_id INTEGER NOT NULL REFERENCES users(id),
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      approved_at TEXT
    );
    CREATE TABLE IF NOT EXISTS payouts(
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL,
      amount INTEGER NOT NULL,
      product_id TEXT,
      details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversions(
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      bike_type TEXT NOT NULL,
      size TEXT NOT NULL,
      area TEXT NOT NULL,
      phone TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'requested',
      quote INTEGER,
      internal_cost INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS photos(
      id INTEGER PRIMARY KEY,
      conversion_id INTEGER NOT NULL REFERENCES conversions(id) ON DELETE CASCADE,
      mime TEXT NOT NULL,
      data BLOB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tickets(
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      order_id INTEGER REFERENCES orders(id),
      phone TEXT NOT NULL,
      details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested',
      reply TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const seed = db.prepare('INSERT OR IGNORE INTO products(id,price,cost,stock) VALUES(?,?,?,?)');
  for (const id of PRODUCT_IDS) seed.run(id, CATALOG[id].initialPrice, 15000, 5);
  return db;
}

function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const expected = Buffer.from(parts[1], 'hex');
  if (expected.length !== 64) return false;
  const actual = scryptSync(password, parts[0], 64);
  return timingSafeEqual(actual, expected);
}

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function referralCode(db) {
  for (let attempt = 0; attempt < 12; attempt++) {
    let code = '';
    for (const byte of randomBytes(8)) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    if (!get(db, 'SELECT id FROM users WHERE referral_code=?', code)) return code;
  }
  throw new Error('تعذر توليد كود إحالة فريد.');
}

export function createUser(db, { name, email, password, admin = false }) {
  name = String(name || '').trim();
  email = String(email || '').trim().toLowerCase();
  password = String(password || '');
  if (name.length < 2 || name.length > 80) fail('اكتب اسم من حرفين لـ ٨٠ حرف.');
  if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('اكتب بريد إلكتروني صحيح.');
  if (password.length < 10 || password.length > 128) fail('كلمة المرور لازم من ١٠ لـ ١٢٨ حرف.');
  if (get(db, 'SELECT id FROM users WHERE email=?', email)) fail('البريد ده مسجل بالفعل.');
  const code = referralCode(db);
  const result = run(
    db,
    'INSERT INTO users(name,email,password_hash,referral_code,is_admin,created_at) VALUES(?,?,?,?,?,?)',
    name, email, hashPassword(password), code, admin ? 1 : 0, nowIso()
  );
  return Number(result.lastInsertRowid);
}

export function createAdmin(db, email, password) {
  return createUser(db, { name: 'إدارة EZ-Bikes', email, password, admin: true });
}

const safeUser = row => row && ({ id: row.id, name: row.name, email: row.email, referral_code: row.referral_code, is_admin: row.is_admin });
const userById = (db, id) => safeUser(get(db, 'SELECT * FROM users WHERE id=?', id));
const referrerByCode = (db, code) => get(db, 'SELECT id FROM users WHERE referral_code=? AND is_admin=0', code);

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const at = part.indexOf('=');
    if (at < 1) continue;
    try { out[part.slice(0, at).trim()] = decodeURIComponent(part.slice(at + 1).trim()); } catch {}
  }
  return out;
}

function addCookie(res, name, value, maxAge) {
  const parts = [name + '=' + encodeURIComponent(value), 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=' + maxAge];
  if (process.env.EZ_SECURE === '1') parts.push('Secure');
  const previous = res.getHeader('Set-Cookie');
  try {
    const lines = previous ? (Array.isArray(previous) ? previous : [previous]) : [];
    res.setHeader('Set-Cookie', [...lines, parts.join('; ')]);
  } catch {
    res.setHeader('Set-Cookie', parts.join('; '));
  }
}

function sessionUser(db, req) {
  const token = parseCookies(req).ezsid;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = get(
    db,
    'SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires_at>?',
    token, Date.now()
  );
  return safeUser(row);
}

function startSession(db, req, res, userId) {
  const token = randomBytes(32).toString('hex');
  const old = parseCookies(req).ezsid;
  if (old) run(db, 'DELETE FROM sessions WHERE token=?', old);
  run(db, 'DELETE FROM sessions WHERE expires_at<?', Date.now());
  run(db, 'INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)', token, userId, Date.now() + SESSION_DAYS * 86400000);
  addCookie(res, 'ezsid', token, SESSION_DAYS * 86400);
}

function baseUrl(req) {
  if (process.env.EZ_PUBLIC_URL) {
    try { return new URL(process.env.EZ_PUBLIC_URL).origin; } catch {}
  }
  return 'http://' + req.headers.host;
}

function checkHost(req) {
  const host = String(req.headers.host || '');
  if (process.env.EZ_PUBLIC_URL) {
    try {
      if (host !== new URL(process.env.EZ_PUBLIC_URL).host) fail('العنوان غير متاح.', 400);
    } catch {
      fail('إعداد EZ_PUBLIC_URL غير صالح.', 500);
    }
  } else if (!/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host)) {
    fail('الخادم ده محلي. اضبط EZ_PUBLIC_URL قبل النشر.', 400);
  }
}

function checkOrigin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') fail('الطلب من مصدر غير مسموح.', 403);
  const origin = req.headers.origin;
  if (origin && origin !== baseUrl(req)) fail('الطلب من مصدر غير مسموح.', 403);
}

function redirect(res, location, status = 303) {
  res.writeHead(status, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

function sendHtml(req, res, html, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  if (req.method === 'HEAD') res.end();
  else res.end(html);
}

async function readForm(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8_500_000) fail('حجم البيانات أكبر من المسموح.');
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  const type = String(req.headers['content-type'] || '');
  if (type.includes('multipart/form-data')) {
    const request = new Request('http://localhost/', { method: 'POST', headers: { 'content-type': type }, body });
    return request.formData();
  }
  return new URLSearchParams(body.toString('utf8'));
}

function text(f, key, max, label, required = true) {
  const value = String(f.get(key) ?? '').trim();
  if (required && !value) fail('اكتب ' + label + '.');
  if (value.length > max) fail(label + ' أطول من المسموح.');
  return value;
}

function emailValue(f, required = true) {
  const value = text(f, 'email', 160, 'البريد الإلكتروني', required).toLowerCase();
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail('اكتب بريد إلكتروني صحيح.');
  return value;
}

function validPhone(value) {
  return /^[+\d\s()-]{8,32}$/.test(value) && value.replace(/\D/g, '').length >= 8;
}

function phoneValue(f, key = 'phone') {
  const value = text(f, key, 32, 'رقم التليفون');
  if (!validPhone(value)) fail('اكتب رقم تليفون صحيح.');
  return value;
}

function intValue(value, { min = 1, max = 10_000_000, label = 'القيمة' } = {}) {
  if (!/^\d+$/.test(String(value))) fail('راجع ' + label + '.');
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) fail('راجع ' + label + '.');
  return n;
}

function safeNext(value) {
  return /^\/(?:buy\/(?:turk-90|hulk-101)|convert|support|account)$/.test(String(value || '')) ? value : '';
}

function walletFor(db, userId) {
  const approved = get(db, "SELECT COALESCE(SUM(amount),0) v FROM commissions WHERE referrer_id=? AND status='approved'", userId).v;
  const reserved = get(db, "SELECT COALESCE(SUM(amount),0) v FROM payouts WHERE user_id=? AND status IN ('pending','approved')", userId).v;
  const pending = get(db, "SELECT COALESCE(SUM(amount),0) v FROM commissions WHERE referrer_id=? AND status='pending'", userId).v;
  return { approved, reserved, pending, available: approved - reserved };
}

function eventsFor(db, orderId) {
  return all(db, 'SELECT status,note,created_at FROM order_events WHERE order_id=? ORDER BY id', orderId);
}

function attachEvents(db, orders) {
  for (const order of orders) order.events = eventsFor(db, order.id);
  return orders;
}

function userOrders(db, userId) {
  return all(
    db,
    'SELECT o.*, r.referral_code AS ref_code FROM orders o LEFT JOIN users r ON r.id=o.ref_user_id WHERE o.user_id=? ORDER BY o.id DESC',
    userId
  );
}

function resolveReferral(db, raw, cookieCode, buyerId) {
  const manual = String(raw || '').trim().toUpperCase();
  const fallback = String(cookieCode || '').trim().toUpperCase();
  const code = manual || fallback;
  if (!code) return null;
  if (!/^[A-Z0-9]{8}$/.test(code)) {
    if (manual) fail('كود الإحالة غير صالح.');
    return null;
  }
  const referrer = referrerByCode(db, code);
  if (!referrer) {
    if (manual) fail('كود الإحالة غير صالح.');
    return null;
  }
  if (buyerId && referrer.id === buyerId) {
    if (manual) fail('مش مسموح تستخدم كود الإحالة الخاص بك.');
    return null;
  }
  return referrer.id;
}

function createOrder(db, data) {
  return transaction(db, () => {
    const product = get(db, 'SELECT * FROM products WHERE id=?', data.productId);
    if (!product) fail('الموديل مش موجود.');
    if (product.stock < 1) fail('الموديل غير متاح حاليًا.');
    const at = nowIso();
    run(db, 'UPDATE products SET stock=stock-1 WHERE id=?', product.id);
    const result = run(
      db,
      'INSERT INTO orders(user_id,customer_name,phone,address,product_id,status,price,cost,ref_user_id,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
      data.userId, data.name, data.phone, data.address, product.id, 'requested', product.price, product.cost, data.refUserId, '', at, at
    );
    const id = Number(result.lastInsertRowid);
    run(db, 'INSERT INTO order_events(order_id,status,note,created_at) VALUES(?,?,?,?)', id, 'requested', '', at);
    return id;
  });
}

function setOrderStatus(db, id, status, note) {
  const order = get(db, 'SELECT * FROM orders WHERE id=?', id);
  if (!order) fail('الطلب مش موجود.', 404);
  if (!ORDER_NEXT[order.status]?.includes(status)) fail('تغيير الحالة غير متاح.');
  transaction(db, () => {
    const at = nowIso();
    if (status === 'cancelled' || status === 'returned') {
      run(db, 'UPDATE products SET stock=stock+1 WHERE id=?', order.product_id);
    }
    run(db, 'UPDATE orders SET status=?, note=?, updated_at=?, completed_at=? WHERE id=?',
      status, note, at, status === 'complete' ? at : order.completed_at, id);
    run(db, 'INSERT INTO order_events(order_id,status,note,created_at) VALUES(?,?,?,?)', id, status, note, at);
    if (status === 'complete' && order.ref_user_id) {
      run(db, "INSERT OR IGNORE INTO commissions(order_id,referrer_id,amount,status,created_at) VALUES(?,?,?,'pending',?)",
        id, order.ref_user_id, COMMISSION, at);
    }
    if (status === 'cancelled' || status === 'returned') {
      run(db, "UPDATE commissions SET status='reversed' WHERE order_id=? AND status!='reversed'", id);
    }
  });
}

const imageTypes = {
  'image/jpeg': bytes => bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF,
  'image/png': bytes => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47,
  'image/webp': bytes => bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
};

// حد بسيط للمحاولات المتكررة في الذاكرة.
const attemptMap = new Map();
function limited(key, max, windowMs) {
  const record = attemptMap.get(key);
  if (!record) return false;
  if (Date.now() - record.first > windowMs) {
    attemptMap.delete(key);
    return false;
  }
  return record.count >= max;
}
function noteAttempt(key, windowMs) {
  const record = attemptMap.get(key);
  if (!record || Date.now() - record.first > windowMs) attemptMap.set(key, { first: Date.now(), count: 1 });
  else record.count++;
}
function clearAttempts(key) {
  attemptMap.delete(key);
}
const clientKey = req => String(req.socket.remoteAddress || 'local');

function loadAssets() {
  const files = {
    '/style.css': ['public/style.css', 'text/css; charset=utf-8'],
    '/app.js': ['public/app.js', 'text/javascript; charset=utf-8'],
    '/favicon.svg': ['public/favicon.svg', 'image/svg+xml']
  };
  for (const id of PRODUCT_IDS) {
    files['/assets/' + CATALOG[id].image] = ['public/assets/' + CATALOG[id].image, 'image/png'];
    files['/assets/' + CATALOG[id].detail] = ['public/assets/' + CATALOG[id].detail, 'image/png'];
  }
  files['/assets/ez-bike-transparent.png'] = ['public/assets/ez-bike-transparent.png', 'image/png'];
  const assets = new Map();
  for (const [url, [file, type]] of Object.entries(files)) {
    assets.set(url, { type, buffer: readFileSync(join(ROOT, file)) });
  }
  return assets;
}

function makeHandler(db, assets) {
  return async function handler(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    let user = null;
    try {
      checkHost(req);
      const url = new URL(req.url, baseUrl(req));
      const path = url.pathname;

      if (req.method === 'GET' || req.method === 'HEAD') {
        if (assets.has(path)) {
          const asset = assets.get(path);
          res.writeHead(200, {
            'Content-Type': asset.type,
            'Content-Length': asset.buffer.length,
            'Cache-Control': path === '/style.css' || path === '/app.js' ? 'public, max-age=300' : 'public, max-age=86400'
          });
          if (req.method === 'HEAD') res.end();
          else res.end(asset.buffer);
          return;
        }

        user = sessionUser(db, req);
        if (path.startsWith('/photo/')) {
          if (!user) return redirect(res, '/login?next=' + encodeURIComponent('/account'));
          const id = Number(path.slice(7));
          if (!Number.isSafeInteger(id) || id < 1) fail('الصورة مش موجودة.', 404);
          const photo = get(
            db,
            'SELECT photos.*, conversions.user_id AS owner FROM photos JOIN conversions ON conversions.id=photos.conversion_id WHERE photos.id=?',
            id
          );
          if (!photo || (!user.is_admin && photo.owner !== user.id)) fail('الصورة مش موجودة.', 404);
          res.writeHead(200, {
            'Content-Type': photo.mime,
            'Content-Length': photo.data.length,
            'Cache-Control': 'private, no-store',
            'Content-Disposition': 'inline'
          });
          if (req.method === 'HEAD') res.end();
          else res.end(photo.data);
          return;
        }

        const refCode = String(url.searchParams.get('ref') || '').trim().toUpperCase();
        if (refCode && referrerByCode(db, refCode)) addCookie(res, 'ezref', refCode, REF_DAYS * 86400);

        const items = all(db, 'SELECT * FROM products ORDER BY rowid');
        let data = {
          user, items, site: baseUrl(req),
          flash: FLASH[url.searchParams.get('ok')] || '',
          path
        };

        if (path === '/') data.title = 'EZ-Bikes | مشوارك بقى كهربا';
        else if (path === '/shop') data.title = 'الموديلات | EZ-Bikes';
        else if (path === '/refer') data.title = 'رشّح واكسب | EZ-Bikes';
        else if (path === '/convert') {
          data.title = 'حوّل عجلتك لكهربا | EZ-Bikes';
          if (user) data.orders = attachEvents(db, userOrders(db, user.id));
        } else if (path === '/support') {
          data.title = 'الدعم والاستفسارات | EZ-Bikes';
          if (user) data.orders = userOrders(db, user.id);
        } else if (path === '/login' || path === '/register') {
          if (user) return redirect(res, user.is_admin ? '/admin' : '/account');
          data.next = safeNext(url.searchParams.get('next'));
          data.title = (path === '/login' ? 'تسجيل الدخول' : 'حساب جديد') + ' | EZ-Bikes';
        } else if (path === '/account') {
          if (!user) return redirect(res, '/login?next=' + encodeURIComponent('/account'));
          if (user.is_admin) return redirect(res, '/admin');
          data.title = 'حسابي | EZ-Bikes';
          data.wallet = walletFor(db, user.id);
          data.orders = attachEvents(db, userOrders(db, user.id));
          data.conversions = all(db, 'SELECT * FROM conversions WHERE user_id=? ORDER BY id DESC', user.id);
          data.commissions = all(db, 'SELECT * FROM commissions WHERE referrer_id=? ORDER BY id DESC', user.id);
          data.payouts = all(db, 'SELECT * FROM payouts WHERE user_id=? ORDER BY id DESC', user.id);
          data.tickets = all(db, 'SELECT * FROM tickets WHERE user_id=? ORDER BY id DESC', user.id);
          data.refLink = data.site + '/?ref=' + encodeURIComponent(user.referral_code);
        } else if (path === '/track') {
          data.title = 'تتبّع الطلب | EZ-Bikes';
        } else if (path === '/error') {
          data.title = 'مشكلة | EZ-Bikes';
          data.code = 400;
          data.message = 'راجع البيانات وجرب تاني.';
        } else if (path === '/admin' || path === '/admin/manual') {
          if (!user || !user.is_admin) {
            const html = render('/error', { ...data, code: 403, heading: 'محتاج صلاحية إدارة', message: 'الصفحة دي للإدارة فقط. سجّل دخول بحساب المدير.', back: '/login?next=' + encodeURIComponent(path) });
            return sendHtml(req, res, html, 403);
          }
          data.title = 'لوحة الإدارة | EZ-Bikes';
          data.user = user;
          if (path === '/admin') {
            const orders = all(db, `
              SELECT o.*, u.email AS email, r.referral_code AS ref_code
              FROM orders o
              LEFT JOIN users u ON u.id=o.user_id
              LEFT JOIN users r ON r.id=o.ref_user_id
              ORDER BY o.id DESC`);
            for (const order of orders) {
              order.events = eventsFor(db, order.id);
              order.next = ORDER_NEXT[order.status] || [];
            }
            const commissions = all(db, `
              SELECT c.*, u.name AS referrer_name, u.email AS referrer_email, u.referral_code AS referrer_code
              FROM commissions c JOIN users u ON u.id=c.referrer_id
              ORDER BY c.id DESC`);
            const payouts = all(db, `
              SELECT p.*, u.name AS customer_name, u.email
              FROM payouts p JOIN users u ON u.id=p.user_id
              ORDER BY p.id DESC`);
            const conversions = all(db, `
              SELECT c.*, u.name AS customer_name, u.email
              FROM conversions c JOIN users u ON u.id=c.user_id
              ORDER BY c.id DESC`);
            for (const conversion of conversions) {
              conversion.photos = all(db, 'SELECT id FROM photos WHERE conversion_id=?', conversion.id).map(p => p.id);
              conversion.next = CONVERSION_NEXT[conversion.status] || [];
            }
            const tickets = all(db, `
              SELECT t.*, u.name AS customer_name, u.email
              FROM tickets t JOIN users u ON u.id=t.user_id
              ORDER BY t.id DESC`);
            const sales = all(db, "SELECT price,cost,ref_user_id FROM orders WHERE status='complete'");
            const pendingCommissions = all(db, "SELECT amount FROM commissions WHERE status='pending'");
            data.products = items;
            data.orders = orders;
            data.commissions = commissions;
            data.payouts = payouts;
            data.conversions = conversions;
            data.tickets = tickets;
            data.metrics = {
              salesCount: sales.length,
              revenue: sales.reduce((sum, sale) => sum + sale.price, 0),
              contribution: sales.reduce((sum, sale) => sum + sale.price - sale.cost - (sale.ref_user_id ? COMMISSION : 0), 0),
              pendingCommissions: pendingCommissions.reduce((sum, item) => sum + item.amount, 0),
              pendingCommissionCount: pendingCommissions.length,
              pendingPayouts: get(db, "SELECT COUNT(*) n FROM payouts WHERE status='pending'").n
            };
          } else {
            data.items = items;
          }
          data.products = items;
        } else if (path === '/bike/turk-90' || path === '/bike/hulk-101') {
          const id = path.slice(6);
          const item = items.find(i => i.id === id);
          if (!item) fail('الموديل مش موجود.', 404);
          data.title = CATALOG[id].name + ' | EZ-Bikes';
        } else if (path === '/buy/turk-90' || path === '/buy/hulk-101') {
          if (!user) return redirect(res, '/login?next=' + encodeURIComponent(path));
          if (user.is_admin) return redirect(res, '/admin');
          const id = path.slice(5);
          const item = items.find(i => i.id === id);
          if (!item) fail('الموديل مش موجود.', 404);
          if (item.stock < 1) fail('الموديل غير متاح حاليًا.', 400);
          const cookieRef = String(parseCookies(req).ezref || '').toUpperCase();
          data.refCode = refCode || (referrerByCode(db, cookieRef) ? cookieRef : '');
          data.title = 'اطلب ' + CATALOG[id].name + ' | EZ-Bikes';
        }

        const html = render(path, data);
        if (!html) fail('الصفحة مش موجودة.', 404);
        return sendHtml(req, res, html);
      }

      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD, POST' });
        res.end('Method not allowed');
        return;
      }

      checkOrigin(req);
      user = sessionUser(db, req);
      const form = await readForm(req);

      if (path === '/register') {
        const name = text(form, 'name', 80, 'الاسم');
        const email = emailValue(form);
        const password = String(form.get('password') || '');
        const confirm = String(form.get('confirm') || '');
        if (password !== confirm) fail('كلمتا المرور مش متطابقتين.');
        const id = createUser(db, { name, email, password });
        startSession(db, req, res, id);
        return redirect(res, safeNext(form.get('next')) || '/account');
      }

      if (path === '/login') {
        const email = emailValue(form);
        const password = String(form.get('password') || '');
        const key = clientKey(req) + ':' + email;
        if (limited(key, 8, 10 * 60 * 1000)) fail('محاولات دخول كتير. استنى شوية وجرب تاني.', 429);
        const account = get(db, 'SELECT * FROM users WHERE email=?', email);
        const ok = account ? verifyPassword(password, account.password_hash) : (scryptSync(password, 'invalid-login-salt', 64), false);
        if (!ok) {
          noteAttempt(key, 10 * 60 * 1000);
          fail('البريد أو كلمة المرور غير صحيحين.');
        }
        clearAttempts(key);
        startSession(db, req, res, account.id);
        if (account.is_admin) return redirect(res, '/admin');
        return redirect(res, safeNext(form.get('next')) || '/account');
      }

      if (path === '/logout') {
        const token = parseCookies(req).ezsid;
        if (token) run(db, 'DELETE FROM sessions WHERE token=?', token);
        addCookie(res, 'ezsid', '', 0);
        return redirect(res, '/');
      }

      if (path === '/track') {
        const key = 'track:' + clientKey(req);
        if (limited(key, 30, 10 * 60 * 1000)) fail('محاولات كتير. استنى شوية وجرب تاني.', 429);
        noteAttempt(key, 10 * 60 * 1000);
        const id = intValue(form.get('order_id'), { label: 'رقم الطلب' });
        const phone = String(form.get('phone') || '').replace(/\D/g, '');
        const order = get(db, 'SELECT * FROM orders WHERE id=?', id);
        const match = order && phone.length >= 8 && order.phone.replace(/\D/g, '') === phone;
        const items = all(db, 'SELECT * FROM products ORDER BY rowid');
        const html = render('/track', {
          user, items, site: baseUrl(req), flash: '', path: '/track',
          title: 'تتبّع الطلب | EZ-Bikes',
          tracked: match ? { ...order, events: eventsFor(db, order.id) } : null,
          trackError: match ? '' : 'مش لاقيين طلب بالرقم والتليفون دول. راجع البيانات.'
        });
        return sendHtml(req, res, html);
      }

      // كل الإجراءات التالية تحتاج تسجيل دخول.
      if (!user) fail('سجّل الدخول الأول.', 401);

      if (path === '/buy') {
        if (user.is_admin) fail('حساب الإدارة مش بيشتري.', 403);
        const productId = text(form, 'product', 20, 'الموديل');
        const item = get(db, 'SELECT * FROM products WHERE id=?', productId);
        if (!item) fail('الموديل مش موجود.');
        const phone = phoneValue(form);
        const address = text(form, 'address', 500, 'عنوان التوصيل');
        if (address.length < 5) fail('اكتب عنوان توصيل أوضح.');
        const refUserId = resolveReferral(db, form.get('ref_code'), parseCookies(req).ezref, user.id);
        createOrder(db, {
          userId: user.id,
          name: user.name,
          phone,
          address,
          productId,
          refUserId
        });
        return redirect(res, '/account?ok=order');
      }

      if (path === '/convert') {
        const bikeType = text(form, 'bike_type', 80, 'نوع العجلة');
        const size = text(form, 'size', 30, 'مقاس العجلة');
        const area = text(form, 'area', 100, 'المنطقة');
        const phone = phoneValue(form);
        const details = text(form, 'details', 1200, 'التفاصيل', false);
        const uploads = form.getAll('photos').filter(file => typeof file !== 'string' && file.size);
        if (uploads.length > 3) fail('مسموح بتلات صور كحد أقصى.');
        const photos = [];
        for (const file of uploads) {
          if (file.size > 2 * 1024 * 1024) fail('كل صورة لازم تكون ٢ ميجا أو أقل.');
          const kind = String(file.type || '');
          const bytes = Buffer.from(await file.arrayBuffer());
          if (!imageTypes[kind] || !imageTypes[kind](bytes)) fail('استخدم صور JPEG أو PNG أو WebP.');
          photos.push([kind, bytes]);
        }
        transaction(db, () => {
          const at = nowIso();
          const result = run(
            db,
            "INSERT INTO conversions(user_id,bike_type,size,area,phone,details,status,internal_cost,note,created_at,updated_at) VALUES(?,?,?,?,?,?,'requested',?,'',?,?)",
            user.id, bikeType, size, area, phone, details, CONVERSION_COST, at, at
          );
          const id = Number(result.lastInsertRowid);
          for (const [mime, bytes] of photos) run(db, 'INSERT INTO photos(conversion_id,mime,data) VALUES(?,?,?)', id, mime, bytes);
        });
        return redirect(res, '/account?ok=convert');
      }

      if (path === '/support') {
        const phone = phoneValue(form);
        const rawOrder = String(form.get('order_id') || '').trim();
        let orderId = null;
        if (rawOrder) {
          orderId = intValue(rawOrder, { label: 'رقم الطلب' });
          const own = get(db, 'SELECT id FROM orders WHERE id=? AND user_id=?', orderId, user.id);
          if (!own) fail('الطلب ده مش تابع لحسابك.');
        }
        const details = text(form, 'details', 1200, 'تفاصيل الاستفسار');
        const at = nowIso();
        run(
          db,
          "INSERT INTO tickets(user_id,order_id,phone,details,status,reply,created_at,updated_at) VALUES(?,?,?,?,'requested','',?,?)",
          user.id, orderId, phone, details, at, at
        );
        return redirect(res, '/account?ok=support');
      }

      if (path === '/payout') {
        if (user.is_admin) fail('المكافآت لحسابات العملاء.', 403);
        const kind = String(form.get('kind') || '');
        if (kind !== 'cash' && kind !== 'bike') fail('نوع طلب المكافأة غير صالح.');
        const details = text(form, 'details', 300, 'بيانات الاستلام');
        if (details.length < 2) fail('اكتب بيانات الاستلام.');
        let amount;
        let productId = null;
        if (kind === 'cash') {
          amount = intValue(form.get('amount'), { label: 'المبلغ' });
        } else {
          productId = text(form, 'product_id', 20, 'الموديل');
          const product = get(db, 'SELECT * FROM products WHERE id=?', productId);
          if (!product) fail('الموديل مش موجود.');
          if (product.stock < 1) fail('الموديل غير متاح حاليًا.');
          amount = product.price;
        }
        transaction(db, () => {
          if (amount > walletFor(db, user.id).available) fail('الرصيد المتاح مش كافي.');
          const at = nowIso();
          run(
            db,
            "INSERT INTO payouts(user_id,kind,amount,product_id,details,status,note,created_at,updated_at) VALUES(?,?,?,?,?,'pending','',?,?)",
            user.id, kind, amount, productId, details, at, at
          );
        });
        return redirect(res, '/account?ok=payout');
      }

      if (!user.is_admin) fail('الصفحة دي للإدارة فقط.', 403);

      if (path === '/admin/product') {
        const productId = text(form, 'product', 20, 'الموديل');
        if (!CATALOG[productId]) fail('الموديل مش موجود.');
        const price = intValue(form.get('price'), { label: 'السعر' });
        const cost = intValue(form.get('cost'), { min: 0, label: 'التكلفة' });
        const stock = intValue(form.get('stock'), { min: 0, max: 100000, label: 'المخزون' });
        run(db, 'UPDATE products SET price=?, cost=?, stock=? WHERE id=?', price, cost, stock, productId);
        return redirect(res, '/admin?ok=product#products');
      }

      if (path === '/admin/order') {
        const id = intValue(form.get('id'), { label: 'الطلب' });
        const status = text(form, 'status', 20, 'الحالة');
        const note = text(form, 'note', 500, 'الملاحظة', false);
        setOrderStatus(db, id, status, note);
        return redirect(res, '/admin?ok=status#orders');
      }

      if (path === '/admin/commission') {
        const id = intValue(form.get('id'), { label: 'العمولة' });
        const result = run(db, "UPDATE commissions SET status='approved', approved_at=? WHERE id=? AND status='pending'", nowIso(), id);
        if (!result.changes) fail('العمولة مش بانتظار الاعتماد.');
        return redirect(res, '/admin?ok=commission#commissions');
      }

      if (path === '/admin/payout') {
        const id = intValue(form.get('id'), { label: 'طلب المكافأة' });
        const decision = text(form, 'status', 20, 'القرار');
        const note = text(form, 'note', 300, 'الملاحظة', false);
        if (decision !== 'approved' && decision !== 'rejected') fail('القرار غير صالح.');
        transaction(db, () => {
          const payout = get(db, 'SELECT * FROM payouts WHERE id=?', id);
          if (!payout) fail('طلب المكافأة مش موجود.', 404);
          if (payout.status !== 'pending') fail('الطلب اتنفذ قبل كده.');
          if (decision === 'approved') {
            if (walletFor(db, payout.user_id).available < 0) fail('رصيد العميل تأثر بإرجاع. ارفض الطلب وراجع الحساب.');
            if (payout.kind === 'bike') {
              const stock = get(db, 'SELECT stock FROM products WHERE id=?', payout.product_id);
              if (!stock || stock.stock < 1) fail('مخزون الموديل غير متاح. ارفض الطلب أو حدّث المخزون.');
              run(db, 'UPDATE products SET stock=stock-1 WHERE id=?', payout.product_id);
            }
          }
          run(db, 'UPDATE payouts SET status=?, note=?, updated_at=? WHERE id=?', decision, note, nowIso(), id);
        });
        return redirect(res, '/admin?ok=payoutDecision#payouts');
      }

      if (path === '/admin/conversion') {
        const id = intValue(form.get('id'), { label: 'طلب التحويل' });
        const status = text(form, 'status', 20, 'الحالة');
        const note = text(form, 'note', 500, 'الملاحظة', false);
        const conversion = get(db, 'SELECT * FROM conversions WHERE id=?', id);
        if (!conversion) fail('طلب التحويل مش موجود.', 404);
        if (!CONVERSION_NEXT[conversion.status]?.includes(status)) fail('تغيير الحالة غير متاح.');
        let quote = conversion.quote;
        if (status === 'quoted') {
          quote = intValue(form.get('quote'), { label: 'عرض السعر' });
        } else if (!quote) {
          fail('لازم تحدد عرض سعر قبل تحديد الموعد أو الإكمال.');
        }
        const at = nowIso();
        run(db, 'UPDATE conversions SET status=?, quote=?, note=?, updated_at=? WHERE id=?', status, quote, note, at, id);
        return redirect(res, '/admin?ok=conversion#conversions');
      }

      if (path === '/admin/ticket') {
        const id = intValue(form.get('id'), { label: 'الاستفسار' });
        const reply = text(form, 'reply', 1200, 'الرد');
        const at = nowIso();
        const result = run(db, "UPDATE tickets SET reply=?, status='answered', updated_at=? WHERE id=?", reply, at, id);
        if (!result.changes) fail('الاستفسار مش موجود.', 404);
        return redirect(res, '/admin?ok=reply#tickets');
      }

      if (path === '/admin/manual') {
        const productId = text(form, 'product', 20, 'الموديل');
        if (!CATALOG[productId]) fail('الموديل مش موجود.');
        const name = text(form, 'name', 80, 'اسم المشتري');
        const phone = phoneValue(form);
        const address = text(form, 'address', 500, 'عنوان التوصيل');
        if (address.length < 5) fail('اكتب عنوان توصيل أوضح.');
        const email = emailValue(form, false);
        let account = null;
        if (email) {
          account = get(db, 'SELECT * FROM users WHERE email=? AND is_admin=0', email);
          if (!account) fail('مفيش حساب بالبريد ده. سيب البريد فاضي لو الطلب لزائر.');
        }
        const refUserId = resolveReferral(db, form.get('ref_code'), '', account?.id);
        createOrder(db, {
          userId: account?.id ?? null,
          name,
          phone,
          address,
          productId,
          refUserId
        });
        return redirect(res, '/admin?ok=manual#orders');
      }

      fail('الإجراء غير موجود.', 404);
    } catch (err) {
      if (!err.public) console.error(err);
      if (res.headersSent) return res.end();
      const status = err.public ? (err.status || 400) : 500;
      const message = err.public ? err.message : 'حصل خطأ أثناء تنفيذ الطلب. جرّب تاني.';
      let back = '';
      try {
        const referer = req.headers.referer;
        if (referer && new URL(referer).origin === baseUrl(req)) back = new URL(referer).pathname + new URL(referer).search;
      } catch {}
      const items = (() => { try { return all(db, 'SELECT * FROM products ORDER BY rowid'); } catch { return []; } })();
      try {
        const html = render('/error', {
          user, items, site: baseUrl(req), flash: '', path: '/error',
          title: 'مشكلة | EZ-Bikes',
          code: status,
          heading: status === 404 ? 'الصفحة مش موجودة' : status === 403 ? 'محتاج صلاحية' : status === 429 ? 'استنى شوية' : 'راجع البيانات',
          message,
          back
        });
        sendHtml(req, res, html, status);
      } catch (renderError) {
        console.error(renderError);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Server error');
      }
    }
  };
}

export async function startServer({ dbPath = process.env.EZ_DB || DEFAULT_DB, port = Number(process.env.PORT || 3186), host = process.env.HOST || '127.0.0.1' } = {}) {
  const db = openDb(dbPath);
  const assets = loadAssets();
  const server = createServer(makeHandler(db, assets));
  await new Promise((resolvePromise, rejectPromise) => {
    const onError = err => { server.off('error', onError); rejectPromise(err); };
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      resolvePromise();
    });
  });
  const actualPort = server.address().port;
  return {
    server,
    db,
    url: `http://${host}:${actualPort}`,
    async close() {
      await new Promise(resolvePromise => server.close(resolvePromise));
      db.close();
    }
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv[2] === 'admin') {
    const email = String(process.argv[3] || '').trim().toLowerCase();
    const password = process.env.EZ_ADMIN_PASSWORD || '';
    if (!email || email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error('اكتب بريد صحيح: node server.mjs admin you@example.com');
      process.exit(1);
    }
    if (!password) {
      console.error('حدد كلمة مرور المدير في المتغير EZ_ADMIN_PASSWORD قبل تشغيل الأمر.');
      process.exit(1);
    }
    const db = openDb(process.env.EZ_DB || DEFAULT_DB);
    try {
      if (get(db, 'SELECT id FROM users WHERE email=?', email)) {
        console.error('البريد ده مسجل بالفعل.');
        process.exit(1);
      }
      createAdmin(db, email, password);
      console.log('تم إنشاء حساب الإدارة: ' + email);
    } catch (err) {
      console.error(err.public ? err.message : err);
      process.exit(1);
    } finally {
      db.close();
    }
    process.exit(0);
  }

  startServer().then(({ url, db }) => {
    console.log('EZ-Bikes يعمل على ' + url);
    const admin = get(db, 'SELECT id FROM users WHERE is_admin=1');
    if (!admin) console.log('مفيش حساب إدارة. راجع README لإنشاء أول مدير.');
  }).catch(err => {
    console.error('فشل تشغيل الخادم:', err.message);
    process.exit(1);
  });
}
