// ثابت بيانات الموديلين. الأسعار والمخزون الفعليان في قاعدة البيانات.
export const CATALOG = {
  'turk-90': {
    name: 'TURK 90',
    kicker: 'الموديل الرياضي',
    image: 'turk-90.png',
    imageWidth: 1024,
    imageHeight: 688,
    detail: 'turk-90-detail.png',
    alt: 'دراجة EZ-Bike TURK 90 الكهربائية باللون الأسود',
    blurb: 'كاوتش رفيع وشاسيه رياضي وحامل خلفي.',
    highlights: ['كاوتش رفيع', 'شاسيه رياضي', 'حامل خلفي', 'فرامل قرصية'],
    initialPrice: 24000
  },
  'hulk-101': {
    name: 'HULK 101',
    kicker: 'كاوتش عريض',
    image: 'hulk-101.png',
    imageWidth: 1024,
    imageHeight: 700,
    detail: 'hulk-101-detail.png',
    alt: 'دراجة EZ-Bike HULK 101 الكهربائية بالكاوتش العريض',
    blurb: 'كاوتش عريض وكرسي طويل بتصميم أسود مطفي.',
    highlights: ['كاوتش عريض', 'شاسيه قوي', 'كرسي طويل', 'فرامل قرصية'],
    initialPrice: 35000
  }
};

export const PRODUCT_IDS = Object.keys(CATALOG);
