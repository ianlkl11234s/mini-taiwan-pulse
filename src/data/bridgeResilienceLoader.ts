import {
  BRIDGE_RESILIENCE_ASSETS, bridgeResilienceAssetUrl,
  type BridgeResilienceAssetName, type BridgeResilienceData, type BridgeSummary, type VillageImpacts,
} from "./bridgeResilienceTypes";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * 站主限定 JSON：sidecar 只回 206 Range，所以以資產已知大小一次要整段（< 8 MB 上限）。
 * 每次呼叫都重新帶 Bearer，不快取；401／403 丟出帶 status 的錯誤，由呼叫端鎖回。
 */
export async function fetchPrivateJson<T>(
  name: Exclude<BridgeResilienceAssetName, "tiles">, token: string, fetchFn: FetchLike = (u, i) => fetch(u, i), signal?: AbortSignal,
): Promise<T> {
  const { size } = BRIDGE_RESILIENCE_ASSETS[name];
  const response = await fetchFn(bridgeResilienceAssetUrl(name), {
    signal, cache: "no-store", headers: { Authorization: `Bearer ${token}`, Range: `bytes=0-${size - 1}` },
  });
  if (response.status === 401 || response.status === 403) {
    const error = new Error(`bridge resilience access denied (${response.status})`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  if (response.status !== 206) throw new Error(`橋梁韌性私人資料尚未就緒（HTTP ${response.status}）`);
  const text = await response.text();
  if (text.length === 0) throw new Error("橋梁韌性私人資料為空");
  return JSON.parse(text) as T;
}

export function validateBridgeResilienceData(summary: BridgeSummary, impacts: VillageImpacts): BridgeResilienceData {
  if (!summary?.bridges || typeof summary.bridges !== "object") throw new Error("bridge_summary 格式不符");
  if (!Array.isArray(impacts?.scenarios) || !impacts.villages || typeof impacts.villages !== "object") throw new Error("village_impacts 格式不符");
  return { summary, impacts };
}

export async function loadBridgeResilienceData(token: string, fetchFn?: FetchLike, signal?: AbortSignal): Promise<BridgeResilienceData> {
  const [summary, impacts] = await Promise.all([
    fetchPrivateJson<BridgeSummary>("summary", token, fetchFn, signal),
    fetchPrivateJson<VillageImpacts>("impacts", token, fetchFn, signal),
  ]);
  return validateBridgeResilienceData(summary, impacts);
}
