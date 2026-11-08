// ESLint：只啟用取代「讀原始碼＋regex」守門測試的規則，不開 recommended（docs/development-rules.md「自訂 ESLint 規則」）。
// 既有違規記在 eslint-suppressions.json（只能往下降）：修掉違規後跑 `npm run lint:prune`；不要跑 --suppress-all。
import css from "@eslint/css";
import tsParser from "@typescript-eslint/parser";
import pulse from "./eslint-rules/index.js";

const HOOKS_AND_MAP = ["src/hooks/**/*.{ts,tsx}", "src/map/**/*.{ts,tsx}"];

// 站主限定（owner-only）圖層的資料存取檔：資料只走同源 /api/private-research/*。
// 範圍由 eslint-rules/__tests__/ownerOnlyScope.test.js 釘住：src/data、src/hooks 裡含 /api/private-research/
// 或 import 了這類 data 模組的檔，不在下面範圍也不在 OWNER_ONLY_EXEMPT 就紅。
const OWNER_ONLY_FAMILIES = "{busCrowding,BusCrowding,bridgeResilience,BridgeResilience,bssBridge,BssBridge,soilLiquefaction,SoilLiquefaction,allenCoral,AllenCoral,coralReef,CoralReef,jpWater,JpWater}";
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

// loader 的 RPC 不包 withLoading 的已知例外（`檔名:函式名` → 理由）。判準：使用者在等這筆資料時，畫面上有沒有別的東西
// 告訴他「正在載入」？沒有就該包 withLoading，不是加進這裡。規則會在例外已不需要時報 stale（只減不增）。
// 原 src/data/__tests__/loadingRegistryContract.test.ts 的 EXEMPT；鍵改成實際函式名（舊版是往上找最近的 const）。
export const LOADER_RPC_EXEMPT = {
  // popup 點開才抓的單站時序（sparkline）—— 掛 LOADING 面板會每次點都閃一下
  "floodSensorLoader.ts:fetchFloodSensorTimeseries": "popup sparkline on-demand",
  "groundwaterLoader.ts:fetchGroundwaterTimeseries": "popup sparkline on-demand",
  "rainGaugeLoader.ts:fetchRainGaugeTimeseries": "popup sparkline on-demand",
  "riverLevelLoader.ts:fetchRiverLevelTimeseries": "popup sparkline on-demand",
  "landSubsidenceLoader.ts:fetchUncached": "popup 趨勢圖 on-demand（地層下陷測站）",
  "wicTaipeiLoader.ts:fetchTaipeiSewerTimeseries": "popup sparkline on-demand",
  "wicTaipeiLoader.ts:fetchTaipeiPumbTimeseries": "popup sparkline on-demand",
  "wicTaipeiLoader.ts:fetchTaipeiEvacuateTimeseries": "popup sparkline on-demand",
  "cwaImageryLoader.ts:fetchCwaImageryBytes": "popup/單幀 on-demand",
  "energyLoader.ts:_fetchProvenance": "popup 溯源 lazy（已有 promise cache）",
  // 原測試沒掃到：`supabase\n.rpc(` 換行寫法，regex 比對不到
  "energyLoader.ts:fetchFacilityUnits": "popup 機組明細 on-demand（energyPanels）",
  // 原測試沒掃到：±10 行內剛好有同一個 Promise.all 裡另一個 RPC 的 withLoading。
  // ⚠️ 暫列，不是已正當化的豁免：withLoading 只涵蓋主要電廠 RPC，has_realtime RPC 較慢時 loading 消失但資料還沒畫；
  // 是否改包整個 Promise.all（會多一列或拉長 loading）待使用者拍板（BACKLOG CI-2）。
  "energyLoader.ts:_l1Cached": "暫列：has_realtime RPC 與主要電廠 RPC 同一個 Promise.all，withLoading 只涵蓋後者，有空窗；修法待拍板",
  "dataCatalogLoader.ts:fetchDataCatalogForLayer": "popup『資料來源』面板 lazy",
  "dataCatalogLoader.ts:fetchDataCatalogByTheme": "popup『資料來源』面板 lazy",
  "airportPaxLoader.ts:fetchAirportHourlyPax": "monitor 面板 widget，非圖層載入",
  // monitor 卡片的摘要／趨勢查詢（背景輪詢）—— 非圖層載入，灌 LOADING 面板會讓牆面定期閃
  "lightningLoader.ts:fetchLightningDayCount": "monitor 落雷卡計數（head count），非圖層載入",
  "lightningLoader.ts:fetchLightningLatest": "monitor 落雷卡最新一筆，非圖層載入",
  "lightningLoader.ts:fetchLightningDailyUncached": "monitor 落雷卡歷史趨勢（30min 背景輪詢），非圖層載入",
  "nuclearLoader.ts:fetchNuclearDailyUncached": "monitor 輻射卡歷史趨勢（30min 背景輪詢），非圖層載入",
  "typhoonTracksLoader.ts:fetchTyphoonProximityUncached": "monitor 颱風卡逐日接近程度（30min 背景輪詢），非圖層載入",
  // 背景 prefetch：刻意不灌 LOADING panel（檔內註解有寫）
  "lightningLoader.ts:fetchLightningDayRaw": "raw 版供背景 prefetch；wrapped 版才包 withLoading",
  "nuclearLoader.ts:fetchNuclearDayRaw": "raw 版供背景 prefetch；wrapped 版才包 withLoading",
  // 內部 helper：由呼叫端包
  "busLoader.ts:fetchBusTrailsForCity": "per-city 內部 fetch，外層 fetchBusTrails 已包",
};

