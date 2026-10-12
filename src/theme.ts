const KEY = "gca.theme";
type Theme = "light" | "dark";

const systemPrefersDark = (): boolean => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

const storedTheme = (): Theme | null => {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
};

const effectiveTheme = (): Theme => storedTheme() ?? (systemPrefersDark() ? "dark" : "light");

const svg = (body: string): string =>
  `<svg class="theme-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const SUN = svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>');
const MOON = svg('<path d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a8.4 8.4 0 1 0 10.8 10.8z"/>');

function updateButtons(): void {
  const isDark = effectiveTheme() === "dark";
  const icon = isDark ? SUN : MOON;
  const label = isDark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن";
  document.querySelectorAll<HTMLButtonElement>(".theme-toggle").forEach((btn) => {
    btn.innerHTML = btn.classList.contains("theme-toggle-wide") ? `${icon}<span>${isDark ? "الوضع الفاتح" : "الوضع الداكن"}</span>` : icon;
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
  });
}

export function initTheme(): void {
  updateButtons();
  document.querySelectorAll<HTMLButtonElement>(".theme-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next: Theme = effectiveTheme() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
      updateButtons();
    });
  });
}
