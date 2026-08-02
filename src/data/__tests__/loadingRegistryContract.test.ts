/**
 * Loading UI 鐵則 ratchet（CLAUDE.md §3：「所有非同步載入必註冊 loadingRegistry，
 * 禁靜默 `.rpc().then()`」）—— 這條規則寫在文件裡三個月，但**沒有任何守門**。
 *
 * 漏接的後果不是壞掉，是「使用者看著空白地圖不知道在載入還是沒資料」。
 * 這種失敗永遠不會有人回報 bug，只會默默降低信任 —— 正是最需要機器守門的類型。
 *
 * 做法：掃 `src/data/*Loader.ts` 的每個 `supabase.rpc(` / `staticRpc(`，
 * 檢查 ±10 行內有沒有 `withLoading`（涵蓋 `const rpc = supabase.rpc(...)` 後面
 * 才 `await withLoading(..., rpc)` 的寫法）。不合的必須列在下方豁免名單並寫理由。
 *
 * 豁免的判準是「這次載入該不該讓使用者看到 LOADING 面板」：
 *   - popup 點開才抓的時序（sparkline）→ 不該（面板會閃）
 *   - 背景 prefetch → 不該（刻意靜默）
 *   - 被外層 withLoading 包住的內部 helper → 已經有了
 * 除此之外的「圖層資料載入」一律要包。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const LOADER_DIR = "src/data";
const WINDOW = 10;

/**
 * 已知且合理的豁免（`檔名:函式名`）。新增前先問：使用者在等這筆資料時，
 * 畫面上有沒有別的東西告訴他「正在載入」？沒有的話就該包 withLoading 而不是加進這裡。
 */
const EXEMPT: Record<string, string> = {
  // popup 點開才抓的單站時序（sparkline）—— 掛 LOADING 面板會每次點都閃一下
  "floodSensorLoader.ts:fetchFloodSensorTimeseries": "popup sparkline on-demand",
  "groundwaterLoader.ts:fetchGroundwaterTimeseries": "popup sparkline on-demand",
  "rainGaugeLoader.ts:fetchRainGaugeTimeseries": "popup sparkline on-demand",
  "riverLevelLoader.ts:fetchRiverLevelTimeseries": "popup sparkline on-demand",
  "wicTaipeiLoader.ts:fetchTaipeiSewerTimeseries": "popup sparkline on-demand",
  "wicTaipeiLoader.ts:fetchTaipeiPumbTimeseries": "popup sparkline on-demand",
  "wicTaipeiLoader.ts:fetchTaipeiEvacuateTimeseries": "popup sparkline on-demand",
  "cwaImageryLoader.ts:fetchCwaImageryBytes": "popup/單幀 on-demand",
  "energyLoader.ts:_fetchProvenance": "popup 溯源 lazy（已有 promise cache）",
  "dataCatalogLoader.ts:results": "popup『資料來源』面板 lazy",
  "dataCatalogLoader.ts:fetchDataCatalogByTheme": "popup『資料來源』面板 lazy",
  "airportPaxLoader.ts:fetchAirportHourlyPax": "monitor 面板 widget，非圖層載入",
  // 背景 prefetch：刻意不灌 LOADING panel（檔內註解有寫）
  "lightningLoader.ts:fetchLightningDayRaw": "raw 版供背景 prefetch；wrapped 版才包 withLoading",
  "nuclearLoader.ts:fetchNuclearDayRaw": "同上",
  // 內部 helper：由呼叫端包
  "busLoader.ts:fetchBusTrailsForCity": "per-city 內部 fetch，外層 fetchBusTrails 已包",
};

interface Finding { key: string; file: string; line: number }

function scan(): Finding[] {
  const found: Finding[] = [];
  for (const file of readdirSync(LOADER_DIR).filter((f) => f.endsWith("Loader.ts"))) {
    const lines = readFileSync(`${LOADER_DIR}/${file}`, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (!/\b(supabase\.rpc|staticRpc)\(/.test(line)) return;
      const context = lines.slice(Math.max(0, i - WINDOW), i + WINDOW + 1).join("\n");
      if (context.includes("withLoading")) return;
      // 往上找最近的 function / const 宣告當作函式名
      let fn = "?";
      for (let j = i; j >= 0; j--) {
        const m = /(?:function|const)\s+(\w+)/.exec(lines[j] ?? "");
        if (m) { fn = m[1] as string; break; }
      }
      found.push({ key: `${file}:${fn}`, file, line: i + 1 });
    });
  }
  return found;
}

describe("Loading UI 鐵則（CLAUDE.md §3）", () => {
  it("loader 的 RPC 呼叫都包了 withLoading（或列在豁免名單）", () => {
    const unwrapped = scan().filter((f) => !(f.key in EXEMPT));
    expect(
      unwrapped.map((f) => `${f.file}:${f.line} (${f.key})`),
      `這些 loader 的 RPC 沒有註冊 loadingRegistry —— 使用者會看著空白地圖不知道在載入：\n` +
      `→ 包成 withLoading("<key>", "<中文標籤>", supabase.rpc(...))；\n` +
      `→ 若確實不該顯示 LOADING 面板（popup lazy / 背景 prefetch），加進本檔 EXEMPT 並寫理由`,
    ).toEqual([]);
  });

  it("豁免名單只進不退（該函式若已補上 withLoading，就要從名單移除）", () => {
    const stillUnwrapped = new Set(scan().map((f) => f.key));
    const stale = Object.keys(EXEMPT).filter((k) => !stillUnwrapped.has(k));
    expect(
      stale,
      `這些已經不需要豁免了（可能已補 withLoading 或函式被刪）→ 請從 EXEMPT 移除：\n  ${stale.join("\n  ")}`,
    ).toEqual([]);
  });
});
