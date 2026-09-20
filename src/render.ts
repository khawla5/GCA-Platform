import { AR_MONTHS, DEFAULT_CARD_COLOR, GCA_STATUS, TR_STATUS, TRAINER_STATUS, TYPES, TYPE_COLORS } from "./constants";
import { state } from "./state";
import type { Program } from "./types";
import {
  $, $$, durationText, esc, fill, fmtDate, fmtLong, fmtMonth, inRange, pill, today, trainerName,
} from "./utils";

const GALLERY_STATUS_PRIORITY: Record<string, number> = {
  "قيد التنفيذ": 0,
  "معتمد": 1,
  "بانتظار اعتماد الديوان": 2,
  "مقترح": 3,
  "مؤجَّل": 4,
  "منفَّذ": 5,
  "ملغى": 6,
};

// مسار اعتماد البرنامج — كل برنامج يمر بهذه المراحل بالترتيب
const GCA_STAGES = ["مقترح", "بانتظار اعتماد الديوان", "معتمد", "قيد التنفيذ", "منفَّذ"];

function stageInfo(p: Program): { pct: number; ringColor: string; frac: string; label: string } {
  if (p.status_gca === "ملغى") return { pct: 100, ringColor: "var(--bad)", frac: "✕", label: "ملغى" };
  if (p.status_gca === "مؤجَّل") return { pct: 100, ringColor: "var(--warn)", frac: "⏸", label: "مؤجَّل" };
  const idx = GCA_STAGES.indexOf(p.status_gca);
  const step = idx === -1 ? 0 : idx + 1;
  const pct = Math.round((step / GCA_STAGES.length) * 100);
  const ringColor = step === GCA_STAGES.length ? "var(--ok)" : "var(--gold)";
  return { pct, ringColor, frac: `${step}/${GCA_STAGES.length}`, label: p.status_gca };
}

export function renderGallery(): void {
  const rail = $("#galleryRail");
  if (!rail) return;
  const P = state.programs;

  const countEl = $("#galleryCount");
  if (countEl) countEl.textContent = P.length ? `(${P.length})` : "";

  const done = P.filter((p) => p.status_gca === "منفَّذ").length;
  const progressLabel = $("#galleryProgressLabel");
  if (progressLabel) progressLabel.textContent = P.length ? `${done} من ${P.length} برنامج منفَّذ` : "";
  const trackFill = $("#galleryTrackFill") as HTMLElement | null;
  if (trackFill) trackFill.style.width = P.length ? `${Math.round((done / P.length) * 100)}%` : "0%";

  const current = P.find((p) => p.status_gca === "قيد التنفيذ");
  const continueTag = $("#galleryContinueTag") as HTMLElement | null;
  if (continueTag) continueTag.hidden = !current;

  const emptyEl = $("#galleryEmpty") as HTMLElement | null;
  if (emptyEl) emptyEl.hidden = P.length > 0;

  const sorted = P.slice().sort((a, b) => {
    const wa = GALLERY_STATUS_PRIORITY[a.status_gca] ?? 9;
    const wb = GALLERY_STATUS_PRIORITY[b.status_gca] ?? 9;
    if (wa !== wb) return wa - wb;
    return (a.start_date || "").localeCompare(b.start_date || "");
  });

  rail.innerHTML = sorted
    .map((p) => {
      const t = state.trainers.find((x) => x.id === p.trainer_id);
      const trainerName = t?.name || "—";
      const initial = t?.name?.trim()?.[0] || "؟";
      const { pct, ringColor, frac, label } = stageInfo(p);
      const clickAttr = state.role === "admin" ? `data-edit="${esc(p.id)}"` : `data-open="${esc(p.id)}"`;
      const isCurrent = current && p.id === current.id;
      const color = TYPE_COLORS[p.type || ""] || DEFAULT_CARD_COLOR;
      return `<article class="prog-card${isCurrent ? " is-current" : ""}" style="--card-color:${color}" ${clickAttr}>
        <div class="bars-wm"><i></i><i></i><i></i><i></i></div>
        <div class="row1"><span class="eyebrow">${esc(p.type || "—")}</span><span class="ref">${esc(p.ref || "—")}</span></div>
        <h4>${esc(p.title)}</h4>
        <div class="meta"><span class="avatar">${esc(initial)}</span>${esc(trainerName)}${t?.specialty ? ` · ${esc(t.specialty)}` : ""}</div>
        <div class="stats-row">
          <div class="badge-count"><span class="n">${p.participants ?? 0}</span> متدرب</div>
          ${pill(GCA_STATUS, p.status_gca)}
        </div>
        <div class="stage-row">
          <div class="stage-ring" style="--pct:${pct};--ring-color:${ringColor}"><span>${esc(frac)}</span></div>
          <div class="stage-text"><b>مرحلة الاعتماد</b><small>${esc(label)}</small></div>
        </div>
      </article>`;
    })
    .join("");
}

