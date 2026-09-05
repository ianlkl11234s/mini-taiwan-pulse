/**
 * 台灣交通樞紐的顯示模式與港口分類色。
 *
 * 港口色階直接對齊 `public/geo/port_polygons.geojson` 的 `port_class`；
 * 地圖、圖例與 popup 共用這份定義，避免同一類別在三處變成不同顏色。
 */

export const TRANSPORT_HUB_DISPLAY_MODES = [
  { value: "polygon", label: "實際範圍" },
  { value: "point", label: "Mapbox 點位" },
] as const;

export const PORT_CLASS_FALLBACK = {
  value: "other",
  label: "其他／未分類",
  color: "#94a3b8",
} as const;

export const PORT_CLASSES = [
  { value: "國際商港", label: "國際商港", color: "#3b82f6" },
  { value: "國內商港", label: "國內商港", color: "#14b8a6" },
  { value: "客運港", label: "客運港", color: "#8b5cf6" },
  { value: "渡輪/觀光碼頭", label: "渡輪／觀光碼頭", color: "#a855f7" },
  { value: "離島渡輪港", label: "離島渡輪港", color: "#d946ef" },
  { value: "第一類漁港", label: "第一類漁港", color: "#f59e0b" },
  { value: "第二類漁港", label: "第二類漁港", color: "#5f8f78" },
  { value: "廢止漁港", label: "廢止漁港", color: "#64748b" },
  { value: "對岸港口", label: "對岸港口", color: "#ef4444" },
] as const;

export function portClassColor(value: unknown): string {
  const raw = String(value ?? "");
  return PORT_CLASSES.find((entry) => entry.value === raw)?.color ?? PORT_CLASS_FALLBACK.color;
}

/** Mapbox `match` expression：缺值／新類別一律是灰色，不假裝成現有分級。 */
export const PORT_CLASS_COLOR_EXPRESSION: unknown[] = [
  "match",
  ["get", "port_class"],
  ...PORT_CLASSES.flatMap((entry) => [entry.value, entry.color]),
  PORT_CLASS_FALLBACK.color,
];
