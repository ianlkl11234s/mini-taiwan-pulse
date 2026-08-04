/**
 * `/embed` 的免費底圖 style（EM-06）
 *
 * Protomaps basemap（OSM 衍生）以單一 PMTiles 檔自託管，瀏覽器用 HTTP Range Request
 * 直接讀 —— 沒有 tile server、沒有 API key、**不載入 mapbox-gl 故不產生 map load 費用**。
 * 路線決策見 docs/proposal/embed-basemap-osm.md。
 *
 * 底圖來源優先序：
 * 1. `VITE_EMBED_BASEMAP_URL`（正式站指向 Cloudflare R2；egress 免費）
 * 2. 預設 `/base_map/taiwan_basemap.pmtiles` —— 沿用專案既有的部署資產管線
 *    （S3 → 容器 /data/base_map/ → nginx location /base_map/），開發時放 public/base_map/ 即可
 */
import { layers, namedFlavor } from "@protomaps/basemaps";
import { absoluteUrl } from "./maplibreAdapters";

const DEFAULT_BASEMAP_PATH = "/base_map/taiwan_basemap.pmtiles";

/** Protomaps 官方字型／圖示資產（GitHub Pages）。自託管化見 BACKLOG EM-12。 */
const PROTOMAPS_ASSETS = "https://protomaps.github.io/basemaps-assets";

export function basemapUrl(): string {
  const configured = import.meta.env.VITE_EMBED_BASEMAP_URL as string | undefined;
  return absoluteUrl(configured && configured.trim() !== "" ? configured : DEFAULT_BASEMAP_PATH);
}

/**
 * 產生底圖 style。回傳的 `layers` 是 Protomaps 官方樣式，資料圖層由
 * overlayManager 之後 addLayer 疊在上面。
 */
export function buildBasemapStyle(isDark: boolean) {
  const flavor = isDark ? "dark" : "light";
  return {
    version: 8 as const,
    glyphs: `${PROTOMAPS_ASSETS}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${PROTOMAPS_ASSETS}/sprites/v4/${flavor}`,
    sources: {
      protomaps: {
        type: "vector" as const,
        url: `pmtiles://${basemapUrl()}`,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    // lang: zh-Hant → 中文地名（實測覆蓋到「里」層級）
    layers: layers("protomaps", namedFlavor(flavor), { lang: "zh-Hant" }),
  };
}
