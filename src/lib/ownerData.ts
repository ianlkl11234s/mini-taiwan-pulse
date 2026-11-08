import { supabase } from "./supabase";
import { withLoading } from "./loadingRegistry";
import {
  OWNER_DATA_ASSETS, OWNER_DATA_ENDPOINT, OWNER_DATA_MAX_RANGE_BYTES, type OwnerDataAssetName,
} from "../data/ownerDataAssets";

/**
 * 站主限定靜態資料（owner-data 家族）的共用讀取：同源 /api/private-research/owner-data/<asset>，
 * 由 coral-private sidecar 驗站主 JWT 後回 Range。取代原本的 Supabase owner-only RPC（2026-11-08）。
 *
 * - 每次請求都重新取 session token（不快取）；沒有登入 → 丟 status 401（hook 端 isAccessDenied 會靜默）。
 * - 依契約大小分段 Range（每段 ≤ 8 MiB），只接受 206；長度不符就中止，不合成資料。
 * - 註冊 loadingRegistry（taskId／label 由呼叫端給，沿用原本 RPC 的 id，圖層列轉圈不變）。
 * - 結果寫進 ownerDataStatus，圖例可顯示「讀取失敗（原因）」；401／403 不算失敗（非站主本來就讀不到）。
 */

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type OwnerDataStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready" }
  | { state: "error"; error: string };

const statuses = new Map<OwnerDataAssetName, OwnerDataStatus>();
const listeners = new Set<() => void>();
const IDLE: OwnerDataStatus = { state: "idle" };

function setStatus(asset: OwnerDataAssetName, status: OwnerDataStatus) {
  statuses.set(asset, status);
  for (const l of listeners) l();
}

export const ownerDataStatus = {
  get(asset: OwnerDataAssetName): OwnerDataStatus { return statuses.get(asset) ?? IDLE; },
  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
  /** 撤權時清掉（不留「讀取失敗」等舊狀態） */
  reset(asset: OwnerDataAssetName) { setStatus(asset, IDLE); },
};

function deniedError(status: number): Error & { status: number } {
  const error = new Error(`owner data access denied (${status})`) as Error & { status: number };
  error.status = status;
  return error;
}

async function ownerToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw deniedError(401);
  return data.session.access_token;
}

/** 下載並解析一支 owner-data 檔（不含 loading／status 包裝，給測試與 fetchOwnerJson 用）。 */
export async function readOwnerJson<T>(
  asset: OwnerDataAssetName,
  { fetchFn = (u, i) => fetch(u, i), token = ownerToken, signal }: { fetchFn?: FetchLike; token?: () => Promise<string>; signal?: AbortSignal } = {},
): Promise<T> {
  const { size } = OWNER_DATA_ASSETS[asset];
  const bytes = new Uint8Array(size);
  for (let start = 0; start < size; start += OWNER_DATA_MAX_RANGE_BYTES) {
    const end = Math.min(size, start + OWNER_DATA_MAX_RANGE_BYTES) - 1;
    const response = await fetchFn(`${OWNER_DATA_ENDPOINT}/${asset}`, {
      signal, cache: "no-store", headers: { Authorization: `Bearer ${await token()}`, Range: `bytes=${start}-${end}` },
    });
    if (response.status === 401 || response.status === 403) throw deniedError(response.status);
    if (response.status !== 206) throw new Error(`HTTP ${response.status}`);
    const chunk = new Uint8Array(await response.arrayBuffer());
    if (chunk.length !== end - start + 1) throw new Error("長度不符");
    bytes.set(chunk, start);
  }
  return JSON.parse(new TextDecoder("utf-8").decode(bytes)) as T;
}

export async function fetchOwnerJson<T>(
  asset: OwnerDataAssetName, taskId: string, label: string, opts?: Parameters<typeof readOwnerJson>[1],
): Promise<T> {
  setStatus(asset, { state: "loading" });
  try {
    const data = await withLoading(taskId, label, readOwnerJson<T>(asset, opts));
    setStatus(asset, { state: "ready" });
    return data;
  } catch (err) {
    const status = (err as { status?: number } | null)?.status;
    setStatus(asset, status === 401 || status === 403
      ? IDLE
      : { state: "error", error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}
