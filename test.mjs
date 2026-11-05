import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, createAdmin } from './server.mjs';

const dir = mkdtempSync(join(tmpdir(), 'ez-bikes-test-'));
const dbPath = join(dir, 'store.sqlite');
let app;
let base;
let admin;
let referrer;
let buyer;
let orderId;
let referrerCode;
let guestOrderId;
let conversionId;

class Client {
  constructor() { this.cookies = new Map(); }
  async request(path, { method = 'GET', form, formData, headers = {} } = {}) {
    const h = { ...headers };
    if (this.cookies.size) h.cookie = [...this.cookies].map(([k, v]) => k + '=' + v).join('; ');
    if (!h.origin) h.origin = base;
    let body;
    if (formData) {
      body = formData;
    } else if (form) {
      body = new URLSearchParams(form).toString();
      h['content-type'] = 'application/x-www-form-urlencoded';
    }
    const response = await fetch(base + path, { method, headers: h, body, redirect: 'manual' });
    const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    for (const line of setCookies) {
      const pair = line.split(';')[0];
      const at = pair.indexOf('=');
      const name = pair.slice(0, at);
      const value = decodeURIComponent(pair.slice(at + 1));
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
    return { status: response.status, location: response.headers.get('location') || '', text: await response.text() };
  }
}

const q = (sql, ...args) => app.db.prepare(sql).get(...args);
const all = (sql, ...args) => app.db.prepare(sql).all(...args);

before(async () => {
  app = await startServer({ dbPath, port: 0, host: '127.0.0.1' });
  base = app.url;
  createAdmin(app.db, 'admin@test.local', 'AdminPass123!');
});

after(async () => {
  if (app) await app.close();
  rmSync(dir, { recursive: true, force: true });
});

test('EZ-Bikes full flow', async t => {
  await t.test('public pages show the two named models and requested prices', async () => {
    const home = await new Client().request('/');
    assert.equal(home.status, 200);
    assert.match(home.text, /TURK 90/);
    assert.match(home.text, /HULK 101/);
    assert.match(home.text, /مشوارك بقى/);
    assert.match(home.text, /٢٤٬٠٠٠/);
    assert.match(home.text, /٣٥٬٠٠٠/);
    const products = all('SELECT id,price FROM products ORDER BY id');
    assert.deepEqual(products.map(p => p.price).sort((a, b) => a - b), [24000, 35000]);
    const turk = await new Client().request('/bike/turk-90');
    assert.equal(turk.status, 200);
    assert.match(turk.text, /كاوتش رفيع/);
    const hulk = await new Client().request('/bike/hulk-101');
    assert.equal(hulk.status, 200);
    assert.match(hulk.text, /كاوتش عريض/);
    const css = await new Client().request('/style.css');
    assert.equal(css.status, 200);
  });

  await t.test('admin area is blocked for anonymous and customers', async () => {
    assert.equal((await new Client().request('/admin')).status, 403);
  });

  await t.test('register referrer and buyer', async () => {
    referrer = new Client();
    const registered = await referrer.request('/register', {
      method: 'POST',
      form: { name: 'منى', email: 'mona@test.local', password: 'MonaPass123!', confirm: 'MonaPass123!' }
    });
    assert.equal(registered.status, 303);
    assert.equal(registered.location, '/account');
    const refUser = q('SELECT * FROM users WHERE email=?', 'mona@test.local');
    referrerCode = refUser.referral_code;
    const account = await referrer.request('/account');
    assert.equal(account.status, 200);
    assert.match(account.text, new RegExp(refUser.referral_code));
    assert.match(account.text, /الرصيد المتاح/);

    buyer = new Client();
    const buyerRegistered = await buyer.request('/register', {
      method: 'POST',
      form: { name: 'أحمد', email: 'ahmed@test.local', password: 'AhmedPass123!', confirm: 'AhmedPass123!' }
    });
    assert.equal(buyerRegistered.status, 303);
    assert.equal((await buyer.request('/admin')).status, 403);
  });

  await t.test('referral link attributes one direct order only', async () => {
    const visit = await buyer.request('/?ref=' + referrerCode);
    assert.equal(visit.status, 200);
    const buyPage = await buyer.request('/buy/turk-90');
    assert.equal(buyPage.status, 200);
    assert.match(buyPage.text, new RegExp(referrerCode));
    const placed = await buyer.request('/buy', {
      method: 'POST',
      form: { product: 'turk-90', phone: '01012345678', address: '١٢ شارع النيل، القاهرة', ref_code: '' }
    });
    assert.equal(placed.status, 303);
    assert.equal(placed.location, '/account?ok=order');
    const order = q('SELECT * FROM orders ORDER BY id DESC LIMIT 1');
    orderId = order.id;
    assert.equal(order.status, 'requested');
    assert.equal(order.price, 24000);
    assert.equal(order.ref_user_id, q('SELECT id FROM users WHERE email=?', 'mona@test.local').id);
    assert.equal(q('SELECT stock FROM products WHERE id=?', 'turk-90').stock, 4);
  });

  await t.test('referrer cannot see buyer identity', async () => {
    const account = await referrer.request('/account');
    assert.match(account.text, /#/);
    assert.doesNotMatch(account.text, /أحمد/);
    assert.doesNotMatch(account.text, /ahmed@test\.local/);
    assert.doesNotMatch(account.text, /01012345678/);
  });

  await t.test('admin login, order lifecycle, pending commission and approval', async () => {
    admin = new Client();
    const bad = await admin.request('/login', { method: 'POST', form: { email: 'admin@test.local', password: 'wrong-password' } });
    assert.equal(bad.status, 400);
    assert.match(bad.text, /البريد أو كلمة المرور/);
    const login = await admin.request('/login', { method: 'POST', form: { email: 'admin@test.local', password: 'AdminPass123!' } });
    assert.equal(login.status, 303);
    assert.equal(login.location, '/admin');
    const dashboard = await admin.request('/admin');
    assert.equal(dashboard.status, 200);
    assert.match(dashboard.text, /لوحة الإدارة/);

    for (const status of ['confirmed', 'paid', 'delivered', 'complete']) {
      const changed = await admin.request('/admin/order', { method: 'POST', form: { id: orderId, status, note: 'اختبار ' + status } });
      assert.equal(changed.status, 303, status);
    }
    const order = q('SELECT * FROM orders WHERE id=?', orderId);
    assert.equal(order.status, 'complete');
    const commission = q('SELECT * FROM commissions WHERE order_id=?', orderId);
    assert.ok(commission);
    assert.equal(commission.amount, 1000);
    assert.equal(commission.status, 'pending');
    const account = await referrer.request('/account');
    assert.match(account.text, /بانتظار الاعتماد/);

    const approved = await admin.request('/admin/commission', { method: 'POST', form: { id: commission.id } });
    assert.equal(approved.status, 303);
    assert.equal(q('SELECT status FROM commissions WHERE id=?', commission.id).status, 'approved');
    const accountAfter = await referrer.request('/account');
    assert.match(accountAfter.text, /١٬٠٠٠/);
  });

  await t.test('withdrawal reserves balance and rejection releases it', async () => {
    const requested = await referrer.request('/payout', {
      method: 'POST',
      form: { kind: 'cash', amount: '500', details: 'محفظة موبايل 01000000000' }
    });
    assert.equal(requested.status, 303);
    const payout = q('SELECT * FROM payouts ORDER BY id DESC LIMIT 1');
    assert.equal(payout.status, 'pending');
    assert.equal(payout.amount, 500);
    const account = await referrer.request('/account');
    assert.match(account.text, /٥٠٠/);
    const rejected = await admin.request('/admin/payout', { method: 'POST', form: { id: payout.id, status: 'rejected', note: 'اختبار رفض' } });
    assert.equal(rejected.status, 303);
    assert.equal(q('SELECT status FROM payouts WHERE id=?', payout.id).status, 'rejected');
    const accountAfter = await referrer.request('/account');
    assert.match(accountAfter.text, /١٬٠٠٠/);
  });

  await t.test('bike exchange is blocked when the balance is below the model price', async () => {
    const attempt = await referrer.request('/payout', {
      method: 'POST',
      form: { kind: 'bike', product_id: 'turk-90', details: 'القاهرة 01000000000' }
    });
    assert.equal(attempt.status, 400);
    assert.match(attempt.text, /الرصيد المتاح مش كافي/);
    assert.equal(q("SELECT COUNT(*) n FROM payouts WHERE kind='bike'").n, 0);
  });

  await t.test('return reverses commission and puts stock back', async () => {
    const changed = await admin.request('/admin/order', { method: 'POST', form: { id: orderId, status: 'returned', note: 'مرتجع اختبار' } });
    assert.equal(changed.status, 303);
    assert.equal(q('SELECT status FROM orders WHERE id=?', orderId).status, 'returned');
    assert.equal(q('SELECT status FROM commissions WHERE order_id=?', orderId).status, 'reversed');
    assert.equal(q('SELECT stock FROM products WHERE id=?', 'turk-90').stock, 5);
    const account = await referrer.request('/account');
    assert.match(account.text, /معكوس/);
  });

  await t.test('conversion request keeps internal cost away from the customer', async () => {
    const posted = await buyer.request('/convert', {
      method: 'POST',
      form: {
        bike_type: 'عجلة جبلية',
        size: '26 بوصة',
        area: 'الجيزة',
        phone: '01012345678',
        details: 'عجلة قديمة بحالة جيدة'
      }
    });
    assert.equal(posted.status, 303);
    const conversion = q('SELECT * FROM conversions ORDER BY id DESC LIMIT 1');
    conversionId = conversion.id;
    assert.equal(conversion.internal_cost, 9000);
    assert.equal(conversion.status, 'requested');

    const quoted = await admin.request('/admin/conversion', {
      method: 'POST',
      form: { id: conversionId, status: 'quoted', quote: '15000', note: 'عرض اختبار' }
    });
    assert.equal(quoted.status, 303);
    assert.equal(q('SELECT quote FROM conversions WHERE id=?', conversionId).quote, 15000);
    const account = await buyer.request('/account');
    assert.match(account.text, /١٥٬٠٠٠/);
    assert.doesNotMatch(account.text, /٩٬٠٠٠/);
    assert.doesNotMatch(account.text, /9000/);
  });

  await t.test('support ticket gets an admin reply', async () => {
    const posted = await buyer.request('/support', {
      method: 'POST',
      form: { phone: '01012345678', order_id: String(orderId), details: 'محتاج أعرف حالة الطلب' }
    });
    assert.equal(posted.status, 303);
    const ticket = q('SELECT * FROM tickets ORDER BY id DESC LIMIT 1');
    const replied = await admin.request('/admin/ticket', { method: 'POST', form: { id: ticket.id, reply: 'تم الرد على استفسارك' } });
    assert.equal(replied.status, 303);
    assert.equal(q('SELECT status FROM tickets WHERE id=?', ticket.id).status, 'answered');
    const account = await buyer.request('/account');
    assert.match(account.text, /تم الرد على استفسارك/);
  });

  await t.test('WhatsApp/guest order can use a referral code and be tracked by phone', async () => {
    const created = await admin.request('/admin/manual', {
      method: 'POST',
      form: {
        product: 'hulk-101', name: 'سارة', phone: '01100000000',
        email: '', address: '٥ شارع الهرم، الجيزة', ref_code: referrerCode
      }
    });
    assert.equal(created.status, 303);
    const guest = q('SELECT * FROM orders ORDER BY id DESC LIMIT 1');
    guestOrderId = guest.id;
    assert.equal(guest.user_id, null);
    assert.equal(guest.ref_user_id, q('SELECT id FROM users WHERE email=?', 'mona@test.local').id);
    assert.equal(q('SELECT stock FROM products WHERE id=?', 'hulk-101').stock, 4);

    const tracked = await new Client().request('/track', { method: 'POST', form: { order_id: String(guestOrderId), phone: '01100000000' } });
    assert.equal(tracked.status, 200);
    assert.match(tracked.text, /HULK 101/);
    assert.match(tracked.text, /قيد المراجعة/);
    const wrong = await new Client().request('/track', { method: 'POST', form: { order_id: String(guestOrderId), phone: '01299999999' } });
    assert.match(wrong.text, /مش لاقيين طلب/);

    for (const status of ['confirmed', 'paid', 'delivered', 'complete']) {
      assert.equal((await admin.request('/admin/order', { method: 'POST', form: { id: guestOrderId, status, note: '' } })).status, 303);
    }
    const commission = q('SELECT * FROM commissions WHERE order_id=?', guestOrderId);
    assert.equal(commission.status, 'pending');
    const account = await referrer.request('/account');
    assert.doesNotMatch(account.text, /سارة/);
    assert.doesNotMatch(account.text, /01100000000/);
  });

  await t.test('exchange at the model price reserves balance and decrements stock', async () => {
    // Test setup only: fund the existing reversed commission as approved to exercise the exchange path.
    app.db.prepare("UPDATE commissions SET status='approved', amount=25000, approved_at=? WHERE order_id=?").run(new Date().toISOString(), orderId);
    const requested = await referrer.request('/payout', {
      method: 'POST',
      form: { kind: 'bike', product_id: 'turk-90', details: 'القاهرة 01000000000' }
    });
    assert.equal(requested.status, 303);
    const payout = q("SELECT * FROM payouts WHERE kind='bike' ORDER BY id DESC LIMIT 1");
    assert.equal(payout.amount, 24000);
    assert.equal(payout.status, 'pending');
    const approved = await admin.request('/admin/payout', { method: 'POST', form: { id: payout.id, status: 'approved', note: 'تسليم يدوي' } });
    assert.equal(approved.status, 303);
    assert.equal(q('SELECT stock FROM products WHERE id=?', 'turk-90').stock, 4);
    const account = await referrer.request('/account');
    assert.match(account.text, /١٬٠٠٠/);
  });

  await t.test('self referral is rejected and cross-site POST is rejected', async () => {
    const code = q('SELECT referral_code FROM users WHERE email=?', 'ahmed@test.local').referral_code;
    const self = await buyer.request('/buy', {
      method: 'POST',
      form: { product: 'turk-90', phone: '01012345678', address: 'عنوان اختبار طويل', ref_code: code }
    });
    assert.equal(self.status, 400);
    assert.match(self.text, /مش مسموح/);
    const cross = await new Client().request('/login', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
      form: { email: 'ahmed@test.local', password: 'AhmedPass123!' }
    });
    assert.equal(cross.status, 403);
  });

  await t.test('admin can update price and stock, and the change appears on the store', async () => {
    const saved = await admin.request('/admin/product', {
      method: 'POST', form: { product: 'hulk-101', price: '36000', cost: '15000', stock: '7' }
    });
    assert.equal(saved.status, 303);
    assert.equal(q('SELECT price FROM products WHERE id=?', 'hulk-101').price, 36000);
    const shop = await new Client().request('/shop');
    assert.match(shop.text, /٣٦٬٠٠٠/);
  });
});
