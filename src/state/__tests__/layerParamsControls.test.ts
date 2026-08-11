/**
 * 通用渲染器 buildParamControls 的行為測試（AR-22 P3-1）
 *
 * ⚠️ 本檔補的是**黃金快照的結構性盲區**：快照凍結的是「預設值下跑一次
 * getControls 得到什麼」，它驗不到「拖了之後有沒有反應」。
 * 手寫 case 的 onChange 是 `setXxx`（React state），遷移後變成
 * `store.setParam` —— 這條路徑斷掉的話快照照樣全綠，畫面卻毫無反應。
 */
import { describe, it, expect, beforeEach } from "vitest";

import { buildParamControls } from "../layerParamsControls";
import { layerParamsStore, encodeParamsToOverlay } from "../layerParamsStore";
import type { SelectConfig, SliderConfig } from "../../hooks/useTransportParams";

beforeEach(() => layerParamsStore.reset());

describe("buildParamControls", () => {
  it("未遷移的 key 回 null（呼叫端據此 fallthrough 到既有 switch）", () => {
    expect(buildParamControls("cctv")).toBeNull();
    expect(buildParamControls("religionTemples")).not.toBeNull();
  });

  it("slider 不帶 type 欄位 —— 多一個 type:'slider' 黃金快照就紅", () => {
    const list = buildParamControls("cemeteryOsm") ?? [];
    expect(list).toHaveLength(1);
    expect(Object.keys(list[0] as object).sort())
      .toEqual(["label", "max", "min", "onChange", "step", "value"]);
  });

  it("slider onChange 寫回 store，label 隨新值重算（toFixed 位數不變）", () => {
    const before = (buildParamControls("religionTemples") ?? [])[2] as SliderConfig;
    expect(before.label).toBe("透明度 0.80");
    before.onChange(0.5);
    expect(layerParamsStore.getParam("religionTemples", "religionTemplesOpacity")).toBe(0.5);

    const after = (buildParamControls("religionTemples") ?? [])[2] as SliderConfig;
    expect(after.label).toBe("透明度 0.50");
    expect(after.value).toBe(0.5);
  });

  it("select onChange 寫回 store，且 overlayParams 的 Idx 跟著動", () => {
    const sel = (buildParamControls("funeralOperators") ?? [])[0] as SelectConfig;
    expect(sel.value).toBe("active");
    expect(encodeParamsToOverlay(layerParamsStore.getAll())["funeralOperatorsStatusIdx"]).toBe(0);

    sel.onChange("inactive");
    expect((buildParamControls("funeralOperators") ?? [])[0]).toMatchObject({ value: "inactive" });
    expect(encodeParamsToOverlay(layerParamsStore.getAll())["funeralOperatorsStatusIdx"]).toBe(1);
  });

  it("傳入的 values 快照優先於 store 現值（避免 useSyncExternalStore tearing）", () => {
    layerParamsStore.setParam("cemeteryOsm", "cemeteryOsmOpacity", 0.9);
    const stale = buildParamControls("cemeteryOsm", { cemeteryOsmOpacity: 0.45 }) ?? [];
    expect((stale[0] as SliderConfig).value).toBe(0.45);
  });
});
