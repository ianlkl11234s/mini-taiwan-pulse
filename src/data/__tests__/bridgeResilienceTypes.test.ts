import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — style-spec CJS entry has no exported typings; test-only evaluator.
import { expression } from "mapbox-gl/dist/style-spec/index.cjs";
import { GATED_LAYERS } from "../../components/sidebar/layerCatalog";
import { fetchPrivateJson, loadBridgeResilienceData, validateBridgeResilienceData } from "../bridgeResilienceLoader";
import {
  BRIDGE_JOINT_KEY, BRIDGE_RESILIENCE_ASSETS, BRIDGE_RESILIENCE_COLORS, BRIDGE_RESILIENCE_KEY,
  BRIDGE_RESILIENCE_PRIVATE_LAYER_KEYS, BRIDGE_RESILIENCE_RAMP, DECAY_MEAN_BREAKS, DECAY_RAMP, decayFillColorExpression, decodeDecayVillageScenario, decodeVillageScenario, effectiveScenarioUid,
  geometryConfidenceText, highlightUids, lossPercentText, millionPersonSecondsText, minutesText, populationText, rankText, scenarioKey, secondsText,
  villageFillColorExpression, type DecaySummary, type DecayVillageImpacts, type VillageImpacts,
} from "../bridgeResilienceTypes";

const IMPACTS: VillageImpacts = {
  scenarios: ["三鶯大橋|car", "三鶯大橋|scooter", "關渡大橋+淡江大橋|car"],
  villages: {
    "63000010002": { p90_dT_s: [237, null, 400], affected_dest_pop_share: [0.01, 0, 0.3] },
    "65000160008": { p90_dT_s: [null, 52, null], affected_dest_pop_share: [0, 0.001, 0.5] },
  },
};

const DECAY: DecayVillageImpacts = {
  scenarios: ["三鶯大橋|car", "三鶯大橋|scooter", "關渡大橋+淡江大橋|car"],
  villages: {
    "63000010002": { decay_mean_dT_s: [0.59, null, 203.4] },
    "65000160008": { decay_mean_dT_s: [0, 12.5, 61] },
  },
};
const DECAY_SUMMARY: DecaySummary = { bridges: {} };

describe("decay_village_impacts 解碼（距離遞減版）", () => {
  it("decay_mean_dT_s[i] 對應 scenarios[i]；聯合情境也能解", () => {
    expect(decodeDecayVillageScenario(DECAY, "三鶯大橋|car")!.get(63000010002)).toBe(0.59);
    expect(decodeDecayVillageScenario(DECAY, "三鶯大橋|scooter")!.get(65000160008)).toBe(12.5);
    const joint = decodeDecayVillageScenario(DECAY, `${BRIDGE_JOINT_KEY}|car`)!;
    expect(joint.get(63000010002)).toBe(203.4);
    expect(joint.get(65000160008)).toBe(61);
  });
  it("null 保留為 null；0 是真實的 0；情境不存在回 null", () => {
    expect(decodeDecayVillageScenario(DECAY, "三鶯大橋|scooter")!.get(63000010002)).toBeNull();
    expect(decodeDecayVillageScenario(DECAY, "三鶯大橋|car")!.get(65000160008)).toBe(0);
    expect(decodeDecayVillageScenario(DECAY, "不存在|car")).toBeNull();
  });
  const evalColor = (has: number, v: number | null) => {
    const compiled = expression.createExpression(decayFillColorExpression(), { type: "color", "property-type": "data-driven", expression: { interpolated: false, parameters: ["zoom", "feature", "feature-state"] } });
    expect(compiled.result).toBe("success");
    const color = compiled.value.evaluate({ zoom: 10 }, { type: 3, properties: {} }, { has, v });
    return [color.r, color.g, color.b].map((c: number) => Math.round(c * 255)).join(",");
  };
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");
  it("色階 7 級：<1、1–5、5–15、15–30、30–60、60–120、≥120 秒；邊界值落在上一級的下界", () => {
    expect(DECAY_RAMP).toHaveLength(DECAY_MEAN_BREAKS.length + 1);
    const cases: Array<[number, number]> = [[0, 0], [0.99, 0], [1, 1], [4.99, 1], [5, 2], [15, 3], [30, 4], [60, 5], [119.9, 5], [120, 6], [900, 6]];
    for (const [v, bin] of cases) expect(evalColor(1, v), `v=${v}`).toBe(rgb(DECAY_RAMP[bin]!));
  });
  it("has≠1（null／未設定）一律中性色，不當 0", () => {
    expect(evalColor(0, 0)).toBe(rgb(BRIDGE_RESILIENCE_COLORS.villageNeutral));
    expect(evalColor(0, 0)).not.toBe(rgb(DECAY_RAMP[0]));
  });
});

