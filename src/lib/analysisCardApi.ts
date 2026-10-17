/**
 * 分析卡發布／撤銷／列出（migration 414：publish_analysis_card、revoke_analysis_card、
 * list_my_analysis_cards）。一律用主站已登入的 supabase client（owner JWT），函式內由 DB 的
 * is_owner() 把關；前端只負責把錯誤翻成白話。
 *
 * client 以參數注入（預設主站 client），測試用 mock，不連任何遠端。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { withLoading } from "./loadingRegistry";

export const CARD_PUBLIC_ORIGIN = "https://mini-taiwan-pulse.itsmigu.com";

type RpcError = { code?: string; message?: string } | null;
export type CardRpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError }>;
  auth: { getSession: () => Promise<{ data: { session: unknown | null } }> };
};

export type CardSummary = { slug: string; title: string; createdAt: string; expiresAt: string; revokedAt: string | null; bytes: number };
export type CardActionResult<T> = { ok: true; value: T } | { ok: false; message: string };

export function analysisCardUrl(slug: string): string {
  return `${CARD_PUBLIC_ORIGIN}/card/${slug}`;
}

/** 把 RPC 錯誤翻成使用者看得懂的一句話（代碼對照 migration 414 的 RAISE）。 */
export function cardErrorMessage(error: RpcError): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "42501" || /only owner/i.test(message)) return "只有站長（owner）帳號可以發布或管理分析卡；請用站長帳號登入主站後再試。";
  if (code === "22023" || /invalid analysis card payload/i.test(message)) return "卡片內容沒有通過伺服器檢查，請 Agent 重新產生草稿。";
  if (code === "PGRST202" || code === "42883" || /could not find the function/i.test(message)) return "伺服器尚未啟用分析卡功能（資料庫 migration 414 尚未套用）。";
  if (/quota|limit/i.test(message)) return "卡片數量已達上限（200 張），請先撤銷不需要的卡片。";
  return "操作沒有完成，請稍後再試。";
}

async function signedIn(client: CardRpcClient): Promise<boolean> {
  try { return Boolean((await client.auth.getSession()).data.session); } catch { return false; }
}

const NOT_SIGNED_IN = "請先在主站「會員專區」用站長帳號登入，再發布或管理分析卡。";

async function defaultClient(): Promise<CardRpcClient> {
  const { supabase } = await import("./supabase");
  return supabase as unknown as CardRpcClient & SupabaseClient;
}

export async function publishAnalysisCard(payload: unknown, client?: CardRpcClient): Promise<CardActionResult<{ slug: string; expiresAt: string; url: string }>> {
  const rpc = client ?? await defaultClient();
  if (!await signedIn(rpc)) return { ok: false, message: NOT_SIGNED_IN };
  const { data, error } = await withLoading("analysis-card-publish", "發布分析卡", rpc.rpc("publish_analysis_card", { p_payload: payload }));
  if (error) return { ok: false, message: cardErrorMessage(error) };
  const row = (Array.isArray(data) ? data[0] : data) as { slug?: unknown; expires_at?: unknown } | undefined;
  if (!row || typeof row.slug !== "string" || !/^[A-Za-z0-9_-]{16}$/.test(row.slug) || typeof row.expires_at !== "string") return { ok: false, message: "伺服器回傳的連結格式不正確，請稍後再試。" };
  return { ok: true, value: { slug: row.slug, expiresAt: row.expires_at, url: analysisCardUrl(row.slug) } };
}

export async function revokeAnalysisCard(slug: string, client?: CardRpcClient): Promise<CardActionResult<boolean>> {
  const rpc = client ?? await defaultClient();
  if (!await signedIn(rpc)) return { ok: false, message: NOT_SIGNED_IN };
  const { data, error } = await withLoading("analysis-card-revoke", "撤銷分析卡", rpc.rpc("revoke_analysis_card", { p_slug: slug }));
  if (error) return { ok: false, message: cardErrorMessage(error) };
  return data === true ? { ok: true, value: true } : { ok: false, message: "這張卡片已經撤銷或不存在。" };
}

export async function listMyAnalysisCards(client?: CardRpcClient): Promise<CardActionResult<CardSummary[]>> {
  const rpc = client ?? await defaultClient();
  if (!await signedIn(rpc)) return { ok: false, message: NOT_SIGNED_IN };
  const { data, error } = await withLoading("analysis-card-list", "讀取我的分析卡", rpc.rpc("list_my_analysis_cards"));
  if (error) return { ok: false, message: cardErrorMessage(error) };
  if (!Array.isArray(data)) return { ok: false, message: "伺服器回傳格式不正確。" };
  return {
    ok: true,
    value: data.flatMap(row => {
      const item = row as Record<string, unknown>;
      if (typeof item.slug !== "string" || typeof item.expires_at !== "string" || typeof item.created_at !== "string") return [];
      return [{ slug: item.slug, title: typeof item.title === "string" ? item.title : "（無標題）", createdAt: item.created_at, expiresAt: item.expires_at, revokedAt: typeof item.revoked_at === "string" ? item.revoked_at : null, bytes: typeof item.bytes === "number" ? item.bytes : 0 }];
    }),
  };
}
