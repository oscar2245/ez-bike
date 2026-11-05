import { CATALOG } from './catalog.mjs';
import { STATUS, KIND, COMMISSION } from './workflow.mjs';

export const FLASH = {
  order: 'تم إرسال طلب الشراء. تقدر تتابعه من حسابك.',
  manual: 'تم تسجيل طلب واتساب.',
  convert: 'تم إرسال طلب التحويل. هنراجع الصور والبيانات.',
  support: 'تم إرسال الاستفسار.',
  payout: 'تم إرسال طلب المكافأة وحجز الرصيد.',
  product: 'تم حفظ بيانات الموديل.',
  status: 'تم تحديث الحالة.',
  commission: 'تم اعتماد العمولة.',
  payoutDecision: 'تم تحديث طلب المكافأة.',
  conversion: 'تم تحديث طلب التحويل.',
  reply: 'تم إرسال الرد.'
};

const esc = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => new Intl.NumberFormat('ar-EG').format(Number(n) || 0);
const money = n => num(n) + ' جنيه';
const date = iso => {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
};
const statusBadge = s => '<span class="status st-' + esc(s) + '">' + esc(STATUS[s] || s) + '</span>';
const button = (href, text, kind = '') => '<a class="btn ' + kind + '" href="' + esc(href) + '">' + esc(text) + '</a>';
const submit = (text, kind = 'btn-hot') => '<button class="btn ' + kind + '" type="submit">' + esc(text) + '</button>';
const hidden = (name, value) => '<input type="hidden" name="' + esc(name) + '" value="' + esc(value) + '">';
const form = (action, inner, attrs = '') => '<form action="' + esc(action) + '" method="post" ' + attrs + '>' + inner + '</form>';
const field = (label, name, type = 'text', attrs = 'required', value = '', hint = '') =>
  '<label class="field"><span>' + esc(label) + '</span><input name="' + esc(name) + '" type="' + esc(type) + '" ' + attrs + ' value="' + esc(value) + '">' + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</label>';
const area = (label, name, max = 600, attrs = 'required', value = '') =>
  '<label class="field"><span>' + esc(label) + '</span><textarea name="' + esc(name) + '" maxlength="' + max + '" ' + attrs + '>' + esc(value) + '</textarea></label>';
const selectField = (label, name, options, attrs = 'required') =>
  '<label class="field"><span>' + esc(label) + '</span><select name="' + esc(name) + '" ' + attrs + '>' + options + '</select></label>';
const option = (value, label, selected = false) => '<option value="' + esc(value) + '"' + (selected ? ' selected' : '') + '>' + esc(label) + '</option>';
const empty = text => '<p class="empty">' + esc(text) + '</p>';
const sectionHead = (eyebrow, heading, copy = '') =>
  '<div class="section-head"><div><span class="eyebrow">' + esc(eyebrow) + '</span><h2>' + esc(heading) + '</h2></div>' + (copy ? '<p>' + esc(copy) + '</p>' : '') + '</div>';

const zTrace = 'M 740 100 L 1170 80 L 780 420 L 1205 440';
const logo = (cls = '') => '<span class="brand-mark ' + cls + '"><img class="brand-logo" src="/assets/ez-bike-transparent.png" width="2170" height="725" alt="EZ bike — مشوارك بقى كهربا"><span class="z-shine" aria-hidden="true"><svg viewBox="0 0 2170 725" preserveAspectRatio="none" focusable="false"><path class="z-glow" pathLength="1" d="' + zTrace + '"/><path class="z-core" pathLength="1" d="' + zTrace + '"/></svg></span></span>';
const bikeImg = (id, cls = '', lazy = false) => {
  const p = CATALOG[id];
  return '<img class="' + cls + '" src="/assets/' + p.image + '" width="' + p.imageWidth + '" height="' + p.imageHeight + '" alt="' + esc(p.alt) + '"' + (lazy ? ' loading="lazy"' : '') + '>';
};
const detailImg = id => {
  const p = CATALOG[id];
  return '<img src="/assets/' + p.detail + '" alt="زاوية قريبة من ' + esc(p.name) + '" loading="lazy">';
};

function layout(body, data) {
  const { user, path, flash } = data;
  const nav = [
    ['/', 'الرئيسية', path === '/'],
    ['/shop', 'المتجر', path === '/shop'],
    ['/convert', 'حوّل عجلتك', path === '/convert'],
    ['/refer', 'رشّح واكسب', path === '/refer'],
    ['/support', 'الدعم', path === '/support']
  ];
  const accountHref = user ? (user.is_admin ? '/admin' : '/account') : '/login';
  const accountText = user ? (user.is_admin ? 'لوحة الإدارة' : 'حسابي') : 'دخول';
  return '<!doctype html><html lang="ar-EG" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#0a0d12"><meta name="description" content="EZ-Bikes — دراجات كهربائية سوداء، خدمة تحويل العجل، وبرنامج رشّح واكسب. مشوارك بقى كهربا."><title>' + esc(data.title || 'EZ-Bikes | مشوارك بقى كهربا') + '</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/style.css"><script src="/app.js" defer></script></head><body><a class="skip" href="#main">انتقل للمحتوى</a><div class="site-glow" aria-hidden="true"></div><header class="mast"><div class="wrap nav"><a class="brand" href="/" aria-label="EZ-Bikes — الرئيسية">' + logo() + '</a><nav class="links" aria-label="القائمة الرئيسية">' +
    nav.map(([href, text, active]) => '<a href="' + href + '"' + (active ? ' aria-current="page"' : '') + '>' + text + '</a>').join('') +
    '</nav><div class="nav-actions"><a class="btn btn-quiet btn-sm" href="/track">تتبّع طلب</a><a class="btn btn-cyan btn-sm" href="' + accountHref + '">' + accountText + '</a></div></div></header><main id="main">' +
    (flash ? '<div class="wrap"><div class="flash" role="status">' + esc(flash) + '</div></div>' : '') + body + '</main><footer class="foot"><div class="wrap foot-grid"><div class="foot-brand">' + logo('foot-logo') + '<p>عجل كهربائي، تحويل عجلتك، ومكافآت لمشاويرك.</p></div><div><h3>تسوّق</h3><a href="/shop">الموديلات</a><a href="/bike/turk-90">TURK 90</a><a href="/bike/hulk-101">HULK 101</a></div><div><h3>خدمات</h3><a href="/convert">حوّل عجلتك</a><a href="/refer">رشّح واكسب</a><a href="/support">الدعم والاستفسارات</a></div><div><h3>مهم تعرفه</h3><p>نسخة تجريبية محلية. التوصيل والدفع بالمراجعة اليدوية، ومفيش تحصيل أونلاين. الصور تصورات للمنتج.</p><a href="/track">تتبّع طلب برقمه والتليفون</a></div></div><div class="wrap foot-bottom"><span>© 2026 EZ-Bikes</span><span>مشوارك بقى كهربا.</span></div></footer></body></html>';
}

