// 靜態化 RPC 快照讀取器（見 docs/features/static-to-cdn/README.md）。
//
// 背景：一批「參數無關、資料月更或更慢」的 RPC（OSM 電網、SSOT 電廠座標…）
// 其實是靜態資料，卻每次都打 Supabase，擠爆前端併發上限 8 的排隊，且每個使用者
// 各自重複打同一份資料（DB 讀取 O(N)）。改讀 CDN 靜態快照 → 脫離排隊 + O(N)→O(1)。
//
// 用法：把 loader 裡的 `supabase.rpc("get_x")` 換成 `staticRpc("get_x")`，其餘不動
// （回傳形狀刻意對齊 supabase.rpc 的 { data, error }，transform/withLoading 都不用改）。
//
// 缺檔、壞 JSON 或網路失敗一律明確失敗，不能把所有訪客導回 Supabase。

const STATIC_RPC_BASE = "/static-rpc";

export interface RpcResult<T> {
  data: T | null;
  // 對齊 supabase.rpc 的錯誤形狀（PostgrestError 有 .message）；靜態成功時為 null
  error: { message: string } | null;
}

const inflight = new Map<string, Promise<RpcResult<unknown>>>();

async function loadStaticRpc<T>(name: string): Promise<RpcResult<T>> {
  try {
    const res = await fetch(`${STATIC_RPC_BASE}/${name}.json`);
    if (!res.ok) return { data: null, error: { message: `Static RPC snapshot ${name} unavailable (HTTP ${res.status})` } };
    try { return { data: (await res.json()) as T, error: null }; }
    catch { return { data: null, error: { message: `Static RPC snapshot ${name} is invalid JSON` } }; }
  } catch (error) {
    return { data: null, error: { message: `Static RPC snapshot ${name} request failed: ${error instanceof Error ? error.message : "unknown error"}` } };
  }
}

export function staticRpc<T = unknown>(name: string): Promise<RpcResult<T>> {
  const active = inflight.get(name);
  if (active) return active as Promise<RpcResult<T>>;
  const request = loadStaticRpc<T>(name).finally(() => inflight.delete(name));
  inflight.set(name, request as Promise<RpcResult<unknown>>);
  return request;
}
