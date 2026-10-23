import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/tokens.css";
import "./privacy.css";
import { PrivacyPage } from "./PrivacyPage";
import { resolvePrivacyLocale } from "./privacyLocale";

// 隱私說明頁：公開靜態內容（Google OAuth 品牌驗證會連到這裡），不載入 supabase／mapbox-gl。
let storage: Storage | null = null;
try { storage = window.localStorage; } catch { /* private mode */ }

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <PrivacyPage initialLocale={resolvePrivacyLocale(window.location.search, storage)} />
  </StrictMode>,
);
