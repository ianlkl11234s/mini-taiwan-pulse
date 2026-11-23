/**
 * 「加一國漏接」守門（多國重構安全網，2026-11-23）。
 *
 * 加一個國家要改很多接點，其中有一類漏了 tsc 不會報錯、上線後才發現少一塊（對照泰國上線 PR #1163）。
 * 這裡把那些接點寫成「吃國碼、回缺漏清單」的純函式 `checkCountryWiring`：
 * - 對 `COUNTRIES` 的每個國碼跑一次，缺漏必須是 0（刻意沒有的寫在 `EXEMPTIONS`，每筆附原因）；
 * - 再用假國碼 `ZZ`（外加一筆假圖層、一個假統計層級）跑同一套函式，斷言 1–8 每一條都抓得到，
 *   證明檢查本身不是空殼。
 *
 * 只讀不改：沒匯出的接點（統計層級清單、`LEVEL_KEYS`、`atlasLevelQualifier`、統計國名 if 串、
 * build-layer-status 的國別表）用原始碼字串比對，見各 `read*` 函式。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COUNTRIES } from "../../constants/countries";
import type { CountryCode } from "../../constants/countries";
import { LAYER_MANIFEST } from "../layerManifest";
import { LEVEL_LABELS } from "../statisticsLabels";
import { statisticsSourceLevelLabel } from "../statisticsDataSources";
import { SMALL_MULTIPLES_LEVELS } from "../statisticsSmallMultiples";
import { buildDefaultVisibility } from "../../state/layerVisibilityStore";
import {
  STATISTICS_TAB_CHOROPLETH_LAYER_KEYS,
  STATISTICS_TAB_THEMES,
  THEME_NAME_KEYS,
  TW_STATISTICS_CATALOG_THEMES,
  THEME_SCOPE,
  themeKey,
  themeMacroGroup,
  type ThemeDef,
  type ThemeScope,
} from "../../components/sidebar/layerCatalog";
import {
  STATISTICS_ALL_OFF_KEYS,
  countryLayerThemes,
  layerPanelDef,
  resolveLayerPanel,
  type PanelMacroGroup,
} from "../../components/sidebar/layerPanels";

// ── 型別 ──

/** 接點編號＝任務說明的 1–8（9 timeZone 見檔尾 it.todo）。 */
type WiringItem = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface WiringGap {
  item: WiringItem;
  /** 「國碼 X 缺少 Y（檔案:常數名）」 */
  message: string;
}

interface PanelView {
  covered: boolean;
  themes: readonly ThemeDef[];
  macroGroups: readonly PanelMacroGroup[];
}

/** 一筆有國家主體的 manifest 圖層（只取守門需要的欄位）。 */
interface ManifestLayer {
  key: string;
  country: string;
  theme: string;
}

/** 檢查函式吃的全部輸入；正式跑用 `realContext()`，假國碼測試在其上加料。 */
interface WiringContext {
  manifestLayers: readonly ManifestLayer[];
  /** 圖層入口主題樹；國碼沒登記時回 undefined（`COUNTRY_LAYER_THEMES`）。 */
  layerPanel(code: string): PanelView | undefined;
  /** 統計入口解析結果（`COUNTRY_STATISTICS_THEMES`＋入口 `countries`）。 */
  statisticsPanel(code: string): PanelView;
  statisticsCountries: readonly string[];
  statisticsAllOffKeys: ReadonlySet<string>;
  choroplethKeys: ReadonlySet<string>;
  /** 統計入口的地圖參考圖層（不是統計面，不需進 choropleth 集合）。 */
  statisticsReferenceKeys: ReadonlySet<string>;
  /** 國碼 → 刻意只在完整目錄（THEMES）、不進任何入口的圖層 key（原因見 `CATALOG_ONLY`）。 */
  catalogOnlyKeys: Readonly<Partial<Record<string, ReadonlySet<string>>>>;
  themeScope: Readonly<Record<string, readonly string[] | undefined>>;
  themeNameKeys: ReadonlySet<string>;
  hasThemeMacroGroup(country: string, title: string): boolean;
  defaultVisibilityKeys: ReadonlySet<string>;
  /** locale → common.json */
  commonMessages: Readonly<Record<string, Readonly<Record<string, string>>>>;
  statisticsLevels: readonly string[];
  /** 第 6 點的五處層級登記：名稱（檔案:常數）→ 是否有登記 */
  levelRegistries: readonly { name: string; has(level: string): boolean }[];
  /** layerManifest.ts atlas 統計 topics 的國名分支裡出現的國碼 */
  manifestStatisticsCountryTags: ReadonlySet<string>;
  layerStatusPanelLabels: ReadonlySet<string>;
  layerStatusCountryOrder: ReadonlySet<string>;
}

