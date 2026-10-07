import { refreshData } from "./boot";
import { DUE_PORTION_OPTIONS, PAYMENT_STATUS } from "./constants";
import { deletePayment, deleteTrainerPayment, upsertPayment, upsertProgram, upsertProgramPayment, upsertTrainerPayment } from "./data";
import { openProgramForm } from "./forms";
import { state } from "./state";
import type { PaymentInput, TrainerPayment, TrainerPaymentInput } from "./types";
import { openPaymentDetail } from "./payments";
import { $, $$, esc, fill, parseAmount, requireAdmin, setAmount, setv, toast, v } from "./utils";

function openFormPanel(panelId: string): void {
  $$(".panel").forEach((p) => p.classList.remove("active"));
  $(`#${panelId}`)?.classList.add("active");
  window.scrollTo(0, 0);
}

function openPaymentPage(): void {
  openFormPanel("panel-paymentForm");
}

function closePaymentPage(): void {
  ($(`.tab[data-tab="payments"]`) as HTMLElement | null)?.click();
  window.scrollTo(0, 0);
}

// رقم أمر الشراء وقيمة العقد يُسحبان من بيانات البرنامج نفسه
function syncPayFromProgram(): void {
  const prog = state.programs.find((pr) => pr.title === v("pay_program"));
  setv("pay_po", prog?.ref || "");
  setAmount("pay_contract", prog?.contract_value);
}

function openPaymentForm(id?: string): void {
  if (state.role !== "admin") return;
  const p = id ? state.payments.find((x) => String(x.id) === id) : null;
  const title = $("#paymentFormTitle");
  if (title) title.textContent = p ? "تعديل أمر الشراء" : "اضافة طلب صرف";
  const delBtn = $("#btnDeletePayment") as HTMLButtonElement | null;
  if (delBtn) delBtn.style.display = p ? "" : "none";

  fill("#pay_program", state.programs.map((pr) => pr.title), "— اختر البرنامج —");

  setv("pay_id", p?.id);
  setv("pay_program", p?.program_name);
  syncPayFromProgram();
  setv("pay_status", p?.status || "تم الطلب");
  setAmount("pay_contract", p?.contract_value);
  setAmount("pay_entitlement", p?.entitlement_value);
  fill("#pay_portion", DUE_PORTION_OPTIONS);
  setv("pay_portion", p?.due_portion || DUE_PORTION_OPTIONS[0]);
  setv("pay_dueDate", p?.due_date);
  setv("pay_coc", p?.coc_number);
  setv("pay_invoice", p?.invoice_number);
  openPaymentPage();
}

// الدفعة اللي في نموذج طلب الصرف تنكتب كصف في "مدفوعات المشاريع مع المركز" للبرنامج المختار
async function saveProgramInstallmentFromPayment(): Promise<void> {
  const prog = state.programs.find((pr) => pr.title === v("pay_program"));
  if (!prog) return;
  const contract = parseAmount(v("pay_contract")) ?? prog.contract_value;
  if (contract !== prog.contract_value) {
    const { id: _id, created_at: _c, updated_at: _u, ...program } = prog;
    await upsertProgram(prog.id, { ...program, contract_value: contract });
  }
  const portion = v("pay_portion") || null;
  const row = state.programPayments.find((pp) => pp.program_id === prog.id && pp.due_portion === portion);
  await upsertProgramPayment(row?.id ?? null, {
    program_id: prog.id,
    due_portion: portion,
    entitlement_percent: row?.entitlement_percent ?? null,
    entitlement_value: parseAmount(v("pay_entitlement")),
    due_date: v("pay_dueDate") || null,
    payment_status: v("pay_status") || "تم الطلب",
    coc_number: v("pay_coc") || null,
    invoice_number: v("pay_invoice") || null,
  });
}

async function savePayment(): Promise<void> {
  if (!requireAdmin()) return;
  const f = $("#paymentForm") as HTMLFormElement | null;
  if (!f || !f.reportValidity()) return;
  const id = v("pay_id") || null;
  const existing = id ? state.payments.find((x) => String(x.id) === id) : null;
  const input: PaymentInput = {
    purchase_order: v("pay_po"),
    program_name: v("pay_program"),
    status: v("pay_status"),
    installments_total: existing?.installments_total ?? 1,
    installments_paid: existing?.installments_paid ?? 0,
    contract_value: parseAmount(v("pay_contract")),
    entitlement_value: parseAmount(v("pay_entitlement")),
    due_portion: v("pay_portion"),
    due_date: v("pay_dueDate") || null,
    coc_number: v("pay_coc"),
    invoice_number: v("pay_invoice"),
  };
  try {
    await upsertPayment(id, input);
    await saveProgramInstallmentFromPayment();
    toast(id ? "تم تحديث أمر الشراء" : "تمت إضافة أمر الشراء");
    await refreshData();
    closePaymentPage();
  } catch (e) {
    toast("تعذّر الحفظ: " + ((e as Error)?.message || ""));
  }
}

