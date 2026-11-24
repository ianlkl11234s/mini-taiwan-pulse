/**
 * 比較模式兩張地圖的鏡頭同步（mapbox-gl-sync-move 的做法：`move` → 對方 `jumpTo`，防重入旗標）。
 *
 * - 雙向：在哪一半拖、縮放、旋轉、傾斜，另一張都跟著動（兩張一樣大、同一組相機 → 像素對齊）。
 * - 同步 center／zoom／bearing／pitch／padding。
 * - 地形：主圖傾斜過就會掛 terrain（`MapView.ensureTerrainIfTilted`），右圖鏡射主圖實際狀態（`mirrorTerrain`），
 *   兩邊高程一致，把手處接縫才連續。
 * - Agent 的 `flyTo` 只打主地圖（左），右圖靠這裡跟著動。
 */
export interface SyncableMap {
  on(type: "move", listener: () => void): unknown;
  off(type: "move", listener: () => void): unknown;
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  getBearing(): number;
  getPitch(): number;
  getPadding(): unknown;
  jumpTo(options: Record<string, unknown>): unknown;
}

export function cameraOf(map: SyncableMap) {
  return { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), padding: map.getPadding() };
}

/** 雙向同步；回傳解除函式。`afterMirror` 在每次鏡射後呼叫（右圖用來鏡射地形） */
export function syncMaps(a: SyncableMap, b: SyncableMap, afterMirror?: (from: SyncableMap, to: SyncableMap) => void): () => void {
  let syncing = false;
  const mirror = (from: SyncableMap, to: SyncableMap) => () => {
    if (syncing) return;
    syncing = true;
    try {
      to.jumpTo(cameraOf(from));
      afterMirror?.(from, to);
    } finally {
      syncing = false;
    }
  };
  const fromA = mirror(a, b);
  const fromB = mirror(b, a);
  a.on("move", fromA);
  b.on("move", fromB);
  return () => { a.off("move", fromA); b.off("move", fromB); };
}

// ── 兩國並排：只同步比例尺（G2-1，站主 2026-11-24 決定 2）──────────────────
// 兩國位置各看各的，只讓「同樣長度的線代表同樣的公尺數」。Mercator 每像素公尺數和 cos(緯度) 成正比，
// 所以同一個 zoom 在台灣（24°N）和英國（54°N）差約 1.55 倍：zoomB = zoomA + log2(cos φB / cos φA)。
// 中心、旋轉、傾斜、padding 都不同步。

/** 比例尺同步只需要的地圖介面 */
export interface ScaleSyncableMap {
  on(type: "move", listener: () => void): unknown;
  off(type: "move", listener: () => void): unknown;
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  jumpTo(options: { zoom: number }): unknown;
}

/** 緯度夾在 ±85（Mercator 上限），避免 cos→0 */
const clampLat = (lat: number) => Math.max(-85, Math.min(85, lat));
const cosLat = (lat: number) => Math.cos((clampLat(lat) * Math.PI) / 180);

/** 讓緯度 `toLat` 處的比例尺等於 `fromLat` 處 zoom `fromZoom` 的比例尺 */
export function scaleMatchedZoom(fromZoom: number, fromLat: number, toLat: number): number {
  return fromZoom + Math.log2(cosLat(toLat) / cosLat(fromLat));
}

/** 浮點誤差內視為同一級（避免互相 jumpTo 抖動） */
const ZOOM_EPSILON = 1e-6;

/** 把 `to` 的縮放對齊 `from` 的比例尺（只動 zoom，不動中心）；有動回 true */
export function alignScale(from: ScaleSyncableMap, to: ScaleSyncableMap): boolean {
  const target = scaleMatchedZoom(from.getZoom(), from.getCenter().lat, to.getCenter().lat);
  if (!Number.isFinite(target) || Math.abs(to.getZoom() - target) < ZOOM_EPSILON) return false;
  to.jumpTo({ zoom: target });
  return true;
}

/**
 * 雙向比例尺同步：哪一張在動（縮放或平移換了緯度），就調另一張的 zoom；防重入旗標避免互相觸發。
 * `isLocked()` 每次 move 都讀（開關可隨時切）；關掉後不再同步，重新打開由呼叫端 `alignScale(主, 右)` 對齊一次。
 */
export function syncScale(a: ScaleSyncableMap, b: ScaleSyncableMap, isLocked: () => boolean): () => void {
  let syncing = false;
  const follow = (from: ScaleSyncableMap, to: ScaleSyncableMap) => () => {
    if (syncing || !isLocked()) return;
    syncing = true;
    try {
      alignScale(from, to);
    } finally {
      syncing = false;
    }
  };
  const fromA = follow(a, b);
  const fromB = follow(b, a);
  a.on("move", fromA);
  b.on("move", fromB);
  return () => { a.off("move", fromA); b.off("move", fromB); };
}
