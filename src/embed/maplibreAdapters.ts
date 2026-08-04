/**
 * MapLibre 端的引擎差異橋接（EM-06）
 *
 * 主站 mapbox-gl 用 `mapbox-pmtiles` 註冊自訂 source type（`Style.setSourceType`，
 * Mapbox 專有 API，MapLibre 沒有）。MapLibre 這邊改走官方 `pmtiles` 套件的
 * `addProtocol("pmtiles", …)`，source 則是普通的 vector/raster + `pmtiles://` URL。
 *
 * 這是兩個引擎唯一的**實質**差異；其餘圖層邏輯（199 個 overlay 的 source/layer/paint）
 * 完全共用 `overlayManager`。
 */
import maplibregl from "maplibre-gl";
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
