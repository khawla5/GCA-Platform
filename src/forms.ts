import { PAYMENT_STATUS, TYPES } from "./constants";
import { deleteProgram, deleteProgramPayment, deleteTrainer, upsertProgram, upsertProgramPayment, upsertTrainer, uploadTrainerCv } from "./data";
import { state } from "./state";
import type { ProgramInput, ProgramPayment, ProgramPaymentInput, TrainerInput } from "./types";
import { $, $$, closeModal, csv, daysBetween, esc, fill, openModal, requireAdmin, save, setv, toast, today, trainerName, v } from "./utils";
import { buildProgressLine, cardHtml } from "./render";
import { refreshData } from "./boot";

// خيارات "مكان التنفيذ" تابعة لـ"أسلوب التنفيذ" — كل أسلوب له خيارات مكان ثابتة
const LOCATION_OPTIONS: Record<string, string[]> = {
  "حضوري": ["مقر المركز - الرياض", "خارج المركز"],
  "افتراضي": ["Microsoft"],
  "هجين": ["مقر الديوان - الرياض / Microsoft"],
};

function updateLocationOptions(preferred?: string | null): void {
  const sel = $("#p_location") as HTMLSelectElement | null;
  if (!sel) return;
  const options = LOCATION_OPTIONS[v("p_mode")] || LOCATION_OPTIONS["حضوري"];
  sel.innerHTML = options.map((o) => `<option value="${o}">${o}</option>`).join("");
  sel.value = preferred && options.includes(preferred) ? preferred : options[0];
}

/* ---------- دفعات عقد البرنامج (قائمة ديناميكية — برنامج واحد ممكن ياخذ أكثر من دفعة) ---------- */
function programPaymentRowHtml(pp?: ProgramPayment): string {
  const statusOptions = PAYMENT_STATUS.map(
    ([s]) => `<option value="${esc(s)}"${pp?.payment_status === s ? " selected" : ""}>${esc(s)}</option>`
  ).join("");
  return `<div class="pp-row" data-pp-id="${esc(pp?.id || "")}">
    <div class="pp-row-head"><b>دفعة</b><button type="button" class="pp-remove" title="حذف الدفعة">✕</button></div>
    <div class="pp-grid">
      <div class="field"><label>الجزء المستحق</label><input class="pp-portion" value="${esc(pp?.due_portion || "")}"></div>
      <div class="field"><label>نسبة الاستحقاق %</label><input type="number" class="pp-percent" min="0" max="100" step="0.1" value="${pp?.entitlement_percent ?? ""}"></div>
      <div class="field"><label>قيمة الاستحقاق</label><input type="number" class="pp-value" min="0" step="0.01" value="${pp?.entitlement_value ?? ""}"></div>
      <div class="field"><label>تاريخ الاستحقاق</label><input type="date" class="pp-date" value="${esc(pp?.due_date || "")}"></div>
      <div class="field"><label>حالة الدفع</label><select class="pp-status">${statusOptions}</select></div>
      <div class="field"><label>رقم شهادة الإنجاز (COC)</label><input class="pp-coc" value="${esc(pp?.coc_number || "")}"></div>
      <div class="field"><label>رقم الفاتورة</label><input class="pp-invoice" value="${esc(pp?.invoice_number || "")}"></div>
    </div>
  </div>`;
}

function renderProgramPaymentsList(programId: string | null): void {
  const list = $("#programPaymentsList");
  if (!list) return;
  const rows = programId ? state.programPayments.filter((pp) => pp.program_id === programId) : [];
  list.innerHTML = rows.map((pp) => programPaymentRowHtml(pp)).join("");
}

// يحفظ كل صفوف الدفعات المعروضة حاليًا بالقائمة (إضافة/تعديل) لبرنامج معيّن
async function saveProgramPaymentsList(programId: string): Promise<void> {
  const list = $("#programPaymentsList");
  const rows = list ? $$(".pp-row", list) : [];
  for (const row of rows) {
    const id = (row as HTMLElement).dataset.ppId || null;
    const g = (cls: string) => (row.querySelector(cls) as HTMLInputElement | HTMLSelectElement | null)?.value || "";
    const input: ProgramPaymentInput = {
      program_id: programId,
      due_portion: g(".pp-portion") || null,
      entitlement_percent: g(".pp-percent") ? +g(".pp-percent") : null,
      entitlement_value: g(".pp-value") ? +g(".pp-value") : null,
      due_date: g(".pp-date") || null,
      payment_status: g(".pp-status") || "تم الطلب",
      coc_number: g(".pp-coc") || null,
      invoice_number: g(".pp-invoice") || null,
    };
    await upsertProgramPayment(id, input);
  }
}

