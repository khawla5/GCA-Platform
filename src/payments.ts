import { DUE_PORTION_OPTIONS, GCA_STATUS, PAYMENT_CARD_COLOR, PAYMENT_CARD_DONE_COLOR, PAYMENT_STATUS, TR_STATUS } from "./constants";
import { state } from "./state";
import type { Program } from "./types";
import { $, $$, esc, fmtDate, fmtLong, pill } from "./utils";

// دفعات البرنامج المرتبط (من program_payments) — تحدد لون البطاقة وحالة الدفع والنسبة المدفوعة المعروضة بالكارد
function programPaymentsFor(programId: string | undefined): { done: boolean; partial: boolean; status: string | null; percent: number } {
  if (!programId) return { done: false, partial: false, status: null, percent: 0 };
  const rows = state.programPayments.filter((pp) => pp.program_id === programId);
  if (!rows.length) return { done: false, partial: false, status: null, percent: 0 };
  const done = rows.every((r) => r.payment_status === "مدفوع بالكامل");
  const paidSome = rows.some((r) => r.payment_status === "مدفوع بالكامل");
  const pending = rows.filter((r) => r.payment_status !== "مدفوع بالكامل").sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  const status = done ? "مدفوع بالكامل" : pending[0]?.payment_status || "مدفوع بالكامل";
  const percent = rows.filter((r) => r.payment_status === "مدفوع بالكامل").reduce((s, r) => s + (+(r.entitlement_percent || 0)), 0);
  return { done, partial: !done && paidSome, status, percent };
}

// دائرة مقسّمة بالتساوي على عدد الدفعات الفعلي للبرنامج — كل قطاع يأخذ لون حالة دفعته
function donutColor(status: string | null, themed = false): string {
  if (themed) return status === "مدفوع بالكامل" ? "var(--ok)" : status === "مدفوع جزئياً" ? "var(--gold)" : status === "معلقة" ? "var(--warn)" : "var(--line)";
  return status === "مدفوع بالكامل" ? "#013B1B" : status === "مدفوع جزئياً" ? "#AE9768" : "rgba(255,255,255,.3)";
}

function donutHtml(programId: string, large = false): string {
  const rows = state.programPayments.filter((pp) => pp.program_id === programId);
  if (!rows.length) return "";
  const sorted = rows
    .slice()
    .sort((a, b) => DUE_PORTION_OPTIONS.indexOf(a.due_portion || "") - DUE_PORTION_OPTIONS.indexOf(b.due_portion || ""));
  const n = sorted.length;
  const step = 100 / n;
  const gap = n > 1 ? 1.5 : 0;
  const stops = sorted
    .map((r, i) => {
      const start = i * step;
      const end = (i + 1) * step - gap;
      return `${donutColor(r.payment_status, large)} ${start.toFixed(2)}% ${end.toFixed(2)}%, transparent ${end.toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`;
    })
    .join(", ");
  const paidCount = sorted.filter((r) => r.payment_status === "مدفوع بالكامل").length;
  const size = large ? " pay-donut-lg" : "";
  const holeSize = large ? " pay-donut-hole-lg" : "";
  return `<div class="pay-donut-wrap"><div class="pay-donut${size}" style="background:conic-gradient(${stops})"><div class="pay-donut-hole${holeSize}"><b>${paidCount}/${n}</b></div></div></div>`;
}

// الكاردز = نفس برامج قسم "البرامج التدريبية" بالضبط — كل برنامج له كارد هنا بغض النظر عن وجود طلب صرف له
function paymentCard(prog: Program): string {
  const editAttr = ` data-pay-detail="${esc(prog.id)}"`;
  const { done, status, percent } = programPaymentsFor(prog.id);
  const color = done ? PAYMENT_CARD_DONE_COLOR : PAYMENT_CARD_COLOR;
  const stateCls = done ? " is-done" : "";
  return `<article class="prog-card pay-prog${stateCls}" style="--card-color:${color}"${editAttr}>
    <div class="bars-wm"><i></i><i></i><i></i><i></i></div>
    <div class="row1"><span class="eyebrow">${esc(prog.type || "أمر شراء")}</span><span class="ref">${prog.ref ? `رقم أمر الشراء <bdi dir="ltr">${esc(prog.ref)}</bdi>` : "لم يتم اصدار أمر الشراء بعد"}</span></div>
    <h4>${esc(prog.title)}</h4>
    <div class="stats-row">
      <div class="pay-status"><small>حالة الدفع</small>${pill(PAYMENT_STATUS, status)}<span class="pay-percent">${percent}%</span></div>
      ${donutHtml(prog.id)}
    </div>
  </article>`;
}