// ── 豁免表（每筆都要原因；不在表內＝必須接齊）──

/** 沒有統計入口的國家：第 2、3（統計部分）、6、7 點不檢查，且反過來不可出現在任何統計清單。 */
const NO_STATISTICS: Readonly<Partial<Record<string, string>>> = {
  JP: "日本統計尚未上線（統計入口只涵蓋 TW、GB、KR、CA、IE）",
  FR: "法國目前只有 ANFR 通訊圖層，沒有統計",
  PH: "菲律賓第 0–1 波明定統計不涵蓋（layerPanels.ts PHILIPPINES_THEMES 註解）",
  VN: "越南第 0–1 波明定統計不涵蓋（layerPanels.ts VIETNAM_THEMES 註解）",
  TH: "泰國第 0 波明定統計不涵蓋（layerPanels.ts THAILAND_THEMES 註解）",
  CN: "中國第 0–1 波站主限定，統計不涵蓋（layerPanels.ts CHINA_THEMES 註解）",
};

/** 第 7 點：台灣是 atlas topics 的預設（不加國名標籤），其餘有統計的國家都要有分支。 */
const NO_STATISTICS_COUNTRY_TAG: Readonly<Partial<Record<string, string>>> = {
  TW: "台灣統計是預設國家，layerManifest.ts atlas topics 不加國名（if 串的最後 else）",
};

/** 第 6 點：某層級刻意不在某一處登記。key＝`${level}@${登記處名稱}`。 */
const LEVEL_EXEMPTIONS: Readonly<Record<string, string>> = {
  "village@statisticsSmallMultiples.ts:SMALL_MULTIPLES_LEVELS": "村里 7,700+ 區、參考邊界 80MB，小圖畫不出（該檔註解）",
  "statistical_min@statisticsSmallMultiples.ts:SMALL_MULTIPLES_LEVELS": "統計區沒有可用參考邊界（該檔註解）",
  "statistical_l1@statisticsSmallMultiples.ts:SMALL_MULTIPLES_LEVELS": "統計區沒有可用參考邊界（該檔註解）",
  "statistical_l2@statisticsSmallMultiples.ts:SMALL_MULTIPLES_LEVELS": "統計區沒有可用參考邊界（該檔註解）",
  "county@layerManifest.ts:atlasLevelQualifier": "縣市是 atlasLevelQualifier 的預設回傳（if 串最後的 else），不寫比對分支",
  "statistical_min@layerManifest.ts:atlasLevelQualifier": "統計區層級只用於人口統計 recipe，不走 atlas manifest 派生",
  "statistical_l1@layerManifest.ts:atlasLevelQualifier": "統計區層級只用於人口統計 recipe，不走 atlas manifest 派生",
  "statistical_l2@layerManifest.ts:atlasLevelQualifier": "統計區層級只用於人口統計 recipe，不走 atlas manifest 派生",
  "prosecutor_district@layerManifest.ts:atlasLevelQualifier": "地檢署轄區只用於成癮統計（ADDICTION_LEVEL_QUALIFIERS），不走 atlas manifest 派生",
};

/** 第 1 點：刻意不在任何入口、只在完整目錄的圖層（規則式豁免，key 集合由下列來源派生）。 */
const CATALOG_ONLY: Readonly<Partial<Record<string, string>>> = {
  TW: "台灣統計完整目錄比統計入口多列教育 view 背後的指標（layerCatalog.ts TW_STATISTICS_CATALOG_THEMES 註解；= TW_STATISTICS_CATALOG_THEMES − STATISTICS_TAB_THEMES，2026-11-23 共 21 個）",
};

// ── 原始碼讀取（沒匯出的接點）──

const read = (path: string) => readFileSync(path, "utf8");

