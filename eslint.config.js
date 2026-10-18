// ESLint：只啟用取代「讀原始碼＋regex」守門測試的規則，不開 recommended（docs/development-rules.md「自訂 ESLint 規則」）。
// 既有違規記在 eslint-suppressions.json（只能往下降）：修掉違規後跑 `npm run lint:prune`；不要跑 --suppress-all。
import css from "@eslint/css";
import tsParser from "@typescript-eslint/parser";
import pulse from "./eslint-rules/index.js";

const HOOKS_AND_MAP = ["src/hooks/**/*.{ts,tsx}", "src/map/**/*.{ts,tsx}"];

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

  // day prefetch（AU-3）：日期從 timeStore 取；CWA 不走共享 queue
  { files: ["src/lib/dayPrefetch.ts", "src/hooks/useCwaImageryLayer.ts"], rules: { "pulse/no-current-time-deps": "error" } },
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
