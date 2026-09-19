/**
 * rasterProbeSampler.ts — 值編碼 raster PMTiles 的「點地圖讀物理值」探針（W2）。
 *
 * 對標既有的 `climateFieldSampler`（nullschool 式點擊讀 UV PNG）。差別只有取磚：
 * climateField 是單張全球 PNG，本檔要先 range-request 對應的 PMTiles 磚再解 PNG 像素。
 *
 * 適用對象＝**像素裡就是物理值**的兩張 raster（其餘 5 張 raster 是上游預烤的已上色
 * 影像，沒有數值通道可讀，維持 popup: null）：
 *   - urbanHeat    R=熱島強度 ΔT、G=絕對地表溫度、A=有效遮罩
 *   - canopyHeight R=G=B=公尺高度、A=nodata mask
 *
 * ⚠️ 解碼常數不在本檔自己定義，一律從既有 SSOT 取：
 *   urbanHeat  → `urbanHeatTypes.ts`（其常數與上游 urban_heat_lst_encoding.json 同源）
 *   canopy     → `overlayRegistry.ts` canopyHeight 區塊的註解（mix 6.375=(1/40)×255、
 *                色帶 stop 0.025↔1m）已明載 R 的原始 DN 就是公尺高度
 *
 * ⚠️ nodata 一律靠 A 判斷：urbanHeat 的 R=0 是合法的 −30K，不是空值。
 */
import { PMTiles } from "pmtiles";
import { getLoadedJpHeightCatalog } from "./jpHeightCatalog";

export interface UrbanHeatProbe {
  /** 熱島強度 ΔT，單位 K */
  delta_t: number;
  /** 絕對地表溫度，單位 °C */
  lst_c: number;
}

export interface CanopyHeightProbe {
  /** 樹冠高度，單位公尺 */
  height_m: number;
}

export interface JpCanopyHeightProbe extends CanopyHeightProbe {
  source: string;
  coverage: string;
  resolution: string;
}

const URBAN_HEAT_URL = "./environment/urban_heat_lst_taiwan.pmtiles";
const CANOPY_URL = "./forestry/canopy_height_rgb_taiwan.pmtiles";
/** 與 overlayRegistry 的 pmtiles.{minzoom,maxzoom} 逐字一致 */
const URBAN_HEAT_ZOOM = { min: 6, max: 11 };
const CANOPY_ZOOM = { min: 6, max: 12 };

const archives = new Map<string, PMTiles>();

function getArchive(relUrl: string): PMTiles {
  let a = archives.get(relUrl);
  if (!a) {
    // PMTiles 直連要絕對 URL（overlay 走的是 mapbox 的 pmtiles:// protocol，不共用）
    a = new PMTiles(new URL(relUrl, window.location.href).toString());
    archives.set(relUrl, a);
    // Keep only the two most recently probed JP shards; TW archives are fixed.
    const jpUrls = [...archives.keys()].filter((url) => new URL(url, window.location.href).pathname.startsWith("/jp-heights/"));
    while (jpUrls.length > 2) { const oldest = jpUrls.shift(); if (oldest) archives.delete(oldest); }
  }
  archives.delete(relUrl); archives.set(relUrl, a);
  return a;
}

/** 經緯度 → Web Mercator 磚座標（含磚內小數位置） */
function lngLatToTile(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { tx: Math.floor(x), ty: Math.floor(y), fx: x - Math.floor(x), fy: y - Math.floor(y) };
}

/**
 * 取單一像素的 RGBA。從 maxzoom 往下退，直到拿得到磚（邊緣區域高 zoom 常缺磚）。
 * 回 null＝該點沒有任何磚 / 解碼失敗。
 */
async function samplePixel(
  relUrl: string, zoom: { min: number; max: number }, lng: number, lat: number, signal?: AbortSignal,
): Promise<[number, number, number, number] | null> {
  if (signal?.aborted) return null;
  const archive = getArchive(relUrl);
  for (let z = zoom.max; z >= zoom.min; z--) {
    const { tx, ty, fx, fy } = lngLatToTile(lng, lat, z);
    let buf: ArrayBuffer | undefined;
    try {
      buf = (await archive.getZxy(z, tx, ty, signal))?.data;
    } catch {
      return null; // 檔案本身取不到（404 / range 不支援）→ 不必再退 zoom
    }
    if (!buf) continue;
    try {
      const bitmap = await createImageBitmap(new Blob([buf]));
      if (signal?.aborted) { bitmap.close(); return null; }
      // 磚邊界的 fx/fy 可能算出 == size，夾住避免 getImageData 越界
      const px = Math.min(bitmap.width - 1, Math.floor(fx * bitmap.width));
      const py = Math.min(bitmap.height - 1, Math.floor(fy * bitmap.height));
      const canvas = new OffscreenCanvas(1, 1);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) { bitmap.close(); return null; }
      ctx.drawImage(bitmap, px, py, 1, 1, 0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      bitmap.close();
      return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, d[3] ?? 0];
    } catch {
      return null;
    }
  }
  return null;
}

