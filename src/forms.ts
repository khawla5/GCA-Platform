import { DUE_PORTION_OPTIONS, PAYMENT_STATUS, TYPES } from "./constants";
import { deleteProgram, deleteProgramPayment, deleteTrainer, upsertProgram, upsertProgramPayment, upsertTrainer, uploadTrainerCv } from "./data";
import { state } from "./state";
import type { ProgramInput, ProgramPayment, ProgramPaymentInput, TrainerInput } from "./types";
import { $, $$, closeModal, csv, daysBetween, esc, fill, fmtAmountInput, openModal, parseAmount, requireAdmin, save, setAmount, setv, toast, today, trainerName, v } from "./utils";
import { buildProgressLine, cardDownloadHtml, cardHtml } from "./render";
import { refreshData } from "./boot";

// خيارات "مكان التنفيذ" تابعة لـ"أسلوب التنفيذ" — كل أسلوب له خيارات مكان ثابتة
const LOCATION_OPTIONS: Record<string, string[]> = {
  "حضوري": ["مقر المركز - الرياض", "خارج المركز"],
  "افتراضي": ["Microsoft Teams"],
  "هجين": ["مقر المركز - الرياض / Microsoft Teams"],
};

function updateLocationOptions(preferred?: string | null): void {
  const sel = $("#p_location") as HTMLSelectElement | null;
  if (!sel) return;
  const options = LOCATION_OPTIONS[v("p_mode")] || LOCATION_OPTIONS["حضوري"];
  sel.innerHTML = options.map((o) => `<option value="${o}">${o}</option>`).join("");
  sel.value = preferred && options.includes(preferred) ? preferred : options[0];
}

/* ---------- دفعات عقد البرنامج (قائمة ديناميكية — برنامج واحد ممكن ياخذ أكثر من دفعة) ---------- */
function programPaymentRowHtml(pp?: ProgramPayment, defaultPortion?: string, showCocInvoice = false): string {
  const statusOptions = PAYMENT_STATUS.map(
    ([s]) => `<option value="${esc(s)}"${pp?.payment_status === s ? " selected" : ""}>${esc(s)}</option>`
  ).join("");
  const cocInvoiceFields = showCocInvoice
    ? `<div class="field"><label>رقم شهادة الإنجاز (COC)</label><input class="pp-coc" value="${esc(pp?.coc_number || "")}"></div>
      <div class="field"><label>رقم الفاتورة</label><input class="pp-invoice" value="${esc(pp?.invoice_number || "")}"></div>`
    : "";
  return `<div class="pp-row" data-pp-id="${esc(pp?.id || "")}">
    <div class="pp-row-head"><b>دفعة</b><button type="button" class="pp-remove" title="حذف الدفعة">✕</button></div>
    <div class="pp-grid">
      <div class="field"><label>ترتيب الدفعة</label><select class="pp-portion">${DUE_PORTION_OPTIONS.map(
        (o) => `<option value="${esc(o)}"${(pp?.due_portion ?? defaultPortion) === o ? " selected" : ""}>${esc(o)}</option>`
      ).join("")}</select></div>
      <div class="field"><label>نسبة الاستحقاق</label><div class="pct-wrap"><input type="number" class="pp-percent" min="0" max="100" step="0.1" value="${pp?.entitlement_percent ?? ""}"><span class="pct-suffix">%</span></div></div>
      <div class="field"><label>قيمة الاستحقاق</label><input type="text" inputmode="decimal" dir="ltr" data-amount class="pp-value" value="${pp?.entitlement_value != null ? fmtAmountInput(pp.entitlement_value.toFixed(2)) : ""}"></div>
      <div class="field"><label>تاريخ الاستحقاق</label><input type="date" class="pp-date${pp?.due_date ? "" : " date-empty"}" lang="en" value="${esc(pp?.due_date || "")}"></div>
      <div class="field"><label>حالة الدفع</label><select class="pp-status">${statusOptions}</select></div>
      ${cocInvoiceFields}
    </div>
  </div>`;
}