function modelCard(item) {
  const p = CATALOG[item.id];
  return '<article class="model-card"><a class="model-shot" href="/bike/' + item.id + '" aria-label="تفاصيل ' + esc(p.name) + '">' + bikeImg(item.id, 'model-img', true) + '<span class="model-kicker">' + esc(p.kicker) + '</span></a><div class="model-body"><h3>' + esc(p.name) + '</h3><p>' + esc(p.blurb) + '</p><ul class="chips">' + p.highlights.map(h => '<li>' + esc(h) + '</li>').join('') + '</ul><div class="model-foot"><div><span class="from">السعر</span><strong class="price">' + money(item.price) + '</strong></div>' + button('/bike/' + item.id, 'شوف التفاصيل', 'btn-cyan btn-sm') + '</div></div></article>';
}

function homepage(items) {
  const hero = items.find(i => i.id === 'turk-90') || items[0];
  return '<section class="hero"><div class="wrap hero-grid"><div class="hero-copy"><span class="eyebrow"><i class="pulse"></i> دراجات كهربائية · تحويل · مكافآت</span><h1>مشوارك بقى<br><span class="glow-text">كهربا.</span></h1><p class="lead">عجل أسود بتصميم رياضي أو كاوتش عريض، وخدمة تحويل لعجلتك القديمة. اختار اللي يناسبك وابعت طلبك، وإحنا نراجع معاك التفاصيل.</p><div class="actions">' + button('/shop', 'شوف الموديلات', 'btn-hot') + button('/convert', 'حوّل عجلتك', 'btn-cyan') + button('/refer', 'رشّح واكسب', 'btn-quiet') + '</div><div class="hero-stats"><div><strong>موديلين</strong><span>TURK 90 · HULK 101</span></div><div><strong>من ' + num(hero.price) + '</strong><span>جنيه</span></div><div><strong>' + num(COMMISSION) + '</strong><span>جنيه لكل إحالة مؤهلة</span></div></div></div><div class="hero-media"><div class="hero-halo" aria-hidden="true"></div>' + bikeImg(hero.id, 'hero-bike') + '<div class="hero-chip"><span>' + esc(CATALOG[hero.id].name) + '</span><b>' + money(hero.price) + '</b></div><span class="concept-tag">تصور للمنتج</span></div></div></section>' +
    '<section class="section wrap" id="models"><div class="section-head"><div><span class="eyebrow">المتجر</span><h2>اختار عجلتك</h2></div><p>موديلين كهربائيين بالأسود. الصور تصورات للمنتج، والمواصفات النهائية والتوفر بيتأكدوا قبل الطلب.</p></div><div class="model-grid">' + items.map(modelCard).join('') + '</div></section>' +
    '<section class="section wrap"><div class="section-head"><div><span class="eyebrow">إزاي تطلب</span><h2>من الاختيار للتسليم</h2></div><p>كل خطوة واضحة، والمراجعة النهائية للتوصيل والدفع بتحصل قبل التأكيد.</p></div><div class="steps"><article><span>01</span><h3>اختار الموديل</h3><p>شوف صور TURK 90 وHULK 101 والأسعار والمتاح.</p></article><article><span>02</span><h3>ابعت طلبك</h3><p>سجّل دخولك واكتب التليفون والعنوان. تقدر تضيف كود إحالة.</p></article><article><span>03</span><h3>راجع معانا</h3><p>الإدارة بتراجع الطلب وبتنسّق التوصيل وطريقة الدفع معاك.</p></article></div></section>' +
    '<section class="section wrap"><div class="feature-band"><div><span class="eyebrow">خدمة التحويل</span><h2>حوّل عجلتك لكهربا</h2><p>ابعت نوع العجلة ومقاسها والمنطقة وصور واضحة. هنراجعها ونجهّز لك عرض سعر، وتتابع الطلب من حسابك.</p><div class="actions">' + button('/convert', 'اطلب تقييم', 'btn-hot') + '</div></div><ul class="checklist"><li>استمارة بيانات وصور للعجلة</li><li>مراجعة وعرض سعر من الإدارة</li><li>متابعة الحالة من حسابك</li></ul></div></section>' +
    '<section class="section wrap"><div class="ref-band"><div><span class="eyebrow">برنامج الإحالة</span><h2>رشّح واكسب</h2><p>لكل عملية شراء مؤهلة ومكتملة من لينكك: ' + money(COMMISSION) + '. اسحب رصيدك أو استبدله بعجلة عند وصوله لسعر الموديل.</p></div>' + button('/refer', 'اعرف القواعد', 'btn-dark') + '</div></section>';
}

function shop(items) {
  return '<section class="page-head wrap"><span class="eyebrow">المتجر</span><h1>الموديلات</h1><p>موديلين كهربائيين. اختار اللي يناسب شكل مشوارك، وابعت طلبك للمراجعة.</p></section><section class="wrap"><div class="model-grid">' + items.map(modelCard).join('') + '</div><p class="concept-note">الصور تصورات للمنتج. المواصفات النهائية والتوفر والتوصيل بيتأكدوا معاك قبل تأكيد الطلب.</p></section>';
}

