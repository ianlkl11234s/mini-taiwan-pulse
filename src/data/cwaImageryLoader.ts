/**
 * cwaImageryLoader.ts — 載入 CWA 衛星雲圖 / 雷達影像（metadata 走 Supabase RPC、bytes 走 R2/CDN）
 *
 * 流程：
 *   1. loadCwaImageryBatch() → 呼叫 get_cwa_imagery_manifest，一次取回時間窗內的 metadata + image_key
 *   2. frame URL = `${VITE_IMAGERY_CDN_BASE}/${image_key}`，由 <img> / updateImage() 直接取用
 *
 * AR-11e：DB bytea 讀取路徑（get_cwa_imagery_frames_batch / _frame / _list）已下架，
 * 影像只有 CDN 一條路。DB 內的 bytea 僅保留 14 天作災難備份，前端不再讀。
 */

import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * 影像 frame 的 CDN base（AR-11d 導入、AR-11e 起為**必要設定**）。
 * frame URL = `${base}/${image_key}`。尾斜線先剝除，避免拼出 `base//key`。
 * 未設 → 影像圖層停用並丟出帶指引的錯誤（不再靜默回退 DB bytea）。
 */
const IMAGERY_CDN_BASE = (import.meta.env.VITE_IMAGERY_CDN_BASE ?? "").replace(/\/+$/, "");

/** 未設定時在 console 留一次醒目說明（loader 於 App 啟動鏈被 import，dev 一開就看得到）。 */
if (!IMAGERY_CDN_BASE) {
  console.error(
    "[CWA Imagery] VITE_IMAGERY_CDN_BASE 未設定 → 衛星雲圖 / 雷達影像圖層不會有畫面。\n" +
      "AR-11e 起影像只從 R2/CDN 讀取，DB bytea fallback 已移除。\n" +
      "請複製 .env.example 的 VITE_IMAGERY_CDN_BASE 到 .env.local 後重啟 dev server。",
  );
}

export interface CwaImageryFrame {
  datasetId: string;
  /** 原始 ISO 字串（作為 RPC 查詢 key） */
  observedAtIso: string;
  /** Epoch ms（方便時間軸比對） */
  observedAtMs: number;
  mimeType: string;
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
  imageSize: number;
}

export interface CwaImageryBundle {
  datasetId: string;
  frames: CwaImageryFrame[]; // 依 observedAtMs 升序
}

/** get_cwa_imagery_manifest 的列：metadata + R2 物件 key + 位元組大小（不含 bytes）。 */
interface RawManifestRow {
  dataset_id: string;
  observed_at: string;
  mime_type: string;
  lon_min: number;
  lon_max: number;
  lat_min: number;
  lat_max: number;
  image_key: string;
  image_size: number;
}

export interface CwaImageryWindow {
  sinceIso: string;
  untilIso: string;
  /** 抽稀：null = 全部 frames；30 = 只取分鐘數整除 30（歷史日減 payload 用） */
  stepMinutes: number | null;
}

/**
 * 批次載入 metadata + 影像 URL（一次 RPC 回傳多張），避開「N 個並發 fetch 撐爆網路層」。
 * 時間窗由呼叫端依 timeline 日期決定（migration 160 起支援 p_until / p_step_minutes）。
 * 回傳 `{ bundle, urls }` per dataset，url = R2 物件的 http URL（非 object URL）。
 *
 * 呼叫端（hook）在 evict/unmount 會對 url 呼叫 revokeObjectURL：對 http URL 是無害 no-op
 * （handoff read-path-cdn-imagery.md 已確認，故不需改 hook）。
 */
export async function loadCwaImageryBatch(
  datasetIds: string[],
  window: CwaImageryWindow,
  opts: { silent?: boolean } = {},
): Promise<Map<string, { bundle: CwaImageryBundle; urls: Map<string, string> }>> {
  // 先擋掉未設定：在建 RPC promise 之前丟，避免 LOADING 面板閃一下才失敗
  if (!IMAGERY_CDN_BASE) {
    throw new Error(
      "VITE_IMAGERY_CDN_BASE 未設定，CWA 影像無來源可讀（AR-11e 已移除 DB bytea fallback）。" +
        "請依 .env.example 在 .env.local 設定影像 CDN base 後重啟 dev server。",
    );
  }

  const rpcPromise = supabase.rpc("get_cwa_imagery_manifest", {
    p_dataset_ids: datasetIds,
    p_since: window.sinceIso,
    p_until: window.untilIso,
    p_step_minutes: window.stepMinutes,
  });

  // silent=true 走背景 prefetch 路徑，不灌 LOADING panel
  const { data, error } = await (opts.silent
    ? rpcPromise
    : withLoading(
        `cwa-imagery-batch:${datasetIds.join(",")}`,
        `CWA 影像批次載入 ${datasetIds.join("/")}`,
        rpcPromise,
      ));

  if (error) throw new Error(`get_cwa_imagery_manifest: ${error.message}`);

  const rows = (data ?? []) as RawManifestRow[];
  const result = new Map<string, { bundle: CwaImageryBundle; urls: Map<string, string> }>();
  for (const id of datasetIds) {
    result.set(id, { bundle: { datasetId: id, frames: [] }, urls: new Map() });
  }

  for (const r of rows) {
    const slot = result.get(r.dataset_id);
    if (!slot) continue;
    const url = `${IMAGERY_CDN_BASE}/${r.image_key}`;
    slot.bundle.frames.push({
      datasetId: r.dataset_id,
      observedAtIso: r.observed_at,
      observedAtMs: new Date(r.observed_at).getTime(),
      mimeType: r.mime_type,
      lonMin: r.lon_min,
      lonMax: r.lon_max,
      latMin: r.lat_min,
      latMax: r.lat_max,
      imageSize: r.image_size,
    });
    slot.urls.set(r.observed_at, url);
  }

  for (const slot of result.values()) {
    slot.bundle.frames.sort((a, b) => a.observedAtMs - b.observedAtMs);
  }

  return result;
}

/**
 * base64 → object URL（呼叫端記得 revokeObjectURL 以免洩漏）
 *
 * ⚠️ CWA 影像本身已改吃 CDN URL 不再用到本函式，但 `aqiImageryLoader` / `precipRasterLoader`
 * 仍走 base64 RPC（那兩張圖沒有 R2 副本，AR-11f 才會 CDN 化）→ 請勿刪。
 */
export function base64ToObjectUrl(b64: string, mimeType: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}
