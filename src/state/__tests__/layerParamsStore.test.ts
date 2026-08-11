/**
 * layerParamsStore 契約測試（AR-22 P3-1）
 *
 * 兩件事必須被釘住：
 *   1. **spec ⇄ manifest 的焊接** —— 完整規格住在 `layerParamsSpec.ts`，
 *      形狀（count / kinds）的 SSOT 仍是 `layerManifest.ts` 的 `params` 欄位。
 *      兩處對不上就是漂移，紅。
 *   2. **store 的 identity 紀律** —— `useSyncExternalStore` 的硬性要求：
 *      同值寫入不得換 snapshot identity（否則無限迴圈 / 空轉 re-render）。
 */
import { describe, it, expect, beforeEach } from "vitest";

import {
  LAYER_PARAMS_SPEC, MIGRATED_PARAMS_KEYS, getParamsSpec, isMigratedParamsKey,
  specOutKey, type LayerParamSpec,
} from "../../data/layerParamsSpec";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { layerParamsStore, encodeParamsToOverlay, buildDefaultParams } from "../layerParamsStore";

const specs = MIGRATED_PARAMS_KEYS.map(
  (k) => [k, LAYER_PARAMS_SPEC[k] as LayerParamSpec[]] as const,
);

beforeEach(() => layerParamsStore.reset());

describe("spec ⇄ manifest 焊接", () => {
  it("每個已遷移 key 的 count / kinds ＝ manifest 宣告", () => {
    for (const [key, spec] of specs) {
      const declared = LAYER_MANIFEST[key].params;
      expect(declared, `${key} 在 manifest 的 params 是 null，但已遷移進 spec`).not.toBeNull();
      expect(spec.length, `${key} 控件數`).toBe(declared?.count);
      expect(spec.map((s) => s.kind), `${key} 控件型別序列`).toEqual(declared?.kinds);
    }
  });

  it("參數名與 overlayParams out key 全域唯一（共用 slot 先收斂成一份）", () => {
    // 共用 slot（`sharedGroup`）的成員**刻意**宣告同名 name / out —— 那是
    // fall-through 共用一個 useState 的表達，先依 slot 收斂成一個代表再驗唯一。
    // 「撞名但沒宣告 sharedGroup」由 layerParamsSharedState.test.ts 專門擋。
    const bySlot = new Map<string, LayerParamSpec>();
    for (const [key, spec] of specs) {
      for (const s of spec) {
        const slot = s.sharedGroup ?? `${key}.${s.name}`;
        if (!bySlot.has(slot)) bySlot.set(slot, s);
      }
    }
    const names = [...bySlot.values()].map((s) => s.name);
    const outs = [...bySlot.values()].map((s) => specOutKey(s));
    expect(new Set(names).size, "參數名撞名").toBe(names.length);
    expect(new Set(outs).size, "overlayParams key 撞名").toBe(outs.length);
  });

  it("select 的 default 一定在 encode 裡（否則 idx 起手就是 -1）", () => {
    for (const [key, spec] of specs) {
      for (const s of spec) {
        if (s.kind !== "select") continue;
        // 數值型 select（`encodeNumeric`）沒有 encode 表 —— 它的等價要求是
        // 「default 轉得成數字」，轉不成會讓 overlayParams 收到 NaN，
        // paint 端不會報錯、只會整層畫不出來（同一類靜默失效）。
        if (s.encodeNumeric) {
          expect(
            Number.isFinite(Number(s.default)),
            `${key}.${s.name} 宣告 encodeNumeric，但 default "${s.default}" 轉不成有限數字`,
          ).toBe(true);
          continue;
        }
        expect(s.encode, `${key}.${s.name} default "${s.default}" 不在 encode`)
          .toContain(s.default);
      }
    }
  });

  it("select 的 options.value 與編碼方式相容（encode 表／可轉數字二選一）", () => {
    for (const [key, spec] of specs) {
      for (const s of spec) {
        if (s.kind !== "select") continue;
        for (const o of s.options) {
          const ok = s.encodeNumeric
            ? Number.isFinite(Number(o.value))
            : s.encode.includes(o.value);
          expect(ok, `${key}.${s.name} 的選項 "${o.value}" 編不出有效值`).toBe(true);
        }
      }
    }
  });

  // ⚠️ 取 `aqiStations`（emptyByDesign，`case "x": return []`）當「未遷移」的例子：
  //    規格檔沒有「宣告了但空陣列」這種形狀 → 它永遠不會被遷走，本斷言不會隨
  //    遷移進度過時。原本用的 `cctv` 已於 P3-2C 遷出。
  it("isMigratedParamsKey / getParamsSpec 對未遷移 key 回 false / null", () => {
    expect(isMigratedParamsKey("aqiStations")).toBe(false);
    expect(getParamsSpec("aqiStations")).toBeNull();
    expect(layerParamsStore.getParams("aqiStations")).toEqual({});
  });
});

