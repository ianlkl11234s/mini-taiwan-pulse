/**
 * layer hook 的 map-ready 競態守門（ratchet）。
 *
 * App 的 `mapRef.current` 要等 MapView 的 `map.on("load")` 才被填，而 production
 * 首載可能晚達 ~30 秒。在那之前建層 effect 會這樣：
 *
 * ```ts
 * const map = mapRef.current;
 * if (!map) return;      // ← 什麼也沒建
 * ```
 *
 * `mapRef` 是 ref，**`.current` 變動不觸發 re-render**，effect 不會重跑 ——
 * 只要 `visible` 之後沒再變，這個圖層就**永遠不會被建出來**。實際會中招的兩種
 * 情境：deep-link（`?layers=`，App 掛載時就設 visible）、以及使用者在首載
 * 完成前就手動點開圖層。症狀是「分享連結少圖層」，沒有任何錯誤訊息。
 *
 * 解法是 `useMapReadyTick`：map 就緒時遞增一個 tick，放進 deps 逼 effect 重跑。
 *
 * 本測試用純文字比對（同 layerConsistency / overlayParamsDeps 的 heuristic 風格）：
 * 只要一個 layer hook 檔案裡出現「deps 陣列含 mapRef」，該陣列就必須同時含
 * `mapTick`（或舊寫法 `mapRetry`）。新增 layer hook 漏接時這裡會紅。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const HOOKS_DIR = "src/hooks";

/** 從 `}, [ ... ]);` 抓出 deps 陣列內容 */
const DEPS_RE = /\}, \[([^\]]*)\]\);/g;

function collectDepsArrays(source: string): string[] {
  return [...source.matchAll(DEPS_RE)].map((m) => m[1] as string);
}

describe("layer hook map-ready 競態", () => {
  const files = readdirSync(HOOKS_DIR)
    .filter((f) => /^use.*Layer\.ts$/.test(f))
    .concat(["factories/timelineSliceLayer.ts"]);

  it("含 mapRef 的 deps 陣列都帶上 mapTick", () => {
    const offenders: string[] = [];

    for (const f of files) {
      const source = readFileSync(join(HOOKS_DIR, f), "utf8");
      for (const deps of collectDepsArrays(source)) {
        if (!/\bmapRef\b/.test(deps)) continue;
        if (/\bmapTick\b|\bmapRetry\b/.test(deps)) continue;
        offenders.push(`${f} → [${deps.trim()}]`);
      }
    }

    expect(
      offenders,
      "這些 effect 的 deps 含 mapRef 但沒有 mapTick —— map 在首載後才就緒時，" +
        "effect 不會重跑，圖層永遠不會建出來（deep-link 與首載期間手動 toggle 都會中招）。" +
        "修法：`const mapTick = useMapReadyTick(mapRef, visible);` 並把 mapTick 放進 deps。\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("useMapReadyTick 在 map 就緒後會停掉輪詢（避免常駐 timer）", () => {
    const source = readFileSync(join(HOOKS_DIR, "useMapReadyTick.ts"), "utf8");
    // 就緒分支必須 clearInterval 後才 setTick，否則每 200ms 空轉一輩子
    expect(source).toMatch(/clearInterval\(timer\);\s*\n\s*setTick/);
    // map 已就緒時完全不該建 timer
    expect(source).toMatch(/if \(!enabled \|\| mapRef\.current\) return;/);
  });
});