/** regionalStatisticsLoader.ts 的 `StatisticsLevel` 型別聯集（只有型別，執行期沒有清單）。 */
function readStatisticsLevels(source: string): string[] {
  const match = /export type StatisticsLevel\s*=\s*([^;]+);/.exec(source);
  if (!match) throw new Error("regionalStatisticsLoader.ts 找不到 StatisticsLevel 型別");
  return [...match[1]!.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!);
}

/** StatisticsDetails.tsx 的 `LEVEL_KEYS` 物件（未匯出）裡登記的層級。 */
function readLevelKeys(source: string): Set<string> {
  const block = /const LEVEL_KEYS[^=]*=\s*\{([\s\S]*?)\};/.exec(source);
  if (!block) throw new Error("StatisticsDetails.tsx 找不到 LEVEL_KEYS");
  return new Set([...block[1]!.matchAll(/([a-z0-9_]+)\s*:\s*'statistics\.level\.\1'/g)].map((m) => m[1]!));
}

/** layerManifest.ts `atlasLevelQualifier`（未匯出）有比對分支的層級。 */
function readAtlasQualifierLevels(source: string): Set<string> {
  const body = /function atlasLevelQualifier\([^)]*\)[^{]*\{([\s\S]*?)\n\}/.exec(source);
  if (!body) throw new Error("layerManifest.ts 找不到 atlasLevelQualifier");
  return new Set([...body[1]!.matchAll(/level === "([a-z0-9_]+)"/g)].map((m) => m[1]!));
}

