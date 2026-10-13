import { DUE_PORTION_OPTIONS, PAYMENT_CARD_COLOR, PAYMENT_CARD_DONE_COLOR, PAYMENT_CARD_WAITING_COLOR, PAYMENT_STATUS } from "./constants";
import { paginate, resetPage } from "./pager";
import { state } from "./state";
import type { Program } from "./types";
import { $, esc, fill, fmtDate, pill } from "./utils";

// "مدفوع بالكامل" قيمة قديمة مخزّنة في بعض الصفوف وتعني نفس "تم الدفع"
const isPaid = (s: string | null | undefined): boolean => s === "تم الدفع" || s === "مدفوع بالكامل";

// دفعات البرنامج المرتبط (من program_payments) — تحدد لون البطاقة وحالة الدفع والنسبة المدفوعة المعروضة بالكارد
function programPaymentsFor(programId: string | undefined): { done: boolean; partial: boolean; status: string | null; percent: number } {
  if (!programId) return { done: false, partial: false, status: null, percent: 0 };
  const rows = state.programPayments.filter((pp) => pp.program_id === programId);
  if (!rows.length) return { done: false, partial: false, status: null, percent: 0 };
  const done = rows.every((r) => isPaid(r.payment_status));
  const paidSome = rows.some((r) => isPaid(r.payment_status));
  const pending = rows.filter((r) => !isPaid(r.payment_status)).sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  const status = done ? "تم الدفع" : pending[0]?.payment_status || "تم الدفع";
  const percent = rows.filter((r) => isPaid(r.payment_status)).reduce((s, r) => s + (+(r.entitlement_percent || 0)), 0);
  return { done, partial: !done && paidSome, status, percent };
}

// دائرة مقسّمة بالتساوي على عدد الدفعات الفعلي للبرنامج — كل قطاع يأخذ لون حالة دفعته
function donutColor(status: string | null): string {
  return isPaid(status) ? "#013B1B" : status === "معلقة" ? "var(--warn-hi)" : "rgba(255,255,255,.3)";
}

function donutHtml(programId: string): string {
  const rows = state.programPayments.filter((pp) => pp.program_id === programId);
  if (!rows.length) return "";
  const sorted = rows
    .slice()
    .sort((a, b) => DUE_PORTION_OPTIONS.indexOf(a.due_portion || "") - DUE_PORTION_OPTIONS.indexOf(b.due_portion || ""));
  const n = sorted.length;
  const step = 100 / n;
  const stops = sorted.map((r, i) => `${donutColor(r.payment_status)} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`).join(", ");
  const paidCount = sorted.filter((r) => isPaid(r.payment_status)).length;
  return `<div class="pay-donut-wrap"><div class="pay-donut" style="background:conic-gradient(${stops})"><div class="pay-donut-hole"><b>${paidCount}/${n}</b></div></div></div>`;
}

const heroSegColor = (status: string | null): string =>
  isPaid(status) ? "var(--ok)" : status === "معلقة" ? "var(--warn)" : "var(--faint)";

// دائرة كبيرة مقسّمة على عدد الدفعات في صفحة تفاصيل المدفوعات — نفس بيانات الكارد
export function buildPaymentHero(programId: string): string {
  const prog = state.programs.find((p) => p.id === programId);
  if (!prog) return "";
  const rows = state.programPayments
    .filter((pp) => pp.program_id === programId)
    .sort((a, b) => DUE_PORTION_OPTIONS.indexOf(a.due_portion || "") - DUE_PORTION_OPTIONS.indexOf(b.due_portion || ""));
  const { status, percent } = programPaymentsFor(programId);
  const n = rows.length;
  const paid = rows.filter((r) => isPaid(r.payment_status)).length;
  const gap = n > 1 ? 1.4 : 0;
  const stops = n
    ? rows
        .map((r, i) => {
          const a = (i * 100) / n;
          const b = ((i + 1) * 100) / n;
          return `${heroSegColor(r.payment_status)} ${a.toFixed(2)}% ${(b - gap).toFixed(2)}%${gap ? `, transparent ${(b - gap).toFixed(2)}% ${b.toFixed(2)}%` : ""}`;
        })
        .join(", ")
    : "var(--line) 0 100%";
  const legend = rows
    .map(
      (r) =>
        `<li><i style="background:${heroSegColor(r.payment_status)}"></i><span>${esc(r.due_portion || "—")}</span>${pill(PAYMENT_STATUS, r.payment_status)}<b>${r.entitlement_percent != null ? r.entitlement_percent + "%" : "—"}</b></li>`
    )
    .join("");
  return `<div class="pay-hero">
    <div class="pay-hero-donut" style="background:conic-gradient(${stops})"><div class="pay-hero-hole"><b>${paid}/${n}</b><small>دفعات مسددة</small></div></div>
    <div class="pay-hero-info">
      <div class="pay-hero-top"><span class="pay-hero-type">${esc(prog.type || "—")}</span><span class="pay-hero-ref"><bdi dir="auto">${esc(prog.ref || "—")}</bdi></span></div>
      <h3>${esc(prog.title)}</h3>
      <div class="pay-hero-status"><small>حالة الدفع</small>${pill(PAYMENT_STATUS, status)}<span class="pay-hero-percent">${percent}%</span></div>
      <ul class="pay-hero-legend">${legend}</ul>
    </div>
  </div>`;
}

