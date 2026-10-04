// 軌道路線（railRoutes）靜態圖層的系統表與篩選 —— overlayRegistry / 圖例 / popup / params 四邊共用 SSOT。
// 資料：public/rail/routes_static.geojson（scripts/preprocess/build-rail-routes.py 產生；不載入任何時刻表）。
// 線色取自 geojson 的 `color`（各線官方線色）；這裡的 colors 只供圖例列出該系統實際出現的線色。

import { RAIL_LINES, RAIL_OPERATORS } from "../constants/railLines";

export const RAIL_ROUTES_URL = "./rail/routes_static.geojson";
export const RAIL_ROUTES_SOURCE_ID = "rail-routes";

export interface RailRoutesSystem {
  /** geojson `system` 屬性值；"all" = 不篩選 */
  value: string;
  label: string;
  /** 圖例用：該系統實際出現的線色（與 geojson `color` 同源，見 build-rail-routes.py） */
  colors: readonly string[];
}

/** 捷運／輕軌各線（圖例與捷運站圖例共用）：取自 constants/railLines.ts（官方線色）＋ 貓空纜車（軌道 MK-1-0 自帶色）＋ 高雄環狀輕軌。
 *  與 geojson `color` 的同步由 railRoutesTypes.test.ts 守住。 */
export interface RailMetroLine { system: string; lineId: string; name: string; color: string }
export const RAIL_METRO_LINES: readonly RailMetroLine[] = [
  ...RAIL_LINES.map((l) => ({ system: l.system, lineId: l.lineId, name: l.name, color: l.color })),
  { system: "trtc", lineId: "MK", name: "貓空纜車", color: "#06b8e6" },
  { system: "klrt", lineId: "C", name: "高雄環狀輕軌", color: RAIL_OPERATORS.find((o) => o.id === "klrt")?.color ?? "#43aa8b" },
];
const lineColors = (system: string) => RAIL_METRO_LINES.filter((l) => l.system === system).map((l) => l.color);

export const RAIL_ROUTES_SYSTEMS: readonly RailRoutesSystem[] = [
  { value: "tra", label: "台鐵", colors: ["#A8A8A8"] },
  { value: "thsr", label: "高鐵", colors: ["#ee6c00"] },
  // trtc 目錄同時含新北捷運（環狀／淡海／安坑／三鶯）、桃園機場捷運與貓空纜車，統一歸「台北捷運」系統（資料來源分類）
  { value: "trtc", label: "台北捷運", colors: lineColors("trtc") },
  { value: "krtc", label: "高雄捷運", colors: lineColors("krtc") },
  { value: "klrt", label: "高雄輕軌", colors: lineColors("klrt") },
  { value: "tmrt", label: "台中捷運", colors: lineColors("tmrt") },
];

/** select 選項（第 0 項＝全部） */
export const RAIL_ROUTES_SYSTEM_OPTIONS: readonly { label: string; value: string }[] = [
  { label: "全部", value: "all" },
  ...RAIL_ROUTES_SYSTEMS.map((s) => ({ label: s.label, value: s.value })),
];

export const RAIL_ROUTES_SYSTEM_LABELS: Record<string, string> = Object.fromEntries(
  RAIL_ROUTES_SYSTEMS.map((s) => [s.value, s.label]),
);

/** 無 `color` 屬性時的保底線色（理論上不會發生，build 腳本每條線都寫 color） */
export const RAIL_ROUTES_FALLBACK_COLOR = "#9ca3af";

export function railRoutesSystemFilter(index: number): unknown[] {
  const selected = RAIL_ROUTES_SYSTEM_OPTIONS[index]?.value ?? "all";
  return selected === "all" ? ["all"] : ["==", ["get", "system"], selected];
}
