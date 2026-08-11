/**
 * 共用 state 護欄（AR-22 P3-2B）
 *
 * ⚠️ 這是 P3-2A 唯一「四道閘全綠、畫面卻壞掉」那個形狀的專屬閘。
 *
 * `useTransportParams` 有一種形狀是**多個 layer key 共用同一個 `useState`**：
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
 *      → 擋「整組搬了但沒用共用表達」
 *   2. **來源交叉**：已遷移的 `name` / `out` 不得再出現在 `useTransportParams.ts`
 *      → 擋「fall-through group 只搬一半」（倖存的 `useState` 會被尾端 spread 蓋掉）
 *   3. **fall-through 完整性**：來源裡還在的 case 群組（fall-through ／ 跨 case 共用
 *      state）中，任一 key 已遷移即紅 → 擋「拆組遷移」與「遷了卻沒刪 case」
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  LAYER_PARAMS_SPEC, MIGRATED_PARAMS_KEYS, SHARED_PARAM_GROUPS,
  isMigratedParamsKey, sharedSlotMembers, specOutKey,
  type LayerParamSpec,
} from "../../data/layerParamsSpec";

const PARAMS_FILE = fileURLToPath(
  new URL("../../hooks/useTransportParams.ts", import.meta.url),
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

// ── 2. 來源交叉：已遷移的參數不得在 useTransportParams 留有殘影 ────

describe("已遷移參數與 useTransportParams 的交叉檢查", () => {
  it("已遷移的 name / out 不得再出現在 useTransportParams.ts", () => {
    // 尾端 `...migratedOverlayParams` 是**最後**才 spread 的：手寫字面若還在，
    // 它會被規格派生值覆蓋 → 那個未遷移夥伴的 slider 拖了 paint 不動。
    const stripped = stripComments(source);
    for (const { key, spec } of entries) {
      for (const id of new Set([spec.name, specOutKey(spec)])) {
        expect(
          new RegExp(`(?<![A-Za-z0-9_$])${id}(?![A-Za-z0-9_$])`).test(stripped),
          `${key} 已遷移，但 "${id}" 還留在 useTransportParams.ts —— ` +
          "共用 state 只搬一半的典型現場（或單純漏刪）",
        ).toBe(false);
      }
    }
  });

  it("已遷移的 key 不得還留著 getControls 的 case", () => {
    for (const key of MIGRATED_PARAMS_KEYS) {
      expect(
        new RegExp(`case\\s+"${key}"`).test(source),
        `${key} 已遷移但 case 還在（死碼；若它與別的 key fall-through 更是壞的）`,
      ).toBe(false);
    }
  });
});

// ── 3. fall-through 完整性：耦合的 key 必須整組進退 ────────────────

describe("useTransportParams 剩餘 case 的耦合群組", () => {
  const groups = parseCaseGroups(source);

  it("耦合群組（fall-through ／ 跨 case 共用 state）不得有成員已遷移", () => {
    for (const g of coupledComponents(groups)) {
      const migrated = g.filter((k) => isMigratedParamsKey(k));
      expect(
        migrated,
        `耦合群組 [${g.join(", ")}] 中 ${migrated.join(" / ")} 已遷移，` +
        "其餘還在 switch —— 共用的值會被拆成兩份，拖任一邊都不會生效。" +
        "整組一起搬並宣告 sharedGroup，或整組都別搬",
      ).toEqual([]);
    }
  });

  // ⚠️ 這條是**哨兵**不是規格：它防的是「解析器被改壞、一個群組都抓不到，
  //    於是上面那條永遠綠」。門檻會隨 switch 縮小而過時 —— 後棒把 case 數搬到
  //    低於門檻時，**調降門檻**即可（不要刪掉這條）。現況 switch 剩 78 組。
  it("解析器有抓到 case 群組與 fall-through（護欄本身沒被改壞的哨兵）", () => {
    expect(groups.length).toBeGreaterThan(20);
    expect(groups.some((g) => g.keys.length > 1)).toBe(true);
    expect(groups.some((g) => g.vars.length > 0)).toBe(true);
  });
});

// ── 解析工具 ──────────────────────────────────────────────────────

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

interface CaseGroup {
  /** fall-through 共用同一個 body 的全部 case key */
  keys: string[];
  /** body 裡讀寫的 useState 變數（由 `value:` / `onChange: setX` / `${X.` 錨定） */
  vars: string[];
}

/**
 * 從 `getControls` 的 switch 切出 case 群組。
 * 連續的 `case "K":`（冒號後無內容）視為 fall-through，與下一個帶 body 的 case 同組。
 */
function parseCaseGroups(src: string): CaseGroup[] {
  const body = switchBody(stripComments(src));
  const lines = body.split("\n");
  const groups: CaseGroup[] = [];
  let pending: string[] = [];
  let cur: { keys: string[]; body: string[] } | null = null;
  for (const line of lines) {
    const m = /^\s*case\s+"([A-Za-z0-9_]+)"\s*:(.*)$/.exec(line);
    if (m) {
      if (cur) { groups.push(toGroup(cur)); cur = null; }
      pending.push(m[1] as string);
      if ((m[2] as string).trim()) {
        cur = { keys: pending, body: [m[2] as string] };
        pending = [];
      }
      continue;
    }
    if (cur) cur.body.push(line);
  }
  if (cur) groups.push(toGroup(cur));
  return groups;
}

function toGroup(c: { keys: string[]; body: string[] }): CaseGroup {
  const text = c.body.join("\n");
  const vars = new Set<string>();
  for (const m of text.matchAll(/value:\s*([A-Za-z_$][A-Za-z0-9_$]*)/g)) vars.add(m[1] as string);
  for (const m of text.matchAll(/onChange:\s*set([A-Za-z0-9_$]+)/g)) {
    const n = m[1] as string;
    vars.add(n.charAt(0).toLowerCase() + n.slice(1));
  }
  for (const m of text.matchAll(/\$\{([A-Za-z_$][A-Za-z0-9_$]*)[.}]/g)) vars.add(m[1] as string);
  return { keys: c.keys, vars: [...vars] };
}

/** `switch (layer) { … }` 的內文 */
function switchBody(src: string): string {
  const gc = src.indexOf("const getControls =");
  const sw = src.indexOf("{", src.indexOf("switch (layer)", gc));
  let depth = 0;
  for (let i = sw; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(sw + 1, i);
    }
  }
  throw new Error("找不到 getControls 的 switch 主體");
}

/**
 * 連通分量：同一 case 群組的 key 互相耦合；共用同一個 state 變數的群組也耦合。
 * 只回傳 ≥2 key 的分量。
 */
function coupledComponents(groups: CaseGroup[]): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x);
    if (p === undefined || p === x) { parent.set(x, x); return x; }
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => { parent.set(find(a), find(b)); };

  const byVar = new Map<string, string[]>();
  for (const g of groups) {
    for (const k of g.keys) { find(k); union(k, g.keys[0] as string); }
    for (const v of g.vars) byVar.set(v, [...(byVar.get(v) ?? []), g.keys[0] as string]);
  }
  for (const heads of byVar.values()) {
    for (const h of heads) union(h, heads[0] as string);
  }

  const comps = new Map<string, string[]>();
  for (const g of groups) {
    for (const k of g.keys) {
      const r = find(k);
      comps.set(r, [...(comps.get(r) ?? []), k]);
    }
  }
  return [...comps.values()].filter((c) => c.length > 1);
}
