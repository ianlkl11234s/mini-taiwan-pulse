/**
 * overlayParams 依賴完整性 ratchet。
 *
 * `useLayerParamsRuntime` 的 `overlayParams` 是一個 500+ 鍵的 `useMemo`，deps 陣列
 * 也是手寫的 500+ 個變數名。漏掉一個的後果：**那個 slider 拖了畫面完全沒反應**
 * —— 沒有錯誤、沒有 warning，只是「這個功能好像壞了」。React 的 exhaustive-deps
 * lint 對這種超長陣列在實務上也常被關掉或忽略。
 *
 * 本測試用純文字比對（同 layerConsistency 的 heuristic 風格）：
 * `useState` 宣告的 state 變數，只要出現在 overlayParams 的物件字面裡，
 * 就必須也出現在 deps 陣列裡。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const FILE = "src/hooks/useLayerParamsRuntime.ts";
const source = readFileSync(FILE, "utf8");
const MEMO_START = "const overlayParams = useMemo<Record<string, number>>(() => ({";

describe("overlayParams useMemo 依賴", () => {
  it("物件裡用到的 state 變數都出現在 deps 陣列", () => {
    const start = source.indexOf(MEMO_START);
    expect(start, `找不到 overlayParams useMemo 起點（結構變了？請更新本測試的 MEMO_START）`).toBeGreaterThan(-1);

    const depsStart = source.indexOf("}), [", start);
    const depsEnd = source.indexOf("]);", depsStart);
    const body = source.slice(start + MEMO_START.length, depsStart);
    const depsText = source.slice(depsStart + "}), [".length, depsEnd);

    const stateVars = new Set([...source.matchAll(/const \[(\w+),\s*set\w+\]\s*=\s*useState/g)].map((m) => m[1] as string));
    const deps = new Set([...depsText.matchAll(/\b(\w+)\b/g)].map((m) => m[1] as string));
    const used = new Set([...body.matchAll(/\b(\w+)\b/g)].map((m) => m[1] as string).filter((t) => stateVars.has(t)));

    const missing = [...used].filter((v) => !deps.has(v)).sort();
    expect(
      missing,
      `這些 state 有進 overlayParams 但沒進 deps —— 對應的 slider/下拉拖了畫面不會更新` +
      `（無錯誤、無警告，只是「好像壞了」）：\n  ${missing.join("\n  ")}\n` +
      `→ 加到 ${FILE} 的 overlayParams deps 陣列`,
    ).toEqual([]);

    // 反向：deps 列了但物件裡沒用到 → 多餘的重算觸發（效能雜訊，不擋，只提示）
    const unused = [...deps].filter((d) => stateVars.has(d) && !used.has(d));
    if (unused.length) console.log(`ℹ️ deps 有但 overlayParams 沒用到的 ${unused.length} 個：${unused.join(", ")}`);
    console.log(`✓ overlayParams 用到 ${used.size} 個 state，deps 覆蓋 ${used.size - missing.length} 個`);
  });
});
