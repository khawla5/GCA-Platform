import { AR_MONTHS, DEFAULT_CARD_COLOR, GCA_STATUS, PAYMENT_STATUS, PO_PAYMENT_STATUS, STATUS_CARD_COLORS, TR_STATUS, TRAINER_STATUS, TYPES } from "./constants";
import { renderPayments } from "./payments";
import { state } from "./state";
import type { Program, ProgramPayment } from "./types";
import {
  $, $$, daysBetween, durationText, esc, fill, fmtDate, fmtLong, fmtMonth, inRange, pill, today, tone, trainerName,
} from "./utils";

const GALLERY_STATUS_PRIORITY: Record<string, number> = {
  "قيد التنفيذ": 0,
  "بانتظار صدور أمر الشراء": 1,
  "منجز": 2,
};

// نسبة الإنجاز مبنية على مرور الأيام بين تاريخ البداية والنهاية
export function progressPct(startDate: string | null | undefined, endDate: string | null | undefined, statusGca?: string): number {
  if (!startDate || !endDate) return 0;
  const t = today();
  if (statusGca === "منجز" || t > endDate) return 100;
  if (t < startDate) return 0;
  return Math.round((daysBetween(startDate, t) / daysBetween(startDate, endDate)) * 100);
}

export function progressStatusLabel(pct: number): string {
  if (pct >= 100) return "منجز";
  if (pct > 0) return "قيد التنفيذ";
  return "بانتظار صدور أمر الشراء";
}

// شريط تقدّم البرنامج (بدل عجلة المراحل)
export function buildProgressLine(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  statusGca?: string,
  compact = false
): string {
  if (!startDate || !endDate) {
    return `<div class="stage-progress${compact ? " sp-compact" : ""}"><span class="sp-empty">حدّد تاريخ البداية والنهاية لعرض نسبة الإنجاز</span></div>`;
  }
  const pct = progressPct(startDate, endDate, statusGca);

  if (compact) {
    return `<div class="stage-progress sp-compact">
    <div class="sp-bar"><div class="sp-fill" style="width:${pct}%"></div></div>
    <span class="sp-pct">${pct}%</span>
  </div>`;
  }
  return `<div class="stage-progress">
    <span class="sp-item sp-start"><i class="sp-ic sp-ic-cal"></i>تاريخ البداية <b>${esc(fmtDate(startDate))}</b></span>
    <div class="sp-bar"><div class="sp-fill" style="width:${pct}%"></div></div>
    <span class="sp-pct">${pct}%</span>
    <span class="sp-item sp-deadline"><i class="sp-ic sp-ic-cal"></i>الموعد النهائي <b>${esc(fmtDate(endDate))}</b></span>
  </div>`;
}