describe("距離遞減 popup 文字", () => {
  it("影響以百萬人·秒、每人每次多花以秒；null 回「未提供」，不是 0", () => {
    expect(millionPersonSecondsText(22689297)).toBe("22.7 百萬人·秒");
    expect(secondsText(3.489)).toBe("3.5 秒");
    expect(millionPersonSecondsText(null)).toBe("未提供");
    expect(secondsText(null)).toBe("未提供");
  });
  it("名次 null（聯合情境）顯示「不列名次」，不是第 0 名", () => {
    expect(rankText(1)).toBe("第 1 名");
    expect(rankText(null)).toBe("不列名次");
    expect(rankText(null)).not.toContain("0");
  });
});

describe("village_impacts 解碼", () => {
  it("villages[VILLCODE][field][i] 對應 scenarios[i]，VILLCODE 轉成 feature id", () => {
    const car = decodeVillageScenario(IMPACTS, "三鶯大橋|car", "p90")!;
    expect(car.get(63000010002)).toBe(237);
    const scooter = decodeVillageScenario(IMPACTS, "三鶯大橋|scooter", "p90")!;
    expect(scooter.get(65000160008)).toBe(52);
  });
  it("p90 的 null 保留為 null（沒有受影響目的地），不轉成 0", () => {
    const scooter = decodeVillageScenario(IMPACTS, "三鶯大橋|scooter", "p90")!;
    expect(scooter.get(63000010002)).toBeNull();
    expect(decodeVillageScenario(IMPACTS, "三鶯大橋|car", "p90")!.get(65000160008)).toBeNull();
  });
  it("affected_dest_pop_share 的 0 是真實的 0，與 null 分開", () => {
    const share = decodeVillageScenario(IMPACTS, "三鶯大橋|scooter", "share")!;
    expect(share.get(63000010002)).toBe(0);
    expect(share.get(63000010002)).not.toBeNull();
  });
  it("聯合情境用自己的鍵；不存在的情境回 null", () => {
    expect(decodeVillageScenario(IMPACTS, scenarioKey(BRIDGE_JOINT_KEY, "car"), "share")!.get(65000160008)).toBe(0.5);
    expect(decodeVillageScenario(IMPACTS, "不存在|car", "p90")).toBeNull();
  });
  it("聯合開關只對關渡／淡江生效，並高亮兩座成員橋", () => {
    expect(effectiveScenarioUid("關渡大橋", true)).toBe(BRIDGE_JOINT_KEY);
    expect(effectiveScenarioUid("淡江大橋", true)).toBe(BRIDGE_JOINT_KEY);
    expect(effectiveScenarioUid("三鶯大橋", true)).toBe("三鶯大橋");
    expect(effectiveScenarioUid(null, true)).toBeNull();
    expect(highlightUids("關渡大橋", true)).toEqual(["關渡大橋", "淡江大橋"]);
    expect(highlightUids("關渡大橋", false)).toEqual(["關渡大橋"]);
    expect(highlightUids("三鶯大橋", true)).toEqual(["三鶯大橋"]);
  });
});

