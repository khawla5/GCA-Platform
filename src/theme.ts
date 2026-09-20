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

function updateButtons(): void {
  const isDark = effectiveTheme() === "dark";
  const label = isDark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن";
  document.querySelectorAll<HTMLButtonElement>(".theme-toggle").forEach((btn) => {
    btn.textContent = isDark ? "☀️" : "🌙";
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
