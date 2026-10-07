import { refreshData } from "./boot";
import { DUE_PORTION_OPTIONS, PAYMENT_STATUS } from "./constants";
import { deletePayment, deleteTrainerPayment, upsertPayment, upsertProgram, upsertProgramPayment, upsertTrainerPayment } from "./data";
import { openProgramForm } from "./forms";
import { state } from "./state";
import type { PaymentInput, TrainerPaymentInput } from "./types";
import { openPaymentDetail } from "./payments";
import { $, $$, fill, parseAmount, requireAdmin, setAmount, setv, toast, v } from "./utils";

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
  setv("pay_entitlement", p?.entitlement_value ?? "");
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
    entitlement_value: v("pay_entitlement") ? +v("pay_entitlement") : null,
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
    entitlement_value: v("pay_entitlement") ? +v("pay_entitlement") : null,
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

/* ---------- مدفوعات المدربين ---------- */
function openTrainerPaymentForm(id?: string): void {
  if (state.role !== "admin") return;
  fill("#tpay_trainer", state.trainers.filter((t) => t.status !== "موقوف").map((t) => [t.id, t.name] as [string, string]), "— اختر المدرب —");
  const tp = id ? state.trainerPayments.find((x) => x.id === id) : null;
  const title = $("#trainerPaymentFormTitle");
  if (title) title.textContent = tp ? "تعديل مدفوعات المدرب" : "إضافة مدفوعات مدرب";
  const delBtn = $("#btnDeleteTrainerPayment") as HTMLButtonElement | null;
  if (delBtn) delBtn.style.display = tp ? "" : "none";

  fill("#tpay_portion", DUE_PORTION_OPTIONS);
  fill("#tpay_status", PAYMENT_STATUS.map((s) => s[0]));

  setv("tpay_id", tp?.id);
  setv("tpay_program", tp?.program_name);
  setv("tpay_track", tp?.track);
  setv("tpay_trainer", tp?.trainer_id);
  setv("tpay_portion", tp?.due_portion || DUE_PORTION_OPTIONS[0]);
  setv("tpay_percent", tp?.entitlement_percent ?? "");
  setv("tpay_dueDate", tp?.due_date);
  setv("tpay_status", tp?.payment_status || "تم الطلب");
  openFormPanel("panel-trainerPaymentForm");
}

async function saveTrainerPayment(): Promise<void> {
  if (!requireAdmin()) return;
  const f = $("#trainerPaymentForm") as HTMLFormElement | null;
  if (!f || !f.reportValidity()) return;
  const id = v("tpay_id") || null;
  const input: TrainerPaymentInput = {
    program_name: v("tpay_program"),
    track: v("tpay_track") || null,
    trainer_id: v("tpay_trainer") || null,
    due_portion: v("tpay_portion") || null,
    entitlement_percent: v("tpay_percent") ? +v("tpay_percent") : null,
    due_date: v("tpay_dueDate") || null,
    payment_status: v("tpay_status") || "تم الطلب",
  };
  try {
    await upsertTrainerPayment(id, input);
    toast(id ? "تم تحديث السجل" : "تمت إضافة السجل");
    await refreshData();
    closePaymentPage();
  } catch (e) {
    toast("تعذّر الحفظ: " + ((e as Error)?.message || ""));
  }
}

async function removeTrainerPayment(): Promise<void> {
  if (!requireAdmin()) return;
  const id = v("tpay_id");
  if (!id || !confirm("حذف هذا السجل نهائيًا؟")) return;
  try {
    await deleteTrainerPayment(id);
    toast("تم حذف السجل");
    await refreshData();
    closePaymentPage();
  } catch (e) {
    toast("تعذّر الحذف: " + ((e as Error)?.message || ""));
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
  $("#tpay_percent")?.addEventListener("input", () => {
    const el = $("#tpay_percent") as HTMLInputElement | null;
    if (el && +el.value > 100) el.value = "100";
  });
  $("#pay_program")?.addEventListener("change", syncPayFromProgram);
  $("#btnBackFromPaymentDetail")?.addEventListener("click", closePaymentPage);
  $("#btnEditFromPaymentDetail")?.addEventListener("click", (e) => {
    const id = (e.currentTarget as HTMLElement).dataset.programId;
    if (id) openProgramForm(id);
  });
  $("#btnNewTrainerPayment")?.addEventListener("click", () => openTrainerPaymentForm());
  $("#btnSaveTrainerPayment")?.addEventListener("click", saveTrainerPayment);
  $("#btnDeleteTrainerPayment")?.addEventListener("click", removeTrainerPayment);
  $("#btnBackFromTrainerPayment")?.addEventListener("click", closePaymentPage);
  $("#btnCancelTrainerPayment")?.addEventListener("click", closePaymentPage);
  $("#btnNewPayment")?.addEventListener("click", () => openPaymentForm());
  $("#btnSavePayment")?.addEventListener("click", savePayment);
  $("#btnDeletePayment")?.addEventListener("click", removePayment);
  $("#btnBackFromPayment")?.addEventListener("click", closePaymentPage);
  $("#btnCancelPayment")?.addEventListener("click", closePaymentPage);
}