function renderProgramPaymentsList(programId: string | null): void {
  const list = $("#programPaymentsList");
  if (!list) return;
  const rows = programId ? state.programPayments.filter((pp) => pp.program_id === programId) : [];
  list.innerHTML = rows.map((pp) => programPaymentRowHtml(pp, undefined, !!programId)).join("");
}

// يحفظ كل صفوف الدفعات المعروضة حاليًا بالقائمة (إضافة/تعديل) لبرنامج معيّن
async function saveProgramPaymentsList(programId: string): Promise<void> {
  const list = $("#programPaymentsList");
  const rows = list ? $$(".pp-row", list) : [];
  for (const row of rows) {
    const id = (row as HTMLElement).dataset.ppId || null;
    const existing = id ? state.programPayments.find((pp) => pp.id === id) : null;
    const g = (cls: string) => (row.querySelector(cls) as HTMLInputElement | HTMLSelectElement | null)?.value || "";
    const hasCoc = !!row.querySelector(".pp-coc");
    const input: ProgramPaymentInput = {
      program_id: programId,
      due_portion: g(".pp-portion") || null,
      entitlement_percent: g(".pp-percent") ? +g(".pp-percent") : null,
      entitlement_value: parseAmount(g(".pp-value")),
      due_date: g(".pp-date") || null,
      payment_status: g(".pp-status") || "تم الطلب",
      coc_number: hasCoc ? g(".pp-coc") || null : existing?.coc_number ?? null,
      invoice_number: hasCoc ? g(".pp-invoice") || null : existing?.invoice_number ?? null,
    };
    await upsertProgramPayment(id, input);
  }
}

function nextRef(): string {
  const y = new Date().getFullYear();
  const n = state.programs.filter((p) => (p.ref || "").startsWith(`PO-${y}-`)).length + 1;
  return `PO-${y}-${String(n).padStart(3, "0")}`;
}

/* ---------- program card ---------- */
export function openCard(id: string): void {
  const p = state.programs.find((x) => x.id === id);
  if (!p) return;
  state.current = p;
  const body = $("#cardBody");
  if (body) body.innerHTML = cardHtml(p);
  openModal("cardModal");
}

/* ---------- program form (full page) ---------- */
function openProgramPage(): void {
  $$(".panel").forEach((p) => p.classList.remove("active"));
  $("#panel-programForm")?.classList.add("active");
  window.scrollTo(0, 0);
}

