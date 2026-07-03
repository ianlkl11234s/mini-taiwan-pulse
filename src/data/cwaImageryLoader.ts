/**
 * cwaImageryLoader.ts — 載入 CWA 衛星雲圖 / 雷達影像（Supabase RPC）
 *
 * 流程：
 *   1. loadCwaImageryFrames() → 呼叫 get_cwa_imagery_list，取得過去 N 小時的 metadata
 *   2. fetchCwaImageryBytes() → 對每個 frame 呼叫 get_cwa_imagery_frame，回傳 base64
 *   3. 呼叫端負責把 base64 → Blob → object URL，並以 Map 快取
 */

import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * Feature flag（AR-11d）：影像 frame 讀取路徑。
 * - 有值 → 走 R2/CDN，打 get_cwa_imagery_manifest，frame URL = `${base}/${image_key}`（不產 object URL）
 * - 未設 → 走既有 base64 路徑，打 get_cwa_imagery_frames_batch（預設安全，merge 後行為零變化）
 * 切換方式：設 env + rebuild。尾斜線先剝除，避免拼出 `base//key`。
 */
const IMAGERY_CDN_BASE = (import.meta.env.VITE_IMAGERY_CDN_BASE ?? "").replace(/\/+$/, "");

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

interface RawBatchRow {
  dataset_id: string;
  observed_at: string;
  mime_type: string;
  lon_min: number;
  lon_max: number;
  lat_min: number;
  lat_max: number;
  image_b64: string;
}

/** get_cwa_imagery_manifest 的列：與 RawBatchRow 同構，但無 bytes、改回 image_key + image_size。 */
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
 * 回傳 `{ bundle, urls }` per dataset。
 *
 * 兩態（見 IMAGERY_CDN_BASE）：
 * - CDN 開啟 → get_cwa_imagery_manifest，url = R2 物件的 http URL（非 object URL）
 * - CDN 未設 → get_cwa_imagery_frames_batch，url = base64 → Blob → object URL
 * 兩態的參數與回傳形狀完全一致，故 cwaImageryLayer / useCwaImageryLayer 零改動。
 * 呼叫端（hook）在 evict/unmount 會對 url 呼叫 revokeObjectURL：對 CDN 的 http URL 是無害 no-op，
 * 對 object URL 則正確釋放（handoff read-path-cdn-imagery.md 已確認，故不需改 hook）。
 */
export async function loadCwaImageryBatch(
  datasetIds: string[],
  window: CwaImageryWindow,
  opts: { silent?: boolean } = {},
): Promise<Map<string, { bundle: CwaImageryBundle; urls: Map<string, string> }>> {
  const useCdn = IMAGERY_CDN_BASE.length > 0;
  const rpcName = useCdn ? "get_cwa_imagery_manifest" : "get_cwa_imagery_frames_batch";
  const rpcPromise = supabase.rpc(rpcName, {
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

  if (error) throw new Error(`${rpcName}: ${error.message}`);

  const rows = (data ?? []) as (RawBatchRow | RawManifestRow)[];
  const result = new Map<string, { bundle: CwaImageryBundle; urls: Map<string, string> }>();
  for (const id of datasetIds) {
    result.set(id, { bundle: { datasetId: id, frames: [] }, urls: new Map() });
  }

  for (const r of rows) {
    const slot = result.get(r.dataset_id);
    if (!slot) continue;
    // 共通欄位在兩型 union 皆有；bytes / key 只存在單一型別，故各自 narrow cast。
    const url = useCdn
      ? `${IMAGERY_CDN_BASE}/${(r as RawManifestRow).image_key}`
      : base64ToObjectUrl((r as RawBatchRow).image_b64, r.mime_type);
    const imageSize = useCdn
      ? (r as RawManifestRow).image_size
      : (r as RawBatchRow).image_b64.length;
    slot.bundle.frames.push({
      datasetId: r.dataset_id,
      observedAtIso: r.observed_at,
      observedAtMs: new Date(r.observed_at).getTime(),
      mimeType: r.mime_type,
      lonMin: r.lon_min,
      lonMax: r.lon_max,
      latMin: r.lat_min,
      latMax: r.lat_max,
      imageSize,
    });
    slot.urls.set(r.observed_at, url);
  }

  for (const slot of result.values()) {
    slot.bundle.frames.sort((a, b) => a.observedAtMs - b.observedAtMs);
  }

  return result;
}

interface RawListRow {
  dataset_id: string;
  observed_at: string;
  mime_type: string;
  lon_min: number;
  lon_max: number;
  lat_min: number;
  lat_max: number;
  image_size: number;
}

/**
 * 取得 datasetIds 清單中、過去 sinceHours 小時內的 frame metadata，依 dataset 分組。
 */
export async function loadCwaImageryFrames(
  datasetIds: string[],
  sinceHours: number,
): Promise<Map<string, CwaImageryBundle>> {
  const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();
  const key = `cwa-imagery-list:${datasetIds.join(",")}`;
  const label = `CWA 影像清單 ${datasetIds.join("/")}`;

  const { data, error } = await withLoading(
    key,
    label,
    supabase.rpc("get_cwa_imagery_list", {
      p_dataset_ids: datasetIds,
      p_since: since,
    }),
  );

  if (error) throw new Error(`get_cwa_imagery_list: ${error.message}`);

  const rows = (data ?? []) as RawListRow[];
  const bundles = new Map<string, CwaImageryBundle>();
  for (const id of datasetIds) {
    bundles.set(id, { datasetId: id, frames: [] });
  }

  for (const r of rows) {
    const bundle = bundles.get(r.dataset_id);
    if (!bundle) continue;
    bundle.frames.push({
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
  }

  for (const bundle of bundles.values()) {
    bundle.frames.sort((a, b) => a.observedAtMs - b.observedAtMs);
  }

  return bundles;
}

/**
 * 取得單一 frame 的 base64 bytes。
 */
export async function fetchCwaImageryBytes(
  datasetId: string,
  observedAtIso: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("get_cwa_imagery_frame", {
    p_dataset_id: datasetId,
    p_observed_at: observedAtIso,
  });
  if (error) throw new Error(`get_cwa_imagery_frame: ${error.message}`);
  if (typeof data !== "string" || data.length === 0) {
    throw new Error(`empty frame: ${datasetId}@${observedAtIso}`);
  }
  return data;
}

/**
 * base64 → object URL（呼叫端記得 revokeObjectURL 以免洩漏）
 */
export function base64ToObjectUrl(b64: string, mimeType: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * 帶併發限制地預載一組 frames 的 bytes，回傳 Map<observedAtIso, objectUrl>。
 */
export async function preloadCwaImageryUrls(
  bundle: CwaImageryBundle,
  concurrency = 6,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const frames = bundle.frames;
  let idx = 0;

  const worker = async () => {
    while (idx < frames.length) {
      const i = idx++;
      const f = frames[i]!;
      try {
        const b64 = await fetchCwaImageryBytes(f.datasetId, f.observedAtIso);
        urls.set(f.observedAtIso, base64ToObjectUrl(b64, f.mimeType));
      } catch (err) {
        console.warn(`[CWA Imagery] fetch failed ${f.datasetId}@${f.observedAtIso}`, err);
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, frames.length) }, () => worker());
  await withLoading(
    `cwa-imagery-preload:${bundle.datasetId}`,
    `CWA 影像預載 ${bundle.datasetId} (${frames.length})`,
    Promise.all(workers),
  );
  return urls;
}