async function removePayment(): Promise<void> {
  if (!requireAdmin()) return;
  const id = v("pay_id");
  if (!id || !confirm("حذف أمر الشراء هذا نهائيًا؟")) return;
  try {
    await deletePayment(id);
    toast("تم حذف أمر الشراء");
    await refreshData();
    closePaymentPage();
  } catch (e) {
    toast("تعذّر الحذف: " + ((e as Error)?.message || ""));
  }
}

/* ---------- مدفوعات المدربين (قائمة ديناميكية — مدرب واحد ممكن ياخذ أكثر من دفعة على نفس البرنامج) ---------- */
function trainerPaymentRowHtml(tp?: TrainerPayment, defaultPortion?: string): string {
  const statusOptions = PAYMENT_STATUS.map(
    ([s]) => `<option value="${esc(s)}"${tp?.payment_status === s ? " selected" : ""}>${esc(s)}</option>`
  ).join("");
  return `<div class="pp-row" data-tp-id="${esc(tp?.id || "")}">
    <div class="pp-row-head"><b>دفعة</b><button type="button" class="pp-remove" title="حذف الدفعة">✕</button></div>
    <div class="pp-grid">
      <div class="field"><label>الدفعة</label><select class="tprow-portion">${DUE_PORTION_OPTIONS.map(
        (o) => `<option value="${esc(o)}"${(tp?.due_portion ?? defaultPortion) === o ? " selected" : ""}>${esc(o)}</option>`
      ).join("")}</select></div>
      <div class="field"><label>نسبة الاستحقاق</label><div class="pct-wrap"><input type="number" class="tprow-percent" min="0" max="100" step="0.1" value="${tp?.entitlement_percent ?? ""}"><span class="pct-suffix">%</span></div></div>
      <div class="field"><label>تاريخ الاستحقاق</label><input type="date" class="tprow-date${tp?.due_date ? "" : " date-empty"}" lang="en" value="${esc(tp?.due_date || "")}"></div>
      <div class="field"><label>حالة الدفع</label><select class="tprow-status">${statusOptions}</select></div>
    </div>
  </div>`;
}

function renderTrainerPaymentRowsList(programName: string, trainerId: string | null): void {
  const list = $("#trainerPaymentRowsList");
  if (!list) return;
  const rows = programName
    ? state.trainerPayments
        .filter((tp) => tp.program_name === programName && tp.trainer_id === trainerId)
        .sort((a, b) => DUE_PORTION_OPTIONS.indexOf(a.due_portion || "") - DUE_PORTION_OPTIONS.indexOf(b.due_portion || ""))
    : [];
  list.innerHTML = rows.map((tp) => trainerPaymentRowHtml(tp)).join("");
}

function refreshTrainerPaymentRowsList(): void {
  renderTrainerPaymentRowsList(v("tpay_program"), v("tpay_trainer") || null);
}

function openTrainerPaymentForm(id?: string): void {
  if (state.role !== "admin") return;
  fill("#tpay_trainer", state.trainers.filter((t) => t.status !== "موقوف").map((t) => [t.id, t.name] as [string, string]), "— اختر المدرب —");
  fill("#tpay_program", state.programs.map((pr) => pr.title), "— اختر البرنامج —");
  const tp = id ? state.trainerPayments.find((x) => x.id === id) : null;
  const title = $("#trainerPaymentFormTitle");
  if (title) title.textContent = tp ? "تعديل مدفوعات المدرب" : "إضافة مدفوعات مدرب";

  setv("tpay_program", tp?.program_name);
  setv("tpay_trainer", tp?.trainer_id);
  renderTrainerPaymentRowsList(tp?.program_name || "", tp?.trainer_id ?? null);
  openFormPanel("panel-trainerPaymentForm");
}

