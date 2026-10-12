const PAGE_SIZE = 10;
const pageOf = new Map<string, number>();
const rerenderOf = new Map<string, () => void>();

export function resetPage(tbodyId: string): void {
  pageOf.set(tbodyId, 1);
}

function mountPager(tbodyId: string, page: number, pages: number, visible: boolean): void {
  const wrap = document.getElementById(tbodyId)?.closest(".tbl-wrap");
  if (!wrap) return;

  let pager = wrap.nextElementSibling?.matches(`.pager[data-for="${tbodyId}"]`) ? (wrap.nextElementSibling as HTMLElement) : null;
  if (!pager) {
    pager = document.createElement("div");
    pager.className = "pager";
    pager.dataset.for = tbodyId;
    pager.innerHTML = `<span class="spacer"></span>
      <button type="button" class="btn sm" data-dir="-1">السابق</button>
      <span class="pager-label"></span>
      <button type="button" class="btn sm" data-dir="1">التالي</button>`;
    const hint = wrap.nextElementSibling?.matches("p.hint") ? wrap.nextElementSibling : null;
    if (hint) {
      hint.removeAttribute("style");
      pager.prepend(hint);
    }
    wrap.insertAdjacentElement("afterend", pager);
    pager.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-dir]");
      if (!btn || btn.disabled) return;
      pageOf.set(tbodyId, (pageOf.get(tbodyId) ?? 1) + Number(btn.dataset.dir));
      rerenderOf.get(tbodyId)?.();
    });
  }

  pager.hidden = !visible;
  pager.querySelector(".pager-label")!.textContent = `${page} / ${pages}`;
  pager.querySelector<HTMLButtonElement>('button[data-dir="-1"]')!.disabled = page <= 1;
  pager.querySelector<HTMLButtonElement>('button[data-dir="1"]')!.disabled = page >= pages;
}

export function paginate<T>(tbodyId: string, rows: T[], rerender: () => void): T[] {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageOf.get(tbodyId) ?? 1), pages);
  pageOf.set(tbodyId, page);
  rerenderOf.set(tbodyId, rerender);
  mountPager(tbodyId, page, pages, rows.length > 0);
  return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}
