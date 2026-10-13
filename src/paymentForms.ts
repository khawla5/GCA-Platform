import { refreshData } from "./boot";
import { DUE_PORTION_OPTIONS, PAYMENT_STATUS } from "./constants";
import { deleteTrainerPayment, updateProgramContractValue, upsertProgramPayment, upsertTrainerPayment } from "./data";
import { openProgramForm } from "./forms";
import { state } from "./state";
import type { TrainerPaymentInput } from "./types";
import { $, $$, esc, fill, requireAdmin, setv, toast, v } from "./utils";

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

// رقم أمر الشراء وقيمة العقد يُسحبان من البرنامج نفسه
function selectedProgram() {
  return state.programs.find((pr) => pr.id === v("pay_program"));
}

function blockPortions(except?: HTMLElement): string[] {
  return $$("#payBlocks .pp-row")
    .filter((row) => row !== except)
    .map((row) => (row.querySelector(".pb-portion") as HTMLSelectElement).value);
}

// أول دفعة لم تُستخدم بعد (من دفعات البرنامج المحفوظة + الدفعات المفتوحة في النموذج)
function nextPortion(): string | null {
  const prog = selectedProgram();
  const used = new Set<string>([
    ...state.programPayments.filter((pp) => pp.program_id === prog?.id).map((pp) => pp.due_portion || ""),
    ...blockPortions(),
  ]);
  return DUE_PORTION_OPTIONS.find((o) => !used.has(o)) ?? null;
}

function payBlockHtml(portion: string, removable: boolean): string {
  const opts = (list: string[], sel: string) => list.map((o) => `<option value="${esc(o)}"${o === sel ? " selected" : ""}>${esc(o)}</option>`).join("");
  return `<div class="pp-row">
    <div class="pp-row-head"><b>دفعة</b>${removable ? '<button type="button" class="pp-remove" title="حذف الدفعة">✕</button>' : ""}</div>
    <div class="pp-grid">
      <div class="field"><label>الجزء المستحق</label><select class="pb-portion" disabled>${opts(DUE_PORTION_OPTIONS, portion)}</select></div>
      <div class="field"><label>قيمة الاستحقاق</label><input type="number" class="pb-value" min="0" step="0.01"></div>
      <div class="field"><label>تاريخ الاستحقاق</label><input type="date" class="pb-date" lang="en"></div>
      <div class="field"><label>حالة الدفع</label><select class="pb-status">${opts(PAYMENT_STATUS.map((s) => s[0]), "تم الطلب")}</select></div>
      <div class="field"><label>رقم شهادة الإنجاز (COC)</label><input class="pb-coc"></div>
      <div class="field"><label>رقم الفاتورة</label><input class="pb-invoice"></div>
    </div>
  </div>`;
}

function addPayBlock(): void {
  const list = $("#payBlocks");
  if (!list) return;
  const first = !list.children.length;
  const portion = nextPortion();
  if (!portion) {
    toast(first ? "هذا البرنامج لديه الدفعات الأربع كاملة" : "اكتملت الدفعات الأربع لهذا البرنامج");
    return;
  }
  list.insertAdjacentHTML("beforeend", payBlockHtml(portion, !first));
}

function resetPayBlocks(): void {
  const list = $("#payBlocks");
  if (list) list.innerHTML = "";
  addPayBlock();
}

function onPayProgramChange(): void {
  const prog = selectedProgram();
  setv("pay_po", prog?.ref || "");
  setv("pay_contract", prog?.contract_value ?? "");
  resetPayBlocks();
}

function openPaymentForm(): void {
  if (state.role !== "admin") return;
  const title = $("#paymentFormTitle");
  if (title) title.textContent = "اضافة طلب صرف";
  fill("#pay_program", state.programs.map((pr) => [pr.id, pr.title] as [string, string]), "— اختر البرنامج —");
  setv("pay_program", "");
  setv("pay_po", "");
  setv("pay_contract", "");
  resetPayBlocks();
  openPaymentPage();
}

