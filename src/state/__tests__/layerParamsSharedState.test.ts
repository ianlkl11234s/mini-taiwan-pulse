/**
 * 共用 state 護欄（AR-22 P3-2B）
 *
 * ⚠️ 這是 P3-2A 唯一「四道閘全綠、畫面卻壞掉」那個形狀的專屬閘。
 *
 * 已退役的 `useLayerParamsRuntime` 有一種形狀是**多個 layer key 共用同一個 `useState`**：
 * ```ts
 * case "eduKindergarten":
 * case "eduAfterschoolCare":
 * case "eduMutualCare": return [ slider(eduChildcareOpacity) ];
 * ```
 * 一份值、三個面板、一個 overlayParams key（`overlayRegistry` 三層都讀它）。
 * per-key spec 直接搬會產生三份互不相干的值卻共用一個 `out` ——
 * 拖一邊 paint 不動、另外兩個面板也不動，而**黃金快照（比預設值，三份天生相等）／
 * tsc／既有行為測試都不會紅**。
 *
 * 三道斷言分別擋三種搬法錯誤：
 *   1. **spec 側**：撞名的 `name` / `out` 必須宣告同一個 `sharedGroup`
 *      → 擋「整組搬了但沒用共用表達」。⚠️ AR-22 Phase 4 起這是**唯一**還有母體的一道
 *      —— hook 的 switch 已清空，共用值的形狀只可能出現在規格檔裡。
 *   2. ~~**來源交叉**~~ / 3. ~~**switch 不准回來**~~ → **AR-22 P4 一併退役**：
 *      兩者守的都是 `hooks/useLayerParamsRuntime.ts` 的原始碼字面，而那支檔
 *      已整支刪除（owner 2026-08-12 拍板）。母體歸零，詳見下方第 2/3 節的說明。
 */
import { describe, it, expect } from "vitest";
import {
  LAYER_PARAMS_SPEC, MIGRATED_PARAMS_KEYS, SHARED_PARAM_GROUPS,
  sharedSlotMembers, specOutKey,
  type LayerParamSpec,
} from "../../data/layerParamsSpec";

const entries = MIGRATED_PARAMS_KEYS.flatMap((key) =>
  (LAYER_PARAMS_SPEC[key] as LayerParamSpec[]).map((spec) => ({ key, spec })),
);

// ── 1. spec 側：撞名 ⇒ 必須是同一個共用 slot ───────────────────────

describe("共用 slot 的宣告", () => {
  it("撞名的 name / out 必須宣告同一個 sharedGroup", () => {
    for (const field of ["name", "out"] as const) {
      const byId = new Map<string, { key: string; group?: string }[]>();
      for (const { key, spec } of entries) {
        const id = field === "name" ? spec.name : specOutKey(spec);
        // `out: null`（第二通道）不進 overlayParams → 沒有「共用同一個 out key」
        // 這個失效可言；它們的共用由 name 那一輪負責。
        if (id === null) continue;
        const list = byId.get(id) ?? [];
        list.push({ key, group: spec.sharedGroup });
        byId.set(id, list);
      }
      for (const [id, list] of byId) {
        if (list.length === 1) continue;
        const groups = new Set(list.map((x) => x.group));
        expect(
          groups.size === 1 && !groups.has(undefined),
          `${field} "${id}" 被 ${list.map((x) => x.key).join(" / ")} 共用，` +
          "但沒有全部宣告同一個 sharedGroup —— 這正是「拖一邊 paint 不動」的形狀",
        ).toBe(true);
      }
    }
  });

  it("每個 sharedGroup 至少 2 個成員，且成員的規格逐欄位相同", () => {
    for (const [id, members] of SHARED_PARAM_GROUPS) {
      expect(members.length, `sharedGroup "${id}" 只有一個成員（多半是打錯 id）`)
        .toBeGreaterThan(1);
      const specs = members.map(({ key, name }) =>
        (LAYER_PARAMS_SPEC[key] as LayerParamSpec[]).find((s) => s.name === name),
      );
      for (const s of specs) {
        expect(s, `sharedGroup "${id}" 有成員查無規格`).toBeDefined();
        expect(s, `sharedGroup "${id}" 的成員規格不一致（共用的是同一份值，` +
          "label / default / min-max-step 必須逐字相同)").toEqual(specs[0]);
      }
    }
  });

  it("sharedSlotMembers 對獨佔參數回 null、對共用參數回全體成員", () => {
    expect(sharedSlotMembers("cemeteryOsm", "cemeteryOsmOpacity")).toBeNull();
    for (const [, members] of SHARED_PARAM_GROUPS) {
      for (const m of members) expect(sharedSlotMembers(m.key, m.name)).toEqual(members);
    }
  });
});

// ── 2/3 節已於 AR-22 P4 退役（owner 2026-08-12 拍板）───────────────
//
// 原本這裡有兩節，守備對象都是 `hooks/useLayerParamsRuntime.ts` 的**原始碼字面**：
//   2. 來源交叉：已遷移的參數不得還留著 `useState` 宣告 ／ 還是 overlayParams
//      字面的屬性（＝「只搬一半」的兩種現場）
//   3. switch 維持清空：不准把 getControls 的 case 加回去
//
// **那支檔已整支刪除**，母體歸零 —— 兩節連同 `stripComments` /
// `overlayLiteralProps` 兩支解析器一起變成沒有對象的死碼（P3-2D 當初就寫了
// 「終局刪檔時本段會跟著 switch 一起消失」）。
//
// ⚠️ 被擋的行為一項未減，因為它們現在**在結構上不可能發生**：
//   - 「共用一個 useState」那個形狀需要一支持有 state 的 hook；值的家已經
//     只剩 `layerParamsStore`，共用語意改由規格側的 `sharedGroup` 宣告，
//     由上方第 1 節三條斷言 ＋ store 的 `setParam` 展開邏輯保護。
//   - 「參數規格的家」現在是 `data/layerParamsSpec.ts`（唯一入口），
//     控件由 `buildParamControls` 單一函式派生，沒有第二條路可以長出 case。
