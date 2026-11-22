/**
 * marineYearAtlas.ts — 「每年一張拼圖」的月幀讀取（海洋熱浪 twMarineHeatwaves、珊瑚白化熱壓力 twCoralBleachingHeatStress 共用）。
 *
 * 發布包（analytics pipelines/marine/_shared/pack_year_atlas.py）：
 *   <prefix>_frames_v1.json      幀清單：每月一列，記這個月在哪張年拼圖的哪一格（tile_x/y/width/height）與四角經緯度
 *   <prefix>_<YYYY>_v1.png       年拼圖：12 格，4 欄×3 列，1 月左上逐列往右；沒資料的月份格子全透明、清單也不列
 *   <prefix>_values_<YYYY>_v1.json  該年每月每格數值（popup 查值用）
 *
 * image source 會把整張圖拉到四角，所以要先把當月那格裁出來（canvas → PNG object URL）再交給 updateImage。
 * 同一年的拼圖與數值檔只抓一次（各留最近 6 年，超過就丟最舊的）；所有 fetch 與裁切都掛 loadingRegistry。
 */
import { withLoading } from "../lib/loadingRegistry";

export interface YearAtlasFrame {
  period: string; // YYYY-MM
  valid_time: string;
  status: string;
  lon_min: number;
  lon_max: number;
  lat_min: number;
  lat_max: number;
  encoding: string;
  atlas_key: string;
  tile_x: number;
  tile_y: number;
  tile_width: number;
  tile_height: number;
  values_key: string;
}

export interface YearAtlasGrid {
  /** [lonMin, latMin, lonMax, latMax]（格網外緣） */
  edges: [number, number, number, number];
  step_deg: number;
  ncols: number;
  nrows: number;
}

export interface YearAtlasManifest {
  product: string;
  encoding: string;
  period_first: string;
  period_last: string;
  dataset_id: string;
  version: string;
  grid: YearAtlasGrid;
  frames: YearAtlasFrame[];
}

const MAX_CACHED_YEARS = 6;

/** 小型 LRU：存 Promise（同一年同時要兩次只抓一次）；失敗的不留，下次重抓 */
class PromiseLru<T> {
  private readonly map = new Map<string, Promise<T>>();
  constructor(private readonly cap: number, private readonly onEvict?: (p: Promise<T>) => void) {}
  get(key: string, make: () => Promise<T>): Promise<T> {
    const hit = this.map.get(key);
    if (hit) {
      this.map.delete(key);
      this.map.set(key, hit);
      return hit;
    }
    const p = make();
    this.map.set(key, p);
    p.catch(() => { if (this.map.get(key) === p) this.map.delete(key); });
    while (this.map.size > this.cap) {
      const oldest = this.map.keys().next().value as string;
      const old = this.map.get(oldest)!;
      this.map.delete(oldest);
      this.onEvict?.(old);
    }
    return p;
  }
  clear() { this.map.clear(); }
}

const manifestCache = new Map<string, Promise<YearAtlasManifest>>();
const bitmapCache = new PromiseLru<ImageBitmap>(MAX_CACHED_YEARS * 2, (p) => { p.then((b) => b.close?.(), () => {}); });
const valuesCache = new PromiseLru<unknown>(MAX_CACHED_YEARS * 2);

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}：${url}`);
  return res;
}

/** 目錄（結尾含 /）＋ key */
export function yearAtlasUrl(base: string, key: string): string {
  return `${base}${key}`;
}

/** 幀清單（每個 URL 只抓一次；失敗可重試） */
export function loadYearAtlasManifest(url: string, label: string): Promise<YearAtlasManifest> {
  let p = manifestCache.get(url);
  if (!p) {
    p = withLoading(`year-atlas-manifest:${url}`, label, fetchOk(url).then((r) => r.json() as Promise<YearAtlasManifest>));
    manifestCache.set(url, p);
    p.catch(() => { if (manifestCache.get(url) === p) manifestCache.delete(url); });
  }
  return p;
}

/** 年拼圖解碼成 ImageBitmap（不預乘 alpha、不轉色彩空間，值編碼才不會被改） */
export function loadYearAtlasBitmap(url: string, label: string): Promise<ImageBitmap> {
  return bitmapCache.get(url, () => withLoading(`year-atlas-image:${url}`, label,
    fetchOk(url).then((r) => r.blob()).then((blob) => createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none" }))));
}

/** 年度數值檔 */
export function loadYearAtlasValues<T>(url: string, label: string): Promise<T> {
  return valuesCache.get(url, () => withLoading(`year-atlas-values:${url}`, label, fetchOk(url).then((r) => r.json()))) as Promise<T>;
}

/**
 * 從年拼圖裁出一個月 → PNG object URL（呼叫端用完要 URL.revokeObjectURL）。
 * 像素只有 alpha 0／255 兩種，canvas 的預乘不會改到有效像素的值。
 */
export function cropYearAtlasTile(bitmap: ImageBitmap, frame: Pick<YearAtlasFrame, "tile_x" | "tile_y" | "tile_width" | "tile_height">, label: string): Promise<string> {
  const job = new Promise<string>((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = frame.tile_width;
    canvas.height = frame.tile_height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { reject(new Error("canvas 2d 不可用")); return; }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, frame.tile_x, frame.tile_y, frame.tile_width, frame.tile_height, 0, 0, frame.tile_width, frame.tile_height);
    canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error("裁切失敗"))), "image/png");
  });
  return withLoading(`year-atlas-crop:${frame.tile_x},${frame.tile_y}:${Math.random().toString(36).slice(2, 8)}`, label, job);
}

/** 依 YYYY-MM 找幀；清單沒有＝未涵蓋 */
export function pickYearAtlasFrame(manifest: YearAtlasManifest, period: string): YearAtlasFrame | null {
  return manifest.frames.find((f) => f.period === period) ?? null;
}

/** 經緯度 → 格索引（row 0＝北緣、col 0＝西緣）；格網外回 null */
export function yearAtlasCellIndex(grid: YearAtlasGrid, lng: number, lat: number): number | null {
  const [lonMin, , , latMax] = grid.edges;
  const col = Math.floor((lng - lonMin) / grid.step_deg);
  const row = Math.floor((latMax - lat) / grid.step_deg);
  if (col < 0 || row < 0 || col >= grid.ncols || row >= grid.nrows) return null;
  return row * grid.ncols + col;
}

/** 測試用 */
export function resetYearAtlasCaches(): void {
  manifestCache.clear();
  bitmapCache.clear();
  valuesCache.clear();
}
