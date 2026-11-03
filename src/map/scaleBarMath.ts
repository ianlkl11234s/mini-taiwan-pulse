/**
 * 地圖比例尺與定位精度圈的純計算（design-system spec §5.43 地圖導航控制 N-1）。
 * 不依賴 mapbox-gl，方便單元測試。
 */

/** 赤道周長（公尺），Web Mercator 用的 WGS84 長半徑 × 2π */
const EARTH_CIRCUMFERENCE_M = 40075016.686;
/** Mapbox GL 向量圖磚邊長（px） */
const TILE_SIZE = 512;
/** 96 dpi 下 1 px 的實際長度（公尺）＝ 0.0254 / 96 */
const METERS_PER_SCREEN_PX = 0.0002646;

/** 畫面上 1 px 在地面的公尺數（Web Mercator，依緯度修正） */
export function metersPerPixel(lat: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (TILE_SIZE * 2 ** zoom);
}

/** 不超過 maxMeters 的最大「好讀」距離：1／2／5 × 10ⁿ 公尺 */
export function niceDistance(maxMeters: number): number {
  if (!(maxMeters > 0) || !Number.isFinite(maxMeters)) return 0;
  const pow = 10 ** Math.floor(Math.log10(maxMeters));
  const d = maxMeters / pow;
  const step = d >= 5 ? 5 : d >= 2 ? 2 : 1;
  return step * pow;
}

/** 長條短於此 px 時隱藏中點標籤（中點與終點數字各約 20px 寬、置中於刻度，保守留白） */
export const SCALE_BAR_MID_LABEL_MIN_PX = 80;

/** 距離字串：<1000 用 m，≥1000 用 km（三語單位同為 m／km） */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${trimNumber(meters / 1000)} km`;
  return `${trimNumber(meters)} m`;
}

function trimNumber(n: number): string {
  // 1/2/5×10ⁿ 的一半可能是 0.5、2.5 → 最多保留 1 位小數，不出現浮點尾數
  return String(Math.round(n * 10) / 10);
}

export interface ScaleBarModel {
  /** 長條代表的距離（公尺） */
  meters: number;
  /** 長條長度（px） */
  px: number;
  /** 刻度數字：0／中點／終點（純數字，不含單位） */
  labels: [string, string, string];
  /** 單位（m 或 km），畫在長條右側，不放進終點標籤 */
  unit: "m" | "km";
  /** 完整終點距離（例 "200 m"），給 aria-label 用 */
  fullLabel: string;
  /** 長條夠長才顯示中點標籤；太短時中點與終點會互撞 */
  showMid: boolean;
  /** 數字比例（1:46K），96 dpi 換算 */
  ratio: string;
}

/**
 * 依畫面中心緯度與縮放算比例尺。長條最長 maxPx，距離取 1／2／5×10ⁿ。
 * 標籤只放數字，單位另外回傳；中點與終點用同一個單位（終點 ≥1000 m 時中點也用 km 的數字）。
 */
export function scaleBarModel(lat: number, zoom: number, maxPx = 200): ScaleBarModel | null {
  const mpp = metersPerPixel(lat, zoom);
  if (!(mpp > 0) || !Number.isFinite(mpp)) return null;
  const meters = niceDistance(mpp * maxPx);
  if (meters <= 0) return null;
  const px = meters / mpp;
  const useKm = meters >= 1000;
  const unit = useKm ? 1000 : 1;
  return {
    meters,
    px,
    labels: ["0", trimNumber(meters / 2 / unit), trimNumber(meters / unit)],
    unit: useKm ? "km" : "m",
    fullLabel: formatDistance(meters),
    showMid: px >= SCALE_BAR_MID_LABEL_MIN_PX,
    ratio: formatScaleRatio(mpp),
  };
}

/** 數字比例尺：m/px ÷ 0.0002646，取 2 位有效數字，以 K／M 縮寫（例 1:46K） */
export function formatScaleRatio(mpp: number): string {
  const denom = mpp / METERS_PER_SCREEN_PX;
  if (!(denom > 0) || !Number.isFinite(denom)) return "";
  const rounded = Number(denom.toPrecision(2));
  if (rounded >= 1e6) return `1:${trimSig(rounded / 1e6)}M`;
  if (rounded >= 1e3) return `1:${trimSig(rounded / 1e3)}K`;
  return `1:${trimSig(rounded)}`;
}

function trimSig(n: number): string {
  return String(Number(n.toPrecision(2)));
}

/** 定位精度圈：accuracy（公尺）在目前縮放下的半徑 px */
export function accuracyRadiusPx(accuracyMeters: number, lat: number, zoom: number): number {
  const mpp = metersPerPixel(lat, zoom);
  if (!(mpp > 0) || !(accuracyMeters > 0)) return 0;
  return accuracyMeters / mpp;
}

/** 比例尺最低顯示縮放：低於此值（地球儀投影下）比例尺會誤導，整個隱藏 */
export const SCALE_BAR_MIN_ZOOM = 5;