function nextRef(): string {
  const y = new Date().getFullYear();
  const n = state.programs.filter((p) => (p.ref || "").startsWith(`GCA-${y}-`)).length + 1;
  return `GCA-${y}-${String(n).padStart(3, "0")}`;
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

function closeProgramPage(): void {
  ($(`.tab[data-tab="programs"]`) as HTMLElement | null)?.click();
}

function updateStageHero(): void {
  const wheel = $("#stageWheel");
  const heroTitle = $("#stageHeroTitle");
  const heroMeta = $("#stageHeroMeta");
  if (!wheel || !heroTitle || !heroMeta) return;

  wheel.innerHTML = buildProgressLine(v("p_start") || null, v("p_end") || null, v("p_statusGca"), +v("p_days") || null);

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
  setv("p_hours", p?.hours ?? "");
  updateLocationOptions(p?.location);
  setv("p_participants", p?.participants ?? "");
  setv("p_statusGca", p?.status_gca || "بانتظار صدور أمر الشراء");
  setv("p_statusTrainer", p?.status_trainer || "مرحلة الفرز والترشيح");
  setv("p_contractValue", p?.contract_value ?? "");
  renderProgramPaymentsList(p?.id || null);
  setv("p_notes", p?.notes);

  if (!state.trainers.length) toast("أضف مدربًا أولًا من تبويب المدربين");
  updateStageHero();
  openProgramPage();
}

async function saveProgram(): Promise<void> {
  if (!requireAdmin()) return;
  const f = $("#programForm") as HTMLFormElement | null;
  if (!f || !f.reportValidity()) return;
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
    days: +v("p_days") || daysBetween(v("p_start"), v("p_end")),
    hours: +v("p_hours") || 0,
    location: v("p_location"),
    target_group: existing?.target_group ?? null,
    participants: +v("p_participants") || 0,
    gca_contact: existing?.gca_contact ?? null,
    status_gca: v("p_statusGca"),
    status_trainer: v("p_statusTrainer"),
    contract_value: v("p_contractValue") ? +v("p_contractValue") : null,
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
  const cvLink = $("#t_cvCurrent") as HTMLAnchorElement | null;
  if (cvLink) {
    if (t?.cv_url) {
      cvLink.href = t.cv_url;
      cvLink.style.display = "";
    } else {
      cvLink.style.display = "none";
    }
  }
  openModal("trainerModal");
}

async function saveTrainer(): Promise<void> {
  if (!requireAdmin()) return;
  const f = $("#trainerForm") as HTMLFormElement | null;
  if (!f || !f.reportValidity()) return;
  const id = v("t_id") || null;
  const existing = id ? state.trainers.find((x) => x.id === id) : null;
  const cvFile = ($("#t_cv") as HTMLInputElement | null)?.files?.[0] || null;
  let cvUrl = existing?.cv_url ?? null;
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
      ["الاسم", "التخصص", "المؤهل", "الجوال", "البريد", "الحالة", "المدينة", "عدد البرامج", "الساعات", "ملاحظات"],
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
    const cssText = Array.from(document.styleSheets)
      .map((s) => {
        try {
          return [...s.cssRules].map((r) => r.cssText).join("\n");
        } catch {
          return "";
        }
      })
      .join("\n");
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>بطاقة ${p.title}</title><style>${cssText} body{padding:24px;background:#fff}</style></head><body>${cardHtml(p)}</body></html>`;
    await save(`بطاقة-${(p.ref || p.title).replace(/[\\/:*?"<>|]/g, "-")}.html`, html);
  });

  $("#p_start")?.addEventListener("change", () => {
    const endEl = $("#p_end") as HTMLInputElement | null;
    if (endEl && (!v("p_end") || v("p_end") < v("p_start"))) endEl.value = v("p_start");
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
    $("#programPaymentsList")?.insertAdjacentHTML("beforeend", programPaymentRowHtml());
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
    const row = target.closest(".pp-row") as HTMLElement | null;
    const valueInput = row?.querySelector(".pp-value") as HTMLInputElement | null;
    const percent = +(target as HTMLInputElement).value || 0;
    const contractValue = +v("p_contractValue") || 0;
    if (valueInput && percent && contractValue) valueInput.value = ((contractValue * percent) / 100).toFixed(2);
  });

  $("#btnNewTrainer")?.addEventListener("click", () => openTrainerForm());
  $("#btnSaveTrainer")?.addEventListener("click", saveTrainer);
  $("#btnDeleteTrainer")?.addEventListener("click", removeTrainer);

  $("#btnCsvPrograms")?.addEventListener("click", exportProgramsCsv);
  $("#btnCsvTrainers")?.addEventListener("click", exportTrainersCsv);

  $$(".modal-bg").forEach((m) =>
    m.addEventListener("click", (e) => {
      if (e.target === m) m.classList.remove("open");
    })
  );
  $$("[data-close]").forEach((b) => b.addEventListener("click", () => closeModal((b as HTMLElement).dataset.close as string)));
}
