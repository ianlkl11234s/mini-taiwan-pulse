/**
 * jmaImageryLoader.ts — 日本氣象廳（JMA）發布幀影像（time-axis raster）的 manifest 載入、選幀與狀態 store。
 *
 * 契約：taipei-gis-analytics docs/topic-research/japan_opendata/jma-frontend-contract.md
 *   - RPC public.get_weather_imagery_manifest(p_source, p_products, p_since, p_until, p_step_minutes)
 *     只回 image_key 非 NULL 或 status='missing' 的列；單次區間上限 8 天。
 *   - frame URL = `${VITE_IMAGERY_CDN_BASE}/${image_key}`（與 CWA 影像同一個 CDN base）。
 *
 * 「未涵蓋」規則（不可當 0 畫）：此刻沒有 ≤ t 的幀、最近一幀過舊（缺幀）、該幀 status=missing
 * 或 image_key 為空、encoding 與色票不符 → 圖層隱藏、圖例顯示「未涵蓋」。
 */

import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import type { JmaImageryProduct } from "./jmaTypes";

const IMAGERY_CDN_BASE = (import.meta.env.VITE_IMAGERY_CDN_BASE ?? "").replace(/\/+$/, "");

/** RPC 單次區間上限（契約 §2）；超過由 jmaImageryWindowChunks 分塊 */
export const JMA_IMAGERY_MAX_WINDOW_DAYS = 8;

export interface JmaImageryFrame {
  product: string;
  validTimeIso: string;
  validTimeMs: number;
  status: string | null;
  /** null = status missing／尚未發布 */
  url: string | null;
  encoding: string | null;
  lonMin: number | null;
  lonMax: number | null;
  latMin: number | null;
  latMax: number | null;
}

export interface JmaImageryManifestRow {
  product: string;
  valid_time: string;
  status: string | null;
  image_key: string | null;
  image_bytes: number | null;
  image_width: number | null;
  image_height: number | null;
  lon_min: number | null;
  lon_max: number | null;
  lat_min: number | null;
  lat_max: number | null;
  encoding: string | null;
}

export interface JmaImageryWindow {
  sinceIso: string;
  untilIso: string;
  stepMinutes: number;
}

export function jmaImageryCdnBase(): string {
  return IMAGERY_CDN_BASE;
}

/** RPC 列 → frame（依 valid_time 升序）。cdnBase 空字串時 url 一律 null（不拼相對路徑）。 */
export function rowsToJmaImageryFrames(rows: readonly JmaImageryManifestRow[], cdnBase: string): Map<string, JmaImageryFrame[]> {
  const out = new Map<string, JmaImageryFrame[]>();
  for (const r of rows) {
    const ms = new Date(r.valid_time).getTime();
    if (!Number.isFinite(ms)) continue;
    const list = out.get(r.product) ?? [];
    list.push({
      product: r.product,
      validTimeIso: r.valid_time,
      validTimeMs: ms,
      status: r.status ?? null,
      url: r.image_key && cdnBase ? `${cdnBase}/${r.image_key}` : null,
      encoding: r.encoding ?? null,
      lonMin: r.lon_min, lonMax: r.lon_max, latMin: r.lat_min, latMax: r.lat_max,
    });
    out.set(r.product, list);
  }
  for (const [k, list] of out) {
    list.sort((a, b) => a.validTimeMs - b.validTimeMs);
    // 分塊查詢在邊界可能重複回同一幀 → 同 valid_time 只留一筆
    out.set(k, list.filter((f, i) => i === 0 || f.validTimeMs !== list[i - 1]!.validTimeMs));
  }
  return out;
}

/**
 * PostgREST 對 RPC 也套 db-max-rows（Supabase 預設 1000），且列依 valid_time 升序 → 超過時被截掉的是「最近」的幀。
 * 依發布頻率把時間窗切塊，每塊預期列數 ≤ JMA_IMAGERY_ROWS_PER_CALL（radar 5 分 → 75 小時一塊）。
 */