// يحفظ كل صفوف الدفعات المعروضة حاليًا بالقائمة لنفس البرنامج والمدرب
async function saveTrainerPayment(): Promise<void> {
  if (!requireAdmin()) return;
  const f = $("#trainerPaymentForm") as HTMLFormElement | null;
  if (!f || !f.reportValidity()) return;
  const programName = v("tpay_program");
  const trainerId = v("tpay_trainer") || null;
  const list = $("#trainerPaymentRowsList");
  const rows = list ? $$(".pp-row", list) : [];
  if (!rows.length) {
    toast("أضف دفعة واحدة على الأقل");
    return;
  }
  try {
    for (const row of rows) {
      const id = (row as HTMLElement).dataset.tpId || null;
      const existing = id ? state.trainerPayments.find((x) => x.id === id) : null;
      const g = (cls: string) => (row.querySelector(cls) as HTMLInputElement | HTMLSelectElement | null)?.value || "";
      const input: TrainerPaymentInput = {
        program_name: programName,
        track: existing?.track ?? null,
        trainer_id: trainerId,
        due_portion: g(".tprow-portion") || null,
        entitlement_percent: g(".tprow-percent") ? +g(".tprow-percent") : null,
        due_date: g(".tprow-date") || null,
        payment_status: g(".tprow-status") || "تم الطلب",
      };
      await upsertTrainerPayment(id, input);
    }
    toast("تم حفظ مدفوعات المدرب");
    await refreshData();
    closePaymentPage();
  } catch (e) {
    toast("تعذّر الحفظ: " + ((e as Error)?.message || ""));
  }
}

export function wirePaymentForms(): void {
  document.addEventListener("click", (e) => {
    const ep = (e.target as HTMLElement).closest("[data-pay-detail]") as HTMLElement | null;
    if (ep) {
      openPaymentDetail(ep.dataset.payDetail as string);
      return;
    }
    const et = (e.target as HTMLElement).closest("[data-edit-tpay]") as HTMLElement | null;
    if (et) openTrainerPaymentForm(et.dataset.editTpay as string);
  });
  $("#pay_program")?.addEventListener("change", syncPayFromProgram);
  $("#btnBackFromPaymentDetail")?.addEventListener("click", closePaymentPage);
  $("#btnEditFromPaymentDetail")?.addEventListener("click", (e) => {
    const id = (e.currentTarget as HTMLElement).dataset.programId;
    if (id) openProgramForm(id);
  });
  $("#btnNewTrainerPayment")?.addEventListener("click", () => openTrainerPaymentForm());
  $("#btnSaveTrainerPayment")?.addEventListener("click", saveTrainerPayment);
  $("#btnBackFromTrainerPayment")?.addEventListener("click", closePaymentPage);
  $("#btnCancelTrainerPayment")?.addEventListener("click", closePaymentPage);
  // اختيار اسم البرنامج يعكس المدرب المسؤول عنه تلقائيًا، ويحدّث قائمة الدفعات لنفس البرنامج والمدرب
  $("#tpay_program")?.addEventListener("change", () => {
    const prog = state.programs.find((pr) => pr.title === v("tpay_program"));
    if (prog?.trainer_id) setv("tpay_trainer", prog.trainer_id);
    refreshTrainerPaymentRowsList();
  });
  $("#tpay_trainer")?.addEventListener("change", refreshTrainerPaymentRowsList);
  $("#btnAddTrainerPaymentRow")?.addEventListener("click", () => {
    const list = $("#trainerPaymentRowsList");
    const lastPortion = list ? ($$(".tprow-portion", list).pop() as HTMLSelectElement | undefined)?.value : undefined;
    const nextIndex = lastPortion ? Math.min(DUE_PORTION_OPTIONS.indexOf(lastPortion) + 1, DUE_PORTION_OPTIONS.length - 1) : 0;
    list?.insertAdjacentHTML("beforeend", trainerPaymentRowHtml(undefined, DUE_PORTION_OPTIONS[nextIndex]));
  });
  $("#trainerPaymentRowsList")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".pp-remove") as HTMLElement | null;
    if (!btn) return;
    const row = btn.closest(".pp-row") as HTMLElement | null;
    if (!row) return;
    const tpId = row.dataset.tpId;
    if (tpId) {
      if (!confirm("حذف هذه الدفعة نهائيًا؟")) return;
      deleteTrainerPayment(tpId).catch((err) => toast("تعذّر حذف الدفعة: " + ((err as Error)?.message || "")));
    }
    row.remove();
  });
  $("#trainerPaymentRowsList")?.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains("tprow-percent")) return;
    const input = target as HTMLInputElement;
    if (+input.value > 100) input.value = "100";
  });
  $("#btnNewPayment")?.addEventListener("click", () => openPaymentForm());
  $("#btnSavePayment")?.addEventListener("click", savePayment);
  $("#btnDeletePayment")?.addEventListener("click", removePayment);
  $("#btnBackFromPayment")?.addEventListener("click", closePaymentPage);
  $("#btnCancelPayment")?.addEventListener("click", closePaymentPage);
}
