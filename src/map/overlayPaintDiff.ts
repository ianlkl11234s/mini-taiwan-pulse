// overlayManager 的 diff 式 paint 更新純邏輯。
//
// 背景：updateAllOverlayThemes 在任何 slider 拖動時會遍歷整個 OVERLAY_REGISTRY，
// 對每個 layer 的每個 paint key 呼叫 setPaintProperty —— 即使值完全沒變。
// Mapbox 的 setPaintProperty 不是免費的（觸發 style diff + repaint 排程），
// 在 60Hz slider 拖動下會阻塞渲染主執行緒。
//
// 這裡把「計算 paint → 序列化 → 與上次套用值比對 → 只回傳有變的 key」抽成
// 純函式，讓 overlayManager 只對真正改變的 paint key 呼叫 Mapbox API。

export type SerializedPaint = Record<string, string>;

export interface PaintDiffResult {
  /** 實際需要 setPaintProperty 的 [key, value] */
  changed: Array<[string, unknown]>;
  /** 本次完整序列化結果（呼叫端應存回 cache） */
  serialized: SerializedPaint;
}

/** 序列化 paint 值供比對；undefined 以哨兵字串表示（JSON.stringify(undefined) 回 undefined）。 */
export function serializePaintValue(value: unknown): string {
  const s = JSON.stringify(value);
  return s === undefined ? "__undefined__" : s;
}

/**
 * 比對新 paint 與上次套用的序列化快照，回傳需要更新的 key。
 * prev 為 undefined 表示該 layer 尚無快照（剛 addLayer / style 重建）→ 全部視為已套用，
 * 由呼叫端決定（addOverlay 時 paint 已隨 addLayer 套用，直接存快照即可）。
 */
export function diffPaint(
  prev: SerializedPaint | undefined,
  paint: Record<string, unknown>,
): PaintDiffResult {
  const serialized: SerializedPaint = {};
  const changed: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(paint)) {
    const s = serializePaintValue(value);
    serialized[key] = s;
    if (!prev || prev[key] !== s) {
      changed.push([key, value]);
    }
  }
  return { changed, serialized };
}

/** 將整份 paint 序列化成快照（addLayer 當下使用）。 */
export function snapshotPaint(paint: Record<string, unknown>): SerializedPaint {
  const out: SerializedPaint = {};
  for (const [key, value] of Object.entries(paint)) {
    out[key] = serializePaintValue(value);
  }
  return out;
}

/** 快照是否相等（rebuildOnParamChange 用：paint 沒變就不 rebuild）。 */
export function paintSnapshotEquals(
  a: SerializedPaint | undefined,
  b: SerializedPaint,
): boolean {
  if (!a) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}
