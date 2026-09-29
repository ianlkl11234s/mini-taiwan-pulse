/**
 * 土壤液化 owner-only 私人 PMTiles 契約（taipei-gis-analytics handoff `soil-liquefaction.md`）。
 *
 * 一個檔、三個 source-layer；只經同源 Range API（每個請求帶 Bearer token，sidecar 驗 owner）讀取。
 * 授權仍是 RIGHTS_HOLD_REUSE_TERMS_UNCONFIRMED：不得進公開 CDN／static／release allowlist。
 *
 * 語意（必守）：
 * - `not_investigated` 是「未調查」，不是低潛勢、0 或無資料；獨立斜線圖例與 popup。
 * - 缺 `potential_class`（或未知值）是「無資料」，不是未調查：不填色、popup 標無資料。
 * - 高／中／低是官方綜合類別，不是量測值。
 * - 弱層欄位是厚度（m）：0＝該深度段沒有弱層；null（vector tile 裡是「沒有這個 key」）才是缺值。
 */

export const SOIL_LIQUEFACTION_PRIVATE_ENDPOINT = "/api/private-research/soil-liquefaction/tiles";
export const SOIL_LIQUEFACTION_PMTILES_FILE = "soil-liquefaction.pmtiles";
export const SOIL_LIQUEFACTION_ACCESS_DENIED_EVENT = "soil-liquefaction-access-denied";
export const SOIL_LIQUEFACTION_SELECTION_CLEAR_EVENT = "soil-liquefaction-selection-clear";
export const SOIL_LIQUEFACTION_SOURCE_ORG = "經濟部地質調查及礦業管理中心";
export const SOIL_LIQUEFACTION_OFFICIAL_MAP_URL = "https://liquefaction.gsmma.gov.tw/cgs/Web/Map.aspx";
/** popup／圖例用的人話；manifest topics 保留原狀態碼 RIGHTS_HOLD_REUSE_TERMS_UNCONFIRMED。 */
export const SOIL_LIQUEFACTION_RIGHTS_TEXT = "重利用條款待確認（僅站主研究用，不公開散布）";
export const SOIL_LIQUEFACTION_ATTRIBUTION = `${SOIL_LIQUEFACTION_SOURCE_ORG}土壤液化潛勢資料（站主限定研究；重利用條款待確認）`;

export const SOIL_LIQUEFACTION_SOURCE_LAYERS = {
  potential: "potential",
  weakSoil: "weak_soil",
  monitoringSites: "monitoring_sites",
} as const;
/** 打包時 weak_soil 的 minzoom（receipt `-L weak_soil minzoom 8`）；更低縮放沒有弱層資料。 */
export const WEAK_SOIL_MIN_ZOOM = 8;

export const WEAK_SOIL_LAYER_KEYS = [
  "weakSoilClay0To5", "weakSoilSand0To5",
  "weakSoilClay5To10", "weakSoilSand5To10",
  "weakSoilClay10To20", "weakSoilSand10To20",
] as const;
export type WeakSoilLayerKey = typeof WEAK_SOIL_LAYER_KEYS[number];

export const SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS = [
  "soilLiquefactionPotential", ...WEAK_SOIL_LAYER_KEYS, "liquefactionMonitoringSites",
] as const;
export type SoilLiquefactionLayerKey = typeof SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS[number];

export function isSoilLiquefactionPrivateLayer(key: string): key is SoilLiquefactionLayerKey {
  return (SOIL_LIQUEFACTION_PRIVATE_LAYER_KEYS as readonly string[]).includes(key);
}

// ── 潛勢（potential_class）────────────────────────────────
export type PotentialClass = "high" | "medium" | "low";
/**
 * ColorBrewer YlOrRd 3 級（F-3：分級色階不自創）。刻意不用官方圖台的紅黃綠：
 * 綠色會被讀成「安全」，而低潛勢不等於無液化風險。
 */
