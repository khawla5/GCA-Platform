export const TYPES = [
  "برنامج تدريبي قصير",
  "برنامج Nano Degree",
  "برنامج زمالة",
  "ورشة عمل",
  "محاضرة",
  "ندوة",
  "برنامج تنفيذي",
];

export const GCA_STATUS: [string, string][] = [
  ["بانتظار صدور أمر الشراء", "gca-pending"],
  ["قيد التنفيذ", "gca-progress"],
  ["منجز", "gca-done"],
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
  ["تم الطلب", "info"],
  ["معلقة", "warn"],
  ["تم الدفع", "ok"],
];

// حالات الدفع الخاصة بأوامر الشراء في تبويب المدفوعات
export const PO_PAYMENT_STATUS: [string, string][] = [
  ["تم الطلب", "info"],
  ["معلق", "warn"],
  ["تم الدفع", "ok"],
];

// خيارات ترتيب الدفعة (تُستخدم في نموذج دفعات البرنامج ونموذج أمر الشراء)
export const DUE_PORTION_OPTIONS = ["الدفعة الأولى", "الدفعة الثانية", "الدفعة الثالثة", "الدفعة الرابعة"];

// لون مميز لكل نوع برنامج في معرض البطاقات — يرمز للنوع بدل صورة حقيقية
export const TYPE_COLORS: Record<string, string> = {
  "برنامج تدريبي قصير": "#003C1A",
  "برنامج Nano Degree": "#7A6238",
  "برنامج زمالة": "#0F5A30",
  "ورشة عمل": "#4A5E3F",
  "محاضرة": "#8A6F44",
  "ندوة": "#6B7D52",
  "برنامج تنفيذي": "#5C4A2A",
};
export const DEFAULT_CARD_COLOR = "#003218";

// لون بطاقة البرنامج في معرض البرامج التدريبية — مبني على الحالة مع الديوان بدل النوع
export const STATUS_CARD_COLORS: Record<string, string> = {
  "بانتظار صدور أمر الشراء": "#0B2B09",
  "قيد التنفيذ": "#324A31",
  "منجز": "#7A6238",
};

// ألوان بطاقات أوامر الشراء في قسم المدفوعات حسب حالة السداد
export const PAYMENT_CARD_COLOR = "#324A31"; // لم يُدفع منها شيء بعد
export const PAYMENT_CARD_PARTIAL_COLOR = "#C9B58A"; // دُفع جزء وباقي دفعات
export const PAYMENT_CARD_DONE_COLOR = "#7A6238"; // اكتمل سداد كل الدفعات
export const PAYMENT_CARD_WAITING_COLOR = "#B7CDB0"; // أخضر فاتح: بانتظار صدور أمر الشراء

// حسابان ثابتان فقط: مشاهدة وإدارة (لا يوجد تسجيل عام). أنشئهما في Supabase كما هو موضح في README.
export const VIEWER_EMAIL = "viewer@gca.local";
export const ADMIN_EMAIL = "admin@yaaseer.sa";

export const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