export function wireGalleryShowAll(): void {
  $("#galleryShowAll")?.addEventListener("click", () => {
    $("#programsTableHead")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export function renderKpis(): void {
  const P = state.programs, T = state.trainers, tm = today().slice(0, 7);
  const running = P.filter((p) => p.status_gca === "قيد التنفيذ").length;
  const done = P.filter((p) => p.status_gca === "منفَّذ").length;
  const pending = P.filter((p) => ["مقترح", "بانتظار اعتماد الديوان"].includes(p.status_gca)).length;
  const hours = P.filter((p) => p.status_gca !== "ملغى").reduce((s, p) => s + (+(p.hours || 0)), 0);
  const trainees = P.filter((p) => p.status_gca === "منفَّذ").reduce((s, p) => s + (+(p.participants || 0)), 0);
  const thisMonth = P.filter((p) => (p.start_date || "").slice(0, 7) === tm).length;
  const active = T.filter((t) => t.status === "نشط").length;

  const k: [string, number, string, string][] = [
    ["إجمالي البرامج", P.length, `${thisMonth} هذا الشهر`, ""],
    ["قيد التنفيذ", running, "برامج جارية الآن", "gold"],
    ["منفَّذة", done, `${trainees} متدرب`, "ok"],
    ["بانتظار اعتماد الديوان", pending, "تحتاج متابعة", pending ? "warn" : ""],
    ["مدربون نشطون", active, `من أصل ${T.length}`, ""],
    ["ساعات تدريبية", hours, "إجمالي المعتمد والمنفَّذ", ""],
  ];
  const el = $("#kpis");
  if (el) el.innerHTML = k.map(([l, n, s, c]) => `<div class="kpi ${c}"><div class="n">${n}</div><div class="l">${l}</div><div class="s">${s}</div></div>`).join("");
}

function renderBars(elSel: string, list: [string, string][], key: "status_gca" | "status_trainer", cntSel: string): void {
  const P = state.programs;
  const max = Math.max(1, ...list.map((s) => P.filter((p) => p[key] === s[0]).length));
  const el = $(elSel);
  if (el) {
    el.innerHTML = list
      .map(([s, t]) => {
        const n = P.filter((p) => p[key] === s).length;
        const colorVar = t === "gold" ? "gold" : t === "neutral" ? "faint" : t;
        return `<div class="brow"><span class="lbl">${esc(s)}</span><div class="trk"><div class="fil" style="width:${(n / max) * 100}%;background:var(--${colorVar})"></div></div><span class="val">${n}</span></div>`;
      })
      .join("");
  }
  const cnt = $(cntSel);
  if (cnt) cnt.textContent = `${P.length} برنامج`;
}

function renderMonths(): void {
  const now = new Date();
  const cols: { key: string; label: string; cur: boolean; n: number }[] = [];
  for (let i = -5; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    cols.push({
      key,
      label: AR_MONTHS[d.getMonth()],
      cur: i === 0,
      n: state.programs.filter((p) => (p.start_date || "").slice(0, 7) === key).length,
    });
  }
  const max = Math.max(1, ...cols.map((c) => c.n));
  const months = $("#months");
  if (months) months.innerHTML = cols.map((c) => `<div class="mcol"><span class="v">${c.n || ""}</span><div class="bar ${c.cur ? "cur" : ""}" style="height:${Math.max(c.n ? 6 : 2, (c.n / max) * 100)}%"></div></div>`).join("");
  const labels = $("#mlabels");
  if (labels) labels.innerHTML = cols.map((c) => `<span>${c.label}</span>`).join("");
}

function renderUpcoming(): void {
  const t = today();
  const lim = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  const up = state.programs
    .filter((p) => p.start_date && p.start_date >= t && p.start_date <= lim && p.status_gca !== "ملغى")
    .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""))
    .slice(0, 8);
  const el = $("#upcoming");
  if (!el) return;
  el.innerHTML = up.length
    ? up
        .map((p) => {
          const [, m, d] = (p.start_date as string).split("-");
          return `<div class="upc-item" data-open="${esc(p.id)}"><div class="dbox"><b>${+d}</b><span>${AR_MONTHS[+m - 1]}</span></div><div><div class="t">${esc(p.title)}</div><div class="sub">${esc(trainerName(p, state.trainers))} · ${durationText(p)}</div></div>${pill(GCA_STATUS, p.status_gca)}</div>`;
        })
        .join("")
    : `<div class="empty" style="padding:20px">لا توجد برامج مجدولة خلال الستين يومًا القادمة</div>`;
}

function renderTrainerLoad(): void {
  const rows = state.trainers
    .map((t) => {
      const ps = state.programs.filter((p) => p.trainer_id === t.id);
      const last = ps.slice().sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""))[0];
      return { t, n: ps.length, run: ps.filter((p) => p.status_gca === "قيد التنفيذ").length, h: ps.reduce((s, p) => s + (+(p.hours || 0)), 0), last };
    })
    .sort((a, b) => b.n - a.n);
  const el = $("#trainerLoad");
  if (!el) return;
  el.innerHTML = rows.length
    ? rows
        .map(
          (r) =>
            `<tr data-trainer="${esc(r.t.id)}"><td class="t">${esc(r.t.name)}</td><td>${esc(r.t.specialty || "—")}</td><td>${pill(TRAINER_STATUS, r.t.status)}</td><td>${r.n}</td><td>${r.run}</td><td>${r.h}</td><td>${r.last ? esc(r.last.title) + `<span class="sub">${fmtDate(r.last.start_date)}</span>` : "—"}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="7" class="empty">لم يُضف مدربون بعد</td></tr>`;
}