function productPage(item, data) {
  const p = CATALOG[item.id];
  const soldOut = item.stock < 1;
  const buy = data.user
    ? (soldOut ? '<span class="btn btn-disabled" aria-disabled="true">غير متاح للطلب حاليًا</span>' : button('/buy/' + item.id, 'اطلب العجلة', 'btn-hot btn-wide'))
    : button('/login?next=' + encodeURIComponent('/buy/' + item.id), 'سجّل دخول واطلب', 'btn-hot btn-wide');
  return '<section class="wrap product"><nav class="crumbs" aria-label="مسار الصفحة"><a href="/">الرئيسية</a><span>/</span><a href="/shop">المتجر</a><span>/</span><b>' + esc(p.name) + '</b></nav><div class="product-grid"><div class="product-gallery"><div class="main-shot">' + bikeImg(item.id, 'product-img') + '<span class="concept-tag">تصور للمنتج</span></div><figure class="angle-shot">' + detailImg(item.id) + '<figcaption>زاوية قريبة من الموديل</figcaption></figure></div><div class="product-info"><span class="eyebrow">' + esc(p.kicker) + '</span><h1>' + esc(p.name) + '</h1><p class="lead">' + esc(p.blurb) + '</p><div class="price-row"><strong class="big-price">' + money(item.price) + '</strong>' + (soldOut ? '<span class="status st-cancelled">غير متاح حاليًا</span>' : '<span class="status st-approved">متاح للطلب</span>') + '</div><ul class="specs">' + p.highlights.map(h => '<li><i aria-hidden="true"></i>' + esc(h) + '</li>').join('') + '</ul><div class="buy-box"><p>هنراجع التوصيل وطريقة الدفع معاك قبل التأكيد النهائي.</p>' + buy + '<small>مفيش دفع أونلاين في النسخة التجريبية.</small></div><div class="assurance"><div><b>مراجعة يدوية</b><span>قبل تأكيد التوصيل والدفع</span></div><div><b>بياناتك عندك</b><span>طلباتك وحالتها من حسابك</span></div></div></div></div><div class="spec-note"><b>ملاحظة:</b> الصور تصورات للمنتج. السرعة والمدى والضمان والتوصيل مش مواصفات معلنة هنا، وبيتأكدوا معاك قبل الطلب.</div></section>';
}

function buyPage(item, data) {
  const p = CATALOG[item.id];
  return '<section class="wrap narrow-page"><nav class="crumbs" aria-label="مسار الصفحة"><a href="/shop">المتجر</a><span>/</span><a href="/bike/' + item.id + '">' + esc(p.name) + '</a><span>/</span><b>طلب شراء</b></nav><div class="checkout-grid"><div class="panel order-summary"><span class="eyebrow">ملخص الطلب</span><div class="summary-product">' + bikeImg(item.id, 'summary-img', true) + '<h2>' + esc(p.name) + '</h2></div><div class="summary-row"><span>السعر</span><strong>' + money(item.price) + '</strong></div><div class="summary-row"><span>التوفر</span><b>' + (item.stock > 0 ? 'متاح' : 'غير متاح') + '</b></div><p class="muted">الإدارة بتراجع الطلب وبتتواصل معاك لتأكيد التوصيل وطريقة الدفع. مفيش تحصيل أونلاين في النسخة التجريبية.</p></div><div class="panel"><span class="eyebrow">بيانات الطلب</span><h1 class="h2">اطلب ' + esc(p.name) + '</h1>' + form('/buy', hidden('product', item.id) + field('رقم التليفون', 'phone', 'tel', 'required maxlength="32" autocomplete="tel"', data.user.phone || '', 'اكتب رقم تقدر نتصل بيه.') + area('عنوان التوصيل بالتفصيل', 'address', 500, 'required', '') + field('كود الإحالة (اختياري)', 'ref_code', 'text', 'maxlength="20"', data.refCode || '', 'لو جالك لينك من حد، الكود بيتسجل مع الطلب.') + submit('أرسل طلب الشراء', 'btn-hot btn-wide') + '<p class="fine">بالضغط على الإرسال، الطلب بيتسجل للمراجعة. مش دفع ولا تأكيد نهائي للتوصيل.</p>') + '</div></div></section>';
}

function referPage() {
  return '<section class="page-head wrap"><span class="eyebrow">برنامج الإحالة</span><h1>رشّح واكسب</h1><p>شارك لينكك. لكل شراء مؤهل ومكتمل، يضاف ' + money(COMMISSION) + ' لرصيدك بعد اعتماد الإدارة.</p></section><section class="wrap"><div class="steps four"><article><span>01</span><h3>سجّل حساب</h3><p>هيظهر لك كود ولينك إحالة شخصيين.</p></article><article><span>02</span><h3>شارك اللينك</h3><p>ابعته على واتساب أو أي مكان. الكود برضه ينفع يتكتب وقت الطلب.</p></article><article><span>03</span><h3>الطلب يكتمل</h3><p>بعد التحصيل والتسليم وانتهاء فترة الإرجاع، العمولة بتبقى مستحقة.</p></article><article><span>04</span><h3>اسحب أو استبدل</h3><p>اطلب سحب، أو استبدل رصيدك بعجلة عند وصوله لسعر الموديل.</p></article></div><div class="refer-grid"><article class="panel"><span class="eyebrow">القاعدة</span><h2>' + money(COMMISSION) + ' لكل شراء مؤهل</h2><ul class="rules"><li>العمولة بتتسجل لصاحب الكود لما الطلب يوصل لحالة «مكتمل» بعد التحصيل والتسليم وانتهاء فترة الإرجاع.</li><li>الإلغاء أو الإرجاع بيعكس العمولة، حتى لو كانت معتمدة.</li><li>الطلب الواحد بيتنسب لإحالة واحدة بس. آخر لينك إحالة تفتحه بيفضل صالح لمدة ٣٠ يوم، والكود المكتوب وقت الطلب له الأولوية على اللينك.</li><li>الإحالة للشراء المباشر من الموقع. طلبات التحويل وخدمة الدعم مش بتكسب عمولة.</li><li>الإدارة بتراجع وتعتد العمولات قبل ما تبقى قابلة للسحب أو الاستبدال.</li></ul></article><article class="panel"><span class="eyebrow">السحب والاستبدال</span><h2>رصيدك تحت تحكمك</h2><ul class="rules"><li>اطلب سحب أي مبلغ متاح من حسابك.</li><li>أو استبدل الرصيد بعجلة عند وصوله لسعر الموديل اللي تختاره: TURK 90 أو HULK 101.</li><li>الاستبدال بيحجز سعر الموديل من رصيدك. مفيش جمع بين سحب نقدي وعجلة من نفس الرصيد.</li><li>طلب السحب أو الاستبدال بيحجز المبلغ، ولو اترفض بيرجع للرصيد المتاح.</li></ul></article></div><article class="panel privacy"><span class="eyebrow">الخصوصية</span><h2>بيانات المشتري مش بتظهر لصاحب الإحالة</h2><p>صاحب الكود بيشوف رقم الطلب وحالته وقيمة العمولة بس. الاسم والتليفون والعنوان والبريد مش بيظهروا له.</p></article><div class="cta-row">' + button('/register', 'اعمل حساب وابدأ', 'btn-hot') + button('/login', 'عندي حساب', 'btn-cyan') + '</div><p class="fine">دي نسخة تجريبية محلية. قواعد العمولة مطبقة داخل النظام، لكن تحويل الأموال أو تسليم العجل بيتم يدويًا بعد المراجعة.</p></section>';
}

