import { beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error — style-spec CJS entry has no exported typings; test-only evaluator.
import { expression } from "mapbox-gl/dist/style-spec/index.cjs";
import { bridgeResilienceOrigin, bridgeResilienceSelection } from "../bridgeResilienceStore";
import { loadVillageDestinations, validateVillageDestinations } from "../bridgeResilienceLoader";
import {
  BRIDGE_RESILIENCE_ASSETS, BRIDGE_RESILIENCE_COLORS, BRIDGE_RESILIENCE_RAMP, DEST_STATE, decodeDestinationView,
  destinationFillColorExpression, destinationTopIds, destinationVillageStates, sharePermilleText, type VillageDestinations,
} from "../bridgeResilienceTypes";

/** 4 個村里、3 個區；情境 0 的起點 0：大同區受影響 70 人（100%）、松山區不可達；起點 1 沒有記錄。 */
const DEST: VillageDestinations = {
  scenarios: ["三鶯大橋|car", "三鶯大橋|scooter"],
  villages: ["63000010002", "63000010003", "63000020001", "65000160008"],
  village_names: ["莊敬里", "東榮里", "民權里", "北大里"],
  districts: [["臺北市", "松山區"], ["臺北市", "大同區"], ["新北市", "板橋區"]],
  village_district: [0, 0, 1, 2],
  data: {
    "0": { "0": { d: [1, 70, 1000, 116, 150, 2, 20, 500, 90, 90], t: [2, 150, 30, 3, 90, 40], u: [2, 5, 1] } },
    "1": { "3": { u: [0, 30, 2] } },
  },
};

describe("目的地視角解碼", () => {
  it("d／t／u 攤平陣列解成區列、前 N 名與不可達；區列依受影響人口比排序", () => {
    const view = decodeDestinationView(DEST, "三鶯大橋|car", "63000010002")!;
    expect(view.originName).toBe("莊敬里");
    expect(view.originDistrictLabel).toBe("臺北市松山區");
    expect(view.districts.map((row) => [row.label, row.sharePermille, row.meanDtS, row.maxDtS])).toEqual([["大同區", 1000, 116, 150], ["板橋區", 500, 90, 90]]);
    expect(view.districts[0]!.affectedPop).toBe(70);
    expect(view.top.map((row) => [row.name, row.dtS, row.pop])).toEqual([["民權里", 150, 30], ["北大里", 90, 40]]);
    expect(view.top[0]!.districtLabel).toBe("大同區");
    expect(view.unreachable).toEqual([{ district: 2, label: "板橋區", pop: 5, villages: 1 }]);
    expect(view.noAffected).toBe(false);
  });
  it("沒有記錄的起點＝沒有受影響目的地（noAffected），不是 null 也不是 0；情境或起點不存在才回 null", () => {
    const none = decodeDestinationView(DEST, "三鶯大橋|car", "63000010003")!;
    expect(none.noAffected).toBe(true);
    expect(none.districts).toEqual([]);
    expect(none.top).toEqual([]);
    expect(decodeDestinationView(DEST, "不存在|car", "63000010003")).toBeNull();
    expect(decodeDestinationView(DEST, "三鶯大橋|car", "99999999999")).toBeNull();
  });
  it("只有不可達的起點：noAffected 為真但仍列出不可達，不混進受影響列", () => {
    const view = decodeDestinationView(DEST, "三鶯大橋|scooter", "65000160008")!;
    expect(view.noAffected).toBe(true);
    expect(view.districts).toEqual([]);
    expect(view.unreachable).toEqual([{ district: 0, label: "松山區", pop: 30, villages: 2 }]);
  });
  it("切換模式即換情境：同一起點在另一個情境讀到不同結果", () => {
    expect(decodeDestinationView(DEST, "三鶯大橋|scooter", "63000010002")!.noAffected).toBe(true);
    expect(decodeDestinationView(DEST, "三鶯大橋|car", "63000010002")!.noAffected).toBe(false);
  });
});

describe("目的地視角著色", () => {
  it("起點、受影響區、不可達區、中性各自一個狀態；同區同色", () => {
    const view = decodeDestinationView(DEST, "三鶯大橋|car", "63000010002")!;
    const states = destinationVillageStates(DEST, view);
    expect(states.get(63000010002)).toEqual({ has: DEST_STATE.origin, v: 0 });
    expect(states.get(63000010003)).toEqual({ has: DEST_STATE.neutral, v: 0 });   // 起點同區（松山）沒有受影響目的地
    expect(states.get(63000020001)).toEqual({ has: DEST_STATE.affected, v: 116 });
    expect(states.get(65000160008)).toEqual({ has: DEST_STATE.affected, v: 90 });
    expect(states.size).toBe(4);
    expect(destinationTopIds(view)).toEqual([63000020001, 65000160008]);
    expect(destinationTopIds(null)).toEqual([]);
  });
  it("不可達的區只在沒有受影響目的地時標為不可達，不落入色階", () => {
    const view = decodeDestinationView(DEST, "三鶯大橋|scooter", "65000160008")!;
    const states = destinationVillageStates(DEST, view);
    expect(states.get(63000010002)).toEqual({ has: DEST_STATE.unreachable, v: 0 });
    expect(states.get(65000160008)).toEqual({ has: DEST_STATE.origin, v: 0 });
  });
  const evaluate = (state: Record<string, unknown>) => {
    const parsed = expression.createExpression(destinationFillColorExpression(), { type: "color", "property-type": "data-driven", expression: { interpolated: false, parameters: ["zoom", "feature", "feature-state"] } });
    expect(parsed.result).toBe("success");
    const value = parsed.value.evaluate({ zoom: 10 }, { type: 3, properties: {} }, state);
    return [value.r, value.g, value.b].map((c: number) => Math.round(c * 255));
  };
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  it("填色運算式：受影響走色階、不可達紫、其餘（含沒有 state）中性", () => {
    expect(evaluate({ has: DEST_STATE.affected, v: 116 })).toEqual(rgb(BRIDGE_RESILIENCE_RAMP[1]));
    expect(evaluate({ has: DEST_STATE.affected, v: 5000 })).toEqual(rgb(BRIDGE_RESILIENCE_RAMP[5]));
    expect(evaluate({ has: DEST_STATE.unreachable, v: 0 })).toEqual(rgb(BRIDGE_RESILIENCE_COLORS.destUnreachable));
    expect(evaluate({ has: DEST_STATE.neutral, v: 0 })).toEqual(rgb(BRIDGE_RESILIENCE_COLORS.villageNeutral));
    expect(evaluate({})).toEqual(rgb(BRIDGE_RESILIENCE_COLORS.villageNeutral));
    expect(BRIDGE_RESILIENCE_COLORS.destUnreachable).not.toBe(BRIDGE_RESILIENCE_COLORS.villageNeutral);
  });
  it("人口比文字", () => {
    expect(sharePermilleText(1000)).toBe("100%");
    expect(sharePermilleText(600)).toBe("60%");
    expect(sharePermilleText(5)).toBe("0.5%");
  });
});

describe("目的地資料載入與選取 store", () => {
  it("以資產已知大小要整段 Range；格式不符中止", async () => {
    let url = ""; let range = "";
    const loaded = await loadVillageDestinations("tok", async (u, init) => {
      url = u; range = (init!.headers as Record<string, string>).Range ?? "";
      return new Response(JSON.stringify(DEST), { status: 206 });
    });
    expect(url).toBe("/api/private-research/bridge-resilience/destinations");
    expect(range).toBe(`bytes=0-${BRIDGE_RESILIENCE_ASSETS.destinations.size - 1}`);
    expect(loaded.villages).toHaveLength(4);
    expect(() => validateVillageDestinations({ ...DEST, village_names: [] })).toThrow();
    expect(() => validateVillageDestinations({} as never)).toThrow();
  });
  beforeEach(() => bridgeResilienceSelection.clear());
  it("點村里（設 origin）不影響橋選取；回到起點視角只清 origin；換橋才結束目的地視角", () => {
    bridgeResilienceSelection.select("三鶯大橋");
    bridgeResilienceOrigin.set("63000010002");
    expect(bridgeResilienceSelection.get()).toBe("三鶯大橋");
    bridgeResilienceSelection.select("三鶯大橋");                  // 同一座橋重選：起點保留
    expect(bridgeResilienceOrigin.get()).toBe("63000010002");
    bridgeResilienceOrigin.clear();                                // 點空白處／回到起點視角
    expect(bridgeResilienceOrigin.get()).toBeNull();
    expect(bridgeResilienceSelection.get()).toBe("三鶯大橋");
    bridgeResilienceOrigin.set("63000010002");
    bridgeResilienceSelection.select("中正橋");
    expect(bridgeResilienceOrigin.get()).toBeNull();
    expect(bridgeResilienceSelection.get()).toBe("中正橋");
    bridgeResilienceOrigin.set("63000010002");
    bridgeResilienceSelection.clear();                             // 關閉 popup：兩者都清
    expect(bridgeResilienceOrigin.get()).toBeNull();
    expect(bridgeResilienceSelection.get()).toBeNull();
  });
});
