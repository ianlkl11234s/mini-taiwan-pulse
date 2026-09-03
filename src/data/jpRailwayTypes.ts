import type { ExpressionSpecification } from "mapbox-gl";

// ── 事業者種別（operator_type，5 類，scalar 屬性，非陣列）──
// 與 jpStationTypes.ts 的 JP_STATION_TYPES 同名類別沿用同一 hex，
// 讓車站與鐵道在地圖上視覺一致（5 類名稱逐字相同：新幹線/JR在来線/民営鉄道/第三セクター/公営鉄道）。
export interface JpRailwayType { value: string; label: string; color: string; }
export const JP_RAILWAY_TYPES: JpRailwayType[] = [
  { value: "新幹線",       label: "新幹線",       color: "#22c55e" },
  { value: "JR在来線",     label: "JR 在来線",    color: "#3b82f6" },
  { value: "民営鉄道",     label: "民営鉄道",     color: "#f97316" },
  { value: "第三セクター", label: "第三セクター", color: "#a855f7" },
  { value: "公営鉄道",     label: "公営鉄道",     color: "#14b8a6" },
];
export const JP_RAILWAY_TYPE_OTHER = { value: "その他", label: "その他", color: "#9ca3af" };

/**
 * sidebar 圓點／popup 標題色 —— 取最大宗類別 JR在来線（10,517 段，全體 48%）。
 * 由 JP_RAILWAY_TYPES 衍生而非複製 hex 字面（見 layerManifest.ts 檔頭「色票規約」）。
 */
export const JP_RAILWAY_LAYER_COLOR: string =
  JP_RAILWAY_TYPES.find((t) => t.value === "JR在来線")?.color ?? JP_RAILWAY_TYPE_OTHER.color;

// operator_type 在 PMTiles 屬性裡已是純量字串（非車站 operator_types 那種陣列），
// 可直接 ["get","operator_type"] 進 match，不需要 loader 先算 classify。
export const JP_RAILWAY_TYPE_COLOR_EXPRESSION: ExpressionSpecification = [
  "match", ["get", "operator_type"],
  ...JP_RAILWAY_TYPES.flatMap((t) => [t.value, t.color]),
  JP_RAILWAY_TYPE_OTHER.color,
] as unknown as ExpressionSpecification;