const hoursToText = (h: number): string => {
  const totalMinutes = Math.round(h * 60);
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`;
};

const textToHours = (text: string): number => {
  const [h, m] = text.split(":");
  const minutes = +(m || 0);
  return Math.round(((+h || 0) + minutes / 60) * 100) / 100;
};

let programFormReturnTab = "programs";
let cvRemoved = false;

function closeProgramPage(): void {
  ($(`.tab[data-tab="${programFormReturnTab}"]`) as HTMLElement | null)?.click();
}

function updateStageHero(): void {
  const wheel = $("#stageWheel");
  const heroStatus = $("#stageHeroStatus");
  const heroTitle = $("#stageHeroTitle");
  const heroMeta = $("#stageHeroMeta");
  if (!wheel || !heroStatus || !heroTitle || !heroMeta) return;

  setv("p_days", v("p_start") && v("p_end") ? daysBetween(v("p_start"), v("p_end")) : "");
  wheel.innerHTML = buildProgressLine(v("p_start") || null, v("p_end") || null, v("p_statusGca"));

  heroStatus.textContent = v("p_statusGca") || "بانتظار صدور أمر الشراء";
  heroTitle.textContent = v("p_title") || "برنامج جديد";

  const trainerSelect = $("#p_trainer") as HTMLSelectElement | null;
  const trainerLabel = trainerSelect?.selectedOptions[0]?.textContent?.trim();
  const metaParts = [trainerSelect && v("p_trainer") ? trainerLabel : null, v("p_start") ? `يبدأ ${v("p_start")}` : null].filter(Boolean);
  heroMeta.textContent = metaParts.length ? metaParts.join(" · ") : "حدّد المدرب والتواريخ لعرض التفاصيل";
}

export function openProgramForm(id?: string, focusPayment = false): void {
  if (state.role !== "admin") return;
  fill(
    "#p_trainer",
    state.trainers.filter((t) => t.status !== "موقوف").map((t) => [t.id, t.name] as [string, string]),
    "— اختر المدرب —"
  );
  const p = id ? state.programs.find((x) => x.id === id) : null;
  const title = $("#programFormTitle");
  if (title) title.textContent = p ? "تعديل البرنامج" : "إضافة برنامج";
  const delBtn = $("#btnDeleteProgram") as HTMLButtonElement | null;
  if (delBtn) delBtn.style.display = p ? "" : "none";
  const heroEl = $(".stage-hero") as HTMLElement | null;
  if (heroEl) heroEl.style.display = p ? "" : "none";

  const activePanel = $(".panel.active")?.id;
  programFormReturnTab = activePanel === "panel-payments" || activePanel === "panel-paymentDetail" ? "payments" : "programs";

  const formEl = $("#programForm") as HTMLElement | null;
  if (formEl) formEl.classList.toggle("payment-focus", focusPayment);
  const legend = $("#contractFieldsetLegend");
  if (legend) legend.textContent = focusPayment ? "مدفوعات المشاريع مع المركز" : "بيانات العقد والصرف";

  setv("p_id", p?.id);
  setv("p_title", p?.title);
  setv("p_ref", p?.ref);
  setv("p_type", p?.type || TYPES[0]);
  setv("p_trainer", p?.trainer_id);
  setv("p_mode", p?.mode || "حضوري");
  setv("p_start", p?.start_date);
  setv("p_end", p?.end_date);
  setv("p_days", p?.days ?? "");
  setv("p_hours", p?.hours != null ? hoursToText(p.hours) : "");
  updateLocationOptions(p?.location);
  setv("p_participants", p?.participants ?? "");
  setv("p_statusGca", p?.status_gca || "بانتظار صدور أمر الشراء");
  setv("p_statusTrainer", p?.status_trainer || "مرحلة الفرز والترشيح");
  setAmount("p_contractValue", p?.contract_value);
  renderProgramPaymentsList(p?.id || null);
  setv("p_notes", p?.notes);

  if (!state.trainers.length) toast("أضف مدربًا أولًا من تبويب المدربين");
  updateStageHero();
  openProgramPage();
}

let programSaveInFlight = false;

async function saveProgram(): Promise<void> {
  if (programSaveInFlight || !requireAdmin()) return;
  const f = $("#programForm") as HTMLFormElement | null;
  if (!f || !f.reportValidity()) return;
  programSaveInFlight = true;
  try {
    await persistProgram();
  } finally {
    programSaveInFlight = false;
  }
}

async function persistProgram(): Promise<void> {
  if (v("p_end") < v("p_start")) {
    toast("تاريخ النهاية قبل تاريخ البداية");
    return;
  }
  const id = v("p_id") || null;
  const existing = id ? state.programs.find((x) => x.id === id) : null;
  const input: ProgramInput = {
    title: v("p_title"),
    ref: v("p_ref") || nextRef(),
    type: v("p_type"),
    trainer_id: v("p_trainer") || null,
    mode: v("p_mode"),
    start_date: v("p_start"),
    end_date: v("p_end"),
    days: daysBetween(v("p_start"), v("p_end")),
    hours: textToHours(v("p_hours")),
    location: v("p_location"),
    target_group: existing?.target_group ?? null,
    participants: +v("p_participants") || 0,
    gca_contact: existing?.gca_contact ?? null,
    status_gca: v("p_statusGca"),
    status_trainer: v("p_statusTrainer"),
    contract_value: parseAmount(v("p_contractValue")),
    notes: v("p_notes"),
  };
  try {
    const programId = await upsertProgram(id, input);
    await saveProgramPaymentsList(programId);
    toast(id ? "تم تحديث البرنامج" : "تمت إضافة البرنامج");
    await refreshData();
    closeProgramPage();
  } catch (e) {
    toast("تعذّر الحفظ: " + ((e as Error)?.message || ""));
  }
}

async function removeProgram(): Promise<void> {
  if (!requireAdmin()) return;
  const id = v("p_id");
  if (!id || !confirm("حذف هذا البرنامج نهائيًا؟")) return;
  try {
    await deleteProgram(id);
    toast("تم حذف البرنامج");
    await refreshData();
    closeProgramPage();
  } catch (e) {
    toast("تعذّر الحذف: " + ((e as Error)?.message || ""));
  }
}

/* ---------- trainer form ---------- */
export function openTrainerForm(id?: string): void {
  if (state.role !== "admin") return;
  const t = id ? state.trainers.find((x) => x.id === id) : null;
  const title = $("#trainerFormTitle");
  if (title) title.textContent = t ? "تعديل بيانات المدرب" : "إضافة مدرب";
  const delBtn = $("#btnDeleteTrainer") as HTMLButtonElement | null;
  if (delBtn) delBtn.style.display = t ? "" : "none";

  setv("t_id", t?.id);
  setv("t_name", t?.name);
  setv("t_phone", t?.phone);
  setv("t_email", t?.email);
  setv("t_status", t?.status || "نشط");
  setv("t_city", t?.city);
  setv("t_notes", t?.notes);
  const cvInput = $("#t_cv") as HTMLInputElement | null;
  if (cvInput) cvInput.value = "";
  cvRemoved = false;
  const cvLink = $("#t_cvCurrent") as HTMLAnchorElement | null;
  const cvWrap = $("#t_cvCurrentWrap") as HTMLElement | null;
  if (cvLink) cvLink.href = t?.cv_url || "#";
  if (cvWrap) cvWrap.style.display = t?.cv_url ? "flex" : "none";
  openModal("trainerModal");
}

async function saveTrainer(): Promise<void> {
  if (!requireAdmin()) return;
  const f = $("#trainerForm") as HTMLFormElement | null;
  if (!f || !f.reportValidity()) return;
  const id = v("t_id") || null;
  const existing = id ? state.trainers.find((x) => x.id === id) : null;
  const cvFile = ($("#t_cv") as HTMLInputElement | null)?.files?.[0] || null;
  let cvUrl = cvRemoved ? null : existing?.cv_url ?? null;
  if (cvFile) {
    try {
      cvUrl = await uploadTrainerCv(cvFile);
    } catch (e) {
      toast("تعذّر رفع ملف الـ CV: " + ((e as Error)?.message || ""));
      return;
    }
  }
  const input: TrainerInput = {
    name: v("t_name"),
    specialty: existing?.specialty ?? null,
    qualification: existing?.qualification ?? null,
    phone: v("t_phone"),
    email: v("t_email"),
    status: v("t_status"),
    city: v("t_city"),
    notes: v("t_notes"),
    cv_url: cvUrl,
  };
  try {
    await upsertTrainer(id, input);
    toast(id ? "تم تحديث بيانات المدرب" : "تمت إضافة المدرب");
    await refreshData();
    closeModal("trainerModal");
  } catch (e) {
    toast("تعذّر الحفظ: " + ((e as Error)?.message || ""));
  }
}

async function removeTrainer(): Promise<void> {
  if (!requireAdmin()) return;
  const id = v("t_id");
  if (!id) return;
  const n = state.programs.filter((p) => p.trainer_id === id).length;
  if (n) {
    toast(`لا يمكن حذف المدرب — مرتبط بـ ${n} برنامج`);
    return;
  }
  if (!confirm("حذف هذا المدرب؟")) return;
  try {
    await deleteTrainer(id);
    toast("تم حذف المدرب");
    await refreshData();
    closeModal("trainerModal");
  } catch (e) {
    toast("تعذّر الحذف: " + ((e as Error)?.message || ""));
  }
}


/* ---------- downloads ---------- */
function exportProgramsCsv(): void {
  save(
    "البرامج-التدريبية.csv",
    csv([
      ["رقم أمر الشراء", "البرنامج", "النوع", "المدرب", "أسلوب التنفيذ", "تاريخ البداية", "تاريخ النهاية", "الأيام", "الساعات", "المكان", "الفئة المستهدفة", "المتدربون", "المسؤول بالديوان", "الحالة مع الديوان", "الحالة مع المدرب", "ملاحظات"],
      ...state.programs.map((p) => [
        p.ref, p.title, p.type, trainerName(p, state.trainers), p.mode, p.start_date, p.end_date,
        p.days || daysBetween(p.start_date || today(), p.end_date || today()), p.hours, p.location,
        p.target_group, p.participants, p.gca_contact, p.status_gca, p.status_trainer, p.notes,
      ]),
    ])
  );
}

function exportTrainersCsv(): void {
  save(
    "المدربون.csv",
    csv([
      ["الاسم", "التخصص", "المؤهل", "الجوال", "البريد", "الحالة", "الجهة", "عدد البرامج", "الساعات", "ملاحظات"],
      ...state.trainers.map((t) => {
        const ps = state.programs.filter((p) => p.trainer_id === t.id);
        return [t.name, t.specialty, t.qualification, t.phone, t.email, t.status, t.city, ps.length, ps.reduce((s, p) => s + (+(p.hours || 0)), 0), t.notes];
      }),
    ])
  );
}

/* ---------- wiring ---------- */
export function wireForms(): void {
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const o = target.closest("[data-open]") as HTMLElement | null;
    if (o && !target.closest("[data-edit]")) {
      openCard(o.dataset.open as string);
      return;
    }
    const ed = target.closest("[data-edit]") as HTMLElement | null;
    if (ed) {
      e.stopPropagation();
      openProgramForm(ed.dataset.edit as string);
      return;
    }
    const et = target.closest("[data-edit-trainer]") as HTMLElement | null;
    if (et) {
      openTrainerForm(et.dataset.editTrainer as string);
      return;
    }
    const tr = target.closest("[data-trainer]") as HTMLElement | null;
    if (tr && state.role === "admin") {
      openTrainerForm(tr.dataset.trainer as string);
    }
  });

  // يخفي نص يوم/شهر/سنة الافتراضي لحقول التاريخ الفاضية (يطلع مبعثر بالصفحات العربية) — يبان بمجرد اختيار تاريخ
  document.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLInputElement && t.type === "date") t.classList.toggle("date-empty", !t.value);
  });

  $("#btnPrintCard")?.addEventListener("click", () => window.print());
  $("#btnPrintReport")?.addEventListener("click", () => {
    document.body.classList.add("print-report");
    ($(`.tab[data-tab="reports"]`) as HTMLElement | null)?.click();
    setTimeout(() => {
      window.print();
      document.body.classList.remove("print-report");
    }, 50);
  });
  $("#btnEditFromCard")?.addEventListener("click", () => {
    closeModal("cardModal");
    if (state.current) openProgramForm(state.current.id);
  });
  $("#btnDlCard")?.addEventListener("click", async () => {
    const p = state.current;
    if (!p) return;
    const html = cardDownloadHtml(p);
    await save(`بطاقة-${(p.ref || p.title).replace(/[\\/:*?"<>|]/g, "-")}.html`, html);
  });

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.hasAttribute("data-amount")) t.value = fmtAmountInput(t.value);
  });
  $("#p_start")?.addEventListener("change", () => {
    const endEl = $("#p_end") as HTMLInputElement | null;
    if (endEl && (!v("p_end") || v("p_end") < v("p_start"))) endEl.value = v("p_start");
    // بمجرد تحديد تاريخ البداية يصير البرنامج "قيد التنفيذ" تلقائيًا (ما لم يكن منجزًا أصلًا)
    if (v("p_start") && v("p_statusGca") !== "منجز") setv("p_statusGca", "قيد التنفيذ");
    updateStageHero();
  });
  $("#p_end")?.addEventListener("change", updateStageHero);
  $("#p_title")?.addEventListener("input", updateStageHero);
  $("#p_mode")?.addEventListener("change", () => updateLocationOptions());
  $("#p_statusGca")?.addEventListener("change", updateStageHero);
  $("#p_trainer")?.addEventListener("change", updateStageHero);
  $("#btnNewProgram")?.addEventListener("click", () => openProgramForm());
  $("#btnSaveProgram")?.addEventListener("click", saveProgram);
  $("#btnDeleteProgram")?.addEventListener("click", removeProgram);
  $("#btnBackFromProgram")?.addEventListener("click", closeProgramPage);
  $("#btnCancelProgram")?.addEventListener("click", closeProgramPage);

  $("#btnAddProgramPayment")?.addEventListener("click", () => {
    const list = $("#programPaymentsList");
    const lastPortion = list ? ($$(".pp-portion", list).pop() as HTMLSelectElement | undefined)?.value : undefined;
    const nextIndex = lastPortion ? Math.min(DUE_PORTION_OPTIONS.indexOf(lastPortion) + 1, DUE_PORTION_OPTIONS.length - 1) : 0;
    list?.insertAdjacentHTML("beforeend", programPaymentRowHtml(undefined, DUE_PORTION_OPTIONS[nextIndex], !!v("p_id")));
  });
  $("#programPaymentsList")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".pp-remove") as HTMLElement | null;
    if (!btn) return;
    const row = btn.closest(".pp-row") as HTMLElement | null;
    if (!row) return;
    const ppId = row.dataset.ppId;
    if (ppId) {
      if (!confirm("حذف هذه الدفعة نهائيًا؟")) return;
      deleteProgramPayment(ppId).catch((err) => toast("تعذّر حذف الدفعة: " + ((err as Error)?.message || "")));
    }
    row.remove();
  });
  $("#programPaymentsList")?.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains("pp-percent")) return;
    const input = target as HTMLInputElement;
    if (+input.value > 100) input.value = "100";
    const row = target.closest(".pp-row") as HTMLElement | null;
    const valueInput = row?.querySelector(".pp-value") as HTMLInputElement | null;
    const percent = +input.value || 0;
    const contractValue = parseAmount(v("p_contractValue")) || 0;
    if (valueInput && percent && contractValue) valueInput.value = fmtAmountInput(((contractValue * percent) / 100).toFixed(2));
  });

  $("#btnNewTrainer")?.addEventListener("click", () => openTrainerForm());
  $("#btnSaveTrainer")?.addEventListener("click", saveTrainer);
  $("#btnDeleteTrainer")?.addEventListener("click", removeTrainer);
  $("#btnRemoveCv")?.addEventListener("click", () => {
    cvRemoved = true;
    const cvWrap = $("#t_cvCurrentWrap") as HTMLElement | null;
    if (cvWrap) cvWrap.style.display = "none";
  });

  $("#btnCsvPrograms")?.addEventListener("click", exportProgramsCsv);
  $("#btnCsvTrainers")?.addEventListener("click", exportTrainersCsv);

  $$(".modal-bg").forEach((m) =>
    m.addEventListener("click", (e) => {
      if (e.target === m) m.classList.remove("open");
    })
  );
  $$("[data-close]").forEach((b) => b.addEventListener("click", () => closeModal((b as HTMLElement).dataset.close as string)));
}
