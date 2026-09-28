import "./styles.css";
import { bootAuth, wireAuth } from "./boot";
import { fillStaticSelects, wireFilterInputs, wireGalleryShowAll, wireTabs } from "./render";
import { wireForms } from "./forms";
import { wirePaymentForms } from "./paymentForms";
import { wirePaymentFilters } from "./payments";
import { supabaseConfigured } from "./supabaseClient";
import { initTheme } from "./theme";
import { $ } from "./utils";

function warnIfUnconfigured(): void {
  if (supabaseConfigured) return;
  const banner = $("#banner") as HTMLElement | null;
  if (!banner) return;
  banner.textContent = "لم يتم ربط قاعدة بيانات Supabase بعد. انسخ .env.example إلى .env وأضف بيانات مشروعك، ثم أعد تشغيل الخادم.";
  banner.classList.add("show");
}

initTheme();
fillStaticSelects();
wireTabs();
wireFilterInputs();
wireGalleryShowAll();
wireForms();
wirePaymentForms();
wirePaymentFilters();
wireAuth();
warnIfUnconfigured();
bootAuth();
