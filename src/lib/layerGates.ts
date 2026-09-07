import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { GATED_LAYERS } from "../components/sidebar/layerCatalog";
import type { LayerVisibility } from "../types";

/**
 * 動態圖層鎖定（Phase 2 治理系統，見 docs/features/owner-gated-layers）。
 *
 * 公開 RPC `get_layer_gates()`（anon 可呼叫，只回 keys 不含地理資料）提供
 * 「哪些 layer 被鎖 + 需要什麼 tier」的權威清單，取代 Phase 1 寫死的 GATED_LAYERS Set。
 *
 * fail-safe：RPC 失敗 / 尚未回來時 gatesCache=null → 一律 fallback 回靜態 GATED_LAYERS
 * （保持鎖定，絕不因 RPC 失敗而解鎖）。
 */

// ── tier 有序 4 級（free 0 < member 1 < insider 2 < owner 3）──
const TIER_RANK: Record<string, number> = { free: 0, member: 1, insider: 2, owner: 3 };

export function tierRank(tier: string | null | undefined): number {
  return isKnownTier(tier ?? "free") ? TIER_RANK[tier ?? "free"]! : 0;
}

function isKnownTier(tier: string): boolean {
  return Object.prototype.hasOwnProperty.call(TIER_RANK, tier);
}

export interface LayerGate {
  required_tier: string;
  enabled: boolean;
  /**
   * 鎖型（migration 278）：
   * - 'full'：乾淨鎖（DB 已 REVOKE anon，機密資料）。未登入也 locked。
   * - 'ui'  ：UI 鎖（DB 未 REVOKE、資料公開）。未登入 locked（引導登入）、
   *           登入且 tier>=required 即開。
   */
  lock_type: "ui" | "full";
}
export type LayerGates = ReadonlyMap<string, LayerGate>;

/** Normalize untrusted RPC metadata before it becomes a frontend permission decision. */
export function normalizeLayerGate(row: Partial<LayerGate>): LayerGate {
  if (!isKnownTier(row.required_tier ?? "") || typeof row.enabled !== "boolean"
    || (row.lock_type !== "ui" && row.lock_type !== "full")) {
    return { required_tier: "owner", enabled: true, lock_type: "full" };
  }
  return { required_tier: row.required_tier!, enabled: row.enabled, lock_type: row.lock_type };
}


// ── module-level cache（null = 尚未成功載入 → 用靜態 fallback）──
let gatesCache: LayerGates | null = null;
let inflight = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/**
 * 拉一次 get_layer_gates() 存進 module cache。
 * 併發保護：同時只有一個 in-flight；可重複呼叫（admin panel 改動後 refetch）。
 * 失敗時不動既有 cache（維持既有鎖定，fail-safe）。
 */
export async function loadLayerGates(): Promise<void> {
  if (inflight) return;
  inflight = true;
  try {
    const { data, error } = await supabase.rpc("get_layer_gates");
    if (error) throw error;
    const next = new Map<string, LayerGate>();
    for (const row of (data ?? []) as Array<{ layer_key: string; required_tier: string; enabled: boolean; lock_type?: "ui" | "full" }>) {
      if (!row || typeof row.layer_key !== "string") throw new Error("Invalid layer gate row");
      next.set(row.layer_key, normalizeLayerGate(row));
    }
    gatesCache = next;
    emit();
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[layerGates] load failed → fallback to static GATED_LAYERS", err);
  } finally {
    inflight = false;
  }
}

/** React 訂閱：gates 載入 / refetch 後自動 re-render。null = 尚未載入（fallback 態）。 */
export function useLayerGates(): LayerGates | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => gatesCache,
    () => gatesCache,
  );
}

/**
 * 某 key 對某 tier 是否上鎖（純函式）。
 * - gates 已載入 → 僅明確有效的 enabled gate 可覆寫靜態安全清單：
 *   靜態敏感 key 不在清單（RPC 成功但空列、資料遺漏）仍維持 owner 鎖；
 *   full disabled / 不合法 gate 也維持 owner 底線。其他不在清單的公開 key 保持公開。
 *   有效 gate 依 lock_type 判定：
 *     • full：tierRank(tier) < required → locked（未登入 tier=null → rank 0，也 locked）。
 *     • ui  ：未登入（tier==null）→ locked（顯示鎖頭引導登入）；
 *             已登入 → tierRank(tier) < required 才 locked（tier>=required 即開）。
 *   （full 與 ui 唯一差異：ui 對「未登入」一律上鎖，即使 required=free；
 *    真正資料保護在 DB grant，此處僅前端顯示行為。）
 * - gates=null（未載入 / 失敗）→ fail-safe 用靜態 GATED_LAYERS，一律當 full 鎖需 owner。
 */
export function isLayerLocked(
  key: keyof LayerVisibility,
  tier: string | null | undefined,
  gates: LayerGates | null,
): boolean {
  const userRank = tierRank(tier);
  const requiresStaticOwner = GATED_LAYERS.has(key);
  const requiresOwner = (): boolean => userRank < tierRank("owner");
  if (gates) {
    const gate = gates.get(key);
    if (!gate) return requiresStaticOwner && requiresOwner();
    // get_layer_gates() only returns enabled rows. A disabled full row or a malformed
    // row must never turn a DB-protected layer into a public UI state.
    if (!isKnownTier(gate.required_tier) || (gate.lock_type !== "ui" && gate.lock_type !== "full")) {
      return requiresOwner();
    }
    if (gate.lock_type === "ui") {
      if (gate.enabled !== true) return requiresStaticOwner && requiresOwner();
      // UI 鎖：未登入一律上鎖（引導登入）；已登入依 tier 判定
      if (tier == null) return true;
      return userRank < tierRank(gate.required_tier);
    }
    // full（乾淨鎖，現狀不變）
    if (gate.enabled !== true) return requiresOwner();
    return userRank < tierRank(gate.required_tier);
  }
  return requiresStaticOwner && requiresOwner();
}

/** 後端鎖定 RPC 對非授權者回 403 / code 42501 —— 視為「無權限」靜默處理（不噴 error / 不重試）。 */
export function isAccessDenied(err: unknown): boolean {
  const value = err as { code?: string | number; status?: number; message?: string } | null;
  const code = String(value?.code ?? "");
  const status = value?.status;
  const msg = value?.message ?? String(err ?? "");
  return code === "42501" || code === "401" || code === "403" || status === 401 || status === 403
    || /42501|access denied|permission denied/i.test(msg);
}
