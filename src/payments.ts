import { DUE_PORTION_OPTIONS, PAYMENT_CARD_COLOR, PAYMENT_CARD_DONE_COLOR, PAYMENT_CARD_PARTIAL_COLOR, PAYMENT_STATUS } from "./constants";
import { state } from "./state";
import type { Program } from "./types";
import { $, esc, fmtDate, pill } from "./utils";

// دفعات البرنامج المرتبط (من program_payments) — تحدد لون البطاقة وحالة الدفع والنسبة المدفوعة المعروضة بالكارد
function programPaymentsFor(programId: string | undefined): { done: boolean; partial: boolean; status: string | null; percent: number } {
  if (!programId) return { done: false, partial: false, status: null, percent: 0 };
  const rows = state.programPayments.filter((pp) => pp.program_id === programId);
  if (!rows.length) return { done: false, partial: false, status: null, percent: 0 };
  const done = rows.every((r) => r.payment_status === "تم الدفع");
  const paidSome = rows.some((r) => r.payment_status === "تم الدفع");
  const pending = rows.filter((r) => r.payment_status !== "تم الدفع").sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  const status = done ? "تم الدفع" : pending[0]?.payment_status || "تم الدفع";
  const percent = rows.filter((r) => r.payment_status === "تم الدفع").reduce((s, r) => s + (+(r.entitlement_percent || 0)), 0);
  return { done, partial: !done && paidSome, status, percent };
}

// دائرة مقسّمة بالتساوي على عدد الدفعات الفعلي للبرنامج — كل قطاع يأخذ لون حالة دفعته
function donutColor(status: string | null): string {
  return status === "تم الدفع" ? "#013B1B" : status === "معلقة" ? "var(--warn-hi)" : "rgba(255,255,255,.3)";
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
  const paidCount = sorted.filter((r) => r.payment_status === "تم الدفع").length;
  return `<div class="pay-donut-wrap"><div class="pay-donut" style="background:conic-gradient(${stops})"><div class="pay-donut-hole"><b>${paidCount}/${n}</b></div></div></div>`;
}

// الكاردز = نفس برامج قسم "البرامج التدريبية" بالضبط — كل برنامج له كارد هنا بغض النظر عن وجود طلب صرف له
function paymentCard(prog: Program): string {
  const editAttr = state.role === "admin" ? ` data-edit-payment="${esc(prog.id)}"` : "";
  const { done, partial, status, percent } = programPaymentsFor(prog.id);
  const color = done ? PAYMENT_CARD_DONE_COLOR : partial ? PAYMENT_CARD_PARTIAL_COLOR : PAYMENT_CARD_COLOR;
  const stateCls = done ? " is-done" : partial ? " is-partial" : "";
  return `<article class="prog-card pay-prog${stateCls}" style="--card-color:${color}"${editAttr}>
    <div class="bars-wm"><i></i><i></i><i></i><i></i></div>
    <div class="row1"><span class="eyebrow">${esc(prog.type || "أمر شراء")}</span><span class="ref">رقم أمر الشراء <bdi dir="ltr">${esc(prog.ref || "—")}</bdi></span></div>
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
  const rows = state.trainerPayments;
  body.innerHTML = rows.length
    ? rows
        .map((tp) => {
          const trainer = state.trainers.find((t) => t.id === tp.trainer_id);
          const editAttr = state.role === "admin" ? ` data-edit-tpay="${esc(tp.id)}"` : "";
          return `<tr${editAttr}><td><span class="t">${esc(tp.program_name)}</span></td><td>${esc(tp.track || "—")}</td><td>${esc(trainer?.name || "—")}</td><td>${esc(tp.due_portion || "—")}</td><td>${tp.entitlement_percent != null ? `${tp.entitlement_percent}%` : "—"}</td><td>${fmtDate(tp.due_date)}</td><td>${pill(PAYMENT_STATUS, tp.payment_status)}</td><td class="admin-only"><div class="icons"><button class="btn sm" data-edit-tpay="${esc(tp.id)}">✎</button></div></td></tr>`;
        })
        .join("")
    : `<tr><td colspan="8"><div class="empty"><b>لا توجد مدفوعات مدربين بعد</b>${state.role === "admin" ? "أضف سجلًا جديدًا من الزر أعلاه" : ""}</div></td></tr>`;
  const count = $("#trainerPaymentsCount");
  if (count) count.textContent = `${rows.length} سجل`;
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
  $("#payShowAll")?.addEventListener("click", () => {
    $("#paymentsTableHead")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
