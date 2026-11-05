export const COMMISSION = 1000;
export const CONVERSION_COST = 9000;

export const ORDER_NEXT = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['paid', 'cancelled'],
  paid: ['delivered', 'cancelled'],
  delivered: ['complete', 'returned'],
  complete: ['returned'],
  cancelled: [],
  returned: []
};

export const CONVERSION_NEXT = {
  requested: ['quoted', 'cancelled'],
  quoted: ['scheduled', 'cancelled'],
  scheduled: ['complete', 'cancelled'],
  complete: [],
  cancelled: []
};

export const STATUS = {
  requested: 'قيد المراجعة',
  confirmed: 'تم تأكيد الطلب',
  paid: 'تم التحصيل',
  delivered: 'تم التسليم',
  complete: 'مكتمل',
  cancelled: 'ملغي',
  returned: 'مرتجع',
  quoted: 'تم إرسال العرض',
  scheduled: 'تم تحديد الموعد',
  answered: 'تم الرد',
  pending: 'بانتظار الاعتماد',
  approved: 'مستحقة',
  rejected: 'مرفوض',
  reversed: 'معكوس'
};

export const KIND = {
  cash: 'سحب نقدي',
  bike: 'استبدال بعجلة',
  buy: 'شراء',
  convert: 'تحويل',
  support: 'دعم'
};
