// ESLint：只啟用取代「讀原始碼＋regex」守門測試的規則，不開 recommended（docs/development-rules.md「自訂 ESLint 規則」）。
// 既有違規記在 eslint-suppressions.json（只能往下降）：修掉違規後跑 `npm run lint:prune`；不要跑 --suppress-all。
import css from "@eslint/css";
import tsParser from "@typescript-eslint/parser";
import pulse from "./eslint-rules/index.js";

const HOOKS_AND_MAP = ["src/hooks/**/*.{ts,tsx}", "src/map/**/*.{ts,tsx}"];

// 站主限定（owner-only）圖層的資料存取檔：資料只走同源 /api/private-research/*。
// 範圍由 eslint-rules/__tests__/ownerOnlyScope.test.js 釘住：src/data、src/hooks 裡含 /api/private-research/
// 或 import 了這類 data 模組的檔，不在下面範圍也不在 OWNER_ONLY_EXEMPT 就紅。
const OWNER_ONLY_FAMILIES = "{bridgeResilience,BridgeResilience,bssBridge,BssBridge,soilLiquefaction,SoilLiquefaction,allenCoral,AllenCoral,coralReef,CoralReef,jpWater,JpWater}";
export const OWNER_ONLY_FILES = [`src/data/${OWNER_ONLY_FAMILIES}*.ts`, `src/hooks/use${OWNER_ONLY_FAMILIES}*.ts`, "src/lib/coralPrivateUi.ts", "src/lib/auth.ts"];
/** 不套 owner-only-no-external-source 的檔與理由（ownerOnlyScope.test.js 逐字釘住，新增要改測試並在 PR 說明）。 */
export const OWNER_ONLY_EXEMPT = {
  "src/data/layerManifest.ts": "全站圖層登記簿，不是 owner-only 專屬檔",
  "src/hooks/useMapInteraction.ts": "全站點擊分派，不是 owner-only 專屬檔",
};
const SOIL_BANNED_TEXT = [
  { regex: "gis\\.liquid\\.net\\.tw|WMSServer|WMTS|\"raster\"", reason: "土壤液化只讀私人 PMTiles，不接官方 WMTS／WMS 或 raster 來源" },
  { regex: "TPSite|臺北市中山站", reason: "不在前端寫死鑽探站點" },
];

