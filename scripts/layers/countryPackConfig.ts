/**
 * move-country-pack 的各國設定（B1 P5a）。codemod 的「手動補」一律寫在這裡，不在搬完的檔案裡手改。
 *
 * - dedicated：整檔搬進 src/countries/<dir>/ 的國家專屬模組（路徑相對 repo 根；全 repo 的 import 會跟著改寫）
 * - rename：搬家時順便改名（例：中國的 key 檔改成 keys.ts，讓 lint 規則認得出唯一可靜態 import 的檔）
 * - moveNamed：放在共用檔裡的國家專屬具名匯出（例：寫在 waterLegends 裡的英國圖例），連同只給它用的區域宣告一起搬
 * - excludeKeys：這一輪先不搬的 key（例：GB atlas 統計另一步搬）
 * - specNotes：規格層 popupNotes 的備註表要由國家包登記（layerSourceInfo 的 SPEC_NOTES 已不含該國）
 * - keepOverlays：這國的 overlay 但留在中央 registry
 */
export interface MoveNamed {
  file: string;
  names: string[];
  /** 搬到 src/countries/<dir>/ 底下的檔名 */
  to: string;
}

export interface CountryPackConfig {
  dir: string;
  /** 國名（載入標籤用：「載入〈國名〉圖層清單」） */
  nameZh: string;
  dedicated: RegExp[];
  rename?: Record<string, string>;
  moveNamed?: MoveNamed[];
  excludeKeys?: RegExp;
  /** key 型別：已存在的 keys.ts 型別名稱；沒有就由 codemod 產生 keys.ts（<Cc>LayerKey） */
  keyType: string;
  /** all：備註全收（KR／IE 的規格層）；預設只收沒有 when 條件的（specLayerNotes） */
  specNotes?: { specsImport: string; specsName: string; all?: boolean };
  /** 這國的 overlay 但留在中央 registry（例：jpHeightLifecycle 依視窗管理的樣板，MapView 開站就要） */
  keepOverlays?: string[];
}

export const COUNTRY_PACK_CONFIG: Record<string, CountryPackConfig> = {
  CN: {
    dir: "cn",
    nameZh: "中國",
    dedicated: [
      /^src\/data\/cn[A-Z][A-Za-z]*\.ts$/,
      /^src\/hooks\/useCn[A-Z][A-Za-z]*\.ts$/,
      /^src\/components\/legend\/cnLegends\.tsx$/,
      /^src\/components\/featureInfo\/cnPanels\.tsx$/,
      /^src\/layers\/hosts\/chinaHosts\.tsx$/,
    ],
    rename: { "src/data/cnDataKeys.ts": "keys.ts" },
    keyType: "CnLayerKey",
    specNotes: { specsImport: "./cnDataLayers", specsName: "CN_DATA_SPECS" },
  },
  GB: {
    dir: "gb",
    nameZh: "英國",
    dedicated: [
      /^src\/data\/gb(?!StatisticsRecipes)[A-Z][A-Za-z]*\.ts$/,
      /^src\/hooks\/useGb[A-Z][A-Za-z]*\.ts$/,
      /^src\/components\/legend\/gb[A-Z][A-Za-z]*\.tsx$/,
      /^src\/components\/featureInfo\/(ukPanels|gbRailReplayPanel)\.tsx$/,
      /^src\/layers\/hosts\/ukHosts\.tsx$/,
    ],
    moveNamed: [
      {
        file: "src/components/legend/waterLegends.tsx",
        names: ["GbRiversLegend", "GbHydroStationsLegend", "GbFloodDefenceAssetsLegend", "GbCoastalErosionRiskLegend", "GbBathingWatersLegend"],
        to: "gbWaterSharedLegends.tsx",
      },
      {
        file: "src/components/legend/urbanFormLegends.tsx",
        names: ["GbAdminBoundariesLegend", "GbSmallAreaBoundariesLegend", "GbMaritimeLimitsLegend", "GbBuiltUpAreasLegend", "GbGreenspaceLegend"],
        to: "gbUrbanFormLegends.tsx",
      },
    ],
    excludeKeys: /^statsGb/,
    keyType: "GbLayerKey",
  },
  IE: {
    dir: "ie",
    nameZh: "愛爾蘭",
    dedicated: [
      /^src\/data\/ie(?!StatisticsRecipes)[A-Z][A-Za-z]*\.ts$/,
      /^src\/hooks\/useIe[A-Z][A-Za-z]*\.ts$/,
      /^src\/components\/legend\/ieLegends\.tsx$/,
      /^src\/components\/featureInfo\/iePanels\.tsx$/,
      /^src\/layers\/hosts\/irelandHosts\.tsx$/,
    ],
    rename: { "src/data/ieDataKeys.ts": "keys.ts" },
    excludeKeys: /^statsIe/,
    keyType: "IeLayerKey",
    specNotes: { specsImport: "./ieDataLayers", specsName: "IE_DATA_SPECS", all: true },
  },
};
