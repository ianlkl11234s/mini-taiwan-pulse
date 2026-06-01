/**
 * 消防圖層的類型 → 顏色 / 標籤單一資料源。
 * 給 LegendPanel 圖例、FeatureInfoPanel popup、overlayRegistry 配色共用，
 * 避免三處各寫一份顏色而漂移。
 */

export interface FireCatStyle {
  cat: string;
  color: string;
  label: string;
}

/** 消防分隊型式（cat 由 export_fire_pois.py 正規化）。 */
export const FIRE_STATION_CATS: FireCatStyle[] = [
  { cat: "大隊", color: "#b71c1c", label: "大隊" },
  { cat: "分隊", color: "#e53935", label: "分隊" },
  { cat: "分駐所", color: "#ff7043", label: "分駐所" },
  { cat: "其他", color: "#bdbdbd", label: "其他" },
];

/** 消防栓型式。 */
export const FIRE_HYDRANT_CATS: FireCatStyle[] = [
  { cat: "地上式", color: "#2196f3", label: "地上式" },
  { cat: "地下式", color: "#00acc1", label: "地下式" },
  { cat: "其他", color: "#90a4ae", label: "其他" },
];

/** 火災事件傷亡分級（對應 useFireEventsLayer 的 casualty 著色）。 */
export const FIRE_EVENT_CATS: FireCatStyle[] = [
  { cat: "casualty", color: "#ff1744", label: "有死傷" },
  { cat: "none", color: "#ff7043", label: "無死傷" },
];

/** 消防栓資料覆蓋限制（圖例 / sidebar 標註用）。 */
export const FIRE_HYDRANT_COVERAGE_NOTE = "僅臺北市、高雄市有公開資料";

/**
 * 救援等時圈分級（黃金救援框架）。minutes 對應 fetch-fire-isochrones.py 的 CONTOURS。
 * 顏色由快到慢：綠（黃金）→ 黃（KPI）→ 橙（邊緣）。供 overlayRegistry / legend / popup 共用。
 */
export interface FireIsochroneBand {
  minutes: number;
  color: string;
  label: string;
}

export const FIRE_ISOCHRONE_BANDS: FireIsochroneBand[] = [
  { minutes: 5, color: "#22c55e", label: "5 分鐘（黃金救援）" },
  { minutes: 10, color: "#eab308", label: "10 分鐘（消防署 KPI）" },
  { minutes: 15, color: "#f97316", label: "15 分鐘（可及邊緣）" },
];

/** 等時圈資料限制（圖例標註用）：driving 路網保守估計，未計消防車優先路權。 */
export const FIRE_ISOCHRONE_NOTE = "driving 路網保守估計，未計消防車鳴笛優先路權（實際略大）";

export const fireIsochroneColor = (minutes: number): string =>
  FIRE_ISOCHRONE_BANDS.find((b) => b.minutes === minutes)?.color ?? "#f97316";

export const fireIsochroneLabel = (minutes: number): string =>
  FIRE_ISOCHRONE_BANDS.find((b) => b.minutes === minutes)?.label ?? `${minutes} 分鐘`;

export const fireStationColor = (cat: string): string =>
  FIRE_STATION_CATS.find((c) => c.cat === cat)?.color ?? "#bdbdbd";

export const fireHydrantColor = (cat: string): string =>
  FIRE_HYDRANT_CATS.find((c) => c.cat === cat)?.color ?? "#90a4ae";
