import { getCurrentProfile, signIn, signOut } from "./auth";
import { ADMIN_EMAIL, VIEWER_EMAIL } from "./constants";
import { fetchPrograms, fetchTrainers } from "./data";
import { renderAll } from "./render";
import { state } from "./state";
import { $, $$, toast } from "./utils";

export async function refreshData(): Promise<void> {
  try {
    const [trainers, programs] = await Promise.all([fetchTrainers(), fetchPrograms()]);
    state.trainers = trainers;
    state.programs = programs;
    renderAll();
  } catch (e) {
    toast("تعذّر تحميل البيانات: " + ((e as Error)?.message || ""));
  }
}

function setIdentity(): void {
  const el = $("#identity");
  const nameEl = $("#idName");
  if (!el || !nameEl) return;
  el.className = "identity " + (state.role ?? "");
  document.body.classList.toggle("is-admin", state.role === "admin");
  if (state.role === "admin") {
    nameEl.innerHTML = `يسير لإدارة المشاريع <span>· صلاحية الإدارة</span>`;
  } else if (state.role === "viewer") {
    nameEl.innerHTML = `ديوان المحاسبة العامة <span>· صلاحية الاطلاع</span>`;
  } else {
    nameEl.innerHTML = "لم يتم الدخول";
  }
}

async function enterApp(): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) return;
  state.profile = profile;
  state.role = profile.role;
  setIdentity();
  const login = $("#login") as HTMLElement | null;
  if (login) login.style.display = "none";
  await refreshData();
}

function leaveApp(): void {
  state.profile = null;
  state.role = null;
  setIdentity();
  const login = $("#login") as HTMLElement | null;
  if (login) login.style.display = "";
  state.trainers = [];
  state.programs = [];
  renderAll();
}

function showAuthError(msg: string): void {
  const el = $("#authError") as HTMLElement | null;
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

function clearAuthError(): void {
  const el = $("#authError") as HTMLElement | null;
  if (el) el.hidden = true;
}

function wireRoleLogin(roleBtnId: string, pwRowId: string, pwInputId: string, goBtnId: string, email: string): void {
  const roleBtn = $(`#${roleBtnId}`) as HTMLButtonElement | null;
  const pwRow = $(`#${pwRowId}`) as HTMLElement | null;
  const pwInput = $(`#${pwInputId}`) as HTMLInputElement | null;
  const goBtn = $(`#${goBtnId}`) as HTMLButtonElement | null;

  roleBtn?.addEventListener("click", () => {
    clearAuthError();
    $$<HTMLElement>(".pw").forEach((row) => {
      if (row !== pwRow) {
        row.classList.remove("show");
        const input = row.querySelector<HTMLInputElement>("input[type=password]");
        if (input) input.value = "";
      }
    });
    pwRow?.classList.add("show");
    pwInput?.focus();
  });

  const attempt = async () => {
    const password = pwInput?.value || "";
    if (!password) return;
    clearAuthError();
    if (goBtn) goBtn.disabled = true;
    try {
      await signIn(email, password);
      if (pwInput) pwInput.value = "";
    } catch (err) {
      showAuthError((err as Error)?.message || "تعذّر تسجيل الدخول — تحقق من كلمة المرور");
    } finally {
      if (goBtn) goBtn.disabled = false;
    }
  };

  goBtn?.addEventListener("click", attempt);
  pwInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") attempt();
  });
}

export function wireAuth(): void {
  wireRoleLogin("roleAdmin", "pwRowAdmin", "pwAdmin", "pwGoAdmin", ADMIN_EMAIL);
  wireRoleLogin("roleViewer", "pwRowViewer", "pwViewer", "pwGoViewer", VIEWER_EMAIL);

  $("#btnLogout")?.addEventListener("click", async () => {
    await signOut();
  });
}

export async function bootAuth(): Promise<void> {
  const { supabase } = await import("./supabaseClient");
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) enterApp();
    else leaveApp();
  });
  const { data } = await supabase.auth.getSession();
  if (data.session) await enterApp();
  else leaveApp();
}
