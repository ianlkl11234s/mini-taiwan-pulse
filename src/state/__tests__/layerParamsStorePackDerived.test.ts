/**
 * 國家包晚到的圖層：派生控件（點／面樣式、類別多選…）的參數名稱也要進 layerParamsStore 快照，
 * 否則 setParam 因「不在快照」而靜默拒收（Codex review PR #1247 r4687788367）。
 */
import { describe, it, expect } from "vitest";
import { extendRecord } from "../../countries/slots";
import { JP_PACK_PARAMS } from "../../countries/jp/params";
import { LAYER_PARAMS_SPEC, type LayerParamSpec } from "../../data/layerParamsSpec";
import { layerParamsStore } from "../layerParamsStore";

describe("國家包規格晚到", () => {
  it("派生控件（displayMode）進快照且可 setParam", () => {
    const key = "jpNaturalParkAreas2015";
    extendRecord("layerParamsSpec", { [key]: JP_PACK_PARAMS[key as keyof typeof JP_PACK_PARAMS] });
    const derived = (LAYER_PARAMS_SPEC as Record<string, LayerParamSpec[]>)[key]!.find((s) => s.name === `${key}DisplayMode`);
    expect(derived, "登記簿應已含派生的樣式控件").toBeTruthy();
    const snap = layerParamsStore.getParams(key);
    expect(Object.keys(snap)).toContain(`${key}DisplayMode`);
    layerParamsStore.setParam(key, `${key}DisplayMode`, "point");
    expect(layerParamsStore.getParam(key, `${key}DisplayMode`)).toBe("point");
  });
});
