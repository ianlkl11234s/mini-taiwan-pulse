/**
 * 特殊船舶（Vessel Watch）分類色票 —— **loader / 圖例 / popup 三邊的單一出處**
 *
 * 來源：`live.vessel_watch_registry.rule_class`（gis-platform migration 339），
 * 分類規則與實測校正見 `docs/proposal/vessel-watch-layer.md` §4。
 *
 * ⚠️ **命名地雷（絕不可簡寫成「海巡」）**
 *    `HAIXUN`「海巡」是**中國海事局**的船（MID 412/413/414），
 *    與**台灣海巡署**（MID 416，船號 CG/PP/CL 前綴）完全兩回事。
 *    任何顯示一律寫全稱 —— 這是分類本身的資訊價值所在，縮寫等於毀掉它。
 *
 * ⚠️ 分類是**規則推斷**不是官方認定：`ship_type` 由船方自報、可造假也常填錯，
 *    registry 另有人工確認欄（`confirmed_class`）覆寫規則值。因此本表以外的
 *    字串是**預期會發生**的（人工新增分類），一律落到 `VESSEL_CLASS_FALLBACK`。
 *
 * ⚠️ 本檔必須保持**零 import**（同 religionTypes / funeralTypes 的色票規約）：
 *    `layerManifest.ts` 之外，LegendPanel 也是 /embed 基礎 bundle 的 static import。
 */

/** 一個分類的顯示定義。順序 = 圖例顯示順序（中國系 → 台灣系 → 其他）。 */
export interface VesselClassDef {
  /** 與 RPC 回傳的 `vessel_class` 逐字相同（中文，DB 端就是中文字串） */
  value: string;
  /** 圖例／popup 顯示文字。與 value 相同時仍寫出來，讓「顯示」可獨立於「資料值」演進 */
  label: string;
  color: string;
}

/**
 * 12 類（實測 2026-08-12：`get_vessel_watch_classes()` 回傳的就是這 12 個值）。
 *
 * 配色語意：中國系走暖色（紅→橙→黃→粉→紫）、台灣系走冷色（藍／綠）、
 * 他國與軍艦走中性色 —— 一眼可分「哪一邊的船」，同邊再靠色相分機關。
 */
export const VESSEL_CLASSES: readonly VesselClassDef[] = [
  // ── 中國系（暖色）──
  { value: "中國海警", label: "中國海警", color: "#ef4444" },
  { value: "中國海事局", label: "中國海事局（HAIXUN 海巡）", color: "#f97316" },
  { value: "中國漁政", label: "中國漁政", color: "#eab308" },
  { value: "中國海監", label: "中國海監", color: "#f472b6" },
  { value: "中國其他公務船", label: "中國其他公務船", color: "#a855f7" },
  { value: "中國科研船", label: "中國科研船", color: "#22d3ee" },
  { value: "中國油氣作業船", label: "中國油氣作業船", color: "#78716c" },
  // ── 台灣系（冷色）──
  { value: "台灣海巡署", label: "台灣海巡署（CG/PP/CL）", color: "#3b82f6" },
  { value: "台灣科研船", label: "台灣科研船", color: "#22c55e" },
  // ── 其他 ──
  { value: "他國執法船", label: "他國執法船", color: "#94a3b8" },
  { value: "他國科研船", label: "他國科研船", color: "#84cc16" },
  { value: "軍艦", label: "軍艦（多為他國過境）", color: "#facc15" },
];

/** 規則／人工分類都認不出來時的顏色（不是「其他」分類，是「本表沒收錄」） */
export const VESSEL_CLASS_FALLBACK = "#e2e8f0";

const BY_VALUE: Record<string, VesselClassDef> = Object.fromEntries(
  VESSEL_CLASSES.map((c) => [c.value, c]),
);

/** 分類 → 顏色；未知分類回 fallback（不丟錯 —— 上游隨時可能新增人工分類） */
export function vesselClassColor(cls: string | null | undefined): string {
  if (!cls) return VESSEL_CLASS_FALLBACK;
  return BY_VALUE[cls]?.color ?? VESSEL_CLASS_FALLBACK;
}

/** 分類 → 顯示文字；未知分類原字串照回（比顯示「其他」誠實） */
export function vesselClassLabel(cls: string | null | undefined): string {
  if (!cls) return "未分類";
  return BY_VALUE[cls]?.label ?? cls;
}