const money = (n: number | null | undefined): string =>
  n == null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function openPaymentDetail(programId: string): void {
  const prog = state.programs.find((x) => x.id === programId);
  if (!prog) return;
  const { status, percent } = programPaymentsFor(prog.id);
  const installments = state.programPayments
    .filter((pp) => pp.program_id === prog.id)
    .sort((a, b) => DUE_PORTION_OPTIONS.indexOf(a.due_portion || "") - DUE_PORTION_OPTIONS.indexOf(b.due_portion || ""));
  const trainer = state.trainers.find((x) => x.id === prog.trainer_id);

  const title = $("#paymentDetailTitle");
  if (title) title.textContent = prog.title;

  const head = $("#paymentDetailDonut");
  if (head) {
    head.innerHTML = `<div class="pd-status">
      ${donutHtml(prog.id, true)}
      <div class="pd-status-text"><small>حالة الدفع</small>${pill(PAYMENT_STATUS, status)}<span class="pay-percent">${percent}%</span><small>عدد الدفعات: ${installments.length}</small></div>
    </div>`;
  }

  const info = $("#paymentDetailInfo");
  if (info) {
    info.innerHTML = `<div class="kv">
      <div><small>رقم أمر الشراء</small><b dir="ltr">${esc(prog.ref || "—")}</b></div>
      <div><small>النوع</small><b>${esc(prog.type || "—")}</b></div>
      <div><small>قيمة العقد</small><b>${money(prog.contract_value)}</b></div>
      <div><small>المدرب</small><b>${esc(trainer?.name || "—")}</b></div>
      <div><small>تاريخ البداية</small><b>${fmtLong(prog.start_date)}</b></div>
      <div><small>تاريخ النهاية</small><b>${fmtLong(prog.end_date)}</b></div>
      <div><small>مكان التنفيذ</small><b>${esc(prog.location || "—")}</b></div>
      <div><small>الحالة مع الديوان</small>${pill(GCA_STATUS, prog.status_gca)}</div>
      <div><small>الحالة مع المدرب</small>${pill(TR_STATUS, prog.status_trainer)}</div>
    </div>`;
  }

  const programRows = $("#paymentDetailProgramRows");
  if (programRows) {
    programRows.innerHTML = installments.length
      ? installments
          .map((pp) => `<tr><td>${esc(pp.due_portion || "—")}</td><td>${pp.entitlement_percent != null ? `${pp.entitlement_percent}%` : "—"}</td><td>${money(pp.entitlement_value)}</td><td>${fmtDate(pp.due_date)}</td><td>${pill(PAYMENT_STATUS, pp.payment_status)}</td><td>${esc(pp.invoice_number || "—")}</td><td>${esc(pp.coc_number || "—")}</td></tr>`)
          .join("")
      : `<tr><td colspan="7"><div class="empty"><b>لا توجد دفعات لهذا البرنامج</b></div></td></tr>`;
  }

  const trainerRows = $("#paymentDetailTrainerRows");
  if (trainerRows) {
    const rows = state.trainerPayments.filter((tp) => tp.program_name === prog.title);
    trainerRows.innerHTML = rows.length
      ? rows
          .map((tp) => {
            const tr = state.trainers.find((t) => t.id === tp.trainer_id);
            return `<tr><td>${esc(tp.track || "—")}</td><td>${esc(tr?.name || "—")}</td><td>${esc(tp.due_portion || "—")}</td><td>${tp.entitlement_percent != null ? `${tp.entitlement_percent}%` : "—"}</td><td>${fmtDate(tp.due_date)}</td><td>${pill(PAYMENT_STATUS, tp.payment_status)}</td></tr>`;
          })
          .join("")
      : `<tr><td colspan="6"><div class="empty"><b>لا توجد مدفوعات مدربين لهذا البرنامج</b></div></td></tr>`;
  }

  const editBtn = $("#btnEditFromPaymentDetail") as HTMLElement | null;
  if (editBtn) editBtn.dataset.programId = prog.id;

  $$(".panel").forEach((p) => p.classList.remove("active"));
  $("#panel-paymentDetail")?.classList.add("active");
  window.scrollTo(0, 0);
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
