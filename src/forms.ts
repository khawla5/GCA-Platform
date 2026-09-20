import { TYPES } from "./constants";
import { deleteProgram, deleteTrainer, replaceAllData, resetAllData, upsertProgram, upsertTrainer } from "./data";
import { state } from "./state";
import type { Program, ProgramImport, ProgramInput, Trainer, TrainerImport, TrainerInput } from "./types";
import { $, $$, closeModal, csv, daysBetween, fill, openModal, save, toast, today, trainerName } from "./utils";
import { cardHtml } from "./render";
import { refreshData } from "./boot";

const v = (id: string): string => (($(`#${id}`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)?.value || "").trim();
const setv = (id: string, val: string | number | null | undefined): void => {
  const el = $(`#${id}`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  if (el) el.value = (val ?? "") as string;
};

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

/* ---------- program form ---------- */
export function openProgramForm(id?: string): void {
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
  setv("p_location", p?.location);
  setv("p_target", p?.target_group);
  setv("p_participants", p?.participants ?? "");
  setv("p_gcaContact", p?.gca_contact);
  setv("p_statusGca", p?.status_gca || "مقترح");
  setv("p_statusTrainer", p?.status_trainer || "تم الترشيح");
  setv("p_notes", p?.notes);

  if (!state.trainers.length) toast("أضف مدربًا أولًا من تبويب المدربين");
  openModal("programModal");
}

async function saveProgram(): Promise<void> {
  const f = $("#programForm") as HTMLFormElement | null;
  if (!f || !f.reportValidity()) return;
  if (v("p_end") < v("p_start")) {
    toast("تاريخ النهاية قبل تاريخ البداية");
    return;
  }
  const id = v("p_id") || null;
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
    target_group: v("p_target"),
    participants: +v("p_participants") || 0,
    gca_contact: v("p_gcaContact"),
    status_gca: v("p_statusGca"),
    status_trainer: v("p_statusTrainer"),
    notes: v("p_notes"),
  };
  try {
    await upsertProgram(id, input);
    toast(id ? "تم تحديث البرنامج" : "تمت إضافة البرنامج");
    await refreshData();
    closeModal("programModal");
  } catch (e) {
    toast("تعذّر الحفظ: " + ((e as Error)?.message || ""));
  }
}

async function removeProgram(): Promise<void> {
  const id = v("p_id");
  if (!id || !confirm("حذف هذا البرنامج نهائيًا؟")) return;
  try {
    await deleteProgram(id);
    toast("تم حذف البرنامج");
    await refreshData();
    closeModal("programModal");
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
  setv("t_specialty", t?.specialty);
  setv("t_qual", t?.qualification);
  setv("t_phone", t?.phone);
  setv("t_email", t?.email);
  setv("t_status", t?.status || "نشط");
  setv("t_city", t?.city);
  setv("t_notes", t?.notes);
  openModal("trainerModal");
}

async function saveTrainer(): Promise<void> {
  const f = $("#trainerForm") as HTMLFormElement | null;
  if (!f || !f.reportValidity()) return;
  const id = v("t_id") || null;
  const input: TrainerInput = {
    name: v("t_name"),
    specialty: v("t_specialty"),
    qualification: v("t_qual"),
    phone: v("t_phone"),
    email: v("t_email"),
    status: v("t_status"),
    city: v("t_city"),
    notes: v("t_notes"),
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
      ["الرقم المرجعي", "البرنامج", "النوع", "المدرب", "أسلوب التنفيذ", "تاريخ البداية", "تاريخ النهاية", "الأيام", "الساعات", "المكان", "الفئة المستهدفة", "المتدربون", "المسؤول بالديوان", "الحالة مع الديوان", "الحالة مع المدرب", "ملاحظات"],
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

function exportJsonBackup(): void {
  save(`نسخة-احتياطية-${today()}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), trainers: state.trainers, programs: state.programs }, null, 2));
}

async function importJsonBackup(file: File): Promise<void> {
  try {
    const j = JSON.parse(await file.text()) as { trainers?: Trainer[]; programs?: Program[] };
    if (!Array.isArray(j.programs) || !Array.isArray(j.trainers)) throw new Error("bad shape");
    const trainers: TrainerImport[] = j.trainers.map((t) => ({
      id: t.id, name: t.name, specialty: t.specialty, qualification: t.qualification, phone: t.phone,
      email: t.email, status: t.status, city: t.city, notes: t.notes,
    }));
    const programs: ProgramImport[] = j.programs.map((p) => ({
      id: p.id, ref: p.ref, title: p.title, type: p.type, trainer_id: p.trainer_id, mode: p.mode,
      start_date: p.start_date, end_date: p.end_date, days: p.days, hours: p.hours, location: p.location,
      target_group: p.target_group, participants: p.participants, gca_contact: p.gca_contact,
      status_gca: p.status_gca, status_trainer: p.status_trainer, notes: p.notes,
    }));
    await replaceAllData(trainers, programs);
    toast("تمت استعادة النسخة");
    await refreshData();
  } catch {
    toast("ملف غير صالح");
  }
}

async function resetData(): Promise<void> {
  if (!confirm("حذف جميع البرامج والمدربين والبدء بقاعدة فارغة؟")) return;
  try {
    await resetAllData();
    toast("تم تصفير البيانات");
    await refreshData();
  } catch (e) {
    toast("تعذّر الحذف: " + ((e as Error)?.message || ""));
  }
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
  });
  $("#btnNewProgram")?.addEventListener("click", () => openProgramForm());
  $("#btnSaveProgram")?.addEventListener("click", saveProgram);
  $("#btnDeleteProgram")?.addEventListener("click", removeProgram);

  $("#btnNewTrainer")?.addEventListener("click", () => openTrainerForm());
  $("#btnSaveTrainer")?.addEventListener("click", saveTrainer);
  $("#btnDeleteTrainer")?.addEventListener("click", removeTrainer);

  $("#btnCsvPrograms")?.addEventListener("click", exportProgramsCsv);
  $("#btnCsvTrainers")?.addEventListener("click", exportTrainersCsv);
  $("#btnJson")?.addEventListener("click", exportJsonBackup);
  $("#btnReset")?.addEventListener("click", resetData);
  ($("#fileJson") as HTMLInputElement | null)?.addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await importJsonBackup(file);
    input.value = "";
  });

  $$(".modal-bg").forEach((m) =>
    m.addEventListener("click", (e) => {
      if (e.target === m) m.classList.remove("open");
    })
  );
  $$("[data-close]").forEach((b) => b.addEventListener("click", () => closeModal((b as HTMLElement).dataset.close as string)));
}
