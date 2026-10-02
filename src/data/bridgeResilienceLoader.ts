import {
  BRIDGE_RESILIENCE_ASSETS, bridgeResilienceAssetUrl,
  type BridgeFingerprint, type BridgeResilienceAssetName, type BridgeResilienceData, type BridgeSummary, type DecaySummary, type DecayVillageImpacts, type VillageDestinations, type VillageImpacts,
} from "./bridgeResilienceTypes";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** 與 sidecar `MAX_RANGE_BYTES`（8 MiB）同值：單一 Range 不得超過；較大的資產分段讀。 */
export const BRIDGE_RESILIENCE_MAX_RANGE_BYTES = 8 * 1024 * 1024;

/**
 * 站主限定 JSON：sidecar 只回 206 Range，所以以資產已知大小要整段；超過 8 MiB（v4 village_destinations 10 MB）
 * 就依序分段，位元組拼好後才一次 UTF-8 解碼（多位元組字元可能跨段）。
 * 每次呼叫都重新帶 Bearer，不快取；401／403 丟出帶 status 的錯誤，由呼叫端鎖回。
 */
export async function fetchPrivateJson<T>(
  name: Exclude<BridgeResilienceAssetName, "tiles">, token: string, fetchFn: FetchLike = (u, i) => fetch(u, i), signal?: AbortSignal,
): Promise<T> {
  const { size } = BRIDGE_RESILIENCE_ASSETS[name];
  const bytes = new Uint8Array(size);
  for (let start = 0; start < size; start += BRIDGE_RESILIENCE_MAX_RANGE_BYTES) {
    const end = Math.min(size, start + BRIDGE_RESILIENCE_MAX_RANGE_BYTES) - 1;
    const response = await fetchFn(bridgeResilienceAssetUrl(name), {
      signal, cache: "no-store", headers: { Authorization: `Bearer ${token}`, Range: `bytes=${start}-${end}` },
    });
    if (response.status === 401 || response.status === 403) {
      const error = new Error(`bridge resilience access denied (${response.status})`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    if (response.status !== 206) throw new Error(`橋梁韌性私人資料尚未就緒（HTTP ${response.status}）`);
    const chunk = new Uint8Array(await response.arrayBuffer());
    if (chunk.length !== end - start + 1) throw new Error("橋梁韌性私人資料長度不符");
    bytes.set(chunk, start);
  }
  return JSON.parse(new TextDecoder("utf-8").decode(bytes)) as T;
}

export function validateBridgeResilienceData(
  summary: BridgeSummary, impacts: VillageImpacts, decayImpacts: DecayVillageImpacts, decaySummary: DecaySummary,
  fingerprint: BridgeFingerprint,
): BridgeResilienceData {
  if (!summary?.bridges || typeof summary.bridges !== "object") throw new Error("bridge_summary 格式不符");
  if (!Array.isArray(impacts?.scenarios) || !impacts.villages || typeof impacts.villages !== "object") throw new Error("village_impacts 格式不符");
  if (!Array.isArray(decayImpacts?.scenarios) || !decayImpacts.villages || typeof decayImpacts.villages !== "object") throw new Error("decay_village_impacts 格式不符");
  if (!decaySummary?.bridges || typeof decaySummary.bridges !== "object") throw new Error("decay_summary 格式不符");
  if (!fingerprint?.bridges || typeof fingerprint.bridges !== "object") throw new Error("bridge_fingerprint 格式不符");
  return { summary, impacts, decayImpacts, decaySummary, fingerprint };
}

export async function loadBridgeResilienceData(token: string, fetchFn?: FetchLike, signal?: AbortSignal): Promise<BridgeResilienceData> {
  const [summary, impacts, decayImpacts, decaySummary, fingerprint] = await Promise.all([
    fetchPrivateJson<BridgeSummary>("summary", token, fetchFn, signal),
    fetchPrivateJson<VillageImpacts>("impacts", token, fetchFn, signal),
    fetchPrivateJson<DecayVillageImpacts>("decay-impacts", token, fetchFn, signal),
    fetchPrivateJson<DecaySummary>("decay-summary", token, fetchFn, signal),
    fetchPrivateJson<BridgeFingerprint>("fingerprint", token, fetchFn, signal),
  ]);
  return validateBridgeResilienceData(summary, impacts, decayImpacts, decaySummary, fingerprint);
}

/** 目的地視角資料（village_destinations.json）：不合格式就中止，不合成空資料。 */
export function validateVillageDestinations(dest: VillageDestinations): VillageDestinations {
  const ok = Array.isArray(dest?.scenarios) && Array.isArray(dest?.villages) && Array.isArray(dest?.village_names)
    && Array.isArray(dest?.districts) && Array.isArray(dest?.village_district) && !!dest?.data && typeof dest.data === "object"
    && dest.village_names.length === dest.villages.length && dest.village_district.length === dest.villages.length;
  if (!ok) throw new Error("village_destinations 格式不符");
  return dest;
}

/** 懶載入：第一次點村里才抓（v4 10 MB，分兩段 Range）。 */
export async function loadVillageDestinations(token: string, fetchFn?: FetchLike, signal?: AbortSignal): Promise<VillageDestinations> {
  return validateVillageDestinations(await fetchPrivateJson<VillageDestinations>("destinations", token, fetchFn, signal));
}
