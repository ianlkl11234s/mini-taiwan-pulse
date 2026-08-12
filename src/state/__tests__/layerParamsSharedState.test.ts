/**
 * 共用 state 護欄（AR-22 P3-2B）
 *
 * ⚠️ 這是 P3-2A 唯一「四道閘全綠、畫面卻壞掉」那個形狀的專屬閘。
 *
 * `useLayerParamsRuntime` 有一種形狀是**多個 layer key 共用同一個 `useState`**：
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
 *   2. **來源交叉**：已遷移的 `name` / `out` 不得再出現在 `useLayerParamsRuntime.ts`
 *      → 擋「fall-through group 只搬一半」（倖存的 `useState` 會被尾端 spread 蓋掉）
 *   3. ~~**fall-through 完整性**~~ → Phase 4 換成**「switch 不准回來」**：
 *      最後 5 個 `emptyByDesign` case 已刪（改由 manifest 的 `params: null` 表達），
 *      沒有 case 就長不出 fall-through 群組。舊的 `parseCaseGroups` 解析器（~90 行）
 *      與「已遷移 key 不得留 case」那條（被新條完全涵蓋，且它掃的是含註解的原文）
 *      一併退役。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  LAYER_PARAMS_SPEC, MIGRATED_PARAMS_KEYS, SHARED_PARAM_GROUPS,
  sharedSlotMembers, specOutKey,
  type LayerParamSpec,
} from "../../data/layerParamsSpec";

const PARAMS_FILE = fileURLToPath(
  new URL("../../hooks/useLayerParamsRuntime.ts", import.meta.url),
);
const source = readFileSync(PARAMS_FILE, "utf8");

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

// ── 2. 來源交叉：已遷移的參數不得在 useLayerParamsRuntime 留有殘影 ────

describe("已遷移參數與 useLayerParamsRuntime 的交叉檢查", () => {
  /**
   * ⚠️ P3-2D 起判準從「識別字整個不准出現」改成**兩個精確位置**。
   *
   * 原版（P3-2B）用「已遷移的 name / out 不得再出現在檔裡」當代理判準，前提是
   * P3-1~2C 搬的 key **只走 overlayParams 這一條通道**，搬完就再也沒有合法引用。
   * D 桶不成立：`daOpacity` / `satOpacity` / `stationScale` 這些**同時是 hook
   * 回傳欄位的名字**，遷移後 hook 仍必須讀出來塞回 `return {}`（回傳 API 一字不動
   * 是 D 桶的設計前提）。代理判準留著會把「正確的遷移」判成紅。
   *
   * 被擋的行為一項未減 —— 原版真正在擋的是兩件事，各自改成錨定實際位置：
   *   (a) 舊的 `useState` 宣告還在（只搬一半 ／ 漏刪）
   *       → 倖存者的值被尾端 `...migratedOverlayParams` 蓋掉，拖了 paint 不動
   *   (b) overlayParams 物件字面裡還留著同名**屬性**
   *       → `out: null` 的參數會被手寫字面繼續餵舊值進 overlayParams
   * 其餘位置（deps 陣列項、ref sync 行）引用已刪的變數一律是 tsc 編譯錯，
   * 不需要文字判準；而「值有沒有真的從 store 流到回傳欄位」由
   * `hooks/__tests__/useLayerParamsRuntimeReturn.test.ts` 的逐參數隔離擾動直接驗，
   * 那比文字代理強得多。
   */
  const stripped = stripComments(source);

  it("(a) 已遷移的參數不得還留著 useState 宣告", () => {
    for (const { key, spec } of entries) {
      expect(
        new RegExp(`const\\s*\\[\\s*${spec.name}\\s*[,\\]]`).test(stripped),
        `${key} 已遷移，但 useLayerParamsRuntime.ts 還留著 "${spec.name}" 的 useState 宣告 —— ` +
        "共用 state 只搬一半的典型現場（或單純漏刪）：尾端 ...migratedOverlayParams " +
        "會蓋掉這份手寫值，拖了 paint 不動",
      ).toBe(false);
    }
  });

  it("(b) 已遷移的 out key 不得還是 overlayParams 物件字面的屬性", () => {
    const { props, body } = overlayLiteralProps(stripped);
    // 哨兵：解析器被改壞（抓到 0 個屬性）時上面那條會永遠綠。
    // ⚠️ P3-2D 群4 起手寫字面**已全部清空**（0 個屬性是正解）→ 哨兵語意升級成
    //    「memo body 真的只剩 ...migratedOverlayParams 這個 spread」。
    //    日後若有人往回加一個手寫屬性，這條與下面那條會同時盯著。
    if (props.size === 0) {
      expect(
        body.replace(/\s+/g, ""),
        "overlayParams 字面解析出 0 個屬性，但 body 也不是只剩 spread —— 解析器需同步更新",
      ).toBe("...migratedOverlayParams,");
    }
    for (const { key, spec } of entries) {
      const out = specOutKey(spec);
      if (out === null) continue;
      expect(
        props.has(out),
        `${key} 已遷移，但 "${out}" 還是 overlayParams 字面的屬性（死碼；` +
        "若該參數是 out: null 更會持續餵舊值進 overlayParams)",
      ).toBe(false);
    }
  });
});

