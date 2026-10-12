// atlas 批次六個統計家族共用的 recipe 型別（health／fiscal／indigenousRural／sports／hazard／marine）。
// 只放型別，讓各家族檔與 atlasStatisticsRecipes.ts 共用而不互相 import。
import type { StatisticsLevel } from "./regionalStatisticsLoader";

export interface AtlasReleaseOption {
  release_id: string;
  period_start: string;
  period_end: string;
  dimensions: Record<string, string>;
}

/** 一個維度（癌別、性別、疫苗劑次…）：預設值照 layer-plan；選項順序＝預設在前，其餘依標籤。 */
export interface AtlasDimension {
  key: string;
  label: string;
  default: string;
  options: Array<{ value: string; label: string }>;
}

/** ascending＝淺 → 深為低 → 高；descending＝反轉（社會脆弱度的能力構面：值越低越深）。 */
export type AtlasScaleDirection = "ascending" | "descending";

export interface AtlasScale {
  breaks: number[];
  direction: AtlasScaleDirection;
}

/** 非數值狀態：無資料、不適用（無潛勢溪流、非臨海、無保留地、無此類病床）、來源刪除；都不上數值色。 */
export type AtlasStatusKind = "missing" | "not_applicable" | "suppressed";

export interface AtlasRecipe {
  layer_key: string;
  enabled: boolean;
  family: string;
  label: string;
  /** Statistics 群組 key（同一概念一列；原始數／比例、縣市／鄉鎮在群組選單內切換）。 */
  group: string;
  group_label: string;
  option_label: string;
  /** 小群組（Layers 目錄的 group，也是 Statistics 分頁主題下的群組標題）。 */
  subgroup: string;
  /** Layers 完整目錄的主題（manifest section）。 */
  data_theme: string;
  /** Statistics 分頁的主題（layerPanels STATISTICS_MACRO_GROUPS）。 */
  tab_theme: string;
  visual_theme: string;
  dataset_id: string;
  indicator_id: string;
  level: StatisticsLevel;
  boundary_version: string;
  unit: string;
  aggregation: string;
  default_release_id: string;
  dimensions: AtlasDimension[];
  release_options: AtlasReleaseOption[];
  legend: {
    method: "fixed_breaks";
    /** 預設維度組合的固定門檻（跨期可比，不依當期重算）。 */
    breaks: number[];
    direction: AtlasScaleDirection;
    /** 取代通用「淺 → 深」說明（社會脆弱度方向）。 */
    scale_note: string | null;
    zero_note: string | null;
    /** 金額門檻換算、自然值等附註。 */
    display_note: string | null;
    /** 非預設維度組合各自的固定門檻／方向；鍵為 dimensions 依 `dimensions[]` 順序以 `|` 串接。 */
    by_dimension: Record<string, AtlasScale> | null;
    /** 維度組合附註（社會脆弱度子指標的所屬構面與方向依據）。 */
    dimension_notes: Record<string, string> | null;
  };
  status_labels: Partial<Record<AtlasStatusKind, string>>;
  format: { locale: string; maximumFractionDigits: number };
  derived: boolean;
  location_semantics: string;
  disclosure: string;
  publisher: string;
  license: string;
  source_landing_url: string;
  source_download_url: string;
  source_title: string;
}

export interface AtlasRecipeDocument {
  scope: string;
  family: string;
  recipes: AtlasRecipe[];
}
