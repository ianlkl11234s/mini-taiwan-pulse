/**
 * 2026-11-24 正式站看圖驗收（印尼 popup）：類別不帶圖例的筆數與來源、面積不顯示「0 km²」、
 * 不露出英文 STALE、外圍小島去代碼前綴、每筆都一樣的備註搬到圖層「說明・來源」。
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ID_DATA_SPECS } from "../idDataLayers";
import { plain } from "../idWavesLayers";
import { pickL3, type L3 } from "../intlLayerShared";
import { LAYER_SOURCE_INFO } from "../layerSourceInfo";
import { fmtArea, stripCodePrefix } from "../../components/featureInfo/intlSpecPanel";
import { ID_DATA_PANELS, IdAdminBoundariesPanel } from "../../components/featureInfo/idPanels";
import { HarmReductionDuiCrashPanel } from "../../components/featureInfo/harmReductionPanels";

const all = (t: L3) => [t.zh, t.en, t.ja];
const render = (el: Parameters<typeof createElement>[0], props: Record<string, unknown>) => renderToStaticMarkup(createElement(el as never, { props } as never));

describe("圖例標籤 → popup 類別（plain）", () => {
  it.each([
    ["消防站（OSM，425）", "消防站"], ["Fire station (OSM, 425)", "Fire station"], ["消防署（OSM、425）", "消防署"],
    ["獸醫院（Overture，763）", "獸醫院"], ["工廠、工場（OSM）", "工廠、工場"], ["學校（52,856）", "學校"],
    ["基督教（新教、五旬節、浸信等；約 29,600）", "基督教"], ["ARG 自動雨量站（709）", "ARG 自動雨量站"],
    ["站（station）", "站（station）"], ["IKN 範圍（delineasi）", "IKN 範圍（delineasi）"],
  ])("%s → %s", (input, want) => {
    expect(plain({ zh: input, en: input, ja: input }).zh).toBe(want);
  });
});

describe("印尼規格層 popup 不帶筆數、來源或英文代碼", () => {
  for (const spec of ID_DATA_SPECS) {
    it(spec.key, () => {
      const texts: string[] = [];
      for (const f of spec.fields) for (const v of Object.values(f.map ?? {})) texts.push(...all(v));
      for (const v of Object.values(spec.title.fallbackBy?.map ?? {})) texts.push(...all(v as L3));
      for (const n of spec.popupNotes) texts.push(...all(n.text));
      for (const t of texts) {
        expect(t, `${spec.key}：${t}`).not.toMatch(/STALE/);
        expect(t, `${spec.key}：${t}`).not.toMatch(/[（(][^）)]*(OSM|Overture)[^）)]*[）)]$/);
        expect(t, `${spec.key}：${t}`).not.toMatch(/\d,\d{3}|[（(][~約]?\s*[\d,]+[）)]$/);
      }
    });
  }
});

describe("面積（kind area，輸入 km²）", () => {
  it.each([
    [0, ""], [null, ""], ["", ""], [-1, ""], ["nan", ""],
    [0.00001, "10 m²"], [0.0014, "1,400 m²"], [0.009, "9,000 m²"], [0.0105, "1.1 公頃"], [0.105, "11 公頃"],
    [1.234, "1.23 km²"], [97.6, "97.6 km²"], [1234.5, "1,235 km²"],
  ])("%s → %s", (v, want) => expect(fmtArea(v, "zh-TW")).toBe(want));
  it("英文用 ha", () => expect(fmtArea(0.5, "en")).toBe("50 ha"));
  it("公園面積 0（來源缺值）不顯示面積列", () => {
    const html = render(ID_DATA_PANELS.idParks, { name: "Taman", kind: "park", area_km2: 0 });
    expect(html).not.toContain("面積");
    expect(render(ID_DATA_PANELS.idParks, { name: "Taman", kind: "park", area_km2: 0.0014 })).toContain("1,400 m²");
  });
});

describe("popup 內容", () => {
  it("消防站類別只寫消防站", () => {
    const html = render(ID_DATA_PANELS.idFireStations, { name: "Pemadam kebakaran", kind: "fire_station" });
    expect(html).toContain(">消防站<");
    expect(html).not.toContain("425");
  });
  it("外圍小島去掉代碼前綴", () => {
    expect(stripCodePrefix(".01  Cilacap")).toBe("Cilacap");
    expect(stripCodePrefix("33 Jawa Tengah")).toBe("Jawa Tengah");
    expect(stripCodePrefix("0736 Banten")).toBe("Banten");
    expect(stripCodePrefix("Natuna")).toBe("Natuna");
    const html = render(ID_DATA_PANELS.idOuterIslands, { name: "Nusakambangan", kabkota_big: ".01  Cilacap", province_big: "33 Jawa Tengah" });
    expect(html).toContain("Cilacap");
    expect(html).not.toContain(".01");
    expect(html).not.toContain("33 Jawa");
  });
  it("電廠、保育林 popup 不露出 STALE、不重複來源備註", () => {
    const plant = render(ID_DATA_PANELS.idPowerPlants, { name: "PLTU", fuel: "coal", source: "gppd", stale: true });
    expect(plant).not.toContain("STALE");
    expect(plant.match(/2021 年版/g)?.length).toBe(1);
    const forest = render(ID_DATA_PANELS.idConservationForest, { function_en: "Protection Forest", area_km2: 0, stale: true });
    expect(forest).not.toContain("STALE");
    expect(forest).not.toContain("面積");
  });
  it("氣象站類型補白話", () => {
    expect(render(ID_DATA_PANELS.idWeatherStations, { name: "ARG X", station_type: "ARG" })).toContain("ARG 自動雨量站");
  });
  it("行政邊界 popup 不重複邊界聲明（在圖層說明・來源）", () => {
    expect(render(IdAdminBoundariesPanel, { level: "province", province_name: "Jawa Barat" })).not.toContain("不代表任何立場");
  });
  it("酒駕事故：資料期間與座標出處搬到圖層說明・來源", () => {
    const html = render(HarmReductionDuiCrashPanel, { accident_class: "A1", vintage: "107–114 年", location: "某路口" });
    expect(html).not.toContain("107–114");
    expect(html).not.toContain("警方事故紀錄座標");
    const info = LAYER_SOURCE_INFO.harmReductionDuiCrashes!;
    expect(info.asOf).toBeTruthy();
    expect(info.notes?.length).toBeGreaterThan(0);
    expect(pickL3({ zh: "a", en: "b", ja: "c" }, "en")).toBe("b");
  });
});