export const SOIL_POTENTIAL_CLASSES: readonly { value: PotentialClass; label: string; color: string }[] = [
  { value: "high", label: "高潛勢", color: "#f03b20" },
  { value: "medium", label: "中潛勢", color: "#feb24c" },
  { value: "low", label: "低潛勢", color: "#ffeda0" },
];
export const SOIL_POTENTIAL_NOT_INVESTIGATED = "not_investigated";

// ── 弱層（weak_soil）──────────────────────────────────────
export type WeakSoilMaterial = "clay" | "sand";
export type WeakSoilDepth = "0_5m" | "5_10m" | "10_20m";
export const WEAK_SOIL_LAYER_SPEC: Record<WeakSoilLayerKey, { material: WeakSoilMaterial; depth: WeakSoilDepth }> = {
  weakSoilClay0To5: { material: "clay", depth: "0_5m" },
  weakSoilSand0To5: { material: "sand", depth: "0_5m" },
  weakSoilClay5To10: { material: "clay", depth: "5_10m" },
  weakSoilSand5To10: { material: "sand", depth: "5_10m" },
  weakSoilClay10To20: { material: "clay", depth: "10_20m" },
  weakSoilSand10To20: { material: "sand", depth: "10_20m" },
};
export const WEAK_SOIL_DEPTH_LABEL: Record<WeakSoilDepth, string> = { "0_5m": "0–5 m", "5_10m": "5–10 m", "10_20m": "10–20 m" };
export const WEAK_SOIL_MATERIAL_LABEL: Record<WeakSoilMaterial, string> = { clay: "軟弱黏土", sand: "疏鬆砂土" };
/** 官方門檻（Guide 07）：黏性土 SPT-N≤4、砂質土 N≤10。 */
export const WEAK_SOIL_SPT_THRESHOLD: Record<WeakSoilMaterial, string> = { clay: "SPT-N≤4", sand: "SPT-N≤10" };

export function weakSoilField(material: WeakSoilMaterial, depth: WeakSoilDepth): string {
  return `${material === "clay" ? "soft_clay_thickness" : "loose_sand_thickness"}_${depth}`;
}

/**
 * 分級門檻（各級上限，m；含上限）。依 2026-09-24 snapshot 實際分布決定（90,360 格、六欄 0 null）：
 * 厚度皆為整數公尺，0–5／5–10 m 段最大 5、10–20 m 段最大 10 —— 以「佔該深度段 20% 一級」切 5 級，
 * 六層共用同一組色票，5 m 段每 1 m 一級、10 m 段每 2 m 一級。0 另計（無弱層，不填色）。
 */
export const WEAK_SOIL_CLASS_UPPER_M: Record<WeakSoilDepth, readonly [number, number, number, number, number]> = {
  "0_5m": [1, 2, 3, 4, 5],
  "5_10m": [1, 2, 3, 4, 5],
  "10_20m": [2, 4, 6, 8, 10],
};
/** ColorBrewer Greys（去掉兩端，暗底圖仍可辨）＝黏土；Oranges 5 級＝砂土（沿用舊圖台灰／橘語意）。 */
export const WEAK_SOIL_COLORS: Record<WeakSoilMaterial, readonly [string, string, string, string, string]> = {
  clay: ["#d9d9d9", "#bdbdbd", "#969696", "#737373", "#525252"],
  sand: ["#feedde", "#fdbe85", "#fd8d3c", "#e6550d", "#a63603"],
};

// ── 監測站（monitoring_sites）─────────────────────────────
export const LIQUEFACTION_SITE_COLOR = "#2563eb";
export const LIQUEFACTION_SITE_PRECISION_LABEL: Record<string, string> = {
  official_published_coordinate: "官方圖台公布座標",
};
export const LIQUEFACTION_SITE_STATUS_LABEL: Record<string, string> = {
  unknown: "未提供（官方圖台未列運作狀態）",
};
