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
 * 「deps 含 mapRef 就必須含 mapTick（或舊寫法 mapRetry）」改由 ESLint 規則
 * `pulse/map-ready-tick-deps` 檢查（eslint-rules/rules/guards.js；範圍 src/hooks/use*Layer.ts
 * 與 factories/timelineSliceLayer.ts）。本檔只留 useMapReadyTick 本身的 timer 收尾。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HOOKS_DIR = "src/hooks";

describe("layer hook map-ready 競態", () => {
  it("useMapReadyTick 在 map 就緒後會停掉輪詢（避免常駐 timer）", () => {
    const source = readFileSync(join(HOOKS_DIR, "useMapReadyTick.ts"), "utf8");
    // 就緒分支必須 clearInterval 後才 setTick，否則每 200ms 空轉一輩子
    expect(source).toMatch(/clearInterval\(timer\);\s*\n\s*setTick/);
    // map 已就緒時完全不該建 timer
    expect(source).toMatch(/if \(!enabled \|\| mapRef\.current\) return;/);
  });
});
