import { AR_MONTHS } from "./constants";
import type { Program, Trainer } from "./types";

export const $ = <T extends Element = Element>(sel: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(sel);

export const $$ = <T extends Element = Element>(sel: string, root: ParentNode = document): T[] =>
  [...root.querySelectorAll<T>(sel)];

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export const tone = (list: [string, string][], v: string | null | undefined): string =>
  (list.find((x) => x[0] === v) || [v ?? "", "neutral"])[1];

export const pill = (list: [string, string][], v: string | null | undefined): string =>
  `<span class="pill ${tone(list, v)}">${esc(v || "—")}</span>`;

export const fmtDate = (d: string | null | undefined): string => {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
};

export const fmtLong = (d: string | null | undefined): string => {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${+dd} ${AR_MONTHS[+m - 1]} ${y}`;
};

export const fmtMonth = (m: string): string => {
  const [y, mm] = m.split("-");
  return `${AR_MONTHS[+mm - 1]} ${y}`;
};

export const today = (): string => new Date().toISOString().slice(0, 10);

export const daysBetween = (a: string, b: string): number =>
  Math.max(1, Math.round((+new Date(b) - +new Date(a)) / 864e5) + 1);

export const trainerName = (p: Program, trainers: Trainer[]): string =>
  trainers.find((t) => t.id === p.trainer_id)?.name || "—";

export const durationText = (p: Program): string => {
  const d = p.days || (p.start_date && p.end_date ? daysBetween(p.start_date, p.end_date) : 0);
  const parts: string[] = [];
  if (d) parts.push(`${d} ${d === 1 ? "يوم" : d === 2 ? "يومان" : d <= 10 ? "أيام" : "يومًا"}`);
  if (p.hours) parts.push(`${p.hours} ساعة`);
  return parts.join(" · ") || "—";
};

export const inRange = (p: Program, from: string, to: string): boolean => {
  if (!p.start_date) return true;
  const m = p.start_date.slice(0, 7);
  return (!from || m >= from) && (!to || m <= to);
};

export const fill = (
  sel: string,
  items: (string | [string, string])[],
  withEmpty?: string
): void => {
  const el = $<HTMLSelectElement>(sel);
  if (!el) return;
  const cur = el.value;
  el.innerHTML =
    (withEmpty ? `<option value="">${withEmpty}</option>` : "") +
    items
      .map((i) =>
        Array.isArray(i) ? `<option value="${esc(i[0])}">${esc(i[1])}</option>` : `<option value="${esc(i)}">${esc(i)}</option>`
      )
      .join("");
  el.value = cur;
};

let toastTimer: ReturnType<typeof setTimeout>;
export const toast = (msg: string): void => {
  const t = $<HTMLDivElement>("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
};

export const openModal = (id: string): void => $(`#${id}`)?.classList.add("open");
export const closeModal = (id: string): void => $(`#${id}`)?.classList.remove("open");

export const csv = (rows: unknown[][]): string =>
  "﻿" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");

export const save = async (filename: string, data: string | Blob): Promise<void> => {
  try {
    const blob =
      data instanceof Blob
        ? data
        : new Blob([data], {
            type: filename.endsWith(".csv") ? "text/csv;charset=utf-8" : filename.endsWith(".json") ? "application/json" : "text/html;charset=utf-8",
          });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
    toast("بدأ التنزيل");
  } catch {
    toast("تعذّر التنزيل");
  }
};
