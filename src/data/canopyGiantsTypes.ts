/**
 * 樹冠巨木 Canopy Giants（全台 45m+ 樹冠，7,823 點）配色 SSOT。
 * 依 dist_access_m（離最近道路/步道/林道公尺）分 5 級：越偏遠越紅。
 * 給 overlayRegistry（circle-color step 表達式）與 LegendPanel（圖例）兩處共用。
 *
 * 資料來源：Meta/WRI 樹冠高度 10m raster × OSM 道路 + 林業署步道/林道 可及性分析
 * （分析文件見 docs/features/tree-layers/canopy-accessibility/）。dist_access_m 全距 13–9293，中位數 2926。
 *
 * ⚠️ 表達式不得含 ["zoom"]（同 urbanOpenSpaceTypes.ts 慣例）。
 */

export interface CanopyGiantDistBand {
  /** 該級上界（不含）；最後一級為 null（無上界） */
  max: number | null;
  color: string;
  label: string;
}

// 離最近可及線 5 級（近→遠 = 黃→深紅，同靜態預覽圖 autumn_r 語意）
export const CANOPY_GIANT_DIST_BANDS: CanopyGiantDistBand[] = [
  { max: 500,  color: "#fee08b", label: "< 500 m" },
  { max: 1500, color: "#fdae61", label: "500–1500 m" },
  { max: 3000, color: "#f46d43", label: "1500–3000 m" },
  { max: 5000, color: "#d73027", label: "3000–5000 m" },
  { max: null, color: "#a50026", label: "≥ 5000 m" },
];

/** 離道路距離分級 step：依 5 級 band 上色（近→遠） */
export function canopyGiantDistColorExpr(): unknown[] {
  const val: unknown[] = ["to-number", ["get", "dist_access_m"], 0];
  const step: unknown[] = ["step", val, CANOPY_GIANT_DIST_BANDS[0]!.color];
  for (let i = 1; i < CANOPY_GIANT_DIST_BANDS.length; i++) {
    step.push(CANOPY_GIANT_DIST_BANDS[i - 1]!.max as number, CANOPY_GIANT_DIST_BANDS[i]!.color);
  }
  return step;
}
