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
  /** 規格層自建的 style layer id 由國家包登記（layerVisibilityHint 的 layerStyleIds） */
  styleIds?: { specsImport: string; specsName: string };
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
  KR: {
    dir: "kr",
    nameZh: "南韓",
    dedicated: [
      /^src\/data\/kr(?!StatisticsRecipes)[A-Z][A-Za-z]*\.ts$/,
      /^src\/hooks\/useKr[A-Z][A-Za-z]*\.ts$/,
      /^src\/components\/legend\/kr[A-Z][A-Za-z]*\.tsx$/,
      /^src\/components\/featureInfo\/kr[A-Z][A-Za-z]*\.tsx$/,
      /^src\/layers\/hosts\/koreaHosts\.tsx$/,
    ],
    rename: { "src/data/krDataKeys.ts": "keys.ts" },
    excludeKeys: /^statsKr/,
    keyType: "KrLayerKey",
    specNotes: { specsImport: "./krDataLayers", specsName: "KR_DATA_SPECS", all: true },
    styleIds: { specsImport: "./krDataLayers", specsName: "KR_DATA_SPECS" },
  },
  CA: {
    dir: "ca",
    nameZh: "加拿大",
    dedicated: [
      /^src\/data\/ca(?!StatisticsRecipes)[A-Z][A-Za-z]*\.ts$/,
      /^src\/hooks\/useCa[A-Z][A-Za-z]*\.ts$/,
      /^src\/components\/legend\/ca[A-Z][A-Za-z]*\.tsx$/,
      /^src\/components\/featureInfo\/ca[A-Z][A-Za-z]*\.tsx$/,
      /^src\/layers\/hosts\/canadaHosts\.tsx$/,
    ],
    rename: { "src/data/caWavesKeys.ts": "keys.ts" },
    excludeKeys: /^statsCa/,
    keyType: "CaLayerKey",
    specNotes: { specsImport: "./caWavesLayers", specsName: "CA_WAVE_SPECS" },
  },
  TH: {
    dir: "th",
    nameZh: "泰國",
    dedicated: [
      /^src\/data\/th[A-Z][A-Za-z0-9]*\.ts$/,
      /^src\/hooks\/useTh[A-Z][A-Za-z]*\.ts$/,
      /^src\/components\/legend\/th[A-Z][A-Za-z]*\.tsx$/,
      /^src\/components\/featureInfo\/th[A-Z][A-Za-z]*\.tsx$/,
      /^src\/layers\/hosts\/thailandHosts\.tsx$/,
    ],
    rename: { "src/data/thDataKeys.ts": "keys.ts" },
    keyType: "ThLayerKey",
  },
  PH: {
    dir: "ph",
    nameZh: "菲律賓",
    dedicated: [
      /^src\/data\/ph[A-Z][A-Za-z0-9]*\.ts$/,
      /^src\/hooks\/usePh[A-Z][A-Za-z]*\.ts$/,
      /^src\/components\/legend\/ph[A-Z][A-Za-z]*\.tsx$/,
      /^src\/components\/featureInfo\/ph[A-Z][A-Za-z]*\.tsx$/,
      /^src\/layers\/hosts\/philippinesHosts\.tsx$/,
    ],
    rename: { "src/data/phDataKeys.ts": "keys.ts" },
    keyType: "PhLayerKey",
    specNotes: { specsImport: "./phDataLayers", specsName: "PH_DATA_SPECS" },
  },
  VN: {
    dir: "vn",
    nameZh: "越南",
    dedicated: [
      /^src\/data\/vn[A-Z][A-Za-z0-9]*\.ts$/,
      /^src\/hooks\/useVn[A-Z][A-Za-z]*\.ts$/,
      /^src\/components\/legend\/vn[A-Z][A-Za-z]*\.tsx$/,
      /^src\/components\/featureInfo\/vn[A-Z][A-Za-z]*\.tsx$/,
      /^src\/layers\/hosts\/vietnamHosts\.tsx$/,
    ],
    rename: { "src/data/vnDataKeys.ts": "keys.ts" },
    keyType: "VnLayerKey",
    specNotes: { specsImport: "./vnDataLayers", specsName: "VN_DATA_SPECS" },
  },
  ID: {
    dir: "id",
    nameZh: "印尼",
    dedicated: [
      /^src\/data\/id[A-Z][A-Za-z0-9]*\.ts$/,
      /^src\/hooks\/useId[A-Z][A-Za-z]*\.ts$/,
      /^src\/components\/legend\/id[A-Z][A-Za-z]*\.tsx$/,
      /^src\/components\/featureInfo\/id[A-Z][A-Za-z]*\.tsx$/,
      /^src\/layers\/hosts\/indonesiaHosts\.tsx$/,
    ],
    rename: { "src/data/idDataKeys.ts": "keys.ts" },
    keyType: "IdLayerKey",
  },
  JP: {
    dir: "jp",
    nameZh: "日本",
    // 留在靜態的：中央的圖例／popup／App／點擊查詢／高度生命週期／GIBS 雪覆蓋（JP key 但掛在中央 hook）還直接用的型別與 loader
    dedicated: [
      /^src\/data\/(?!(?:jmaImageryLoader|jmaTypes|jmaUpstreamLoaders|jpBusStopTypes|jpEvacuationSiteTypes|jpHeightCatalog|jpHeightFeatureMetadata|jpHeightTypes|jpInlandFloodTypes|jpLandslideWarningTypes|jpMedicalLoader|jpMedicalTypes|jpNationalForestTypes|jpPoliceFacilityTypes|jpPopulationMeshModes|jpPublicOfficeTypes|jpRailwayTypes|jpReligionTypes|jpRoadTypes|jpSchoolTypes|jpStationTypes|jpTourismTypes|jpWaterLoader|jpWaterTypes|jpWelfareFacilityTypes|jpZoningUseDistrictTypes|jpTrafficAccidentsTypes|jmaPointTypes)\.ts$)(jp|jma)[A-Z][A-Za-z0-9]*\.ts$/,
      /^src\/hooks\/(?!(?:useJpWaterPrivateAccess)\.ts$)use(Jp|Jma)[A-Z][A-Za-z0-9]*\.ts$/,
      /^src\/components\/legend\/(?!jpSafety)(jp|jma)[A-Z][A-Za-z0-9]*\.tsx$/,
      /^src\/components\/featureInfo\/(?!jpSafety|jpAccommodationDensityPanel)(jp[A-Z][A-Za-z0-9]*|jma[A-Za-z0-9]*|japanPanels)\.tsx$/,
      /^src\/layers\/hosts\/(japan|jma|jmaPoint)Hosts\.tsx$/,
    ],
    // 寫在中央 climateHosts 的日本宗教 Host（含 3D 的 climateHosts 不能被國家包靜態帶進來）
    moveNamed: [{ file: "src/layers/hosts/climateHosts.tsx", names: ["JpReligionHost"], to: "jpReligionHost.tsx" }],
    // 日本交通事故（overlay 和台灣 G36 圖層寫在同一個展開陣列裡）、住宿密度（overlay 由中央 helper 產生）留在中央：整層留在靜態，嵌入頁照常可用
    excludeKeys: /^(jpTrafficAccidents2025|jpAccommodationDensity)$/,
    keyType: "JpLayerKey",
    // jpHeightLifecycle 依視窗管理的樣板：MapView 開站就要
    keepOverlays: ["jpBuildingHeight", "jpCanopyHeight"],
  },
};