/** layerManifest.ts atlas 統計 topics 的國名 if 串：`atlasRecipeCountry(recipe) === "GB" ? ["英國"]`。 */
function readManifestStatisticsCountryTags(source: string): Set<string> {
  return new Set([...source.matchAll(/atlasRecipeCountry\(recipe\) === "([A-Z]{2})" \? \["[^"]+"\]/g)].map((m) => m[1]!));
}

/** build-layer-status.mjs 的 `COUNTRY_PANEL_LABEL` 鍵與 `COUNTRY_ORDER` 陣列。 */
function readLayerStatusTables(source: string): { panelLabels: Set<string>; order: Set<string> } {
  const labels = /const COUNTRY_PANEL_LABEL\s*=\s*\{([^}]*)\}/.exec(source);
  const order = /const COUNTRY_ORDER\s*=\s*\[([^\]]*)\]/.exec(source);
  if (!labels || !order) throw new Error("build-layer-status.mjs 找不到 COUNTRY_PANEL_LABEL／COUNTRY_ORDER");
  return {
    panelLabels: new Set([...labels[1]!.matchAll(/\b([A-Z]{2})\s*:/g)].map((m) => m[1]!)),
    order: new Set([...order[1]!.matchAll(/"([A-Z]+)"/g)].map((m) => m[1]!)),
  };
}

// ── 真實輸入 ──

function realContext(): WiringContext {
  const manifestSource = read("src/data/layerManifest.ts");
  const levelKeys = readLevelKeys(read("src/components/sidebar/StatisticsDetails.tsx"));
  const atlasLevels = readAtlasQualifierLevels(manifestSource);
  const layerStatus = readLayerStatusTables(read("scripts/research/build-layer-status.mjs"));
  const manifestLayers: ManifestLayer[] = [];
  for (const entry of Object.values(LAYER_MANIFEST)) {
    if (entry.section === null) continue;
    manifestLayers.push({ key: entry.key, country: entry.country, theme: entry.section.theme });
  }
  return {
    manifestLayers,
    layerPanel(code) {
      try {
        const themes = countryLayerThemes(code as CountryCode);
        if (!themes) return undefined;
        const panel = resolveLayerPanel("layers", code as CountryCode);
        return { covered: panel.covered, themes: panel.themes, macroGroups: panel.macroGroups ?? [] };
      } catch {
        return undefined; // COUNTRY_LAYER_THEMES[code] 不存在
      }
    },
    statisticsPanel(code) {
      const panel = resolveLayerPanel("statistics", code as CountryCode);
      return { covered: panel.covered, themes: panel.themes, macroGroups: panel.macroGroups ?? [] };
    },
    statisticsCountries: layerPanelDef("statistics").countries ?? [],
    statisticsAllOffKeys: new Set<string>(STATISTICS_ALL_OFF_KEYS),
    choroplethKeys: STATISTICS_TAB_CHOROPLETH_LAYER_KEYS,
    statisticsReferenceKeys: new Set(["countyBoundary", "townshipBoundary"]),
    catalogOnlyKeys: {
      TW: (() => {
        const tab = new Set(themeKeysOf(STATISTICS_TAB_THEMES));
        return new Set(themeKeysOf(TW_STATISTICS_CATALOG_THEMES).filter((key) => !tab.has(key)));
      })(),
    },
    themeScope: THEME_SCOPE,
    themeNameKeys: THEME_NAME_KEYS,
    hasThemeMacroGroup(country, title) {
      try {
        themeMacroGroup({ country: country as ThemeScope, title });
        return true;
      } catch {
        return false;
      }
    },
    defaultVisibilityKeys: new Set(Object.keys(buildDefaultVisibility())),
    commonMessages: Object.fromEntries(
      ["zh-TW", "en", "ja"].map((locale) => [locale, JSON.parse(read(`src/i18n/locales/${locale}/common.json`)) as Record<string, string>]),
    ),
    statisticsLevels: readStatisticsLevels(read("src/data/regionalStatisticsLoader.ts")),
    levelRegistries: [
      { name: "layerManifest.ts:atlasLevelQualifier", has: (level) => atlasLevels.has(level) },
      { name: "statisticsLabels.ts:LEVEL_LABELS", has: (level) => level in LEVEL_LABELS },
      { name: "statisticsDataSources.ts:statisticsSourceLevelLabel", has: (level) => statisticsSourceLevelLabel(level) !== level },
      { name: "StatisticsDetails.tsx:LEVEL_KEYS", has: (level) => levelKeys.has(level) },
      { name: "statisticsSmallMultiples.ts:SMALL_MULTIPLES_LEVELS", has: (level) => (SMALL_MULTIPLES_LEVELS as ReadonlySet<string>).has(level) },
    ],
    manifestStatisticsCountryTags: readManifestStatisticsCountryTags(manifestSource),
    layerStatusPanelLabels: layerStatus.panelLabels,
    layerStatusCountryOrder: layerStatus.order,
  };
}

// ── 檢查函式（純函式：國碼＋輸入 → 缺漏清單，一次列全部）──

/** 台灣層級沒有前綴；其他國家用 `<國碼小寫>_` 前綴（gb_lad、kr_sido…）。 */
function countryLevels(code: string, levels: readonly string[]): string[] {
  if (code === "TW") return levels.filter((level) => !/^[a-z]{2}_/.test(level) || level.startsWith("statistical_"));
  return levels.filter((level) => level.startsWith(`${code.toLowerCase()}_`));
}

const themeKeysOf = (themes: readonly ThemeDef[]) => themes.flatMap((theme) => theme.groups.flatMap((group) => group.layers.map((layer) => layer.key as string)));

function checkCountryWiring(code: string, ctx: WiringContext): WiringGap[] {
  const gaps: WiringGap[] = [];
  const gap = (item: WiringItem, message: string) => gaps.push({ item, message: `國碼 ${code} ${message}` });
  const layers = ctx.manifestLayers.filter((layer) => layer.country === code);
  const hasStatistics = !(code in NO_STATISTICS);
  const statsPanel = ctx.statisticsPanel(code);
  const statsKeys = hasStatistics ? new Set(themeKeysOf(statsPanel.themes)) : new Set<string>();

  // 1. 圖層入口
  const layerPanel = ctx.layerPanel(code);
  if (!layerPanel) {
    gap(1, "缺少圖層入口主題樹（layerPanels.ts:COUNTRY_LAYER_THEMES）");
  } else {
    const panelKeys = new Set(themeKeysOf(layerPanel.themes));
    const grouped = new Set(layerPanel.macroGroups.flatMap((group) => group.themes));
    for (const theme of layerPanel.themes) {
      if (!grouped.has(theme.title)) gap(1, `缺少主題「${theme.title}」的大分類（layerPanels.ts:${code} 的 *_MACRO_GROUPS）`);
    }
    for (const layer of layers) {
      const catalogOnly = code in CATALOG_ONLY && ctx.catalogOnlyKeys[code]?.has(layer.key);
      if (!panelKeys.has(layer.key) && !statsKeys.has(layer.key) && !catalogOnly) {
        gap(1, `缺少圖層 ${layer.key}（主題「${layer.theme}」）在圖層入口或統計入口（layerPanels.ts:${code} 的 *_THEMES）`);
      }
    }
  }

  // 2. 統計三處一致
  const inCountries = ctx.statisticsCountries.includes(code);
  const ownStatsThemes = statsPanel.themes.filter((theme) => theme.country === code);
  if (hasStatistics) {
    if (!inCountries) gap(2, "缺少統計涵蓋國家登記（layerPanels.ts:LAYER_PANELS statistics.countries）");
    if (ownStatsThemes.length === 0 || ownStatsThemes.length !== statsPanel.themes.length) {
      gap(2, "缺少統計入口主題樹（layerPanels.ts:COUNTRY_STATISTICS_THEMES）");
    }
    const groupedStats = new Set(statsPanel.macroGroups.flatMap((group) => group.themes));
    for (const theme of ownStatsThemes) {
      if (!groupedStats.has(theme.title)) gap(2, `缺少統計主題「${theme.title}」的大分類（layerPanels.ts:${code}_STATISTICS_MACRO_GROUPS）`);
    }
    for (const key of themeKeysOf(ownStatsThemes)) {
      if (!ctx.statisticsAllOffKeys.has(key)) gap(2, `缺少統計圖層 ${key} 的「全部關閉」串接（layerPanels.ts:STATISTICS_ALL_OFF_KEYS）`);
    }
  } else if (inCountries || ownStatsThemes.length > 0) {
    gap(2, `列在豁免表 NO_STATISTICS 卻出現在統計清單（layerPanels.ts:LAYER_PANELS statistics.countries／COUNTRY_STATISTICS_THEMES）；請刪除豁免`);
  }

  // 3. layerCatalog 主題登記
  const scope = ctx.themeScope[code];
  if (!scope) gap(3, "缺少主題登記（layerCatalog.ts:THEME_SCOPE）");
  for (const title of new Set(layers.map((layer) => layer.theme))) {
    if (scope && !scope.includes(title)) gap(3, `缺少主題「${title}」（layerCatalog.ts:THEME_SCOPE）`);
    if (!ctx.hasThemeMacroGroup(code, title)) gap(3, `缺少主題「${title}」的大分類（layerCatalog.ts:THEME_MACRO_GROUPS）`);
    if (!ctx.themeNameKeys.has(themeKey({ country: code as ThemeScope, title }))) gap(3, `缺少主題「${title}」的顯示名稱（layerCatalog.ts:THEME_NAMES）`);
  }
  if (hasStatistics) {
    for (const key of themeKeysOf(ownStatsThemes)) {
      if (!ctx.statisticsReferenceKeys.has(key) && !ctx.choroplethKeys.has(key)) {
        gap(3, `缺少統計圖層 ${key} 的統計面登記（layerCatalog.ts:${code}_STATISTICS_TAB_THEMES → STATISTICS_TAB_CHOROPLETH_LAYER_KEYS）`);
      }
    }
  }

  // 4. 執行期可見狀態初始表
  for (const layer of layers) {
    if (!ctx.defaultVisibilityKeys.has(layer.key)) gap(4, `缺少圖層 ${layer.key} 的可見狀態初始值（types/index.ts:LayerVisibility → layerVisibilityStore.ts:buildDefaultVisibility）`);
  }

  // 5. 國名翻譯
  for (const [locale, messages] of Object.entries(ctx.commonMessages)) {
    if (!messages[`country.${code}`]) gap(5, `缺少國名翻譯 country.${code}（i18n/locales/${locale}/common.json）`);
  }

  // 6. 行政區層級
  if (hasStatistics) {
    const levels = countryLevels(code, ctx.statisticsLevels);
    if (levels.length === 0) gap(6, `缺少統計層級（regionalStatisticsLoader.ts:StatisticsLevel 沒有 ${code.toLowerCase()}_ 前綴的層級）`);
    for (const level of levels) {
      for (const registry of ctx.levelRegistries) {
        if (!registry.has(level) && !LEVEL_EXEMPTIONS[`${level}@${registry.name}`]) gap(6, `缺少層級 ${level}（${registry.name}）`);
      }
    }
  }

  // 7. 統計國名對照
  if (hasStatistics && !(code in NO_STATISTICS_COUNTRY_TAG) && !ctx.manifestStatisticsCountryTags.has(code)) {
    gap(7, "缺少統計 topics 國名分支（layerManifest.ts:ATLAS_STATISTICS_MANIFEST_ENTRIES 的 atlasRecipeCountry if 串）");
  }

  // 8. 圖層盤點腳本
  if (!ctx.layerStatusPanelLabels.has(code)) gap(8, "缺少面板標籤（scripts/research/build-layer-status.mjs:COUNTRY_PANEL_LABEL）");
  if (!ctx.layerStatusCountryOrder.has(code)) gap(8, "缺少國別順序（scripts/research/build-layer-status.mjs:COUNTRY_ORDER）");

  return gaps;
}

// ── 測試 ──

describe("countryWiring：加一國的接點", () => {
  const ctx = realContext();

  it("原始碼比對讀得到東西（避免 regex 失效後靜默通過）", () => {
    expect(ctx.statisticsLevels.length).toBeGreaterThan(5);
    expect(ctx.levelRegistries.every((registry) => ctx.statisticsLevels.some((level) => registry.has(level)))).toBe(true);
    expect(ctx.manifestStatisticsCountryTags.size).toBeGreaterThan(0);
    expect(ctx.layerStatusPanelLabels.has("TW")).toBe(true);
    expect(ctx.layerStatusCountryOrder.has("TW")).toBe(true);
  });

  it("豁免表只列真的國碼", () => {
    const codes = new Set<string>(COUNTRIES.map((country) => country.code));
    expect(Object.keys(NO_STATISTICS).filter((code) => !codes.has(code))).toEqual([]);
    expect(Object.keys(NO_STATISTICS_COUNTRY_TAG).filter((code) => !codes.has(code))).toEqual([]);
    expect(Object.keys(CATALOG_ONLY).filter((code) => !codes.has(code))).toEqual([]);
    // 規則式豁免不能變成空殼：每個列出的國家都真的有 catalog-only 圖層
    expect(Object.keys(CATALOG_ONLY).filter((code) => !ctx.catalogOnlyKeys[code]?.size)).toEqual([]);
  });

  it("現有每個國碼 0 缺漏", () => {
    const gaps = COUNTRIES.flatMap((country) => checkCountryWiring(country.code, ctx));
    expect(gaps.map((g) => `[${g.item}] ${g.message}`)).toEqual([]);
  });

  it("假國碼 ZZ：1–8 每一條都抓得到", () => {
    const fake: WiringContext = {
      ...ctx,
      manifestLayers: [...ctx.manifestLayers, { key: "zzFakeLayer", country: "ZZ", theme: "假主題" }],
      statisticsLevels: [...ctx.statisticsLevels, "zz_region"],
    };
    const gaps = checkCountryWiring("ZZ", fake);
    expect([...new Set(gaps.map((g) => g.item))].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // 訊息格式：一次列全部、每筆指名檔案與常數
    expect(gaps.every((g) => g.message.startsWith("國碼 ZZ 缺少") && /（.+）/.test(g.message))).toBe(true);
    expect(gaps.filter((g) => g.item === 6).length).toBe(ctx.levelRegistries.length);
  });

  it("9. 每國都有合法的 timeZone（timeZones 若有，須包含 timeZone）", () => {
    const valid = (tz: string) => {
      try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
    };
    const gaps = COUNTRIES.flatMap((country) => {
      const out: string[] = [];
      if (!country.timeZone || !valid(country.timeZone)) out.push(`國碼 ${country.code} 缺少合法的 timeZone（src/constants/countries.ts:COUNTRIES）`);
      for (const tz of country.timeZones ?? []) if (!valid(tz)) out.push(`國碼 ${country.code} 的 timeZones 含不合法的 ${tz}（src/constants/countries.ts:COUNTRIES）`);
      if (country.timeZones && !country.timeZones.includes(country.timeZone)) out.push(`國碼 ${country.code} 的 timeZones 沒有包含 timeZone（src/constants/countries.ts:COUNTRIES）`);
      return out;
    });
    expect(gaps).toEqual([]);
  });
});
