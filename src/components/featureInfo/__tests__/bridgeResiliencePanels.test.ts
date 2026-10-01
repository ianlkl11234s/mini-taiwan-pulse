import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { bridgeResilienceDataStore, bridgeResilienceSelection } from "../../../data/bridgeResilienceStore";
import { BRIDGE_RESILIENCE_KEY, decodeDestinationView, type BridgeModeSummary, type BridgeResilienceData, type DecayModeSummary, type VillageDestinations } from "../../../data/bridgeResilienceTypes";
import { layerParamsStore } from "../../../state/layerParamsStore";
import { altBridgesText, BridgeResiliencePanel, decayRankText, decayTauRankText, decayTopVillagesText, DestinationSection } from "../bridgeResiliencePanels";

const mode = (over: Partial<BridgeModeSummary> = {}): BridgeModeSummary => ({
  p90_dT_s: 214.42, mean_dT_s: 135.08, accessibility_loss: 0.00076, exposed_population_gt60s: 5858940, stranded_population: 0,
  replacement_bridges: { basis: "以戶籍權重最大的 50 組受影響起訖對統計", same_river_within_5km: [{ label: "三鶯二橋", weight_share: 0.4023, pairs: 21 }], other_bridges_on_route: [] },
  alt_population_weights: { day: { p90_dT_s: 215.86, accessibility_loss: 0.00057 }, night: { p90_dT_s: 214.42, accessibility_loss: 0.0007 } },
  ...over,
});
const top = (village: string, town: string, s: number | null, pop: number) => ({ VILLCODE: "1", county: "新北市", town, village, pop_hh: pop, decay_mean_dT_s: s, contribution_person_s: 1 });
const decayMode = (over: Partial<DecayModeSummary> = {}): DecayModeSummary => ({
  decay_impact: 22689297, decay_mean_dT_per_trip: 3.489, pop_gt30s: 222832, pop_gt60s: 7514, decay_impact_rank: 1, uniform_impact_rank: 2, rank_tau10: 1, rank_tau30: 3,
  top5_villages: [top("福佳里", "士林區", 63.9, 7514), top("後港里", "士林區", 53.2, 7607), top("榮光里", "北投區", null, 7528), top("永欣里", "北投區", 41.2, 8262)],
  ...over,
});
const JOINT_NULL = decayMode({ decay_impact_rank: null, uniform_impact_rank: null, rank_tau10: null, rank_tau30: null });
const DATA: BridgeResilienceData = {
  impacts: { scenarios: [], villages: {} },
  decayImpacts: { scenarios: [], villages: {} },
  decaySummary: { bridges: {
    三鶯大橋: { modes: { car: decayMode(), scooter: decayMode({ decay_impact: null, decay_mean_dT_per_trip: null, decay_impact_rank: 4, uniform_impact_rank: 4 }) } },
    淡江大橋: { modes: { car: decayMode(), scooter: decayMode() } },
    "關渡大橋+淡江大橋": { is_joint: true, modes: { car: JOINT_NULL, scooter: JOINT_NULL } },
  } },
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

describe("雙北跨河橋梁韌性 popup（不分遠近）", () => {
  beforeEach(() => { bridgeResilienceDataStore.set(null); bridgeResilienceSelection.clear(); layerParamsStore.reset(); layerParamsStore.setParam(BRIDGE_RESILIENCE_KEY, "bridgeResilienceWeighting", "uniform"); });
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
    for (const text of ["大漢溪", "2026-09-28", "3.6 分鐘", "5,858,940 人", "0.08%", "三鶯二橋（40.2%）", "敏感度・日間人口", "敏感度・夜間人口", "代表性起訖對"]) expect(html).toContain(text);
    expect(html).toContain("不是風險");
    expect(html).toContain("不等於實際旅次");
  });
  it("機車 p90 為 null 時顯示「無受影響目的地」，不是 0", () => {
    bridgeResilienceDataStore.set(DATA);
    layerParamsStore.setParam(BRIDGE_RESILIENCE_KEY, "bridgeResilienceMode", "scooter");
    expect(render("三鶯大橋")).toContain("無受影響目的地");
    expect(render("三鶯大橋")).not.toContain("0.0 分鐘");
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

describe("雙北跨河橋梁韌性 popup（距離遞減，預設）", () => {
  beforeEach(() => { bridgeResilienceDataStore.set(null); bridgeResilienceSelection.clear(); layerParamsStore.reset(); });
  it("預設權重是距離遞減：顯示影響（百萬人·秒）、每人每次多花、>30／>60 秒人口、名次、前 3 村里；不顯示不分遠近的 p90", () => {
    bridgeResilienceDataStore.set(DATA);
    const html = render("三鶯大橋");
    for (const text of ["距離遞減（平均行程 20 分）", "不分遠近", "22.7 百萬人·秒", "3.5 秒", "222,832 人", "7,514 人",
      "第 1 名（不分遠近 第 2 名）", "說明與限制", "福佳里（士林區） +64 秒・7,514 人", "後港里（士林區） +53 秒", "榮光里（北投區）・7,528 人"]) expect(html).toContain(text);
    expect(html).not.toContain("永欣里");
    expect(html).not.toContain("額外時間 p90");
    expect(html).not.toContain("暴露人口");
  });
  it("null 不當 0：機車影響／每人多花顯示「未提供」；前 3 村里的 null 秒數不寫 +0", () => {
    bridgeResilienceDataStore.set(DATA);
    layerParamsStore.setParam(BRIDGE_RESILIENCE_KEY, "bridgeResilienceMode", "scooter");
    const html = render("三鶯大橋");
    expect(html).toContain("未提供");
    expect(html).not.toContain("0.0 秒");
    expect(html).not.toContain("+0 秒");
  });
  it("聯合情境（淡江大橋＋聯合開關）兩種權重都能用；名次為 null 時顯示「不列名次」", () => {
    bridgeResilienceDataStore.set({ ...DATA, summary: { bridges: { ...DATA.summary.bridges, "關渡大橋+淡江大橋": DATA.summary.bridges["淡江大橋"]! } } });
    layerParamsStore.setParam(BRIDGE_RESILIENCE_KEY, "bridgeResilienceJoint", true);
    const decay = render("淡江大橋");
    expect(decay).toContain("同時中斷");
    expect(decay).toContain("不列名次");
    expect(decay).not.toContain("第 0 名");
    layerParamsStore.setParam(BRIDGE_RESILIENCE_KEY, "bridgeResilienceWeighting", "uniform");
    const uniform = render("淡江大橋");
    expect(uniform).toContain("額外時間 p90");
    expect(uniform).not.toContain("不列名次");
  });
  it("橋不在 decay_summary 時說明並建議切換權重，不合成數字", () => {
    bridgeResilienceDataStore.set({ ...DATA, decaySummary: { bridges: {} } });
    expect(render("三鶯大橋")).toContain("沒有距離遞減版指標");
  });
  it("名次與 τ 敏感度文字；null 以「—」", () => {
    expect(decayRankText(decayMode())).toBe("第 1 名（不分遠近 第 2 名）");
    expect(decayRankText(JOINT_NULL)).toBe("不列名次");
    expect(decayTauRankText(decayMode())).toBe("1／1／3");
    expect(decayTauRankText(JOINT_NULL)).toBe("—／—／—");
    expect(decayTopVillagesText(undefined)).toBe("未提供");
  });
  it("內容區有高度上限可捲動；只顯示目前交通模式的數字", () => {
    bridgeResilienceDataStore.set(DATA);
    const html = render("三鶯大橋");
    expect(html).toContain('class="fi-scroll"');
    expect(html).toContain("max-height:320px");
    expect(html).not.toContain("汽車 3.5 秒；機車");
  });
  it("目的地視角區塊在距離遞減下註明明細是不分遠近版；不分遠近下不出現", () => {
    const section = (uniformNote: boolean) => renderToStaticMarkup(createElement(DestinationSection, { view: null, status: "idle", originCode: "1", modeLabel: "汽車", uniformNote }));
    expect(section(true)).toContain("目的地明細是不分遠近版");
    expect(section(false)).not.toContain("目的地明細是不分遠近版");
    bridgeResilienceDataStore.set(DATA);
    bridgeResilienceSelection.select("三鶯大橋");
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