async function savePayment(): Promise<void> {
  if (!requireAdmin()) return;
  const f = $("#paymentForm") as HTMLFormElement | null;
  if (!f || !f.reportValidity()) return;
  const prog = selectedProgram();
  if (!prog) return;
  const contract = v("pay_contract") ? +v("pay_contract") : null;
  const rows = $$("#payBlocks .pp-row");
  const g = (row: Element, cls: string) => ((row.querySelector(cls) as HTMLInputElement | HTMLSelectElement | null)?.value || "").trim();
  try {
    if (contract !== (prog.contract_value ?? null)) await updateProgramContractValue(prog.id, contract);
    for (const row of rows) {
      const value = g(row, ".pb-value") ? +g(row, ".pb-value") : null;
      await upsertProgramPayment(null, {
        program_id: prog.id,
        due_portion: g(row, ".pb-portion") || null,
        entitlement_percent: contract && value != null ? Math.round((value / contract) * 1000) / 10 : null,
        entitlement_value: value,
        due_date: g(row, ".pb-date") || null,
        payment_status: g(row, ".pb-status") || "تم الطلب",
        coc_number: g(row, ".pb-coc") || null,
        invoice_number: g(row, ".pb-invoice") || null,
      });
    }
    toast(rows.length > 1 ? `تمت إضافة ${rows.length} دفعات` : "تمت إضافة الدفعة");
    await refreshData();
    closePaymentPage();
  } catch (e) {
    toast("تعذّر الحفظ: " + ((e as Error)?.message || ""));
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

async function removeTrainerPayment(rowId?: string): Promise<void> {
  if (!requireAdmin()) return;
  const id = rowId || v("tpay_id");
  if (!id || !confirm("حذف هذا السجل نهائيًا؟")) return;
  try {
    await deleteTrainerPayment(id);
    toast("تم حذف السجل");
    await refreshData();
    if (!rowId) closePaymentPage();
  } catch (e) {
    toast("تعذّر الحذف: " + ((e as Error)?.message || ""));
  }
}

export function wirePaymentForms(): void {
  document.addEventListener("click", (e) => {
    const ep = (e.target as HTMLElement).closest("[data-view-payment]") as HTMLElement | null;
    if (ep) {
      openProgramForm(ep.dataset.viewPayment as string, true, true);
      return;
    }
    const dt = (e.target as HTMLElement).closest("[data-del-tpay]") as HTMLElement | null;
    if (dt) {
      removeTrainerPayment(dt.dataset.delTpay as string);
      return;
    }
    const et = (e.target as HTMLElement).closest("[data-edit-tpay]") as HTMLElement | null;
    if (et) openTrainerPaymentForm(et.dataset.editTpay as string);
  });
  $("#tpay_percent")?.addEventListener("input", () => {
    const el = $("#tpay_percent") as HTMLInputElement | null;
    if (el && +el.value > 100) el.value = "100";
  });
  $("#pay_program")?.addEventListener("change", onPayProgramChange);
  $("#btnAddPayBlock")?.addEventListener("click", addPayBlock);
  $("#payBlocks")?.addEventListener("click", (e) => {
    const rm = (e.target as HTMLElement).closest(".pp-remove");
    if (rm) rm.closest(".pp-row")?.remove();
  });
  $("#btnNewTrainerPayment")?.addEventListener("click", () => openTrainerPaymentForm());
  $("#btnSaveTrainerPayment")?.addEventListener("click", saveTrainerPayment);
  $("#btnDeleteTrainerPayment")?.addEventListener("click", () => removeTrainerPayment());
  $("#btnBackFromTrainerPayment")?.addEventListener("click", closePaymentPage);
  $("#btnCancelTrainerPayment")?.addEventListener("click", closePaymentPage);
  $("#btnNewPayment")?.addEventListener("click", openPaymentForm);
  $("#btnSavePayment")?.addEventListener("click", savePayment);
  $("#btnBackFromPayment")?.addEventListener("click", closePaymentPage);
  $("#btnCancelPayment")?.addEventListener("click", closePaymentPage);
}