describe("村里填色運算式：null 走中性色，不當 0", () => {
  const evaluate = (metric: "p90" | "share", state: Record<string, unknown>) => {
    const parsed = expression.createExpression(villageFillColorExpression(metric), { type: "color", "property-type": "data-driven", expression: { interpolated: false, parameters: ["zoom", "feature", "feature-state"] } });
    expect(parsed.result).toBe("success");
    const value = parsed.value.evaluate({ zoom: 10 }, { type: 3, properties: {} }, state);
    return [value.r, value.g, value.b].map((c: number) => Math.round(c * 255));
  };
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  it("has=0（null）與沒有 state 都是中性色", () => {
    expect(evaluate("p90", { has: 0, v: 0 })).toEqual(rgb(BRIDGE_RESILIENCE_COLORS.villageNeutral));
    expect(evaluate("p90", {})).toEqual(rgb(BRIDGE_RESILIENCE_COLORS.villageNeutral));
  });
  it("has=1 依分界取色；share 的真 0 落在最低一級而非中性", () => {
    expect(evaluate("share", { has: 1, v: 0 })).toEqual(rgb(BRIDGE_RESILIENCE_RAMP[0]));
    expect(evaluate("p90", { has: 1, v: 61 })).toEqual(rgb(BRIDGE_RESILIENCE_RAMP[1]));
    expect(evaluate("p90", { has: 1, v: 5000 })).toEqual(rgb(BRIDGE_RESILIENCE_RAMP[5]));
  });
});

describe("popup 數值格式", () => {
  it("p90 null 顯示「無受影響目的地」，不是 0 分鐘", () => {
    expect(minutesText(null)).toBe("無受影響目的地");
    expect(minutesText(undefined)).toBe("無受影響目的地");
    expect(minutesText(214.42)).toBe("3.6 分鐘");
    expect(minutesText(0)).toBe("0.0 分鐘");
  });
  it("可及性損失 ×100、人口千分位、缺值未提供", () => {
    expect(lossPercentText(0.0007613908)).toBe("0.08%");
    expect(lossPercentText(null)).toBe("未提供");
    expect(populationText(1772670)).toBe("1,772,670 人");
    expect(populationText(null)).toBe("未提供");
    expect(geometryConfidenceText({ 關渡大橋: "B", 淡江大橋: "A" })).toBe("關渡大橋 B；淡江大橋 A");
    expect(geometryConfidenceText("A")).toBe("A");
  });
});