function convertPage(data) {
  const head = '<section class="page-head wrap"><span class="eyebrow">خدمة التحويل</span><h1>حوّل عجلتك لكهربا</h1><p>ابعت بيانات عجلتك وصورها. الإدارة بتراجع الطلب وترجع لك بعرض سعر، وتقدر تتابع الحالة من حسابك.</p></section>';
  if (!data.user) {
    return head + '<section class="wrap narrow-page"><div class="panel login-prompt"><h2>محتاج حساب الأول</h2><p>عشان نبعت لك عرض السعر وتتابع الطلب، سجّل حساب أو ادخل لحسابك.</p><div class="actions">' + button('/login?next=' + encodeURIComponent('/convert'), 'سجّل دخول', 'btn-hot') + button('/register?next=' + encodeURIComponent('/convert'), 'اعمل حساب', 'btn-cyan') + '</div></div></section>';
  }
  return head + '<section class="wrap narrow-page"><div class="panel">' + form('/convert', '<div class="form-grid">' + field('نوع العجلة', 'bike_type', 'text', 'required maxlength="80" placeholder="مثال: عجلة جبلية"') + field('مقاس العجلة', 'size', 'text', 'required maxlength="30" placeholder="مثال: 26 بوصة"') + field('المنطقة', 'area', 'text', 'required maxlength="100" placeholder="المدينة أو المنطقة"') + field('رقم التليفون', 'phone', 'tel', 'required maxlength="32" autocomplete="tel"') + '</div>' + area('تفاصيل إضافية (اختياري)', 'details', 1200, '', '') + '<label class="field file-field"><span>صور العجلة (حتى ٣ صور)</span><input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple><small>JPEG أو PNG أو WebP، بحد أقصى ٢ ميجا للصورة.</small></label>' + submit('أرسل طلب التحويل', 'btn-hot') + '<p class="fine">الصور بتستخدم لمراجعة العجلة فقط. مفيش سعر خدمة معلن قبل المراجعة.</p>', 'enctype="multipart/form-data"') + '</div></section>';
}

function supportPage(data) {
  const head = '<section class="page-head wrap"><span class="eyebrow">خدمة العملاء</span><h1>الدعم والاستفسارات</h1><p>عندك سؤال عن طلب أو خدمة؟ ابعت استفسارك وحدد رقم الطلب لو مرتبط بطلب.</p></section>';
  if (!data.user) {
    return head + '<section class="wrap narrow-page"><div class="panel login-prompt"><h2>سجّل دخولك الأول</h2><p>الاستفسارات مرتبطة بحسابك وطلباتك عشان نقدر نتابعها.</p><div class="actions">' + button('/login?next=' + encodeURIComponent('/support'), 'سجّل دخول', 'btn-hot') + '</div></div></section>';
  }
  const own = data.orders || [];
  const opts = option('', 'بدون طلب محدد') + own.map(o => option(o.id, '#' + o.id + ' · ' + CATALOG[o.product_id].name + ' · ' + (STATUS[o.status] || o.status))).join('');
  return head + '<section class="wrap narrow-page"><div class="panel">' + form('/support', '<div class="form-grid">' + field('رقم التليفون', 'phone', 'tel', 'required maxlength="32" autocomplete="tel"') + selectField('الطلب المرتبط (اختياري)', 'order_id', opts, '') + '</div>' + area('تفاصيل الاستفسار', 'details', 1200, 'required', '') + submit('أرسل الاستفسار', 'btn-hot') + '<p class="fine">مفيش وعود بمواعيد رد أو سياسات مش منشورة. فريق الإدارة بيراجع الرسائل من لوحة الإدارة.</p>') + '</div></section>';
}

