/**
 * 會員自行刪除帳號（隱私說明 §刪除帳號）。
 *
 * 後端：gis-platform `public.delete_my_account()`（無參數，authenticated 可呼叫；站主帳號回 42501）。
 * 流程：RPC 成功 → 清本機與帳號相關的 localStorage → 本地登出（scope: "local"）。
 * - 帳號已在伺服器刪除，refresh token 隨之失效；不再打 GoTrue 的 logout（可能回 401/403），只清本地 session。
 * - 登出失敗仍算「已刪除」：帳號資料已不存在，只提示重新整理。
 * - 成功訊息放在模組層 store：登出後 App 以新 key 重掛 MemberPanel，元件 state 會消失。
 */
import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

export const DELETE_ACCOUNT_RPC = "delete_my_account";

/** 刪除成功後要清掉的本機 key：訪客收藏（memberLibraryStore）、研究頁登入 session（research/authClient）。 */
export const ACCOUNT_LOCAL_KEYS = ["pulse:guest-layer-favorites:v1", "pulse-research-auth-v1"] as const;

type RpcError = { code?: string; message?: string } | null;

export type AccountDeletionClient = {
  rpc: (name: string) => PromiseLike<{ error: RpcError }>;
  auth: { signOut: (options: { scope: "local" }) => Promise<{ error: unknown }> };
};

export type AccountDeletionResult =
  | { ok: true; signedOut: boolean }
  | { ok: false; reason: "owner" | "unavailable" | "failed"; detail: string };

function classify(error: NonNullable<RpcError>): "owner" | "unavailable" | "failed" {
  if (error.code === "42501") return "owner";
  // PGRST202：PostgREST 找不到函式（後端尚未部署）
  if (error.code === "PGRST202") return "unavailable";
  return "failed";
}

export async function deleteMyAccount(
  client: AccountDeletionClient = supabase as unknown as AccountDeletionClient,
  storage: Pick<Storage, "removeItem"> | null = safeLocalStorage(),
): Promise<AccountDeletionResult> {
  let error: RpcError;
  try {
    ({ error } = await client.rpc(DELETE_ACCOUNT_RPC));
  } catch (thrown) {
    return { ok: false, reason: "failed", detail: thrown instanceof Error ? thrown.message : String(thrown) };
  }
  if (error) return { ok: false, reason: classify(error), detail: error.message ?? error.code ?? "" };

  for (const key of ACCOUNT_LOCAL_KEYS) {
    try { storage?.removeItem(key); } catch { /* storage 不可用：略過 */ }
  }
  let signedOut = true;
  try {
    const { error: signOutError } = await client.auth.signOut({ scope: "local" });
    if (signOutError) signedOut = false;
  } catch {
    signedOut = false;
  }
  return { ok: true, signedOut };
}

function safeLocalStorage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

/* ── 刪除完成提示（跨 MemberPanel 重掛保留，關閉面板時清除） ── */

export type DeletionNotice = { signedOut: boolean } | null;
let notice: DeletionNotice = null;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };

export const accountDeletionNotice = {
  get: (): DeletionNotice => notice,
  set(next: DeletionNotice): void { notice = next; emit(); },
  clear(): void { if (notice) { notice = null; emit(); } },
  subscribe(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener); },
};

export function useAccountDeletionNotice(): DeletionNotice {
  return useSyncExternalStore(accountDeletionNotice.subscribe, accountDeletionNotice.get, accountDeletionNotice.get);
}
