/**
 * 廢棄物處理設施類別色（facility_type-keyed）—— 零 import 的純色票檔。
 *
 * 三邊共用的單一真實來源：wasteMapboxLayers 的 circle-color（paint）、LegendPanel 的
 * WasteFacilityLegend（圖例）、layerManifest 五類設施的 `color`（側欄識別色 LAYER_COLORS）。
 * 零 import 才能讓 layerManifest 引用（見 layerManifest.ts 檔頭的 import 方向規約）；
 * wasteLoader 再匯出，既有 import 點不變。
 *
 * 2026-10-09 決議（R6 段 2）：焚化爐由紅 #ef4444（＝STATUS 錯誤紅，K-3 不該挪用）
 * 改成 3D 子場景（WasteIncineratorScene 底圈／火苗 0xff6b1a）的橘，平面與立體同色。
 */
export const WASTE_FACILITY_COLORS: Record<string, string> = {
  incinerator: "#ff6b1a",          // 橘 — 焚化爐（同 3D 底圈／火苗 0xff6b1a）
  landfill: "#92400e",             // 棕 — 掩埋場
  landfill_coastal: "#0891b2",     // 深青 — 濱海掩埋場 🌊
  transfer_station: "#a855f7",     // 紫 — 轉運站
  recycling_plant: "#22c55e",      // 綠 — 回收廠
  monitoring_well: "#3b82f6",      // 藍 — 地下水監測井
  food_waste_processing: "#f59e0b",
  scrap_yard: "#737373",
  medical_waste: "#ec4899",        // 粉紅 — 醫療廢棄物（warning）
  repair_shop: "#0ea5e9",
  other: "#6b7280",
};
