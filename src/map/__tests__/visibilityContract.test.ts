/**
 * map-layers.md §3.8 全國視角可見性契約（ratchet）：既有違規列在基準清單，只准減少、不准增加。
 * - 新違規 → 紅：修圖層（降 minzoom／加熱區、補類別篩選），真的有理由就在基準加一筆並在 PR 說明。
 * - 基準裡的層已經修好 → 也紅：把它從基準刪掉（清單只會變短）。
 * 判斷範圍與方法見 `src/map/visibilityAudit.ts`（registry overlay＋南韓資料層；其他 hook 圖層不涵蓋）。
 */
import { describe, expect, it } from "vitest";
import { categoryFilterViolations, zoomLagViolations } from "../visibilityAudit";

/**
 * V-2 基準（2026-10-31）：layer 最早出現縮放比圖磚 minzoom 晚超過 1 級。
 * 南韓 kr* 由南韓前端軌修正後移除。
 */
const V2_BASELINE: readonly string[] = ["krNpLocationSigns", "krSeoulSubwayCongestion"];

/** V-2 明確豁免（刻意設計，附理由）：違規仍會被偵測到，但不算新增；理由消失（已不違規）也要從這裡刪。 */
const V2_EXEMPT: Readonly<Record<string, string>> = {
  countyBoundary: "行政界依縮放分級呈現（縣市→鄉鎮→村里），全覽縮放只畫縣市界",
  townshipBoundary: "同上：鄉鎮界 z8 起，避免國家全覽疊 368 個鄉鎮",
  villageBoundary: "同上：村里界 z11 起（7,973 村里）",
  contourDtm20: "20 m 等高線 25 萬條，國家全覽 z7 畫出會糊成一片；z9 起",
  factoryDensityGrid: "工商密度網格 z4 起的分級網格（density grid 設計），非逐點資料",
  manufacturingCompanyDensityGrid: "同上",
  regulatedFacilityDensityGrid: "同上",
  farmRoads: "圖磚雖從 z0 起，國家全覽 z7 已畫（z<7 全島線條糊在一起沒有資訊）",
  forestRoads: "同上：z7 起畫",
  hikingTrails: "同上：z7 起畫",
};

/**
 * V-4 基準（2026-10-31）：paint 以字串 match 分 ≥2 類（或南韓 `cats` ≥2）但規格沒有資料篩選控件。
 * 台灣 registry 圖層已全部補類別篩選（`data/categoryFilters/`）或列入下方豁免；hook 圖層不在審計範圍（見 visibilityAudit）。
 */
const V4_BASELINE: readonly string[] = [];

/** V-4 明確豁免：序位等級（嚴重度、距離分帶、水質／警戒等級）不是名目類別；或圖例沒有分類。 */
const V4_EXEMPT: Readonly<Record<string, string>> = {
  accidentTaipei: "case_class 為 A1/A2 事故等級（死亡/受傷），屬嚴重度序位，非名目類別",
  anfrWirelessSites: "分類取自陣列欄位 operators 的第 0 個元素，機制（to-string 比對屬性）無法比對陣列元素；需於資料端展平出單一屬性後才能加",
  beachWaterQuality: "優良/普通/不宜親水為水質等級（序位）",
  civilDefenseShelter: "paint 雖依 subtype 上色，但圖例只有單一列（防空避難所）、並無類別；先不加",
  cwaUvDaily: "紫外線指數 5 級（低到危險），序位等級",
  eduRemoteSchools: "偏遠/特偏/極偏為偏遠程度分級（序位）",
  emergencyHospitals: "重度/中度/一般為急救責任醫院等級（序位）",
  erHospital: "急診壅塞 5 級加無資料，狀態嚴重度",
  evIsland: "距最近充電站距離分帶（0-5km…>30km），連續分級",
  freewayEcoSensitive: "sensi_level 1/2/3 為同色深淺的序位等級",
  gasCoverageAll: "band 為距離分級（0–5…30km+），序位連續分級，非名目類別",
  gasCoverageCpc: "同 gasCoverageAll，距離序位分級",
  gasCoverageFpcc: "同 gasCoverageAll，距離序位分級",
  gasCoverageTaisugar: "同 gasCoverageAll，距離序位分級",
  importantWetlands: "國際級／國家級／地方級／暫定地方級為重要性序位等級（判斷題：若要視為官方指定類別可改加篩選）",
  jmaQuakes: "max_intensity 為震度序位等級",
  jmaVolcanoes: "level 為噴火警戒等級（序位嚴重度）",
  marinePollutionIncidents: "case_level 1–3 為事件規模序位等級",
  noiseEnforcementEvents: "severity_event 為裁處嚴重度（重大/高額/一般）混移動污染，屬嚴重度分級；且 PMTiles 中尚有 event_medium 前置過濾",
  nuclearRadiation: "level normal/watch/warning/alarm/stale 為警戒狀態嚴重度",
  riverRpiSegments: "河川污染指數 RPI 四級（未稍受污染→嚴重污染）為序位嚴重度分級",
  seaWaterQualityStations: "海域水質甲乙丙為序位等級",
  triangulationPoints: "三角點一至三等為序位等級",
  waterEffluentLive: "放流水 exceed/abnormal/normal 為狀態嚴重度",
  waterReservoirs: "水庫 alert 為警戒嚴重度（critical/warning/normal/high）",
};

function ratchet(current: readonly string[], baseline: readonly string[]) {
  const base = new Set(baseline);
  const now = new Set(current);
  return {
    added: current.filter((k) => !base.has(k)),
    fixed: baseline.filter((k) => !now.has(k)),
  };
}

describe("§3.8 全國視角可見性（ratchet）", () => {
  it("V-2 縮放連續：layer minzoom 不得比圖磚 minzoom 晚超過 1 級", () => {
    const v = zoomLagViolations();
    const { added, fixed } = ratchet(v.map((x) => x.key), [...V2_BASELINE, ...Object.keys(V2_EXEMPT)]);
    expect(added.map((k) => {
      const x = v.find((y) => y.key === k)!;
      return `${k}：圖磚 z${x.sourceMinzoom}、圖層 z${x.firstDrawZoom}`;
    }), "新增 V-2 違規").toEqual([]);
    expect(fixed, "已修好，請從 V2_BASELINE／V2_EXEMPT 刪掉").toEqual([]);
  });

  it("V-4 分類圖例＝可篩選：≥2 名目類別要有類別篩選", () => {
    const v = categoryFilterViolations();
    const { added, fixed } = ratchet(v.map((x) => x.key), [...V4_BASELINE, ...Object.keys(V4_EXEMPT)]);
    expect(added, "新增 V-4 違規（補 multiSelect 類別篩選）").toEqual([]);
    expect(fixed, "已修好，請從 V4_BASELINE／V4_EXEMPT 刪掉").toEqual([]);
  });
});