export default [
  { ignores: ["**/__tests__/**", "**/__fixtures__/**", "**/*fixture*", "**/*fixture*/**", "**/*.test.*", "**/*.spec.*"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { pulse },
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },

  // Design system guard（spec.md §9）：TS／TSX
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "pulse/design-web-font": "error",
      "pulse/design-triangle-chevron": "error",
      "pulse/design-uppercase-eyebrow": "error",
      "pulse/design-internal-id-display": "warn", // 啟發式，只記錄不擋（§9.2）
    },
  },
  { files: ["src/**/*.{ts,tsx}"], ignores: ["src/components/controls/Slider.tsx"], rules: { "pulse/design-native-range": "error" } },
  { files: ["src/**/*.{ts,tsx}"], ignores: ["src/styles/**"], rules: { "pulse/design-raw-z-index": "error" } },
  { files: ["src/**/*.tsx"], rules: { "pulse/design-font-data-on-cjk": "error" } },
  { files: ["src/data/layerParamsSpec.ts"], rules: { "pulse/design-english-control-label": "error" } },

  // Design system guard（spec.md §9）：CSS（@eslint/css；不開 css 的 recommended）
  {
    files: ["src/**/*.css"],
    language: "css/css",
    plugins: { css, pulse },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      "pulse/design-css-web-font": "error",
      "pulse/design-css-triangle-chevron": "error",
      "pulse/design-css-uppercase-eyebrow": "error",
    },
  },
  // UI 樣式表：src/research 只算第一層（子資料夾是獨立工具頁），src/components 全部
  { files: ["src/research/*.css", "src/components/**/*.css"], rules: { "pulse/design-css-hex-literal": "error" } },
  // src/styles/** 是層級定義檔本身
  { files: ["src/**/*.css"], ignores: ["src/styles/**"], rules: { "pulse/design-css-raw-z-index": "error" } },

  // 站主限定圖層：不寫死外部網址、不讀 import.meta（原 bridgeResilienceTypes／useBssBridgeLayers 測試）
  {
    files: OWNER_ONLY_FILES,
    ignores: Object.keys(OWNER_ONLY_EXEMPT),
    rules: { "pulse/owner-only-no-external-source": "error" },
  },
  {
    files: ["src/data/soilLiquefactionTypes.ts"],
    // 來源卡的官方地圖連結（只允許這一個網址）
    rules: { "pulse/owner-only-no-external-source": ["error", { allowUrls: ["https://liquefaction.gsmma.gov.tw/cgs/Web/Map.aspx"] }] },
  },
  {
    files: ["src/data/jpWaterLoader.ts"],
    // 公開資產網址的建置時路徑前綴（BASE_URL）；非瀏覽器環境（測試）組絕對網址用的備用 base
    rules: { "pulse/owner-only-no-external-source": ["error", { allowImportMeta: ["env.BASE_URL"], allowUrls: ["http://localhost/"] }] },
  },
  {
    files: ["src/hooks/useJpWaterLayers.ts"],
    // 淹水圖層的國土地理院公開 raster 圖磚與兩個授權說明連結（逐一列出完整網址）
    rules: {
      "pulse/owner-only-no-external-source": [
        "error",
        {
          allowUrls: [
            "https://disaportal.gsi.go.jp/hazardmapportal/hazardmap/copyright/copyright_data.html",
            "https://disaportaldata.gsi.go.jp/hazardmap/copyright/opendata.html",
            "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png",
          ],
        },
      ],
    },
  },
  // 土壤液化：不接官方 WMTS／WMS、不寫死站點（原 useSoilLiquefactionLayers 測試）
  {
    files: ["src/data/soilLiquefaction*.ts", "src/hooks/useSoilLiquefaction*.ts"],
    rules: { "pulse/owner-only-banned-text": ["error", { patterns: SOIL_BANNED_TEXT }] },
  },

  // 圖層 hook：map-ready 競態
  { files: ["src/hooks/use*Layer.ts", "src/hooks/factories/timelineSliceLayer.ts"], rules: { "pulse/map-ready-tick-deps": "error" } },

  // 點圖層 R2（docs/design-system/map-layers.md）
  { files: HOOKS_AND_MAP, ignores: ["src/map/overlayRegistry.ts"], rules: { "pulse/no-zoom-circle-radius": "error" } },
  {
    files: HOOKS_AND_MAP,
    ignores: ["src/map/pointSpec.ts", "src/map/mapStyleScale.ts"],
    rules: { "pulse/no-hand-rolled-stroke-opacity": "error" },
  },
  {
    files: HOOKS_AND_MAP,
    // B 類（依資料決定半徑）保留自己的半徑算式
    ignores: [
      "src/hooks/useFloodSensorLayer.ts",
      "src/hooks/useEarthquakeLayer.ts",
      "src/hooks/useEarthquakesGlobalLayer.ts",
      "src/map/earthquakeReplayLayerFactory.ts",
    ],
    rules: { "pulse/no-legacy-radius-helper": "error" },
  },

  // 線／面 R3b：面外框走獨立 line 子圖層
  { files: ["src/hooks/*.ts"], rules: { "pulse/no-fill-outline-color": "error" } },

  // 監控卡片輪詢走 useMonitorResource
  { files: ["src/components/intel/monitor/*.tsx"], rules: { "pulse/monitor-no-manual-polling": "error" } },

  // 圖例收斂（legendKit）
  {
    files: ["src/components/LegendPanel.tsx", "src/components/legend/*.tsx"],
    ignores: ["src/components/legend/legendKit.tsx"],
    rules: { "pulse/legend-no-letter-spacing": "error", "pulse/legend-no-hand-sized-swatch": "error" },
  },

  // day prefetch（AU-3）：CWA 不走共享 queue
  // currentTime 不進 hook deps（CLAUDE.md §6）：全站
  { files: ["src/**/*.{ts,tsx}"], rules: { "pulse/no-current-time-deps": "error" } },
  {
    files: ["src/hooks/useCwaImageryLayer.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/dayPrefetch"],
              importNames: ["subscribePrefetchWindow"],
              message: "CWA 雷達有自己的串行／silent／debounce 預抓，不走共享 subscribePrefetchWindow（AU-3，見 useCwaImageryLayer.test）",
            },
          ],
        },
      ],
    },
  },
];