// الكاردز = نفس برامج قسم "البرامج التدريبية" بالضبط — كل برنامج له كارد هنا بغض النظر عن وجود طلب صرف له
function paymentCard(prog: Program): string {
  const editAttr = state.role === "admin" ? ` data-view-payment="${esc(prog.id)}"` : "";
  const { status, percent } = programPaymentsFor(prog.id);
  // لون الكارد يتبع حالة البرنامج مع الديوان: ذهبي للمنجز، أخضر غامق لقيد التنفيذ، أخضر فاتح لبانتظار صدور أمر الشراء
  const gca = prog.status_gca;
  const waiting = gca === "بانتظار صدور أمر الشراء";
  const color = gca === "منجز" ? PAYMENT_CARD_DONE_COLOR : waiting ? PAYMENT_CARD_WAITING_COLOR : PAYMENT_CARD_COLOR;
  const stateCls = gca === "منجز" ? " is-done" : waiting ? " is-partial" : "";
  return `<article class="prog-card pay-prog${stateCls}" style="--card-color:${color}"${editAttr}>
    <div class="bars-wm"><i></i><i></i><i></i><i></i></div>
    <div class="row1"><span class="eyebrow">${esc(prog.type || "أمر شراء")}</span><span class="ref"><bdi dir="auto">${esc(prog.ref || "—")}</bdi></span></div>
    <h4>${esc(prog.title)}</h4>
    <div class="stats-row">
      <div class="pay-status"><small>حالة الدفع</small>${pill(PAYMENT_STATUS, status)}<span class="pay-percent">${percent}%</span></div>
      ${donutHtml(prog.id)}
    </div>
  </article>`;
}

function renderGallery(): void {
  const rail = $("#payRail");
  if (!rail) return;
  const P = state.programs;
  const done = P.filter((p) => programPaymentsFor(p.id).done).length;

  const countEl = $("#payGalleryCount");
  if (countEl) countEl.textContent = P.length ? `(${P.length})` : "";
  const label = $("#payProgressLabel");
  if (label) label.textContent = P.length ? `${done} من ${P.length} برنامج مكتمل الدفع` : "";
  const fill = $("#payTrackFill") as HTMLElement | null;
  if (fill) fill.style.width = P.length ? `${Math.round((done / P.length) * 100)}%` : "0%";
  const empty = $("#payEmpty") as HTMLElement | null;
  if (empty) empty.hidden = P.length > 0;

  rail.innerHTML = P.map(paymentCard).join("");
}

function renderTrainerPayments(): void {
  const body = $("#trainerPaymentsBody");
  if (!body) return;
  const fv = (id: string) => (($(`#${id}`) as HTMLInputElement | HTMLSelectElement | null)?.value || "").trim();
  const q = fv("tfSearch").toLowerCase();
  const stat = fv("tfStatus");
  const portion = fv("tfPortion");
  const trainerId = fv("tfTrainer");
  fill("#tfTrainer", state.trainers.map((t) => [t.id, t.name] as [string, string]), "كل المدربين");
  const rows = state.trainerPayments.filter((tp) => {
    const name = state.trainers.find((t) => t.id === tp.trainer_id)?.name || "";
    return (
      (!stat || tp.payment_status === stat) &&
      (!portion || tp.due_portion === portion) &&
      (!trainerId || tp.trainer_id === trainerId) &&
      (!q || [tp.program_name, name].some((v) => (v || "").toLowerCase().includes(q)))
    );
  });
  body.innerHTML = rows.length
    ? paginate("trainerPaymentsBody", rows, renderTrainerPayments)
        .map((tp) => {
          const trainer = state.trainers.find((t) => t.id === tp.trainer_id);
          const editAttr = state.role === "admin" ? ` data-edit-tpay="${esc(tp.id)}"` : "";
          return `<tr${editAttr}><td><span class="t">${esc(tp.program_name)}</span></td><td>${esc(trainer?.name || "—")}</td><td>${esc(tp.due_portion || "—")}</td><td>${tp.entitlement_percent != null ? `${tp.entitlement_percent}%` : "—"}</td><td>${fmtDate(tp.due_date)}</td><td>${pill(PAYMENT_STATUS, tp.payment_status)}</td><td class="admin-only"><div class="icons"><button class="btn sm" data-edit-tpay="${esc(tp.id)}" title="تعديل">✎</button><button class="btn sm danger" data-del-tpay="${esc(tp.id)}" title="حذف">🗑</button></div></td></tr>`;
        })
        .join("")
    : `<tr><td colspan="7"><div class="empty"><b>${state.trainerPayments.length ? "لا توجد سجلات مطابقة" : "لا توجد مدفوعات مدربين بعد"}</b>${state.trainerPayments.length ? "" : state.role === "admin" ? "أضف سجلًا جديدًا من الزر أعلاه" : ""}</div></td></tr>`;
  if (!rows.length) paginate("trainerPaymentsBody", rows, renderTrainerPayments);
  const count = $("#trainerPaymentsCount");
  if (count) count.textContent = `${rows.length} من ${state.trainerPayments.length} سجل`;
}

// أسماء البرامج الحالية كاقتراحات عند كتابة اسم البرنامج في نماذج المدفوعات
function fillProgramSuggestions(): void {
  const list = $("#programTitles");
  if (list) list.innerHTML = state.programs.map((p) => `<option value="${esc(p.title)}"></option>`).join("");
}

export function renderPayments(): void {
  renderGallery();
  renderTrainerPayments();
  fillProgramSuggestions();
}

export function wirePaymentFilters(): void {
  ["tfSearch", "tfStatus", "tfPortion", "tfTrainer"].forEach((id) =>
    $(`#${id}`)?.addEventListener("input", () => {
      resetPage("trainerPaymentsBody");
      renderTrainerPayments();
    }),
  );
  $("#payShowAll")?.addEventListener("click", () => {
    $("#paymentsTableHead")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
