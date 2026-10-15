/**
 * 掃描程式碼裡「寫死的中文」行數，依 i18n 路線圖的區塊分組（docs/features/i18n/ROADMAP.md）。
 *
 * 計數口徑：.ts/.tsx（排除測試）中，去掉註解後仍含中文的行數。是近似指標，不是精確字串數；
 * 同一套口徑前後比較才有意義。
 *
 * 用法：
 * - 看進度：`npx tsx scripts/i18n/hardcoded-zh.ts`
 * - 某區塊翻完、數字下降後鎖住新基準：`npx tsx scripts/i18n/hardcoded-zh.ts --write`
 * - `hardcodedZh.test.ts`：`gate: "strict"` 的區塊比基準多就紅燈（防倒退）；`report` 只印出差異。
 *
 * 為什麼不是全部 strict：新增圖層本來就要在 manifest 寫中文名、參數 labelPrefix 依 design guard
 * 也必須是中文，未開工的區塊若擋，每個新圖層 PR 都會紅。所以只擋「已翻完」的檔案；
 * 每個階段收工時把翻完的檔案移進 `translated` 區塊。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface I18nArea {
  id: string;
  /** 路線圖階段 */
  phase: string;
  label: string;
  /** 路徑前綴（相對 repo 根目錄，用 /） */
  paths: string[];
  /**
   * `ui`：介面元件，目標是寫死中文歸零（或只剩允許的例外）。
   * `data`：中文是資料標籤或識別字的正本（例 manifest 圖層名），不以歸零為目標，改看翻譯覆蓋率。
   */
  kind: "ui" | "data";
  /** strict：比基準多就紅燈；report：只報告。階段收工時把翻完的檔案搬進 strict 區塊 */
  gate: "strict" | "report";
}

