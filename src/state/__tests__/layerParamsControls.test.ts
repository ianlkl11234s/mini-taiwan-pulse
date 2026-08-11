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
import type { SelectConfig, SliderConfig, ToggleConfig } from "../../hooks/useTransportParams";

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

  // ── P3-2B 補：toggle 的 0/1 中介第一次有真實使用者 ────────────────
  it("toggle onChange 寫回 store，overlayParams 編成 0/1", () => {
    const tog = (buildParamControls("realEstateRentalGrid") ?? [])[1] as ToggleConfig;
    expect(tog.value).toBe(false);
    expect(encodeParamsToOverlay(layerParamsStore.getAll())["realEstateExcludeTaipei"]).toBe(0);

    tog.onChange(true);
    expect((buildParamControls("realEstateRentalGrid") ?? [])[1]).toMatchObject({ value: true });
    expect(encodeParamsToOverlay(layerParamsStore.getAll())["realEstateExcludeTaipei"]).toBe(1);
  });

  // ── P3-2B 補：prepend 型 select 在**非預設值**下的 idx ─────────────
  // 預設值下 idx 恆為 0，黃金快照驗不到「["all", ...] 整體位移 1」抄錯的情形。
  it("prepend 型 select 換到非預設值時 idx 有位移", () => {
    const sel = (buildParamControls("mountainRescueIncidents") ?? [])[0] as SelectConfig;
    expect(sel.value).toBe("all");
    sel.onChange("2021");
    // encode = ["all", 2019, 2020, 2021, …] → "2021" 是第 3 位
    expect(encodeParamsToOverlay(layerParamsStore.getAll())["mountainRescueIncidentsYearIdx"]).toBe(3);
  });

  // ── P3-2B 補：共用 slot 的端對端行為（面板 A 拖動，面板 B 跟著動）──
  it("共用 slot：一個 key 的 onChange 會同步到同群其他 key 的控件與 overlayParams", () => {
    const a = (buildParamControls("eduKindergarten") ?? [])[0] as SliderConfig;
    expect(a.label).toBe("透明度 0.85");
    a.onChange(0.4);

    for (const key of ["eduKindergarten", "eduAfterschoolCare", "eduMutualCare"]) {
      const ctl = (buildParamControls(key) ?? [])[0] as SliderConfig;
      expect(ctl.value, `${key} 的面板沒跟著動`).toBe(0.4);
      expect(ctl.label).toBe("透明度 0.40");
    }
    expect(encodeParamsToOverlay(layerParamsStore.getAll())["eduChildcareOpacity"]).toBe(0.4);
  });

  it("共用 slot：同群每個成員 key 的訂閱者都會被通知", () => {
    const hits: Record<string, number> = { eduKindergarten: 0, eduAfterschoolCare: 0, cemeteryOsm: 0 };
    const offs = Object.keys(hits).map((k) =>
      layerParamsStore.subscribeKey(k, () => { hits[k] = (hits[k] ?? 0) + 1; }));
    layerParamsStore.setParam("eduKindergarten", "eduChildcareOpacity", 0.4);
    expect(hits["eduKindergarten"]).toBe(1);
    expect(hits["eduAfterschoolCare"], "夥伴 key 的訂閱者沒被通知 → 未來元件會拿到過期值").toBe(1);
    expect(hits["cemeteryOsm"]).toBe(0);
    offs.forEach((off) => off());
  });
});
