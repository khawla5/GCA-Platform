import { refreshData } from "./boot";
import { deletePayment, deleteTrainerPayment, upsertPayment, upsertTrainerPayment } from "./data";
import { state } from "./state";
import type { PaymentInput, TrainerPaymentInput } from "./types";
import { $, $$, fill, requireAdmin, setv, toast, v } from "./utils";

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

function openPaymentForm(id?: string): void {
  if (state.role !== "admin") return;
  const p = id ? state.payments.find((x) => x.id === id) : null;
  const title = $("#paymentFormTitle");
  if (title) title.textContent = p ? "تعديل أمر الشراء" : "إضافة أمر شراء";
  const delBtn = $("#btnDeletePayment") as HTMLButtonElement | null;
  if (delBtn) delBtn.style.display = p ? "" : "none";

  setv("pay_id", p?.id);
  setv("pay_po", p?.purchase_order);
  setv("pay_program", p?.program_name);
  setv("pay_status", p?.status || "تم الطلب");
  setv("pay_total", p?.installments_total ?? 1);
  setv("pay_paid", p?.installments_paid ?? 0);
  setv("pay_contract", p?.contract_value ?? "");
  setv("pay_entitlement", p?.entitlement_value ?? "");
  setv("pay_portion", p?.due_portion);
  setv("pay_dueDate", p?.due_date);
  setv("pay_coc", p?.coc_number);
  setv("pay_invoice", p?.invoice_number);
  openPaymentPage();
}

async function savePayment(): Promise<void> {
  if (!requireAdmin()) return;
  const f = $("#paymentForm") as HTMLFormElement | null;
  if (!f || !f.reportValidity()) return;
  const total = Math.floor(+v("pay_total"));
  const paid = Math.floor(+v("pay_paid") || 0);
  if (paid > total) {
    toast("عدد الدفعات المدفوعة أكبر من عدد الدفعات الكلي");
    return;
  }
  const id = v("pay_id") || null;
  const input: PaymentInput = {
    purchase_order: v("pay_po"),
    program_name: v("pay_program"),
    status: v("pay_status"),
    installments_total: total,
    installments_paid: paid,
    contract_value: v("pay_contract") ? +v("pay_contract") : null,
    entitlement_value: v("pay_entitlement") ? +v("pay_entitlement") : null,
    due_portion: v("pay_portion"),
    due_date: v("pay_dueDate") || null,
    coc_number: v("pay_coc"),
    invoice_number: v("pay_invoice"),
  };
  try {
    await upsertPayment(id, input);
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

  setv("tpay_id", tp?.id);
  setv("tpay_program", tp?.program_name);
  setv("tpay_track", tp?.track);
  setv("tpay_trainer", tp?.trainer_id);
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
    const ep = (e.target as HTMLElement).closest("[data-edit-payment]") as HTMLElement | null;
    if (ep) {
      openPaymentForm(ep.dataset.editPayment as string);
      return;
    }
    const et = (e.target as HTMLElement).closest("[data-edit-tpay]") as HTMLElement | null;
    if (et) openTrainerPaymentForm(et.dataset.editTpay as string);
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