function filteredPrograms(): Program[] {
  const q = (($("#fSearch") as HTMLInputElement)?.value || "").trim();
  const ty = ($("#fType") as HTMLSelectElement)?.value || "";
  const g = ($("#fGca") as HTMLSelectElement)?.value || "";
  const tr = ($("#fTr") as HTMLSelectElement)?.value || "";
  const tid = ($("#fTrainer") as HTMLSelectElement)?.value || "";
  return state.programs
    .filter(
      (p) =>
        (!ty || p.type === ty) &&
        (!g || p.status_gca === g) &&
        (!tr || p.status_trainer === tr) &&
        (!tid || p.trainer_id === tid) &&
        (!q || [p.title, p.ref, trainerName(p, state.trainers), p.target_group].join(" ").includes(q))
    )
    .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));
}

export function renderPrograms(): void {
  fill("#fTrainer", state.trainers.map((t) => [t.id, t.name] as [string, string]), "كل المدربين");
  const rows = filteredPrograms();
  const el = $("#programsBody");
  if (el) {
    el.innerHTML = rows.length
      ? rows
          .map(
            (p) =>
              `<tr data-open="${esc(p.id)}"><td><span class="sub" style="font-size:12.5px">${esc(p.ref || "—")}</span></td><td><span class="t">${esc(p.title)}</span>${p.target_group ? `<span class="sub">${esc(p.target_group)}</span>` : ""}</td><td>${esc(p.type || "—")}</td><td>${esc(trainerName(p, state.trainers))}</td><td>${fmtDate(p.start_date)}${p.end_date && p.end_date !== p.start_date ? `<span class="sub">إلى ${fmtDate(p.end_date)}</span>` : ""}</td><td>${durationText(p)}</td><td>${pill(GCA_STATUS, p.status_gca)}</td><td>${pill(TR_STATUS, p.status_trainer)}</td><td class="admin-only"><div class="icons"><button class="btn sm" data-edit="${esc(p.id)}">✎</button></div></td></tr>`
          )
          .join("")
      : `<tr><td colspan="9"><div class="empty"><b>لا توجد برامج مطابقة</b>${state.role === "admin" ? "أضف برنامجًا جديدًا من الزر أعلاه" : "سيظهر هنا ما تضيفه يسير من برامج"}</div></td></tr>`;
  }
  const cnt = $("#programsCount");
  if (cnt) cnt.textContent = `${rows.length} من ${state.programs.length} برنامج`;
}