describe("私人 JSON 載入", () => {
  const json = (body: unknown, status = 206) => async () => new Response(JSON.stringify(body), { status });
  it("以資產已知大小要整段 Range 並帶 Bearer", async () => {
    let seen: RequestInit | undefined; let url = "";
    await fetchPrivateJson("summary", "tok", async (u, i) => { url = u; seen = i; return new Response("{}", { status: 206 }); });
    expect(url).toBe("/api/private-research/bridge-resilience/summary");
    expect((seen!.headers as Record<string, string>).Range).toBe(`bytes=0-${BRIDGE_RESILIENCE_ASSETS.summary.size - 1}`);
    expect((seen!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(seen!.cache).toBe("no-store");
  });
  it("401／403 帶 status 丟出；非 206 視為未就緒", async () => {
    await expect(fetchPrivateJson("impacts", "t", json({}, 403))).rejects.toMatchObject({ status: 403 });
    await expect(fetchPrivateJson("impacts", "t", json({}, 200))).rejects.toThrow("尚未就緒");
  });
  it("格式不符時中止，不合成空資料", async () => {
    const FP = { bridges: {} };
    expect(() => validateBridgeResilienceData({} as never, IMPACTS, DECAY, DECAY_SUMMARY, FP)).toThrow();
    expect(() => validateBridgeResilienceData({ bridges: {} }, { scenarios: [] } as never, DECAY, DECAY_SUMMARY, FP)).toThrow();
    expect(() => validateBridgeResilienceData({ bridges: {} }, IMPACTS, {} as never, DECAY_SUMMARY, FP)).toThrow("decay_village_impacts");
    expect(() => validateBridgeResilienceData({ bridges: {} }, IMPACTS, DECAY, {} as never, FP)).toThrow("decay_summary");
    expect(() => validateBridgeResilienceData({ bridges: {} }, IMPACTS, DECAY, DECAY_SUMMARY, {} as never)).toThrow("bridge_fingerprint");
    const fp = { version: "v1", bridges: { 三鶯大橋: { modes: { car: { percentiles: { barrier: 51 } } } } } };
    const both = await loadBridgeResilienceData("t", async (u) => new Response(JSON.stringify(u.endsWith("/fingerprint") ? fp : u.endsWith("/decay-summary") ? DECAY_SUMMARY : u.endsWith("/decay-impacts") ? DECAY : u.endsWith("/summary") ? { bridges: {} } : IMPACTS), { status: 206 }));
    expect(both.impacts.scenarios).toHaveLength(3);
    expect(both.fingerprint.bridges["三鶯大橋"]?.modes.car?.percentiles.barrier).toBe(51);
    expect(both.decayImpacts.scenarios).toHaveLength(3);
  });
});

describe("sidecar 資產契約", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const whole = fs.readFileSync(path.resolve(here, "../../../server/coral-private/coral-private-server.mjs"), "utf8");
  const sidecar = whole.slice(whole.indexOf("export const BRIDGE_RESILIENCE_ASSETS"));
  it("前端契約與 sidecar BRIDGE_RESILIENCE_ASSETS 的檔名／大小／SHA-256 逐一相同", () => {
    for (const [name, asset] of Object.entries(BRIDGE_RESILIENCE_ASSETS)) {
      const block = sidecar.match(new RegExp(`"?${name}"?: Object\\.freeze\\(\\{\\s*filename: "([^"]+)",\\s*size: (\\d+),\\s*sha256: "([0-9a-f]{64})"`, "m"));
      expect(block, name).not.toBeNull();
      expect(block![1]).toBe(asset.filename);
      expect(Number(block![2])).toBe(asset.size);
      expect(block![3]).toBe(asset.sha256);
    }
  });
  it("manifest 註記含全部資產檔名與 PMTiles SHA 前綴（三處同步）", () => {
    const manifest = fs.readFileSync(path.resolve(here, "../layerManifest.ts"), "utf8");
    const line = manifest.split("\n").find((l) => l.includes("Owner-only same-origin Range API /api/private-research/bridge-resilience/"))!;
    expect(line).toBeTruthy();
    for (const [name, asset] of Object.entries(BRIDGE_RESILIENCE_ASSETS)) {
      expect(line, name).toContain(asset.filename);
      expect(line, `route ${name}`).toContain(name);
    }
    expect(line).toContain(`${BRIDGE_RESILIENCE_ASSETS.tiles.sha256.slice(0, 8)}…${BRIDGE_RESILIENCE_ASSETS.tiles.sha256.slice(-4)}`);
  });
  it("圖層是站主限定（GATED），且原始碼不含外部網址或 env", () => {
    expect(BRIDGE_RESILIENCE_PRIVATE_LAYER_KEYS.every((key) => GATED_LAYERS.has(key))).toBe(true);
    expect(BRIDGE_RESILIENCE_PRIVATE_LAYER_KEYS).toContain(BRIDGE_RESILIENCE_KEY);
    for (const file of ["../bridgeResilienceLoader.ts", "../bridgeResilienceTypes.ts", "../../hooks/useBridgeResilienceLayers.ts"]) {
      const source = fs.readFileSync(path.resolve(here, file), "utf8");
      expect(source, file).not.toMatch(/https?:\/\/(?!www\.w3)/);
      expect(source, file).not.toContain("import.meta.env");
    }
  });
});
