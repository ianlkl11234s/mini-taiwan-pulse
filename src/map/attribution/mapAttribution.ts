/**
 * 主站右下資料來源列的「地圖端」：從地圖上**實際存在且可見**的 source 收集圖層來源，
 * 並讓 Mapbox 內建 AttributionControl 只顯示底圖版權。
 *
 * 為什麼讀地圖而不是讀 OverlayConfig：圖層來源寫進 source 的路徑不只 overlayRegistry
 * （overlayManager addSource），還有十多個 hook 自己 addSource 或事後補 `source.attribution =`
 * （PMTiles、GFW、JMA、海象、日本水資源、橋梁、液化…），部分字串是執行期才決定的。
 * 讀 source instance 的 `attribution` ＝ 內建控制項原本讀的同一個欄位，原本會顯示的來源
 * 在這裡一定收得到，不必逐一登記。
 *
 * 底圖判定：source url 以 `mapbox://` 開頭（底圖 composite、衛星、地形 DEM）。這類 source
 * 留給內建控制項顯示「© Mapbox © OpenStreetMap Improve this map」（Mapbox 條款要求常駐可見），
 * 其餘一律歸圖層來源。
 */
import mapboxgl from "mapbox-gl";

export interface MapSourceView {
  id: string;
  /** source 規格的 url（mapbox:// 判定底圖用） */
  url?: unknown;
  /** source instance 上的 attribution（hook 事後補的值也在這裡） */
  attribution?: unknown;
  /** 是否有可見（visibility ≠ none）的 layer 使用它 */
  used: boolean;
}

export function isBasemapSourceUrl(url: unknown): boolean {
  return typeof url === "string" && url.startsWith("mapbox://");
}

/** 可見、非底圖、有 attribution 的 source → 去重後的原字串（保留出現順序）。 */
export function collectLayerAttributions(views: readonly MapSourceView[]): string[] {
  const out: string[] = [];
  for (const v of views) {
    if (!v.used || isBasemapSourceUrl(v.url)) continue;
    if (typeof v.attribution !== "string") continue;
    const text = v.attribution.trim();
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** 只需要這兩個 Mapbox／MapLibre 共有的公開方法。 */
export interface AttributionMapLike {
  getStyle(): { sources?: Record<string, any>; layers?: any[] } | undefined | null;
  getSource(id: string): any;
}

/** 以公開 API 讀出所有 source 的 view（style 尚未載入或序列化失敗時回空陣列）。 */
export function readMapSourceViews(map: AttributionMapLike): MapSourceView[] {
  let style: ReturnType<AttributionMapLike["getStyle"]>;
  try {
    style = map.getStyle();
  } catch {
    return [];
  }
  if (!style?.sources) return [];
  const used = new Set<string>();
  for (const layer of style.layers ?? []) {
    if (typeof layer?.source === "string" && layer.layout?.visibility !== "none") used.add(layer.source);
  }
  return Object.entries(style.sources).map(([id, spec]) => {
    const instance = map.getSource(id);
    return { id, url: spec?.url, attribution: instance?.attribution ?? spec?.attribution, used: used.has(id) };
  });
}

/**
 * 只顯示底圖版權的內建 AttributionControl。
 *
 * 覆寫 mapbox-gl 3.18.1 的私有 `_updateAttributions`：呼叫原實作前，把非底圖 source 的
 * attribution 暫時遮掉（同步，結束立刻還原），沿用內建的連結清洗與 Improve this map 連結。
 * 套件內部改版（找不到 `_mergedSourceCaches`）時直接走原實作＝顯示全部來源：寧可多標，不可漏標。
 */
export class BasemapAttributionControl extends mapboxgl.AttributionControl {
  _updateAttributions(): void {
    const base = (mapboxgl.AttributionControl.prototype as any)._updateAttributions as (() => void) | undefined;
    if (typeof base !== "function") return;
    const caches = (this as any)._map?.style?._mergedSourceCaches as Record<string, any> | undefined;
    if (!caches || typeof caches !== "object") {
      base.call(this);
      return;
    }
    const masked: Array<[any, unknown]> = [];
    for (const id in caches) {
      const source = caches[id]?.getSource?.();
      if (source && source.attribution && !isBasemapSourceUrl(source.url)) {
        masked.push([source, source.attribution]);
        source.attribution = undefined;
      }
    }
    try {
      base.call(this);
    } finally {
      for (const [source, value] of masked) source.attribution = value;
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * 空殼 control：提供一個放在右下角落、內建版權列左側的 DOM 節點，React 用 portal 掛進來。
 * 須在 BasemapAttributionControl **之前** addControl：底部角落新加的 control 插在最前面，
 * 版權列成為第一個（最右），本節點以 `clear: none` 浮在它左側同一行（CSS 見 attributionBar.css）。
 */
export class AttributionHostControl implements mapboxgl.IControl {
  readonly element: HTMLDivElement;

  constructor(className: string) {
    this.element = document.createElement("div");
    this.element.className = `mapboxgl-ctrl ${className}`;
  }

  onAdd(): HTMLElement {
    return this.element;
  }

  onRemove(): void {
    this.element.remove();
  }
}
