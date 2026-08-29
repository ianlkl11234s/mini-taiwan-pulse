import type { GfwV4SpatialHitGroup } from "./gfwV4SpatialFrame";

/**
 * GFW v4 Tracks Worker 線協定（main thread ↔ gfwV4SpatialPmtilesWorker）的 SSOT。
 *
 * Worker 與 layer 同壽命：換小時只送 `load`（增量），同小時的插值只送 `render`。
 * 每個 `load` 帶遞增的 generation；Worker 的每個回覆都必須把 generation 原樣帶回，
 * 並用 `loaded` 明確區分「這個 generation 的資料還沒進來」與「這個小時真的沒船」。
 */

export interface GfwV4TrackAssetRef {
  /** 已解析的 PMTiles 絕對 URL。 */
  url: string;
  /** 索引到 canonical GFW v4 bucket 順序（FISHING…UNKNOWN）。 */
  bucket: number;
  /** `${BUCKET}|${observedAt}` —— 同一 asset 跨相鄰 tile 去重用。 */
  identity: string;
}

export interface GfwV4TrackShardTileRef { z: number; x: number; y: number; }

/**
 * 增量載入：Worker 保留 PMTiles archive（header/directory）與已解碼 tile，
 * 只有 cache miss 的 (url, tile) 才會真的發 Range request。
 */
export interface GfwV4TrackLoadRequest {
  type: "load";
  generation: number;
  assets: readonly GfwV4TrackAssetRef[];
  tiles: readonly GfwV4TrackShardTileRef[];
  epoch: number;
  trailingSeconds: number;
}

/** 同小時內的插值：只重算 typed frame，不碰網路。 */
export interface GfwV4TrackRenderRequest {
  type: "render";
  generation: number;
  epoch: number;
  trailingSeconds: number;
  /** 只有「新 generation 首次 apply」需要重建 popup hit source。 */
  includeHits: boolean;
}

export type GfwV4TrackWorkerRequest = GfwV4TrackLoadRequest | GfwV4TrackRenderRequest;

export interface GfwV4TrackWireTelemetry {
  requestCount: number; wireBytes: number; decodedBytes: number; status206: number; status200: number;
}

/**
 * Worker tile 快取的本次 load 差量。取代已刪除的 bench 第二 pass：
 * 「同一個 (url, tile) 不會被抓第二次」是快取有效的等價驗證點，
 * 正常情況 `duplicateFetches` 與 `evictions` 都必須是 0。
 */
export interface GfwV4TrackTileCacheTelemetry {
  /** 本次 load 查詢的 (asset, tile) 組合數。 */
  lookups: number;
  /** 由 Worker tile 快取直接命中，完全沒碰網路。 */
  cacheHits: number;
  /** 真的走 archive.getZxy 的次數。 */
  networkFetches: number;
  /** 曾經抓過又再抓一次 —— 應為 0；>0 代表快取容量不足。 */
  duplicateFetches: number;
  /** 本次 load 造成的 tile 快取淘汰數；為 0 時 duplicateFetches 必然為 0。 */
  evictions: number;
  /** 重複偵測用的 key 集合已達上限，duplicateFetches 可能低估。 */
  trackingSaturated: boolean;
}

export interface GfwV4TrackFrameReply {
  ok: true;
  /** 原樣帶回請求的 generation；main thread 用它擋亂序 / 過期回覆。 */
  generation: number;
  /** false = Worker 對這個 generation 還沒有 committed 觀測 → 保留現有畫面。 */
  loaded: boolean;
  frameEpoch: number;
  points: Float32Array;
  buckets: Uint8Array;
  memberCounts: Uint16Array;
  segments: Float32Array;
  segmentBuckets: Uint8Array;
  /** 只有 `includeHits` 的請求會帶；null = 不要動 hit source。 */
  hitGroups: GfwV4SpatialHitGroup[] | null;
  /** 本次 load 實際打出去的 Range 統計（render 回覆為 undefined）。 */
  wire?: GfwV4TrackWireTelemetry;
  /** 本次 load 的 tile 快取差量（render 回覆為 undefined）。 */
  tiles?: GfwV4TrackTileCacheTelemetry;
  workerMs?: number;
}

export interface GfwV4TrackErrorReply { ok: false; generation: number; error: string; }

export type GfwV4TrackWorkerReply = GfwV4TrackFrameReply | GfwV4TrackErrorReply;

/**
 * `apply`      —— 這是目前 generation 的已載入資料，且有點 → 換上新 frame。
 * `keep-stale` —— generation 過期／亂序，或該 generation 尚未載入完 → **保留現有畫面**。
 * `clear`      —— 已載入但真的 0 點（該小時/視窗沒船）→ 清空。
 *
 * 「已載入但空」與「還沒載入完」必須分開，否則不是 hour boundary 整層閃白，
 * 就是真空小時錯誤殘留上一小時的船。
 */
export type GfwV4TrackFrameDecision = "apply" | "keep-stale" | "clear";

export interface GfwV4TrackFrameOutcome {
  generation: number;
  loaded: boolean;
  pointCount: number;
}

export function decideGfwV4TrackFrame(reply: GfwV4TrackFrameOutcome, currentGeneration: number): GfwV4TrackFrameDecision {
  if (!Number.isFinite(reply.generation) || reply.generation !== currentGeneration) return "keep-stale";
  if (!reply.loaded) return "keep-stale";
  return reply.pointCount > 0 ? "apply" : "clear";
}