export const JMA_IMAGERY_ROWS_PER_CALL = 900;

export function jmaImageryWindowChunks(window: JmaImageryWindow, cadenceMin: number): { sinceIso: string; untilIso: string }[] {
  const sinceMs = new Date(window.sinceIso).getTime();
  const untilMs = new Date(window.untilIso).getTime();
  const effMin = Math.max(cadenceMin, window.stepMinutes || 0, 1);
  // 同時受 RPC 單次 8 天上限約束（sst／海冰前推 36h 後 7 天視窗會超過 8 天）
  const chunkMs = Math.min(JMA_IMAGERY_ROWS_PER_CALL * effMin * 60_000, JMA_IMAGERY_MAX_WINDOW_DAYS * 24 * 3600_000 - 60_000);
  const out: { sinceIso: string; untilIso: string }[] = [];
  for (let a = sinceMs; a < untilMs; a += chunkMs) {
    // RPC 的區間語意：since ≤ valid_time ≤ until 的列；相鄰塊在邊界重疊的列由 rowsToJmaImageryFrames 去重
    out.push({ sinceIso: new Date(a).toISOString(), untilIso: new Date(Math.min(untilMs, a + chunkMs)).toISOString() });
  }
  return out.length ? out : [{ sinceIso: window.sinceIso, untilIso: window.untilIso }];
}

export async function loadJmaImageryManifest(
  products: readonly string[],
  window: JmaImageryWindow,
  cadenceMin = 60,
): Promise<Map<string, JmaImageryFrame[]>> {
  const chunks = jmaImageryWindowChunks(window, cadenceMin);
  const results = await withLoading(
    `jma-imagery-manifest:${products.join(",")}`,
    `JMA 影像清單 ${products.join("/")}`,
    Promise.all(chunks.map((c) => supabase.rpc("get_weather_imagery_manifest", {
      p_source: "jma",
      p_products: [...products],
      p_since: c.sinceIso,
      p_until: c.untilIso,
      p_step_minutes: window.stepMinutes,
    }))),
  );
  const rows: JmaImageryManifestRow[] = [];
  for (const { data, error } of results) {
    if (error) throw new Error(`get_weather_imagery_manifest: ${error.message}`);
    rows.push(...((data ?? []) as JmaImageryManifestRow[]));
  }
  return rowsToJmaImageryFrames(rows, IMAGERY_CDN_BASE);
}

/** 時間窗：timeline 視窗日（Asia/Taipei）→ RPC since/until；前推一個 maxStale 讓 00:00 也找得到 ≤ t 的幀。 */
export function jmaImageryWindowFor(
  dateKeys: readonly string[],
  product: JmaImageryProduct,
  nowMs: number,
): JmaImageryWindow {
  const keys = [...dateKeys].sort();
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  const sinceMs = new Date(`${first}T00:00:00+08:00`).getTime() - product.maxStaleMin * 60_000;
  let untilMs = new Date(`${last}T00:00:00+08:00`).getTime() + 24 * 3600_000;
  untilMs = Math.min(untilMs, nowMs + 3600_000);
  // 不在這裡截 8 天：截掉的會是最近的日子；RPC 的 8 天上限由 jmaImageryWindowChunks 分塊處理
  return {
    sinceIso: new Date(sinceMs).toISOString(),
    untilIso: new Date(Math.max(sinceMs + 60_000, untilMs)).toISOString(),
    stepMinutes: product.historyStepMin,
  };
}

export type JmaImageryUncoveredReason = "no_frame" | "stale" | "missing" | "encoding" | "off_hours" | "off_season";

export type JmaImageryPick =
  | { kind: "frame"; frame: JmaImageryFrame }
  | { kind: "uncovered"; reason: JmaImageryUncoveredReason; frame: JmaImageryFrame | null };