export function renderGallery(): void {
  const rail = $("#galleryRail");
  if (!rail) return;
  const P = state.programs;

  const countEl = $("#galleryCount");
  if (countEl) countEl.textContent = P.length ? `(${P.length})` : "";

  const done = P.filter((p) => p.status_gca === "منجز").length;
  const progressLabel = $("#galleryProgressLabel");
  if (progressLabel) progressLabel.textContent = P.length ? `${done} من ${P.length} برنامج منجز` : "";
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
      const clickAttr = state.role === "admin" ? `data-edit="${esc(p.id)}"` : `data-open="${esc(p.id)}"`;
      const isCurrent = current && p.id === current.id;
      const color = STATUS_CARD_COLORS[p.status_gca] || DEFAULT_CARD_COLOR;
      const isGoldCard = p.status_gca === "منجز";
      return `<article class="prog-card${isCurrent ? " is-current" : ""}${isGoldCard ? " is-gold-card" : ""}" style="--card-color:${color}" ${clickAttr}>
        <div class="bars-wm"><i></i><i></i><i></i><i></i></div>
        <div class="row1"><span class="eyebrow">${esc(p.type || "—")}</span><span class="ref">${esc(p.ref || "—")}</span></div>
        <h4>${esc(p.title)}</h4>
        <div class="meta"><span class="avatar">${esc(initial)}</span>${esc(trainerName)}${t?.specialty ? ` · ${esc(t.specialty)}` : ""}</div>
        <div class="stats-row">
          ${pill(GCA_STATUS, p.status_gca)}
        </div>
        ${buildProgressLine(p.start_date, p.end_date, p.status_gca, true)}
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
  const done = P.filter((p) => p.status_gca === "منجز").length;
  const pending = P.filter((p) => p.status_gca === "بانتظار صدور أمر الشراء").length;
  const hours = P.reduce((s, p) => s + (+(p.hours || 0)), 0);
  const trainees = P.filter((p) => p.status_gca === "منجز").reduce((s, p) => s + (+(p.participants || 0)), 0);
  const allTrainees = P.reduce((s, p) => s + (+(p.participants || 0)), 0);
  const thisMonth = P.filter((p) => (p.start_date || "").slice(0, 7) === tm).length;
  const active = T.filter((t) => t.status === "نشط").length;

  const k: [string, number, string, string][] = [
    ["إجمالي البرامج", P.length, `${thisMonth} هذا الشهر`, ""],
    ["قيد التنفيذ", running, "برامج جارية الآن", "gold"],
    ["منجزة", done, `${trainees} متدرب`, "ok"],
    ["بانتظار صدور أمر الشراء", pending, "تحتاج متابعة", pending ? "warn" : ""],
    ["مدربون نشطون", active, `من أصل ${T.length}`, ""],
    ["ساعات تدريبية", hours, "إجمالي البرامج", ""],
    ["عدد المتدربين", allTrainees, "في كل البرامج", ""],
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
        const color = STATUS_CARD_COLORS[s] || `var(--${t === "gold" ? "gold" : t === "neutral" ? "faint" : t})`;
        return `<div class="brow"><span class="lbl">${esc(s)}</span><div class="trk"><div class="fil" style="width:${(n / max) * 100}%;background:${color}"></div></div><span class="val">${n}</span></div>`;
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
    .filter((p) => p.start_date && p.start_date >= t && p.start_date <= lim)
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
            `<tr data-trainer="${esc(r.t.id)}"><td class="t">${esc(r.t.name)}</td><td>${pill(TRAINER_STATUS, r.t.status)}</td><td>${r.n}</td><td>${r.run}</td><td>${r.h}</td><td>${r.last ? esc(r.last.title) + `<span class="sub">${fmtDate(r.last.start_date)}</span>` : "—"}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="empty">لم يُضف مدربون بعد</td></tr>`;
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

function programRowIdentity(p: Program): string {
  return `<tr data-open="${esc(p.id)}"><td><span class="sub" style="font-size:12.5px">${esc(p.ref || "—")}</span></td><td><span class="t">${esc(p.title)}</span>${p.target_group ? `<span class="sub">${esc(p.target_group)}</span>` : ""}</td><td>${esc(p.type || "—")}</td><td>${esc(trainerName(p, state.trainers))}</td>`;
}

// نسخة بتاريخي بداية ونهاية منفصلين — لجدول "الحالة مع الديوان العام للمحاسبة"
function programRowStartSplitDates(p: Program): string {
  return `${programRowIdentity(p)}<td>${fmtDate(p.start_date)}</td><td>${fmtDate(p.end_date)}</td><td>${durationText(p)}</td>`;
}

function programRowEdit(p: Program): string {
  return `<td class="admin-only"><div class="icons"><button class="btn sm" data-edit="${esc(p.id)}">✎</button></div></td>`;
}

const programRowEnd = "</tr>";

const fmtMoney = (n: number | null): string => (n == null ? "—" : n.toLocaleString("ar-SA"));

// صف جدول "مدفوعات المشاريع مع المركز" — دفعة واحدة (من program_payments) مع بيانات برنامجها
// ترتيب أعمدة محدد: شهادة الإنجاز، الفاتورة، أمر الشراء، البرنامج، المسار، النوع، قيمة العقد،
// الدفعة المستحقة، نسبة الاستحقاق، قيمة الاستحقاق، تاريخ الاستحقاق، حالة الدفع
function programPaymentRow(pp: ProgramPayment, p: Program): string {
  return `<tr data-open="${esc(p.id)}">
    <td>${esc(pp.coc_number || "—")}</td>
    <td>${esc(pp.invoice_number || "—")}</td>
    <td><span class="sub" style="font-size:12.5px">${esc(p.ref || "—")}</span></td>
    <td><span class="t">${esc(p.title)}</span></td>
    <td>${esc(p.type || "—")}</td>
    <td>${fmtMoney(p.contract_value)}</td>
    <td>${esc(pp.due_portion || "—")}</td>
    <td>${pp.entitlement_percent != null ? `${pp.entitlement_percent}%` : "—"}</td>
    <td>${fmtMoney(pp.entitlement_value)}</td>
    <td>${fmtDate(pp.due_date)}</td>
    <td>${pill(PAYMENT_STATUS, pp.payment_status)}</td>
    ${programRowEdit(p)}
  </tr>`;
}

const GCA_PAGE_SIZE = 10;
let gcaPage = 1;
let trPage = 1;

export function renderPrograms(): void {
  fill("#fTrainer", state.trainers.map((t) => [t.id, t.name] as [string, string]), "كل المدربين");
  const rows = filteredPrograms();
  const emptyMsg = (label: string, cols: number) =>
    `<tr><td colspan="${cols}"><div class="empty"><b>${label}</b>${state.role === "admin" ? "أضف برنامجًا جديدًا من الزر أعلاه" : "سيظهر هنا ما تضيفه يسير من برامج"}</div></td></tr>`;

  const totalPages = Math.max(1, Math.ceil(rows.length / GCA_PAGE_SIZE));
  gcaPage = Math.min(Math.max(1, gcaPage), totalPages);
  const pageRows = rows.slice((gcaPage - 1) * GCA_PAGE_SIZE, gcaPage * GCA_PAGE_SIZE);

  const gcaBody = $("#programsBodyGca");
  if (gcaBody) {
    gcaBody.innerHTML = pageRows.length
      ? pageRows.map((p) => `${programRowStartSplitDates(p)}<td>${pill(GCA_STATUS, p.status_gca)}</td>${programRowEdit(p)}${programRowEnd}`).join("")
      : emptyMsg("لا توجد برامج مطابقة", 9);
  }
  const cntGca = $("#programsCountGca");
  if (cntGca) cntGca.textContent = `${rows.length} من ${state.programs.length} برنامج`;

  const prevBtn = $("#gcaPagerPrev") as HTMLButtonElement | null;
  const nextBtn = $("#gcaPagerNext") as HTMLButtonElement | null;
  const pagerLabel = $("#gcaPagerLabel");
  if (prevBtn) prevBtn.disabled = gcaPage <= 1;
  if (nextBtn) nextBtn.disabled = gcaPage >= totalPages;
  if (pagerLabel) pagerLabel.textContent = `صفحة ${gcaPage} من ${totalPages}`;

  const trBody = $("#programsBodyTr");
  const allowedIds = new Set(rows.map((p) => p.id));
  const trQuery = (($("#fTrSearch") as HTMLInputElement)?.value || "").trim();
  const trType = (($("#fTrType") as HTMLSelectElement)?.value || "").trim();
  const trStatus = (($("#fTrStatus") as HTMLSelectElement)?.value || "").trim();
  const ppRows = state.programPayments
    .filter((pp) => allowedIds.has(pp.program_id))
    .map((pp) => ({ pp, p: state.programs.find((x) => x.id === pp.program_id) }))
    .filter((x): x is { pp: ProgramPayment; p: Program } => !!x.p)
    .filter(({ p }) => !trQuery || p.title.includes(trQuery) || (p.ref || "").includes(trQuery))
    .filter(({ p }) => !trType || p.type === trType)
    .filter(({ pp }) => !trStatus || pp.payment_status === trStatus)
    .sort((a, b) => (a.pp.due_date || "").localeCompare(b.pp.due_date || ""));

  const trTotalPages = Math.max(1, Math.ceil(ppRows.length / GCA_PAGE_SIZE));
  trPage = Math.min(Math.max(1, trPage), trTotalPages);
  const ppPageRows = ppRows.slice((trPage - 1) * GCA_PAGE_SIZE, trPage * GCA_PAGE_SIZE);

  if (trBody) {
    trBody.innerHTML = ppPageRows.length
      ? ppPageRows.map(({ pp, p }) => programPaymentRow(pp, p)).join("")
      : emptyMsg("لا توجد دفعات مطابقة", 12);
  }
  const cntTr = $("#programsCountTr");
  if (cntTr) cntTr.textContent = `${ppRows.length} من ${state.programPayments.length} دفعة`;

  const trPrevBtn = $("#trPagerPrev") as HTMLButtonElement | null;
  const trNextBtn = $("#trPagerNext") as HTMLButtonElement | null;
  const trPagerLabel = $("#trPagerLabel");
  if (trPrevBtn) trPrevBtn.disabled = trPage <= 1;
  if (trNextBtn) trNextBtn.disabled = trPage >= trTotalPages;
  if (trPagerLabel) trPagerLabel.textContent = `صفحة ${trPage} من ${trTotalPages}`;
}

export function renderTrainers(): void {
  const T = state.trainers.slice().sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const el = $("#trainersBody");
  if (!el) return;
  el.innerHTML = T.length
    ? T.map((t) => {
        const ps = state.programs.filter((p) => p.trainer_id === t.id);
        return `<tr data-trainer="${esc(t.id)}"><td class="t">${esc(t.name)}${t.city ? `<span class="sub">${esc(t.city)}</span>` : ""}${t.cv_url ? `<a href="${esc(t.cv_url)}" target="_blank" rel="noopener" class="sub" onclick="event.stopPropagation()">📄 CV</a>` : ""}</td><td dir="ltr" style="text-align:end">${esc(t.email || "—")}</td><td dir="ltr" style="text-align:end">${esc(t.phone || "—")}</td><td>${pill(TRAINER_STATUS, t.status)}</td><td>${ps.length}</td><td>${ps.reduce((s, p) => s + (+(p.hours || 0)), 0)}</td><td class="admin-only"><button class="btn sm" data-edit-trainer="${esc(t.id)}">✎</button></td></tr>`;
      }).join("")
    : `<tr><td colspan="7"><div class="empty"><b>لا يوجد مدربون بعد</b>${state.role === "admin" ? "أضف أول مدرب من الزر أعلاه" : ""}</div></td></tr>`;
}

export function renderReport(): void {
  const g = ($("#rGca") as HTMLSelectElement)?.value || "";
  const from = ($("#rFrom") as HTMLInputElement)?.value || "";
  const to = ($("#rTo") as HTMLInputElement)?.value || "";
  const P = state.programs.filter((p) => (!g || p.status_gca === g) && inRange(p, from, to)).sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
  const hours = P.reduce((s, p) => s + (+(p.hours || 0)), 0);
  const trainees = P.reduce((s, p) => s + (+(p.participants || 0)), 0);
  const byStatus = TR_STATUS.map(([s]) => [s, P.filter((p) => p.status_trainer === s).length] as [string, number]).filter((x) => x[1]);
  const byTrainer = state.trainers.map((t) => ({ t, ps: P.filter((p) => p.trainer_id === t.id) })).filter((x) => x.ps.length);
  const period = from || to ? `${from ? fmtMonth(from) : "البداية"} — ${to ? fmtMonth(to) : "الآن"}` : "كامل المدة";

  const el = $("#report");
  if (!el) return;
  el.innerHTML = `
    <div class="rh"><div class="bars"><i></i><i></i><i></i><i></i></div><h2>تقرير متابعة توريد المدربين — الديوان العام للمحاسبة</h2><div class="meta">أُعدّ بواسطة: يسير لإدارة المشاريع<br>تاريخ الإصدار: ${fmtLong(today())}<br>الفترة: ${period}${g ? `<br>الحالة: ${esc(g)}` : ""}</div></div>
    <div class="rsum"><div><b>${P.length}</b><span>برنامج</span></div><div><b>${byTrainer.length}</b><span>مدرب</span></div><div><b>${hours}</b><span>ساعة تدريبية</span></div><div><b>${trainees}</b><span>متدرب</span></div><div><b>${P.filter((p) => p.status_gca === "منجز").length}</b><span>برنامج منجز</span></div></div>
    <h3>١. ملخص الحالة مع المدرب</h3>
    <div class="tbl-wrap"><table><thead><tr><th>الحالة</th><th>عدد البرامج</th><th>النسبة</th></tr></thead><tbody>${byStatus.map(([s, n]) => `<tr><td>${pill(TR_STATUS, s)}</td><td>${n}</td><td>${Math.round((n / P.length) * 100)}%</td></tr>`).join("") || `<tr><td colspan="3" class="empty">لا بيانات</td></tr>`}</tbody></table></div>
    <h3>٢. سجل البرامج</h3>
    <div class="tbl-wrap"><table><thead><tr><th>#</th><th>رقم الأمر</th><th>البرنامج</th><th>النوع</th><th>المدرب</th><th>تاريخ البداية</th><th>تاريخ النهاية</th><th>المدة</th><th>المتدربون</th><th>مع الديوان</th><th>مع المدرب</th></tr></thead><tbody>${P.map((p, i) => `<tr data-open="${esc(p.id)}"><td>${i + 1}</td><td>${esc(p.ref || "")}</td><td class="t">${esc(p.title)}</td><td>${esc(p.type || "")}</td><td>${esc(trainerName(p, state.trainers))}</td><td>${fmtDate(p.start_date)}</td><td>${fmtDate(p.end_date)}</td><td>${durationText(p)}</td><td>${p.participants || "—"}</td><td>${pill(GCA_STATUS, p.status_gca)}</td><td>${pill(TR_STATUS, p.status_trainer)}</td></tr>`).join("") || `<tr><td colspan="11" class="empty">لا برامج في هذه الفترة</td></tr>`}</tbody></table></div>
    <h3>٣. توزيع البرامج على المدربين</h3>
    <div class="tbl-wrap"><table id="trainerDistTable"><thead><tr><th>المدرب</th><th>عدد البرامج</th><th>عدد الساعات</th></tr></thead><tbody>${byTrainer.map(({ t, ps }) => `<tr><td class="t">${esc(t.name)}</td><td>${ps.length}</td><td>${ps.reduce((s, p) => s + (+(p.hours || 0)), 0)}</td></tr>`).join("") || `<tr><td colspan="3" class="empty">لا بيانات</td></tr>`}</tbody></table></div>
    <div class="pcard-f" style="margin-top:18px;border-radius:8px"><span>يسير لإدارة المشاريع · info@yaaseer.com · +966 50 168 3310 · الرياض</span><span>وثيقة متابعة مشتركة — للاستخدام بين الطرفين</span></div>`;
}

export function cardHtml(p: Program): string {
  const t = state.trainers.find((x) => x.id === p.trainer_id);
  return `<div class="pcard">
    <div class="pcard-h"><img src="/images/gca-emblem.png" alt="" class="pcard-emblem"><div class="who"><b>الديوان العام للمحاسبة</b><span>بطاقة برنامج تدريبي</span></div><div class="ref">رقم أمر الشراء<b>${esc(p.ref || "—")}</b></div></div>
    <div class="pcard-title"><h2>${esc(p.title)}</h2><div class="type">${esc(p.type || "")}${p.mode ? ` · ${esc(p.mode)}` : ""}</div></div>
    <div class="pcard-status"><div class="st"><small>الحالة مع الديوان العام للمحاسبة</small>${pill(GCA_STATUS, p.status_gca)}</div><div class="st"><small>الحالة مع المدرب</small>${pill(TR_STATUS, p.status_trainer)}</div></div>
    <div class="kv">
      <div><small>المدرب</small><b>${esc(t?.name || "—")}</b>${t?.specialty ? `<span class="sub" style="display:block;font-size:12px;color:var(--muted)">${esc(t.specialty)}${t.qualification ? " · " + esc(t.qualification) : ""}</span>` : ""}</div>
      <div><small>تاريخ البداية</small><b>${fmtLong(p.start_date)}</b></div>
      <div><small>تاريخ النهاية</small><b>${fmtLong(p.end_date)}</b></div>
      <div><small>المدة</small><b>${durationText(p)}</b></div>
      <div><small>مكان التنفيذ</small><b>${esc(p.location || "—")}</b></div>
      <div><small>عدد المتدربين</small><b>${p.participants || "—"}</b></div>
      <div><small>المسؤول من جهة الديوان</small><b>${esc(p.gca_contact || "—")}</b></div>
    </div>
    ${p.notes ? `<div class="pcard-notes"><small>ملاحظات</small>${esc(p.notes)}</div>` : ""}
    <div class="pcard-f"><span>يسير لإدارة المشاريع · info@yaaseer.com · +966 50 168 3310</span><span>صدرت في ${fmtLong(today())}${p.updated_at ? ` · آخر تحديث ${fmtDate(p.updated_at.slice(0, 10))}` : ""}</span></div>
  </div>`;
}

// نسخة مستقلة بالكامل للتنزيل — ألوان ثابتة (وضع فاتح فقط) بدل الاعتماد على متغيرات الثيم وكل ستايلات الموقع،
// عشان تبان بنفس الشكل أيًا كان المتصفح أو وضع الجهاز (فاتح/غامق) اللي يفتح فيه الملف
const CARD_TONE_COLORS: Record<string, { bg: string; fg: string }> = {
  ok: { bg: "#DDEBE1", fg: "#013B1B" },
  warn: { bg: "#F3EAD6", fg: "#8A6C3B" },
  bad: { bg: "#F5E2DF", fg: "#A4423A" },
  info: { bg: "#E3ECE5", fg: "#4E6B57" },
  neutral: { bg: "#ECEBE2", fg: "#5E6B60" },
  gold: { bg: "rgba(174,151,104,.18)", fg: "#A18355" },
  "gca-pending": { bg: "rgba(11,43,9,.15)", fg: "#0B2B09" },
  "gca-progress": { bg: "rgba(50,74,49,.15)", fg: "#324A31" },
  "gca-done": { bg: "rgba(122,98,56,.15)", fg: "#7A6238" },
};

function pillFixed(list: [string, string][], v: string | null | undefined): string {
  const t = tone(list, v);
  const c = CARD_TONE_COLORS[t] || CARD_TONE_COLORS.neutral;
  return `<span style="display:inline-flex;align-items:center;gap:6px;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap;background:${c.bg};color:${c.fg}"><i style="display:block;width:7px;height:7px;border-radius:50%;background:currentColor"></i>${esc(v || "—")}</span>`;
}

export function cardDownloadHtml(p: Program): string {
  const t = state.trainers.find((x) => x.id === p.trainer_id);
  const body = `<div class="pcard">
    <div class="pcard-h"><img src="/images/gca-emblem.png" alt="" class="pcard-emblem"><div class="who"><b>الديوان العام للمحاسبة</b><span>بطاقة برنامج تدريبي</span></div><div class="ref">رقم أمر الشراء<b>${esc(p.ref || "—")}</b></div></div>
    <div class="pcard-title"><h2>${esc(p.title)}</h2><div class="type">${esc(p.type || "")}${p.mode ? ` · ${esc(p.mode)}` : ""}</div></div>
    <div class="pcard-status"><div class="st"><small>الحالة مع الديوان العام للمحاسبة</small>${pillFixed(GCA_STATUS, p.status_gca)}</div><div class="st"><small>الحالة مع المدرب</small>${pillFixed(TR_STATUS, p.status_trainer)}</div></div>
    <div class="kv">
      <div><small>المدرب</small><b>${esc(t?.name || "—")}</b>${t?.specialty ? `<span style="display:block;font-size:12px;color:#5E6B60">${esc(t.specialty)}${t.qualification ? " · " + esc(t.qualification) : ""}</span>` : ""}</div>
      <div><small>تاريخ البداية</small><b>${fmtLong(p.start_date)}</b></div>
      <div><small>تاريخ النهاية</small><b>${fmtLong(p.end_date)}</b></div>
      <div><small>المدة</small><b>${durationText(p)}</b></div>
      <div><small>مكان التنفيذ</small><b>${esc(p.location || "—")}</b></div>
      <div><small>عدد المتدربين</small><b>${p.participants || "—"}</b></div>
      <div><small>المسؤول من جهة الديوان</small><b>${esc(p.gca_contact || "—")}</b></div>
    </div>
    ${p.notes ? `<div class="pcard-notes"><small>ملاحظات</small>${esc(p.notes)}</div>` : ""}
    <div class="pcard-f"><span>يسير لإدارة المشاريع · info@yaaseer.com · +966 50 168 3310</span><span>صدرت في ${fmtLong(today())}${p.updated_at ? ` · آخر تحديث ${fmtDate(p.updated_at.slice(0, 10))}` : ""}</span></div>
  </div>`;
  const style = `
    *{box-sizing:border-box}
    body{margin:0;padding:24px;background:#fff;color:#003218;font-family:"IBM Plex Sans Arabic",Tahoma,Arial,sans-serif;font-size:14.5px;line-height:1.6}
    h2{font-family:Tajawal,"IBM Plex Sans Arabic",Arial,sans-serif;margin:0;line-height:1.3}
    .pcard{border:1px solid #DDD3BC;border-radius:12px;overflow:hidden;max-width:640px;margin:0 auto}
    .pcard-h{background:#003218;color:#fff;padding:16px 20px;display:flex;gap:14px;align-items:center;border-bottom:3px solid #AE9768}
    .pcard-emblem{height:34px;width:auto;flex-shrink:0}
    .pcard-h .who{flex:1}
    .pcard-h .who b{font-family:Tajawal,sans-serif;font-size:16px;display:block}
    .pcard-h .who span{font-size:11.5px;opacity:.75}
    .pcard-h .ref{font-size:12px;opacity:.8;text-align:start}
    .pcard-h .ref b{display:block;font-size:14px;opacity:1;font-family:Tajawal,sans-serif}
    .pcard-title{padding:18px 20px 6px}
    .pcard-title h2{font-size:21px;font-weight:800}
    .pcard-title .type{color:#5E6B60;font-size:13px;margin-top:4px}
    .pcard-status{display:flex;gap:10px;flex-wrap:wrap;padding:8px 20px 14px}
    .pcard-status .st{border:1px solid #DDD3BC;border-radius:8px;padding:8px 12px;min-width:200px;flex:1}
    .pcard-status .st small{display:block;color:#5E6B60;font-size:11.5px;margin-bottom:4px}
    .kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0;border-top:1px solid #DDD3BC}
    .kv div{padding:10px 20px;border-bottom:1px solid #DDD3BC}
    .kv small{display:block;color:#5E6B60;font-size:11.5px}
    .kv b{font-weight:600}
    .pcard-notes{padding:12px 20px;font-size:13.5px;border-top:1px solid #DDD3BC}
    .pcard-notes small{display:block;color:#5E6B60;font-size:11.5px}
    .pcard-f{display:flex;justify-content:space-between;gap:10px;padding:10px 20px;background:#ECE6D6;font-size:11.5px;color:#5E6B60;flex-wrap:wrap}
    @media (max-width:480px){.pcard-f{flex-direction:column}}
  `;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>بطاقة ${esc(p.title)}</title><style>${style}</style></head><body>${body}</body></html>`;
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
  renderPayments();
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
  fill("#p_paymentStatus", PAYMENT_STATUS.map((s) => s[0]));
  fill("#pay_status", PO_PAYMENT_STATUS.map((s) => s[0]));
  fill("#fTrType", TYPES, "كل الأنواع");
  fill("#fTrStatus", PAYMENT_STATUS.map((s) => s[0]), "كل حالات الدفع");
}

export function wireFilterInputs(): void {
  ["fSearch", "fType", "fGca", "fTr", "fTrainer"].forEach((id) =>
    $(`#${id}`)?.addEventListener("input", () => {
      gcaPage = 1;
      trPage = 1;
      renderPrograms();
    })
  );
  ["rGca", "rFrom", "rTo"].forEach((id) => $(`#${id}`)?.addEventListener("input", renderReport));
  ["fTrSearch", "fTrType", "fTrStatus"].forEach((id) =>
    $(`#${id}`)?.addEventListener("input", () => {
      trPage = 1;
      renderPrograms();
    })
  );
  $("#gcaPagerPrev")?.addEventListener("click", () => {
    gcaPage--;
    renderPrograms();
  });
  $("#gcaPagerNext")?.addEventListener("click", () => {
    gcaPage++;
    renderPrograms();
  });
  $("#trPagerPrev")?.addEventListener("click", () => {
    trPage--;
    renderPrograms();
  });
  $("#trPagerNext")?.addEventListener("click", () => {
    trPage++;
    renderPrograms();
  });
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
