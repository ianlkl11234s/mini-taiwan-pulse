/**
 * 點擊接線 ratchet —— GIS_LAYERS（`map/gisClickRegistry.ts`）引用的每個 Mapbox
 * layer id 都必須真的存在。
 *
 * 為什麼要有這支：layer id 是**手寫字串**（`"mountain-huts-circle"`），拼錯的話
 * `queryRenderedFeatures` 只會回空陣列 —— **popup 靜默失效，不報錯、不當機**，
 * 要在瀏覽器上點半天才會發現「怎麼點不出來」。tsc 也擋不住（就是個 string）。
 *
 * 判準（兩者其一即通過）：
 *   1. 由 OVERLAY_REGISTRY 算得出來（`${sourceId}-${suffix}`）—— 涵蓋工廠產生的層
 *      （sports / livestock / religion…），因為 registry 在 import 時就已展開。
 *   2. 該字面字串在 src/ 其他檔案出現過（hook / CustomLayer 自建的層，如
 *      `eq-replay-station-circle`、`road-congestion-hit`）。
 *
 * 兩條都不中 = 這個 id 只存在於註冊表自己 → 幾乎必然是拼錯或殘留。
 *
 * ⚠️ **本檔刻意仍是原始碼文字解析**，即使 Phase 4b 已把 GIS_LAYERS 提升成模組級
 * export（黃金快照那邊確實換成 runtime 真值了）。理由是**實測過會誤報**：
 * 改成 runtime 之後 `DISASTER_ALERT_CLICK_LAYERS` 那 15 個 id 會一起進來，
 * 而它們是樣板字串產生的（`useDisasterAlertLayer` 的 `` `${group}-fill` `` 等），
 * 上面兩條判準**一條都不中** → 15 個全部誤報成 orphan。要讓它們過關只能寫一份
 * 豁免清單，那正是本專案不做的「靜默豁免」。文字解析剛好只吃字面陣列，
 * 涵蓋範圍與升級前逐字相同。**別再「升級」它**。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import { STATISTICS_KEYS, STATISTICS_RECIPES } from "../../data/regionalStatisticsRecipes";

const REGISTRY_FILE = "src/map/gisClickRegistry.ts";
const source = readFileSync(REGISTRY_FILE, "utf8");

/** GIS_LAYERS 陣列裡每個 `layers: [...]` 的字串字面 */
function referencedLayerIds(): string[] {
  const ids = new Set<string>();
  for (const block of source.matchAll(/layers:\s*\[([^\]]*)\]/gs)) {
    for (const s of (block[1] ?? "").matchAll(/"([^"]+)"/g)) ids.add(s[1] as string);
  }
  return [...ids];
}

/** registry 能組出來的所有 layer id（含工廠展開後的） */
function registryLayerIds(): Set<string> {
  const out = new Set<string>();
  for (const config of OVERLAY_REGISTRY) {
    for (const spec of config.layers) out.add(`${config.sourceId}-${spec.suffix}`);
  }
  return out;
}

/** Statistics layers are dynamically named `${key}-fill` / `${key}-line` by
 * the MapView-attached runtime renderer, rather than OVERLAY_REGISTRY. */
function statisticsRuntimeLayerIds(): Set<string> {
  return new Set(STATISTICS_KEYS.flatMap((key) => [`${key}-fill`, `${key}-line`]));
}

/** 遞迴收集 src/ 下所有 ts/tsx 原始碼（排除註冊表自己與測試檔） */
function otherSources(dir = "src"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...otherSources(full));
    } else if (/\.tsx?$/.test(entry) && full !== REGISTRY_FILE) {
      out.push(readFileSync(full, "utf8"));
    }
  }
  return out;
}

describe("GIS 點擊註冊表的 layer id", () => {
  it("引用的每個 layer id 都真的被建立（否則 popup 靜默失效）", () => {
    const fromRegistry = registryLayerIds();
    const fromStatisticsRuntime = statisticsRuntimeLayerIds();
    const others = otherSources().join("\n");
    const orphans = referencedLayerIds().filter(
      (id) => !fromRegistry.has(id) && !fromStatisticsRuntime.has(id) && !others.includes(`"${id}"`) && !others.includes(`\`${id}\``),
    );
    expect(
      orphans,
      `這些 layer id 只出現在 ${REGISTRY_FILE}，沒有任何地方建立它們 —— ` +
      `點擊會靜默無反應：\n  ${orphans.join("\n  ")}\n` +
      `→ 對照 overlayRegistry 的 sourceId + suffix，或該層所屬的 hook/CustomLayer`,
    ).toEqual([]);
  });

  it("statistics 動態 id 必須與 recipe key 和 renderer 成對存在", () => {
    expect(Object.keys(STATISTICS_RECIPES).sort()).toEqual([...STATISTICS_KEYS].sort());
    const renderer = readFileSync("src/map/regionalStatisticsMap.ts", "utf8");
    expect(renderer).toContain("map.addLayer({ id: `${key}-fill`");
    expect(renderer).toContain("map.addLayer({ id: `${key}-line`");
    for (const key of STATISTICS_KEYS) {
      expect(referencedLayerIds()).toContain(`${key}-fill`);
      expect(statisticsRuntimeLayerIds().has(`${key}-fill`)).toBe(true);
      expect(statisticsRuntimeLayerIds().has(`${key}-line`)).toBe(true);
    }
  });

  it("registry 的 id 命名規則沒有漂移（sourceId-suffix）", () => {
    // 若哪天 overlayManager 改了 layerId() 的組法，本測試的判準 1 會整批失效
    // （變成全靠判準 2 的字串搜尋兜底，保護力大幅下降）→ 固定住這個契約。
    const managerSource = readFileSync("src/map/overlayManager.ts", "utf8");
    expect(
      managerSource,
      "overlayManager.layerId() 的組法變了 → 請同步更新 mapInteractionLayers 測試的判準 1",
    ).toContain("`${config.sourceId}-${suffix}`");
  });
});
