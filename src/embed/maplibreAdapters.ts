/**
 * MapLibre 端的引擎差異橋接（EM-06）
 *
 * 主站 mapbox-gl 用 `mapbox-pmtiles` 註冊自訂 source type（`Style.setSourceType`，
 * Mapbox 專有 API，MapLibre 沒有）。MapLibre 這邊改走官方 `pmtiles` 套件的
 * `addProtocol("pmtiles", …)`，source 則是普通的 vector/raster + `pmtiles://` URL。
 *
 * 這是兩個引擎唯一的**實質**差異；其餘圖層邏輯（189 個 overlay 的 source/layer/paint）
 * 完全共用 `overlayManager`。
 */
import * as maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import type { OverlayConfig } from "../types";

let registered = false;

/** 註冊 pmtiles:// protocol（冪等）。建立 Map 之前必須先呼叫。 */
export function registerPmtilesProtocolOnce(): void {
  if (registered) return;
  registered = true;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
}

/** 相對路徑（registry 用 `./fishery/x.pmtiles`）轉絕對 —— protocol handler 需要完整 URL。 */
export function absoluteUrl(url: string): string {
  return new URL(url, window.location.href).href;
}

/**
 * 產生 MapLibre 版的 PMTiles source 規格，注入 `overlayManager` 的 OverlayEngineOptions。
 *
 * 靜態圖層資產索引（ADR-0024 §4）試點**不含 embed**：embed 是獨立 entry（embed.html），不載入索引，
 * 這裡刻意直接用 `config.sourceUrl`（同源部署時版本），與遷移前行為相同。靜態 GeoJSON 經共用的
 * `hydrateOverlayIfNeeded` 也會因索引未載入而走 fallback＝同一個同源檔。要納入 embed 時，需在
 * EmbedApp 先載入索引並處理 CSP／時序，另案評估。
 *
 * raster / vector 以 `pmtiles.sourceLayer` 有無判定 —— 與 overlayRegistry 的既有約定一致
 * （raster PMTiles 不填 sourceLayer，因為 raster layer 不允許 source-layer 屬性）。
 */
export function maplibrePmtilesSource(config: OverlayConfig): Record<string, unknown> {
  const isRaster = !config.pmtiles?.sourceLayer;
  return {
    type: isRaster ? "raster" : "vector",
    url: `pmtiles://${absoluteUrl(config.sourceUrl)}`,
    minzoom: config.pmtiles?.minzoom,
    maxzoom: config.pmtiles?.maxzoom,
    ...(isRaster ? { tileSize: 512 } : {}),
  };
}
