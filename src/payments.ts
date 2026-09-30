import { DEFAULT_CARD_COLOR, PO_PAYMENT_STATUS, TYPE_COLORS } from "./constants";
import { state } from "./state";
import type { Payment } from "./types";
import { $, esc, pill } from "./utils";

const CX = 60;
const CY = 60;
const R = 46;
const GAP_DEG = 6;

const fmtPct = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// عدد الدفعات الكلي والمدفوع بعد ضبطهما (الكلي ≥ ١، والمدفوع بين ٠ والكلي)
function counts(p: Payment): { total: number; paid: number; done: boolean } {
  const total = Math.max(1, Math.floor(p.installments_total ?? 1));
  const paid = Math.min(total, Math.max(0, Math.floor(p.installments_paid ?? 0)));
  return { total, paid, done: paid === total };
}

function pointOnCircle(angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + R * Math.sin(rad), CY - R * Math.cos(rad)];
}

// كل دفعة تأخذ نصيبًا متساويًا من ١٠٠٪ (٣ دفعات = ٣٣٫٣٪ لكل واحدة)، والمدفوع منها يُلوَّن
function completionCircle(total: number, paid: number, done: boolean): string {
  const cls = (i: number) => `po-arc${i < paid ? " paid" : ""}`;
  const share = fmtPct(100 / total);

  const arcs =
    total === 1
      ? `<circle class="${cls(0)}" cx="${CX}" cy="${CY}" r="${R}"><title>الدفعة ١ — ${share}%</title></circle>`
      : Array.from({ length: total }, (_, i) => {
          const seg = 360 / total;
          const [x1, y1] = pointOnCircle(i * seg + GAP_DEG / 2);
          const [x2, y2] = pointOnCircle((i + 1) * seg - GAP_DEG / 2);
          return `<path class="${cls(i)}" d="M${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2}"><title>الدفعة ${i + 1} — ${share}%</title></path>`;
        }).join("");

  return `<div class="po-donut${done ? " done" : ""}">
    <svg viewBox="0 0 120 120" aria-hidden="true">${arcs}</svg>
    <div class="po-donut-center"><b>${fmtPct((paid / total) * 100)}%</b></div>
  </div>`;
}

function paymentCard(p: Payment): string {
  const { total, paid, done } = counts(p);
  const editAttr = state.role === "admin" ? ` data-edit-payment="${esc(p.id)}"` : "";
  // نربط أمر الشراء بالبرنامج بالاسم ليأخذ نوعه ولونه من بطاقة البرامج
  const prog = state.programs.find((x) => x.title === p.program_name);
  const color = TYPE_COLORS[prog?.type || ""] || DEFAULT_CARD_COLOR;
  return `<article class="prog-card pay-prog${done ? " is-done" : ""}" style="--card-color:${color}"${editAttr}>
    <div class="bars-wm"><i></i><i></i><i></i><i></i></div>
    <div class="row1"><span class="eyebrow">${esc(prog?.type || "أمر شراء")}</span><span class="ref">أمر الشراء <bdi dir="ltr">${esc(p.purchase_order || "—")}</bdi></span></div>
    <h4>${esc(p.program_name)}</h4>
    <div class="stats-row">
      <div class="pay-status"><small>حالة الدفع</small>${pill(PO_PAYMENT_STATUS, p.status)}</div>
      ${completionCircle(total, paid, done)}
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