const JST_OFFSET_MS = 9 * 3600_000;

/** 上游發布時段外（UV 夜間、海冰季外）→ 對應原因；時段內 → null。以 t 的 JST 時刻判斷。 */
export function jmaImageryInactiveReason(
  product: Pick<JmaImageryProduct, "active">,
  tMs: number,
): "off_hours" | "off_season" | null {
  const a = product.active;
  if (!a) return null;
  const jst = new Date(tMs + JST_OFFSET_MS);
  if (a.monthsJst && !a.monthsJst.includes(jst.getUTCMonth() + 1)) return "off_season";
  if (a.hoursJst) {
    const h = jst.getUTCHours();
    if (h < a.hoursJst[0] || h >= a.hoursJst[1]) return "off_hours";
  }
  return null;
}

/**
 * 選幀：
 *  - 發布時段外（product.active）→ off_hours／off_season
 *  - 回放：valid_time ≤ t 的最晚一幀，且 t − valid_time ≤ maxStaleMin
 *  - 即時：最晚一幀（不論 t），且 now − valid_time ≤ liveMaxStaleMin
 * 不像 CWA 那樣在 t 早於第一幀時退回 frames[0]（那會把未來的圖畫成現在）。
 */
export function pickJmaImageryFrame(
  frames: readonly JmaImageryFrame[],
  tMs: number,
  product: Pick<JmaImageryProduct, "encoding" | "maxStaleMin" | "liveMaxStaleMin" | "active">,
  live: boolean,
): JmaImageryPick {
  // 發布時段外：不是缺幀，是上游本來就不發（UV 夜間、海冰 6–11 月）
  const inactive = jmaImageryInactiveReason(product, tMs);
  if (inactive) return { kind: "uncovered", reason: inactive, frame: null };
  let chosen: JmaImageryFrame | null = null;
  if (live) {
    chosen = frames.length ? frames[frames.length - 1]! : null;
  } else {
    for (const f of frames) {
      if (f.validTimeMs <= tMs) chosen = f;
      else break;
    }
  }
  if (!chosen) return { kind: "uncovered", reason: "no_frame", frame: null };
  const maxStale = (live ? product.liveMaxStaleMin : product.maxStaleMin) * 60_000;
  if (tMs - chosen.validTimeMs > maxStale) return { kind: "uncovered", reason: "stale", frame: chosen };
  if (chosen.status === "missing" || !chosen.url || chosen.lonMin == null || chosen.lonMax == null
    || chosen.latMin == null || chosen.latMax == null) {
    return { kind: "uncovered", reason: "missing", frame: chosen };
  }
  if (chosen.encoding !== product.encoding) {
    return { kind: "uncovered", reason: "encoding", frame: chosen };
  }
  return { kind: "frame", frame: chosen };
}

// ── 狀態 store（圖例讀；useSyncExternalStore） ──

export type JmaImageryState = "idle" | "loading" | "shown" | "uncovered" | "error";

export interface JmaImageryStatus {
  state: JmaImageryState;
  /** shown：目前畫的幀時間；uncovered：最近一幀時間（可能為 null） */
  validTimeIso: string | null;
  reason?: string;
  message?: string;
}

const IDLE: JmaImageryStatus = { state: "idle", validTimeIso: null };
const statusMap = new Map<string, JmaImageryStatus>();
const listeners = new Set<() => void>();

export function getJmaImageryStatus(product: string): JmaImageryStatus {
  return statusMap.get(product) ?? IDLE;
}

export function setJmaImageryStatus(product: string, next: JmaImageryStatus): void {
  const prev = statusMap.get(product);
  if (prev && prev.state === next.state && prev.validTimeIso === next.validTimeIso
    && prev.reason === next.reason && prev.message === next.message) return;
  statusMap.set(product, next);
  for (const cb of listeners) cb();
}

export function subscribeJmaImageryStatus(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
