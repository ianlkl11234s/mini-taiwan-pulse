/**
 * 主站分享網址的圖層參數（D8-1）：控制項的值 → `p.*` → 解回控制項的值。
 * 重點：與 `/embed` 同一份契約（overlay out key＋編碼數字）、共用值只寫一次、預設不寫、
 * 上鎖或未開的圖層不套用、壞值安靜略過。
 */
import { describe, expect, it } from "vitest";
import { buildUrl, parseUrlState } from "../urlState";
import { layerParamsForUrl, resolveUrlLayerParams } from "../urlLayerParams";
import { buildDefaultParams } from "../../state/layerParamsStore";
import { MAPCHALLENGE_DAY08_SCENARIO_ENCODE, MAPCHALLENGE_DAY08_SPEED_ENCODE } from "../../data/mapchallengeDay08Types";
import { MULTI_SELECT_ALL, serializeMultiSelectValues, getParamsSpec, type LayerParamValues } from "../../data/layerParamsSpec";

const ACCESS = "mapchallengeDay08Access";
const SITES = "mapchallengeDay08Sites";
const PARKS = "mapchallengeDay08Parks";

function withValues(overrides: Record<string, Record<string, unknown>>) {
  const all = { ...buildDefaultParams() } as Record<string, LayerParamValues>;
  for (const [key, values] of Object.entries(overrides)) all[key] = { ...all[key], ...values } as LayerParamValues;
  return all;
}

const scenario = MAPCHALLENGE_DAY08_SCENARIO_ENCODE[MAPCHALLENGE_DAY08_SCENARIO_ENCODE.length - 1]!;
const speed = MAPCHALLENGE_DAY08_SPEED_ENCODE.find((value) => value !== "normal")!;

describe("layerParamsForUrl — 寫入", () => {
  it("全部預設時不寫 p.*", () => {
    expect(layerParamsForUrl([ACCESS, SITES], buildDefaultParams())).toBeUndefined();
  });

  it("Day 8 方案＋步速：寫 out key 與編碼索引；共用的方案只出現一次", () => {
    const all = withValues({
      [ACCESS]: { mapchallengeDay08Scenario: scenario, mapchallengeDay08AccessSpeed: speed },
      [SITES]: { mapchallengeDay08Scenario: scenario },
    });
    expect(layerParamsForUrl([ACCESS, SITES], all)).toEqual({
      mapchallengeDay08ScenarioIdx: MAPCHALLENGE_DAY08_SCENARIO_ENCODE.indexOf(scenario),
      mapchallengeDay08AccessSpeedIdx: MAPCHALLENGE_DAY08_SPEED_ENCODE.indexOf(speed),
    });
  });

  it("只看傳入的圖層（關著或不可公開的圖層由呼叫端排除）", () => {
    const all = withValues({ [ACCESS]: { mapchallengeDay08AccessOpacity: 0.4 } });
    expect(layerParamsForUrl([SITES], all)).toBeUndefined();
  });

  it("defaultOf 覆寫預設：等於覆寫值時不寫", () => {
    const all = withValues({ [ACCESS]: { mapchallengeDay08AccessOpacity: 0.75 } });
    expect(layerParamsForUrl([ACCESS], all, (_, spec) => (spec.name === "mapchallengeDay08AccessOpacity" ? 0.75 : undefined))).toBeUndefined();
    expect(layerParamsForUrl([ACCESS], all)).toEqual({ mapchallengeDay08AccessOpacity: 0.75 });
  });

  it("多選寫 bitmask", () => {
    const options = (getParamsSpec(PARKS)!.find((s) => s.kind === "multiSelect") as { options: { value: string }[] }).options;
    const all = withValues({ [PARKS]: { mapchallengeDay08ParksCategory: serializeMultiSelectValues([options[1]!.value]) } });
    expect(layerParamsForUrl([PARKS], all)).toEqual({ mapchallengeDay08ParksCategoryMask: 2 });
  });
});

describe("resolveUrlLayerParams — 讀回", () => {
  it("網址往返：buildUrl → parseUrlState → 解回同樣的值", () => {
    const all = withValues({
      [ACCESS]: { mapchallengeDay08Scenario: scenario, mapchallengeDay08AccessSpeed: speed, mapchallengeDay08AccessOpacity: 0.45 },
      [SITES]: { mapchallengeDay08Scenario: scenario },
    });
    const url = buildUrl({ layers: [ACCESS, SITES] as never, params: layerParamsForUrl([ACCESS, SITES], all) }, "/");
    const parsed = parseUrlState(url.slice(1));
    const writes = resolveUrlLayerParams(parsed.params, parsed.layers ?? [], buildDefaultParams());
    expect(writes).toEqual(expect.arrayContaining([
      { key: ACCESS, name: "mapchallengeDay08AccessOpacity", value: 0.45 },
      { key: ACCESS, name: "mapchallengeDay08Scenario", value: scenario },
      { key: ACCESS, name: "mapchallengeDay08AccessSpeed", value: speed },
      { key: SITES, name: "mapchallengeDay08Scenario", value: scenario },
    ]));
  });

  it("不在允許清單（網址沒開或對看的人上鎖）的圖層不套用", () => {
    const params = { mapchallengeDay08AccessOpacity: 0.45 };
    expect(resolveUrlLayerParams(params, [SITES], buildDefaultParams())).toEqual([]);
  });

  it("越界、索引錯位、非 0/1 的值安靜略過", () => {
    const params = { mapchallengeDay08AccessOpacity: 5, mapchallengeDay08ScenarioIdx: 99, mapchallengeDay08AccessSpeedIdx: 0.5 };
    expect(resolveUrlLayerParams(params, [ACCESS], buildDefaultParams())).toEqual([]);
  });

  it("多選 bitmask 全選解回 __all__，超出位元數略過", () => {
    const options = (getParamsSpec(PARKS)!.find((s) => s.kind === "multiSelect") as { options: unknown[] }).options;
    const full = 2 ** options.length - 1;
    expect(resolveUrlLayerParams({ mapchallengeDay08ParksCategoryMask: full }, [PARKS], buildDefaultParams()))
      .toEqual([{ key: PARKS, name: "mapchallengeDay08ParksCategory", value: MULTI_SELECT_ALL }]);
    expect(resolveUrlLayerParams({ mapchallengeDay08ParksCategoryMask: full + 1 }, [PARKS], buildDefaultParams())).toEqual([]);
  });
});

describe("urlState — sel=（單地圖統計期別）", () => {
  it("往返；中文值與分隔字元以外的字都保留", () => {
    const selection = { statsDemographicsTownshipPopulationTotal: { Period: "2024-12", DimSex: "女" } };
    const url = buildUrl({ selection }, "/");
    expect(parseUrlState(url.slice(1)).selection).toEqual(selection);
  });

  it("壞掉的項目逐一略過", () => {
    expect(parseUrlState("?v=1&sel=bad,ok:Period=2024").selection).toEqual({ ok: { Period: "2024" } });
    expect(parseUrlState("?v=1&sel=:::").selection).toBeUndefined();
  });
});
