import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { bridgeResilienceDataStore, bridgeResilienceSelection } from "../../../data/bridgeResilienceStore";
import { decodeDestinationView, type BridgeModeSummary, type BridgeResilienceData, type VillageDestinations } from "../../../data/bridgeResilienceTypes";
import { altBridgesText, BridgeResiliencePanel, DestinationSection } from "../bridgeResiliencePanels";

const mode = (over: Partial<BridgeModeSummary> = {}): BridgeModeSummary => ({
  p90_dT_s: 214.42, mean_dT_s: 135.08, accessibility_loss: 0.00076, exposed_population_gt60s: 5858940, stranded_population: 0,
  replacement_bridges: { basis: "以戶籍權重最大的 50 組受影響起訖對統計", same_river_within_5km: [{ label: "三鶯二橋", weight_share: 0.4023, pairs: 21 }], other_bridges_on_route: [] },
  alt_population_weights: { day: { p90_dT_s: 215.86, accessibility_loss: 0.00057 }, night: { p90_dT_s: 214.42, accessibility_loss: 0.0007 } },
  ...over,
});
const DATA: BridgeResilienceData = {
  impacts: { scenarios: [], villages: {} },
  summary: { bridges: {
    三鶯大橋: { bridge_uid: "三鶯大橋", is_joint_scenario: false, members: ["三鶯大橋"], river: "大漢溪",
      human_review: { latest_review_date: "2026-09-28", geometry_confidence: "A", notes: [] },
      modes: { car: mode(), scooter: mode({ p90_dT_s: null, sensitivity_scooter_expressway_ban: { p90_dT_s: 179.65, accessibility_loss: 0.00016 } }) } },
    淡江大橋: { bridge_uid: "淡江大橋", is_joint_scenario: false, members: ["淡江大橋"], river: "淡水河",
      human_review: { latest_review_date: "2026-09-29", geometry_confidence: "A", notes: ["淡江大橋: 交流道匝道算不算橋體，使用者標『不確定』；模擬一併移除（上界）"] },
      modes: { car: mode(), scooter: mode() } },
  } },
};
const render = (uid: string) => renderToStaticMarkup(createElement(BridgeResiliencePanel, { props: { bridge_uid: uid } }));

describe("雙北跨河橋梁韌性 popup", () => {
  beforeEach(() => { bridgeResilienceDataStore.set(null); bridgeResilienceSelection.clear(); });
  it("資料未載入時顯示載入中，仍列出操作與限制", () => {
    const html = render("三鶯大橋");
    expect(html).toContain("指標載入中");
    expect(html).toContain("顯示受影響村里");
    expect(html).toContain("顯示替代路線");
    expect(html).toContain("自由車流模型時間，不含壅塞");
  });
  it("顯示河川、人工評級、複核日期、汽車／機車指標與替代橋", () => {
    bridgeResilienceDataStore.set(DATA);
    const html = render("三鶯大橋");
    for (const text of ["大漢溪", "2026-09-28", "汽車 3.6 分鐘", "5,858,940 人", "0.08%", "三鶯二橋（40.2%）", "敏感度・日間人口", "敏感度・夜間人口", "代表性起訖對"]) expect(html).toContain(text);
    expect(html).toContain("不是風險");
    expect(html).toContain("不等於實際旅次");
  });
  it("機車 p90 為 null 時顯示「無受影響目的地」，不是 0", () => {
    bridgeResilienceDataStore.set(DATA);
    expect(render("三鶯大橋")).toContain("機車 無受影響目的地");
    expect(render("三鶯大橋")).not.toContain("機車 0.0 分鐘");
  });
  it("聯合切換只在關渡／淡江出現；淡江匝道上界備註要帶出", () => {
    bridgeResilienceDataStore.set(DATA);
    expect(render("三鶯大橋")).not.toContain("與另一座同時中斷");
    const html = render("淡江大橋");
    expect(html).toContain("與另一座同時中斷");
    expect(html).toContain("屬上界");
    expect(html).toContain("交流道匝道一併移除");
  });
  it("替代橋前 3 名、空陣列回「無」", () => {
    expect(altBridgesText([])).toBe("無");
    expect(altBridgesText(undefined)).toBe("無");
    expect(altBridgesText([1, 2, 3, 4].map((n) => ({ label: `橋${n}`, weight_share: 0.1 * n, pairs: n })))).toBe("橋1（10.0%）、橋2（20.0%）、橋3（30.0%）");
  });
});

describe("目的地視角區塊", () => {
  const dest: VillageDestinations = {
    scenarios: ["三鶯大橋|car"], villages: ["63000010002", "63000020001", "63000030001"], village_names: ["莊敬里", "民權里", "北大里"],
    districts: [["臺北市", "松山區"], ["臺北市", "大同區"], ["新北市", "板橋區"]], village_district: [0, 1, 2],
    data: { "0": { "0": { d: [1, 70, 600, 480, 720], t: [1, 720, 70], u: [2, 5, 1] }, "1": {} } },
  };
  const html = (code: string, status: "idle" | "loading" | "error" = "idle", loaded = true) => renderToStaticMarkup(createElement(DestinationSection, {
    view: loaded ? decodeDestinationView(dest, "三鶯大橋|car", code) : null, status, originCode: code, modeLabel: "汽車" }));
  it("列出依行政區彙整的表、前幾名村里、不可達與回到起點視角按鈕", () => {
    const out = html("63000010002");
    for (const text of ["目的地視角：莊敬里（臺北市松山區）", "回到起點視角", "大同區", "60%", "8.0 分鐘", "12.0 分鐘", "受影響最多的 1 個村里", "民權里", "無法抵達：板橋區", "同區同色"]) expect(out).toContain(text);
  });
  it("沒有受影響目的地時說明是低於門檻，不是 0 分鐘", () => {
    const out = html("63000020001");
    expect(out).toContain("未超過 60 秒");
    expect(out).not.toContain("0.0 分鐘");
  });
  it("資料載入中／失敗各有提示；不合成空表", () => {
    expect(html("63000010002", "loading", false)).toContain("目的地資料載入中");
    expect(html("63000010002", "error", false)).toContain("載入失敗");
    expect(html("63000010002", "error", false)).not.toContain("目的地行政區");
  });
});