/** 熱島：ΔT(K)=R/5−30、°C=G/4+10（urbanHeatTypes 檔頭的通道編碼） */
export async function sampleUrbanHeat(lng: number, lat: number): Promise<UrbanHeatProbe | null> {
  const px = await samplePixel(URBAN_HEAT_URL, URBAN_HEAT_ZOOM, lng, lat);
  if (!px) return null;
  const [r, g, , a] = px;
  if (a < 128) return null; // 海 / 常年雲 / 有效觀測 < 5
  return { delta_t: r / 5 - 30, lst_c: g / 4 + 10 };
}

/** 樹冠：R 的原始 DN 就是公尺高度（overlayRegistry canopyHeight 註解） */
export async function sampleCanopyHeight(lng: number, lat: number): Promise<CanopyHeightProbe | null> {
  const px = await samplePixel(CANOPY_URL, CANOPY_ZOOM, lng, lat);
  if (!px) return null;
  const [r, , , a] = px;
  if (a < 128) return null;
  return { height_m: r };
}

let jpProbeController: AbortController | undefined;
const EMPTY_SOURCE_IDS = new Set<string>();
/** Choose only real ready coverage; cancel an older probe and bound archive cache. */
export async function sampleJpCanopyHeight(lng: number, lat: number, mapZoom?: number, activeSourceIds: ReadonlySet<string> = EMPTY_SOURCE_IDS): Promise<JpCanopyHeightProbe | null> {
  jpProbeController?.abort();
  jpProbeController = new AbortController();
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const loaded = getLoadedJpHeightCatalog();
  if (!loaded || loaded.status === "unavailable") return null;
  const normalizedLng = ((lng + 180) % 360 + 360) % 360 - 180;
  const region = loaded.catalog.regions.find((entry) => {
    const asset = entry.canopy;
    return entry.status === "ready" && asset && normalizedLng >= asset.bbox[0] && normalizedLng <= asset.bbox[2]
      && lat >= asset.bbox[1] && lat <= asset.bbox[3] && (mapZoom === undefined || mapZoom >= asset.minzoom);
  });
  const detailSourceId = region ? `jp-canopy-height--${region.id}` : undefined;
  const detailAsset = detailSourceId && activeSourceIds.has(detailSourceId) ? region?.canopy : undefined;
  const overview = loaded.catalog.canopyOverview;
  const overviewMatches = overview && normalizedLng >= overview.bbox[0] && normalizedLng <= overview.bbox[2]
    && lat >= overview.bbox[1] && lat <= overview.bbox[3] && (mapZoom === undefined || mapZoom >= overview.minzoom)
    && activeSourceIds.has("jp-canopy-height--overview");
  const asset = detailAsset ?? (overviewMatches ? overview : undefined);
  if (!asset) return null;
  const px = await samplePixel(asset.url, { min: asset.minzoom, max: asset.maxzoom }, normalizedLng, lat, jpProbeController.signal);
  if (!px || px[3] < 128) return null;
  const scope = region?.label ?? "日本樹冠概覽";
  const coverage = asset.coverage === "source-coverage" ? "來源涵蓋範圍" : "部分區域覆蓋";
  const resolution = asset.pixelSizeProjectedM === undefined ? "解析度未提供" : `約 ${asset.pixelSizeProjectedM} m 投影像素`;
  return { height_m: px[0], source: `${asset.attribution ?? "Meta/WRI CHMv2"} ${asset.sourceYear ?? ""}`.trim(), coverage: `${scope}；${coverage}`, resolution };
}

export interface RasterProbeResult {
  urbanHeat: UrbanHeatProbe | null;
  canopyHeight: CanopyHeightProbe | null;
  jpCanopyHeight: JpCanopyHeightProbe | null;
}

/**
 * click 讀值入口：依開啟的圖層取樣。兩者皆無效 → 回 null，
 * 讓呼叫端 fallback 回既有的「清空 featureInfo」路徑（同 sampleClimateFields 的契約）。
 */
export async function sampleRasterProbes(
  want: { urbanHeat: boolean; canopyHeight: boolean; jpCanopyHeight: boolean },
  lng: number,
  lat: number,
  mapZoom?: number,
  activeJpCanopySourceIds?: ReadonlySet<string>,
): Promise<RasterProbeResult | null> {
  const [urbanHeat, canopyHeight, jpCanopyHeight] = await Promise.all([
    want.urbanHeat ? sampleUrbanHeat(lng, lat).catch(() => null) : Promise.resolve(null),
    want.canopyHeight ? sampleCanopyHeight(lng, lat).catch(() => null) : Promise.resolve(null),
    want.jpCanopyHeight ? sampleJpCanopyHeight(lng, lat, mapZoom, activeJpCanopySourceIds).catch(() => null) : Promise.resolve(null),
  ]);
  if (!urbanHeat && !canopyHeight && !jpCanopyHeight) return null;
  return { urbanHeat, canopyHeight, jpCanopyHeight };
}
