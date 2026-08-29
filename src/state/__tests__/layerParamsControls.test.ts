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
import type { SelectConfig, SliderConfig, ToggleConfig } from "../layerParamsControls";
import {
  MULTI_SELECT_ALL, MULTI_SELECT_NONE, encodeMultiSelectBitmask, resolveMultiSelectValues, serializeMultiSelectValues,
} from "../../data/layerParamsSpec";

beforeEach(() => layerParamsStore.reset());

describe("buildParamControls", () => {
  it("multiSelect 值採 scalar 編碼，支援預設全選、全關與穩定排序", () => {
    const options = [{ label: "甲", value: "a" }, { label: "乙", value: "b" }, { label: "丙", value: "c" }];
    expect(resolveMultiSelectValues(MULTI_SELECT_ALL, options)).toEqual(["a", "b", "c"]);
    expect(resolveMultiSelectValues(MULTI_SELECT_NONE, options)).toEqual([]);
    expect(serializeMultiSelectValues(["c", "a", "c"])).toBe('["a","c"]');
    expect(resolveMultiSelectValues('["c","a","unknown"]', options)).toEqual(["a", "c"]);
    expect(encodeMultiSelectBitmask(MULTI_SELECT_ALL, options)).toBe(7);
    expect(encodeMultiSelectBitmask('["a","c"]', options)).toBe(5);
  });

  it("宗教主祀多選預設全選，並編成 Mapbox filter 使用的 bitmask", () => {
    const control = (buildParamControls("religionTemples") ?? [])[0] as import("../layerParamsControls").MultiSelectConfig;
    expect(control).toMatchObject({ type: "multiSelect", label: "主祀類別", value: expect.any(Array) });
    expect(control.value).toHaveLength(9);
    expect(encodeParamsToOverlay(layerParamsStore.getAll())["religionTemplesDeityMask"]).toBe(511);

    control.onSelectNone();
    expect(encodeParamsToOverlay(layerParamsStore.getAll())["religionTemplesDeityMask"]).toBe(0);
  });

  it("可並存分類預設全開，並以穩定 bitmask 傳給 renderer", () => {
    const river = (buildParamControls("riversideTreesTaipei") ?? [])[0] as import("../layerParamsControls").MultiSelectConfig;
    expect(river).toMatchObject({ type: "multiSelect", label: "河濱公園" });
    expect(river.value).toHaveLength(30);
    expect(encodeParamsToOverlay(layerParamsStore.getAll())["riversideTreesTaipeiParkMask"])
      .toBe(1073741823);

    river.onSelectNone();
    expect(encodeParamsToOverlay(layerParamsStore.getAll())["riversideTreesTaipeiParkMask"])
      .toBe(0);
  });

  it("市區公車區域多選預設只有雙北，且不進 overlayParams", () => {
    const control = (buildParamControls("busLive") ?? [])[0] as import("../layerParamsControls").MultiSelectConfig;
    expect(control).toMatchObject({
      type: "multiSelect", label: "服務區域", value: ["TaipeiMetro"],
    });
    expect(encodeParamsToOverlay(layerParamsStore.getAll()).busGroups).toBeUndefined();

    control.onSelectAll();
    expect((buildParamControls("busLive") ?? [])[0]).toMatchObject({
      value: [
        "TaipeiMetro", "KeelungYilan", "TaoyuanHsinchuMiaoli", "CentralTaiwan",
        "YunChiaNan", "Kaoping", "HualienTaitung", "OffshoreIslands",
      ],
    });
  });

  // ⚠️ 這裡的「未遷移 key」刻意取 `aqiStations`（manifest 宣告 `params: null`
  //    的 12 個之一）—— 規格檔沒有「宣告了但空陣列」這種形狀，所以它**永遠**
  //    不會被遷走。原本寫的是 `cctv`，P3-2C 把它搬走後這三條就紅了。
  it("未遷移的 key 回 null（呼叫端 `?? []`，等同 Phase 4 前的 switch default）", () => {
    expect(buildParamControls("aqiStations")).toBeNull();
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

  // ── P3-2C 補：labelSuffix ＋ 整數內插（digits 0）在**非預設值**下的字串 ──
  // 快照凍結的是預設值那一格（`保留 10 min` / `Z 漂浮 0px`），驗不到
  // 「`digits: 0` 是不是真的等於原文的 `${x}`（無 toFixed）」。
  it("labelSuffix 與整數內插：拖到非預設值時字串仍逐字相同", () => {
    const min = (buildParamControls("lightning") ?? [])[0] as SliderConfig;
    expect(min.label).toBe("保留 10 min");
    min.onChange(45);
    expect((buildParamControls("lightning") ?? [])[0]).toMatchObject({ label: "保留 45 min" });
    // overlayParams 拿到的是原值（不是字串、也沒有被 toFixed 影響）
    expect(encodeParamsToOverlay(layerParamsStore.getAll())["lightningMinutes"]).toBe(45);

    const z = (buildParamControls("cctv") ?? [])[2] as SliderConfig;
    expect(z.label).toBe("Z 漂浮 0px");
    z.onChange(24);
    expect((buildParamControls("cctv") ?? [])[2]).toMatchObject({ label: "Z 漂浮 24px" });
  });

  // ── P3-2C 補：encodeNumeric 在**非預設值**下才與索引編碼分岔 ──────
  // `floodMinDepth` 預設 "0" 時 `Number("0") === indexOf("0") === 0`，
  // 黃金快照兩種編碼都過。抄成 `encode` 版的話「≥0.5m」會餵 1（＝ ≥1m 的意思）
  // 給 paint —— 篩選整個錯掉，畫面照樣有東西、沒有任何錯誤訊息。
  it("encodeNumeric：out 是值本身而不是選項索引", () => {
    const sel = (buildParamControls("waterFloodExtreme") ?? [])[1] as SelectConfig;
    expect(sel.value).toBe("0");
    expect(encodeParamsToOverlay(layerParamsStore.getAll())["floodMinDepth"]).toBe(0);

    sel.onChange("0.5");
    // 索引版會是 1（"0.5" 是第 1 個選項）—— 這一條就是兩者的分岔點
    expect(encodeParamsToOverlay(layerParamsStore.getAll())["floodMinDepth"]).toBe(0.5);

    // 同一個 key 裡兩種編碼並存：policeIso 的 mode 走 encode、minutes 走 encodeNumeric
    const mode = (buildParamControls("policeIsoSubstation") ?? [])[0] as SelectConfig;
    const mins = (buildParamControls("policeIsoSubstation") ?? [])[1] as SelectConfig;
    mode.onChange("drive");
    mins.onChange("10");
    const out = encodeParamsToOverlay(layerParamsStore.getAll());
    expect(out["policeIsoSubstationMode_drive"]).toBe(1);
    expect(out["policeIsoSubstationMinutes_num"], "分鐘要是 10 不是索引 1").toBe(10);
  });

  // ── P3-2C 補：zeroLabel ／ labelSep ／ labelByValue 的非預設分支 ────
  it("zeroLabel：0 印「關」，離開 0 就恢復印數字", () => {
    const s = (buildParamControls("powerPoles") ?? [])[0] as SliderConfig;
    expect(s.label).toBe("全台顯示 關");
    s.onChange(0.5);
    expect((buildParamControls("powerPoles") ?? [])[0]).toMatchObject({ label: "全台顯示 0.50" });
    // 回到 0 要回到「關」（不是停在 "0.00"）
    ((buildParamControls("powerPoles") ?? [])[0] as SliderConfig).onChange(0);
    expect((buildParamControls("powerPoles") ?? [])[0]).toMatchObject({ label: "全台顯示 關" });
  });

  it("labelSep：前綴與數字之間不補空白", () => {
    const s = (buildParamControls("facPrimary") ?? [])[1] as SliderConfig;
    expect(s.label).toBe("大廠（即時）1.30");
    // 對照組：同一個 key 的其他 slider 仍補空白
    expect((buildParamControls("facPrimary") ?? [])[0]).toMatchObject({ label: "總大小 0.5" });
  });

  it("labelByValue：select 的 label 隨自己的值變（顯示表 ≠ 選項表）", () => {
    const sel = (buildParamControls("livestockFarmPig") ?? [])[2] as SelectConfig;
    expect(sel.label).toBe("品項 全部");
    sel.onChange("1");
    expect((buildParamControls("livestockFarmPig") ?? [])[2]).toMatchObject({ label: "品項 肉豬" });

    // 作物層：label 只有 nameZh，選項是 `${nameZh} (${nameEn})` —— 兩者刻意不同
    const crop = (buildParamControls("agriCropSuitability") ?? [])[1] as SelectConfig;
    expect(crop.label).toBe("作物 芋");
    expect(crop.options[1]).toMatchObject({ label: "蘋果 (apple)", value: "1" });
    crop.onChange("11");
    const after = (buildParamControls("agriCropSuitability") ?? [])[1] as SelectConfig;
    expect(after.label).toBe("作物 香蕉");
    expect(encodeParamsToOverlay(layerParamsStore.getAll())["agriCropSuitabilityCropId"]).toBe(11);
  });

  // ── P3-2C 補：showWhen ／ disableRule 的「展開後」分支 ──────────────
  // 黃金快照只跑預設值 → 條件式控件在快照裡**永遠是收合的**。
  // 少了這幾條，`showWhen` 寫錯條件（永遠展不開）不會有任何閘紅。
  it("showWhen：條件成立時控件才出現，且順序不變", () => {
    const before = buildParamControls("propertyValueGrid") ?? [];
    expect(before).toHaveLength(4);

    (before[3] as ToggleConfig).onChange(true);
    const after = buildParamControls("propertyValueGrid") ?? [];
    expect(after, "3D 打開後對比／高度兩個控件要出現").toHaveLength(6);
    expect(after[4]).toMatchObject({ label: "對比 Contrast 1.8" });
    expect(after[5]).toMatchObject({ label: "整體高度 Height 40" });

    (after[3] as ToggleConfig).onChange(false);
    expect(buildParamControls("propertyValueGrid") ?? []).toHaveLength(4);
  });

  it("showWhen：select 值觸發的條件（buildingsGba 夜景模式才有 Bloom 門檻）", () => {
    expect(buildParamControls("buildingsGba") ?? []).toHaveLength(3);
    ((buildParamControls("buildingsGba") ?? [])[0] as SelectConfig).onChange("3");
    const after = buildParamControls("buildingsGba") ?? [];
    expect(after).toHaveLength(4);
    expect(after[3]).toMatchObject({ label: "Bloom 高樓門檻 ≥ 100 m" });
    // 非夜景模式（"4" 估值）就要收回去
    (after[0] as SelectConfig).onChange("4");
    expect(buildParamControls("buildingsGba") ?? []).toHaveLength(3);
  });

  it("showWhen：收合中的控件其值照樣進 overlayParams", () => {
    // 預設 3D 關閉 → 對比／高度收合，但 paint 端仍讀得到（手寫版是無條件寫入字面）
    expect(buildParamControls("propertyValueGrid") ?? []).toHaveLength(4);
    const out = encodeParamsToOverlay(layerParamsStore.getAll());
    expect(out["propertyValueGridContrast"]).toBe(1.8);
    expect(out["propertyValueGridElevationScale"]).toBe(40);
  });

  it("disableRule：150m 尺度停用人均市值並在 label 講明，換尺度就解除", () => {
    const mode = () => (buildParamControls("propertyValueGrid") ?? [])[1] as SelectConfig;
    // 預設 scaleIdx "0"（150m，無 pop）→ 人均選項停用 ＋ 原因後綴
    expect(mode().options[0]).toMatchObject({ label: "總市值", value: "0", disabled: false });
    expect(mode().options[1]).toMatchObject({
      label: "人均市值（僅 450m / 1.5km 提供）", value: "1", disabled: true,
    });

    // 換到 450m（hasPop）→ 解除停用、label 回到原字串（快照看不到這一面）
    ((buildParamControls("propertyValueGrid") ?? [])[0] as SelectConfig).onChange("1");
    expect(mode().options[1]).toMatchObject({ label: "人均市值", value: "1", disabled: false });
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
