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
  return TIER_RANK[tier ?? "free"] ?? 0;
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
      next.set(row.layer_key, {
        required_tier: row.required_tier,
        enabled: row.enabled,
        lock_type: row.lock_type === "ui" ? "ui" : "full", // 缺值 fallback 'full'（fail-safe）
      });
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
 * - gates 已載入 → 權威來源（get_layer_gates 只回 enabled 的鎖定層）：
 *   不在清單 = 公開；在清單 = 依 lock_type 判定：
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
  if (gates) {
    const gate = gates.get(key);
    if (!gate) return false;
    if (gate.lock_type === "ui") {
      // UI 鎖：未登入一律上鎖（引導登入）；已登入依 tier 判定
      if (tier == null) return true;
      return userRank < tierRank(gate.required_tier);
    }
    // full（乾淨鎖，現狀不變）
    return userRank < tierRank(gate.required_tier);
  }
  return GATED_LAYERS.has(key) && userRank < tierRank("owner");
}

/** 後端鎖定 RPC 對非授權者回 403 / code 42501 —— 視為「無權限」靜默處理（不噴 error / 不重試）。 */
export function isAccessDenied(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return code === "42501" || /42501|access denied|permission denied/i.test(msg);
}