// 獨立 entry（分析卡片 card.html、隱私頁 privacy.html）不可把主站的重模組拉進 bundle。
// 原 src/card/__tests__/cardDeploy.test.ts、src/privacy/__tests__/privacyDeploy.test.ts 的 import 檢查（含動態 import()）。
const entryImportBans = (modules, why) => [
  "error",
  { patterns: modules.map((m) => ({ group: [m, `**/${m}`], message: why })) },
];
const entryDynamicImportBans = (modules, why) => [
  "error",
  // esquery 的 regex 不能含 /，路徑分隔用 . 代替
  ...modules.map((m) => ({ selector: `ImportExpression[source.value=/${m.replace(/[/.]/g, ".")}$/]`, message: why })),
];
const CARD_BANNED = ["lib/supabase", "@supabase/supabase-js", "mapbox-gl"];
const CARD_WHY = "分析卡片 entry 不 import 主站 supabase client 或 mapbox-gl（卡片用 maplibre-gl＋cardApi；見 cardDeploy.test）";
const PRIVACY_BANNED = ["lib/supabase", "@supabase/supabase-js", "mapbox-gl", "state/localeStore"];
const PRIVACY_WHY = "隱私頁 entry 不 import supabase、mapbox-gl 或整包介面字串（localeStore）；用 privacyLocale／privacyContent（見 privacyDeploy.test）";

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
    files: ["src/hooks/useBusCrowdingSimLayer.ts", "src/hooks/useBusCrowdingReplayVehicles.ts"],
    // 只有開發模式的效能紀錄（console.debug／window 統計）看 DEV；私人端點仍是寫死的同源路徑
    rules: { "pulse/owner-only-no-external-source": ["error", { allowImportMeta: ["env.DEV"] }] },
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

  // 非同步載入必註冊 loadingRegistry（CLAUDE.md §3）
  { files: ["src/data/*Loader.ts", "src/data/*Loaders.ts"], rules: { "pulse/loader-rpc-with-loading": ["error", { exempt: LOADER_RPC_EXEMPT }] } },

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

  // 圖層面板控制項只經 ExpandedControls → ParamControlList（§4a 規則 4：select 閾值單一出處）
  {
    files: ["src/components/IconRailSidebar.tsx", "src/components/LayerSidebar.tsx", "src/components/sidebar/LayersPanel.tsx"],
    rules: { "pulse/sidebar-shared-param-controls": "error" },
  },

  // 圖例收斂（legendKit）
  {
    files: ["src/components/LegendPanel.tsx", "src/components/legend/*.tsx"],
    ignores: ["src/components/legend/legendKit.tsx"],
    rules: { "pulse/legend-no-letter-spacing": "error", "pulse/legend-no-hand-sized-swatch": "error" },
  },

  // 獨立 entry 的 bundle 邊界
  {
    files: ["src/card/*.{ts,tsx}"],
    rules: { "no-restricted-imports": entryImportBans(CARD_BANNED, CARD_WHY), "no-restricted-syntax": entryDynamicImportBans(CARD_BANNED, CARD_WHY) },
  },
  {
    files: ["src/privacy/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": entryImportBans(PRIVACY_BANNED, PRIVACY_WHY),
      "no-restricted-syntax": entryDynamicImportBans(PRIVACY_BANNED, PRIVACY_WHY),
    },
  },
  // 主站 entry 用 createRoot：index.html 的靜態說明會被取代，不可改 hydrateRoot（原 seoAssets.test 的原始碼比對）
  {
    files: ["src/main.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "react-dom/client", importNames: ["hydrateRoot"], message: "index.html 的 #root 放的是給爬蟲的靜態說明，會被取代：用 createRoot，不可 hydrateRoot（seoAssets.test）" }] },
      ],
    },
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
