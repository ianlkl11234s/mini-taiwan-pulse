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
  specOutKey, visibleParamsSpec, type LayerParamSpec,
} from "../../data/layerParamsSpec";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { PENALTY_YEAR_MIN, PENALTY_YEAR_MAX } from "../../data/pollutionTypes";
import { layerParamsStore, encodeParamsToOverlay, buildDefaultParams } from "../layerParamsStore";

const specs = MIGRATED_PARAMS_KEYS.map(
  (k) => [k, LAYER_PARAMS_SPEC[k] as LayerParamSpec[]] as const,
);

beforeEach(() => layerParamsStore.reset());

describe("spec ⇄ manifest 焊接", () => {
  // ⚠️ 比的是「**預設值下**渲染得出來的控件」而不是 `spec.length` ——
  //    manifest 的 count 是 Phase 1 從實跑 getControls 抽的，本來就只看得到
  //    預設分支（`propertyValueGrid` 記 4，它的 6 個宣告有 2 個掛 `showWhen`）。
  //    判斷邏輯與渲染器共用 `visibleParamsSpec`，各寫一份必漂移。
  it("每個已遷移 key 的 count / kinds ＝ manifest 宣告（預設值下可見的控件）", () => {
    const defaults = buildDefaultParams();
    for (const [key, spec] of specs) {
      const declared = LAYER_MANIFEST[key].params;
      expect(declared, `${key} 在 manifest 的 params 是 null，但已遷移進 spec`).not.toBeNull();
      const visible = visibleParamsSpec(spec, defaults[key] ?? {});
      expect(visible.length, `${key} 控件數`).toBe(declared?.count);
      expect(visible.map((s) => s.kind), `${key} 控件型別序列`).toEqual(declared?.kinds);
    }
  });

  it("showWhen 只准參照同一個 key 自己的參數（跨 key 條件會讓焊接失效）", () => {
    for (const [key, spec] of specs) {
      const own = new Set(spec.map((s) => s.name));
      for (const s of spec) {
        if (!s.showWhen) continue;
        expect(own.has(s.showWhen.param), `${key}.${s.name} 的 showWhen 指向外部參數 "${s.showWhen.param}"`)
          .toBe(true);
      }
    }
  });

  it("條件式控件的值照樣進 overlayParams（隱藏 ≠ 不編碼）", () => {
    const out = encodeParamsToOverlay(layerParamsStore.getAll());
    // 預設 propertyValueGridExtruded=false → 兩個控件收合，但手寫版無條件把值
    // 寫進 overlayParams 字面 —— 少了它們 overlays section 的 paint 求值會缺欄位
    expect(out["propertyValueGridContrast"]).toBe(1.8);
    expect(out["propertyValueGridElevationScale"]).toBe(40);
    // 預設 buildingsGbaModeIdx="0"（非夜景）→ Bloom 門檻收合，值仍在
    expect(out["buildingsGbaBloomMinHeight"]).toBe(100);
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
    // `out: null` 的參數不進 overlayParams（第二通道）→ 不參與 out key 的唯一性；
    // 它們的「唯一性」由 name 那一條與 RETURN_CHANNEL 的路徑宣告負責。
    const outs = [...bySlot.values()].map((s) => specOutKey(s)).filter((o) => o !== null);
    expect(new Set(names).size, "參數名撞名").toBe(names.length);
    expect(new Set(outs).size, "overlayParams key 撞名").toBe(outs.length);
  });

  it("select 的 default 一定在 encode 裡（否則 idx 起手就是 -1）", () => {
    for (const [key, spec] of specs) {
      for (const s of spec) {
        if (s.kind !== "select") continue;
        // 第二通道 select（`out: null`）不進 overlayParams → 沒有編碼可言，兩欄都沒宣告。
        if (s.out === null) continue;
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
        if (s.out === null) continue;   // 第二通道 select：不編碼
        for (const o of s.options) {
          const ok = s.encodeNumeric
            ? Number.isFinite(Number(o.value))
            : s.encode.includes(o.value);
          expect(ok, `${key}.${s.name} 的選項 "${o.value}" 編不出有效值`).toBe(true);
        }
      }
    }
  });

  // ⚠️ 取 `aqiStations`（manifest 宣告 params: null 的 12 個之一）當「未遷移」的例子：
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

describe("級聯寫入 cascade（P3-2D 群4）", () => {
  const PENALTY = "pollutionPenaltyCritical";

  it("換大類 → 細項重設成新表的第一項（三兄弟同一個機制）", () => {
    layerParamsStore.setParam("indicators", "indCategory", "burden");
    expect(layerParamsStore.getParam("indicators", "indMetric")).toBe("dr");
    layerParamsStore.setParam("socioeconomic", "socioCat", "social");
    expect(layerParamsStore.getParam("socioeconomic", "socioMetric")).toBe("vs");
  });

  it("級聯目標會展開共用 slot（裁處事件三層都要被寫到）", () => {
    layerParamsStore.setParam(PENALTY, "pollutionPenaltyPlaying", true);
    for (const k of ["pollutionPenaltyCritical", "pollutionPenaltyGeneral", "pollutionPenaltyMobile"]) {
      expect(layerParamsStore.getParam(k, "pollutionPenaltyYear"), `${k} 沒被級聯寫到`)
        .toBe(String(PENALTY_YEAR_MIN));
    }
  });

  // ⚠️ 這一條擋的是「cascade 遞迴」：按播放（年份在最後一年）→ 倒帶回起始年，
  //    若倒帶那一寫又觸發**年份自己的** cascade（一動就停播放），播放鍵直接壞掉
  //    ——按下去會立刻彈回停止。手寫版是直接呼叫 state setter，不經 onChange。
  it("級聯只展開一層：倒帶不會反過來把播放關掉", () => {
    expect(layerParamsStore.getParam(PENALTY, "pollutionPenaltyYear")).toBe(String(PENALTY_YEAR_MAX));
    layerParamsStore.setParam(PENALTY, "pollutionPenaltyPlaying", true);
    expect(layerParamsStore.getParam(PENALTY, "pollutionPenaltyYear")).toBe(String(PENALTY_YEAR_MIN));
    expect(layerParamsStore.getParam(PENALTY, "pollutionPenaltyPlaying"), "被自己的級聯關掉了").toBe(true);
  });

  // ⚠️ 條件式級聯的**另一半**：年份不在端點時按播放**不該**倒帶。
  //    預設年份剛好是端點 → 逐參數擾動閘只驗得到會倒帶那一半，這半邊沒有別的閘。
  it("年份不在端點時按播放不倒帶（onlyWhenTargetIn 的另一半）", () => {
    layerParamsStore.setParam(PENALTY, "pollutionPenaltyYear", "2015");
    layerParamsStore.setParam(PENALTY, "pollutionPenaltyPlaying", true);
    expect(layerParamsStore.getParam(PENALTY, "pollutionPenaltyYear")).toBe("2015");
    expect(layerParamsStore.getParam(PENALTY, "pollutionPenaltyPlaying")).toBe(true);
  });

  it("選年份會連帶停止播放（無條件級聯）", () => {
    layerParamsStore.setParam(PENALTY, "pollutionPenaltyYear", "2015");
    layerParamsStore.setParam(PENALTY, "pollutionPenaltyPlaying", true);
    layerParamsStore.setParam(PENALTY, "pollutionPenaltyYear", "2018");
    expect(layerParamsStore.getParam(PENALTY, "pollutionPenaltyPlaying")).toBe(false);
  });

  it("setParamDirect 不觸發級聯（播放引擎逐年推進走這條）", () => {
    layerParamsStore.setParam(PENALTY, "pollutionPenaltyYear", "2015");
    layerParamsStore.setParam(PENALTY, "pollutionPenaltyPlaying", true);
    layerParamsStore.setParamDirect(PENALTY, "pollutionPenaltyYear", "2016");
    expect(layerParamsStore.getParam(PENALTY, "pollutionPenaltyPlaying"), "推進一年就自己停了").toBe(true);
  });

  it("一次級聯只換一次 snapshot、每個 key 只通知一次", () => {
    let hits = 0;
    const off = layerParamsStore.subscribeKey("indicators", () => { hits += 1; });
    layerParamsStore.setParam("indicators", "indCategory", "struct");
    expect(hits, "大類＋細項兩個寫入應該合成一次通知").toBe(1);
    expect(layerParamsStore.getParam("indicators", "indMetric")).toBe("sr");
    off();
  });

  it("cascade 的 target 只准指向同一個 key 自己的參數", () => {
    for (const [key, spec] of specs) {
      const own = new Set(spec.map((s) => s.name));
      for (const s of spec) {
        for (const rule of s.cascade ?? []) {
          expect(own.has(rule.target), `${key}.${s.name} 的 cascade 指向外部參數 "${rule.target}"`)
            .toBe(true);
        }
      }
    }
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