function authPage(data, register) {
  const next = data.next ? hidden('next', data.next) : '';
  const title = register ? 'اعمل حسابك' : 'أهلًا بيك';
  return '<section class="auth"><div class="auth-card"><div class="auth-brand">' + logo() + '</div><span class="eyebrow">حساب EZ-Bikes</span><h1>' + title + '</h1><p class="muted">' + (register ? 'حساب واحد يتابع طلبات الشراء والتحويل والإحالات والمكافآت.' : 'ادخل عشان تتابع طلباتك ورصيدك.') + '</p>' + form(register ? '/register' : '/login', next + (register ? field('الاسم', 'name', 'text', 'required maxlength="80" autocomplete="name"') : '') + field('البريد الإلكتروني', 'email', 'email', 'required maxlength="160" autocomplete="email"') + field('كلمة المرور', 'password', 'password', 'required minlength="10" maxlength="128" autocomplete="' + (register ? 'new-password' : 'current-password') + '"') + (register ? field('تأكيد كلمة المرور', 'confirm', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"') : '') + submit(register ? 'سجّل حسابك' : 'سجّل الدخول', 'btn-hot btn-wide')) + '<div class="auth-alt">' + (register ? 'عندك حساب؟ <a href="/login' + (data.next ? '?next=' + encodeURIComponent(data.next) : '') + '">ادخل</a>' : 'لسه معندكش حساب؟ <a href="/register' + (data.next ? '?next=' + encodeURIComponent(data.next) : '') + '">اعمل حساب</a>') + '</div><p class="fine">كلمة المرور لازم ١٠ حروف على الأقل.</p></div></section>';
}

function orderTimeline(events) {
  if (!events || !events.length) return '';
  return '<ol class="timeline">' + events.map(e => '<li><i aria-hidden="true"></i><div><b>' + esc(STATUS[e.status] || e.status) + '</b><span>' + date(e.created_at) + '</span>' + (e.note ? '<p>' + esc(e.note) + '</p>' : '') + '</div></li>').join('') + '</ol>';
}

function orderRecord(o) {
  const p = CATALOG[o.product_id];
  return '<details class="record"><summary><div class="record-main"><strong>#' + num(o.id) + ' · ' + esc(p.name) + '</strong><span>' + date(o.created_at) + '</span></div><div class="record-side"><strong class="price">' + money(o.price) + '</strong>' + statusBadge(o.status) + '</div></summary><div class="record-body"><p><b>العنوان:</b> ' + esc(o.address) + '</p>' + (o.ref_code ? '<p><b>كود الإحالة:</b> <span dir="ltr">' + esc(o.ref_code) + '</span></p>' : '') + (o.note ? '<p class="admin-note">' + esc(o.note) + '</p>' : '') + orderTimeline(o.events) + '</div></details>';
}

function accountPage(data) {
  const { user, wallet, orders, conversions, commissions, payouts, tickets, refLink, items } = data;
  const minPrice = Math.min(...items.map(i => i.price));
  const target = Math.max(0, Math.min(wallet.available, minPrice));
  const remaining = Math.max(0, minPrice - wallet.available);
  const progress = '<progress class="bar" max="' + minPrice + '" value="' + target + '">' + num(target) + '</progress>';
  const walletCard = '<article class="panel wallet"><span class="eyebrow">الرصيد المتاح</span><strong class="wallet-amount">' + money(wallet.available) + '</strong><p>عمولات بانتظار الاعتماد: <b>' + money(wallet.pending) + '</b></p>' + progress + '<p class="muted">' + (wallet.available >= minPrice ? 'رصيدك يغطي TURK 90. تقدر تطلب استبدال من تحت.' : 'متبقي ' + money(remaining) + ' لاستبدال رصيدك بعجلة TURK 90.') + '</p>' + (wallet.available < 0 ? '<p class="alert">الرصيد سالب بسبب إرجاع طلب بعد صرف عمولة. طلبات السحب والاستبدال متوقفة لحد ما الرصيد يتعافى.</p>' : '') + '</article>';
  const share = '<article class="panel share"><span class="eyebrow">رابط الإحالة</span><h2>شارك واكسب</h2><div class="copy-row"><input id="refLink" dir="ltr" readonly value="' + esc(refLink) + '"><button class="btn btn-cyan btn-sm" type="button" data-copy="refLink">نسخ</button></div><p>كودك: <b dir="ltr">' + esc(user.referral_code) + '</b></p><div class="actions">' + button('https://wa.me/?text=' + encodeURIComponent('شوف EZ-Bikes واختار عجلتك: ' + refLink), 'مشاركة على واتساب', 'btn-quiet btn-sm') + '</div></article>';

  const orderList = orders.length ? orders.map(orderRecord).join('') : empty('لسه مفيش طلبات شراء.');
  const convList = conversions.length ? conversions.map(c => '<details class="record"><summary><div class="record-main"><strong>طلب تحويل #' + num(c.id) + '</strong><span>' + date(c.created_at) + '</span></div><div class="record-side">' + (c.quote ? '<strong class="price">' + money(c.quote) + '</strong>' : '') + statusBadge(c.status) + '</div></summary><div class="record-body"><p><b>العجلة:</b> ' + esc(c.bike_type) + ' · ' + esc(c.size) + ' · ' + esc(c.area) + '</p>' + (c.details ? '<p>' + esc(c.details) + '</p>' : '') + (c.note ? '<p class="admin-note">' + esc(c.note) + '</p>' : '') + '</div></details>').join('') : empty('لسه مفيش طلبات تحويل.');
  const commList = commissions.length ? '<ul class="rows">' + commissions.map(c => '<li><div><b>طلب #' + num(c.order_id) + '</b><span>' + date(c.created_at) + '</span></div><div><strong>' + money(c.amount) + '</strong>' + statusBadge(c.status) + '</div></li>').join('') + '</ul>' : empty('لسه مفيش عمولات.');
  const payoutList = payouts.length ? '<ul class="rows">' + payouts.map(p => '<li><div><b>' + esc(KIND[p.kind] || p.kind) + ' · ' + money(p.amount) + '</b><span>' + date(p.created_at) + (p.product_id ? ' · ' + esc(CATALOG[p.product_id]?.name || '') : '') + '</span>' + (p.details ? '<small>' + esc(p.details) + '</small>' : '') + (p.note ? '<small class="admin-note">' + esc(p.note) + '</small>' : '') + '</div><div>' + statusBadge(p.status) + '</div></li>').join('') + '</ul>' : empty('لسه مفيش طلبات مكافآت.');
  const ticketList = tickets.length ? '<ul class="rows tickets">' + tickets.map(t => '<li><div><b>استفسار #' + num(t.id) + (t.order_id ? ' · طلب #' + num(t.order_id) : '') + '</b><span>' + date(t.created_at) + '</span><p>' + esc(t.details) + '</p>' + (t.reply ? '<p class="reply"><b>الرد:</b> ' + esc(t.reply) + '</p>' : '') + '</div><div>' + statusBadge(t.status) + '</div></li>').join('') + '</ul>' : empty('لسه مفيش استفسارات.');

  const canWithdraw = wallet.available > 0;
  const withdraw = '<article class="panel"><h2>طلب سحب</h2>' + (canWithdraw ? form('/payout', hidden('kind', 'cash') + field('المبلغ بالجنيه', 'amount', 'number', 'required min="1" max="' + Math.floor(wallet.available) + '"', '') + field('وسيلة الاستلام ورقمها', 'details', 'text', 'required maxlength="300"', '', 'مثال: محفظة موبايل ورقمها.') + submit('اطلب السحب', 'btn-cyan btn-wide') + '<p class="fine">المبلغ بيتحجز لحد المراجعة. لو اترفض بيرجع للرصيد المتاح.</p>') : '<p class="muted">مفيش رصيد متاح للسحب حاليًا.</p>') + '</article>';
  const exchangeOpts = items.map(i => option(i.id, CATALOG[i.id].name + ' · ' + money(i.price))).join('');
  const exchange = '<article class="panel"><h2>استبدال بعجلة</h2>' + (wallet.available >= minPrice ? form('/payout', hidden('kind', 'bike') + selectField('الموديل', 'product_id', exchangeOpts) + field('بيانات الاستلام', 'details', 'text', 'required maxlength="300"', '', 'المنطقة ورقم التليفون.') + submit('اطلب الاستبدال', 'btn-hot btn-wide') + '<p class="fine">هيتم حجز سعر الموديل من رصيدك. مفيش جمع بين السحب النقدي والعجلة من نفس الرصيد.</p>') : '<p class="muted">الاستبدال متاح عند وصول رصيدك لسعر الموديل. أرخص موديل ' + money(minPrice) + '.</p>') + '</article>';

  return '<section class="wrap dashboard"><header class="dash-head"><div><span class="eyebrow">حساب العميل</span><h1>أهلًا، ' + esc(user.name) + '</h1><p>' + esc(user.email) + '</p></div>' + form('/logout', '<button class="btn btn-quiet btn-sm" type="submit">تسجيل الخروج</button>') + '</header><div class="wallet-grid">' + walletCard + share + '</div><div class="account-grid"><section class="panel"><h2>طلبات الشراء</h2>' + orderList + '</section><aside class="stack">' + withdraw + exchange + '</aside></div><div class="account-grid"><section class="panel"><h2>الإحالات والعمولات</h2>' + commList + '<p class="muted small">رقم الطلب والحالة والعمولة بس. بيانات المشتري مش بتظهر هنا.</p></section><section class="panel"><h2>طلبات التحويل</h2>' + convList + '</section></div><div class="account-grid"><section class="panel"><h2>استفسارات الدعم</h2>' + ticketList + '</section><section class="panel"><h2>طلبات المكافآت</h2>' + payoutList + '</section></div></section>';
}

function adminOrderCard(o) {
  const p = CATALOG[o.product_id];
  const next = o.next || [];
  const change = next.length ? form('/admin/order', hidden('id', o.id) + selectField('الحالة التالية', 'status', next.map(s => option(s, STATUS[s] || s)).join('')) + field('ملاحظة تظهر للعميل (اختياري)', 'note', 'text', 'maxlength="500"', '') + submit('حدّث الطلب', 'btn-cyan btn-sm') + '<p class="fine">عند «مكتمل» بتتسجل عمولة الإحالة بانتظار الاعتماد. عند «ملغي» أو «مرتجع» الوحدة بترجع للمخزون والعمولة بتتعكس.</p>') : '<p class="muted small">مفيش خطوة تالية متاحة.</p>';
  return '<article class="panel admin-card"><div class="card-head"><div><strong>#' + num(o.id) + ' · ' + esc(p.name) + '</strong><span>' + date(o.created_at) + '</span></div>' + statusBadge(o.status) + '</div><div class="admin-meta"><span><b>العميل:</b> ' + esc(o.customer_name) + (o.email ? ' · ' + esc(o.email) : ' · طلب واتساب/زائر') + '</span><span><b>التليفون:</b> <span dir="ltr">' + esc(o.phone) + '</span></span><span><b>العنوان:</b> ' + esc(o.address) + '</span><span><b>السعر:</b> ' + money(o.price) + ' · <b>التكلفة:</b> ' + money(o.cost) + '</span>' + (o.ref_code ? '<span><b>إحالة:</b> ' + esc(o.ref_code) + '</span>' : '') + (o.note ? '<span><b>آخر ملاحظة:</b> ' + esc(o.note) + '</span>' : '') + '</div>' + orderTimeline(o.events) + change + '</article>';
}

function adminPage(data) {
  const { user, products, orders, commissions, payouts, conversions, tickets, metrics } = data;
  const productForms = products.map(i => '<article class="panel product-admin"><h3>' + esc(CATALOG[i.id].name) + '</h3><p class="muted small">التكلفة الداخلية الافتراضية ' + money(i.cost) + ' للوحدة.</p>' + form('/admin/product', hidden('product', i.id) + '<div class="form-grid three">' + field('السعر', 'price', 'number', 'required min="1" max="10000000"', i.price) + field('التكلفة الداخلية', 'cost', 'number', 'required min="0" max="10000000"', i.cost) + field('المخزون', 'stock', 'number', 'required min="0" max="100000"', i.stock) + '</div>' + submit('احفظ', 'btn-cyan btn-sm')) + '</article>').join('');
  const pendingCommissions = commissions.filter(c => c.status === 'pending');
  const commCards = pendingCommissions.length ? pendingCommissions.map(c => '<article class="panel admin-card"><div class="card-head"><div><strong>عمولة طلب #' + num(c.order_id) + '</strong><span>' + date(c.created_at) + '</span></div>' + statusBadge(c.status) + '</div><div class="admin-meta"><span><b>صاحب الإحالة:</b> ' + esc(c.referrer_name) + ' · ' + esc(c.referrer_email) + '</span><span><b>الكود:</b> ' + esc(c.referrer_code) + '</span><span><b>القيمة:</b> ' + money(c.amount) + '</span></div>' + form('/admin/commission', hidden('id', c.id) + submit('اعتمد العمولة', 'btn-hot btn-sm')) + '</article>').join('') : empty('مفيش عمولات بانتظار الاعتماد.');
  const commHistory = commissions.length ? '<ul class="rows">' + commissions.map(c => '<li><div><b>طلب #' + num(c.order_id) + ' · ' + esc(c.referrer_name || '') + '</b><span>' + date(c.created_at) + '</span></div><div><strong>' + money(c.amount) + '</strong>' + statusBadge(c.status) + '</div></li>').join('') + '</ul>' : empty('لسه مفيش عمولات.');
  const payoutCards = payouts.length ? payouts.map(p => {
    const pending = p.status === 'pending';
    return '<article class="panel admin-card"><div class="card-head"><div><strong>' + esc(KIND[p.kind] || p.kind) + ' · ' + money(p.amount) + '</strong><span>' + date(p.created_at) + '</span></div>' + statusBadge(p.status) + '</div><div class="admin-meta"><span><b>العميل:</b> ' + esc(p.customer_name) + ' · ' + esc(p.email) + '</span>' + (p.product_id ? '<span><b>الموديل:</b> ' + esc(CATALOG[p.product_id]?.name || p.product_id) + '</span>' : '') + '<span><b>بيانات الاستلام:</b> ' + esc(p.details) + '</span>' + (p.note ? '<span><b>ملاحظة:</b> ' + esc(p.note) + '</span>' : '') + '</div>' + (pending ? form('/admin/payout', hidden('id', p.id) + selectField('القرار', 'status', option('approved', p.kind === 'bike' ? 'تم التسليم يدويًا' : 'تم الصرف يدويًا') + option('rejected', 'رفض وإرجاع الرصيد')) + field('ملاحظة (اختياري)', 'note', 'text', 'maxlength="300"', '') + submit('احفظ القرار', 'btn-cyan btn-sm') + (p.kind === 'bike' ? '<p class="fine">عند الموافقة على الاستبدال بيتخصم مخزون الموديل. تأكد إنه متاح.</p>' : '')) : '') + '</article>';
  }).join('') : empty('مفيش طلبات مكافآت.');
  const convCards = conversions.length ? conversions.map(c => {
    const next = c.next || [];
    const quoteForm = next.length ? form('/admin/conversion', hidden('id', c.id) + selectField('الحالة التالية', 'status', next.map(s => option(s, STATUS[s] || s)).join('')) + (next.includes('quoted') ? field('عرض السعر بالجنيه (مطلوب عند إرسال العرض)', 'quote', 'number', 'min="1" max="10000000"', c.quote || '') : '') + field('ملاحظة تظهر للعميل (اختياري)', 'note', 'text', 'maxlength="500"', c.note || '') + submit('حدّث التحويل', 'btn-cyan btn-sm')) : '<p class="muted small">مفيش خطوة تالية.</p>';
    return '<article class="panel admin-card"><div class="card-head"><div><strong>تحويل #' + num(c.id) + ' · ' + esc(c.bike_type) + ' · ' + esc(c.size) + '</strong><span>' + date(c.created_at) + '</span></div>' + statusBadge(c.status) + '</div><div class="admin-meta"><span><b>العميل:</b> ' + esc(c.customer_name) + ' · ' + esc(c.email) + ' · <span dir="ltr">' + esc(c.phone) + '</span></span><span><b>المنطقة:</b> ' + esc(c.area) + '</span>' + (c.details ? '<span><b>تفاصيل:</b> ' + esc(c.details) + '</span>' : '') + '<span><b>التكلفة الداخلية المفترضة:</b> ' + money(c.internal_cost) + (c.quote ? ' · <b>العرض:</b> ' + money(c.quote) + ' · <b>الفرق قبل المصاريف:</b> ' + money(c.quote - c.internal_cost) : '') + '</span>' + (c.note ? '<span><b>ملاحظة:</b> ' + esc(c.note) + '</span>' : '') + (c.photos?.length ? '<span class="photos">' + c.photos.map(id => '<a class="btn btn-quiet btn-xs" href="/photo/' + id + '" target="_blank" rel="noopener">صورة</a>').join('') + '</span>' : '') + '</div>' + quoteForm + '</article>';
  }).join('') : empty('مفيش طلبات تحويل.');
  const ticketCards = tickets.length ? tickets.map(t => '<article class="panel admin-card"><div class="card-head"><div><strong>استفسار #' + num(t.id) + (t.order_id ? ' · طلب #' + num(t.order_id) : '') + '</strong><span>' + date(t.created_at) + '</span></div>' + statusBadge(t.status) + '</div><div class="admin-meta"><span><b>العميل:</b> ' + esc(t.customer_name) + ' · ' + esc(t.email) + ' · <span dir="ltr">' + esc(t.phone) + '</span></span><span><b>الرسالة:</b> ' + esc(t.details) + '</span>' + (t.reply ? '<span><b>الرد الحالي:</b> ' + esc(t.reply) + '</span>' : '') + '</div>' + form('/admin/ticket', hidden('id', t.id) + field('الرد', 'reply', 'text', 'required maxlength="1200"', t.reply || '') + submit('أرسل الرد', 'btn-cyan btn-sm')) + '</article>').join('') : empty('مفيش استفسارات.');

  return '<section class="wrap dashboard admin"><header class="dash-head"><div><span class="eyebrow">لوحة الإدارة</span><h1>إدارة EZ-Bikes</h1><p>' + esc(user.email) + '</p></div><div class="actions">' + button('/admin/manual', 'سجّل طلب واتساب', 'btn-cyan btn-sm') + form('/logout', '<button class="btn btn-quiet btn-sm" type="submit">خروج</button>') + '</div></header><div class="metrics"><article><span>مبيعات مكتملة</span><strong>' + num(metrics.salesCount) + ' طلب</strong><small>' + money(metrics.revenue) + '</small></article><article><span>المتبقي التقديري</span><strong>' + money(metrics.contribution) + '</strong><small>بعد تكلفة العجل والعمولات. قبل أي مصاريف أخرى وليس صافي ربح.</small></article><article><span>عمولات بانتظار الاعتماد</span><strong>' + money(metrics.pendingCommissions) + '</strong><small>' + num(metrics.pendingCommissionCount) + ' عمولة</small></article><article><span>طلبات مكافآت معلقة</span><strong>' + num(metrics.pendingPayouts) + '</strong><small>سحب أو استبدال</small></article></div><nav class="admin-nav" aria-label="أقسام الإدارة"><a href="#orders">الطلبات</a><a href="#products">الموديلات والمخزون</a><a href="#commissions">العمولات</a><a href="#payouts">المكافآت</a><a href="#conversions">التحويل</a><a href="#tickets">الدعم</a></nav><section id="orders" class="admin-section"><h2>الطلبات</h2>' + (orders.length ? orders.map(adminOrderCard).join('') : empty('مفيش طلبات.')) + '</section><section id="products" class="admin-section"><h2>الموديلات والمخزون</h2><div class="product-admin-grid">' + productForms + '</div></section><section id="commissions" class="admin-section"><h2>العمولات</h2><h3>بانتظار الاعتماد</h3>' + commCards + '<h3>السجل</h3>' + commHistory + '</section><section id="payouts" class="admin-section"><h2>طلبات المكافآت</h2>' + payoutCards + '</section><section id="conversions" class="admin-section"><h2>طلبات التحويل</h2>' + convCards + '</section><section id="tickets" class="admin-section"><h2>الدعم والاستفسارات</h2>' + ticketCards + '</section></section>';
}

function manualPage(data) {
  const opts = data.items.map(i => option(i.id, CATALOG[i.id].name + ' · ' + money(i.price) + ' · متاح ' + i.stock)).join('');
  return '<section class="wrap narrow-page"><nav class="crumbs"><a href="/admin">لوحة الإدارة</a><span>/</span><b>طلب واتساب</b></nav><div class="panel"><span class="eyebrow">إدخال يدوي</span><h1 class="h2">سجّل طلب من واتساب</h1><p class="muted">لو المشتري عنده حساب، اكتب بريده عشان الطلب يظهر في حسابه. لو مش عنده، سيب البريد فاضي وسجّل الاسم والتليفون — الطلب يبقى طلب زائر ويتابع برقمه والتليفون من صفحة التتبع.</p>' + form('/admin/manual', selectField('الموديل', 'product', opts) + '<div class="form-grid">' + field('اسم المشتري', 'name', 'text', 'required maxlength="80"') + field('رقم التليفون', 'phone', 'tel', 'required maxlength="32"') + '</div>' + field('بريد حساب المشتري (اختياري)', 'email', 'email', 'maxlength="160"', '', 'لو موجود، الطلب هيتنسب للحساب.') + area('عنوان التوصيل', 'address', 500, 'required', '') + field('كود الإحالة (اختياري)', 'ref_code', 'text', 'maxlength="20"', '') + submit('سجّل الطلب', 'btn-hot') + '<p class="fine">المخزون بيتخصم فور التسجيل. راجع الكود قبل الحفظ. بيانات المشتري مش بتظهر لصاحب الإحالة.</p>') + '</div></section>';
}

function tracksPage(data) {
  const result = data.tracked ? '<article class="panel track-result"><div class="card-head"><div><strong>طلب #' + num(data.tracked.id) + ' · ' + esc(CATALOG[data.tracked.product_id].name) + '</strong><span>' + date(data.tracked.created_at) + '</span></div>' + statusBadge(data.tracked.status) + '</div><p><b>السعر:</b> ' + money(data.tracked.price) + '</p>' + (data.tracked.note ? '<p class="admin-note">' + esc(data.tracked.note) + '</p>' : '') + orderTimeline(data.tracked.events) + '</article>' : '';
  const error = data.trackError ? '<p class="alert">' + esc(data.trackError) + '</p>' : '';
  return '<section class="page-head wrap"><span class="eyebrow">تتبع الطلب</span><h1>تتبّع طلبك</h1><p>اكتب رقم الطلب ورقم التليفون اللي اتسجل بيه. لو عندك حساب، الطلبات كلها ظاهرة من حسابك.</p></section><section class="wrap narrow-page">' + result + '<div class="panel">' + error + form('/track', '<div class="form-grid">' + field('رقم الطلب', 'order_id', 'number', 'required min="1"') + field('رقم التليفون', 'phone', 'tel', 'required maxlength="32"') + '</div>' + submit('اعرض حالة الطلب', 'btn-cyan')) + '<p class="fine">رقم الطلب والتليفون لازم يطابقوا. بيانات العنوان مش بتظهر في صفحة التتبع.</p></div></section>';
}

function errorPage(data) {
  return '<section class="wrap error-page"><span class="eyebrow">' + (data.code === 404 ? 'صفحة غير موجودة' : 'راجع البيانات') + '</span><h1>' + esc(data.heading || 'مش قادرين نكمل') + '</h1><p>' + esc(data.message || 'حصل خطأ. جرّب تاني.') + '</p><div class="actions">' + (data.back ? button(data.back, 'ارجع للصفحة', 'btn-cyan') : '') + button('/', 'الرئيسية', 'btn-quiet') + '</div></section>';
}

export function render(path, data = {}) {
  const items = data.items || [];
  let body;
  if (path === '/') body = homepage(items);
  else if (path === '/shop') body = shop(items);
  else if (path === '/refer') body = referPage();
  else if (path === '/convert') body = convertPage(data);
  else if (path === '/support') body = supportPage(data);
  else if (path === '/login') body = authPage(data, false);
  else if (path === '/register') body = authPage(data, true);
  else if (path === '/account') body = accountPage(data);
  else if (path === '/admin') body = adminPage(data);
  else if (path === '/admin/manual') body = manualPage(data);
  else if (path === '/track') body = tracksPage(data);
  else if (path === '/error') body = errorPage(data);
  else if (path.startsWith('/bike/')) {
    const item = items.find(i => i.id === path.slice(6));
    if (item) body = productPage(item, data);
  } else if (path.startsWith('/buy/')) {
    const item = items.find(i => i.id === path.slice(5));
    if (item) body = buyPage(item, data);
  }
  return body ? layout(body, { ...data, path }) : null;
}
