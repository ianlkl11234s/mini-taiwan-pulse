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