/** 順序即比對優先序：先列的區塊先認領檔案。 */
export const I18N_AREAS: I18nArea[] = [
  {
    id: "translated", phase: "✓", label: "已翻完（嚴格）", kind: "ui", gate: "strict",
    paths: [
      "src/components/toolbar/BasemapMenu.tsx", "src/components/toolbar/LanguageMenu.tsx", "src/components/toolbar/MobileMoreMenu.tsx", "src/components/toolbar/ToolbarButton.tsx",
      "src/components/ModeToggle.tsx", "src/components/AttributionBar.tsx", "src/components/LoadingScreen.tsx", "src/components/LoadingStatus.tsx", "src/components/CameraHud.tsx",
      "src/components/IconRailSidebar.tsx", "src/components/LayerSidebar.tsx",
      "src/components/sidebar/LayerRow.tsx", "src/components/sidebar/LayersPanel.tsx", "src/components/sidebar/LayerToggleSwitch.tsx", "src/components/sidebar/PanelHeader.tsx",
      "src/components/sidebar/ThemeBanner.tsx", "src/components/sidebar/sectionText.ts", "src/components/sidebar/railTheme.ts", "src/components/sidebar/layerIcons.ts",
            "src/components/FeatureInfoPanel.tsx",
      // P1 說明框各主題面板（registry.tsx 是標題中文正本，新圖層會加中文，留在 popup 報告區）。
      // 剩下的中文只有資料值與 enumLabel 的中文正本對照表。新增的面板檔不在清單內，不會被擋。
      "src/components/featureInfo/AllenCoralAtlasPanel.tsx", "src/components/featureInfo/CoralReefPanel.tsx", "src/components/featureInfo/agriPanels.tsx", "src/components/featureInfo/airPanels.tsx",
      "src/components/featureInfo/analysisResultPanels.tsx", "src/components/featureInfo/animalWelfarePanels.tsx", "src/components/featureInfo/baseMapPanels.tsx", "src/components/featureInfo/bridgeResiliencePanels.tsx",
      "src/components/featureInfo/businessRegistryPanels.tsx", "src/components/featureInfo/culturePanels.tsx", "src/components/featureInfo/educationPanels.tsx", "src/components/featureInfo/energyPanels.tsx",
      "src/components/featureInfo/environmentLayerPanels.tsx", "src/components/featureInfo/eventPanels.tsx", "src/components/featureInfo/featureTheme.tsx", "src/components/featureInfo/firePanels.tsx",
      "src/components/featureInfo/fisheryPanels.tsx", "src/components/featureInfo/forestryPanels.tsx", "src/components/featureInfo/funeralPanels.tsx", "src/components/featureInfo/globalClimatePanels.tsx",
      "src/components/featureInfo/h3MetricPanels.tsx", "src/components/featureInfo/harmReductionPanels.tsx", "src/components/featureInfo/hazardPanels.tsx", "src/components/featureInfo/historicalFlightPanels.tsx",
      "src/components/featureInfo/infraPanels.tsx", "src/components/featureInfo/japanPanels.tsx", "src/components/featureInfo/jmaPanels.tsx", "src/components/featureInfo/jpMedicalPanels.tsx",
      "src/components/featureInfo/landslidePanels.tsx", "src/components/featureInfo/livestockPanels.tsx", "src/components/featureInfo/marinePanels.tsx", "src/components/featureInfo/medicalPanels.tsx",
      "src/components/featureInfo/networkStructuresPanels.tsx", "src/components/featureInfo/noisePanels.tsx", "src/components/featureInfo/parkingPanels.tsx", "src/components/featureInfo/policeJusticePanels.tsx",
      "src/components/featureInfo/pollutionPanels.tsx", "src/components/featureInfo/publicLifePanels.tsx", "src/components/featureInfo/regionalStatisticsPanel.tsx", "src/components/featureInfo/religionPanels.tsx",
      "src/components/featureInfo/roadPanels.tsx", "src/components/featureInfo/satellitePanels.tsx", "src/components/featureInfo/shared.tsx", "src/components/featureInfo/soilLiquefactionPanels.tsx",
      "src/components/featureInfo/sportsPanels.tsx", "src/components/featureInfo/taipeiWicPanels.tsx", "src/components/featureInfo/tourismPanels.tsx", "src/components/featureInfo/transportPanels.tsx",
      "src/components/featureInfo/urbanPanels.tsx", "src/components/featureInfo/wastePanels.tsx", "src/components/featureInfo/waterPanels.tsx", "src/components/featureInfo/welfarePanels.tsx",
      // P3 監測模式、衛星主控台、時間軸、會員（後台 admin 不翻）。剩下的是中文正本對照表、資料值比對與註解。
      "src/components/EarthquakeReplayPanel.tsx", "src/components/HistoricalTimeline.tsx", "src/components/TimelineControls.tsx", "src/components/auth/UserAvatar.tsx",
      "src/components/intel/GlobalSituationFeed.tsx", "src/components/intel/IntelCard.tsx", "src/components/intel/IntelFilters.tsx", "src/components/intel/IntelHeader.tsx",
      "src/components/intel/IntelIcon.tsx", "src/components/intel/IntelPanel.tsx", "src/components/intel/IntelReplay.tsx", "src/components/intel/IntelSituation.tsx",
      "src/components/intel/alerts/AlertBoard.tsx", "src/components/intel/alerts/AlertCard.tsx", "src/components/intel/alerts/AlertSummaryBar.tsx", "src/components/intel/alerts/AlertsTrack.tsx",
      "src/components/intel/alerts/FeedTabs.tsx", "src/components/intel/intelTheme.tsx", "src/components/intel/intelTokens.ts", "src/components/intel/monitor/AirportPaxCard.tsx",
      "src/components/intel/monitor/ERCard.tsx", "src/components/intel/monitor/FoodPriceBoard.tsx", "src/components/intel/monitor/HazardCards.tsx", "src/components/intel/monitor/HazardTrendBars.tsx",
      "src/components/intel/monitor/HazardWatchStrip.tsx", "src/components/intel/monitor/HotspotsWidget.tsx", "src/components/intel/monitor/HourlyHistogramWidget.tsx", "src/components/intel/monitor/IsrSatellitePassCard.tsx",
      "src/components/intel/monitor/LiveWall.tsx", "src/components/intel/monitor/MonitorCardFrame.tsx", "src/components/intel/monitor/MonitorDataStatus.tsx", "src/components/intel/monitor/MonitorMetric.tsx",
      "src/components/intel/monitor/MonitorPanel.tsx", "src/components/intel/monitor/NewsFeedPanel.tsx", "src/components/intel/monitor/PlaBoard.tsx", "src/components/intel/monitor/PowerCard.tsx",
      "src/components/intel/monitor/PressureRing.tsx", "src/components/intel/monitor/PrisonCard.tsx", "src/components/intel/monitor/SituationCards.tsx", "src/components/intel/monitor/SituationOverview.tsx",
      "src/components/intel/monitor/TelecomStatusCard.tsx", "src/components/intel/monitor/TimelineDock.tsx", "src/components/intel/monitor/TraDelayBoard.tsx", "src/components/intel/monitor/TriageWidget.tsx",
      "src/components/intel/monitor/VesselZoneCard.tsx", "src/components/intel/monitor/erCardData.ts", "src/components/intel/monitor/monitorCardMeta.ts", "src/components/intel/monitor/monitorChart.ts",
      "src/components/intel/monitor/monitorFont.ts", "src/components/intel/monitor/monitorFreshness.ts", "src/components/intel/monitor/monitorLayout.ts", "src/components/intel/monitor/monitorPacking.ts",
      "src/components/intel/monitor/monitorSplitLayout.ts", "src/components/intel/monitor/monitorStyle.ts", "src/components/intel/monitor/monitorTheme.ts", "src/components/intel/monitor/newsFreshness.ts",
      "src/components/intel/monitor/powerCardData.ts", "src/components/member/MemberPanel.tsx", "src/components/member/MyAnalysisCards.tsx", "src/components/satelliteConsole/CNGroupSection.tsx",
      "src/components/satelliteConsole/CoverageStatsSection.tsx", "src/components/satelliteConsole/ManeuverAlertSection.tsx", "src/components/satelliteConsole/ManeuverCompareModal.tsx", "src/components/satelliteConsole/SatelliteConsole.tsx",
      "src/components/satelliteConsole/SatelliteConsoleHeader.tsx", "src/components/satelliteConsole/SatelliteDetailCard.tsx", "src/components/satelliteConsole/TWFleetSection.tsx", "src/components/satelliteConsole/maneuverAlertKit.ts",
      "src/components/satelliteConsole/satelliteConsoleTokens.ts", "src/components/satelliteConsole/satelliteTheme.ts", "src/components/timeline/TimeAxis.tsx", "src/components/timeline/TimelineShell.tsx",
      "src/components/timeline/timelineAxis.ts", "src/components/timeline/timelineExpand.ts",
      // P2b 統計圖層與資料來源總覽、develop 新增的 atlas 說明框與圖例（剩下的是配方正本、標題正本與上游句型比對）
      "src/components/sidebar/StatisticsDetails.tsx", "src/components/sidebar/DataSourcePanel.tsx", "src/state/statisticsLinkedSelect.ts", "src/state/linkedSelect.ts",
      "src/components/featureInfo/atlasPanels.tsx", "src/components/legend/atlasLegends.tsx",
      // P2 圖例與設定面板（layerParamsSpec.ts 是控件標籤中文正本，留在報告區）。剩下的中文是註解、英文小字旁的中文正本與 enumLabel 對照表。
      "src/components/LegendPanel.tsx", "src/components/legend/agriIndustryLegends.tsx", "src/components/legend/civicServiceLegends.tsx", "src/components/legend/cultureLegends.tsx",
      "src/components/legend/energyTelecomLegends.tsx", "src/components/legend/environmentLegends.tsx", "src/components/legend/environmentWeatherLegends.tsx", "src/components/legend/harmReductionLegends.tsx",
      "src/components/legend/hazardLegends.tsx", "src/components/legend/jmaLegends.tsx", "src/components/legend/landslideLegends.tsx", "src/components/legend/legendKit.tsx",
      "src/components/legend/legendShared.tsx", "src/components/legend/maritimeLegends.tsx", "src/components/legend/railRoutesLegend.tsx", "src/components/legend/transportLegends.tsx",
      "src/components/legend/urbanFormLegends.tsx", "src/components/legend/waterLegends.tsx", "src/state/layerParamsControls.ts", "src/components/sidebar/ExpandedControls.tsx",
      "src/components/sidebar/LayerParamControls.tsx", "src/components/sidebar/PaletteControl.tsx", "src/components/sidebar/StatisticsModeControl.tsx", "src/components/sidebar/MedicalStatisticsGroupControls.tsx",
      "src/components/sidebar/PropertyValueStatisticsDetails.tsx", "src/components/sidebar/HistoricalFlightTrailControls.tsx", "src/components/sidebar/LayerInfoLine.tsx",
    ],
  },
  { id: "shell", phase: "P0", label: "工具列、外框", kind: "ui", gate: "report", paths: ["src/App.tsx", "src/main.tsx", "src/components/toolbar/", "src/components/ModeToggle.tsx", "src/components/AttributionBar.tsx", "src/components/LoadingScreen.tsx", "src/components/LoadingStatus.tsx", "src/components/CameraHud.tsx", "src/components/InfoModal.tsx", "src/components/ShareModal.tsx", "src/components/MobileBottomSheet.tsx", "src/components/StyleSelector.tsx"] },
  { id: "sidebar", phase: "P0", label: "側欄", kind: "ui", gate: "report", paths: ["src/components/sidebar/", "src/components/IconRailSidebar.tsx", "src/components/LayerSidebar.tsx"] },
  { id: "popup", phase: "P1", label: "點擊說明框", kind: "ui", gate: "report", paths: ["src/components/featureInfo/", "src/components/FeatureInfoPanel.tsx"] },
  { id: "legend", phase: "P2", label: "圖例", kind: "ui", gate: "report", paths: ["src/components/LegendPanel.tsx", "src/components/legend/"] },
  { id: "params", phase: "P2", label: "圖層設定面板", kind: "ui", gate: "report", paths: ["src/data/layerParamsSpec.ts", "src/state/layerParamsControls.ts", "src/components/controls/"] },
  { id: "timeline", phase: "P3", label: "時間軸", kind: "ui", gate: "report", paths: ["src/components/timeline/", "src/components/TimelineControls.tsx", "src/components/HistoricalTimeline.tsx", "src/components/EarthquakeReplayPanel.tsx"] },
  { id: "intel", phase: "P3", label: "監測模式", kind: "ui", gate: "report", paths: ["src/components/intel/"] },
  { id: "satellite", phase: "P3", label: "衛星主控台", kind: "ui", gate: "report", paths: ["src/components/satelliteConsole/"] },
  { id: "member", phase: "P3", label: "會員、登入、後台", kind: "ui", gate: "report", paths: ["src/components/member/", "src/components/auth/", "src/components/admin/"] },
  { id: "chat", phase: "P4", label: "AI 對話", kind: "ui", gate: "report", paths: ["src/chat/", "src/components/chat/"] },
  { id: "research", phase: "P4", label: "分析 Agent、資料描述", kind: "data", gate: "report", paths: ["src/research/"] },
  { id: "data", phase: "P2/P5", label: "資料標籤（類別、單位、統計配方）", kind: "data", gate: "report", paths: ["src/data/"] },
  { id: "map", phase: "P2", label: "地圖 hook／圖層文字", kind: "ui", gate: "report", paths: ["src/hooks/", "src/map/", "src/three/"] },
  { id: "other", phase: "—", label: "其他", kind: "ui", gate: "report", paths: ["src/"] },
];

const HAN = /[㐀-鿿]/;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
}

export function countZhLines(source: string): number {
  return stripComments(source).split("\n").filter((line) => HAN.test(line)).length;
}

/** repoRoot 底下 src/ 的掃描結果：區塊 id → 行數 */
export function scanHardcodedZh(repoRoot: string): Record<string, number> {
  const files: string[] = [];
  walk(join(repoRoot, "src"), files);
  const result: Record<string, number> = Object.fromEntries(I18N_AREAS.map((a) => [a.id, 0]));
  for (const file of files) {
    const rel = relative(repoRoot, file).split(sep).join("/");
    if (rel.startsWith("src/i18n/")) continue;
    const area = I18N_AREAS.find((a) => a.paths.some((p) => (p.endsWith("/") ? rel.startsWith(p) : rel === p)));
    if (!area) continue;
    result[area.id] = (result[area.id] ?? 0) + countZhLines(readFileSync(file, "utf8"));
  }
  return result;
}
