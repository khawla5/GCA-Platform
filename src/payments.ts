import { PAYMENT_CARD_COLOR, PAYMENT_CARD_DONE_COLOR, PAYMENT_CARD_PARTIAL_COLOR, PAYMENT_STATUS } from "./constants";
import { state } from "./state";
import type { Payment } from "./types";
import { $, esc, pill } from "./utils";

// عدد الدفعات الكلي والمدفوع بعد ضبطهما (الكلي ≥ ١، والمدفوع بين ٠ والكلي) — يحدد لون البطاقة فقط
function counts(p: Payment): { total: number; paid: number; done: boolean } {
  const total = Math.max(1, Math.floor(p.installments_total ?? 1));
  const paid = Math.min(total, Math.max(0, Math.floor(p.installments_paid ?? 0)));
  return { total, paid, done: paid === total };
}

// البطاقة مربوطة ببيانات البرنامج نفسها (نفس مصدر جدول "مدفوعات المشاريع مع المركز") بدل حقول Payment المنفصلة
function paymentCard(p: Payment): string {
  const { done, paid } = counts(p);
  const editAttr = state.role === "admin" ? ` data-edit-payment="${esc(p.id)}"` : "";
  const prog = state.programs.find((x) => x.title === p.program_name);
  const partial = !done && paid > 0;
  const color = done ? PAYMENT_CARD_DONE_COLOR : partial ? PAYMENT_CARD_PARTIAL_COLOR : PAYMENT_CARD_COLOR;
  const stateCls = done ? " is-done" : partial ? " is-partial" : "";
  return `<article class="prog-card pay-prog${stateCls}" style="--card-color:${color}"${editAttr}>
    <div class="bars-wm"><i></i><i></i><i></i><i></i></div>
    <div class="row1"><span class="eyebrow">${esc(prog?.type || "أمر شراء")}</span><span class="ref">رقم أمر الشراء <bdi dir="ltr">${esc(prog?.ref || "—")}</bdi></span></div>
    <h4>${esc(p.program_name)}</h4>
    <div class="stats-row">
      <div class="pay-status"><small>حالة الدفع</small>${pill(PAYMENT_STATUS, prog?.payment_status)}</div>
    </div>
  </article>`;
}

function renderGallery(): void {
  const rail = $("#payRail");
  if (!rail) return;
  const P = state.payments;
  const done = P.filter((p) => counts(p).done).length;

  const countEl = $("#payGalleryCount");
  if (countEl) countEl.textContent = P.length ? `(${P.length})` : "";
  const label = $("#payProgressLabel");
  if (label) label.textContent = P.length ? `${done} من ${P.length} أمر شراء مكتمل الدفع` : "";
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
          return `<tr${editAttr}><td><span class="t">${esc(tp.program_name)}</span></td><td>${esc(tp.track || "—")}</td><td>${esc(trainer?.name || "—")}</td><td class="admin-only"><div class="icons"><button class="btn sm" data-edit-tpay="${esc(tp.id)}">✎</button></div></td></tr>`;
        })
        .join("")
    : `<tr><td colspan="4"><div class="empty"><b>لا توجد مدفوعات مدربين بعد</b>${state.role === "admin" ? "أضف سجلًا جديدًا من الزر أعلاه" : ""}</div></td></tr>`;
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
