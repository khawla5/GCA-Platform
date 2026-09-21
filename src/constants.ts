export const TYPES = [
  "برنامج تدريبي",
  "دورة تدريبية قصيرة",
  "ورشة عمل",
  "محاضرة",
  "ملتقى / لقاء",
  "برنامج تنفيذي",
];

export const GCA_STATUS: [string, string][] = [
  ["مقترح", "neutral"],
  ["بانتظار اعتماد الديوان", "warn"],
  ["معتمد", "info"],
  ["قيد التنفيذ", "gold"],
  ["منفَّذ", "ok"],
  ["مؤجَّل", "warn"],
  ["ملغى", "bad"],
];

export const TR_STATUS: [string, string][] = [
  ["تم الترشيح", "neutral"],
  ["بانتظار موافقة المدرب", "warn"],
  ["تم التعاقد", "info"],
  ["قيد التنفيذ", "gold"],
  ["تم التنفيذ", "ok"],
  ["تم الصرف", "ok"],
  ["معتذر", "bad"],
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

// لون مميز لكل نوع برنامج في معرض البطاقات — يرمز للنوع بدل صورة حقيقية
export const TYPE_COLORS: Record<string, string> = {
  "ورشة عمل": "#1F6F78",
  "برنامج تدريبي": "#313E53",
  "دورة تدريبية قصيرة": "#7A2E3B",
  "محاضرة": "#3B3568",
  "ملتقى / لقاء": "#2F6B4F",
  "برنامج تنفيذي": "#8A5A20",
};
export const DEFAULT_CARD_COLOR = "#243044";

// حسابان ثابتان فقط: مشاهدة وإدارة (لا يوجد تسجيل عام). أنشئهما في Supabase كما هو موضح في README.
export const VIEWER_EMAIL = "viewer@gca.local";
export const ADMIN_EMAIL = "admin@gca.local";

export const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
