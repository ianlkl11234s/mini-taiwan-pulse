/**
 * 卡片頁的公開讀取：以 anon 身分呼叫 `get_analysis_card(p_slug)`（migration 414）。
 *
 * 刻意不 import `lib/supabase`（卡片頁是獨立 entry，比照 `src/embed/` 鐵則，bundle 不帶
 * supabase-js）。anon key 本來就 inline 在前端 bundle，屬公開值。
 *
 * 三種結果刻意分開（不要合併）：
 *   - ok：有卡片且 payload 形狀正確
 *   - gone：RPC 回 0 列（不存在／已撤銷／已過期，RPC 不區分原因）
 *   - error：網路或 HTTP 錯誤，或卡片存在但本頁看不懂（例如較新的 schema_version）→ 「暫時無法載入」，不能說成卡片已失效
 */
import { validateCardPayload, type CardPayloadV1 } from "./cardPayload";

export type CardFetchResult =
  | { status: "ok"; payload: CardPayloadV1; createdAt: string | null; expiresAt: string | null }
  | { status: "gone" }
  | { status: "error"; detail: string };

export type CardApiConfig = { supabaseUrl: string | undefined; anonKey: string | undefined; fetchImpl?: typeof fetch };

/** 前端本來就公開的 VITE 變數（與主站 lib/supabase 讀同一組名稱，但不共用 client）。 */
export function cardApiConfigFromEnv(): CardApiConfig {
  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  };
}

export async function fetchAnalysisCard(slug: string, config: CardApiConfig, signal?: AbortSignal): Promise<CardFetchResult> {
  if (!config.supabaseUrl || !config.anonKey) return { status: "error", detail: "SUPABASE_NOT_CONFIGURED" };
  const fetchImpl = config.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${config.supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/get_analysis_card`, {
      method: "POST",
      headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ p_slug: slug }),
      signal,
    });
  } catch (error) {
    return { status: "error", detail: error instanceof Error ? error.name : "NETWORK" };
  }
  if (!response.ok) return { status: "error", detail: `HTTP_${response.status}` };
  let rows: unknown;
  try { rows = await response.json(); } catch { return { status: "error", detail: "BAD_JSON" }; }
  if (!Array.isArray(rows)) return { status: "error", detail: "BAD_SHAPE" };
  const row = rows[0] as { payload?: unknown; created_at?: unknown; expires_at?: unknown } | undefined;
  if (!row) return { status: "gone" };
  const validation = validateCardPayload(row.payload);
  if (!validation.ok) return { status: "error", detail: `PAYLOAD_${validation.reason}` };
  return {
    status: "ok",
    payload: validation.payload,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : null,
  };
}