export function renderTrainers(): void {
  const T = state.trainers.slice().sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const el = $("#trainersBody");
  if (!el) return;
  el.innerHTML = T.length
    ? T.map((t) => {
        const ps = state.programs.filter((p) => p.trainer_id === t.id);
        return `<tr data-trainer="${esc(t.id)}"><td class="t">${esc(t.name)}${t.city ? `<span class="sub">${esc(t.city)}</span>` : ""}</td><td>${esc(t.specialty || "—")}</td><td>${esc(t.qualification || "—")}</td><td dir="ltr" style="text-align:end">${esc(t.phone || "")}${t.email ? `<span class="sub">${esc(t.email)}</span>` : ""}</td><td>${pill(TRAINER_STATUS, t.status)}</td><td>${ps.length}</td><td>${ps.reduce((s, p) => s + (+(p.hours || 0)), 0)}</td><td class="admin-only"><button class="btn sm" data-edit-trainer="${esc(t.id)}">✎</button></td></tr>`;
      }).join("")
    : `<tr><td colspan="8"><div class="empty"><b>لا يوجد مدربون بعد</b>${state.role === "admin" ? "أضف أول مدرب من الزر أعلاه" : ""}</div></td></tr>`;
}

export function renderReport(): void {
  const g = ($("#rGca") as HTMLSelectElement)?.value || "";
  const from = ($("#rFrom") as HTMLInputElement)?.value || "";
  const to = ($("#rTo") as HTMLInputElement)?.value || "";
  const P = state.programs.filter((p) => (!g || p.status_gca === g) && inRange(p, from, to)).sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
  const hours = P.reduce((s, p) => s + (+(p.hours || 0)), 0);
  const trainees = P.reduce((s, p) => s + (+(p.participants || 0)), 0);
  const byStatus = GCA_STATUS.map(([s]) => [s, P.filter((p) => p.status_gca === s).length] as [string, number]).filter((x) => x[1]);
  const byTrainer = state.trainers.map((t) => ({ t, ps: P.filter((p) => p.trainer_id === t.id) })).filter((x) => x.ps.length);
  const period = from || to ? `${from ? fmtMonth(from) : "البداية"} — ${to ? fmtMonth(to) : "الآن"}` : "كامل المدة";

  const el = $("#report");
  if (!el) return;
  el.innerHTML = `
    <div class="rh"><div class="bars"><i></i><i></i><i></i><i></i></div><h2>تقرير متابعة توريد المدربين — ديوان المحاسبة العامة</h2><div class="meta">أُعدّ بواسطة: يسير لإدارة المشاريع<br>تاريخ الإصدار: ${fmtLong(today())}<br>الفترة: ${period}${g ? `<br>الحالة: ${esc(g)}` : ""}</div></div>
    <div class="rsum"><div><b>${P.length}</b><span>برنامج</span></div><div><b>${byTrainer.length}</b><span>مدرب</span></div><div><b>${hours}</b><span>ساعة تدريبية</span></div><div><b>${trainees}</b><span>متدرب</span></div><div><b>${P.filter((p) => p.status_gca === "منفَّذ").length}</b><span>برنامج منفَّذ</span></div></div>
    <h3>١. ملخص الحالة مع الديوان</h3>
    <div class="tbl-wrap"><table><thead><tr><th>الحالة</th><th>عدد البرامج</th><th>النسبة</th></tr></thead><tbody>${byStatus.map(([s, n]) => `<tr><td>${pill(GCA_STATUS, s)}</td><td>${n}</td><td>${Math.round((n / P.length) * 100)}%</td></tr>`).join("") || `<tr><td colspan="3" class="empty">لا بيانات</td></tr>`}</tbody></table></div>
    <h3>٢. سجل البرامج</h3>
    <div class="tbl-wrap"><table><thead><tr><th>#</th><th>الرقم</th><th>البرنامج</th><th>النوع</th><th>المدرب</th><th>التاريخ</th><th>المدة</th><th>المتدربون</th><th>مع الديوان</th><th>مع المدرب</th></tr></thead><tbody>${P.map((p, i) => `<tr data-open="${esc(p.id)}"><td>${i + 1}</td><td>${esc(p.ref || "")}</td><td class="t">${esc(p.title)}</td><td>${esc(p.type || "")}</td><td>${esc(trainerName(p, state.trainers))}</td><td>${fmtDate(p.start_date)}${p.end_date !== p.start_date ? " – " + fmtDate(p.end_date) : ""}</td><td>${durationText(p)}</td><td>${p.participants || "—"}</td><td>${pill(GCA_STATUS, p.status_gca)}</td><td>${pill(TR_STATUS, p.status_trainer)}</td></tr>`).join("") || `<tr><td colspan="10" class="empty">لا برامج في هذه الفترة</td></tr>`}</tbody></table></div>
    <h3>٣. توزيع البرامج على المدربين</h3>
    <div class="tbl-wrap"><table><thead><tr><th>المدرب</th><th>التخصص</th><th>البرامج</th><th>الساعات</th><th>منفَّذ</th><th>تم الصرف</th></tr></thead><tbody>${byTrainer.map(({ t, ps }) => `<tr><td class="t">${esc(t.name)}</td><td>${esc(t.specialty || "")}</td><td>${ps.length}</td><td>${ps.reduce((s, p) => s + (+(p.hours || 0)), 0)}</td><td>${ps.filter((p) => p.status_gca === "منفَّذ").length}</td><td>${ps.filter((p) => p.status_trainer === "تم الصرف").length}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">لا بيانات</td></tr>`}</tbody></table></div>
    <div class="pcard-f" style="margin-top:18px;border-radius:8px"><span>يسير لإدارة المشاريع · info@yaaseer.com · +966 50 168 3310 · الرياض</span><span>وثيقة متابعة مشتركة — للاستخدام بين الطرفين</span></div>`;
}

export function cardHtml(p: Program): string {
  const t = state.trainers.find((x) => x.id === p.trainer_id);
  return `<div class="pcard">
    <div class="pcard-h"><div class="bars"><i></i><i></i><i></i><i></i></div><div class="who"><b>يسير لإدارة المشاريع</b><span>بطاقة برنامج تدريبي — ديوان المحاسبة العامة</span></div><div class="ref">الرقم المرجعي<b>${esc(p.ref || "—")}</b></div></div>
    <div class="pcard-title"><h2>${esc(p.title)}</h2><div class="type">${esc(p.type || "")}${p.mode ? ` · ${esc(p.mode)}` : ""}</div></div>
    <div class="pcard-status"><div class="st"><small>الحالة مع ديوان المحاسبة العامة</small>${pill(GCA_STATUS, p.status_gca)}</div><div class="st"><small>الحالة مع المدرب</small>${pill(TR_STATUS, p.status_trainer)}</div></div>
    <div class="kv">
      <div><small>المدرب</small><b>${esc(t?.name || "—")}</b>${t?.specialty ? `<span class="sub" style="display:block;font-size:12px;color:var(--muted)">${esc(t.specialty)}${t.qualification ? " · " + esc(t.qualification) : ""}</span>` : ""}</div>
      <div><small>تاريخ البداية</small><b>${fmtLong(p.start_date)}</b></div>
      <div><small>تاريخ النهاية</small><b>${fmtLong(p.end_date)}</b></div>
      <div><small>المدة</small><b>${durationText(p)}</b></div>
      <div><small>مكان التنفيذ</small><b>${esc(p.location || "—")}</b></div>
      <div><small>الفئة المستهدفة</small><b>${esc(p.target_group || "—")}</b></div>
      <div><small>عدد المتدربين</small><b>${p.participants || "—"}</b></div>
      <div><small>المسؤول من جهة الديوان</small><b>${esc(p.gca_contact || "—")}</b></div>
    </div>
    ${p.notes ? `<div class="pcard-notes"><small>ملاحظات</small>${esc(p.notes)}</div>` : ""}
    <div class="pcard-f"><span>يسير لإدارة المشاريع · info@yaaseer.com · +966 50 168 3310</span><span>صدرت في ${fmtLong(today())}${p.updated_at ? ` · آخر تحديث ${fmtDate(p.updated_at.slice(0, 10))}` : ""}</span></div>
  </div>`;
}

export function renderAll(): void {
  renderGallery();
  renderKpis();
  renderBars("#chartGca", GCA_STATUS, "status_gca", "#cntGca");
  renderBars("#chartTr", TR_STATUS, "status_trainer", "#cntTr");
  renderMonths();
  renderUpcoming();
  renderTrainerLoad();
  renderPrograms();
  renderTrainers();
  renderReport();
}

export function fillStaticSelects(): void {
  fill("#p_type", TYPES);
  fill("#p_statusGca", GCA_STATUS.map((s) => s[0]));
  fill("#p_statusTrainer", TR_STATUS.map((s) => s[0]));
  fill("#fType", TYPES, "كل الأنواع");
  fill("#fGca", GCA_STATUS.map((s) => s[0]), "كل حالات الديوان");
  fill("#fTr", TR_STATUS.map((s) => s[0]), "كل حالات المدربين");
  fill("#rGca", GCA_STATUS.map((s) => s[0]), "كل الحالات");
  fill("#t_status", TRAINER_STATUS.map((s) => s[0]));
}

export function wireFilterInputs(): void {
  ["fSearch", "fType", "fGca", "fTr", "fTrainer"].forEach((id) => $(`#${id}`)?.addEventListener("input", renderPrograms));
  ["rGca", "rFrom", "rTo"].forEach((id) => $(`#${id}`)?.addEventListener("input", renderReport));
}

export function wireTabs(): void {
  $$(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      $$(".tab").forEach((x) => x.setAttribute("aria-selected", String(x === t)));
      $$(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + (t as HTMLElement).dataset.tab));
      try {
        localStorage.setItem("gca.tab", (t as HTMLElement).dataset.tab || "");
      } catch {
        /* ignore */
      }
    })
  );
  try {
    const s = localStorage.getItem("gca.tab");
    if (s) ($(`.tab[data-tab="${s}"]`) as HTMLElement | null)?.click();
  } catch {
    /* ignore */
  }
}
