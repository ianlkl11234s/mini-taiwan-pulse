import type { PairingStatus } from "./bridgeClient";

/**
 * 本機免授權配對（dev autopair）：只在 Vite dev 且 VITE_RESEARCH_DEV_AUTOPAIR=1 時開啟。
 * 免 Google 登入、免配對碼、免按確認，但 Agent 仍綁定「這一個分頁」（study＋tabId）。
 * Gateway 端需同時以 PULSE_RESEARCH_DEV_AUTOPAIR=1 在 loopback 啟動，否則 dev token 會被拒。
 */
export const DEV_AUTOPAIR = import.meta.env.DEV && import.meta.env.VITE_RESEARCH_DEV_AUTOPAIR === "1";
/** Gateway 只在 dev 模式、loopback 來源接受這個固定 token，對應帳號 "dev-local"。 */
export const DEV_BROWSER_TOKEN = "dev-local";
export const DEV_USER_ID = "dev-local";
export const DEV_PAIRING_PLACEHOLDER = "dev-autopair";

/** 分頁辨識名稱；與 gateway devTabLabel 相同推導（tabId 前 3 個英數字大寫）。 */
export function devTabLabel(tabId: string): string {
  return tabId.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
}

/**
 * 待命配對：分頁永遠保有一張「等待中」的 pairing，讓新的 Agent 程序隨時能領取（含接手舊 Agent）。
 * approvedForSession 記錄 approve 當下的 session；出現不同的 active session 代表這張已被 exchange 用掉。
 */
export type Standby = { pairingId: string; expiresAt: number; approvedForSession?: string | null };
export type StandbyStep = { kind: "create" } | { kind: "approve"; phrase: string } | { kind: "wait" };

/** 剩這麼久就主動換新（gateway 會直接清掉過期 pairing，不能等錯誤才補）。 */
export const STANDBY_RENEW_MS = 30_000;

export function standbyStep(standby: Standby | null, status: PairingStatus | null, currentSessionId: string | null, now: number): StandbyStep {
  if (!standby) return { kind: "create" };
  if (standby.approvedForSession !== undefined) {
    // 已 approve：等 Agent exchange。換新會撤銷這張，所以只在被用掉或快過期時才建下一張。
    if (currentSessionId && currentSessionId !== standby.approvedForSession) return { kind: "create" };
    return now >= standby.expiresAt - 5_000 ? { kind: "create" } : { kind: "wait" };
  }
  if (now >= standby.expiresAt - STANDBY_RENEW_MS) return { kind: "create" };
  if (status?.pairingId === standby.pairingId && status.claimed && !status.approved && status.phrase) return { kind: "approve", phrase: status.phrase };
  return { kind: "wait" };
}

export type DevPanelState = { label: string; tone: "live" | "waiting"; title: string; detail: string };

/** 面板綠燈文字：已連線＝本機免授權・已連線；否則等待 Agent 連線。 */
export function devPanelState(tabId: string | null, online: boolean, paused: boolean): DevPanelState {
  const label = tabId ? `分頁 ${devTabLabel(tabId)}` : "分頁準備中";
  if (tabId && online) return { label, tone: "live", title: "本機免授權・已連線", detail: paused ? "操作已暫停；Agent 仍綁定這個分頁。" : "Agent 目前連到這個分頁。" };
  return { label, tone: "waiting", title: "等待 Agent 連線", detail: "本機免授權模式：Agent 第一次使用地圖工具時會自動接上這個分頁。" };
}