// ── 3. switch 已清空：耦合群組不可能再從 hook 長出來 ────────────────

describe("useLayerParamsRuntime 的 getControls switch", () => {
  /**
   * ⚠️ **本 describe 於 AR-22 Phase 4 換了守備對象**（依 P3-2D 留下的指示：
   * 「終局刪檔時本段會跟著 switch 一起消失」——switch 沒了，但護欄不必跟著消失）。
   *
   * 原本這裡有兩條：`parseCaseGroups` 切出 fall-through 群組、驗「耦合群組不得有
   * 成員已遷移」，外加一條「解析得出群組」的哨兵。Phase 4 把最後 5 個
   * `emptyByDesign` case 刪光（改由 manifest 的 `params: null` 表達），
   * switch 整個收成 `buildParamControls(...) ?? []` ——
   * **母體歸零，那兩條與那 ~90 行解析器一起變成沒有對象的死碼。**
   *
   * 換上的這一條比它們更強也更簡單：**switch 不准回來**。
   * 只要沒有 case，就不可能出現「fall-through 共用一個 useState」那個形狀
   * （P3-2A 唯一「四道閘全綠、畫面卻壞掉」的形狀）。
   * 共用值的保護因此完全落在**規格側**：上方第 1 節的 `sharedGroup` 三條。
   */
  it("switch 維持清空（新控件一律走 LAYER_PARAMS_SPEC，不准加回 case）", () => {
    const cases = [...stripComments(source).matchAll(/case\s+"([A-Za-z0-9_]+)"/g)]
      .map((m) => m[1] as string);
    expect(
      cases,
      `useLayerParamsRuntime.ts 又長出 getControls case：${cases.join(", ")}\n` +
      "→ 參數規格的家是 src/data/layerParamsSpec.ts。加回 switch 會同時帶回兩個已消滅的" +
      "失敗模式：(1) fall-through 共用 useState（拖一邊 paint 不動，四道閘全綠）、" +
      "(2) 「有意沒有控件」寄生在 `case \"x\": return []` 的字面上（連註解都會被掃到）。",
    ).toEqual([]);
  });

  /**
   * 哨兵：上面那條在「解析器抓不到任何東西」時也會綠。錨定一個**必定存在**的字面，
   * 證明我們真的讀到了 getControls 而不是一個空字串。
   */
  it("讀得到 getControls 本體（護欄本身沒被改壞的哨兵）", () => {
    expect(
      stripComments(source).includes("const getControls ="),
      "找不到 getControls —— hook 結構變了，請同步更新本測試的錨點",
    ).toBe(true);
  });
});

// ── 解析工具 ──────────────────────────────────────────────────────

/**
 * `overlayParams` useMemo 物件字面的**屬性名**集合（不含 `...spread`）。
 * 錨定「行首／`{`／`,` 之後的識別字 ＋ `:` 或 `,`」——
 * 值運算式裡的識別字（`x ? 1 : 0` 的 `x`）前面是空白或 `?`，不會被收進來。
 * 邊界沿用 `overlayParamsDeps.test.ts` 已在用的同一組錨（各寫一份必漂移）。
 */
function overlayLiteralProps(strippedSrc: string): { props: Set<string>; body: string } {
  const MEMO_START = "const overlayParams = useMemo<Record<string, number>>(() => ({";
  const start = strippedSrc.indexOf(MEMO_START);
  if (start < 0) throw new Error("找不到 overlayParams useMemo 起點 —— 解析器需同步更新");
  const end = strippedSrc.indexOf("}), [", start);
  if (end < 0) throw new Error("找不到 overlayParams useMemo 的 deps 邊界 —— 解析器需同步更新");
  const body = strippedSrc.slice(start + MEMO_START.length, end);
  const props = new Set<string>();
  for (const m of body.matchAll(/(?:^|[,{])\s*([A-Za-z_$][\w$]*)\s*[:,]/gm)) props.add(m[1] as string);
  return { props, body };
}

/** 把註解換成等長空白（保留 offset）；字串／模板感知 */
function stripComments(src: string): string {
  const out = src.split("");
  let i = 0;
  let state: string | null = null;
  while (i < src.length) {
    const c = src[i] as string;
    if (state === null) {
      if (c === "/" && src[i + 1] === "/") { state = "//"; out[i] = out[i + 1] = " "; i += 2; continue; }
      if (c === "/" && src[i + 1] === "*") { state = "/*"; out[i] = out[i + 1] = " "; i += 2; continue; }
      if (c === '"' || c === "'" || c === "`") state = c;
      i += 1; continue;
    }
    if (state === "//") { if (c === "\n") state = null; else out[i] = " "; i += 1; continue; }
    if (state === "/*") {
      if (c === "*" && src[i + 1] === "/") { out[i] = out[i + 1] = " "; state = null; i += 2; continue; }
      if (c !== "\n") out[i] = " ";
      i += 1; continue;
    }
    if (c === "\\") { i += 2; continue; }
    if (c === state) state = null;
    i += 1;
  }
  return out.join("");
}

