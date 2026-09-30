export const TYPES = [
  "برنامج تدريبي",
  "دورة تدريبية قصيرة",
  "ورشة عمل",
  "محاضرة",
  "ملتقى / لقاء",
  "برنامج تنفيذي",
];

export const GCA_STATUS: [string, string][] = [
  ["بانتظار صدور أمر الشراء", "neutral"],
  ["قيد التنفيذ", "gold"],
  ["منجز", "ok"],
];

export const TR_STATUS: [string, string][] = [
  ["مرحلة الفرز والترشيح", "neutral"],
  ["بانتظار موافقة المدرب", "warn"],
  ["تم التعاقد", "info"],
];

export const TRAINER_STATUS: [string, string][] = [
  ["نشط", "ok"],
  ["غير متاح حاليًا", "warn"],
  ["موقوف", "bad"],
];

export const PAYMENT_STATUS: [string, string][] = [
  ["لم يُستحق بعد", "neutral"],
  ["قيد المراجعة", "warn"],
  ["معتمد للصرف", "info"],
  ["مصروف", "ok"],
  ["متأخر", "bad"],
];

// حالات الدفع الخاصة بأوامر الشراء في تبويب المدفوعات
export const PO_PAYMENT_STATUS: [string, string][] = [
  ["تم الطلب", "info"],
  ["معلق", "warn"],
  ["تم الدفع", "ok"],
];

// لون مميز لكل نوع برنامج في معرض البطاقات — يرمز للنوع بدل صورة حقيقية
export const TYPE_COLORS: Record<string, string> = {
  "ورشة عمل": "#0F5A30",
  "برنامج تدريبي": "#003C1A",
  "دورة تدريبية قصيرة": "#7A6238",
  "محاضرة": "#4A5E3F",
  "ملتقى / لقاء": "#8A6F44",
  "برنامج تنفيذي": "#5C4A2A",
};
export const DEFAULT_CARD_COLOR = "#003218";

// حسابان ثابتان فقط: مشاهدة وإدارة (لا يوجد تسجيل عام). أنشئهما في Supabase كما هو موضح في README.
export const VIEWER_EMAIL = "viewer@gca.local";
export const ADMIN_EMAIL = "admin@gca.local";

export const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
