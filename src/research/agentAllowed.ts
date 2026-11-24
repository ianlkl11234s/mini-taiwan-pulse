import { TEST_IDENTITY } from "./testIdentity";

/**
 * 分頁預設不開放 Agent 連線（2026-10-20：本機任何 Claude 對話呼叫地圖工具時，會自動接上唯一開著的分頁）。
 * 例外：本機測試身分、網址帶 `?agent=1`（自動測試用）、這個分頁先前已開放（重整沿用，存在 sessionStorage）。
 */
export const AGENT_ALLOWED_KEY = "pulse.research.agentAllowed.v1";
export function agentAllowedAtStart(): boolean {
  if (TEST_IDENTITY) return true;
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search ?? "").get("agent") === "1") { rememberAgentAllowed(true); return true; }
    return window.sessionStorage.getItem(AGENT_ALLOWED_KEY) === "1";
  } catch { return false; }
}
export function rememberAgentAllowed(allowed: boolean): void {
  try { if (allowed) window.sessionStorage.setItem(AGENT_ALLOWED_KEY, "1"); else window.sessionStorage.removeItem(AGENT_ALLOWED_KEY); } catch { /* private mode: only this page load */ }
}