describe("store identity 紀律", () => {
  it("同值寫入不換 snapshot identity、不通知", () => {
    const before = layerParamsStore.getAll();
    let hits = 0;
    const off = layerParamsStore.subscribeKey("cemeteryOsm", () => { hits++; });
    layerParamsStore.setParam("cemeteryOsm", "cemeteryOsmOpacity", 0.45);
    expect(layerParamsStore.getAll()).toBe(before);
    expect(hits).toBe(0);
    off();
  });

  it("異值寫入只換該 key 的內層 identity，其他 key 原封不動", () => {
    const before = layerParamsStore.getAll();
    const otherBefore = before["religionTemples"];
    layerParamsStore.setParam("cemeteryOsm", "cemeteryOsmOpacity", 0.9);
    const after = layerParamsStore.getAll();
    expect(after).not.toBe(before);
    expect(after["religionTemples"]).toBe(otherBefore);
    expect(after["cemeteryOsm"]).not.toBe(before["cemeteryOsm"]);
    expect(layerParamsStore.getParam("cemeteryOsm", "cemeteryOsmOpacity")).toBe(0.9);
  });

  it("per-key 訂閱只被自己的 key 觸發", () => {
    let mine = 0;
    let other = 0;
    const a = layerParamsStore.subscribeKey("cemeteryOsm", () => { mine++; });
    const b = layerParamsStore.subscribeKey("cemeteryZoning", () => { other++; });
    layerParamsStore.setParam("cemeteryOsm", "cemeteryOsmOpacity", 0.9);
    expect(mine).toBe(1);
    expect(other).toBe(0);
    a(); b();
  });

  it("規格外的 (key, name) 一律忽略，不長出新參數", () => {
    const before = layerParamsStore.getAll();
    layerParamsStore.setParam("cemeteryOsm", "notAParam", 1);
    layerParamsStore.setParam("aqiStations", "aqiStationsOpacity", 1);
    expect(layerParamsStore.getAll()).toBe(before);
  });

  it("reset 回到 buildDefaultParams", () => {
    layerParamsStore.setParam("cemeteryOsm", "cemeteryOsmOpacity", 0.9);
    layerParamsStore.reset();
    expect(layerParamsStore.getAll()).toEqual(buildDefaultParams());
  });
});

describe("overlayParams 編碼", () => {
  it("slider 原值、select 走 encode 的 idx", () => {
    const out = encodeParamsToOverlay(layerParamsStore.getAll());
    expect(out["cemeteryOsmOpacity"]).toBe(0.45);
    expect(out["religionTemplesDeityIdx"]).toBe(0);
    // funeralOperators 預設 "active" ＝ OPERATOR_STATUS_MODES 的第 0 位
    expect(out["funeralOperatorsStatusIdx"]).toBe(0);
    layerParamsStore.setParam("funeralOperators", "funeralOperatorsStatus", "all");
    expect(encodeParamsToOverlay(layerParamsStore.getAll())["funeralOperatorsStatusIdx"]).toBe(2);
  });

  it("值全部是數字（overlayParams 的契約）", () => {
    for (const v of Object.values(encodeParamsToOverlay(layerParamsStore.getAll()))) {
      expect(typeof v).toBe("number");
    }
  });
});
